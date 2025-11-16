"""Calendar service layer (Nylas + Supabase helpers)."""

from typing import Optional, Dict, Any
import logging
import json
import time
from datetime import datetime

from equity_connect.services.supabase import get_supabase_client
from equity_connect.services.conversation_state import update_conversation_state
from equity_connect.services.nylas import (
	get_broker_events,
	find_free_slots,
	format_available_slots,
	create_calendar_event,
)

logger = logging.getLogger(__name__)


def check_broker_availability_core(
	broker_id: str,
	preferred_day: Optional[str] = None,
	preferred_time: Optional[str] = None,
	raw_data: Optional[Dict[str, Any]] = None,
) -> str:
	"""Return JSON describing broker availability for the next 14 days.
	
	Returns up to 10 best-matching slots to save tokens.
	If preferred_day or preferred_time provided, filters to those constraints.
	"""
	sb = get_supabase_client()
	start_time = time.time()
	
	try:
		logger.info(f"Checking availability for broker: {broker_id}, preferred_day={preferred_day}, preferred_time={preferred_time}")
		
		broker_nylas_grant_id = None
		broker_calendar_id = None
		broker_name = None
		broker_timezone = None
		
		if raw_data:
			global_data = raw_data.get("global_data", {})
			if global_data.get("broker_id") == broker_id:
				broker_nylas_grant_id = global_data.get("broker_nylas_grant_id")
				broker_name = global_data.get("broker_name")
				broker_timezone = global_data.get("broker_timezone")
		
		if not broker_nylas_grant_id:
			response = (
				sb.table("brokers")
				.select("contact_name, timezone, nylas_grant_id")
				.eq("id", broker_id)
				.single()
				.execute()
			)
			if not response.data:
				return json.dumps(
					{
						"success": False,
						"error": "Broker not found",
						"message": "Unable to check availability - broker not found.",
					}
				)
			
			broker = response.data
			broker_nylas_grant_id = broker.get("nylas_grant_id")
			broker_name = broker.get("contact_name")
			broker_timezone = broker.get("timezone")
		
		if not broker_nylas_grant_id:
			logger.warning("Broker has no Nylas grant - calendar not connected")
			return json.dumps(
				{
					"success": False,
					"error": "Calendar not connected",
					"message": f"{broker_name or 'Broker'}'s calendar is not connected. Please schedule manually.",
				}
			)
		
		now = int(time.time())
		end_time = now + 14 * 24 * 60 * 60
		
		busy_times = get_broker_events(broker_nylas_grant_id, now, end_time)
		logger.info(f"Found {len(busy_times)} busy events on calendar")
		
		free_slots = find_free_slots(
			now * 1000,
			end_time * 1000,
			busy_times,
			20 * 60 * 1000,  # 20 minute appointments
		)
		
		available_slots = format_available_slots(
			free_slots,
			preferred_day,
			preferred_time,
		)
		
		# Limit to 10 best slots to save tokens (prioritize sooner slots)
		# If preferences provided, filter to those; otherwise show earliest available
		max_slots_to_return = 10
		if len(available_slots) > max_slots_to_return:
			logger.info(f"Limiting response from {len(available_slots)} slots to {max_slots_to_return} best matches")
			available_slots = available_slots[:max_slots_to_return]
		
		duration_ms = int((time.time() - start_time) * 1000)
		logger.info(
			f"Availability check complete in {duration_ms}ms - returning {len(available_slots)} slots"
		)
		
		if not available_slots:
			message = (
				f"{broker_name or 'Broker'} has no availability in the next 2 weeks."
			)
		else:
			same_day_slots = [s for s in available_slots if s.get("is_same_day")]
			tomorrow_slots = [s for s in available_slots if s.get("is_tomorrow")]
			if same_day_slots:
				message = (
					f"{broker_name or 'Broker'} has {len(same_day_slots)} slot(s) today. "
					f"Earliest: {same_day_slots[0].get('time')}."
				)
			elif tomorrow_slots:
				message = (
					f"{broker_name or 'Broker'} has {len(tomorrow_slots)} slot(s) tomorrow. "
					f"Earliest: {tomorrow_slots[0].get('time')}."
				)
			else:
				message = (
					f"{broker_name or 'Broker'} has available times over the next 2 weeks. "
					f"Showing {len(available_slots)} best options."
				)
		
		return json.dumps(
			{
				"success": True,
				"available_slots": available_slots,
				"broker_name": broker_name or "Broker",
				"broker_timezone": broker_timezone,
				"message": message,
				"note": "These are the next available times. If none work, ask for different days/times.",
			}
		)
	except Exception as e:
		duration_ms = int((time.time() - start_time) * 1000)
		logger.error(f"Availability check failed after {duration_ms}ms: {e}")
		return json.dumps(
			{
				"success": False,
				"error": str(e),
				"message": "Unable to check calendar availability. Please try again later.",
			}
		)


def book_appointment_core(
	lead_id: str,
	broker_id: str,
	scheduled_for: str,
	notes: Optional[str] = None,
	raw_data: Optional[Dict[str, Any]] = None,
) -> str:
	"""Book appointment and create calendar event."""
	sb = get_supabase_client()
	start_time = time.time()
	
	try:
		logger.info(f"Booking appointment: lead={lead_id}, broker={broker_id}")
		
		broker_nylas_grant_id = None
		broker_name = None
		broker_email = None
		broker_timezone = None
		
		if raw_data:
			global_data = raw_data.get("global_data", {})
			if global_data.get("broker_id") == broker_id:
				broker_nylas_grant_id = global_data.get("broker_nylas_grant_id")
				broker_name = global_data.get("broker_name")
				broker_email = global_data.get("broker_email")
				broker_timezone = global_data.get("broker_timezone")
				broker_calendar_id = global_data.get("broker_calendar_id")
		
		if not broker_nylas_grant_id:
			broker_response = (
				sb.table("brokers")
				.select("contact_name, email, timezone, nylas_grant_id")
				.eq("id", broker_id)
				.single()
				.execute()
			)
			if not broker_response.data:
				return json.dumps(
					{
						"success": False,
						"error": "Broker not found",
						"message": "Unable to book appointment - broker not found.",
					}
				)
			
			broker = broker_response.data
			broker_nylas_grant_id = broker.get("nylas_grant_id")
			broker_name = broker.get("contact_name")
			broker_email = broker.get("email")
			broker_timezone = broker.get("timezone")
			broker_calendar_id = broker.get("nylas_calendar_id")
		
		if not broker_nylas_grant_id:
			return json.dumps(
				{
					"success": False,
					"error": "Calendar not connected",
					"message": f"{broker_name or 'Broker'}'s calendar is not connected. Please book manually.",
				}
			)
		
		lead_response = (
			sb.table("leads")
			.select("first_name, last_name, primary_phone, primary_email")
			.eq("id", lead_id)
			.single()
			.execute()
		)
		if not lead_response.data:
			return json.dumps(
				{
					"success": False,
					"error": "Lead not found",
					"message": "Unable to book appointment - lead not found.",
				}
			)
		
		lead = lead_response.data
		lead_name = f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip() or "Lead"
		lead_email = (lead.get("primary_email") or "").strip() or None
		
		appointment_date = datetime.fromisoformat(scheduled_for.replace("Z", "+00:00"))
		start_unix = int(appointment_date.timestamp())
		end_unix = start_unix + 3600
		
		event_metadata = {
			"title": f"Reverse Mortgage Consultation - {lead_name}",
			"description": "\n".join(
				[
					f"Lead: {lead_name}",
					f"Phone: {lead.get('primary_phone', 'N/A')}",
					f"Email: {lead_email or 'N/A'}",
					"",
					f"Notes: {notes or 'None'}",
				]
			),
			"startTime": start_unix,
			"endTime": end_unix,
			"participants": [],
		}
		participants = []
		if broker_email:
			participants.append({"name": broker_name or "Broker", "email": broker_email})
		else:
			logger.warning(f"No broker email available for broker {broker_id}; event will include lead only.")
		if lead_email:
			participants.append({"name": lead_name, "email": lead_email})
		else:
			logger.info(f"No lead email available for lead {lead_id}; skipping lead invite.")
		
		if not participants:
			return json.dumps(
				{
					"success": False,
					"error": "No_recipient",
					"message": "Unable to create calendar event because no participant emails are available.",
				}
			)
		
		event_metadata["participants"] = participants
		nylas_event_id = create_calendar_event(
			broker_nylas_grant_id,
			event_metadata,
			calendar_id=broker_calendar_id,
		)
		
		logger.info(f"Nylas event created: {nylas_event_id}")
		
		interaction_response = (
			sb.table("interactions")
			.insert(
				{
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
						"calendar_invite_sent": bool(lead_email),
					},
				}
			)
			.execute()
		)
		if getattr(interaction_response, "error", None):
			raise Exception(f"Failed to save appointment: {interaction_response.error}")
		
		sb.table("leads").update(
			{
				"status": "appointment_set",
				"last_engagement": datetime.utcnow().isoformat(),
			}
		).eq("id", lead_id).execute()
		
		sb.table("billing_events").insert(
			{
				"broker_id": broker_id,
				"lead_id": lead_id,
				"event_type": "appointment_set",
				"amount": 50,
				"status": "pending",
				"metadata": {
					"nylas_event_id": nylas_event_id,
					"scheduled_for": scheduled_for,
				},
			}
		).execute()
		
		phone_number = lead.get("primary_phone")
		if phone_number:
			update_conversation_state(
				phone_number,
				{
					"conversation_data": {
						"appointment_booked": True,
						"appointment_id": nylas_event_id,
					}
				},
			)
		
		appointment_display = appointment_date.strftime("%B %d, %Y at %I:%M %p")
		duration_ms = int((time.time() - start_time) * 1000)
		logger.info(f"Appointment booked successfully in {duration_ms}ms")
		
		return json.dumps(
			{
				"success": True,
				"event_id": nylas_event_id,
				"scheduled_for": scheduled_for,
				"calendar_invite_sent": bool(lead_email),
				"message": f"Appointment booked for {appointment_display}.",
			}
		)
	except Exception as e:
		duration_ms = int((time.time() - start_time) * 1000)
		logger.error(f"Booking failed after {duration_ms}ms: {e}")
		return json.dumps(
			{
				"success": False,
				"error": str(e),
				"message": "Unable to book appointment. Please try again or book manually.",
			}
		)


def reschedule_appointment_core(
	interaction_id: str,
	new_scheduled_for: str,
	reason: Optional[str] = None,
) -> str:
	"""Placeholder reschedule implementation."""
	return json.dumps(
		{
			"success": False,
			"message": "Reschedule appointment functionality not yet implemented.",
		}
	)


def cancel_appointment_core(
	interaction_id: str,
	reason: Optional[str] = None,
) -> str:
	"""Placeholder cancel implementation."""
	return json.dumps(
		{
			"success": False,
			"message": "Cancel appointment functionality not yet implemented.",
		}
	)

