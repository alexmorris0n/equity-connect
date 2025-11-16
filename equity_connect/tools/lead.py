"""Lead management tools"""
from typing import Optional, Dict, Any
from equity_connect.services.supabase import get_supabase_client, normalize_phone
from equity_connect.services.conversation_state import update_conversation_state
import logging

logger = logging.getLogger(__name__)

# DEPRECATED: get_lead_context has been moved to barbara_agent.py as a direct implementation
# This avoids SDK conflicts with dual implementations

# DEPRECATED: verify_caller_identity also moved to barbara_agent.py as direct implementation
# Kept here as stub to avoid import errors, but not functional
async def verify_caller_identity(first_name: str, phone: str) -> str:
	"""DEPRECATED - See barbara_agent.py for active implementation"""
	import json
	return json.dumps({"error": "This function has been moved to barbara_agent.py", "success": False})

async def check_consent_dnc(phone: str) -> str:
	"""Check if we have consent to call and if the number is on Do Not Call list.
	
	Args:
	    phone: Phone number to check
	"""
	sb = get_supabase_client()
	
	try:
		logger.info(f"🔍 Checking consent/DNC for: {phone}")
		
		# Normalize phone
		phone_digits = ''.join(filter(str.isdigit, phone))
		last10 = phone_digits[-10:] if len(phone_digits) >= 10 else phone_digits
		
		# Check DNC list
		dnc_query = sb.table('do_not_call').select('*')
		dnc_response = dnc_query.or_(f"phone.eq.{last10},phone.eq.+1{last10}").limit(1).execute()
		
		is_dnc = dnc_response.data and len(dnc_response.data) > 0
		
		# Check lead consent (if lead exists)
		lead_query = sb.table('leads').select('consent_to_call, dnc')
		lead_response = lead_query.or_(f"primary_phone.ilike.%{last10}%,primary_phone_e164.eq.{last10}").limit(1).execute()
		
		has_consent = False
		if lead_response.data and len(lead_response.data) > 0:
			lead = lead_response.data[0]
			has_consent = lead.get('consent_to_call', False) and not lead.get('dnc', False)
		
		import json
		return json.dumps({
			"can_call": not is_dnc and (has_consent or not lead_response.data),
			"is_dnc": is_dnc,
			"has_consent": has_consent,
			"message": "Cannot call - on DNC list" if is_dnc else ("Has consent" if has_consent else "No explicit consent but not on DNC")
		})
		
	except Exception as e:
		logger.error(f'Error checking consent/DNC: {e}')
		import json
		return json.dumps({
			"error": str(e),
			"can_call": False,
			"message": "Unable to verify calling permissions."
		})

async def update_lead_info(
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
	conversation_data: Optional[Dict[str, Any]] = None
) -> str:
	"""Update lead information collected during the call.
	
	Args:
	    lead_id: Lead UUID
	    first_name: First name
	    last_name: Last name
	    email: Email address
	    phone: Phone number
	    property_address: Property address
	    property_city: Property city
	    property_state: Property state
	    property_zip: Property ZIP code
	    age: Age
	    money_purpose: Purpose for the money
	    amount_needed: Amount needed
	    timeline: Timeline for needing the money
	    conversation_data: Optional dictionary of conversation_state flags to merge
	        Examples:
	        - {'interrupted_at_gate': 'mortgage_status'}
	        - {'needs_family_buy_in': True}
	        - {'pending_birthday_date': '2025-05-15'}
	        The payload merges with existing conversation_data (does not overwrite unrelated keys).
	"""
	sb = get_supabase_client()
	
	try:
		logger.info(f"📝 Updating lead info: {lead_id}")
		
		# Build update dict (only include non-None values)
		update_data = {}
		if first_name is not None:
			update_data['first_name'] = first_name
		if last_name is not None:
			update_data['last_name'] = last_name
		if email is not None:
			update_data['primary_email'] = email
		if phone is not None:
			update_data['primary_phone'] = phone
		if property_address is not None:
			update_data['property_address'] = property_address
		if property_city is not None:
			update_data['property_city'] = property_city
		if property_state is not None:
			update_data['property_state'] = property_state
		if property_zip is not None:
			update_data['property_zip'] = property_zip
		if age is not None:
			update_data['age'] = age
		
		updated_lead_fields = []
		updated_conversation_fields = []
		
		# Update lead
		if update_data:
			response = sb.table('leads')\
				.update(update_data)\
				.eq('id', lead_id)\
				.execute()
			
			if response.error:
				raise Exception(response.error)
			updated_lead_fields = list(update_data.keys())
		
		# Update conversation data if requested
		if conversation_data:
			phone_number = phone
			if not phone_number:
				lead_resp = sb.table('leads')\
					.select('primary_phone')\
					.eq('id', lead_id)\
					.single()\
					.execute()
				if lead_resp.data:
					phone_number = lead_resp.data.get('primary_phone')
			
			if phone_number:
				update_conversation_state(phone_number, {"conversation_data": conversation_data})
				updated_conversation_fields = list(conversation_data.keys())
			else:
				logger.warning(f"⚠️ Unable to update conversation_data for lead {lead_id} because phone number is missing.")
		
		# Store metadata in interaction (if we have a current interaction)
		# This will be handled by save_interaction tool
		
		import json
		message_parts = []
		if updated_lead_fields:
			message_parts.append(f"Updated lead fields: {', '.join(updated_lead_fields)}.")
		if updated_conversation_fields:
			message_parts.append(f"Updated conversation data: {', '.join(updated_conversation_fields)}.")
		if not message_parts:
			message_parts.append("No changes applied.")
		
		return json.dumps({
			"success": True,
			"lead_id": lead_id,
			"updated_fields": updated_lead_fields,
			"updated_conversation_data": updated_conversation_fields,
			"message": " ".join(message_parts)
		})
		
	except Exception as e:
		logger.error(f'Error updating lead info: {e}')
		import json
		return json.dumps({
			"success": False,
			"error": str(e),
			"message": "Unable to update lead information."
		})

async def find_broker_by_territory(zip_code: Optional[str] = None, city: Optional[str] = None, state: Optional[str] = None) -> str:
	"""Find a broker by territory (ZIP code, city, or state).
	
	Args:
	    zip_code: ZIP code
	    city: City name
	    state: State abbreviation
	"""
	sb = get_supabase_client()
	
	try:
		logger.info(f"🔍 Finding broker by territory: zip={zip_code}, city={city}, state={state}")
		
		query = sb.table('brokers')\
			.select('id, contact_name, company_name, phone, email, nmls_number, nylas_grant_id, status')\
			.eq('status', 'active')
		
		# Try ZIP first, then city, then state
		if zip_code:
			# Check broker_territories table if it exists, otherwise use broker zip field
			query = query.eq('zip', zip_code)
		elif city:
			query = query.ilike('city', f'%{city}%')
		elif state:
			query = query.eq('state', state)
		else:
			return '{"found": False, "error": "Must provide zip_code, city, or state"}'
		
		response = query.limit(1).execute()
		
		if not response.data or len(response.data) == 0:
			import json
			return json.dumps({
				"found": False,
				"message": "No broker found for that territory."
			})
		
		broker = response.data[0]
		
		import json
		return json.dumps({
			"found": True,
			"broker_id": str(broker['id']),
			"broker": {
				"name": broker.get('contact_name', ''),
				"company": broker.get('company_name', ''),
				"phone": broker.get('phone', ''),
				"email": broker.get('email', ''),
				"nmls": broker.get('nmls_number', ''),
				"has_calendar": bool(broker.get('nylas_grant_id'))
			}
		})
		
	except Exception as e:
		logger.error(f'Error finding broker: {e}')
		import json
		return json.dumps({
			"found": False,
			"error": str(e),
			"message": "Unable to find a broker for that territory."
		})


