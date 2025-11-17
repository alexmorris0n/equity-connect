"""Lead service layer.

All core lead-related business logic lives here. This module is intentionally
decoupled from SignalWire / SWAIG – agent tools should call these helpers
directly instead of importing from `equity_connect.tools.*`.
"""

from typing import Any, Dict, Optional
import logging
import re
import json

from equity_connect.services.supabase import get_supabase_client
from equity_connect.services.conversation_state import update_conversation_state

logger = logging.getLogger(__name__)


def get_lead_context_core(phone: str) -> str:
	"""Core implementation for get_lead_context.
	
	Returns a JSON string matching the previous tool shape so existing
	prompts and logic continue to work.
	"""
	sb = get_supabase_client()
	
	try:
		# Guard against None/empty phone
		if not phone:
			return json.dumps({
				"found": False,
				"error": "Phone number is required",
				"message": "No phone number provided.",
			})
		
		logger.info(f"Looking up lead by phone: {phone}")
		
		# Generate search patterns
		phone_digits = re.sub(r"\D", "", str(phone))
		last10 = phone_digits[-10:] if len(phone_digits) >= 10 else phone_digits
		patterns = [
			phone,  # Original format
			last10,  # 10-digit
			f"+1{last10}" if len(last10) == 10 else phone,  # E.164
		]
		
		# Build OR query
		or_conditions = []
		for pattern in patterns:
			if pattern:
				or_conditions.append(f"primary_phone.ilike.%{pattern}%")
				or_conditions.append(f"primary_phone_e164.eq.{pattern}")
		
		if not or_conditions:
			return json.dumps({"found": False, "error": "Invalid phone number"})
		
		# Query lead
		query = sb.table("leads").select(
			"""
			id, first_name, last_name, primary_email, primary_phone, primary_phone_e164,
			property_address, property_city, property_state, property_zip,
			property_value, estimated_equity, age, status, qualified, owner_occupied,
			assigned_broker_id, assigned_persona, persona_heritage,
			brokers:assigned_broker_id (
				id, contact_name, company_name, phone, nmls_number, nylas_grant_id
			)
			"""
		)
		or_filter = ",".join(or_conditions)
		response = query.or_(or_filter).limit(1).execute()
		
		if not response.data:
			logger.info("Lead not found")
			return json.dumps(
				{
					"found": False,
					"message": "No lead found with that phone number. This appears to be a new caller.",
				}
			)
		
		lead = response.data[0]
		broker = lead.get("brokers")
		
		# Get last interaction for context
		last_interaction_response = (
			sb.table("interactions")
			.select("*")
			.eq("lead_id", lead["id"])
			.order("created_at", desc=True)
			.limit(1)
			.execute()
		)
		
		last_interaction = (
			last_interaction_response.data[0] if last_interaction_response.data else None
		)
		last_call_context = last_interaction.get("metadata", {}) if last_interaction else {}
		
		# Determine qualification status
		is_qualified = lead.get("status") in [
			"qualified",
			"appointment_set",
			"showed",
			"application",
			"funded",
		]
		
		logger.info(
			f"Lead found: {lead.get('first_name')} {lead.get('last_name')} ({lead.get('status')})"
		)
		
		# Update conversation state to mark lead as found and verified
		update_conversation_state(
			phone,
			{
				"lead_id": str(lead["id"]),
				"qualified": is_qualified,
				"conversation_data": {
					"verified": True,
					"greeted": True,
				},
			},
		)
		
		# Compute full name from first_name + last_name
		full_name = " ".join(filter(None, [lead.get("first_name"), lead.get("last_name")])) or "Unknown"
		
		return json.dumps(
			{
				"found": True,
				"lead_id": str(lead["id"]),
				"broker_id": str(lead["assigned_broker_id"])
				if lead.get("assigned_broker_id")
				else None,
				"broker": {
					"name": broker.get("contact_name") if broker else "Not assigned",
					"company": broker.get("company_name") if broker else "",
					"phone": broker.get("phone") if broker else "",
				},
				"lead": {
					"name": full_name,  # Add explicit full name field
					"first_name": lead.get("first_name", ""),
					"last_name": lead.get("last_name", ""),
					"email": lead.get("primary_email", ""),
					"phone": lead.get("primary_phone", ""),
					"property_address": lead.get("property_address", ""),
					"property_city": lead.get("property_city", ""),
					"property_state": lead.get("property_state", ""),
					"property_zip": lead.get("property_zip", ""),
					"property_value": lead.get("property_value"),
					"estimated_equity": lead.get("estimated_equity"),
					"age": lead.get("age"),
					"owner_occupied": lead.get("owner_occupied", False),
					"status": lead.get("status", ""),
					"qualified": is_qualified,
					"assigned_persona": lead.get("assigned_persona"),
					"persona_heritage": lead.get("persona_heritage"),
				},
				"last_call": {
					"money_purpose": last_call_context.get("money_purpose"),
					"specific_need": last_call_context.get("specific_need"),
					"amount_needed": last_call_context.get("amount_needed"),
					"timeline": last_call_context.get("timeline"),
					"objections": last_call_context.get("objections", []),
					"questions_asked": last_call_context.get("questions_asked", []),
					"appointment_scheduled": last_call_context.get(
						"appointment_scheduled", False
					),
					"last_outcome": last_interaction.get("outcome")
					if last_interaction
					else None,
				},
			}
		)
	except Exception as e:
		logger.error(f"Error getting lead context: {e}")
		return json.dumps(
			{
				"error": str(e),
				"found": False,
				"message": "Unable to retrieve lead information at this time.",
			}
		)


def check_consent_dnc_core(phone: str) -> str:
	"""Core implementation for DNC/consent lookup."""
	sb = get_supabase_client()
	
	try:
		logger.info(f"Checking consent status for: {phone}")
		
		phone_digits = "".join(filter(str.isdigit, phone or ""))
		last10 = phone_digits[-10:] if len(phone_digits) >= 10 else phone_digits
		
		lead_response = (
			sb.table("leads")
			.select(
				"id, consent, consented_at, consent_method, primary_phone, primary_phone_e164"
			)
			.or_(
				f"primary_phone.ilike.%{last10}%"
				+ (
					f",primary_phone_e164.eq.{last10},primary_phone_e164.eq.+1{last10}"
					if last10
					else ""
				)
			)
			.limit(1)
			.execute()
		)
		
		if not lead_response.data:
			return json.dumps(
				{
					"can_call": True,
					"has_consent": False,
					"message": "Lead not found in CRM; treat as new caller.",
				}
			)
		
		lead = lead_response.data[0]
		has_consent = bool(lead.get("consent"))
		message = (
			"Caller previously granted consent."
			if has_consent
			else "No explicit consent on file."
		)
		if lead.get("consented_at"):
			message += f" (consented at {lead.get('consented_at')})"
		
		return json.dumps(
			{
				"can_call": has_consent,
				"is_dnc": False,
				"has_consent": has_consent,
				"message": message,
			}
		)
	except Exception as e:
		logger.error(f"Error checking consent status: {e}")
		return json.dumps(
			{
				"error": str(e),
				"can_call": False,
				"message": "Unable to verify calling permissions.",
			}
		)


def update_lead_info_core(
	lead_id: str,
	first_name: Optional[str] = None,
	last_name: Optional[str] = None,
	email: Optional[str] = None,
	phone: Optional[str] = None,
	property_address: Optional[str] = None,
	property_city: Optional[str] = None,
	property_state: Optional[str] = None,
	property_zip: Optional[str] = None,
	age: Optional[int] = None,
	money_purpose: Optional[str] = None,
	amount_needed: Optional[float] = None,
	timeline: Optional[str] = None,
	conversation_data: Optional[Dict[str, Any]] = None,
) -> str:
	"""Core implementation for updating lead information."""
	sb = get_supabase_client()
	
	try:
		logger.info(f"Updating lead info: {lead_id}")
		
		update_data: Dict[str, Any] = {}
		if first_name is not None:
			update_data["first_name"] = first_name
		if last_name is not None:
			update_data["last_name"] = last_name
		if email is not None:
			update_data["primary_email"] = email
		if phone is not None:
			update_data["primary_phone"] = phone
		if property_address is not None:
			update_data["property_address"] = property_address
		if property_city is not None:
			update_data["property_city"] = property_city
		if property_state is not None:
			update_data["property_state"] = property_state
		if property_zip is not None:
			update_data["property_zip"] = property_zip
		if age is not None:
			update_data["age"] = age
		
		updated_lead_fields: list[str] = []
		updated_conversation_fields: list[str] = []
		
		if update_data:
			response = (
				sb.table("leads").update(update_data).eq("id", lead_id).execute()
			)
			if response.error:
				raise Exception(response.error)
			updated_lead_fields = list(update_data.keys())
		
		if conversation_data:
			phone_number = phone
			if not phone_number:
				lead_resp = (
					sb.table("leads")
					.select("primary_phone")
					.eq("id", lead_id)
					.single()
					.execute()
				)
				if lead_resp.data:
					phone_number = lead_resp.data.get("primary_phone")
			
			if phone_number:
				update_conversation_state(
					phone_number, {"conversation_data": conversation_data}
				)
				updated_conversation_fields = list(conversation_data.keys())
			else:
				logger.warning(
					f"Unable to update conversation_data for lead {lead_id} because phone number is missing."
				)
		
		message_parts = []
		if updated_lead_fields:
			message_parts.append(
				f"Updated lead fields: {', '.join(updated_lead_fields)}."
			)
		if updated_conversation_fields:
			message_parts.append(
				f"Updated conversation data: {', '.join(updated_conversation_fields)}."
			)
		if not message_parts:
			message_parts.append("No changes applied.")
		
		return json.dumps(
			{
				"success": True,
				"lead_id": lead_id,
				"updated_fields": updated_lead_fields,
				"updated_conversation_data": updated_conversation_fields,
				"message": " ".join(message_parts),
			}
		)
	except Exception as e:
		logger.error(f"Error updating lead info: {e}")
		return json.dumps(
			{
				"success": False,
				"error": str(e),
				"message": "Unable to update lead information.",
			}
		)


def find_broker_by_territory_core(
	zip_code: Optional[str] = None,
	city: Optional[str] = None,
	state: Optional[str] = None,
) -> str:
	"""Core implementation for broker territory lookup."""
	sb = get_supabase_client()
	
	try:
		logger.info(f"Finding broker territory for zip={zip_code}, city={city}, state={state}")
		
		if zip_code:
			territory_resp = (
				sb.table("broker_territories")
				.select("broker_id, market_name, zip_code, priority")
				.eq("zip_code", zip_code)
				.eq("active", True)
				.order("priority", desc=True)
				.limit(5)
				.execute()
			)
			territories = territory_resp.data or []
			candidate_ids = [t["broker_id"] for t in territories if t.get("broker_id")]
		else:
			candidate_ids = []
		
		broker: Optional[Dict[str, Any]] = None
		if candidate_ids:
			broker_resp = (
				sb.table("brokers")
				.select(
					"id, contact_name, company_name, phone, email, nmls_number, nylas_grant_id, "
					"address_city, address_state, address_zip, status, timezone"
				)
				.in_("id", candidate_ids)
				.eq("status", "active")
				.order("updated_at", desc=True)
				.limit(1)
				.execute()
			)
			if broker_resp.data:
				broker = broker_resp.data[0]
		
		if not broker:
			query = (
				sb.table("brokers")
				.select(
					"id, contact_name, company_name, phone, email, nmls_number, nylas_grant_id, "
					"address_city, address_state, address_zip, status, timezone"
				)
				.eq("status", "active")
			)
			if city:
				query = query.ilike("address_city", f"%{city}%")
			if state:
				query = query.eq("address_state", state.upper())
			if not city and not state and not zip_code:
				return json.dumps(
					{"found": False, "error": "Must provide zip_code, city, or state"}
				)
			response = query.limit(1).execute()
			if response.data:
				broker = response.data[0]
		
		if not broker:
			return json.dumps({"found": False, "message": "No broker found for that territory."})
		
		return json.dumps(
			{
				"found": True,
				"broker_id": str(broker["id"]),
				"broker": {
					"name": broker.get("contact_name", ""),
					"company": broker.get("company_name", ""),
					"phone": broker.get("phone", ""),
					"email": broker.get("email", ""),
					"nmls": broker.get("nmls_number", ""),
					"has_calendar": bool(broker.get("nylas_grant_id")),
				},
			}
		)
	except Exception as e:
		logger.error(f"Error finding broker: {e}")
		return json.dumps(
			{
				"found": False,
				"error": str(e),
				"message": "Unable to find a broker for that territory.",
			}
		)


def verify_caller_identity_core(first_name: str, phone: str) -> str:
	"""Core implementation for verifying caller identity."""
	logger.info(f"Verifying caller identity: {first_name}, {phone}")
	
	lead_info_json = get_lead_context_core(phone)
	lead_data = json.loads(lead_info_json)
	
	if lead_data.get("found"):
		update_conversation_state(
			phone,
			{
				"conversation_data": {
					"verified": True,
					"greeted": True,
				}
			},
		)
		return json.dumps(
			{
				"success": True,
				"lead_id": lead_data.get("lead_id"),
				"message": f"Verified: {first_name}",
			}
		)
	
	sb = get_supabase_client()
	try:
		new_lead_response = (
			sb.table("leads")
			.insert(
				{
					"first_name": first_name,
					"primary_phone": phone,
					"status": "new",
				}
			)
			.execute()
		)
		
		if new_lead_response.error:
			raise Exception(new_lead_response.error)
		
		new_lead_id = str(new_lead_response.data[0]["id"])
		
		update_conversation_state(
			phone,
			{
				"lead_id": new_lead_id,
				"conversation_data": {
					"verified": True,
					"greeted": True,
					"is_new_lead": True,
				},
			},
		)
		
		logger.info(f"New lead created during verify_caller_identity: {new_lead_id}")
		
		return json.dumps(
			{
				"success": True,
				"lead_id": new_lead_id,
				"message": f"New lead created: {first_name}",
			}
		)
	except Exception as e:
		logger.error(f"Error creating lead during verify_caller_identity: {e}")
		return json.dumps(
			{
				"success": False,
				"error": str(e),
				"message": "Unable to verify or create lead.",
			}
		)



