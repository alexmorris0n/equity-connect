"""FastAPI server for outbound call API endpoint"""
import logging
import uuid
import re
import os
import json
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import httpx
from datetime import timedelta, datetime

from config import Config
from services.supabase import get_supabase_client, get_lead_by_phone
from services.signalwire import SignalWireClient
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="LiveKit Agent API", version="1.0.0")

# Initialize SignalWire client
signalwire_client = SignalWireClient()


class OutboundCallRequest(BaseModel):
    """Request model for outbound call endpoint"""
    to_phone: str = Field(..., description="Phone number to call (E.164 format)")
    lead_id: str = Field(..., description="Lead ID from database")
    from_phone: Optional[str] = Field(None, description="Optional SignalWire number to call FROM")
    broker_id: Optional[str] = Field(None, description="Optional broker ID")
    
    # Optional lead/broker data for variable injection
    lead_first_name: Optional[str] = None
    lead_last_name: Optional[str] = None
    lead_full_name: Optional[str] = None
    lead_email: Optional[str] = None
    lead_phone: Optional[str] = None
    property_address: Optional[str] = None
    property_city: Optional[str] = None
    property_state: Optional[str] = None
    property_zipcode: Optional[str] = None
    property_value: Optional[str] = None
    property_value_formatted: Optional[str] = None
    estimated_equity: Optional[str] = None
    estimated_equity_formatted: Optional[str] = None
    equity_50_percent: Optional[str] = None
    equity_50_formatted: Optional[str] = None
    equity_60_percent: Optional[str] = None
    equity_60_formatted: Optional[str] = None
    campaign_archetype: Optional[str] = None
    persona_assignment: Optional[str] = None
    persona_sender_name: Optional[str] = None
    broker_company: Optional[str] = None
    broker_full_name: Optional[str] = None
    broker_nmls: Optional[str] = None
    broker_phone: Optional[str] = None
    broker_display: Optional[str] = None
    qualified: Optional[bool] = None


def normalize_phone(phone: str) -> str:
    """Normalize phone number to E.164 format"""
    # Remove all non-digit characters
    digits = re.sub(r'\D', '', phone)
    
    # If it starts with 1 and has 11 digits, assume US number
    if len(digits) == 11 and digits[0] == '1':
        return f"+{digits}"
    
    # If it has 10 digits, assume US number
    if len(digits) == 10:
        return f"+1{digits}"
    
    # If it already starts with +, return as is
    if phone.startswith('+'):
        return phone
    
    # Otherwise, try to add +1 for US numbers
    if len(digits) == 10:
        return f"+1{digits}"
    
    return phone


async def get_phone_number_from_pool(lead_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Get an available phone number from the pool"""
    supabase = get_supabase_client()
    
    # Try to get a number assigned to this lead first
    if lead_id:
        response = supabase.from_('signalwire_phone_numbers').select('*').eq(
            'currently_assigned_to', lead_id
        ).eq('status', 'active').limit(1).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
    
    # Otherwise, get any available number
    response = supabase.from_('signalwire_phone_numbers').select('*').eq(
        'status', 'active'
    ).is_('currently_assigned_to', 'null').limit(1).execute()
    
    if response.data and len(response.data) > 0:
        return response.data[0]
    
    # Fallback: get any active number
    response = supabase.from_('signalwire_phone_numbers').select('*').eq(
        'status', 'active'
    ).limit(1).execute()
    
    if response.data and len(response.data) > 0:
        return response.data[0]
    
    return None


def build_livekit_sip_url(
    to_phone: str,
    from_phone: str,
    room_name: str,
    lead_id: Optional[str] = None,
    broker_id: Optional[str] = None
) -> str:
    """
    Build LiveKit SIP URL for outbound call
    
    Format: sip:{to}@{livekit_sip_domain};transport=tcp
    The LiveKit SIP bridge will create a room and connect the call
    """
    if not Config.LIVEKIT_SIP_DOMAIN:
        raise ValueError("LIVEKIT_SIP_DOMAIN not configured")
    
    # Build SIP URI
    sip_uri = f"sip:{to_phone}@{Config.LIVEKIT_SIP_DOMAIN};transport=tcp"
    
    # Add metadata as SIP headers or query params
    # LiveKit SIP bridge will extract these and set room metadata
    params = {
        "room": room_name,
        "from": from_phone,
        "to": to_phone,
    }
    
    if lead_id:
        params["lead_id"] = lead_id
    if broker_id:
        params["broker_id"] = broker_id
    
    # For SignalWire SWML, we'll use a Connect action to LiveKit SIP
    # The actual URL will be the SWML script URL that routes to LiveKit
    return sip_uri


def build_swml_script(
    livekit_sip_uri: str,
    room_name: str,
    from_phone: str,
    to_phone: str
) -> Dict[str, Any]:
    """
    Build SWML script that connects to LiveKit SIP
    
    Returns SWML JSON structure
    """
    return {
        "version": "1.0.0",
        "sections": {
            "main": [
                {
                    "connect": {
                        "to": livekit_sip_uri,
                        "from": from_phone,
                        "answer_on_bridge": True,
                        "timeout": 30
                    }
                }
            ]
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "livekit-agent-api"}


@app.post("/api/outbound-call")
async def create_outbound_call(
    request: OutboundCallRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Create an outbound call via SignalWire → LiveKit SIP
    
    This endpoint:
    1. Validates and normalizes phone numbers
    2. Looks up lead/broker data from Supabase
    3. Selects a phone number from the pool (if not specified)
    4. Creates a SignalWire call that routes to LiveKit SIP
    5. LiveKit SIP bridge creates a room and connects the agent
    """
    # Check authentication if BRIDGE_API_KEY is set
    if Config.BRIDGE_API_KEY:
        if not authorization:
            raise HTTPException(status_code=401, detail="Missing Authorization header")
        
        expected_auth = f"Bearer {Config.BRIDGE_API_KEY}"
        if authorization != expected_auth:
            raise HTTPException(status_code=403, detail="Invalid API key")
    
    try:
        # Normalize phone numbers
        normalized_to = normalize_phone(request.to_phone)
        logger.info(f"📞 Outbound call request: {normalized_to} (lead_id={request.lead_id})")
        
        # Get lead data from Supabase
        supabase = get_supabase_client()
        lead_response = supabase.from_('leads').select('*, brokers:assigned_broker_id (*)').eq(
            'id', request.lead_id
        ).single().execute()
        
        if not lead_response.data:
            raise HTTPException(status_code=404, detail=f"Lead not found: {request.lead_id}")
        
        lead_data = lead_response.data
        broker_data = lead_data.get('brokers') if isinstance(lead_data.get('brokers'), dict) else None
        
        # Determine broker_id
        broker_id = request.broker_id or (broker_data.get('id') if broker_data else None)
        
        # Select phone number from pool if not specified
        from_number = request.from_phone
        if not from_number:
            phone_record = await get_phone_number_from_pool(request.lead_id)
            if not phone_record:
                raise HTTPException(
                    status_code=503,
                    detail="No available phone numbers in pool"
                )
            from_number = phone_record.get('number')
            logger.info(f"📱 Selected phone number from pool: {from_number}")
        else:
            # Verify the phone number exists in database
            phone_response = supabase.from_('signalwire_phone_numbers').select('*').eq(
                'number', from_number
            ).single().execute()
            
            if not phone_response.data:
                raise HTTPException(
                    status_code=404,
                    detail=f"Phone number not found: {from_number}"
                )
        
        # Generate unique room name for this call
        room_name = f"outbound-{uuid.uuid4().hex[:12]}"
        
        # Build LiveKit SIP URI
        livekit_sip_uri = build_livekit_sip_url(
            to_phone=normalized_to,
            from_phone=from_number,
            room_name=room_name,
            lead_id=request.lead_id,
            broker_id=broker_id
        )
        
        # For SignalWire, we need to create a SWML script URL
        # The SWML script will connect to LiveKit SIP
        # For now, we'll use SignalWire's SWML API or create a webhook URL
        
        # Build SWML webhook URL that will return the SWML script
        # This should be the public URL of this API server
        # For now, we'll use an environment variable or construct from known base URL
        api_base_url = os.getenv("API_BASE_URL", "http://localhost:8080")
        swml_webhook_url = f"{api_base_url}/api/swml-outbound?room={room_name}&lead_id={request.lead_id}&broker_id={broker_id or ''}"
        
        # Actually, for simplicity, we'll create the call directly with a SWML script
        # SignalWire supports inline SWML via their API
        
        # Create SignalWire call with SWML that connects to LiveKit SIP
        # We'll use SignalWire's SWML API endpoint
        swml_script = build_swml_script(
            livekit_sip_uri=livekit_sip_uri,
            room_name=room_name,
            from_phone=from_number,
            to_phone=normalized_to
        )
        
        # For SignalWire, we need to either:
        # 1. Host a SWML endpoint that returns the script
        # 2. Use SignalWire's SWML API to create a script and reference it
        
        # For now, let's create a simple approach:
        # Create a SignalWire call that routes to a SWML endpoint
        # The SWML endpoint will return the script that connects to LiveKit
        
        # Actually, the simplest approach is to use SignalWire's DAPP with SWML
        # But for API-based calls, we can use SignalWire's SWML API
        
        # Let's use a simpler approach: create the call with a URL that returns SWML
        # We'll need to host this SWML endpoint separately or inline it
        
        # For now, let's create the SignalWire call pointing to LiveKit SIP directly
        # SignalWire can connect to SIP endpoints via SWML
        
        # Create SignalWire call
        call_result = await signalwire_client.create_call(
            to=normalized_to,
            from_number=from_number,
            url=swml_webhook_url,  # This should return SWML that connects to LiveKit
            status_callback=None  # Optional: add status callback URL
        )
        
        logger.info(f"✅ Outbound call created: {call_result['sid']}")
        
        return {
            "success": True,
            "message": "✅ Outbound call created successfully",
            "call_id": call_result['sid'],
            "room_name": room_name,
            "from_number": from_number,
            "to_number": normalized_to,
            "lead_id": request.lead_id,
            "broker_id": broker_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to create outbound call: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create call: {str(e)}")


@app.post("/api/swml-outbound")
async def swml_outbound_webhook(request: Request):
    """
    SWML webhook endpoint that returns SWML script for LiveKit SIP connection
    
    SignalWire calls this endpoint and expects SWML JSON response
    """
    # Extract call parameters from SignalWire webhook
    form_data = await request.form()
    call_from = form_data.get("From", "")
    call_to = form_data.get("To", "")
    call_sid = form_data.get("CallSid", "")
    
    # Extract room name and metadata from query params or headers
    room_name = request.query_params.get("room", f"outbound-{call_sid}")
    lead_id = request.query_params.get("lead_id")
    broker_id = request.query_params.get("broker_id")
    
    # Build LiveKit SIP URI
    if not Config.LIVEKIT_SIP_DOMAIN:
        logger.error("LIVEKIT_SIP_DOMAIN not configured")
        return JSONResponse(
            status_code=500,
            content={"error": "LiveKit SIP not configured"}
        )
    
    # Normalize phone numbers
    to_phone = normalize_phone(call_to)
    from_phone = normalize_phone(call_from)
    
    # Build SIP URI for LiveKit
    livekit_sip_uri = f"sip:{to_phone}@{Config.LIVEKIT_SIP_DOMAIN};transport=tcp"
    
    # Build SWML script
    swml_script = {
        "version": "1.0.0",
        "sections": {
            "main": [
                {
                    "connect": {
                        "to": livekit_sip_uri,
                        "from": from_phone,
                        "answer_on_bridge": True,
                        "timeout": 30,
                        "headers": {
                            "X-Room-Name": room_name,
                            "X-From": from_phone,
                            "X-To": to_phone,
                            **({"X-Lead-Id": lead_id} if lead_id else {}),
                            **({"X-Broker-Id": broker_id} if broker_id else {})
                        }
                    }
                }
            ]
        }
    }
    
    logger.info(f"📋 SWML script generated for call {call_sid} → LiveKit room {room_name}")
    
    return JSONResponse(content=swml_script)


@app.get("/api/swml-inbound")
@app.post("/api/swml-inbound")
async def swml_inbound_webhook(request: Request):
    """
    SWML webhook endpoint for inbound calls
    Returns SWML script that routes SignalWire calls to LiveKit SIP
    
    SignalWire calls this endpoint when an inbound call arrives.
    Uses SWML template variables to dynamically extract call.from and call.to
    (just like ElevenLabs pattern)
    """
    # Build LiveKit SIP URI
    if not Config.LIVEKIT_SIP_DOMAIN:
        logger.error("LIVEKIT_SIP_DOMAIN not configured")
        return JSONResponse(
            status_code=500,
            content={"error": "LiveKit SIP not configured"}
        )
    
    # Build SWML script using template variables (per SignalWire's official LiveKit guide)
    # Reference: https://developer.signalwire.com/ai/guides/integrations/livekit/inbound/
    swml_script = {
        "version": "1.0.0",
        "sections": {
            "main": [
                {
                    "connect": {
                        "to": f"sip:%{{call.to}}@{Config.LIVEKIT_SIP_DOMAIN};transport=tcp"
                    }
                }
            ]
        }
    }
    
    logger.info(f"📞 SWML inbound script generated for LiveKit SIP bridge")
    
    return JSONResponse(
        content=swml_script,
        headers={"Content-Type": "application/json"}
    )


@app.get("/api/interactions/{interaction_id}/recording-url")
async def get_recording_url(interaction_id: str, expires_in: int = 3600):
    """
    Get signed URL for call recording
    
    Args:
        interaction_id: Interaction ID from database
        expires_in: URL expiration time in seconds (default: 1 hour)
    
    Returns:
        Signed URL for the recording
    """
    try:
        supabase = get_supabase_client()
        
        # Fetch interaction record
        response = supabase.table('interactions')\
            .select('recording_bucket, recording_object_path, recording_mime_type, recording_storage')\
            .eq('id', interaction_id)\
            .single()\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Interaction not found")
        
        recording_bucket = response.data.get('recording_bucket')
        recording_object_path = response.data.get('recording_object_path')
        recording_storage = response.data.get('recording_storage', 's3')
        
        if not recording_bucket or not recording_object_path:
            raise HTTPException(
                status_code=404, 
                detail="No recording found for this interaction"
            )
        
        # Generate signed URL depending on storage provider
        if recording_storage == 'supabase':
            try:
                sb = get_supabase_client()
                # create_signed_url returns dict with 'signedURL' or full URL depending on SDK version
                res = sb.storage.from_(recording_bucket).create_signed_url(
                    recording_object_path, expires_in
                )
                signed_url = res.get('signedURL') if isinstance(res, dict) else res
                if not signed_url:
                    raise Exception("No signed URL returned from Supabase")
                
                logger.info(f"✅ Generated Supabase signed URL for interaction {interaction_id}")
                return JSONResponse(content={
                    'signed_url': signed_url,
                    'expires_in': expires_in,
                    'mime_type': response.data.get('recording_mime_type', 'audio/ogg'),
                    'bucket': recording_bucket,
                    'object_path': recording_object_path,
                    'storage': 'supabase',
                })
            except Exception as e:
                logger.error(f"❌ Failed to generate Supabase signed URL: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate Supabase signed URL: {str(e)}"
                )
        else:
            # Default: S3-compatible
            # Check AWS credentials
            if not all([
                Config.AWS_ACCESS_KEY_ID,
                Config.AWS_SECRET_ACCESS_KEY,
                Config.AWS_REGION
            ]):
                raise HTTPException(
                    status_code=500,
                    detail="AWS credentials not configured"
                )
            
            # Generate presigned URL
            s3_client = boto3.client(
                's3',
                aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
                region_name=Config.AWS_REGION
            )
            
            try:
                signed_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': recording_bucket,
                        'Key': recording_object_path
                    },
                    ExpiresIn=expires_in
                )
                
                logger.info(f"✅ Generated S3 signed URL for interaction {interaction_id} (expires in {expires_in}s)")
                
                return JSONResponse(content={
                    'signed_url': signed_url,
                    'expires_in': expires_in,
                    'mime_type': response.data.get('recording_mime_type', 'audio/ogg'),
                    'bucket': recording_bucket,
                    'object_path': recording_object_path,
                    'storage': 's3',
                })
                
            except ClientError as e:
                logger.error(f"❌ Failed to generate S3 signed URL: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate signed URL: {str(e)}"
                )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting recording URL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ============================================================================
# AI TEMPLATES API
# ============================================================================

@app.get("/api/ai-templates")
async def list_templates(broker_id: Optional[str] = None):
    """List all AI templates (system + broker's custom)"""
    try:
        supabase = get_supabase_client()
        query = supabase.table("ai_templates").select("*")
        
        if broker_id:
            # Broker sees their own templates + system defaults
            query = query.or_(f"broker_id.eq.{broker_id},is_system_default.eq.true")
        else:
            # Public endpoint only shows system defaults
            query = query.eq("is_system_default", True)
        
        result = query.execute()
        
        # Enrich with usage counts
        templates = result.data or []
        for template in templates:
            usage_result = supabase.table("signalwire_phone_numbers")\
                .select("id", count="exact")\
                .eq("assigned_ai_template_id", template["id"])\
                .execute()
            template["phone_count"] = usage_result.count or 0
        
        # Sort in Python instead of SQL (avoid Supabase ordering issues)
        templates.sort(key=lambda t: (not t.get("is_system_default", False), t.get("name", "")))
        
        return JSONResponse(content={"templates": templates})
    
    except Exception as e:
        logger.error(f"Error listing templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai-templates")
async def create_template(request: Request):
    """Create new AI template with validation"""
    try:
        template_data = await request.json()
        
        # Validate provider combinations
        validation_result = await validate_template_config(template_data)
        if not validation_result["valid"]:
            raise HTTPException(status_code=400, detail={"errors": validation_result["errors"]})
        
        # Calculate estimated cost
        template_data["estimated_cost_per_minute"] = calculate_template_cost(template_data)
        
        # Insert into database
        supabase = get_supabase_client()
        result = supabase.table("ai_templates").insert(template_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create template")
        
        logger.info(f"✅ Created template: {result.data[0]['name']}")
        return JSONResponse(content={"template": result.data[0]})
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/ai-templates/{template_id}")
async def update_template(template_id: str, request: Request):
    """Update AI template (only if not system default)"""
    try:
        updates = await request.json()
        supabase = get_supabase_client()
        
        # Check if template exists and is not system default
        existing = supabase.table("ai_templates").select("*").eq("id", template_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Template not found")
        
        if existing.data.get("is_system_default"):
            raise HTTPException(status_code=403, detail="Cannot modify system templates")
        
        # Merge and validate
        merged_data = {**existing.data, **updates}
        validation_result = await validate_template_config(merged_data)
        if not validation_result["valid"]:
            raise HTTPException(status_code=400, detail={"errors": validation_result["errors"]})
        
        # Recalculate cost
        updates["estimated_cost_per_minute"] = calculate_template_cost(merged_data)
        
        # Update
        result = supabase.table("ai_templates").update(updates).eq("id", template_id).execute()
        
        logger.info(f"✅ Updated template: {template_id}")
        return JSONResponse(content={"template": result.data[0]})
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/ai-templates/{template_id}")
async def delete_template(template_id: str):
    """Delete template (only if not in use and not system default)"""
    try:
        supabase = get_supabase_client()
        
        # Check if template is system default
        template = supabase.table("ai_templates").select("*").eq("id", template_id).single().execute()
        if not template.data:
            raise HTTPException(status_code=404, detail="Template not found")
        
        if template.data.get("is_system_default"):
            raise HTTPException(status_code=403, detail="Cannot delete system templates")
        
        # Check usage
        usage = supabase.table("signalwire_phone_numbers").select("id").eq("assigned_ai_template_id", template_id).execute()
        if usage.data and len(usage.data) > 0:
            raise HTTPException(
                status_code=409,
                detail=f"Template is assigned to {len(usage.data)} phone numbers. Unassign first."
            )
        
        # Delete
        supabase.table("ai_templates").delete().eq("id", template_id).execute()
        
        logger.info(f"✅ Deleted template: {template_id}")
        return JSONResponse(content={"success": True})
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai-templates/{template_id}/clone")
async def clone_template(template_id: str, request: Request):
    """Clone system preset for customization"""
    try:
        body = await request.json()
        broker_id = body.get("broker_id")
        new_name = body.get("name")
        
        if not broker_id or not new_name:
            raise HTTPException(status_code=400, detail="broker_id and name are required")
        
        supabase = get_supabase_client()
        
        # Get original template
        original = supabase.table("ai_templates").select("*").eq("id", template_id).single().execute()
        if not original.data:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Create new template
        new_template = {**original.data}
        new_template.pop("id", None)
        new_template.pop("created_at", None)
        new_template.pop("updated_at", None)
        new_template["name"] = new_name
        new_template["broker_id"] = broker_id
        new_template["is_system_default"] = False
        new_template["is_preset"] = False
        
        result = supabase.table("ai_templates").insert(new_template).execute()
        
        logger.info(f"✅ Cloned template {template_id} → {result.data[0]['id']}")
        return JSONResponse(content={"template": result.data[0]})
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cloning template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# VALIDATION & COST CALCULATION
# ============================================================================

async def validate_template_config(template: Dict[str, Any]) -> Dict[str, Any]:
    """Validate STT/TTS/LLM provider combinations"""
    errors = []
    
    # Check API keys exist
    if template.get("stt_provider") == "eden_ai" and not Config.EDENAI_API_KEY:
        errors.append("Eden AI API key not configured")
    if template.get("llm_provider") == "openrouter" and not Config.OPENROUTER_API_KEY:
        errors.append("OpenRouter API key not configured")
    if template.get("llm_provider") == "openai_realtime" and not Config.OPENAI_API_KEY:
        errors.append("OpenAI API key not configured")
    
    # Check required fields
    required_fields = ["name", "stt_provider", "stt_model", "tts_provider", "tts_model", "tts_voice_id", "llm_provider", "llm_model"]
    for field in required_fields:
        if not template.get(field):
            errors.append(f"Missing required field: {field}")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors
    }


def calculate_template_cost(template: Dict[str, Any]) -> float:
    """Estimate $/minute for template configuration"""
    try:
        # STT cost (per minute of audio)
        stt_cost = get_stt_cost(template.get("stt_provider"), template.get("stt_model"))
        
        # TTS cost (assuming ~150 words/minute)
        tts_cost = get_tts_cost(template.get("tts_provider"), template.get("tts_model"))
        
        # LLM cost (assuming ~50 tokens/turn, ~4 turns/minute = 200 tokens/min)
        llm_cost = get_llm_cost(template.get("llm_provider"), template.get("llm_model"))
        
        total = stt_cost + tts_cost + llm_cost
        return round(total, 4)
    except Exception as e:
        logger.warning(f"Error calculating cost: {e}")
        return 0.0


def get_stt_cost(provider: str, model: str) -> float:
    """Get STT cost per minute"""
    if provider == "openai_realtime":
        return 0.0  # Bundled in realtime cost
    
    # Eden AI pricing (per minute)
    pricing = {
        "deepgram-nova-2": 0.0043,
        "deepgram-base": 0.0036,
        "assemblyai-best": 0.00037,
        "google-latest": 0.006,
        "whisper-1": 0.006,
        "revai-human-parity": 0.02
    }
    return pricing.get(model, 0.005)


def get_tts_cost(provider: str, model: str) -> float:
    """Get TTS cost per minute (150 words)"""
    if provider == "openai_realtime":
        return 0.0  # Bundled in realtime cost
    
    # Eden AI pricing (per minute, ~150 words)
    pricing = {
        "elevenlabs-multilingual-v2": 0.180,
        "elevenlabs-turbo-v2.5": 0.090,
        "playht-2.0-turbo": 0.040,
        "google-neural2": 0.024,
        "amazon-polly-neural": 0.024,
        "openai-tts-1": 0.015,
        "openai-tts-1-hd": 0.030
    }
    return pricing.get(model, 0.020)


def get_llm_cost(provider: str, model: str) -> float:
    """Get LLM cost per minute (~200 tokens input+output)"""
    if provider == "openai_realtime":
        # GPT-4o Realtime: $5/1M input + $20/1M output = avg $12.5/1M
        # 200 tokens/min = 0.0002M tokens
        return 0.0025
    
    # OpenRouter pricing (per 200 tokens)
    token_pricing = {
        "openai/gpt-4o": 5.0,  # $5/1M input
        "openai/gpt-4o-mini": 0.15,
        "anthropic/claude-3.5-sonnet": 3.0,
        "anthropic/claude-3-haiku": 0.25,
        "meta-llama/llama-3.1-70b-instruct": 0.88,
        "meta-llama/llama-3.1-8b-instruct": 0.07,
        "google/gemini-pro-1.5": 3.5,
        "google/gemini-flash-1.5": 0.075,
    }
    
    cost_per_1m = token_pricing.get(model, 1.0)
    # 200 tokens = 0.0002M tokens
    return (cost_per_1m * 0.0002)


# ============================================================================
# PROVIDER DATA ENDPOINTS
# ============================================================================

@app.post("/api/ai-providers/refresh-catalog")
async def refresh_provider_catalog():
    """Refresh provider catalogs from Eden AI and OpenRouter APIs"""
    try:
        from services.provider_catalog import refresh_all_catalogs
        await refresh_all_catalogs()
        return JSONResponse(content={"success": True, "message": "Catalogs refreshed"})
    except Exception as e:
        logger.error(f"Error refreshing catalogs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ai-providers/pricing")
async def get_live_pricing():
    """Get live pricing data from all providers"""
    try:
        from services.provider_catalog import (
            get_eden_ai_stt_pricing,
            get_eden_ai_tts_pricing,
            get_openrouter_models
        )
        
        stt_pricing = await get_eden_ai_stt_pricing()
        tts_pricing = await get_eden_ai_tts_pricing()
        llm_models = await get_openrouter_models()
        
        # Build pricing summary
        return JSONResponse(content={
            "stt": stt_pricing,
            "tts": tts_pricing,
            "llm": [
                {
                    "id": m["id"],
                    "name": m["name"],
                    "pricing_per_1k_tokens": (m["pricing"]["prompt"] + m["pricing"]["completion"]) / 2 * 1000
                }
                for m in llm_models[:20]  # Top 20 models
            ],
            "last_updated": datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting pricing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ai-providers/health")
async def check_provider_health():
    """Verify all configured API keys work"""
    results = {
        "eden_ai": {"status": "unknown", "error": None, "configured": bool(Config.EDENAI_API_KEY)},
        "openrouter": {"status": "unknown", "error": None, "configured": bool(Config.OPENROUTER_API_KEY)},
        "openai": {"status": "unknown", "error": None, "configured": bool(Config.OPENAI_API_KEY)}
    }
    
    # Test Eden AI
    if Config.EDENAI_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    "https://api.edenai.run/v2/info/providers",
                    headers={"Authorization": f"Bearer {Config.EDENAI_API_KEY}"}
                )
                results["eden_ai"]["status"] = "healthy" if response.status_code == 200 else "error"
                if response.status_code != 200:
                    results["eden_ai"]["error"] = f"HTTP {response.status_code}"
        except Exception as e:
            results["eden_ai"]["status"] = "error"
            results["eden_ai"]["error"] = str(e)
    else:
        results["eden_ai"]["status"] = "not_configured"
    
    # Test OpenRouter
    if Config.OPENROUTER_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    "https://openrouter.ai/api/v1/models",
                    headers={"Authorization": f"Bearer {Config.OPENROUTER_API_KEY}"}
                )
                results["openrouter"]["status"] = "healthy" if response.status_code == 200 else "error"
                if response.status_code != 200:
                    results["openrouter"]["error"] = f"HTTP {response.status_code}"
        except Exception as e:
            results["openrouter"]["status"] = "error"
            results["openrouter"]["error"] = str(e)
    else:
        results["openrouter"]["status"] = "not_configured"
    
    # Test OpenAI
    if Config.OPENAI_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {Config.OPENAI_API_KEY}"}
                )
                results["openai"]["status"] = "healthy" if response.status_code == 200 else "error"
                if response.status_code != 200:
                    results["openai"]["error"] = f"HTTP {response.status_code}"
        except Exception as e:
            results["openai"]["status"] = "error"
            results["openai"]["error"] = str(e)
    else:
        results["openai"]["status"] = "not_configured"
    
    return JSONResponse(content=results)


@app.get("/api/ai-providers/all")
async def get_all_providers():
    """Get complete provider catalog for dropdown population"""
    return JSONResponse(content={
        "stt_providers": [
            {"id": "eden_ai", "name": "Eden AI (Aggregator)", "description": "Access to Deepgram, AssemblyAI, Google, Whisper, etc."},
            {"id": "openai_realtime", "name": "OpenAI Realtime (Bundled)", "description": "Built-in STT with GPT-4o Realtime"}
        ],
        "tts_providers": [
            {"id": "eden_ai", "name": "Eden AI (Aggregator)", "description": "Access to ElevenLabs, PlayHT, Google, Amazon Polly, etc."},
            {"id": "openai_realtime", "name": "OpenAI Realtime (Bundled)", "description": "Built-in TTS with GPT-4o Realtime"}
        ],
        "llm_providers": [
            {"id": "openrouter", "name": "OpenRouter (Aggregator)", "description": "Access to 100+ LLMs: GPT, Claude, Llama, Gemini, etc."},
            {"id": "openai_realtime", "name": "OpenAI Realtime (Direct)", "description": "GPT-4o Realtime only"}
        ]
    })


@app.get("/api/ai-providers/stt-models")
async def get_stt_models(provider: str):
    """Get available STT models with live pricing"""
    if provider == "eden_ai":
        from services.provider_catalog import get_eden_ai_stt_pricing
        
        pricing = await get_eden_ai_stt_pricing()
        models = []
        
        # Flatten pricing dict to model list
        for provider_name, provider_models in pricing.items():
            for model_id, cost in provider_models.items():
                models.append({
                    "id": f"{provider_name}-{model_id}",
                    "name": f"{provider_name.title()} {model_id.replace('-', ' ').title()}",
                    "cost_per_min": cost,
                    "provider": provider_name,
                    "quality": "excellent" if cost > 0.004 else "good",
                    "speed": "fast" if "deepgram" in provider_name else "medium"
                })
        
        return JSONResponse(content={"models": models})
    
    elif provider == "openai_realtime":
        return JSONResponse(content={
            "models": [
                {"id": "bundled", "name": "Bundled with Realtime", "cost_per_min": 0.06, "quality": "excellent", "speed": "realtime"}
            ]
        })
    
    return JSONResponse(content={"models": []})


@app.get("/api/ai-providers/tts-models")
async def get_tts_models(provider: str):
    """Get available TTS models with live pricing grouped by underlying provider"""
    if provider == "eden_ai":
        from services.provider_catalog import get_eden_ai_tts_pricing
        
        pricing = await get_eden_ai_tts_pricing()
        grouped_models = []
        
        # Group by provider
        provider_groups = {
            "elevenlabs": {"name": "ElevenLabs", "badge": "premium", "models": []},
            "playht": {"name": "PlayHT", "badge": "budget", "models": []},
            "google": {"name": "Google", "badge": "budget", "models": []},
            "amazon": {"name": "Amazon", "badge": "budget", "models": []},
            "openai": {"name": "OpenAI", "badge": "standard", "models": []}
        }
        
        for provider_name, models in pricing.items():
            if provider_name in provider_groups:
                for model_id, cost in models.items():
                    provider_groups[provider_name]["models"].append({
                        "id": f"{provider_name}-{model_id}",
                        "name": model_id.replace("-", " ").title(),
                        "cost_per_min": cost,
                        "badge": "best" if cost > 0.15 else ("fast" if cost > 0.05 else "budget"),
                        "languages": 29 if "elevenlabs" in provider_name else 20
                    })
        
        # Convert to list format
        for provider_key, group_data in provider_groups.items():
            if group_data["models"]:
                grouped_models.append({
                    "provider_name": group_data["name"],
                    "provider_badge": group_data["badge"],
                    "models": group_data["models"]
                })
        
        return JSONResponse(content={"grouped_models": grouped_models})
    
    elif provider == "openai_realtime":
        return JSONResponse(content={
            "grouped_models": [
                {
                    "provider_name": "OpenAI Realtime",
                    "provider_badge": "bundled",
                    "models": [
                        {"id": "bundled", "name": "Bundled with Realtime", "cost_per_min": 0.24, "badge": "included", "languages": 58}
                    ]
                }
            ]
        })
    
    return JSONResponse(content={"grouped_models": []})


@app.get("/api/ai-providers/tts-voices")
async def get_tts_voices(provider: str, model: str):
    """Get available voices for a specific TTS provider/model with live data"""
    from services.provider_catalog import get_eden_ai_tts_voices
    
    try:
        # For Eden AI, fetch live voices from API
        if provider == "eden_ai":
            # Parse provider from model (e.g., "elevenlabs-multilingual-v2" -> "elevenlabs")
            underlying_provider = model.split("-")[0] if "-" in model else model
            voices_data = await get_eden_ai_tts_voices(underlying_provider, model)
            
            # Format voices for UI
            voices = []
            for voice in voices_data:
                voices.append({
                    "id": voice.get("voice_id") or voice.get("name"),
                    "name": voice.get("display_name") or voice.get("name"),
                    "gender": voice.get("gender", "unknown"),
                    "accent": voice.get("accent") or voice.get("language", "en-US"),
                    "age": voice.get("age"),
                    "preview_url": voice.get("preview_url")
                })
            
            return JSONResponse(content={"voices": voices})
        
        # OpenAI Realtime voices (hardcoded - no API available)
        elif provider == "openai_realtime":
            voices = [
                {"id": "alloy", "name": "Alloy", "gender": "neutral", "accent": "American", "age": "young"},
                {"id": "ash", "name": "Ash", "gender": "neutral", "accent": "American", "age": "young"},
                {"id": "ballad", "name": "Ballad", "gender": "neutral", "accent": "American", "age": "middle"},
                {"id": "coral", "name": "Coral", "gender": "female", "accent": "American", "age": "young"},
                {"id": "echo", "name": "Echo", "gender": "male", "accent": "American", "age": "middle"},
                {"id": "sage", "name": "Sage", "gender": "neutral", "accent": "American", "age": "young"},
                {"id": "shimmer", "name": "Shimmer", "gender": "female", "accent": "American", "age": "young"},
                {"id": "verse", "name": "Verse", "gender": "neutral", "accent": "American", "age": "middle"},
            ]
            return JSONResponse(content={"voices": voices})
        
        # Default: empty list
        return JSONResponse(content={"voices": []})
        
    except Exception as e:
        logger.error(f"Error fetching TTS voices: {e}")
        # Return fallback hardcoded voices on error
        fallback_voices = {
            "elevenlabs-multilingual-v2": [
                {"id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel", "gender": "female", "accent": "American"},
                {"id": "EXAVITQu4vr4xnSDxMaL", "name": "Bella", "gender": "female", "accent": "American"},
                {"id": "ErXwobaYiN019PkySvjV", "name": "Antoni", "gender": "male", "accent": "American"},
            ]
        }
        voices = fallback_voices.get(model, [])
        return JSONResponse(content={"voices": voices})


@app.get("/api/ai-providers/llm-models")
async def get_llm_models(provider: str):
    """Get available LLM models with live pricing from OpenRouter"""
    if provider == "openrouter":
        from services.provider_catalog import get_openrouter_models
        
        all_models = await get_openrouter_models()
        
        # Filter to popular/recommended models
        curated_models = []
        for model in all_models:
            model_id = model.get("id", "")
            
            # Include popular models
            if any(keyword in model_id.lower() for keyword in [
                "gpt-4o", "claude-3", "llama-3", "gemini", "mistral"
            ]):
                # Calculate cost per 1M tokens (average of prompt + completion)
                pricing = model.get("pricing", {})
                prompt_price = float(pricing.get("prompt", 0))
                completion_price = float(pricing.get("completion", 0))
                avg_cost_per_1m = ((prompt_price + completion_price) / 2) * 1000000
                
                curated_models.append({
                    "id": model["id"],
                    "name": model.get("name", model["id"]),
                    "provider": model.get("top_provider", "Unknown"),
                    "context": model.get("context_length", 128000),
                    "cost_per_1m_tokens": round(avg_cost_per_1m, 2),
                    "speed": "very_fast" if avg_cost_per_1m < 0.5 else ("fast" if avg_cost_per_1m < 5 else "medium")
                })
        
        # Sort by cost (cheapest first)
        curated_models.sort(key=lambda m: m["cost_per_1m_tokens"])
        
        return JSONResponse(content={"models": curated_models[:30]})  # Top 30
    
    elif provider == "openai_realtime":
        return JSONResponse(content={
            "models": [
                {"id": "gpt-4o-realtime-preview", "name": "GPT-4 Omni Realtime", "provider": "OpenAI", "context": 128000, "cost_per_1m_tokens": 10.0, "speed": "realtime"}
            ]
        })
    
    return JSONResponse(content={"models": []})


# ============================================================================
# COST TRACKING & BILLING
# ============================================================================

async def log_template_cost_to_billing(interaction_id: str, template_id: str, duration_seconds: int, broker_id: Optional[str] = None):
    """
    Log template usage to billing_events table
    Called after call ends to track AI provider costs
    """
    try:
        supabase = get_supabase_client()
        
        # Get template details
        template = supabase.table("ai_templates").select("*").eq("id", template_id).single().execute()
        if not template.data:
            logger.warning(f"Template {template_id} not found for billing")
            return
        
        # Calculate total cost
        cost_per_minute = template.data.get("estimated_cost_per_minute", 0)
        total_cost = (cost_per_minute * duration_seconds) / 60
        
        # Use broker_id from template if not provided
        if not broker_id:
            broker_id = template.data.get("broker_id")
        
        # Log to billing_events
        billing_event = {
            "interaction_id": interaction_id,
            "broker_id": broker_id,
            "event_type": "ai_template_usage",
            "amount": round(total_cost, 4),
            "metadata": {
                "template_id": template_id,
                "template_name": template.data.get("name"),
                "duration_seconds": duration_seconds,
                "cost_per_minute": cost_per_minute,
                "stt_provider": template.data.get("stt_provider"),
                "stt_model": template.data.get("stt_model"),
                "tts_provider": template.data.get("tts_provider"),
                "tts_model": template.data.get("tts_model"),
                "llm_provider": template.data.get("llm_provider"),
                "llm_model": template.data.get("llm_model"),
            }
        }
        
        supabase.table("billing_events").insert(billing_event).execute()
        logger.info(f"✅ Logged ${total_cost:.4f} cost for interaction {interaction_id} (template: {template.data.get('name')})")
    
    except Exception as e:
        logger.error(f"❌ Failed to log billing event: {e}")
        # Don't raise - billing failure shouldn't crash call cleanup


# ============================================================================
# LIVEKIT INTEGRATION
# ============================================================================

@app.post("/api/livekit/test-token")
async def generate_test_token(request: Request):
    """Generate LiveKit token for testing template in playground and dispatch agent"""
    try:
        import time
        from livekit import api
        
        body = await request.json()
        template_id = body.get("template_id")
        
        if not template_id:
            raise HTTPException(status_code=400, detail="template_id is required")
        
        supabase = get_supabase_client()
        template = supabase.table("ai_templates").select("*").eq("id", template_id).single().execute()
        if not template.data:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Create test room
        room_name = f"test-{template_id[:8]}-{int(time.time())}"
        
        # Create room with metadata so agent knows it's a test
        livekit_http_url = Config.LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://")
        lkapi = api.LiveKitAPI(
            livekit_http_url,
            Config.LIVEKIT_API_KEY,
            Config.LIVEKIT_API_SECRET
        )
        
        # Create room with template metadata (agent will load template directly)
        await lkapi.room.create_room(api.CreateRoomRequest(
            name=room_name,
            empty_timeout=300,  # 5 minutes
            metadata=json.dumps({
                "template_id": template_id,
                "template_name": template.data.get("name"),
                "is_test": True
            })
        ))
        
        await lkapi.aclose()
        
        logger.info(f"✅ Created test room: {room_name}")
        
        # Generate token for user
        token = api.AccessToken(Config.LIVEKIT_API_KEY, Config.LIVEKIT_API_SECRET)
        token.with_identity(f"tester-{template_id[:8]}")
        token.with_name("Test User")
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True
        ))
        
        jwt_token = token.to_jwt()
        
        logger.info(f"🎮 Generated test token for template {template.data.get('name')}")
        logger.info(f"🤖 Agent workers will auto-join room {room_name}")
        
        return JSONResponse(content={
            "token": jwt_token,
            "room_name": room_name,
            "livekit_url": Config.LIVEKIT_URL,
            "template": template.data,
            "instructions": "Connect to the room. An AI agent will auto-join and greet you using the selected template configuration."
        })
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating test token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/livekit/active-calls")
async def get_active_calls():
    """List all active LiveKit rooms/calls"""
    try:
        # For now, return active interactions from database
        # In production, query LiveKit API for real-time room status
        supabase = get_supabase_client()
        
        # Get interactions that started recently and haven't ended
        from datetime import datetime, timedelta
        recent_cutoff = (datetime.now() - timedelta(hours=2)).isoformat()
        
        result = supabase.table("interactions")\
            .select("id, lead_name, broker_id, created_at, metadata, room_name")\
            .gte("created_at", recent_cutoff)\
            .is_("ended_at", "null")\
            .order("created_at.desc")\
            .limit(50)\
            .execute()
        
        active_calls = []
        for interaction in result.data:
            # Get broker name
            broker_name = "Unknown"
            if interaction.get("broker_id"):
                broker = supabase.table("brokers").select("contact_name").eq("id", interaction["broker_id"]).single().execute()
                if broker.data:
                    broker_name = broker.data.get("contact_name", "Unknown")
            
            # Calculate duration
            start_time = datetime.fromisoformat(interaction["created_at"].replace("Z", "+00:00"))
            duration = int((datetime.now(start_time.tzinfo) - start_time).total_seconds())
            
            active_calls.append({
                "call_id": interaction["id"],
                "room_name": interaction.get("room_name"),
                "lead_name": interaction.get("lead_name", "Unknown"),
                "broker_name": broker_name,
                "duration": duration,
                "template_name": interaction.get("metadata", {}).get("template_name"),
                "started_at": interaction["created_at"]
            })
        
        return JSONResponse(content={"active_calls": active_calls, "count": len(active_calls)})
    
    except Exception as e:
        logger.error(f"Error getting active calls: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/livekit/monitor-token/{call_id}")
async def generate_monitor_token(call_id: str):
    """Generate token to monitor an active call (listen-only)"""
    try:
        from livekit import api
        
        supabase = get_supabase_client()
        
        # Get interaction to find room name
        interaction = supabase.table("interactions").select("room_name").eq("id", call_id).single().execute()
        if not interaction.data or not interaction.data.get("room_name"):
            raise HTTPException(status_code=404, detail="Active call not found")
        
        room_name = interaction.data["room_name"]
        
        # Generate listen-only token
        token = api.AccessToken(Config.LIVEKIT_API_KEY, Config.LIVEKIT_API_SECRET)
        token.with_identity("admin-monitor")
        token.with_name("Admin Monitor")
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=False,  # Listen only
            can_subscribe=True
        ))
        
        jwt_token = token.to_jwt()
        
        logger.info(f"🎧 Generated monitor token for call {call_id}")
        
        return JSONResponse(content={
            "token": jwt_token,
            "room_name": room_name,
            "livekit_url": Config.LIVEKIT_URL
        })
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating monitor token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/livekit/webhooks")
async def livekit_webhook_handler(request: Request):
    """Handle LiveKit call events and save to interactions table"""
    try:
        event = await request.json()
        event_type = event.get("event")
        
        if event_type == "room_finished":
            room = event.get("room", {})
            room_name = room.get("name")
            duration = room.get("duration", 0)
            metadata = room.get("metadata", {})
            
            if room_name:
                supabase = get_supabase_client()
                
                # Update interaction record
                update_data = {
                    "ended_at": datetime.now().isoformat(),
                    "duration_seconds": duration
                }
                
                result = supabase.table("interactions")\
                    .update(update_data)\
                    .eq("room_name", room_name)\
                    .execute()
                
                # Log cost to billing if template was used
                if metadata.get("template_id") and result.data:
                    interaction = result.data[0]
                    await log_template_cost_to_billing(
                        interaction_id=interaction["id"],
                        template_id=metadata["template_id"],
                        duration_seconds=duration,
                        broker_id=interaction.get("broker_id")
                    )
                
                logger.info(f"✅ Processed room_finished event for {room_name} ({duration}s)")
        
        return JSONResponse(content={"success": True})
    
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        # Return 200 anyway to avoid webhook retries
        return JSONResponse(content={"success": False, "error": str(e)})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=Config.API_SERVER_HOST,
        port=Config.API_SERVER_PORT,
        log_level="info"
    )

