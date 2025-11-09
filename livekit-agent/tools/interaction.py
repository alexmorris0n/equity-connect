"""Interaction and tracking tools"""
from typing import Optional, Dict, Any
from livekit.agents.llm import function_tool
from services.supabase import get_supabase_client
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

@function_tool
async def save_interaction(
    lead_id: str,
    broker_id: Optional[str],
    duration_seconds: Optional[int],
    outcome: str,
    content: str,
    recording_url: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """Save call interaction details at the end of the call. Include transcript summary and outcome.
    
    Args:
        lead_id: Lead UUID
        broker_id: Broker UUID (optional)
        duration_seconds: Call duration in seconds
        outcome: Call outcome (appointment_booked, not_interested, no_response, positive, neutral, negative)
        content: Brief summary of the conversation
        recording_url: SignalWire recording URL if available
        metadata: Additional call metadata (transcript, tool calls, etc.)
    """
    sb = get_supabase_client()
    
    try:
        logger.info(f"💾 Saving interaction for lead: {lead_id}")
        
        # Check if lead should be marked as qualified
        qualifies_by_metadata = (
            (metadata and metadata.get('qualified') == True) or
            (metadata and metadata.get('met_qualification_requirements') == True) or
            (metadata and metadata.get('qualification_status') == 'qualified')
        )
        qualifies_by_outcome = outcome in ['appointment_booked', 'positive']
        
        if qualifies_by_metadata or qualifies_by_outcome:
            try:
                sb.table('leads')\
                    .update({"qualified": True})\
                    .eq('id', lead_id)\
                    .execute()
                logger.info('✅ Lead marked as qualified')
            except Exception as update_error:
                logger.warn(f'Failed to update lead qualification: {update_error}')
        
        # Build comprehensive metadata
        interaction_metadata = {
            "ai_agent": "livekit-agent",
            "version": "1.0",
            "conversation_transcript": metadata.get("conversation_transcript") if metadata else None,
            "prompt_version_id": metadata.get("prompt_version_id") if metadata else None,
            "prompt_version_number": metadata.get("prompt_version_number") if metadata else None,
            "prompt_call_type": metadata.get("prompt_call_type") if metadata else None,
            "prompt_source": metadata.get("prompt_source", "unknown") if metadata else "unknown",
            "money_purpose": metadata.get("money_purpose") if metadata else None,
            "specific_need": metadata.get("specific_need") if metadata else None,
            "amount_needed": metadata.get("amount_needed") if metadata else None,
            "timeline": metadata.get("timeline") if metadata else None,
            "objections": metadata.get("objections", []),
            "objections_count": len(metadata.get("objections", [])) if metadata else 0,
            "questions_asked": metadata.get("questions_asked", []),
            "questions_count": len(metadata.get("questions_asked", [])) if metadata else 0,
            "key_details": metadata.get("key_details", []),
            "key_details_count": len(metadata.get("key_details", [])) if metadata else 0,
            "appointment_scheduled": metadata.get("appointment_scheduled", False) if metadata else False,
            "appointment_datetime": metadata.get("appointment_datetime") if metadata else None,
            "email_verified": metadata.get("email_verified", False) if metadata else False,
            "phone_verified": metadata.get("phone_verified", False) if metadata else False,
            "email_collected": metadata.get("email_collected", False) if metadata else False,
            "commitment_points_completed": metadata.get("commitment_points_completed", 0) if metadata else 0,
            "text_reminder_consented": metadata.get("text_reminder_consented", False) if metadata else False,
            "interruptions": metadata.get("interruptions", 0) if metadata else 0,
            "tool_calls_made": metadata.get("tool_calls_made", []) if metadata else [],
            "saved_at": datetime.utcnow().isoformat()
        }
        
        # Build transcript text if available
        transcript_text = None
        if metadata and metadata.get("conversation_transcript"):
            transcript = metadata["conversation_transcript"]
            transcript_text = "\n".join([
                f"{msg.get('role', 'unknown')}: {msg.get('text', msg.get('content', ''))}"
                for msg in transcript
            ])
        
        # Save interaction to Supabase
        interaction_data = {
            "lead_id": lead_id,
            "broker_id": broker_id,
            "type": "ai_call",
            "direction": metadata.get("direction", "outbound") if metadata else "outbound",
            "content": content,
            "duration_seconds": duration_seconds,
            "outcome": outcome,
            "recording_url": recording_url,
            "transcript_text": transcript_text,
            "transcript": {"conversation_transcript": metadata.get("conversation_transcript")} if metadata and metadata.get("conversation_transcript") else None,
            "metadata": interaction_metadata
        }
        
        response = sb.table('interactions')\
            .insert(interaction_data)\
            .select('id')\
            .execute()
        
        if response.error:
            logger.error(f'Error saving interaction: {response.error}')
            return json.dumps({
                "success": False,
                "error": str(response.error),
                "message": "Failed to save interaction."
            })
        
        interaction_id = response.data[0]['id'] if response.data else None
        
        # Update lead engagement
        try:
            sb.rpc('increment_interaction_count', {"lead_uuid": lead_id}).execute()
        except Exception as rpc_error:
            logger.warn(f'Failed to increment interaction count: {rpc_error}')
        
        # Update lead timestamps
        sb.table('leads')\
            .update({
                "last_contact": datetime.utcnow().isoformat(),
                "last_engagement": datetime.utcnow().isoformat()
            })\
            .eq('id', lead_id)\
            .execute()
        
        logger.info(f"✅ Interaction saved: {interaction_id} ({len(interaction_metadata)} metadata fields)")
        
        # Note: Call evaluation would be triggered here in background
        # For now, we'll skip it as it's handled separately
        
        return json.dumps({
            "success": True,
            "interaction_id": str(interaction_id) if interaction_id else None,
            "message": "Call interaction saved successfully with full context.",
            "metadata_saved": len(interaction_metadata),
            "evaluation_triggered": False  # Will be handled separately
        })
        
    except Exception as e:
        logger.error(f'Error saving interaction: {e}')
        return json.dumps({
            "success": False,
            "error": str(e),
            "message": "Unable to save interaction details."
        })

@function_tool
async def assign_tracking_number(lead_id: str, broker_id: str) -> str:
    """Assign a SignalWire tracking number to a lead for call attribution.
    
    Args:
        lead_id: Lead UUID
        broker_id: Broker UUID
    """
    sb = get_supabase_client()
    
    try:
        # Find available tracking number
        # Implementation would query signalwire_phone_numbers for available tracking numbers
        # For now, return placeholder
        return json.dumps({
            "success": False,
            "message": "Assign tracking number functionality not yet implemented"
        })
    except Exception as e:
        logger.error(f'Error assigning tracking number: {e}')
        return json.dumps({
            "success": False,
            "error": str(e)
        })

@function_tool
async def send_appointment_confirmation(phone: str, appointment_datetime: str) -> str:
    """Send appointment confirmation via SignalWire MFA/SMS.
    
    Args:
        phone: Phone number to send confirmation to
        appointment_datetime: Appointment date/time in ISO 8601 format
    """
    # Implementation would use SignalWire MFA API to send SMS
    # For now, return placeholder
    return json.dumps({
        "success": False,
        "message": "Send appointment confirmation functionality not yet implemented"
    })

@function_tool
async def verify_appointment_confirmation(phone: str, code: str) -> str:
    """Verify appointment confirmation code sent via SMS.
    
    Args:
        phone: Phone number that received the code
        code: Confirmation code to verify
    """
    # Implementation would use SignalWire MFA API to verify code
    # For now, return placeholder
    return json.dumps({
        "success": False,
        "message": "Verify appointment confirmation functionality not yet implemented"
    })

