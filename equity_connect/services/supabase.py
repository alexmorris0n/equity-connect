"""Supabase service for database operations"""
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
import os
import logging

logger = logging.getLogger(__name__)

_supabase_client: Optional[Client] = None

def get_supabase_client() -> Client:
	"""Get or create Supabase client singleton"""
	global _supabase_client
	if _supabase_client is None:
		supabase_url = os.getenv("SUPABASE_URL")
		supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
		if not supabase_url or not supabase_key:
			raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required")
		_supabase_client = create_client(supabase_url, supabase_key)
	return _supabase_client

async def get_phone_config(called_number: str) -> Dict[str, Any]:
	"""
	Get provider configuration for a phone number
	
	Args:
	    called_number: E.164 phone number (e.g., +14244851544)
	
	Returns:
	    Dict with provider config: stt_provider, stt_model, tts_provider, etc.
	"""
	supabase = get_supabase_client()
	
	# Normalize phone number for lookup
	normalized = normalize_phone(called_number)
	
	# Query signalwire_phone_numbers table
	response = supabase.table('signalwire_phone_numbers')\
		.select('*')\
		.or_(f'number.eq.{called_number},number.eq.{normalized}')\
		.eq('status', 'active')\
		.limit(1)\
		.execute()
	
	if response.data and len(response.data) > 0:
		phone_config = response.data[0]
		logger.info(f"✅ Found phone config for {called_number}")
		return {
			'stt_provider': phone_config.get('stt_provider', 'deepgram'),
			'stt_model': phone_config.get('stt_model', 'nova-2'),
			'tts_provider': phone_config.get('tts_provider', 'elevenlabs'),
			'tts_voice': phone_config.get('tts_voice', 'shimmer'),
			'llm_provider': phone_config.get('llm_provider', 'openai'),
			'llm_model': phone_config.get('llm_model', 'gpt-5'),
			'provider_overrides': phone_config.get('provider_overrides', {}),
			'stt_fallback_provider': phone_config.get('stt_fallback_provider'),
			'tts_fallback_provider': phone_config.get('tts_fallback_provider'),
			'llm_fallback_provider': phone_config.get('llm_fallback_provider'),
		}
	
	# Return defaults if not found
	logger.warning(f"⚠️ No phone config found for {called_number}, using defaults")
	return {
		'stt_provider': 'deepgram',
		'stt_model': 'nova-2',
		'tts_provider': 'elevenlabs',
		'tts_voice': 'shimmer',
		'llm_provider': 'openai',
		'llm_model': 'gpt-5',
		'provider_overrides': {},
		'stt_fallback_provider': None,
		'tts_fallback_provider': None,
		'llm_fallback_provider': None,
	}

async def get_lead_by_phone(phone: str) -> Optional[Dict[str, Any]]:
	"""
	Look up lead by phone number (supports E.164 and 10-digit formats)
	
	Args:
	    phone: Phone number in any format
	
	Returns:
	    Lead dict with broker info, or None if not found
	"""
	supabase = get_supabase_client()
	
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
		return None
	
	# Build query and execute with OR conditions  
	query = supabase.table('leads').select('''
		id, first_name, last_name, primary_email, primary_phone, primary_phone_e164,
		property_address, property_city, property_state, property_zip,
		property_value, estimated_equity, age, status, qualified, owner_occupied,
		assigned_broker_id,
		brokers:assigned_broker_id (
			id, contact_name, company_name, phone, nmls_number, nylas_grant_id
		)
	''')
	or_filter = ','.join(or_conditions)
	response = query.or_(or_filter).limit(1).execute()
	
	if response.data and len(response.data) > 0:
		lead = response.data[0]
		logger.info(f"✅ Found lead: {lead.get('first_name')} {lead.get('last_name')}")
		return lead
	
	return None

async def record_interaction(
	session_data: Dict[str, Any],
	phone_config: Dict[str, Any],
	cost: float,
	transcript: List[Dict[str, Any]],
	prompt_version: Optional[str],
	recording_meta: Optional[Dict[str, Any]] = None
) -> str:
	"""
	Save interaction record to Supabase
	
	Args:
	    session_data: Session metadata (room name, duration, lead_id, broker_id, etc.)
	    phone_config: Provider config used
	    cost: Estimated cost
	    transcript: Conversation transcript array
	    prompt_version: Prompt version string (e.g., 'inbound-qualified-v7')
	    recording_meta: Recording metadata dict (bucket, object_path, etc.)
	
	Returns:
	    Interaction ID
	"""
	supabase = get_supabase_client()
	
	# Build transcript text
	transcript_text = '\n'.join([
		f"{msg.get('role', 'unknown')}: {msg.get('text', msg.get('content', ''))}"
		for msg in transcript
	])
	
	# Extract tool calls
	tool_calls_made = []
	for msg in transcript:
		if msg.get('tool_calls'):
			tool_calls_made.extend([tc.get('tool_name') for tc in msg.get('tool_calls', [])])
	
	# Build metadata
	metadata = {
		'ai_agent': 'livekit-agent',
		'version': '1.0',
		'conversation_transcript': transcript,
		'transcript_text': transcript_text,
		'message_count': len(transcript),
		'tool_calls_made': tool_calls_made,
		'tool_count': len(tool_calls_made),
		'prompt_version': prompt_version,
		'platform': 'livekit',
		'template_id': phone_config.get('template_id'),
		'template_name': phone_config.get('template_name'),
	}
	
	# Build interaction record
	interaction_data = {
		'lead_id': session_data.get('lead_id'),
		'broker_id': session_data.get('broker_id'),
		'type': 'ai_call',
		'direction': session_data.get('direction', 'inbound'),
		'content': f"Call completed - {session_data.get('duration_seconds', 0)}s",
		'duration_seconds': session_data.get('duration_seconds'),
		'outcome': session_data.get('outcome', 'neutral'),
		'transcript_text': transcript_text,
		'transcript': {'conversation_transcript': transcript},
		'metadata': metadata,
		'stt_provider': phone_config.get('stt_provider'),
		'tts_provider': phone_config.get('tts_provider'),
		'llm_provider': phone_config.get('llm_provider'),
		'estimated_cost': cost,
	}
	
	# Add recording metadata if provided
	if recording_meta:
		interaction_data.update({
			'recording_provider': recording_meta.get('provider', 'livekit-egress'),
			'recording_storage': recording_meta.get('storage'),
			'recording_bucket': recording_meta.get('bucket'),
			'recording_object_path': recording_meta.get('object_path'),
			'recording_mime_type': recording_meta.get('mime_type', 'audio/ogg'),
			'recording_duration_seconds': recording_meta.get('duration_seconds'),
			'recording_size_bytes': recording_meta.get('size_bytes'),
		})
	
	response = supabase.table('interactions')\
		.insert(interaction_data)\
		.select('id')\
		.execute()
	
	if response.data and len(response.data) > 0:
		interaction_id = response.data[0]['id']
		logger.info(f"✅ Saved interaction: {interaction_id}")
		return interaction_id
	
	raise Exception("Failed to save interaction")

def normalize_phone(phone: str) -> str:
	"""Normalize phone number to last 10 digits"""
	digits = ''.join(filter(str.isdigit, phone))
	return digits[-10:] if len(digits) >= 10 else digits


