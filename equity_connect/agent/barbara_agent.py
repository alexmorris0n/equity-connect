"""Barbara - AI Voice Agent for EquityConnect using SignalWire SDK"""
import logging
from typing import Optional, Dict, Any
from signalwire_agents import AgentBase
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
		super().__init__(
			name="barbara-agent",
			route="/agent",
			port=8080,
			auto_answer=True,
			record_call=True,
			record_format="mp3"
		)
		
		# AI Provider Configuration
		# STT: Deepgram Nova-2 (best for real-time voice)
		self.set_stt_engine({
			"engine": "deepgram",
			"model": "nova-2",
			"language": "en-US"
		})
		
		# LLM: OpenAI GPT-4o (fast, supports tool calling)
		self.set_llm_engine({
			"engine": "openai",
			"model": "gpt-4o"
		})
		
		# TTS: ElevenLabs (natural voice, low latency)
		self.set_tts_engine({
			"engine": "elevenlabs",
			"voice": "Rachel",  # Professional female voice
			"model": "eleven_turbo_v2_5"  # Fast model
		})
		
		# Voice configuration
		self.add_language(
			"English", 
			"en-US", 
			code="en-US",
			speech_fillers=["Let me check on that...", "One moment please...", "I'm looking that up now..."],
			function_fillers=["Processing...", "Just a second...", "Looking that up..."]
		)
		
		self.set_params({
			"end_of_speech_timeout": 800,  # 800ms for natural pauses
			"attention_timeout": 30000,  # 30 seconds
			"temperature": 0.7  # Balanced creativity
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
			"non-borrowing spouse"
		])
		
		# BarbGraph routing state
		self.current_node = "greet"
		self.phone_number = None
		
		# Load initial greet node prompt
		self._load_initial_prompt()
		
		logger.info("✅ BarbaraAgent initialized with 21 tools and BarbGraph routing")
	
	# ==================== TOOL DEFINITIONS (21 tools) ====================
	# All tools use @AgentBase.tool decorator for proper async handling
	
	# Lead Management (5)
	@AgentBase.tool(
		description="Get lead information by phone number; returns lead, broker, property context.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number of the lead (any format)"}}, "required": ["phone"]}
	)
	async def get_lead_context(self, args, raw_data):
		from equity_connect.tools.lead import get_lead_context
		return await get_lead_context(args.get("phone"))
	
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
		}
	)
	async def check_broker_availability(self, args, raw_data):
		from equity_connect.tools.calendar import check_broker_availability
		return await check_broker_availability(args.get("broker_id"), args.get("preferred_day"), args.get("preferred_time"))
	
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
		}
	)
	async def book_appointment(self, args, raw_data):
		from equity_connect.tools.calendar import book_appointment
		return await book_appointment(args.get("lead_id"), args.get("broker_id"), args.get("scheduled_for"), args.get("notes"))
	
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
		parameters={"type": "object", "properties": {"question": {"type": "string", "description": "Question text"}}, "required": ["question"]}
	)
	async def search_knowledge(self, args, raw_data):
		from equity_connect.tools.knowledge import search_knowledge
		return await search_knowledge(args.get("question"))
	
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
		from equity_connect.tools.interaction import save_interaction
		return await save_interaction(
			args.get("lead_id"), args.get("broker_id"), args.get("duration_seconds"),
			args.get("outcome"), args.get("content"), args.get("recording_url"), args.get("metadata")
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
	
	def _load_initial_prompt(self):
		"""Load the initial greet node prompt during initialization"""
		try:
			# Use build_instructions_for_node to correctly combine theme + node without duplication
			# No context yet since we don't have call info at initialization
			from equity_connect.services.prompt_loader import build_instructions_for_node
			
			instructions = build_instructions_for_node(
				node_name="greet",
				call_type="outbound",
				lead_context=None,
				phone_number=None,
				vertical="reverse_mortgage"
			)
			
			self.set_prompt_text(instructions)
			logger.info("📝 Loaded initial greet prompt")
		except Exception as e:
			logger.error(f"❌ Failed to load initial prompt: {e}")
			# Fallback prompt
			self.set_prompt_text("You are Barbara, a friendly AI assistant for reverse mortgage inquiries.")
	
	def on_swml_request(
		self,
		request_data: Optional[Dict[str, Any]] = None,
		callback_path: Optional[str] = None,
		request: Optional[Any] = None
	) -> Optional[Dict[str, Any]]:
		"""Handle incoming call - extract phone number and load BarbGraph context
		
		SignalWire calls this BEFORE the agent starts talking.
		This is where we:
		1. Extract phone number from request_data
		2. Query Supabase for lead context
		3. Load the correct BarbGraph node prompt with context injected
		4. Add ring delay to give time for setup
		
		Args:
			request_data: Call parameters from SignalWire (From, To, CallSid, etc.)
			callback_path: Callback path (unused)
			request: FastAPI Request object (unused)
			
		Returns:
			Optional SWML modifications (None = use defaults)
		"""
		try:
			# Extract call parameters from SignalWire
			from_phone = request_data.get("From") if request_data else None
			to_phone = request_data.get("To") if request_data else None
			call_sid = request_data.get("CallSid") if request_data else None
			
			# Determine call direction
			# For inbound: From = caller's number, To = our SignalWire number
			# For outbound: From = our SignalWire number, To = lead's number
			call_direction = request_data.get("Direction", "inbound").lower() if request_data else "inbound"
			
			# Determine which phone number to use for DB lookup
			if call_direction == "inbound":
				phone = from_phone  # Caller's number
			else:
				phone = to_phone  # Lead's number (we're calling them)
			
			self.phone_number = phone
			self.call_type = call_direction
			
			logger.info(f"📞 {call_direction.upper()} call: From={from_phone}, To={to_phone}, CallSid={call_sid}")
			
			if phone:
				# Query Supabase for lead context and current conversation state
				from equity_connect.services.conversation_state import get_conversation_state
				state_row = get_conversation_state(phone)
				
				lead_context = None
				current_node = "greet"  # Default starting node
				
				if state_row:
					lead_id = state_row.get("lead_id")
					if lead_id:
						lead_context = {
							"lead_id": lead_id,
							"qualified": state_row.get("qualified"),
							"conversation_data": state_row.get("conversation_data", {})
						}
						logger.info(f"👤 Found lead context: lead_id={lead_id}")
					
					# Check if this is a returning caller (multi-call persistence)
					last_node = state_row.get("current_node")
					if last_node and last_node != "greet":
						current_node = last_node
						logger.info(f"🔄 Returning caller - resuming at node '{current_node}'")
				
				# Load BarbGraph node prompt with context injection
				from equity_connect.services.prompt_loader import build_instructions_for_node
				
				instructions = build_instructions_for_node(
					node_name=current_node,
					call_type=call_direction,
					lead_context=lead_context,
					phone_number=phone,
					vertical="reverse_mortgage"
				)
				
				# Update agent instructions with context-aware BarbGraph prompt
				self.set_prompt_text(instructions)
				self.current_node = current_node
				
				logger.info(f"✅ Loaded BarbGraph prompt for node '{current_node}' with context for {phone}")
			else:
				logger.warning("⚠️ No phone number found in request - using default greet prompt")
			
			# Return SWML modifications to add ring delay (gives time for DB queries)
			# This simulates natural ring time while we set up the agent
			return {
				"pre_answer_delay": 3000  # 3 second delay before answering (in milliseconds)
			}
			
		except Exception as e:
			logger.error(f"❌ Error in on_swml_request: {e}", exc_info=True)
			# Return None to proceed with defaults even if setup fails
			return None
	
	def on_summary(self, summary: Optional[Dict[str, Any]], raw_data: Optional[Dict[str, Any]] = None):
		"""Called when conversation completes - log final state
		
		Args:
			summary: Conversation summary data from SignalWire
			raw_data: Raw request data
		"""
		logger.info(f"📊 Conversation completed: {summary}")
		# Could save to database via save_interaction tool
		# Could send notifications, update analytics, etc.
	
	async def on_function_call(self, name: str, args: Dict[str, Any], raw_data: Optional[Dict[str, Any]] = None) -> Any:
		"""Intercept tool calls to trigger BarbGraph routing after completion
		
		This is the key integration point where BarbGraph routing happens after tools execute.
		
		Args:
			name: Tool name being called
			args: Tool arguments
			raw_data: Raw request data
			
		Returns:
			Tool result (passes through from tool)
		"""
		# Let the tool execute normally via parent class (await if async)
		result = super().on_function_call(name, args, raw_data)
		
		# If result is a coroutine, await it
		if hasattr(result, '__await__'):
			result = await result
		
		# After tool completes, check if we should route to next node
		try:
			self._check_and_route_after_tool(name, args)
		except Exception as e:
			logger.error(f"❌ Routing check failed after {name}: {e}")
		
		return result
	
	def _check_and_route_after_tool(self, tool_name: str, args: Dict[str, Any]):
		"""Check if we should route after a tool call using BarbGraph logic
		
		Args:
			tool_name: Name of tool that just executed
			args: Arguments passed to tool
		"""
		# Extract phone from args (most tools have phone parameter)
		phone = args.get("phone") or self.phone_number
		if not phone:
			logger.debug(f"⏭️  No phone number for routing after {tool_name}")
			return
		
		# Get current conversation state from database
		state_row = get_conversation_state(phone)
		if not state_row:
			logger.debug(f"⏭️  No conversation state yet for {phone}")
			return
		
		# Check if current node is complete (using node completion checkers)
		conversation_data = state_row.get("conversation_data", {})
		if is_node_complete(self.current_node, conversation_data):
			logger.info(f"✅ Node '{self.current_node}' complete - checking routing")
			
			# Determine next node using BarbGraph routers
			next_node = self._get_next_node(state_row)
			
			if next_node and next_node != self.current_node:
				logger.info(f"🔀 Routing: {self.current_node} → {next_node}")
				self._route_to_node(next_node, phone)
			else:
				logger.debug(f"⏸️  Staying on node '{self.current_node}'")
		else:
			logger.debug(f"⏳ Node '{self.current_node}' not complete yet")
	
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
	
	def _route_to_node(self, node_name: str, phone: str):
		"""Load new node prompt and update agent instructions
		
		Args:
			node_name: Target node to route to
			phone: Caller's phone number for context loading
		"""
		try:
			# Get lead context for injection (if available)
			state_row = get_conversation_state(phone)
			lead_context = {}
			if state_row:
				lead_id = state_row.get("lead_id")
				if lead_id:
					# Extract relevant context from state
					lead_context = {
						"lead_id": lead_id,
						"qualified": state_row.get("qualified"),
						"conversation_data": state_row.get("conversation_data", {})
					}
			
			# Use build_instructions_for_node to correctly combine theme + context + node
			from equity_connect.services.prompt_loader import build_instructions_for_node
			
			instructions = build_instructions_for_node(
				node_name=node_name,
				call_type="outbound",  # Will be updated from call metadata later
				lead_context=lead_context if lead_context else None,
				phone_number=phone,
				vertical="reverse_mortgage"
			)
			
			# Update prompt using SignalWire API
			self.set_prompt_text(instructions)
			self.current_node = node_name
			self.phone_number = phone
			
			logger.info(f"📝 Loaded prompt for node '{node_name}'")
		except Exception as e:
			logger.error(f"❌ Failed to route to node '{node_name}': {e}")

