"""
Appointment booking tool
Creates Nylas calendar events with assigned broker
"""

from typing import Dict, Any
from services.database import get_lead_by_phone, get_conversation_state, update_conversation_state, normalize_phone
import os
import httpx
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

NYLAS_API_KEY = os.getenv("NYLAS_API_KEY")
NYLAS_CLIENT_ID = os.getenv("NYLAS_CLIENT_ID")
N8N_MANUAL_BOOKING_WEBHOOK = os.getenv("N8N_MANUAL_BOOKING_WEBHOOK")


async def _trigger_manual_booking_webhook(
    lead_id: str = None,
    broker_id: str = None,
    phone: str = None,
    error: str = None,
    requested_time: str = None,
    notes: str = None
) -> None:
    """
    Trigger n8n webhook to notify about manual booking requirement
    
    Args:
        lead_id: Lead UUID
        broker_id: Broker UUID
        phone: Phone number
        error: Error message
        requested_time: Preferred appointment time
        notes: Additional notes
    """
    webhook_url = N8N_MANUAL_BOOKING_WEBHOOK
    if not webhook_url:
        logger.warning("[WEBHOOK] N8N_MANUAL_BOOKING_WEBHOOK not configured, skipping webhook")
        return
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json={
                    "lead_id": lead_id,
                    "broker_id": broker_id,
                    "phone": phone,
                    "error": error,
                    "error_type": type(error).__name__ if error else "Unknown",
                    "requested_time": requested_time,
                    "notes": notes,
                    "timestamp": datetime.utcnow().isoformat(),
                    "source": "signalwire_agent"
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                logger.info(f"[WEBHOOK] Manual booking webhook triggered successfully for lead {lead_id}")
            else:
                logger.error(f"[WEBHOOK] Manual booking webhook failed: {response.status_code} - {response.text}")
                
    except Exception as webhook_error:
        logger.error(f"[WEBHOOK] Failed to trigger manual booking webhook: {webhook_error}")
        # Don't fail the whole function if webhook fails


async def handle_booking(caller_id: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Book appointment with assigned broker via Nylas
    """
    phone = caller_id.replace('+1', '').replace('+', '')
    
    preferred_time = args.get('preferred_time', '')
    notes = args.get('notes', '')
    
    if not preferred_time:
        return {
            "response": "What time would work best for you? I can check availability."
        }
    
    # Get lead to find assigned broker
    lead = await get_lead_by_phone(phone)
    if not lead:
        return {
            "response": "I couldn't find your information. Let me connect you with our team."
        }
    
    # Get broker Nylas grant ID
    broker = lead.get('brokers')
    if not broker or not broker.get('nylas_grant_id'):
        return {
            "response": "I'll need to assign you a broker first. Let me connect you with our team."
        }
    
    nylas_grant_id = broker['nylas_grant_id']
    broker_name = broker.get('contact_name', 'Broker')
    
    # Create Nylas event
    # TODO: Parse preferred_time and create proper datetime
    # For now, use a placeholder
    
    event_data = {
        "title": f"Reverse Mortgage Consultation - {lead.get('first_name', 'Client')}",
        "description": f"Reverse mortgage consultation call.\n\nNotes: {notes}",
        "when": {
            "start_time": preferred_time,  # TODO: Parse to ISO format
            "end_time": preferred_time,    # TODO: Add 1 hour
        },
        "participants": [
            {"email": lead.get('primary_email', '')},
        ]
    }
    
    lead_id = lead.get('id')
    broker_id = broker.get('id') if broker else None
    
    # Call Nylas API
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.nylas.com/v3/grants/{nylas_grant_id}/events",
                headers={
                    "Authorization": f"Bearer {NYLAS_API_KEY}",
                    "Content-Type": "application/json"
                },
                json=event_data,
                timeout=10.0
            )
            
            if response.status_code == 200:
                event = response.json()
                event_id = event.get('data', {}).get('id', 'unknown')
                
                # Update conversation state
                await update_conversation_state(phone, {
                    "conversation_data": {
                        "appointment_booked": True,
                        "appointment_time": preferred_time,
                        "appointment_id": event_id,
                        "ready_to_book": False  # Clear ready flag
                    }
                })
                
                logger.info(f"[BOOKING] Appointment created: {event_id} for {phone}")
                
                return {
                    "response": (
                        f"Perfect! I've scheduled your consultation with {broker_name} "
                        f"for {preferred_time}. You'll receive a confirmation email shortly. "
                        f"Is there anything else I can help you with?"
                    ),
                    "action": [{
                        "set_meta_data": {
                            "appointment_booked": True,
                            "appointment_time": preferred_time
                        }
                    }]
                }
            else:
                logger.error(f"[BOOKING] Nylas API error: {response.status_code} - {response.text}")
                
                # Set manual booking required flag
                await update_conversation_state(phone, {
                    "conversation_data": {
                        "manual_booking_required": True,
                        "booking_error": f"Nylas API error: {response.status_code}"
                    }
                })
                
                # Trigger n8n webhook for manual booking
                await _trigger_manual_booking_webhook(
                    lead_id=lead_id,
                    broker_id=broker_id,
                    phone=phone,
                    error=f"Nylas API error: {response.status_code} - {response.text}",
                    requested_time=preferred_time,
                    notes=notes
                )
                
                return {
                    "response": (
                        "I'm having trouble accessing the calendar right now. "
                        "Let me have someone call you directly to schedule. Is this the best number to reach you at?"
                    ),
                    "action": [{
                        "set_meta_data": {
                            "manual_booking_required": True
                        }
                    }]
                }
                
    except Exception as e:
        logger.error(f"[BOOKING] Error creating appointment: {e}")
        
        # Set manual booking required flag
        await update_conversation_state(phone, {
            "conversation_data": {
                "manual_booking_required": True,
                "booking_error": str(e)
            }
        })
        
        # Trigger n8n webhook for manual booking
        await _trigger_manual_booking_webhook(
            lead_id=lead_id,
            broker_id=broker_id,
            phone=phone,
            error=str(e),
            requested_time=preferred_time,
            notes=notes
        )
        
        return {
            "response": (
                "I encountered an issue scheduling your appointment. "
                "Let me have someone call you directly to schedule. Is this the best number to reach you at?"
            ),
            "action": [{
                "set_meta_data": {
                    "manual_booking_required": True
                }
            }]
        }


async def handle_check_broker_availability(caller_id: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Check if assigned broker has availability for appointment
    Compatible with LiveKit agent check_broker_availability function.
    """
    phone = normalize_phone(caller_id)
    
    # Get lead to find assigned broker
    lead = await get_lead_by_phone(phone)
    if not lead:
        return {
            "response": "I couldn't find your information. Let me connect you with our team.",
            "available": False
        }
    
    # Get broker info
    broker = lead.get('brokers')
    if not broker:
        return {
            "response": "I'll need to assign you a broker first. Let me connect you with our team.",
            "available": False
        }
    
    broker_name = broker.get('contact_name', 'your broker')
    nylas_grant_id = broker.get('nylas_grant_id')
    
    if not nylas_grant_id:
        # No calendar integration - assume available
        return {
            "response": f"{broker_name} is available. What time would work best for you?",
            "available": True,
            "broker_name": broker_name
        }
    
    # Check Nylas calendar for availability
    preferred_date = args.get('preferred_date', '')
    preferred_time = args.get('preferred_time', '')
    
    try:
        # Query Nylas for calendar events
        # For now, return a simple response
        # TODO: Implement actual calendar availability check via Nylas API
        
        if preferred_date or preferred_time:
            return {
                "response": f"I can check {broker_name}'s availability for {preferred_date or preferred_time}. What time would work best for you?",
                "available": True,
                "broker_name": broker_name,
                "preferred_date": preferred_date,
                "preferred_time": preferred_time
            }
        else:
            return {
                "response": f"{broker_name} is available. What date and time would work best for you?",
                "available": True,
                "broker_name": broker_name
            }
            
    except Exception as e:
        logger.error(f"[AVAILABILITY] Error checking availability: {e}")
        
        # Set manual booking required flag
        await update_conversation_state(phone, {
            "conversation_data": {
                "manual_booking_required": True,
                "availability_check_error": str(e)
            }
        })
        
        # Trigger n8n webhook for manual booking
        await _trigger_manual_booking_webhook(
            lead_id=lead.get('id') if lead else None,
            broker_id=broker.get('id') if broker else None,
            phone=phone,
            error=f"Availability check error: {str(e)}",
            requested_time=preferred_time or preferred_date
        )
        
        return {
            "response": (
                "I'm having trouble accessing the calendar right now. "
                "Let me have someone call you directly to schedule. Is this the best number to reach you at?"
            ),
            "available": False,  # Don't assume available - flag as manual
            "broker_name": broker_name,
            "action": [{
                "set_meta_data": {
                    "manual_booking_required": True
                }
            }]
        }

