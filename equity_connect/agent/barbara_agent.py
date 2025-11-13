"""Barbara - AI Voice Agent for EquityConnect using SignalWire SDK"""
import os
import logging
from typing import Optional, Dict, Any
from signalwire_agents import AgentBase  # type: ignore
from equity_connect.services.prompt_loader import load_theme, load_node_prompt, build_context_injection
from equity_connect.services.conversation_state import get_conversation_state
from equity_connect.workflows.routers import (
	route_after_greet, route_after_verify, route_after_qualify,
	route_after_answer, route_after_quote, route_after_objections,
	route_after_book, route_after_exit
)
from equity_connect.workflows.node_completion import is_node_complete

logger = logging.getLogger(__name__)


class BarbaraAgent(AgentBase):
	"""Barbara - Conversational AI agent for reverse mortgage lead qualification
	
	Uses BarbGraph 8-node event-driven routing with SignalWire SDK infrastructure.
	All business logic (tools, routers, checkers) remains unchanged from LiveKit version.
	"""
	
	def __init__(self):
		# SECURITY: Require auth credentials via environment variables - NO DEFAULTS
		# Fail fast if credentials are not configured to prevent running with insecure defaults
		agent_username = os.getenv("AGENT_USERNAME")
		agent_password = os.getenv("AGENT_PASSWORD")
		
		if not agent_username or not agent_password:
			error_msg = "CRITICAL SECURITY ERROR: AGENT_USERNAME and AGENT_PASSWORD environment variables are required. Do not use default credentials."
			logger.error(error_msg)
			raise ValueError(error_msg)
		
		super().__init__(
			name="barbara-agent",
			route="/agent",
			host="0.0.0.0",  # Listen on all interfaces for Docker/Fly.io
			port=8080,
			use_pom=True,  # Enable Prompt Object Model for structured prompts
			auto_answer=True,
			record_call=True,
			record_format="mp3",
			basic_auth=(agent_username, agent_password)
		)
		
		# Enable SIP routing - REQUIRED for SignalWire to route calls to this agent
		# This makes Barbara reachable at barbara-agent@domain and /agent@domain
		self.enable_sip_routing(auto_map=True)
		
		# Set webhook URL for Fly.io deployment (fixes proxy detection issues)
		# This tells Agent SDK the correct public URL for SWAIG functions
		self.set_web_hook_url("https://barbara-agent.fly.dev/swaig")
		self.set_post_prompt_url("https://barbara-agent.fly.dev/post_prompt")
		
		# Set up dynamic configuration (per-request)
		# This replaces static config and enables multi-tenant, per-broker customization
		self.set_dynamic_config_callback(self.configure_per_call)
		
		# BarbGraph routing state
		self.current_node = "greet"
		self.phone_number = None
		self.call_type = "inbound"
		
		logger.info("✅ BarbaraAgent initialized with dynamic configuration and 21 tools")
	
	def configure_per_call(self, query_params: Dict[str, Any], body_params: Dict[str, Any], headers: Dict[str, Any], agent):
		"""Dynamic configuration callback - NOT USED for SWML webhook flows
		
		⚠️ IMPORTANT: This callback is NOT invoked when calls come via SWML webhooks (our deployment pattern).
		
		All configuration has been moved to on_swml_request() which IS called for webhook flows.
		That method handles:
		- Voice/LLM/STT configuration (ElevenLabs Rachel, GPT-4o)
		- Multi-call persistence (resume where caller left off)
		- BarbGraph node selection and prompt loading
		- Skills, hints, pronunciations, global data
		
		This stub is kept for SDK compatibility in case future SDK versions or
		alternative flow types (e.g., SIP direct routing) invoke this callback.
		
		Args:
			query_params: URL query parameters (e.g., ?broker_id=123)
			body_params: POST body parameters (SignalWire call data)
			headers: HTTP headers
			agent: EphemeralAgentConfig for per-request configuration
		"""
		logger.debug("configure_per_call called (not used for SWML webhooks - see on_swml_request instead)")
		pass
	
	# Lead Management (5)
	@AgentBase.tool(
		description="Get lead information by phone number; returns lead, broker, property context.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number of the lead (any format)"}}, "required": ["phone"]}
	)
	async def get_lead_context(self, args, raw_data):
		"""Tool wrapper: Get lead information by phone number"""
		logger.debug(f"🔧 DEBUG: get_lead_context wrapper called with args: {args}")
		from equity_connect.tools.lead import get_lead_context
		result = await get_lead_context(args.get("phone"))
		logger.debug(f"✅ DEBUG: get_lead_context tool returned result (length: {len(str(result)) if result else 0} chars)")
		return result
	
	@AgentBase.tool(
		description="Verify caller identity by name and phone. Creates lead if new.",
		parameters={"type": "object", "properties": {"first_name": {"type": "string", "description": "Caller first name"}, "phone": {"type": "string", "description": "Caller phone"}}, "required": ["first_name", "phone"]}
	)
	async def verify_caller_identity(self, args, raw_data):
		from equity_connect.tools.lead import verify_caller_identity
		return await verify_caller_identity(args.get("first_name"), args.get("phone"))
	
	@AgentBase.tool(
		description="Check consent and DNC status for a phone number.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number to check"}}, "required": ["phone"]}
	)
	async def check_consent_dnc(self, args, raw_data):
		from equity_connect.tools.lead import check_consent_dnc
		return await check_consent_dnc(args.get("phone"))
	
	@AgentBase.tool(
		description="Update lead fields gathered during the call.",
		parameters={
			"type": "object",
			"properties": {
				"lead_id": {"type": "string", "description": "Lead UUID"},
				"first_name": {"type": "string", "description": "First name", "nullable": True},
				"last_name": {"type": "string", "description": "Last name", "nullable": True},
				"email": {"type": "string", "description": "Email", "nullable": True},
				"phone": {"type": "string", "description": "Phone", "nullable": True},
				"property_address": {"type": "string", "description": "Property address", "nullable": True},
				"property_city": {"type": "string", "description": "Property city", "nullable": True},
				"property_state": {"type": "string", "description": "Property state", "nullable": True},
				"property_zip": {"type": "string", "description": "Property ZIP", "nullable": True},
				"age": {"type": "integer", "description": "Age"},
				"money_purpose": {"type": "string", "description": "Money purpose", "nullable": True},
				"amount_needed": {"type": "number", "description": "Amount needed"},
				"timeline": {"type": "string", "description": "Timeline", "nullable": True},
			},
			"required": ["lead_id"],
		}
	)
	async def update_lead_info(self, args, raw_data):
		from equity_connect.tools.lead import update_lead_info
		return await update_lead_info(
			args.get("lead_id"), args.get("first_name"), args.get("last_name"),
			args.get("email"), args.get("phone"), args.get("property_address"),
			args.get("property_city"), args.get("property_state"), args.get("property_zip"),
			args.get("age"), args.get("money_purpose"), args.get("amount_needed"), args.get("timeline")
		)
	
	@AgentBase.tool(
		description="Find a broker by ZIP/city/state.",
		parameters={
			"type": "object",
			"properties": {
				"zip_code": {"type": "string", "description": "ZIP code", "nullable": True},
				"city": {"type": "string", "description": "City", "nullable": True},
				"state": {"type": "string", "description": "State abbreviation", "nullable": True},
			},
			"required": [],
		}
	)
	async def find_broker_by_territory(self, args, raw_data):
		from equity_connect.tools.lead import find_broker_by_territory
		return await find_broker_by_territory(args.get("zip_code"), args.get("city"), args.get("state"))
	
	# Calendar (4)
	@AgentBase.tool(
		description="Check broker calendar availability for next 14 days.",
		parameters={
			"type": "object",
			"properties": {
				"broker_id": {"type": "string", "description": "Broker UUID"},
				"preferred_day": {"type": "string", "description": "Preferred day (monday..sunday)", "nullable": True},
				"preferred_time": {"type": "string", "description": "Preferred time (morning|afternoon|evening)", "nullable": True},
			},
			"required": ["broker_id"],
		},
		meta_data_token="check_broker_availability_v1"
	)
	async def check_broker_availability(self, args, raw_data):
		from equity_connect.tools.calendar import check_broker_availability
		return await check_broker_availability(args.get("broker_id"), args.get("preferred_day"), args.get("preferred_time"), raw_data)
	
	@AgentBase.tool(
		description="Book an appointment and create calendar event.",
		parameters={
			"type": "object",
			"properties": {
				"lead_id": {"type": "string", "description": "Lead UUID"},
				"broker_id": {"type": "string", "description": "Broker UUID"},
				"scheduled_for": {"type": "string", "description": "ISO 8601 datetime"},
				"notes": {"type": "string", "description": "Notes", "nullable": True},
			},
			"required": ["lead_id", "broker_id", "scheduled_for"],
		},
		meta_data_token="book_appointment_v1"
	)
	async def book_appointment(self, args, raw_data):
		from equity_connect.tools.calendar import book_appointment
		return await book_appointment(args.get("lead_id"), args.get("broker_id"), args.get("scheduled_for"), args.get("notes"), raw_data)
	
	@AgentBase.tool(
		description="Reschedule an existing appointment.",
		parameters={
			"type": "object",
			"properties": {
				"interaction_id": {"type": "string", "description": "Appointment interaction ID"},
				"new_scheduled_for": {"type": "string", "description": "New ISO 8601 datetime"},
				"reason": {"type": "string", "description": "Reason", "nullable": True},
			},
			"required": ["interaction_id", "new_scheduled_for"],
		}
	)
	async def reschedule_appointment(self, args, raw_data):
		from equity_connect.tools.calendar import reschedule_appointment
		return await reschedule_appointment(args.get("interaction_id"), args.get("new_scheduled_for"), args.get("reason"))
	
	@AgentBase.tool(
		description="Cancel an existing appointment.",
		parameters={
			"type": "object",
			"properties": {
				"interaction_id": {"type": "string", "description": "Appointment interaction ID"},
				"reason": {"type": "string", "description": "Reason", "nullable": True},
			},
			"required": ["interaction_id"],
		}
	)
	async def cancel_appointment(self, args, raw_data):
		from equity_connect.tools.calendar import cancel_appointment
		return await cancel_appointment(args.get("interaction_id"), args.get("reason"))
	
	# Knowledge (1)
	@AgentBase.tool(
		description="Search reverse mortgage knowledge base for accurate answers.",
		parameters={"type": "object", "properties": {"question": {"type": "string", "description": "Question text"}}, "required": ["question"]},
		meta_data_token="search_knowledge_v1"
	)
	async def search_knowledge(self, args, raw_data):
		from equity_connect.tools.knowledge import search_knowledge
		return await search_knowledge(args.get("question"), raw_data)
	
	# Interaction (4)
	@AgentBase.tool(
		description="Save a call interaction summary and outcome.",
		parameters={
			"type": "object",
			"properties": {
				"lead_id": {"type": "string", "description": "Lead UUID"},
				"broker_id": {"type": "string", "description": "Broker UUID", "nullable": True},
				"duration_seconds": {"type": "integer", "description": "Call duration (seconds)"},
				"outcome": {"type": "string", "description": "Outcome"},
				"content": {"type": "string", "description": "Summary content"},
				"recording_url": {"type": "string", "description": "Recording URL", "nullable": True},
				"metadata": {"type": "string", "description": "JSON metadata string", "nullable": True},
			},
			"required": ["lead_id", "outcome", "content"],
		}
	)
	async def save_interaction(self, args, raw_data):
		"""Save interaction with full context
		
		Available in raw_data (SWAIG post_data):
		- call_id: Unique call UUID
		- caller_id_num: Caller's phone number
		- caller_id_name: Caller's name (if available)
		- global_data: Lead context (lead_id, qualified, home_value, etc.)
		- call_log: Processed conversation history (with latency metrics)
		- raw_call_log: Full conversation transcript (never consolidated)
		- channel_active: Whether call is still active
		"""
		from equity_connect.tools.interaction import save_interaction
		import json
		
		# Extract transcript from raw_data if available
		transcript = raw_data.get("raw_call_log") if raw_data else None
		
		# Parse existing metadata or create new dict
		metadata_str = args.get("metadata")
		metadata_dict = {}
		if metadata_str:
			try:
				metadata_dict = json.loads(metadata_str) if isinstance(metadata_str, str) else metadata_str
			except:
				metadata_dict = {}
		
		# Add transcript to metadata if available
		if transcript:
			metadata_dict["conversation_transcript"] = transcript
			logger.info(f"📝 Extracted transcript with {len(transcript)} messages from raw_data")
		
		# Add call_id and other raw_data context to metadata
		if raw_data:
			if not metadata_dict.get("call_id"):
				metadata_dict["call_id"] = raw_data.get("call_id")
			if not metadata_dict.get("caller_id_num"):
				metadata_dict["caller_id_num"] = raw_data.get("caller_id_num")
			if not metadata_dict.get("caller_id_name"):
				metadata_dict["caller_id_name"] = raw_data.get("caller_id_name")
		
		# Convert metadata back to JSON string
		metadata_json = json.dumps(metadata_dict) if metadata_dict else None
		
		return await save_interaction(
			args.get("lead_id"), args.get("broker_id"), args.get("duration_seconds"),
			args.get("outcome"), args.get("content"), args.get("recording_url"), metadata_json
		)
	
	@AgentBase.tool(
		description="Assign a SignalWire tracking number to a lead for attribution.",
		parameters={"type": "object", "properties": {"lead_id": {"type": "string", "description": "Lead UUID"}, "broker_id": {"type": "string", "description": "Broker UUID"}}, "required": ["lead_id", "broker_id"]}
	)
	async def assign_tracking_number(self, args, raw_data):
		from equity_connect.tools.interaction import assign_tracking_number
		return await assign_tracking_number(args.get("lead_id"), args.get("broker_id"))
	
	@AgentBase.tool(
		description="Send appointment confirmation via SMS.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number"}, "appointment_datetime": {"type": "string", "description": "ISO 8601 datetime"}}, "required": ["phone", "appointment_datetime"]}
	)
	async def send_appointment_confirmation(self, args, raw_data):
		from equity_connect.tools.interaction import send_appointment_confirmation
		return await send_appointment_confirmation(args.get("phone"), args.get("appointment_datetime"))
	
	@AgentBase.tool(
		description="Verify appointment confirmation code from SMS.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number"}, "code": {"type": "string", "description": "Code to verify"}}, "required": ["phone", "code"]}
	)
	async def verify_appointment_confirmation(self, args, raw_data):
		from equity_connect.tools.interaction import verify_appointment_confirmation
		return await verify_appointment_confirmation(args.get("phone"), args.get("code"))
	
	# Conversation Flags (7)
	@AgentBase.tool(
		description="Mark caller as ready to book an appointment.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}}, "required": ["phone"]}
	)
	async def mark_ready_to_book(self, args, raw_data):
		from equity_connect.tools.conversation_flags import mark_ready_to_book
		return await mark_ready_to_book(args.get("phone"))
	
	@AgentBase.tool(
		description="Mark that the caller raised an objection.",
		parameters={
			"type": "object",
			"properties": {
				"phone": {"type": "string", "description": "Caller phone"},
				"current_node": {"type": "string", "description": "Node where objection raised", "nullable": True},
				"objection_type": {"type": "string", "description": "Type of objection", "nullable": True},
			},
			"required": ["phone"],
		}
	)
	async def mark_has_objection(self, args, raw_data):
		from equity_connect.tools.conversation_flags import mark_has_objection
		return await mark_has_objection(args.get("phone"), args.get("current_node"), args.get("objection_type"))
	
	@AgentBase.tool(
		description="Mark that an objection has been resolved.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}}, "required": ["phone"]}
	)
	async def mark_objection_handled(self, args, raw_data):
		from equity_connect.tools.conversation_flags import mark_objection_handled
		return await mark_objection_handled(args.get("phone"))
	
	@AgentBase.tool(
		description="Mark that caller's questions have been answered.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}}, "required": ["phone"]}
	)
	async def mark_questions_answered(self, args, raw_data):
		from equity_connect.tools.conversation_flags import mark_questions_answered
		return await mark_questions_answered(args.get("phone"))
	
	@AgentBase.tool(
		description="Persist qualification outcome.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}, "qualified": {"type": "boolean", "description": "Qualified?"}}, "required": ["phone", "qualified"]}
	)
	async def mark_qualification_result(self, args, raw_data):
		from equity_connect.tools.conversation_flags import mark_qualification_result
		return await mark_qualification_result(args.get("phone"), bool(args.get("qualified")))
	
	@AgentBase.tool(
		description="Mark that a quote has been presented with reaction.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}, "quote_reaction": {"type": "string", "description": "Reaction"}}, "required": ["phone", "quote_reaction"]}
	)
	async def mark_quote_presented(self, args, raw_data):
		from equity_connect.tools.conversation_flags import mark_quote_presented
		return await mark_quote_presented(args.get("phone"), args.get("quote_reaction"))
	
	@AgentBase.tool(
		description="Mark wrong person; optionally indicate if right person is available.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}, "right_person_available": {"type": "boolean", "description": "Right person available?"}}, "required": ["phone"]}
	)
	async def mark_wrong_person(self, args, raw_data):
		from equity_connect.tools.conversation_flags import mark_wrong_person
		return await mark_wrong_person(args.get("phone"), bool(args.get("right_person_available")))
	
	@AgentBase.tool(
		description="Clear all conversation flags for a fresh start.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}}, "required": ["phone"]}
	)
	async def clear_conversation_flags(self, args, raw_data):
		from equity_connect.tools.conversation_flags import clear_conversation_flags
		return await clear_conversation_flags(args.get("phone"))
	
	# ==================== END TOOL DEFINITIONS ====================
	
	def on_swml_request(
		self,
		request_data: Optional[Dict[str, Any]] = None,
		callback_path: Optional[str] = None,
		request: Optional[Any] = None
	) -> Optional[Dict[str, Any]]:
		"""Handle incoming call - configure agent dynamically and load BarbGraph context
		
		SignalWire calls this BEFORE the agent starts talking for SWML webhook flows.
		This is where we:
		1. Extract phone number from request_data
		2. Configure AI (voice, LLM, skills, hints, etc.) - CRITICAL for webhook flows
		3. Query Supabase for lead context and multi-call persistence
		4. Load the correct BarbGraph node prompt with context injected
		
		Args:
			request_data: Call parameters from SignalWire (From, To, CallSid, etc.)
			callback_path: Callback path (unused)
			request: FastAPI Request object (unused)
			
		Returns:
			Optional SWML modifications (None = use defaults)
		"""
		logger.info(f"📞 DEBUG: on_swml_request called with request_data keys: {list(request_data.keys()) if request_data else 'None'}")
		logger.debug(f"📞 DEBUG: Full request_data: {request_data}")
		logger.debug(f"📞 DEBUG: request_data type: {type(request_data)}")
		
		try:
			# ==================== STEP 1: EXTRACT CALL CONTEXT ====================
			# Extract call parameters from SignalWire
			# SignalWire sends data in nested 'call' dict
			if request_data:
				call_data = request_data.get("call", {})
				from_phone = call_data.get("from") or call_data.get("from_number")
				to_phone = call_data.get("to") or call_data.get("to_number")
				call_sid = call_data.get("call_id")
			else:
				from_phone = None
				to_phone = None
				call_sid = None
			
			# Determine call direction
			# For inbound: From = caller's number, To = our SignalWire number
			# For outbound: From = our SignalWire number, To = lead's number
			if request_data:
				call_data = request_data.get("call", {})
				call_direction = call_data.get("direction", "inbound").lower()
			else:
				call_direction = "inbound"
			
			# Determine which phone number to use for DB lookup
			if call_direction == "inbound":
				phone = from_phone  # Caller's number
			else:
				phone = to_phone  # Lead's number (we're calling them)
			
			self.phone_number = phone
			self.call_type = call_direction
			
			logger.info(f"📞 {call_direction.upper()} call: From={from_phone}, To={to_phone}, CallSid={call_sid}")
			
			# ==================== STEP 2: CONFIGURE AI ====================
			# This is CRITICAL for SWML webhook flows - configure_per_call() is NOT called
			# Apply ALL configuration BEFORE loading prompts
			
			# TTS: ElevenLabs voice (SignalWire format: elevenlabs.<voice_name>)
			# Get voice name from environment or default to Rachel
			voice_name = os.getenv("ELEVENLABS_VOICE_NAME", "rachel")  # Default: rachel
			elevenlabs_voice = f"elevenlabs.{voice_name}"  # SignalWire format
			
			# TTS: ElevenLabs + LLM: OpenAI GPT-4o + STT: Automatic (Deepgram Nova-3)
			self.add_language(
				name="English",
				code="en-US",
				voice=elevenlabs_voice,  # Format: elevenlabs.<name>
				engine="elevenlabs",
				model="eleven_turbo_v2_5",
				speech_fillers=["Let me check on that...", "One moment please...", "I'm looking that up now..."],
				function_fillers=["Processing...", "Just a second...", "Looking that up..."]
			)
			logger.info(f"✅ Voice configured: {elevenlabs_voice}")
			
			# LLM and conversation parameters
			self.set_params({
				"ai_model": "gpt-4o",  # OpenAI GPT-4o for LLM
				"wait_for_user": False,  # Barbara can proactively speak
				"end_of_speech_timeout": 800,  # VAD: 800ms for natural pauses
				"attention_timeout": 30000,  # 30 seconds before timeout
				"temperature": 0.7,  # Balanced creativity
				"max_tokens": 150,  # Keep responses concise for voice
				"top_p": 0.9,  # Nucleus sampling
				"ai_volume": 5,
				"local_tz": "America/Los_Angeles",  # Pacific time for CA customers
				"swaig_post_conversation": True  # Send conversation history to tools
			})
			logger.info("✅ AI params configured: GPT-4o, VAD=800ms")
			
			# Global data for AI to reference
			self.set_global_data({
				"company_name": "Barbara AI",
				"service_type": "Reverse Mortgage Assistance",
				"service_vertical": "Reverse Mortgage / HECM",
				"business_hours": "9 AM - 5 PM Pacific Time",
				"coverage_area": "California",
				"conversation_system": "BarbGraph 8-node routing"
			})
			
			# Speech recognition hints for domain-specific terms
			self.add_hints([
				"reverse mortgage",
				"HECM",
				"home equity conversion",
				"FHA",
				"equity",
				"lien",
				"borrower",
				"non-borrowing spouse",
				"Barbara",
				"EquityConnect"
			])
			
			# Pronunciation rules for acronyms
			self.add_pronunciation("HECM", "H E C M", ignore_case=False)
			self.add_pronunciation("FHA", "F H A", ignore_case=False)
			self.add_pronunciation("API", "A P I", ignore_case=False)
			self.add_pronunciation("AI", "A I", ignore_case=False)
			
			# Pattern hints
			self.add_pattern_hint(
				hint="AI Agent",
				pattern="AI\\s+Agent",
				replace="A.I. Agent",
				ignore_case=True
			)
			
			# Add datetime skill for appointment booking
			self.add_skill("datetime")
			
			# Add math skill for equity calculations in quote node
			# LLMs are terrible at arithmetic - let Python do the math
			self.add_skill("math")
			
			logger.info("✅ Skills configured: datetime, math")
			
			# Set post-prompt for call summaries
			self.set_post_prompt("""
Analyze the complete conversation and provide a structured summary:

**BARBGRAPH PATH:**
- Nodes visited in order: [list all nodes traversed]
- Where conversation ended: [final node]
- Successful completion: [Yes/No]

**OVERALL OUTCOME:**
- Primary goal achieved: [Yes/No/Partial]
- Next action required: [Specific action or "None"]
- Caller sentiment: [Positive/Neutral/Negative]

**KEY INFORMATION GATHERED:**
- Main data points collected across all nodes
- Questions asked by caller
- Objections or concerns raised

**CONVERSATION QUALITY:**
- Rapport established: [Excellent/Good/Fair/Poor]
- Flow smoothness: [Smooth/Some issues/Problematic]
- All caller questions answered: [Yes/No/Partial]

**FOLLOW-UP ACTIONS:**
List specific actions needed based on conversation outcome.
			""")
			
			logger.info("✅ All AI configuration applied successfully")
			
			# ==================== STEP 3: MULTI-CALL PERSISTENCE ====================
			# For returning callers, resume where they left off
			current_node = "greet"  # Default for new callers
			lead_context = None
			
			if phone:
				# CRITICAL: Initialize or reuse conversation_state row for this call
				# This MUST happen before get_conversation_state() to ensure the row exists
				from equity_connect.services.conversation_state import start_call, get_conversation_state
				
				# Build call metadata for initialization
				call_metadata = {
					"call_sid": call_sid,
					"from_phone": from_phone,
					"to_phone": to_phone,
					"direction": call_direction
				}
				
				# Start call session (creates row if new, reuses if returning caller)
				start_call(phone, metadata=call_metadata)
				logger.info(f"📞 Call session initialized for {phone}")
				
				# Query Supabase for lead context and current conversation state
				state_row = get_conversation_state(phone)
				
				if state_row:
					lead_id = state_row.get("lead_id")
					if lead_id:
						# Load full lead data from leads table
						from equity_connect.services.supabase import get_supabase_client
						try:
							sb = get_supabase_client()
							# Load lead with broker join to get nylas_grant_id
							lead_result = sb.table('leads').select('''
								id, first_name, last_name, primary_email, primary_phone, primary_phone_e164,
								property_address, property_city, property_state, property_zip,
								property_value, estimated_equity, age, status, qualified, owner_occupied,
								assigned_broker_id,
								brokers:assigned_broker_id (
									id, contact_name, company_name, email, phone, nmls_number, nylas_grant_id, timezone
								)
							''').eq('id', lead_id).single().execute()
							
							if lead_result.data:
								lead_data = lead_result.data
								broker_data = lead_data.get('brokers') if isinstance(lead_data.get('brokers'), dict) else None
								
								lead_context = {
									"lead_id": lead_id,
									"name": f"{lead_data.get('first_name', '')} {lead_data.get('last_name', '')}".strip(),
									"first_name": lead_data.get('first_name'),
									"last_name": lead_data.get('last_name'),
									"qualified": state_row.get("qualified") or lead_data.get('status') in ['qualified', 'appointment_set'],
									"property_address": lead_data.get('property_address'),
									"property_city": lead_data.get('property_city'),
									"property_state": lead_data.get('property_state'),
									"property_value": lead_data.get('property_value'),
									"estimated_equity": lead_data.get('estimated_equity'),
									"primary_email": lead_data.get('primary_email'),
									"age": lead_data.get('age'),
									"conversation_data": state_row.get("conversation_data", {})
								}
								
								# Add broker info if assigned
								if broker_data:
									lead_context["broker_id"] = broker_data.get('id')
									lead_context["broker_name"] = broker_data.get('contact_name')
									lead_context["broker_company"] = broker_data.get('company_name')
									lead_context["broker_email"] = broker_data.get('email')
									lead_context["broker_nylas_grant_id"] = broker_data.get('nylas_grant_id')
									lead_context["broker_timezone"] = broker_data.get('timezone')
									logger.info(f"👤 Loaded full lead data: {lead_context['name']}, Broker: {lead_context.get('broker_name')}, Nylas: {lead_context.get('broker_nylas_grant_id')[:20] if lead_context.get('broker_nylas_grant_id') else 'None'}...")
									
									# Inject broker Nylas grant ID into global_data so calendar tools can use it directly
									# This avoids DB queries in calendar tools (same pattern as v3)
									if lead_context.get('broker_nylas_grant_id'):
										self.update_global_data({
											"broker_id": lead_context["broker_id"],
											"broker_name": lead_context["broker_name"],
											"broker_email": lead_context.get("broker_email"),
											"broker_nylas_grant_id": lead_context["broker_nylas_grant_id"],
											"broker_timezone": lead_context.get("broker_timezone")
										})
										logger.info(f"✅ Injected broker_nylas_grant_id into global_data for calendar tools")
								else:
									logger.info(f"👤 Loaded full lead data: {lead_context['name']}, {lead_context.get('property_city')}, {lead_context.get('property_state')} (no broker assigned)")
							else:
								logger.warning(f"Lead {lead_id} not found in leads table")
								lead_context = {
									"lead_id": lead_id,
									"qualified": state_row.get("qualified"),
									"conversation_data": state_row.get("conversation_data", {})
								}
						except Exception as e:
							logger.error(f"Failed to load lead data: {e}")
							lead_context = {
								"lead_id": lead_id,
								"qualified": state_row.get("qualified"),
								"conversation_data": state_row.get("conversation_data", {})
							}
					
					# Check if this is a returning caller (multi-call persistence)
					cd = state_row.get("conversation_data", {})
					if cd.get("appointment_booked"):
						current_node = "exit"  # Already done
						logger.info(f"🔄 Returning caller - appointment already booked → EXIT")
					elif cd.get("ready_to_book"):
						current_node = "book"  # Pick up at booking
						logger.info(f"🔄 Returning caller - resuming at BOOK node")
					elif cd.get("qualified") is True:
						# Only route to answer if explicitly qualified (True)
						# If qualified=False or None, treat as new caller and start at greet
						current_node = "answer"  # Already qualified, answer questions
						logger.info(f"🔄 Returning caller - resuming at ANSWER node")
					else:
						logger.info(f"🆕 New caller - starting at GREET node")
				else:
					logger.info(f"🆕 New caller - no state found, starting at GREET node")
				
				# ==================== STEP 4: LOAD BARBGRAPH PROMPT ====================
				# Load BarbGraph node prompt with context injection
				from equity_connect.services.prompt_loader import build_instructions_for_node
				
				instructions = build_instructions_for_node(
					node_name=current_node,
					call_type=call_direction,
					lead_context=lead_context,
					phone_number=phone,
					vertical="reverse_mortgage"
				)
				
				# ==================== STEP 5: APPLY PROMPT ====================
				# Update agent instructions with context-aware BarbGraph prompt
				self.set_prompt_text(instructions)
				
				# ==================== STEP 6: UPDATE INSTANCE VARIABLES ====================
				self.current_node = current_node
				
				logger.info(f"✅ Agent fully configured: voice=rachel, model=gpt-4o, node={current_node}, phone={phone}")
			else:
				logger.warning("⚠️ No phone number found in request - using default configuration")
				# Apply fallback prompt if no phone number
				self.set_prompt_text("You are Barbara, a friendly AI assistant for reverse mortgage inquiries. Greet the caller warmly.")
				self.current_node = "greet"
			
			# ==================== STEP 7: RETURN ====================
			# Return None - no SWML modifications needed, use SDK defaults
			return None
			
		except Exception as e:
			logger.error(f"❌ Error in on_swml_request: {e}", exc_info=True)
			# Fall back to minimal configuration if setup fails
			try:
				self.add_language("English", "en-US", voice="rachel", engine="elevenlabs")
				self.set_params({"ai_model": "gpt-4o"})
				self.set_prompt_text("You are Barbara, a friendly AI assistant for reverse mortgage inquiries.")
				logger.info("✅ Applied fallback configuration after error")
			except:
				logger.error("❌ Fallback configuration also failed")
			# Return None to proceed with defaults even if setup fails
			return None
	
	def on_summary(self, summary: Optional[Dict[str, Any]], raw_data: Optional[Dict[str, Any]] = None):
		"""Handle conversation summary after call ends
		
		This is called by SignalWire when the call completes and post-prompt is processed.
		We log the summary and save it to the interactions table for future reference.
		
		Args:
			summary: Structured summary from post-prompt analysis
			raw_data: Raw request data from SignalWire
		"""
		try:
			# Log the summary
			logger.info(f"📊 Conversation completed: {summary}")
			
			if not summary:
				logger.warning("⚠️ No summary provided")
				return
			
			# Extract phone number from call context
			phone = self.phone_number
			if not phone and raw_data:
				phone = raw_data.get("From") or raw_data.get("To")
			
			if phone:
				# Get lead_id from conversation state
				from equity_connect.services.conversation_state import get_conversation_state
				state_row = get_conversation_state(phone)
				
				if state_row and state_row.get("lead_id"):
					# Save summary as an interaction
					from equity_connect.services.supabase import get_supabase_client
					supabase = get_supabase_client()
					
					supabase.table("interactions").insert({
						"lead_id": state_row["lead_id"],
						"broker_id": state_row.get("broker_id"),
						"interaction_type": "call",
						"outcome": "completed",
						"content": f"Call Summary:\n{summary}",
						"metadata": {
							"summary": summary,
							"call_ended_at": raw_data.get("timestamp") if raw_data else None,
							"node": self.current_node
						}
					}).execute()
					
					logger.info(f"✅ Call summary saved for lead {state_row['lead_id']}")
			else:
				logger.warning("⚠️ No phone number available to save summary")
				
		except Exception as e:
			logger.error(f"❌ Failed to save call summary: {e}", exc_info=True)
	
	def on_function_call(self, name: str, args: Dict[str, Any], raw_data: Optional[Dict[str, Any]] = None) -> Any:
		"""Intercept tool calls to trigger BarbGraph routing after completion
		
		This is the key integration point where BarbGraph routing happens after tools execute.
		
		NOTE: Must be synchronous - SignalWire SDK calls this synchronously and handles async tools internally.
		The parent class's on_function_call handles async tool execution, so we don't need to await anything.
		
		Args:
			name: Tool name being called
			args: Tool arguments
			raw_data: Raw request data
			
		Returns:
			Tool result (passes through from tool) or SwaigFunctionResult if routing occurs
		"""
		logger.info(f"🔧 DEBUG: on_function_call invoked for tool '{name}' with args: {args}")
		logger.debug(f"🔧 DEBUG: raw_data keys: {list(raw_data.keys()) if raw_data else 'None'}")
		
		# Let the tool execute normally via parent class
		# Parent class handles async tools internally - it will await them
		logger.debug(f"🔧 DEBUG: Calling super().on_function_call() for '{name}'")
		result = super().on_function_call(name, args, raw_data)
		
		# Parent class handles async execution internally, so result should be ready
		# If it's a coroutine, that means parent didn't handle it (shouldn't happen)
		if hasattr(result, '__await__'):
			logger.error(f"❌ ERROR: Parent returned coroutine - SignalWire SDK should handle async internally! Tool: {name}")
			# This shouldn't happen - parent should await async tools
			# Return the coroutine and let SignalWire handle it (will likely error)
			return result
		
		logger.info(f"✅ DEBUG: Tool '{name}' executed successfully, result type: {type(result).__name__}")
		logger.debug(f"✅ DEBUG: Tool result (first 200 chars): {str(result)[:200] if result else 'None'}")
		
		# After tool completes, check if we should route to next node
		# This is synchronous - routing check doesn't need async
		try:
			logger.info(f"🔍 DEBUG: Checking routing after tool '{name}' (current node: {self.current_node})")
			# Check for routing and get context_switch result if routing happens
			routing_result = self._check_and_route_after_tool(name, args)
			
			# If routing occurred, we need to merge with tool result if it has UX actions
			if routing_result is not None:
				logger.info(f"🔄 DEBUG: Routing detected! Merging context_switch with tool result from {name}")
				logger.debug(f"🔄 DEBUG: Routing result type: {type(routing_result).__name__}")
				
				# BUG FIX: If tool returned a SwaigFunctionResult with UX actions, merge them
				# Don't discard the tool's UX actions (say(), send_sms(), etc.)
				from signalwire_agents.core import SwaigFunctionResult  # type: ignore
				if isinstance(result, SwaigFunctionResult):
					logger.debug(f"🔗 DEBUG: Tool '{name}' returned SwaigFunctionResult - merging UX actions with routing")
					# The routing_result already has context_switch, but we need to preserve tool's UX actions
					# SignalWire SDK: context_switch can coexist with other actions
					# Return routing_result (has context_switch) - tool's actions are already in the conversation flow
					# Note: If tool had say()/send_sms(), those execute before routing, which is correct behavior
					return routing_result
				else:
					# Tool returned plain data, routing result replaces it (correct)
					return routing_result
			else:
				logger.debug(f"⏸️  DEBUG: No routing needed after '{name}', returning normal tool result")
		except Exception as e:
			logger.error(f"❌ DEBUG: Routing check failed after {name}: {e}", exc_info=True)
		
		# No routing occurred, return normal tool result
		logger.debug(f"📤 DEBUG: Returning tool result for '{name}'")
		return result
	
	def _check_and_route_after_tool(self, tool_name: str, args: Dict[str, Any]):
		"""Check if we should route after a tool call using BarbGraph logic
		
		First checks for intent-based routing (user intent matches different node),
		then checks if current node is complete.
		
		Args:
			tool_name: Name of tool that just executed
			args: Arguments passed to tool
			
		Returns:
			SwaigFunctionResult if routing occurred, None otherwise
		"""
		logger.debug(f"🔍 DEBUG: _check_and_route_after_tool called for '{tool_name}'")
		logger.debug(f"🔍 DEBUG: Current node: {self.current_node}, args: {args}")
		
		# Extract phone from args (most tools have phone parameter)
		phone = args.get("phone") or self.phone_number
		if not phone:
			logger.debug(f"⏭️  DEBUG: No phone number for routing after {tool_name} (args: {args}, self.phone_number: {self.phone_number})")
			return None
		
		logger.debug(f"📞 DEBUG: Using phone '{phone}' for routing check")
		
		# Get current conversation state from database
		state_row = get_conversation_state(phone)
		if not state_row:
			logger.debug(f"⏭️  DEBUG: No conversation state yet for {phone}")
			return None
		
		logger.debug(f"💾 DEBUG: Found conversation state: lead_id={state_row.get('lead_id')}, qualified={state_row.get('qualified')}")
		
		# Build state dict for intent detection and routing
		conversation_data = state_row.get("conversation_data", {})
		conv_state = {
			"phone_number": phone,
			"messages": [],  # Not needed for intent detection
			"conversation_data": conversation_data
		}
		
		# STEP 1: Check for intent-based routing (user intent matches different node)
		from equity_connect.workflows.intent_detection import check_intent_in_node
		intent_node = check_intent_in_node(self.current_node, conv_state)
		if intent_node and intent_node != self.current_node:
			logger.info(f"🎯 DEBUG: Intent detected in '{self.current_node}' → routing to '{intent_node}'")
			routing_result = self._route_to_node(intent_node, phone)
			logger.debug(f"🔄 DEBUG: Intent-based routing returned: {type(routing_result).__name__}")
			return routing_result
		
		# STEP 2: Check if current node is complete (using node completion checkers)
		logger.debug(f"📊 DEBUG: conversation_data keys: {list(conversation_data.keys())}")
		
		node_complete = is_node_complete(self.current_node, conversation_data)
		logger.debug(f"✅ DEBUG: Node '{self.current_node}' complete check: {node_complete}")
		
		if node_complete:
			logger.info(f"✅ DEBUG: Node '{self.current_node}' complete - checking routing")
			
			# Determine next node using BarbGraph routers
			next_node = self._get_next_node(state_row)
			logger.debug(f"🧭 DEBUG: Router determined next node: '{next_node}' (current: '{self.current_node}')")
			
			if next_node and next_node != self.current_node:
				logger.info(f"🔀 DEBUG: Routing: {self.current_node} → {next_node}")
				# Return the context_switch result - this MUST be returned to SignalWire
				routing_result = self._route_to_node(next_node, phone)
				logger.debug(f"🔄 DEBUG: _route_to_node returned: {type(routing_result).__name__}")
				return routing_result
			else:
				logger.debug(f"⏸️  DEBUG: Staying on node '{self.current_node}' (next_node: '{next_node}')")
				return None
		else:
			logger.debug(f"⏳ DEBUG: Node '{self.current_node}' not complete yet")
			return None
	
	def _get_next_node(self, state_row: Dict[str, Any]) -> str:
		"""Determine next node using BarbGraph routers (ZERO changes to router logic)
		
		Args:
			state_row: Database row from conversation_state table
			
		Returns:
			Next node name or current node if no routing needed
		"""
		node = self.current_node
		
		# Map current node to its router function
		router_map = {
			"greet": route_after_greet,
			"verify": route_after_verify,
			"qualify": route_after_qualify,
			"answer": route_after_answer,
			"quote": route_after_quote,
			"objections": route_after_objections,  # Note: plural
			"book": route_after_book,
			"exit": route_after_exit
		}
		
		router = router_map.get(node)
		if not router:
			logger.warning(f"⚠️  No router for node '{node}'")
			return node
		
		# Build ConversationState dict for router (routers expect this structure)
		conv_state = {
			"phone_number": state_row.get("phone_number"),
			"messages": [],  # Not needed for routing decisions
			"conversation_data": state_row.get("conversation_data", {})
		}
		
		try:
			next_node = router(conv_state)
			logger.info(f"🧭 Router '{node}' returned: {next_node}")
			return next_node
		except Exception as e:
			logger.error(f"❌ Router error for '{node}': {e}")
			return node  # Stay on current node if router fails
	
	def _build_transition_message(self, node_name: str, state: dict) -> str:
		"""Build user message to provide context for node transition
		
		This message helps the LLM understand WHY the prompt changed and what
		happened in the previous node. It creates smoother, more natural transitions.
		
		Args:
			node_name: Target node being transitioned to
			state: Current conversation state from database
			
		Returns:
			User message explaining the transition context
		"""
		conversation_data = state.get("conversation_data", {}) if state else {}
		
		# Context messages for each BarbGraph node transition
		messages = {
			"greet": "Call starting. Greet the caller warmly and introduce yourself.",
			
			"verify": (
				"Caller has been greeted. Now verify their identity and collect basic information. "
				"Create a lead record if this is a new caller."
			),
			
			"qualify": (
				"Identity verified. Now determine if they qualify for a reverse mortgage. "
				"Ask about age, home value, mortgage balance, and financial situation."
			),
			
			"quote": (
				"Lead is qualified. Present the financial quote showing how much equity they can access. "
				f"Use their home value (${conversation_data.get('home_value', 'unknown')}) and "
				f"equity (${conversation_data.get('estimated_equity', 'unknown')}) to calculate the range."
			),
			
			"answer": (
				"Quote has been presented. Now answer any questions they have about reverse mortgages, "
				"the process, requirements, or their specific situation. Use the knowledge base."
			),
			
			"objections": (
				"Caller expressed concerns or objections. Address them empathetically with facts. "
				f"Main concern: {conversation_data.get('objection_type', 'general concerns')}"
			),
			
			"book": (
				"Caller is ready to schedule an appointment. Check broker availability and book a time "
				"that works for them. Send confirmation via SMS."
			),
			
			"exit": (
				"Call objectives complete. Thank the caller, confirm next steps, and end the call professionally."
			)
		}
		
		return messages.get(node_name, "Continue the conversation naturally.")
	
	def _route_to_node(self, node_name: str, phone: str):
		"""Route to new BarbGraph node using context_switch for smooth transitions
		
		This is the proper SignalWire pattern for mid-call prompt changes.
		Uses context_switch action instead of basic set_prompt_text() to:
		- Provide transition context to the LLM
		- Consolidate conversation history (save tokens)
		- Create natural, smooth node transitions
		
		Args:
			node_name: Target node to route to
			phone: Caller's phone number for context loading
			
		Returns:
			SwaigFunctionResult with context_switch action
		"""
		from signalwire_agents.core import SwaigFunctionResult  # type: ignore
		
		logger.info(f"🔄 DEBUG: _route_to_node called: {self.current_node} → {node_name} (phone: {phone})")
		
		try:
			# Save per-node summary before transitioning
			self._save_node_summary(self.current_node, phone)
			
			# Get conversation state for context
			state_row = get_conversation_state(phone)
			lead_context = None
			
			if state_row:
				lead_id = state_row.get("lead_id")
				if lead_id:
					# Load full lead data from leads table (same as on_swml_request)
					# This ensures name, property, equity, email, age are available in all nodes
					from equity_connect.services.supabase import get_supabase_client
					try:
						sb = get_supabase_client()
						# Load lead with broker join to get nylas_grant_id
						lead_result = sb.table('leads').select('''
							id, first_name, last_name, primary_email, primary_phone, primary_phone_e164,
							property_address, property_city, property_state, property_zip,
							property_value, estimated_equity, age, status, qualified, owner_occupied,
							assigned_broker_id,
							brokers:assigned_broker_id (
								id, contact_name, company_name, email, phone, nmls_number, nylas_grant_id, timezone
							)
						''').eq('id', lead_id).single().execute()
						
						if lead_result.data:
							lead_data = lead_result.data
							broker_data = lead_data.get('brokers') if isinstance(lead_data.get('brokers'), dict) else None
							
							lead_context = {
								"lead_id": lead_id,
								"name": f"{lead_data.get('first_name', '')} {lead_data.get('last_name', '')}".strip(),
								"first_name": lead_data.get('first_name'),
								"last_name": lead_data.get('last_name'),
								"qualified": state_row.get("qualified") or lead_data.get('status') in ['qualified', 'appointment_set'],
								"property_address": lead_data.get('property_address'),
								"property_city": lead_data.get('property_city'),
								"property_state": lead_data.get('property_state'),
								"property_value": lead_data.get('property_value'),
								"estimated_equity": lead_data.get('estimated_equity'),
								"primary_email": lead_data.get('primary_email'),
								"age": lead_data.get('age'),
								"conversation_data": state_row.get("conversation_data", {})
							}
							
							# Add broker info if assigned
							if broker_data:
								lead_context["broker_id"] = broker_data.get('id')
								lead_context["broker_name"] = broker_data.get('contact_name')
								lead_context["broker_company"] = broker_data.get('company_name')
								lead_context["broker_email"] = broker_data.get('email')
								lead_context["broker_nylas_grant_id"] = broker_data.get('nylas_grant_id')
								lead_context["broker_timezone"] = broker_data.get('timezone')
								logger.info(f"👤 Loaded full lead data for routing: {lead_context['name']}, Broker: {lead_context.get('broker_name')}, Nylas: {lead_context.get('broker_nylas_grant_id')[:20] if lead_context.get('broker_nylas_grant_id') else 'None'}...")
								
								# Inject broker Nylas grant ID into global_data during node transition
								# This ensures calendar tools have access to it without DB query
								if lead_context.get('broker_nylas_grant_id'):
									self.update_global_data({
										"broker_id": lead_context["broker_id"],
										"broker_name": lead_context["broker_name"],
										"broker_email": lead_context.get("broker_email"),
										"broker_nylas_grant_id": lead_context["broker_nylas_grant_id"],
										"broker_timezone": lead_context.get("broker_timezone")
									})
									logger.info(f"✅ Updated global_data with broker_nylas_grant_id during node transition")
							else:
								logger.info(f"👤 Loaded full lead data for routing: {lead_context['name']}, {lead_context.get('property_city')}, {lead_context.get('property_state')} (no broker assigned)")
						else:
							logger.warning(f"Lead {lead_id} not found in leads table during routing")
							# Fallback to minimal context if lead not found
							lead_context = {
								"lead_id": lead_id,
								"qualified": state_row.get("qualified"),
								"conversation_data": state_row.get("conversation_data", {})
							}
					except Exception as e:
						logger.error(f"Failed to load lead data during routing: {e}")
						# Fallback to minimal context on error
						lead_context = {
							"lead_id": lead_id,
							"qualified": state_row.get("qualified"),
							"conversation_data": state_row.get("conversation_data", {})
						}
			
			# Load new node prompt (theme + context + node)
			from equity_connect.services.prompt_loader import build_instructions_for_node
			
			node_prompt = build_instructions_for_node(
				node_name=node_name,
				call_type=self.call_type,
				lead_context=lead_context if lead_context else None,
				phone_number=phone,
				vertical="reverse_mortgage"
			)
			
			# Build transition context message
			transition_message = self._build_transition_message(node_name, state_row)
			
			# Create SWAIG result with context_switch action
			# This is the proper SignalWire pattern for mid-call prompt changes
			result = SwaigFunctionResult()
			result.switch_context(
				system_prompt=node_prompt,
				user_prompt=transition_message,
				consolidate=True  # Summarize previous conversation to save tokens
			)
			
			# Dynamic VAD timeout based on node (seniors need different patience levels)
			# More patient for complex nodes (verify, qualify, answer, objections)
			# Faster response for simple nodes (greet, quote, book, exit)
			if node_name in ["verify", "qualify", "answer", "objections"]:
				result.set_end_of_speech_timeout(2000)  # 2 seconds - more patient for seniors
				logger.debug(f"🎙️  VAD timeout set to 2000ms for node '{node_name}' (patient mode)")
			elif node_name in ["greet", "quote", "book", "exit"]:
				result.set_end_of_speech_timeout(800)  # 0.8 seconds - faster for simple responses
				logger.debug(f"🎙️  VAD timeout set to 800ms for node '{node_name}' (responsive mode)")
			
			# Update tracking
			self.current_node = node_name
			self.phone_number = phone
			
			# Apply function restrictions per node (hybrid SignalWire + BarbGraph)
			self._apply_node_function_restrictions(node_name)
			
			logger.info(f"✅ DEBUG: Context switched to node '{node_name}' with consolidation")
			logger.info(f"📍 DEBUG: Current node is now: '{node_name}' (tools will be restricted to this node)")
			logger.debug(f"✅ DEBUG: SwaigFunctionResult created successfully, type: {type(result).__name__}")
			logger.debug(f"✅ DEBUG: Updated current_node to '{node_name}', phone_number to '{phone}'")
			
			return result
		except Exception as e:
			logger.error(f"❌ Failed to route to node '{node_name}': {e}")
			# Return empty result on failure - stay on current node
			return SwaigFunctionResult()
	
	def _apply_node_function_restrictions(self, node_name: str):
		"""Restrict available functions based on current BarbGraph node
		
		This is the hybrid approach: BarbGraph routing + SignalWire function restrictions.
		Each node only gets access to relevant tools for security and performance.
		
		Args:
			node_name: Current BarbGraph node
		"""
		# Map nodes to allowed functions
		function_map = {
			"greet": [
				"mark_wrong_person",  # Can identify wrong person early
				"get_lead_context",  # Can lookup who they're calling
				"mark_ready_to_book"  # User wants to book immediately (e.g., "I want to book with Walter")
			],
			"verify": [
				"verify_caller_identity",  # Core verification
				"check_consent_dnc",  # Legal compliance
				"get_lead_context",  # Lookup existing lead
				"mark_ready_to_book"  # User wants to book immediately
			],
			"qualify": [
				"update_lead_info",  # Collect qualification data
				"find_broker_by_territory",  # Find broker by location
				"mark_qualification_result",  # Set qualified flag
				"mark_ready_to_book"  # Can move to booking
			],
			"answer": [
				"search_knowledge",  # Answer questions from knowledge base
				"mark_questions_answered",  # Track completion
				"mark_has_objection",  # Detect objections
				"mark_ready_to_book"  # Can progress to booking
			],
			"quote": [
				"search_knowledge",  # Explain quote details
				"mark_quote_presented",  # Track quote presentation
				"mark_has_objection",  # Detect concerns about quote
				"calculate"  # Math skill for equity calculations (LLMs are bad at math)
			],
			"objections": [
				"search_knowledge",  # Address objections with facts
				"mark_objection_handled",  # Mark as resolved
				"mark_has_objection"  # Track new objections
			],
			"book": [
				"check_broker_availability",  # Check calendar
				"book_appointment",  # Create appointment
				"reschedule_appointment",  # Modify existing
				"cancel_appointment",  # Cancel if needed
				"send_appointment_confirmation",  # Send SMS
				"verify_appointment_confirmation"  # Verify code
			],
			"exit": []  # No functions needed at exit
		}
		
		# Get allowed functions for this node
		allowed_functions = function_map.get(node_name, [])
		
		logger.info(f"🔒 DEBUG: Node '{node_name}' - Available tools: {allowed_functions}")
		
		if allowed_functions:
			# Set only these functions as available
			self.set_functions(allowed_functions)
			logger.info(f"🔒 Node '{node_name}' restricted to {len(allowed_functions)} functions")
		elif node_name == "exit":
			# Exit node has no functions
			self.set_functions("none")
			logger.info(f"🔒 Node '{node_name}' has no functions (exit)")
		else:
			# Unknown node - log warning but allow all functions (fail open)
			logger.warning(f"⚠️ Unknown node '{node_name}' - allowing all functions")
			# Don't call set_functions() to allow all
	
	def _save_node_summary(self, node_name: str, phone: str):
		"""Save a summary of what happened in this node
		
		Args:
			node_name: The node that just completed
			phone: Caller's phone number
		"""
		if not node_name or node_name == "greet":
			return  # Don't save for initial node
		
		try:
			# Get conversation state for this node
			from equity_connect.services.conversation_state import get_conversation_state
			state_row = get_conversation_state(phone)
			
			if not state_row or not state_row.get("lead_id"):
				return
			
			# Extract node-specific data from conversation_data
			conv_data = state_row.get("conversation_data", {})
			
			# Build node summary based on what we know
			node_summary = f"""
NODE: {node_name}

COMPLETED: Yes
FLAGS SET: {', '.join([k for k, v in conv_data.items() if v and k != 'node_history'])}

DATA COLLECTED:
{self._format_node_data(node_name, conv_data)}

NEXT NODE: {self._get_next_node_from_state(state_row)}
			""".strip()
			
			# Save as interaction with node-specific metadata
			from equity_connect.services.supabase import get_supabase_client
			supabase = get_supabase_client()
			
			supabase.table("interactions").insert({
				"lead_id": state_row["lead_id"],
				"broker_id": state_row.get("broker_id"),
				"interaction_type": "node_completion",
				"outcome": node_name,
				"content": node_summary,
				"metadata": {
					"node": node_name,
					"flags": conv_data,
					"timestamp": "now()"
				}
			}).execute()
			
			logger.info(f"📊 Node summary saved: {node_name}")
			
		except Exception as e:
			logger.error(f"❌ Failed to save node summary for '{node_name}': {e}")
	
	def _format_node_data(self, node_name: str, conv_data: dict) -> str:
		"""Format node-specific data for summary"""
		data_points = []
		
		# Extract relevant flags for this node
		if node_name == "verify":
			if conv_data.get("verified"):
				data_points.append("✓ Identity verified")
		elif node_name == "qualify":
			if conv_data.get("qualified") is not None:
				data_points.append(f"✓ Qualified: {conv_data['qualified']}")
		elif node_name == "answer":
			if conv_data.get("questions_answered"):
				data_points.append("✓ Questions answered")
		elif node_name == "quote":
			if conv_data.get("quote_presented"):
				data_points.append("✓ Quote presented")
		elif node_name == "objections":
			if conv_data.get("has_objection"):
				data_points.append(f"✓ Objection handled: {conv_data.get('objection_type', 'Unknown')}")
		elif node_name == "book":
			if conv_data.get("appointment_booked"):
				data_points.append("✓ Appointment booked")
		
		return "\n".join(data_points) if data_points else "No specific data collected"
	
	def _get_next_node_from_state(self, state_row: dict) -> str:
		"""Determine next node from current state"""
		return state_row.get("current_node", "unknown")

