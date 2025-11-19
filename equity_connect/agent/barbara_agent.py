"""Barbara - AI Voice Agent for EquityConnect using SignalWire SDK"""
import os
import logging
import json
from datetime import datetime
from typing import Optional, Dict, Any, List, Callable
from contextvars import ContextVar
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from signalwire_agents import AgentBase, ContextBuilder  # type: ignore
from signalwire_agents.core.function_result import SwaigFunctionResult  # type: ignore
from equity_connect.services.agent_config import get_agent_params
from equity_connect.services import (
	lead_service,
	calendar_service,
	knowledge_service,
	interaction_service,
)
from equity_connect.services.contexts_builder import build_contexts_object, load_theme
from equity_connect.services.conversation_state import get_conversation_state

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
		
		# Apply agent parameters (timeouts, etc.)
		agent_params = get_agent_params(vertical="reverse_mortgage", language="en-US")
		
		# Build options dictionary for AgentBase
		# These are passed to the underlying SWML configuration
		agent_options = {
			"attention_timeout": agent_params.get("attention_timeout", 8000),
			"end_of_speech_timeout": agent_params.get("end_of_speech_timeout", 800),
		}
		
		if agent_params.get("attention_timeout_prompt"):
			agent_options["attention_timeout_prompt"] = agent_params["attention_timeout_prompt"]
			
		if agent_params.get("hard_stop_time"):
			agent_options["hard_stop_time"] = agent_params["hard_stop_time"]
			
		if agent_params.get("hard_stop_prompt"):
			agent_options["hard_stop_prompt"] = agent_params["hard_stop_prompt"]
		
		super().__init__(
			name="barbara-agent",
			route="/agent",
			host="0.0.0.0",  # Listen on all interfaces for Docker/Fly.io
			port=8080,
			use_pom=True,  # ENABLED: Use Prompt Object Model for advanced routing
			auto_answer=True,
			record_call=True,
			record_format="mp3",
			basic_auth=(agent_username, agent_password)
		)
		
		# Set AI parameters (timeouts, limits, etc.)
		self.set_params(agent_options)
		
		# Enable SIP routing - REQUIRED for SignalWire to route calls to this agent
		# This makes Barbara reachable at barbara-agent@domain and /agent@domain
		self.enable_sip_routing(auto_map=True)
		
		# Set webhook URL for Fly.io deployment (fixes proxy detection issues)
		# This tells Agent SDK the correct public URL for SWAIG functions
		self.set_web_hook_url("https://barbara-agent.fly.dev/swaig")
		self.set_post_prompt_url("https://barbara-agent.fly.dev/post_prompt")
		
		# DYNAMIC CONFIG: DISABLED to prevent recursion loop
		# self.set_dynamic_config_callback(self.configure_per_call)
		logger.info("✅ Dynamic config callback DISABLED - loading contexts statically from DB")
		
		# Static configuration (applied once at initialization)
		
		# Global data defaults (company info)
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
		
		# ==================================================================
		# PRODUCTION CONTEXTS - LOAD FROM DATABASE
		# ==================================================================
		
		try:
			logger.info("🏗️  Building contexts from database...")
			# Build contexts object for default vertical
			initial_context = "greet"
			logger.info(f"📍 [INITIAL CONTEXT] {initial_context}")
			contexts_obj = build_contexts_object(vertical="reverse_mortgage", initial_context=initial_context)
			self._current_context = initial_context
			
			# TRAP STRATEGY: Force 'answer' context to NOT route to exit/goodbye automatically.
			# This forces the agent to wait for user input and use a Tool to transition.
			if "answer" in contexts_obj:
				# Remove exit paths from valid_contexts
				current_valid = contexts_obj["answer"].get("valid_contexts", [])
				contexts_obj["answer"]["valid_contexts"] = [
					ctx for ctx in current_valid 
					if ctx not in ["goodbye", "end", "exit"]
				]
				logger.info(f"🔒 TRAP APPLIED: Restricted 'answer' context routing to: {contexts_obj['answer']['valid_contexts']}")
			
			# Apply contexts using builder API
			self._apply_contexts_via_builder(self, contexts_obj)
			logger.info(f"✅ Loaded {len(contexts_obj)} contexts from database")
			
			# Load Theme (Personality)
			theme_text = load_theme("reverse_mortgage")
			self.prompt_add_section("Personality", body=theme_text)
			logger.info("✅ Loaded theme/personality from database")
			
		except Exception as e:
			logger.error(f"❌ CRITICAL: Failed to load contexts from DB: {e}")
			# Fallback to minimal safe mode if DB fails
			self.prompt_add_section("Error", "I am having technical difficulties. Please call back later.")
		
		
		# Voice configuration (Default fallback)
		# We use defaults here; per-call voice customization would require dynamic config
		# or handling in on_swml_request if possible.
		voice_config = self._get_voice_config(vertical="reverse_mortgage", language_code="en-US")
		voice_string = self._build_voice_string(voice_config["engine"], voice_config["voice_name"])
		
		self.add_language(
			name=voice_config.get("language_name", "English"),
			code=voice_config.get("language_code", "en-US"),
			voice=voice_string,
			engine=voice_config["engine"]
		)
		logger.info(f"✅ Voice set to {voice_string}")
		
		# Pattern hints
		self.add_pattern_hint(
			hint="AI Agent",
			pattern="AI\\s+Agent",
			replace="A.I. Agent",
			ignore_case=True
		)
		
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
		
		self._test_state_ctx = ContextVar("barbara_test_state")
		self._reset_test_state()
		
		logger.info("[OK] BarbaraAgent initialized in STABLE mode (Static Contexts + Dynamic Data)")
	
	def _execute_with_timeout(self, func: Callable, timeout_seconds: float, *args, **kwargs):
		"""Execute a blocking function with timeout protection to prevent call hangups."""
		with ThreadPoolExecutor(max_workers=1) as executor:
			future = executor.submit(func, *args, **kwargs)
			try:
				return future.result(timeout=timeout_seconds)
			except FutureTimeoutError:
				logger.error(f"[TIMEOUT] Function {func.__name__} exceeded {timeout_seconds}s timeout")
				raise
	
	def _log_context_change(self, step_name: str, previous_step: str = None):
		"""Callback to log when context/step changes"""
		if previous_step:
			logger.info(f"🔀 CONTEXT CHANGE: {previous_step} → {step_name}")
		else:
			logger.info(f"▶️ STARTING CONTEXT: {step_name}")

	def _apply_contexts_via_builder(self, agent_instance, contexts_data: Dict[str, Any]) -> None:
		"""Apply contexts using proper ContextBuilder API
		
		Args:
			agent_instance: Agent or EphemeralAgentConfig instance
			contexts_data: Dict from build_contexts_object()
		
		CRITICAL: Uses builder API exclusively - no custom dict returns
		"""
		contexts_builder = agent_instance.define_contexts()
		
		for ctx_name, ctx_config in contexts_data.items():
			if not ctx_config:
				continue
			context = contexts_builder.add_context(ctx_name)
			
			# Context-level properties
			valid_contexts = self._ensure_list(ctx_config.get("valid_contexts"))
			if valid_contexts:
				context.set_valid_contexts(valid_contexts)
			if ctx_config.get("isolated") and hasattr(context, "set_isolated"):
				context.set_isolated(True)
			if ctx_config.get("enter_fillers") and hasattr(context, "set_enter_fillers"):
				context.set_enter_fillers(ctx_config["enter_fillers"])
			if ctx_config.get("exit_fillers") and hasattr(context, "set_exit_fillers"):
				context.set_exit_fillers(ctx_config["exit_fillers"])

			# Add each step
			context_step_names = set()
			for idx, step_cfg in enumerate(ctx_config.get("steps", [])):
				step_name = step_cfg.get("name") or f"step_{idx}"
				if step_name in context_step_names:
					step_name = f"{step_name}_{idx}"
				context_step_names.add(step_name)
				step = context.add_step(step_name)
				
				if step_cfg.get("text"):
					step.set_text(step_cfg["text"])
				if step_cfg.get("step_criteria"):
					step.set_step_criteria(step_cfg["step_criteria"])
				
				# skip_user_turn is not supported on Step object in this SDK
				
				functions = self._ensure_list(step_cfg.get("functions"))
				if functions:
					step.set_functions(functions)
				valid_steps = self._ensure_list(step_cfg.get("valid_steps"))
				if valid_steps:
					step.set_valid_steps(valid_steps)

				# Restore valid_contexts on Step (verified in examples)
				step_valid_contexts = self._ensure_list(step_cfg.get("valid_contexts"))
				action = step_cfg.get("action")
				if action and action.get("type") == "set_context":
					target_ctx = action.get("context")
					if target_ctx and target_ctx not in step_valid_contexts:
						step_valid_contexts.append(target_ctx)
				if step_valid_contexts:
					step.set_valid_contexts(step_valid_contexts)
				
				# NOTE: 'skip_user_turn' and 'on_step_change' are not supported in the public Step API
				# Removing them to prevent AttributeError.

	def _get_voice_config(self, vertical: str = "reverse_mortgage", language_code: str = "en-US") -> Dict[str, Any]:
		"""Load voice configuration from database"""
		from equity_connect.services.supabase import get_supabase_client
		
		try:
			sb = get_supabase_client()
			result = sb.table('agent_voice_config') \
				.select('tts_engine, voice_name, model') \
				.eq('vertical', vertical) \
				.eq('language_code', language_code) \
				.eq('is_active', True) \
				.single() \
				.execute()
			
			if result.data:
				return {
					"engine": result.data['tts_engine'],
					"voice_name": result.data['voice_name'],
					"model": result.data.get('model')
				}
		except Exception as e:
			logger.warning(f"Failed to load voice config from DB: {e}, using env fallback")
		
		# Fallback to environment variables
		engine = os.getenv("TTS_ENGINE", "elevenlabs")
		voice_name = os.getenv("ELEVENLABS_VOICE_NAME", "rachel") if engine == "elevenlabs" else os.getenv("TTS_VOICE_NAME", "rachel")
		model = os.getenv("TTS_MODEL")
		
		return {
			"engine": engine,
			"voice_name": voice_name,
			"model": model
		}

	def _build_voice_string(self, engine: str, voice_name: str) -> str:
		"""Build provider-specific voice string"""
		formats = {
			"elevenlabs": f"elevenlabs.{voice_name}",
			"openai": f"openai.{voice_name}",
			"google": f"gcloud.{voice_name}",
			"gcloud": f"gcloud.{voice_name}",
			"amazon": f"amazon.{voice_name}",
			"polly": f"amazon.{voice_name}",
			"azure": voice_name,
			"microsoft": voice_name,
			"cartesia": f"cartesia.{voice_name}",
			"rime": f"rime.{voice_name}"
		}
		return formats.get(engine.lower(), f"{engine}.{voice_name}")

	@staticmethod
	def _ensure_list(value: Optional[Any]) -> List[Any]:
		if value is None:
			return []
		if isinstance(value, list):
			return value
		return [value]

	@staticmethod
	def _to_bool(value: Optional[Any]) -> bool:
		if isinstance(value, bool):
			return value
		if isinstance(value, str):
			return value.strip().lower() in {"true", "1", "yes", "on"}
		return bool(value)
	
	# ==================== TOOLS ====================
	
	@AgentBase.tool(
		description="Call this when the caller asks a question in GREET context. This routes to ANSWER context.",
		parameters={"type": "object", "properties": {"user_question": {"type": "string", "description": "Question"}}, "required": ["user_question"]}
	)
	def route_to_answer_for_question(self, args, raw_data):
		"""Tool: Route from GREET to ANSWER"""
		logger.info(f"=== TOOL CALLED - route_to_answer_for_question: {args.get('user_question')} ===")
		
		# Explicitly switch context on the agent instance
		try:
			if hasattr(self, "set_active_context"):
				logger.info(f"🔄 [CONTEXT SWITCH] greet → answer")
				self.set_active_context("answer")
			else:
				logger.warning("AgentBase missing set_active_context, attempting SWML fallback")
		except Exception as e:
			logger.error(f"Failed to set active context: {e}")

		result = SwaigFunctionResult()
		result.response = "Great question! Let me help you with that."
		# result.swml_change_step("answer") # Removed: unsupported method
		return result

	@AgentBase.tool(
		description="Verify caller identity (one-time).",
		parameters={"type": "object", "properties": {"first_name": {"type": "string"}, "phone": {"type": "string"}}, "required": ["first_name", "phone"]}
	)
	def verify_caller_identity(self, args, raw_data):
		"""Tool: Verify caller identity"""
		logger.info("=== TOOL CALLED - verify_caller_identity ===")
		try:
			result_json = self._execute_with_timeout(
				lead_service.verify_caller_identity_core, 5.0, args.get("first_name"), args.get("phone")
			)
			result_data = json.loads(result_json)
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"Error: {e}")
			return SwaigFunctionResult("Unable to verify identity.")

	@AgentBase.tool(
		description="Check consent and DNC status.",
		parameters={"type": "object", "properties": {"phone": {"type": "string"}}, "required": ["phone"]}
	)
	def check_consent_dnc(self, args, raw_data):
		"""Tool: Check consent"""
		logger.info("=== TOOL CALLED - check_consent_dnc ===")
		try:
			result_json = lead_service.check_consent_dnc_core(args.get("phone"))
			result_data = json.loads(result_json)
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"Error: {e}")
			return SwaigFunctionResult("Unable to check consent.")

	@AgentBase.tool(
		description="Update lead fields.",
		parameters={
			"type": "object",
			"properties": {
				"lead_id": {"type": "string"},
				"first_name": {"type": "string"},
				"last_name": {"type": "string"},
				"email": {"type": "string"},
				"phone": {"type": "string"},
				"property_address": {"type": "string"},
				"age": {"type": "integer"},
				"amount_needed": {"type": "number"}
			},
			"required": ["lead_id"]
		}
	)
	def update_lead_info(self, args, raw_data):
		"""Tool: Update lead info"""
		logger.info("=== TOOL CALLED - update_lead_info ===")
		try:
			# Logic to extract lead_id if missing in args
			lead_id = args.get("lead_id")
			if not lead_id and raw_data:
				lead_id = raw_data.get("global_data", {}).get("lead", {}).get("id")
			
			if not lead_id:
				return SwaigFunctionResult("Missing lead_id.")

			result_json = lead_service.update_lead_info_core(
				lead_id, args.get("first_name"), args.get("last_name"),
				args.get("email"), args.get("phone"), args.get("property_address"),
				None, None, None, # city, state, zip
				args.get("age"), None, args.get("amount_needed"), None, None
			)
			result_data = json.loads(result_json)
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"Error: {e}")
			return SwaigFunctionResult("Unable to update info.")

	@AgentBase.tool(
		description="Check broker availability.",
		parameters={
			"type": "object",
			"properties": {
				"broker_id": {"type": "string"},
				"preferred_day": {"type": "string"},
				"preferred_time": {"type": "string"}
			},
			"required": ["broker_id"]
		}
	)
	def check_broker_availability(self, args, raw_data):
		"""Tool: Check availability"""
		logger.info("=== TOOL CALLED - check_broker_availability ===")
		try:
			broker_id = args.get("broker_id") or raw_data.get("global_data", {}).get("broker", {}).get("id")
			if not broker_id:
				return SwaigFunctionResult("No broker assigned.")
				
			result_json = self._execute_with_timeout(
				calendar_service.check_broker_availability_core, 6.0,
				broker_id, args.get("preferred_day"), args.get("preferred_time"), raw_data
			)
			result_data = json.loads(result_json)
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"Error: {e}")
			return SwaigFunctionResult("Unable to check availability.")

	@AgentBase.tool(
		description="Book an appointment.",
		parameters={
			"type": "object",
			"properties": {
				"lead_id": {"type": "string"},
				"broker_id": {"type": "string"},
				"scheduled_for": {"type": "string"},
				"notes": {"type": "string"}
			},
			"required": ["lead_id", "broker_id", "scheduled_for"]
		}
	)
	def book_appointment(self, args, raw_data):
		"""Tool: Book appointment"""
		logger.info("=== TOOL CALLED - book_appointment ===")
		try:
			result_json = self._execute_with_timeout(
				calendar_service.book_appointment_core, 8.0,
				args.get("lead_id"), args.get("broker_id"), args.get("scheduled_for"), args.get("notes"), raw_data
			)
			result_data = json.loads(result_json)
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"Error: {e}")
			return SwaigFunctionResult("Unable to book appointment.")

	@AgentBase.tool(
		description="Search knowledge base.",
		parameters={"type": "object", "properties": {"question": {"type": "string"}}, "required": ["question"]}
	)
	def search_knowledge(self, args, raw_data):
		"""Tool: Search KB"""
		logger.info("=== TOOL CALLED - search_knowledge ===")
		try:
			result_json = self._execute_with_timeout(
				knowledge_service.search_knowledge_core, 8.0, args.get("question"), raw_data
			)
			knowledge_data = json.loads(result_json)
			
			response_text = knowledge_data.get("answer", knowledge_data.get("message", "I couldn't find that information."))
			return SwaigFunctionResult(response_text)
		except Exception as e:
			logger.error(f"Error: {e}")
			return SwaigFunctionResult("I'm having trouble accessing that information.")

	@AgentBase.tool(
		description="Call this ONLY when user explicitly confirms NO MORE questions.",
		parameters={
			"type": "object",
			"properties": {
				"next_context": {"type": "string", "enum": ["book", "goodbye"]}
			},
			"required": ["next_context"]
		}
	)
	def complete_questions(self, args, raw_data):
		"""Tool: Complete questions and route"""
		next_ctx = args.get("next_context", "goodbye")
		logger.info(f"=== TOOL CALLED - complete_questions → {next_ctx} ===")
		
		# Explicitly switch context
		try:
			if hasattr(self, "set_active_context"):
				# Get current context if available
				current_ctx = getattr(self, '_current_context', 'unknown')
				logger.info(f"🔄 [CONTEXT SWITCH] {current_ctx} → {next_ctx}")
				self.set_active_context(next_ctx)
				self._current_context = next_ctx
			else:
				logger.warning("AgentBase missing set_active_context")
		except Exception as e:
			logger.error(f"Failed to set active context: {e}")

		result = SwaigFunctionResult()
		# result.swml_change_step(next_ctx) # Removed: unsupported
		result.response = "Understood. Let me help you with that."
		return result

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
	def find_broker_by_territory(self, args, raw_data):
		"""Tool: Find a broker by territory"""
		logger.info("=== TOOL CALLED - find_broker_by_territory ===")
		try:
			result_json = lead_service.find_broker_by_territory_core(
				args.get("zip_code"), args.get("city"), args.get("state")
			)
			result_data = json.loads(result_json)
			
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"[ERROR] find_broker_by_territory failed: {e}", exc_info=True)
			return SwaigFunctionResult("Unable to find broker for this territory.")
	
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
	def reschedule_appointment(self, args, raw_data):
		"""Tool: Reschedule appointment"""
		logger.info("=== TOOL CALLED - reschedule_appointment ===")
		try:
			result_json = calendar_service.reschedule_appointment_core(
				args.get("interaction_id"),
				args.get("new_scheduled_for"),
				args.get("reason"),
			)
			result_data = json.loads(result_json)
			
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"[ERROR] reschedule_appointment failed: {e}", exc_info=True)
			return SwaigFunctionResult("Unable to reschedule appointment.")
	
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
	def cancel_appointment(self, args, raw_data):
		"""Tool: Cancel appointment"""
		logger.info("=== TOOL CALLED - cancel_appointment ===")
		try:
			result_json = calendar_service.cancel_appointment_core(
				args.get("interaction_id"),
				args.get("reason"),
			)
			result_data = json.loads(result_json)
			
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"[ERROR] cancel_appointment failed: {e}", exc_info=True)
			return SwaigFunctionResult("Unable to cancel appointment.")
	
	@AgentBase.tool(
		description="Assign a SignalWire tracking number to a lead for attribution.",
		parameters={"type": "object", "properties": {"lead_id": {"type": "string", "description": "Lead UUID"}, "broker_id": {"type": "string", "description": "Broker UUID"}}, "required": ["lead_id", "broker_id"]}
	)
	def assign_tracking_number(self, args, raw_data):
		"""Tool: Assign tracking number"""
		logger.info("=== TOOL CALLED - assign_tracking_number ===")
		try:
			result_json = interaction_service.assign_tracking_number_core(
				args.get("lead_id"), args.get("broker_id")
			)
			result_data = json.loads(result_json)
			
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"[ERROR] assign_tracking_number failed: {e}", exc_info=True)
			return SwaigFunctionResult("Unable to assign tracking number.")
	
	@AgentBase.tool(
		description="Send appointment confirmation via SMS.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number"}, "appointment_datetime": {"type": "string", "description": "ISO 8601 datetime"}}, "required": ["phone", "appointment_datetime"]}
	)
	def send_appointment_confirmation(self, args, raw_data):
		"""Tool: Send appointment confirmation"""
		logger.info("=== TOOL CALLED - send_appointment_confirmation ===")
		try:
			result_json = interaction_service.send_appointment_confirmation_core(
				args.get("phone"), args.get("appointment_datetime")
			)
			result_data = json.loads(result_json)
			
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"[ERROR] send_appointment_confirmation failed: {e}", exc_info=True)
			return SwaigFunctionResult("Unable to send confirmation.")
	
	@AgentBase.tool(
		description="Verify appointment confirmation code from SMS.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number"}, "code": {"type": "string", "description": "Code to verify"}}, "required": ["phone", "code"]}
	)
	def verify_appointment_confirmation(self, args, raw_data):
		"""Tool: Verify appointment confirmation"""
		logger.info("=== TOOL CALLED - verify_appointment_confirmation ===")
		try:
			result_json = interaction_service.verify_appointment_confirmation_core(
				args.get("phone"), args.get("code")
			)
			result_data = json.loads(result_json)
			
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"[ERROR] verify_appointment_confirmation failed: {e}", exc_info=True)
			return SwaigFunctionResult("Unable to verify confirmation code.")
	
	@AgentBase.tool(description="Mark wrong person", parameters={"type": "object", "properties": {}, "required": []})
	def mark_wrong_person(self, args, raw_data):
		"""Tool: Mark wrong person and end call"""
		logger.info("=== TOOL CALLED - mark_wrong_person ===")
		
		# Explicitly switch context
		try:
			if hasattr(self, "set_active_context"):
				current_ctx = getattr(self, '_current_context', 'unknown')
				logger.info(f"🔄 [CONTEXT SWITCH] {current_ctx} → end")
				self.set_active_context("end")
				self._current_context = "end"
			else:
				logger.warning("AgentBase missing set_active_context")
		except Exception as e:
			logger.error(f"Failed to set active context: {e}")

		result = SwaigFunctionResult()
		result.response = "I apologize for the mistake. I'll update our records. Goodbye."
		# result.swml_change_step("end") # Removed: unsupported
		return result

	# ==================== END TOOLS ====================

	def on_swml_request(self, query_params: Dict[str, Any], body_params: Dict[str, Any], headers: Dict[str, Any]):
		"""Override to inject caller info into prompts BEFORE call starts
		
		This runs once per call. We use it to load caller info and inject it into the personality prompt.
		This works nicely with the static context structure loaded in __init__.
		"""
		try:
			# Extract phone number from request
			phone = None
			if query_params and 'call' in query_params:
				call_data = query_params['call']
				if isinstance(call_data, str):
					call_data = json.loads(call_data)
				phone = call_data.get('from')
			
			if not phone and body_params:
				if 'call' in body_params and 'from' in body_params['call']:
					phone = body_params['call']['from']
				elif 'From' in body_params:
					phone = body_params['From']
				elif 'caller_id_num' in body_params:
					phone = body_params['caller_id_num']
			
			if not phone:
				logger.warning("[SWML] No phone number found in request, using generic greeting")
				return super().on_swml_request(query_params, body_params, headers)
			
			# Normalize phone
			normalized_phone = phone.lstrip('+1') if phone.startswith('+1') else phone.lstrip('+')
			logger.info(f"[SWML] Original phone: {phone}, Normalized: {normalized_phone}")
			
			# Query lead
			lead_context_json = lead_service.get_lead_context_core(normalized_phone)
			lead_context = json.loads(lead_context_json)
			
			# Use lead data if found, otherwise generic
			if lead_context.get('found'):
				lead_data = lead_context.get('lead', {})
				broker_data = lead_context.get('broker', {})
				conv_state = get_conversation_state(normalized_phone) or {}
				conversation_data = conv_state.get('conversation_data', {})
				
				logger.info(f"[SWML] Found lead: {lead_data.get('first_name')} {lead_data.get('last_name')}")
				
				# 1. Build Caller Info String
				# Safely handle None values for currency formatting
				prop_val = lead_data.get('property_value')
				est_equity = lead_data.get('estimated_equity')
				prop_val = prop_val if prop_val is not None else 0
				est_equity = est_equity if est_equity is not None else 0
				
				caller_info = f"""
=== CALLER INFORMATION ===
Name: {lead_data.get('first_name', 'Unknown')} {lead_data.get('last_name', '')}
Phone: {phone}
Property: {lead_data.get('property_address') or lead_data.get('property_city', 'Unknown')}
Value: ${prop_val:,} | Equity: ${est_equity:,}
Status: {'✅ QUALIFIED' if lead_data.get('qualified') else '❌ Not Qualified' if lead_data.get('qualified') is False else 'Unknown'}
"""
				if conversation_data.get('appointment_booked'):
					caller_info += f"Appointment: ✅ BOOKED (ID: {conversation_data.get('appointment_id', 'N/A')})\n"
				
				# Inject into prompt
				self.prompt_add_section("Caller Info", caller_info)
				
				# 2. Set Global Data for Tools
				self.set_global_data({
					"company_name": "Barbara AI",
					"lead": {
						"id": lead_context.get("lead_id"),
						"first_name": lead_data.get("first_name"),
						"last_name": lead_data.get("last_name"),
						"phone": phone
					},
					"broker": {
						"id": lead_context.get("broker_id")
					},
					"status": {
						"qualified": lead_data.get("qualified"),
						"appointment_booked": conversation_data.get("appointment_booked")
					}
				})
				logger.info("[SWML] ✅ Personalization applied")
				
			else:
				logger.info("[SWML] Lead not found - treating as new caller")
				self.set_global_data({"is_new_caller": True})
				
		except Exception as e:
			logger.error(f"[SWML] Error loading caller info: {e}")
		
		return super().on_swml_request(query_params, body_params, headers)

	def on_function_call(self, name: str, args: Dict[str, Any], raw_data: Optional[Dict[str, Any]] = None):
		"""Override to log all tool/function calls"""
		logger.info(f"🔧 [TOOL CALL] {name} | Args: {json.dumps(args, default=str)}")
		try:
			result = super().on_function_call(name, args, raw_data)
			logger.info(f"✅ [TOOL RESULT] {name} | Success")
			return result
		except Exception as e:
			logger.error(f"❌ [TOOL ERROR] {name} | Error: {e}", exc_info=True)
			raise

	def on_summary(self, summary: Optional[Dict[str, Any]], raw_data: Optional[Dict[str, Any]] = None):
		"""Handle conversation summary after call ends"""
		try:
			logger.info(f"[STATS] Conversation completed: {summary}")
			if not summary:
				return
			
			phone = None
			if raw_data:
				phone = raw_data.get("From") or raw_data.get("To")
			
			if phone:
				state_row = get_conversation_state(phone)
				if state_row and state_row.get("lead_id"):
					from equity_connect.services.supabase import get_supabase_client
					supabase = get_supabase_client()
					supabase.table("interactions").insert({
						"lead_id": state_row["lead_id"],
						"broker_id": state_row.get("broker_id"),
						"interaction_type": "call",
						"outcome": "completed",
						"content": f"Call Summary:\n{summary}",
						"metadata": {"summary": summary}
					}).execute()
					logger.info(f"[OK] Call summary saved for lead {state_row['lead_id']}")
		except Exception as e:
			logger.error(f"[ERROR] Failed to save call summary: {e}", exc_info=True)

	# Test Helpers (kept for compatibility but test mode requires refactor if dynamic)
	def _reset_test_state(self):
		self._test_state_ctx.set({
			"mode": False, "use_draft": False, "start_node": None,
			"stop_on_route": False, "nodes_visited": [], "pending_events": [],
			"completed": False, "current_call_phone": None,
			"vertical": "reverse_mortgage", "call_mode": "full",
		})
	def _create_test_state(self): return {} # Placeholder
	def _override_prompt_for_test(self, *args): pass # Placeholder
