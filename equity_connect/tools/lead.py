"""Lead management tools"""
from typing import Optional, Dict, Any
from equity_connect.services.supabase import get_supabase_client, normalize_phone
from equity_connect.services.conversation_state import update_conversation_state
import logging

logger = logging.getLogger(__name__)

async def get_lead_context(phone: str) -> str:
	"""Get lead information by phone number to personalize the conversation. Returns lead details, broker info, and property data.
	
	Args:
	    phone: Phone number of the lead (any format)
	"""
	sb = get_supabase_client()
	
	try:
		logger.info(f"🔍 Looking up lead by phone: {phone}")
		
		# Generate search patterns
		import re
		phone_digits = re.sub(r'\D', '', phone)
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
			return '{"found": false, "error": "Invalid phone number"}'
		
		# Query lead by phone
		query = sb.table('leads').select('''
			id, first_name, last_name, primary_email, primary_phone, primary_phone_e164,
			property_address, property_city, property_state, property_zip,
			property_value, estimated_equity, age, status, qualified, owner_occupied,
			assigned_broker_id, assigned_persona, persona_heritage,
			brokers:assigned_broker_id (
				id, contact_name, company_name, phone, nmls_number, nylas_grant_id
			)
		''')
		or_filter = ','.join(or_conditions)
		response = query.or_(or_filter).limit(1).execute()
		
		if not response.data or len(response.data) == 0:
			logger.info('Lead not found')
			return '{"found": false, "message": "No lead found with that phone number. This appears to be a new caller."}'
		
		lead = response.data[0]
		broker = lead.get('brokers')
		
		# Get last interaction for context
		last_interaction_response = sb.table('interactions')\
			.select('*')\
			.eq('lead_id', lead['id'])\
			.order('created_at', desc=True)\
			.limit(1)\
			.execute()
		
		last_interaction = last_interaction_response.data[0] if last_interaction_response.data else None
		last_call_context = last_interaction.get('metadata', {}) if last_interaction else {}
		
		# Determine qualification status
		is_qualified = lead.get('status') in ['qualified', 'appointment_set', 'showed', 'application', 'funded']
		
		logger.info(f"✅ Lead found: {lead.get('first_name')} {lead.get('last_name')} ({lead.get('status')})")
		
		# Update conversation state to mark lead as found and verified
		update_conversation_state(phone, {
			"lead_id": str(lead['id']),  # Top-level DB column
			"qualified": is_qualified,  # Top-level DB column
			"conversation_data": {
				"verified": True,  # Triggers routing from verify node
				"greeted": True,   # Also marks greet as complete
			}
		})
		
		import json
		return json.dumps({
			"found": True,
			"lead_id": str(lead['id']),
			"broker_id": str(lead['assigned_broker_id']) if lead.get('assigned_broker_id') else None,
			"broker": {
				"name": broker.get('contact_name') if broker else 'Not assigned',
				"company": broker.get('company_name') if broker else '',
				"phone": broker.get('phone') if broker else ''
			},
			"lead": {
				"first_name": lead.get('first_name', ''),
				"last_name": lead.get('last_name', ''),
				"email": lead.get('primary_email', ''),
				"phone": lead.get('primary_phone', ''),
				"property_address": lead.get('property_address', ''),
				"property_city": lead.get('property_city', ''),
				"property_state": lead.get('property_state', ''),
				"property_zip": lead.get('property_zip', ''),
				"property_value": lead.get('property_value'),
				"estimated_equity": lead.get('estimated_equity'),
				"age": lead.get('age'),
				"owner_occupied": lead.get('owner_occupied', False),
				"status": lead.get('status', ''),
				"qualified": is_qualified,
				"assigned_persona": lead.get('assigned_persona'),
				"persona_heritage": lead.get('persona_heritage')
			},
			"last_call": {
				"money_purpose": last_call_context.get('money_purpose'),
				"specific_need": last_call_context.get('specific_need'),
				"amount_needed": last_call_context.get('amount_needed'),
				"timeline": last_call_context.get('timeline'),
				"objections": last_call_context.get('objections', []),
				"questions_asked": last_call_context.get('questions_asked', []),
				"appointment_scheduled": last_call_context.get('appointment_scheduled', False),
				"last_outcome": last_interaction.get('outcome') if last_interaction else None
			}
		})
		
	except Exception as e:
		logger.error(f'Error getting lead context: {e}')
		import json
		return json.dumps({
			"error": str(e),
			"found": False,
			"message": "Unable to retrieve lead information at this time."
		})

async def verify_caller_identity(first_name: str, phone: str) -> str:
	"""Verify caller identity by name and phone. Creates lead if new.
	
	Args:
	    first_name: Caller's first name
	    phone: Caller's phone number
	"""
	logger.info(f"🔍 Verifying caller identity: {first_name}, {phone}")
	
	# First check if lead exists
	lead_info = await get_lead_context(phone)
	
	import json
	lead_data = json.loads(lead_info)
	
	if lead_data.get("found"):
		# Mark as verified in conversation state
		update_conversation_state(phone, {
			"conversation_data": {
				"verified": True,
				"greeted": True,
			}
		})
		return json.dumps({
			"success": True,
			"lead_id": lead_data["lead_id"],
			"message": f"Verified: {first_name}"
		})
	else:
		# Create new lead
		sb = get_supabase_client()
		try:
			new_lead_response = sb.table('leads').insert({
				"first_name": first_name,
				"primary_phone": phone,
				"status": "new"
			}).execute()
			
			if new_lead_response.error:
				raise Exception(new_lead_response.error)
			
			new_lead_id = str(new_lead_response.data[0]["id"])
			
			update_conversation_state(phone, {
				"lead_id": new_lead_id,  # Top-level DB column
				"conversation_data": {
					"verified": True,
					"greeted": True,
					"is_new_lead": True,
				}
			})
			
			logger.info(f"✅ New lead created: {first_name} ({new_lead_id})")
			
			return json.dumps({
				"success": True,
				"lead_id": new_lead_id,
				"message": f"New lead created: {first_name}"
			})
		except Exception as e:
			logger.error(f"❌ Error creating lead: {e}")
			return json.dumps({
				"success": False,
				"error": str(e),
				"message": "Unable to verify or create lead."
			})

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


