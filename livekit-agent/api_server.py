"""FastAPI server for outbound call API endpoint"""
import logging
import uuid
import re
import os
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import httpx

from config import Config
from services.supabase import get_supabase_client, get_lead_by_phone
from services.signalwire import SignalWireClient
import boto3
from botocore.exceptions import ClientError
from datetime import timedelta

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=Config.API_SERVER_HOST,
        port=Config.API_SERVER_PORT,
        log_level="info"
    )

