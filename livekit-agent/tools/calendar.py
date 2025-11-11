"""Calendar and appointment tools"""
from typing import Optional
from livekit.agents.llm import function_tool
from services.supabase import get_supabase_client
from services.conversation_state import update_conversation_state
from services.nylas import get_broker_events, find_free_slots, format_available_slots, create_calendar_event
import logging
import json

logger = logging.getLogger(__name__)

@function_tool
async def check_broker_availability(
    broker_id: str,
    preferred_day: Optional[str] = None,
    preferred_time: Optional[str] = None
) -> str:
    """Check broker calendar availability for appointment scheduling. Returns available time slots for the next 14 days.
    
    Args:
        broker_id: Broker UUID to check availability for
        preferred_day: Preferred day of week if lead expressed preference (monday, tuesday, etc.)
        preferred_time: Preferred time of day if lead expressed preference (morning, afternoon, evening)
    """
    sb = get_supabase_client()
    import time
    start_time = time.time()
    
    try:
        logger.info(f"📅 Checking availability for broker: {broker_id}")
        
        # Get broker's Nylas grant ID
        response = sb.table('brokers')\
            .select('contact_name, email, timezone, nylas_grant_id')\
            .eq('id', broker_id)\
            .single()\
            .execute()
        
        if not response.data:
            return json.dumps({
                "success": False,
                "error": "Broker not found",
                "message": "Unable to check availability - broker not found."
            })
        
        broker = response.data
        
        if not broker.get('nylas_grant_id'):
            logger.warn('⚠️  Broker has no Nylas grant - calendar not connected')
            return json.dumps({
                "success": False,
                "error": "Calendar not connected",
                "message": f"{broker.get('contact_name')}'s calendar is not connected. Please schedule manually."
            })
        
        # Calculate time range (next 14 days)
        now = int(time.time())
        end_time = int(time.time() + 14 * 24 * 60 * 60)
        
        # Get broker's calendar events
        busy_times = await get_broker_events(broker['nylas_grant_id'], now, end_time)
        
        logger.info(f"✅ Found {len(busy_times)} busy events on calendar")
        
        # Find free slots
        free_slots = find_free_slots(
            now * 1000,
            end_time * 1000,
            busy_times,
            20 * 60 * 1000  # 20 minute appointments
        )
        
        # Format and filter slots
        available_slots = format_available_slots(
            free_slots,
            preferred_day,
            preferred_time
        )
        
        duration_ms = int((time.time() - start_time) * 1000)
        logger.info(f"✅ Availability check complete in {duration_ms}ms - found {len(available_slots)} slots")
        
        # Generate smart response message
        message = ''
        if len(available_slots) == 0:
            message = f"{broker.get('contact_name')} has no availability in the next 2 weeks within business hours (10 AM - 5 PM Mon-Fri)."
        else:
            same_day_slots = [s for s in available_slots if s.get('is_same_day')]
            tomorrow_slots = [s for s in available_slots if s.get('is_tomorrow')]
            
            if same_day_slots:
                message = f"Great news! {broker.get('contact_name')} has {len(same_day_slots)} slot(s) available today. The earliest is {same_day_slots[0].get('time')}."
            elif tomorrow_slots:
                message = f"{broker.get('contact_name')} has {len(tomorrow_slots)} slot(s) available tomorrow. The earliest is {tomorrow_slots[0].get('time')}."
            else:
                message = f"{broker.get('contact_name')} has {len(available_slots)} available times over the next 2 weeks."
        
        return json.dumps({
            "success": True,
            "available_slots": available_slots,
            "broker_name": broker.get('contact_name'),
            "calendar_provider": "nylas",
            "business_hours": "10:00 AM - 5:00 PM Mon-Fri",
            "message": message
        })
        
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.error(f"❌ Availability check failed after {duration_ms}ms: {e}")
        return json.dumps({
            "success": False,
            "error": str(e),
            "message": "Unable to check calendar availability. Please try scheduling manually."
        })

@function_tool
async def book_appointment(
    lead_id: str,
    broker_id: str,
    scheduled_for: str,
    notes: Optional[str] = None
) -> str:
    """Book an appointment with the broker after checking availability. Creates calendar event and auto-sends invite to lead email. Creates interaction record and billing event.
    
    Args:
        lead_id: Lead UUID
        broker_id: Broker UUID
        scheduled_for: Appointment date/time in ISO 8601 format (e.g., "2025-10-20T10:00:00Z")
        notes: Any notes about the appointment or lead preferences
    """
    sb = get_supabase_client()
    import time
    start_time = time.time()
    
    try:
        logger.info(f"📅 Booking appointment: {scheduled_for}")
        
        # Get broker info
        broker_response = sb.table('brokers')\
            .select('contact_name, email, timezone, nylas_grant_id')\
            .eq('id', broker_id)\
            .single()\
            .execute()
        
        if not broker_response.data:
            return json.dumps({
                "success": False,
                "error": "Broker not found",
                "message": "Unable to book appointment - broker not found."
            })
        
        broker = broker_response.data
        
        if not broker.get('nylas_grant_id'):
            return json.dumps({
                "success": False,
                "error": "Calendar not connected",
                "message": f"{broker.get('contact_name')}'s calendar is not connected. Please book manually."
            })
        
        # Get lead info
        lead_response = sb.table('leads')\
            .select('first_name, last_name, primary_phone, primary_email')\
            .eq('id', lead_id)\
            .single()\
            .execute()
        
        if not lead_response.data:
            return json.dumps({
                "success": False,
                "error": "Lead not found",
                "message": "Unable to book appointment - lead not found."
            })
        
        lead = lead_response.data
        
        lead_name = f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip() or "Lead"
        lead_email = lead.get('primary_email')
        
        # Parse scheduled_for to Unix timestamps
        from datetime import datetime
        appointment_date = datetime.fromisoformat(scheduled_for.replace('Z', '+00:00'))
        start_unix = int(appointment_date.timestamp())
        end_unix = start_unix + 3600  # 1 hour appointment
        
        # Create calendar event via Nylas
        nylas_event_id = await create_calendar_event(broker['nylas_grant_id'], {
            "title": f"Reverse Mortgage Consultation - {lead_name}",
            "description": "\n".join([
                f"Lead: {lead_name}",
                f"Phone: {lead.get('primary_phone', 'N/A')}",
                f"Email: {lead_email or 'N/A'}",
                "",
                f"Notes: {notes or 'None'}",
                "",
                "This appointment was scheduled by Barbara AI Assistant."
            ]),
            "startTime": start_unix,
            "endTime": end_unix,
            "participants": [
                {"name": broker.get('contact_name'), "email": broker.get('email')},
                *([{"name": lead_name, "email": lead_email}] if lead_email else [])
            ]
        })
        
        logger.info(f"✅ Nylas event created: {nylas_event_id}")
        
        # Log interaction to Supabase
        interaction_response = sb.table('interactions').insert({
            "lead_id": lead_id,
            "broker_id": broker_id,
            "type": "appointment",
            "direction": "outbound",
            "content": f"Appointment scheduled for {appointment_date.strftime('%Y-%m-%d %H:%M:%S')}",
            "outcome": "appointment_booked",
            "scheduled_for": scheduled_for,
            "metadata": {
                "nylas_event_id": nylas_event_id,
                "scheduled_for": scheduled_for,
                "notes": notes,
                "calendar_invite_sent": bool(lead_email)
            }
        }).execute()
        
        if interaction_response.error:
            logger.error(f"❌ Failed to save appointment interaction: {interaction_response.error}")
            raise Exception(f"Failed to save appointment: {interaction_response.error}")
        
        logger.info('✅ Appointment interaction saved')
        
        # Update lead status
        sb.table('leads')\
            .update({
                "status": "appointment_set",
                "last_engagement": datetime.utcnow().isoformat()
            })\
            .eq('id', lead_id)\
            .execute()
        
        # Create billing event
        sb.table('billing_events').insert({
            "broker_id": broker_id,
            "lead_id": lead_id,
            "event_type": "appointment_set",
            "amount": 50,
            "status": "pending",
            "metadata": {
                "nylas_event_id": nylas_event_id,
                "scheduled_for": scheduled_for
            }
        }).execute()
        
        duration_ms = int((time.time() - start_time) * 1000)
        logger.info(f"✅ Appointment booked successfully in {duration_ms}ms")
        
        # Update conversation state to mark appointment as booked
        phone_number = lead.get('primary_phone')
        if phone_number:
            update_conversation_state(phone_number, {
                "conversation_data": {
                    "appointment_booked": True,
                    "appointment_id": nylas_event_id,
                }
            })
        
        appointment_display = appointment_date.strftime('%B %d, %Y at %I:%M %p')
        return json.dumps({
            "success": True,
            "event_id": nylas_event_id,
            "scheduled_for": scheduled_for,
            "calendar_invite_sent": bool(lead_email),
            "message": f"Appointment booked successfully for {appointment_display}. Calendar invite sent to {lead_email}." if lead_email else f"Appointment booked successfully for {appointment_display} (no email for invite)."
        })
        
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.error(f"❌ Booking failed after {duration_ms}ms: {e}")
        return json.dumps({
            "success": False,
            "error": str(e),
            "message": "Unable to book appointment. Please try again or book manually."
        })

@function_tool
async def cancel_appointment(interaction_id: str, reason: Optional[str] = None) -> str:
    """Cancel an existing appointment.
    
    Args:
        interaction_id: Interaction UUID for the appointment
        reason: Optional reason for cancellation
    """
    # Implementation would cancel Nylas event and update interaction
    # For now, return placeholder
    return json.dumps({
        "success": False,
        "message": "Cancel appointment functionality not yet implemented"
    })

@function_tool
async def reschedule_appointment(
    interaction_id: str,
    new_scheduled_for: str,
    reason: Optional[str] = None
) -> str:
    """Reschedule an existing appointment to a new time.
    
    Args:
        interaction_id: Interaction UUID for the appointment
        new_scheduled_for: New appointment date/time in ISO 8601 format
        reason: Optional reason for rescheduling
    """
    # Implementation would update Nylas event and interaction
    # For now, return placeholder
    return json.dumps({
        "success": False,
        "message": "Reschedule appointment functionality not yet implemented"
    })

