"""
Appointment booking tool
Creates Nylas calendar events with assigned broker
"""

from typing import Dict, Any
from services.database import get_lead_by_phone, get_conversation_state, update_conversation_state
import os
import httpx
import logging

logger = logging.getLogger(__name__)

NYLAS_API_KEY = os.getenv("NYLAS_API_KEY")
NYLAS_CLIENT_ID = os.getenv("NYLAS_CLIENT_ID")


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
                return {
                    "response": (
                        "I'm having trouble accessing the calendar right now. "
                        "Let me connect you with our team to schedule directly."
                    )
                }
                
    except Exception as e:
        logger.error(f"[BOOKING] Error creating appointment: {e}")
        return {
            "response": (
                "I encountered an issue scheduling your appointment. "
                "Let me connect you with our team to schedule directly."
            )
        }

