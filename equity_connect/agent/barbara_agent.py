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
		
		super().__init__(
			name="barbara-agent",
			route="/agent",
			host="0.0.0.0",  # Listen on all interfaces for Docker/Fly.io
			port=8080,
			# use_pom=True,  # DISABLED for testing - using simple contexts
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
		
		# DYNAMIC CONFIG: Load fresh contexts from DB on each call
		# This allows instant prompt updates without redeploying
		self.set_dynamic_config_callback(self.configure_per_call)
		logger.info("✅ Dynamic config callback ENABLED - will load contexts from DB per call")
		
		# Static configuration (applied once at initialization)
		# These don't change per-call, so set them here instead of configure_per_call
		
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
		# FALLBACK CONTEXTS - Safety net if DB fails
		# These are minimal contexts used ONLY if database loading fails
		# Normal operation loads contexts from DB in configure_per_call()
		# ==================================================================
		
		# Add a simple personality prompt
		self.prompt_add_section(
			"Personality",
			"You are Barbara, a professional assistant for Equity Connect. "
			"You help people with reverse mortgage questions."
		)
		
		contexts = self.define_contexts()
		default_context = contexts.add_context("default")
		
		# GREET - Entry point
		default_context.add_step("greet") \
			.add_section("Instructions", 
				"You are Barbara. Your ONLY job:\n"
				"1. Greet: 'Hi! This is Barbara with Equity Connect. How can I help you today?'\n"
				"2. If they ask ANY question, IMMEDIATELY call route_to_answer_for_question(user_question='their question')\n"
				"That's it. Nothing else."
			) \
			.set_step_criteria("Greeted caller") \
			.set_functions(["route_to_answer_for_question", "mark_wrong_person"]) \
			.set_valid_steps(["answer"])
		
		# ANSWER - Question handling
		default_context.add_step("answer") \
			.add_section("Instructions",
				"You are in ANSWER context. Your job:\n"
				"1. Call search_knowledge(query='user's question') to get the answer\n"
				"2. Give them the answer\n"
				"3. Ask: 'Any other questions?'\n"
				"4. If they say NO: call complete_questions(next_context='exit')\n"
				"5. If they say YES: wait for their next question and repeat from step 1"
			) \
			.set_step_criteria("User confirmed no more questions") \
			.set_functions(["search_knowledge", "complete_questions"]) \
			.set_valid_steps(["exit"])
		
		# EXIT - End conversation
		default_context.add_step("exit") \
			.add_section("Instructions",
				"Say: 'Thanks for your time! Walter Richards will reach out soon. Have a great day!'\n"
				"Then hang up."
			) \
			.set_step_criteria("Said goodbye") \
			.set_functions([]) \
			.set_valid_steps([])
		
		logger.info("✅ HARDCODED CONTEXTS loaded - bypassing database for testing")
		
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
		
		logger.info("[OK] Static configuration applied (hints, pronunciations, post-prompt)")
		
		self._test_state_ctx = ContextVar("barbara_test_state")
		self._reset_test_state()
		
		logger.info("[OK] BarbaraAgent initialized with dynamic configuration and 14 tools")
	
	def _execute_with_timeout(self, func: Callable, timeout_seconds: float, *args, **kwargs):
		"""Execute a blocking function with timeout protection to prevent call hangups.
		
		Args:
			func: The function to execute
			timeout_seconds: Maximum time to wait (e.g., 8.0 for 8 seconds)
			*args, **kwargs: Arguments to pass to func
			
		Returns:
			Result from func if completed within timeout
			
		Raises:
			FutureTimeoutError: If function doesn't complete within timeout
			Exception: Any exception raised by func
		"""
		with ThreadPoolExecutor(max_workers=1) as executor:
			future = executor.submit(func, *args, **kwargs)
			try:
				return future.result(timeout=timeout_seconds)
			except FutureTimeoutError:
				logger.error(f"[TIMEOUT] Function {func.__name__} exceeded {timeout_seconds}s timeout")
				raise
	
	def _load_context_configs_from_db(self) -> Optional[Dict[str, Any]]:
		"""Load context configurations from database
		
		Returns dict with context_name -> config mapping, or None if failed
		"""
		try:
			# Use timeout protection for DB query
			def query_db():
				response = self.supabase.table('prompt_versions') \
					.select('context_name, content') \
					.eq('version', 'active') \
					.execute()
				return response.data
			
			# 3 second timeout for DB query
			data = self._execute_with_timeout(query_db, timeout_seconds=3)
			
			if not data:
				logger.warning("No active prompt versions found in database")
				return None
			
			configs = {}
			for row in data:
				configs[row['context_name']] = row['content']
			
			logger.info(f"✅ Loaded {len(configs)} contexts from database: {list(configs.keys())}")
			return configs
			
		except Exception as e:
			logger.error(f"❌ Failed to load contexts from DB: {e}")
			return None
	
	def configure_per_call(self, query_params: Dict[str, Any], body_params: Dict[str, Any], headers: Dict[str, Any], agent):
		"""Configure agent for incoming call - Load fresh contexts from DB
		
		This runs on every call and loads the latest prompts from the database,
		allowing instant updates without redeploying the agent.
		"""
		logger.info("🔄 Loading fresh contexts from database for this call...")
		
		# Load configs from DB
		db_configs = self._load_context_configs_from_db()
		
		if not db_configs:
			logger.warning("⚠️ Using hardcoded fallback contexts from __init__")
			return  # Use the hardcoded ones from __init__ as fallback
		
		# Load agent parameters (VAD, timeouts, etc.)
		agent_params = get_agent_params(vertical="reverse_mortgage", language="en-US")
		logger.info(f"✅ Loaded agent params: attention_timeout={agent_params.get('attention_timeout')}ms, transparent_barge={agent_params.get('transparent_barge')}")
		
		# Load voice configuration
		voice_config = self._get_voice_config(vertical="reverse_mortgage", language_code="en-US")
		voice_string = self._build_voice_string(voice_config["engine"], voice_config["voice_name"])
		logger.info(f"✅ Loaded voice config: {voice_string} ({voice_config['engine']})")
		
		# Apply agent parameters to the agent
		agent.set_attention_timeout(agent_params.get("attention_timeout", 8000))
		if agent_params.get("attention_timeout_prompt"):
			agent.set_attention_timeout_prompt(agent_params["attention_timeout_prompt"])
		
		agent.set_end_of_speech_timeout(agent_params.get("end_of_speech_timeout", 800))
		
		if agent_params.get("hard_stop_time"):
			agent.set_hard_stop(agent_params["hard_stop_time"])
		if agent_params.get("hard_stop_prompt"):
			agent.set_hard_stop_prompt(agent_params["hard_stop_prompt"])
		
		agent.set_first_word_timeout(agent_params.get("first_word_timeout", 1000))
		
		if agent_params.get("acknowledge_interruptions"):
			agent.set_acknowledge_interruptions(agent_params["acknowledge_interruptions"])
		if agent_params.get("interrupt_prompt"):
			agent.set_interrupt_prompt(agent_params["interrupt_prompt"])
		
		agent.set_transparent_barge(agent_params.get("transparent_barge", False))
		
		if agent_params.get("enable_barge"):
			agent.set_barge_confidence(agent_params["enable_barge"])
		
		# Apply voice configuration
		language_params = {
			"name": voice_config.get("language_name", "English"),
			"code": voice_config.get("language_code", "en-US"),
			"voice": voice_string,
			"engine": voice_config["engine"]
		}
		
		if voice_config.get("model"):
			language_params["model"] = voice_config["model"]
		
		# Set the language with voice config
		agent.set_language(language_params)
		
		logger.info(f"✅ Applied voice & VAD settings for this call")
		
		# Build contexts using DB data
		contexts = self.define_contexts()
		default_context = contexts.add_context("default")
		
		# Build each context from DB config
		for context_name in ["greet", "verify", "qualify", "answer", "quote", "objections", "book", "exit"]:
			config = db_configs.get(context_name)
			
			if not config:
				logger.warning(f"⚠️ No config found for context '{context_name}', skipping")
				continue
			
			# Extract config values with defaults
			instructions = config.get("instructions", f"Handle {context_name} context")
			step_criteria = config.get("step_criteria", f"{context_name} complete")
			tools = config.get("tools", [])
			valid_contexts = config.get("valid_contexts", [])
			
			# Build the step
			step = default_context.add_step(context_name) \
				.add_section("Instructions", instructions) \
				.set_step_criteria(step_criteria) \
				.set_functions(tools) \
				.set_valid_steps(valid_contexts)
			
			# Add step change callback for logging
			step.on_step_change(self._log_context_change)
			
			logger.info(f"✅ Built context '{context_name}' with {len(tools)} tools → can route to {valid_contexts}")
		
		logger.info("✅ All contexts loaded from database for this call")
	
	def _log_context_change(self, step_name: str, previous_step: str = None):
		"""Callback to log when context/step changes"""
		if previous_step:
			logger.info(f"🔀 CONTEXT CHANGE: {previous_step} → {step_name}")
		else:
			logger.info(f"▶️ STARTING CONTEXT: {step_name}")
		
		# Check if this is a CLI test (from user_vars)
		# According to SignalWire Agent SDK, --user-vars from swaig-test appear as top-level keys in query_params
		# Also check body_params for backwards compatibility and alternative formats
		test_mode = False
		version_id = None
		vertical = None
		node_name = None
		prompt_payload = None
		
		# First, check query_params directly (primary location for swaig-test --user-vars)
		if query_params.get('test_mode') or query_params.get('version_id'):
			test_mode = self._to_bool(query_params.get('test_mode'))
			version_id = query_params.get('version_id')
			vertical = query_params.get('vertical')
			node_name = query_params.get('node_name')
			if query_params.get('prompt_payload'):
				try:
					prompt_payload = json.loads(query_params.get('prompt_payload'))
				except Exception as e:
					logger.warning(f"[WARN] Failed to parse prompt_payload from query params: {e}")
			logger.info(f"[TEST] Found test mode vars in query_params: test_mode={test_mode}, version_id={version_id}")
		
		# Fallback: Check body_params for nested format (alternative/legacy format)
		if not test_mode and not version_id:
			user_vars = body_params.get('vars', {}).get('userVariables', {})
			if isinstance(user_vars, str):
				# Sometimes user_vars comes as JSON string
				try:
					user_vars = json.loads(user_vars)
				except json.JSONDecodeError as e:
					# JSON parsing failed - log error and raise to prevent silent failure
					logger.error(f"[ERROR] Failed to parse user_vars JSON: {e}. Raw value: {user_vars[:100] if len(user_vars) > 100 else user_vars}")
					raise ValueError(f"Invalid JSON in userVariables: {e}") from e
				except Exception as e:
					# Unexpected error during JSON parsing
					logger.error(f"[ERROR] Unexpected error parsing user_vars: {e}")
					raise ValueError(f"Failed to parse userVariables: {e}") from e
			
			if user_vars:
				test_mode = self._to_bool(user_vars.get('test_mode', False))
				version_id = user_vars.get('version_id')
				vertical = user_vars.get('vertical')
				node_name = user_vars.get('node_name')
				if user_vars.get('prompt_payload'):
					prompt_payload = user_vars.get('prompt_payload')
				logger.info(f"[TEST] Found test mode vars in body_params: test_mode={test_mode}, version_id={version_id}")
		
		# Normalize prompt payload (if string)
		if isinstance(prompt_payload, str):
			try:
				prompt_payload = json.loads(prompt_payload)
			except Exception as e:
				logger.warning(f"[WARN] Failed to decode prompt_payload JSON: {e}")
				prompt_payload = None
		
		if test_mode and (version_id or prompt_payload):
			logger.info(f"[TEST] TEST MODE: Loading prompt {'payload override' if prompt_payload else f'version {version_id}'}")
			
			# Load prompt content from database
			try:
				from equity_connect.test_barbara import get_prompt_version_from_db
				if prompt_payload:
					prompt_content = prompt_payload
					logger.info("[TEST] Using inline prompt payload override for test mode")
					version_data = {}
				else:
					version_data = get_prompt_version_from_db(version_id)
					prompt_content = version_data.get('content', {})
				# Use vertical/node_name from query_params/body_params, or fallback to defaults / payload hints
				vertical = vertical or version_data.get('vertical') or 'reverse_mortgage'
				node_name = node_name or version_data.get('node_name') or 'greet'
				
				logger.info(f"[OK] Loaded test prompt: {vertical}/{node_name}")
				
				# Override agent's prompt with test version
				self._override_prompt_for_test(agent, vertical, node_name, prompt_content)
				
				# Configure basic voice settings for test
				voice_config = self._get_voice_config(vertical=vertical, language_code="en-US")
				voice_string = self._build_voice_string(voice_config["engine"], voice_config["voice_name"])
				language_params = {
					"name": "English",
					"code": "en-US",
					"voice": voice_string,
					"engine": voice_config["engine"]
				}
				if voice_config.get("model"):
					language_params["model"] = voice_config["model"]
				agent.add_language(**language_params)
				agent.set_params({"ai_model": "gpt-4o", "end_of_speech_timeout": 800})
				self._ensure_skill(agent, "datetime")
				self._ensure_skill(agent, "math")
				
				logger.info(f"[OK] Test mode configuration complete")
				return
				
			except Exception as e:
				logger.error(f"[ERROR] Failed to load test prompt: {e}")
				raise
		else:
			# Normal call flow (production)
			logger.info("[CALL] Production call - using active prompts")
		
		# 1. Extract call info
		# Try multiple locations/casings for phone (SignalWire inconsistent between flows)
		# CRITICAL: SignalWire uses different keys for initial call vs mid-call reconfiguration
		
		# First, check if phone is in nested 'call' object (initial SWML request)
		call_obj = body_params.get('call', {})
		phone = (
			# Initial SWML request (nested in 'call' object)
			call_obj.get('from')
			or call_obj.get('from_number')
			# Flat body_params (alternative formats)
			or body_params.get('From')
			or body_params.get('from')
			or body_params.get('from_number')
			# Mid-call tool callbacks/reconfiguration
			or body_params.get('caller_id_num')
			# Query params (rare)
			or query_params.get('phone')
			or query_params.get('From')
		)
		
		# CRITICAL: Check if SignalWire is echoing back our global_data
		# This happens during tool calls and mid-call reconfigurations
		global_data_from_sw = body_params.get('global_data') or {}
		
		broker_id = query_params.get('broker_id')
		call_direction = (
			# Nested in 'call' object (initial request)
			call_obj.get('direction')
			# Flat body_params
			or body_params.get('Direction')
			or body_params.get('direction')
			# Query params
			or query_params.get('direction')
			or "inbound"  # Default
		)
		if isinstance(call_direction, str):
			call_direction = call_direction.lower()
		else:
			call_direction = "inbound"
		if call_direction not in {"inbound", "outbound"}:
			call_direction = "inbound"
		active_vertical = vertical or "reverse_mortgage"
		
		logger.info(f"[CALL] Configuring agent for {call_direction} call from {phone}")
		
		# 2. Configure AI providers
		# Load voice config from database (configurable per language)
		voice_config = self._get_voice_config(vertical=active_vertical, language_code="en-US")
		voice_string = self._build_voice_string(voice_config["engine"], voice_config["voice_name"])
		
		# Configure language with dynamic voice
		language_params = {
			"name": "English",
			"code": "en-US",
			"voice": voice_string,
			"engine": voice_config["engine"]
		}
		
		# Add model if specified (for Rime, Amazon)
		if voice_config.get("model"):
			language_params["model"] = voice_config["model"]
		
		agent.add_language(**language_params)
		logger.info(f"[OK] Voice configured: {voice_string} ({voice_config['engine']})")
		
		# 3. Get lead context
		# CRITICAL: Check if SignalWire is echoing back our previously set global_data
		# This happens during mid-call tool callbacks and prevents unnecessary DB lookups
		if global_data_from_sw and global_data_from_sw.get('lead', {}).get('id'):
			logger.info("[CACHE] Using global_data from SignalWire (mid-call reconfiguration)")
			# Extract data from SignalWire's echoed global_data
			lead_data_sw = global_data_from_sw.get('lead', {})
			broker_data_sw = global_data_from_sw.get('broker', {}) if 'broker' in global_data_from_sw else global_data_from_sw.get('status', {})
			property_data_sw = global_data_from_sw.get('property', {})
			
			lead_context = {
				"lead_id": lead_data_sw.get('id'),
				"first_name": lead_data_sw.get('first_name', 'there'),
				"last_name": lead_data_sw.get('last_name', ''),
				"name": lead_data_sw.get('name', 'Unknown'),
				"phone": lead_data_sw.get('phone') or phone,
				"email": lead_data_sw.get('email', ''),
				"status": lead_data_sw.get('status', ''),  # Include status for appointment_set handling
				"property_city": property_data_sw.get('city', 'Unknown'),
				"property_state": property_data_sw.get('state', ''),
				"property_address": property_data_sw.get('address', ''),
				"estimated_equity": property_data_sw.get('equity', 0),
				"qualified": global_data_from_sw.get('status', {}).get('qualified', False),
				"broker_name": broker_data_sw.get('broker_name') or broker_data_sw.get('full_name', ''),
				"broker_company": broker_data_sw.get('broker_company') or broker_data_sw.get('company', ''),
			}
			logger.info(f"[OK] Restored lead context from global_data: {lead_context.get('name')}")
		else:
			# Fallback to DB lookup if global_data not available
			try:
				# CRITICAL: Add timeout protection to prevent configure_per_call from hanging
				lead_context = self._execute_with_timeout(
					self._query_lead_direct,
					5.0,  # 5 second timeout for lead lookup
					phone,
					broker_id
				)
			except FutureTimeoutError:
				logger.error(f"[TIMEOUT] Lead context lookup timed out after 5s for phone: {phone}")
				# Return minimal context to allow call to proceed
				lead_context = {
					"phone": phone,
					"first_name": "there",
					"qualified": False,
				}
			except Exception as e:
				logger.error(f"[ERROR] Failed to get lead context: {e}")
				# Return minimal context to allow call to proceed
				lead_context = {
					"phone": phone,
					"first_name": "there",
					"qualified": False,
				}
		
		# Use lead context phone as fallback when not provided (e.g., CLI tests)
		if not phone:
			phone = lead_context.get("phone") or lead_context.get("lead_phone") or lead_context.get("lead_id")
			if phone:
				logger.info(f"[INFO] Using lead context phone fallback: {phone}")
		
		# 3b. Load runtime agent params
		agent_params = get_agent_params(vertical=active_vertical, language="en-US")
		caller_tz = lead_context.get("timezone") or agent_params.get("local_tz_default", "America/Los_Angeles")
		# Inbound: Barbara answers, should greet first (wait_for_user=False)
		# Outbound: Barbara calls, should wait for them to say hello (wait_for_user=True)
		wait_for_user = False if call_direction == "inbound" else agent_params.get("wait_for_user_default", True)
		
		params_payload = {
			"ai_model": agent_params.get("ai_model", "gpt-4o-mini"),
			"local_tz": caller_tz,
			"wait_for_user": wait_for_user,
			"direction": call_direction,
			"end_of_speech_timeout": agent_params.get("end_of_speech_timeout", 2000),
			"first_word_timeout": agent_params.get("first_word_timeout", 5000),
			"energy_level": agent_params.get("energy_level", 52),
			"attention_timeout": agent_params.get("attention_timeout", 8000),
			"attention_timeout_prompt": agent_params.get("attention_timeout_prompt"),
			"hard_stop_time": agent_params.get("hard_stop_time"),
			"hard_stop_prompt": agent_params.get("hard_stop_prompt"),
			"inactivity_timeout": agent_params.get("inactivity_timeout"),
			"outbound_attention_timeout": agent_params.get("outbound_attention_timeout"),
			"acknowledge_interruptions": agent_params.get("acknowledge_interruptions"),
			"interrupt_prompt": agent_params.get("interrupt_prompt"),
			"transparent_barge": agent_params.get("transparent_barge"),
			"enable_barge": agent_params.get("enable_barge"),
			"ai_volume": agent_params.get("ai_volume", 0),
			"background_file": agent_params.get("background_file"),
			"background_file_volume": agent_params.get("background_file_volume"),
			"background_file_loops": agent_params.get("background_file_loops"),
			"eleven_labs_stability": agent_params.get("eleven_labs_stability"),
			"eleven_labs_similarity": agent_params.get("eleven_labs_similarity"),
			"max_emotion": agent_params.get("max_emotion", 30),
			"static_greeting": agent_params.get("static_greeting"),
			"static_greeting_no_barge": agent_params.get("static_greeting_no_barge", False),
			"swaig_allow_swml": True,
			"swaig_allow_settings": True,
			"swaig_set_global_data": True,
			"function_wait_for_talking": False,
			"debug_webhook_url": os.getenv("SIGNALWIRE_DEBUG_WEBHOOK_URL"),
			"debug_webhook_level": 1,
		}
		agent.set_params(params_payload)
		self._ensure_skill(agent, "datetime")
		self._ensure_skill(agent, "math")
		logger.info(
			f"[CONTROL] Runtime params applied: wait_for_user={wait_for_user}, "
			f"attention_timeout={params_payload['attention_timeout']}ms"
		)
		
		# 4. Set global_data for tool execution context
		# Note: global_data is for tools/functions, NOT for prompt variable substitution
		lead_context['call_direction'] = call_direction
		agent.set_global_data({
			# NESTED structure for tool compatibility
			"lead": {
				"id": lead_context.get("lead_id", ""),
				"first_name": lead_context.get("first_name", "there"),
				"last_name": lead_context.get("last_name", ""),
				"name": lead_context.get("name", "Unknown"),
				"phone": phone or "",
				"email": lead_context.get("email", ""),
				"age": lead_context.get("age", ""),
				"status": lead_context.get("status", "")  # Include status for appointment_set handling
			},
			"broker": {
				"id": lead_context.get("broker_id", ""),
				"full_name": lead_context.get("broker_name", "your mortgage advisor"),
				"company": lead_context.get("broker_company", "our team"),
				"phone": lead_context.get("broker_phone", ""),
				"email": lead_context.get("broker_email", ""),
				"nylas_grant_id": lead_context.get("broker_nylas_grant_id", ""),
				"timezone": lead_context.get("broker_timezone", "")
			},
			"property": {
				"address": lead_context.get("property_address", "your property"),
				"city": lead_context.get("property_city", "your area"),
				"state": lead_context.get("property_state", ""),
				"zip": lead_context.get("property_zip", ""),
				"value": lead_context.get("property_value", ""),
				"equity": lead_context.get("estimated_equity", "")
			},
			"status": {
				"qualified": lead_context.get("qualified", False),
				"lead_status": lead_context.get("status", ""),  # Include lead status (appointment_set, etc.)
				"call_direction": call_direction,
				"quote_presented": False,  # Will be updated by tools
				"verified": False  # Will be updated by tools
			},
			# ALSO keep flat keys for prompt variable substitution (SignalWire needs both)
			"first_name": lead_context.get("first_name", "there"),
			"last_name": lead_context.get("last_name", ""),
			"full_name": lead_context.get("name", "Unknown"),
			"lead_phone": phone or "",
			"lead_email": lead_context.get("email", ""),
			"lead_age": lead_context.get("age", ""),
			"lead_id": lead_context.get("lead_id", ""),
			"broker_name": lead_context.get("broker_name", "your mortgage advisor"),
			"broker_company": lead_context.get("broker_company", "our team"),
			"broker_phone": lead_context.get("broker_phone", ""),
			"broker_email": lead_context.get("broker_email", ""),
			"property_address": lead_context.get("property_address", "your property"),
			"property_city": lead_context.get("property_city", "your area"),
			"property_state": lead_context.get("property_state", ""),
			"property_zip": lead_context.get("property_zip", ""),
			"property_value": lead_context.get("property_value", ""),
			"estimated_equity": lead_context.get("estimated_equity", ""),
			"qualified": str(lead_context.get("qualified", False)).lower(),
			"call_direction": call_direction,
			"quote_presented": "false",
			"verified": "false"
		})
		
		# Log global_data size
		import json
		global_data_json = json.dumps(agent.get_global_data() if hasattr(agent, 'get_global_data') else {})
		global_data_size = len(global_data_json.encode('utf-8'))
		logger.info(f"[PAYLOAD] Global data size: {global_data_size:,} bytes ({global_data_size/1024:.2f} KB)")
		if global_data_size > 10 * 1024:
			logger.warning(f"[PAYLOAD] WARNING: Global data exceeds 10 KB - consider trimming")
		
		logger.info(f"[OK] Global data set with nested+flat structure for {lead_context.get('name', 'Unknown')}")
		
		# 4. Determine initial context
		if phone:
			initial_context = self._get_initial_context(phone)
		else:
			logger.info("[INFO] No phone available; defaulting initial context to 'greet'")
			initial_context = "greet"
		logger.info(f"[TARGET] Initial context: {initial_context}")
		
		# 5. Build contexts from DB
		try:
			# CRITICAL: Add timeout protection to prevent configure_per_call from hanging
			contexts_obj = self._execute_with_timeout(
				build_contexts_object,
				10.0,  # 10 second timeout for context building (can be large payload)
				active_vertical,
				initial_context,
				lead_context
			)
		except FutureTimeoutError:
			logger.error(f"[TIMEOUT] Context building timed out after 10s for vertical: {active_vertical}")
			# Use default contexts as fallback
			from equity_connect.services.default_contexts import DEFAULT_CONTEXTS
			contexts_obj = DEFAULT_CONTEXTS
			logger.warning("[FALLBACK] Using default contexts due to timeout")
		except Exception as e:
			logger.error(f"[ERROR] Failed to build contexts: {e}")
			# Use default contexts as fallback
			from equity_connect.services.default_contexts import DEFAULT_CONTEXTS
			contexts_obj = DEFAULT_CONTEXTS
			logger.warning("[FALLBACK] Using default contexts due to error")
		
		# 6. Load theme WITH lead_context for variable substitution
		try:
			theme_text = load_theme(active_vertical, lead_context=lead_context)
		except Exception as e:
			logger.error(f"[ERROR] Failed to load theme: {e}")
			raise
		
		# 7. Configure agent with contexts using builder API
		# Apply theme using prompt_add_section
		theme_size = len(theme_text.encode('utf-8'))
		logger.info(f"[PAYLOAD] Theme text size: {theme_size:,} bytes ({theme_size/1024:.2f} KB)")
		agent.prompt_add_section("Personality", body=theme_text)
		
		# Log context instructions sizes
		total_context_size = 0
		for ctx_name, ctx_config in contexts_obj.items():
			ctx_size = 0
			for step in ctx_config.get("steps", []):
				step_text = step.get("text", "")
				step_size = len(step_text.encode('utf-8'))
				ctx_size += step_size
			total_context_size += ctx_size
			if ctx_size > 0:
				logger.info(f"[PAYLOAD] Context '{ctx_name}' instructions: {ctx_size:,} bytes ({ctx_size/1024:.2f} KB)")
		logger.info(f"[PAYLOAD] Total context instructions: {total_context_size:,} bytes ({total_context_size/1024:.2f} KB)")
		
		# Build contexts using builder API
		# DISABLED FOR TESTING - Using hardcoded contexts in __init__ instead
		# self._apply_contexts_via_builder(agent, contexts_obj)
		logger.info("[TESTING] Skipping database contexts - using hardcoded contexts from __init__")
		
		# Estimate total payload size
		estimated_total = global_data_size + theme_size + total_context_size
		logger.info(f"[PAYLOAD] Estimated total payload: {estimated_total:,} bytes ({estimated_total/1024:.2f} KB)")
		if estimated_total > 50 * 1024:
			logger.warning(f"[PAYLOAD] WARNING: Estimated payload exceeds 50 KB - close to 64 KB limit!")
		elif estimated_total > 60 * 1024:
			logger.error(f"[PAYLOAD] ERROR: Estimated payload exceeds 60 KB - may cause hangups!")
		
		logger.info(f"[OK] Agent configured with {len(contexts_obj)} contexts via builder API")
		
		# CRITICAL: configure_per_call requires NO return value
		# If you see a return dict here, you're doing it wrong
	
	def _override_prompt_for_test(self, agent, vertical: str, node_name: str, content: dict):
		"""
		Override agent's prompt configuration for testing.
		This replaces the active prompt with the test version.
		"""
		logger.info(f"[TEST] Overriding prompt for test: {vertical}/{node_name}")
		
		# Load theme for the vertical (without lead_context for test mode)
		try:
			theme_text = load_theme(vertical, lead_context=None)
		except Exception as e:
			logger.warning(f"Could not load theme for {vertical}: {e}, using default")
			theme_text = f"You are Barbara, a helpful AI assistant for {vertical}."
		
		# Build a minimal context object for the test node
		# The content dict should have: role, instructions, tools
		test_context = {
			"steps": [
				{
					"name": "main",
					"text": content.get('instructions', ''),
					"step_criteria": content.get('step_criteria', 'User has responded appropriately.'),
					"functions": content.get('tools', []) if isinstance(content.get('tools'), list) else []
				}
			]
		}
		
		# Add valid_contexts if present in content
		if content.get('valid_contexts'):
			test_context['valid_contexts'] = content['valid_contexts']
		
		# Build contexts object with test context as default
		contexts_obj = {
			"default": {
				"steps": [
					{
						"name": "entry",
						"text": f"Entering {node_name} context",
						"action": {
							"type": "set_context",
							"context": node_name
						}
					}
				]
			},
			node_name: test_context
		}
		
		# Configure agent with test prompt using builder API
		# Apply theme using prompt_add_section
		agent.prompt_add_section("Personality", body=theme_text)
		
		# Build contexts using builder API
		self._apply_contexts_via_builder(agent, contexts_obj)
		
		logger.info(f"[OK] Prompt override complete for test: {node_name} via builder API")
		
		# CRITICAL: _override_prompt_for_test requires NO return value
		# If you see a return dict here, you're doing it wrong


	def _apply_contexts_via_builder(self, agent_instance, contexts_data: Dict[str, Any]) -> None:
		"""Apply contexts using proper ContextBuilder API
		
		Args:
			agent_instance: Agent or EphemeralAgentConfig instance
			contexts_data: Dict from build_contexts_object() with structure:
				{
					"context_name": {
						"steps": [{"name": "...", "text": "...", "functions": [...], ...}],
						"valid_contexts": [...]
					}
				}
		
		CRITICAL: Uses builder API exclusively - no custom dict returns
		CRITICAL: DO NOT return anything - SDK handles serialization automatically
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
				# CRITICAL: Default to False (wait for user) if not explicitly set
				# This prevents tools from being called before greeting
				# Convert string "false"/"true" to boolean (JSONB stores as strings)
				skip_user_turn_raw = step_cfg.get("skip_user_turn", False)
				if isinstance(skip_user_turn_raw, str):
					skip_user_turn = skip_user_turn_raw.lower() in ('true', '1', 'yes')
				else:
					skip_user_turn = bool(skip_user_turn_raw)
				step.skip_user_turn = skip_user_turn
				functions = self._ensure_list(step_cfg.get("functions"))
				if functions:
					step.set_functions(functions)
				valid_steps = self._ensure_list(step_cfg.get("valid_steps"))
				if valid_steps:
					step.set_valid_steps(valid_steps)

				step_valid_contexts = self._ensure_list(step_cfg.get("valid_contexts"))
				action = step_cfg.get("action")
				if action and action.get("type") == "set_context":
					target_ctx = action.get("context")
					if target_ctx and target_ctx not in step_valid_contexts:
						step_valid_contexts.append(target_ctx)
				if step_valid_contexts:
					step.set_valid_contexts(step_valid_contexts)

		# NO RETURN - SDK handles serialization automatically

	@staticmethod
	def _ensure_list(value: Optional[Any]) -> List[Any]:
		if value is None:
			return []
		if isinstance(value, list):
			return value
		return [value]

	@staticmethod
	def _extract_signalwire_value(*candidates: Optional[str]) -> Optional[str]:
		"""
		Return the first candidate that looks like a real value (not a literal placeholder such as '{call.xxx}' or '%{call.xxx}').
		Falls back to the last provided candidate even if placeholder when nothing else is available.
		"""
		def _is_placeholder(val: Optional[str]) -> bool:
			if not isinstance(val, str):
				return False
			trimmed = val.strip()
			return (
				trimmed.startswith("{call.") and trimmed.endswith("}")
				or trimmed.startswith("%{call.") and trimmed.endswith("}")
			)

		non_placeholder = [val for val in candidates if val and not _is_placeholder(val)]
		if non_placeholder:
			return non_placeholder[0]

		for val in reversed(candidates):
			if val:
				return val
		return None
	
	@staticmethod
	def _to_bool(value: Optional[Any]) -> bool:
		"""Coerce various representations into a boolean."""
		if isinstance(value, bool):
			return value
		if isinstance(value, str):
			return value.strip().lower() in {"true", "1", "yes", "on"}
		return bool(value)
	
	def _query_lead_direct(self, phone: str, broker_id: Optional[str] = None) -> Dict[str, Any]:
		"""Query Supabase directly for lead information
		
		Cannot call tools from configure_per_call (sync vs async mismatch).
		Uses lead_service.get_lead_context_core for lead data lookup.
		
		Args:
			phone: Caller phone number
			broker_id: Optional broker UUID override
			
		Returns:
			Dict with lead, property, broker info
		"""
		from equity_connect.services.supabase import get_supabase_client
		import re
		
		sb = get_supabase_client()
		
		try:
			logger.info(f"[LOOKUP] Looking up lead by phone: {phone}")
			
			# Generate search patterns (same logic as tool)
			phone_digits = re.sub(r'\D', '', phone)
			last10 = phone_digits[-10:] if len(phone_digits) >= 10 else phone_digits
			patterns = [
				phone,
				last10,
				f"+1{last10}" if len(last10) == 10 else phone,
			]
			
			# Build OR query
			or_conditions = []
			for pattern in patterns:
				if pattern:
					or_conditions.append(f"primary_phone.ilike.%{pattern}%")
					or_conditions.append(f"primary_phone_e164.eq.{pattern}")
			
			if not or_conditions:
				logger.warning("Invalid phone number")
				return {
					"name": "Unknown",
					"first_name": "there",
					"last_name": "",
					"email": "",
					"primary_email": "",
					"phone": "",
					"primary_phone": "",
					"lead_id": "",
					"property_city": "Unknown",
					"property_state": "",
					"property_address": "",
					"property_zip": "",
					"property_value": "",
					"estimated_equity": 0,
					"age": "",
					"qualified": False,
					"broker_name": "",
					"broker_company": "",
					"broker_phone": "",
					"broker_email": ""
				}
			
			# Query lead with broker join
			query = sb.table('leads').select('''
				id, first_name, last_name, primary_email, primary_phone,
				property_address, property_city, property_state, property_zip,
				property_value, estimated_equity, status, qualified, age,
				brokers:assigned_broker_id (
					id, contact_name, company_name, phone, email
				)
			''')
			or_filter = ','.join(or_conditions)
			response = query.or_(or_filter).limit(1).execute()
			
			if not response.data or len(response.data) == 0:
				logger.info('Lead not found - new caller')
				return {
					"name": "Unknown",
					"first_name": "there",
					"last_name": "",
					"email": "",
					"primary_email": "",
					"phone": "",
					"primary_phone": "",
					"lead_id": "",
					"property_city": "Unknown",
					"property_state": "",
					"property_address": "",
					"property_zip": "",
					"property_value": "",
					"estimated_equity": 0,
					"age": "",
					"qualified": False,
					"broker_name": "",
					"broker_company": "",
					"broker_phone": "",
					"broker_email": ""
				}
			
			lead = response.data[0]
			broker = lead.get('brokers')
			
			# Determine qualification
			is_qualified = lead.get('status') in ['qualified', 'appointment_set', 'showed', 'application', 'funded']
			
			# Build full name
			first_name = lead.get('first_name', '')
			last_name = lead.get('last_name', '')
			full_name = f"{first_name} {last_name}".strip() or "Unknown"
			
			logger.info(f"[OK] Lead found: {full_name} ({lead.get('status')})")
			
			# Return structured dict with all fields needed for variable substitution
			return {
				"name": full_name,
				"first_name": first_name,
				"last_name": last_name,
				"email": lead.get('primary_email', ''),
				"primary_email": lead.get('primary_email', ''),  # Alias for contexts_builder
				"phone": lead.get('primary_phone', ''),
				"primary_phone": lead.get('primary_phone', ''),  # Alias for contexts_builder
				"lead_id": str(lead['id']),
				"status": lead.get('status', ''),  # Include status for appointment_set handling
				"property_city": lead.get('property_city', 'Unknown'),
				"property_state": lead.get('property_state', ''),
				"property_address": lead.get('property_address', ''),
				"property_zip": lead.get('property_zip', ''),
				"property_value": lead.get('property_value', ''),
				"estimated_equity": lead.get('estimated_equity', 0),
				"age": lead.get('age', ''),
				"qualified": is_qualified,
				"broker_name": broker.get('contact_name', '') if broker else '',
				"broker_company": broker.get('company_name', '') if broker else '',
				"broker_phone": broker.get('phone', '') if broker else '',
				"broker_email": broker.get('email', '') if broker else ''
			}
			
		except Exception as e:
			logger.error(f'[ERROR] Error getting lead context: {e}')
			return {
				"name": "Unknown",
				"first_name": "there",
				"last_name": "",
				"email": "",
				"primary_email": "",
				"phone": "",
				"primary_phone": "",
				"lead_id": "",
				"property_city": "Unknown",
				"property_state": "",
				"property_address": "",
				"property_zip": "",
				"property_value": "",
				"estimated_equity": 0,
				"age": "",
				"qualified": False,
				"broker_name": "",
				"broker_company": "",
				"broker_phone": "",
				"broker_email": ""
			}
	
	def _get_initial_context(self, phone: str) -> str:
		"""Always start at GREET context - POM handles routing based on global_data flags
		
		POM routing: The GREET context checks global_data flags (ready_to_book, quote_presented, etc.)
		and routes to appropriate context via valid_contexts and step_criteria.
		
		Args:
			phone: Caller's phone number (unused - always returns "greet")
			
		Returns:
			Always "greet" - POM handles all routing
		"""
		logger.info("[SCENE] Starting at greet - POM will route based on global_data flags")
		return "greet"
	
	def _get_voice_config(self, vertical: str = "reverse_mortgage", language_code: str = "en-US") -> Dict[str, Any]:
		"""Load voice configuration from database
		
		Args:
			vertical: Business vertical
			language_code: Language code (en-US, es-US, es-MX)
			
		Returns:
			Dict with: engine, voice_name, model (nullable)
		"""
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
				logger.info(f"[OK] Loaded voice config from DB: {result.data['tts_engine']} - {result.data['voice_name']}")
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
		
		logger.info(f"Using env fallback: {engine} - {voice_name}")
		return {
			"engine": engine,
			"voice_name": voice_name,
			"model": model
		}

	def _ensure_skill(self, agent_obj, skill_name: str):
		"""
		Safely load a SignalWire skill only if it's not already present.
		This prevents ValueError: Skill already loaded.
		"""
		try:
			if hasattr(agent_obj, "has_skill") and agent_obj.has_skill(skill_name):
				logger.debug(f"[REPEAT] Skill '{skill_name}' already loaded, skipping")
				return
			agent_obj.add_skill(skill_name)
			logger.info(f"[OK] Added skill '{skill_name}'")
		except Exception as exc:
			logger.warning(f"[WARN] Could not add skill '{skill_name}': {exc}")
	
	def _create_test_state(self) -> Dict[str, Any]:
		return {
			"mode": False,
			"use_draft": False,
			"start_node": None,
			"stop_on_route": False,
			"nodes_visited": [],
			"pending_events": [],
			"completed": False,
			"current_call_phone": None,
			"vertical": "reverse_mortgage",
			"call_mode": "full",
		}
	
	def _get_test_state(self) -> Dict[str, Any]:
		try:
			return self._test_state_ctx.get()
		except LookupError:
			state = self._create_test_state()
			self._test_state_ctx.set(state)
			return state
	
	@property
	def _test_mode(self) -> bool:
		return self._get_test_state()["mode"]
	
	@_test_mode.setter
	def _test_mode(self, value: bool) -> None:
		self._get_test_state()["mode"] = bool(value)
	
	@property
	def _test_use_draft(self) -> bool:
		return self._get_test_state()["use_draft"]
	
	@_test_use_draft.setter
	def _test_use_draft(self, value: bool) -> None:
		self._get_test_state()["use_draft"] = bool(value)
	
	@property
	def _test_start_node(self) -> Optional[str]:
		return self._get_test_state()["start_node"]
	
	@_test_start_node.setter
	def _test_start_node(self, value: Optional[str]) -> None:
		self._get_test_state()["start_node"] = value
	
	@property
	def _test_stop_on_route(self) -> bool:
		return self._get_test_state()["stop_on_route"]
	
	@_test_stop_on_route.setter
	def _test_stop_on_route(self, value: bool) -> None:
		self._get_test_state()["stop_on_route"] = bool(value)
	
	@property
	def _test_nodes_visited(self) -> List[str]:
		return self._get_test_state()["nodes_visited"]
	
	@_test_nodes_visited.setter
	def _test_nodes_visited(self, value: Optional[List[str]]) -> None:
		self._get_test_state()["nodes_visited"] = list(value or [])
	
	@property
	def _test_pending_events(self) -> List[Dict[str, Any]]:
		return self._get_test_state()["pending_events"]
	
	@_test_pending_events.setter
	def _test_pending_events(self, value: Optional[List[Dict[str, Any]]]) -> None:
		self._get_test_state()["pending_events"] = list(value or [])
	
	@property
	def _test_completed(self) -> bool:
		return self._get_test_state()["completed"]
	
	@_test_completed.setter
	def _test_completed(self, value: bool) -> None:
		self._get_test_state()["completed"] = bool(value)
	
	@property
	def _current_call_phone(self) -> Optional[str]:
		return self._get_test_state()["current_call_phone"]
	
	@_current_call_phone.setter
	def _current_call_phone(self, value: Optional[str]) -> None:
		self._get_test_state()["current_call_phone"] = value
	
	@property
	def _test_vertical(self) -> str:
		return self._get_test_state()["vertical"]
	
	@_test_vertical.setter
	def _test_vertical(self, value: Optional[str]) -> None:
		self._get_test_state()["vertical"] = (value or "reverse_mortgage").strip() or "reverse_mortgage"
	
	@property
	def _test_call_mode(self) -> str:
		return self._get_test_state()["call_mode"]
	
	@_test_call_mode.setter
	def _test_call_mode(self, value: Optional[str]) -> None:
		self._get_test_state()["call_mode"] = (value or "full").strip() or "full"
	
	def _reset_test_state(self):
		self._test_state_ctx.set(self._create_test_state())
	
	def _extract_test_config(self, user_vars: Dict[str, Any]) -> Dict[str, Any]:
		if not user_vars:
			return {
				"enabled": False,
				"use_draft": False,
				"start_node": None,
				"stop_on_route": False,
				"vertical": "reverse_mortgage",
				"mode": "full"
			}
		
		enabled = self._to_bool(user_vars.get('test_mode'))
		use_draft = self._to_bool(user_vars.get('use_draft', enabled))
		start_node = (user_vars.get('start_node') or '').strip().lower() or None
		stop_on_route = self._to_bool(user_vars.get('stop_on_route'))
		vertical = (user_vars.get('vertical') or 'reverse_mortgage').strip() or 'reverse_mortgage'
		mode = (user_vars.get('test_call_mode') or ('single' if stop_on_route else 'full')).strip().lower() or 'full'
		
		return {
			"enabled": enabled,
			"use_draft": use_draft,
			"start_node": start_node,
			"stop_on_route": stop_on_route,
			"vertical": vertical,
			"mode": mode
		}
	
	def _queue_test_event(self, event: Dict[str, Any]) -> None:
		self._test_pending_events.append(event)
	
	def _dequeue_test_events(self) -> List[Dict[str, Any]]:
		if not self._test_pending_events:
			return []
		events = list(self._test_pending_events)
		self._test_pending_events.clear()
		return events
	
	def _handle_test_context_change(self, context_name: Optional[str]) -> None:
		if not self._test_mode or not context_name or self._test_completed:
			return
		
		if self._test_nodes_visited and self._test_nodes_visited[-1] == context_name:
			return
		
		self._test_nodes_visited.append(context_name)
		
		self._queue_test_event({
			"type": "node_transition",
			"node_name": context_name,
			"path": list(self._test_nodes_visited),
			"timestamp": datetime.utcnow().isoformat() + "Z"
		})
		
		if self._test_stop_on_route and len(self._test_nodes_visited) > 1:
			self._complete_test_call()
	
	def _infer_context_from_state(self, phone: Optional[str]) -> Optional[str]:
		if not phone:
			return "greet"
		
		state = get_conversation_state(phone)
		if not state:
			return "greet"
		
		cd = state.get("conversation_data", {})
		qualified = state.get("qualified", False)
		
		# NOTE: appointment_booked removed - booked callbacks should start at GREET
		# EXIT context is only for ending conversations, not handling callbacks
		# All calls should start at an active context (greet, book, answer, etc.)
		
		if cd.get("ready_to_book"):
			return "book"
		if cd.get("quote_presented") and cd.get("quote_reaction") in ["positive", "skeptical"]:
			return "answer"
		if qualified and not cd.get("quote_presented"):
			return "quote"
		if cd.get("verified") and not qualified:
			return "qualify"
		if cd.get("greeted"):
			return "verify"
		return "greet"
	
	def _update_test_context_tracking(self):
		if not self._test_mode or not self._current_call_phone:
			return
		context_name = self._infer_context_from_state(self._current_call_phone)
		self._handle_test_context_change(context_name)
	
	def _apply_test_events_to_result(self, result: Any):
		if not self._test_mode:
			return result
		
		events = self._dequeue_test_events()
		if not events:
			return result
		
		if isinstance(result, SwaigFunctionResult):
			target = result
		else:
			response_text = result if isinstance(result, str) else ""
			target = SwaigFunctionResult(response_text)
		
		for event in events:
			target.swml_user_event(event)
		
		return target
	
	def _complete_test_call(self):
		if self._test_completed:
			return
		
		self._test_completed = True
		self._queue_test_event({
			"type": "test_complete",
			"path": list(self._test_nodes_visited),
			"mode": self._test_call_mode,
			"timestamp": datetime.utcnow().isoformat() + "Z"
		})
	
	def _build_voice_string(self, engine: str, voice_name: str) -> str:
		"""Build provider-specific voice string
		
		Args:
			engine: TTS provider (elevenlabs, openai, google, amazon, azure, cartesia, rime)
			voice_name: Voice identifier
			
		Returns:
			Formatted voice string for SignalWire
		"""
		# Map engine to voice format (based on SignalWire Voice API docs)
		formats = {
			"elevenlabs": f"elevenlabs.{voice_name}",  # e.g., elevenlabs.rachel
			"openai": f"openai.{voice_name}",  # e.g., openai.alloy
			"google": f"gcloud.{voice_name}",  # e.g., gcloud.en-US-Neural2-A
			"gcloud": f"gcloud.{voice_name}",  # Alias for google
			"amazon": f"amazon.{voice_name}",  # e.g., amazon.Ruth:neural
			"polly": f"amazon.{voice_name}",  # Alias for amazon
			"azure": voice_name,  # No prefix - e.g., en-US-JennyNeural
			"microsoft": voice_name,  # Alias for azure
			"cartesia": f"cartesia.{voice_name}",  # e.g., cartesia.a167e0f3-df7e-4d52-a9c3-f949145efdab
			"rime": f"rime.{voice_name}"  # e.g., rime.luna
		}
		
		voice_string = formats.get(engine.lower(), f"{engine}.{voice_name}")
		logger.debug(f"Built voice string: {voice_string} (engine: {engine}, voice: {voice_name})")
		return voice_string
	
	@AgentBase.tool(
		description=(
			"Call this when the caller asks a question in GREET context. "
			"This routes the conversation to ANSWER context where questions can be handled properly with knowledge base access."
		),
		parameters={
			"type": "object",
			"properties": {
				"user_question": {
					"type": "string",
					"description": "The question the user asked"
				}
			},
			"required": ["user_question"]
		}
	)
	def route_to_answer_for_question(self, args, raw_data):
		"""Tool: Route from GREET to ANSWER when user asks a question"""
		logger.info(f"=== TOOL CALLED - route_to_answer_for_question: {args.get('user_question')} ===")
		
		result = SwaigFunctionResult()
		result.response = "Great question! Let me help you with that."
		result.data = {"routed_to": "answer", "question": args.get("user_question")}
		
		# Use Holy Guacamole pattern: swml_change_step() to force transition
		result.swml_change_step("answer")
		
		logger.info(f"🔀 TOOL ROUTING: greet → answer (explicit swml_change_step)")
		return result
	
	@AgentBase.tool(
		description=(
			"Call this AFTER the caller has responded to your greeting. "
			"Ask them to confirm their name, then call this tool with first_name, last_name, and phone. "
			"This creates or updates the lead record. "
			"IMPORTANT: Only call this ONCE per call after identity is confirmed by the caller."
		),
		parameters={"type": "object", "properties": {"first_name": {"type": "string", "description": "Caller first name"}, "phone": {"type": "string", "description": "Caller phone"}}, "required": ["first_name", "phone"]}
	)
	def verify_caller_identity(self, args, raw_data):
		"""Tool: Verify caller identity (one-time use).
		
		After verifying, toggles itself OFF to save tokens (caller already verified).
		"""
		logger.error("=== TOOL CALLED - verify_caller_identity ===")
		try:
			# Add timeout protection for Supabase calls
			result_json = self._execute_with_timeout(
				lead_service.verify_caller_identity_core,
				5.0,  # 5 second timeout for identity verification
				args.get("first_name"), args.get("phone")
			)
			result_data = json.loads(result_json)
			
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except FutureTimeoutError:
			logger.error(f"[TIMEOUT] Caller identity verification timed out after 5s")
			swaig_result = SwaigFunctionResult()
			swaig_result.data = {"error": "timeout", "message": "Unable to verify caller identity at this time."}
			swaig_result.response = "Unable to verify caller identity at this time."
			return swaig_result
		except Exception as e:
			logger.error(f"[ERROR] verify_caller_identity failed: {e}", exc_info=True)
			swaig_result = SwaigFunctionResult()
			swaig_result.data = {"error": str(e), "message": "Unable to verify caller identity."}
			swaig_result.response = "Unable to verify caller identity."
			return swaig_result
	
	@AgentBase.tool(
		description="Check consent and DNC status for a phone number.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number to check"}}, "required": ["phone"]}
	)
	def check_consent_dnc(self, args, raw_data):
		"""Tool: Check consent/DNC status (one-time use).
		
		After checking, toggles itself OFF - consent status doesn't change mid-call.
		"""
		logger.error("=== TOOL CALLED - check_consent_dnc ===")
		phone = args.get("phone") if args else None
		
		if not phone:
			logger.warning("[WARN] check_consent_dnc called with no phone")
			error_data = {
				"can_call": True,  # Default to allowing call if we can't check
				"has_consent": False,
				"error": "No phone provided",
				"message": "Unable to verify calling permissions."
			}
			# Still toggle off even on error (one-time use)
			swaig_result = SwaigFunctionResult()
			swaig_result.data = error_data
			swaig_result.response = error_data["message"]
			return swaig_result
		
		try:
			result_json = lead_service.check_consent_dnc_core(phone)
			result_data = json.loads(result_json)
			logger.info(f"[OK] Consent check completed for: {phone}")
			
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except Exception as e:
			# CRITICAL: Always return a valid response to prevent call hangup
			logger.error(f"[ERROR] Consent check failed: {e}", exc_info=True)
			error_data = {
				"can_call": True,  # Default to allowing call on error (fail open)
				"has_consent": False,
				"is_dnc": False,
				"error": str(e),
				"message": "Unable to verify calling permissions."
			}
			swaig_result = SwaigFunctionResult()
			swaig_result.data = error_data
			swaig_result.response = error_data["message"]
			return swaig_result
	
	@AgentBase.tool(
		description="Update lead fields gathered during the call and merge conversation_data flags.",
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
				"conversation_data": {
					"type": "object",
					"description": "Conversation state flags to merge (e.g., interrupted_at_gate, needs_family_buy_in)",
					"additionalProperties": True,
					"nullable": True
				},
			},
			"required": ["lead_id"],
		}
	)
	def update_lead_info(self, args, raw_data):
		"""Tool: Update lead info with robust error handling."""
		logger.error("=== TOOL CALLED - update_lead_info ===")
		try:
			# Get lead_id from raw_data (global_data) if not provided in args
			lead_id = args.get("lead_id")
			if not lead_id and raw_data:
				global_data = raw_data.get("global_data", {})
				lead_data = global_data.get("lead", {})
				lead_id = lead_data.get("id")
			
			# If still no lead_id, try to get from phone using sync function
			if not lead_id:
				phone = args.get("phone")
				if not phone and raw_data:
					global_data = raw_data.get("global_data", {})
					lead_data = global_data.get("lead", {})
					phone = lead_data.get("phone")
				
				if phone:
					lead_context_json = lead_service.get_lead_context_core(phone)
					lead_context = json.loads(lead_context_json)
					if lead_context.get("found") and lead_context.get("lead_id"):
						lead_id = lead_context["lead_id"]
			
			if not lead_id:
				raise ValueError("lead_id is required. Provide it in args or ensure phone is in global_data.")
			
			result_json = lead_service.update_lead_info_core(
				lead_id, args.get("first_name"), args.get("last_name"),
				args.get("email"), args.get("phone"), args.get("property_address"),
				args.get("property_city"), args.get("property_state"), args.get("property_zip"),
				args.get("age"), args.get("money_purpose"), args.get("amount_needed"),
				args.get("timeline"), args.get("conversation_data")
			)
			result_data = json.loads(result_json)
			
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"[ERROR] update_lead_info failed: {e}", exc_info=True)
			error_data = {"success": False, "error": str(e), "message": "Unable to update lead information."}
			swaig_result = SwaigFunctionResult()
			swaig_result.data = error_data
			swaig_result.response = error_data["message"]
			return swaig_result
	
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
		"""Tool: Find a broker by territory (one-time use).
		
		After finding broker, toggles itself OFF - broker assignment doesn't change mid-call.
		"""
		logger.error("=== TOOL CALLED - find_broker_by_territory ===")
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
			error_data = {"error": str(e), "message": "Unable to find broker for this territory."}
			swaig_result = SwaigFunctionResult()
			swaig_result.data = error_data
			swaig_result.response = error_data["message"]
			return swaig_result
	
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
	def check_broker_availability(self, args, raw_data):
		"""Tool: Check broker availability with robust error handling."""
		logger.error("=== TOOL CALLED - check_broker_availability ===")
		try:
			# Get broker_id from args or global_data (LLM may pass broker name instead)
			broker_id = args.get("broker_id") or raw_data.get("global_data", {}).get("broker", {}).get("id")
			
			if not broker_id:
				logger.error("[ERROR] No broker_id available in args or global_data")
				error_data = {"error": "no_broker", "message": "I don't have broker information available. Let me connect you with a specialist."}
				swaig_result = SwaigFunctionResult()
				swaig_result.data = error_data
				swaig_result.response = error_data["message"]
				return swaig_result
			
			# Add timeout protection for Nylas API calls
			result_json = self._execute_with_timeout(
				calendar_service.check_broker_availability_core,
				6.0,  # 6 second timeout for calendar API
				broker_id,
				args.get("preferred_day"),
				args.get("preferred_time"),
				raw_data,
			)
			result_data = json.loads(result_json)
			
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except FutureTimeoutError:
			logger.error(f"[TIMEOUT] Broker availability check timed out after 6s")
			error_data = {"error": "timeout", "message": "I'm having trouble checking availability right now. Let me connect you with a specialist."}
			swaig_result = SwaigFunctionResult()
			swaig_result.data = error_data
			swaig_result.response = error_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"[ERROR] check_broker_availability failed: {e}", exc_info=True)
			error_data = {"error": str(e), "message": "Unable to check broker availability."}
			swaig_result = SwaigFunctionResult()
			swaig_result.data = error_data
			swaig_result.response = error_data["message"]
			return swaig_result
	
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
	def book_appointment(self, args, raw_data):
		"""Tool: Book an appointment (one-time use).
		
		After booking, toggles itself OFF - can't book twice in one call.
		"""
		logger.error("=== TOOL CALLED - book_appointment ===")
		try:
			# Add timeout protection for Nylas API calls
			result_json = self._execute_with_timeout(
				calendar_service.book_appointment_core,
				8.0,  # 8 second timeout for booking (can be slower)
				args.get("lead_id"),
				args.get("broker_id"),
				args.get("scheduled_for"),
				args.get("notes"),
				raw_data,
			)
			result_data = json.loads(result_json)
			
			swaig_result = SwaigFunctionResult()
			swaig_result.data = result_data
			if result_data.get("message"):
				swaig_result.response = result_data["message"]
			return swaig_result
		except FutureTimeoutError:
			logger.error(f"[TIMEOUT] Appointment booking timed out after 8s")
			error_data = {"success": False, "error": "timeout", "message": "I'm having trouble booking that appointment right now. Let me connect you with a specialist who can help."}
			swaig_result = SwaigFunctionResult()
			swaig_result.data = error_data
			swaig_result.response = error_data["message"]
			return swaig_result
		except Exception as e:
			logger.error(f"[ERROR] book_appointment failed: {e}", exc_info=True)
			error_data = {"success": False, "error": str(e), "message": "Unable to book appointment. Please try again or contact us directly."}
			swaig_result = SwaigFunctionResult()
			swaig_result.data = error_data
			swaig_result.response = error_data["message"]
			return swaig_result
	
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
		"""Tool: Reschedule appointment with robust error handling."""
		logger.error("=== TOOL CALLED - reschedule_appointment ===")
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
			error_data = {"success": False, "error": str(e), "message": "Unable to reschedule appointment."}
			swaig_result = SwaigFunctionResult()
			swaig_result.data = error_data
			swaig_result.response = error_data["message"]
			return swaig_result
	
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
		"""Tool: Cancel appointment with robust error handling."""
		logger.error("=== TOOL CALLED - cancel_appointment ===")
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
			error_data = {"success": False, "error": str(e), "message": "Unable to cancel appointment."}
			swaig_result = SwaigFunctionResult()
			swaig_result.data = error_data
			swaig_result.response = error_data["message"]
			return swaig_result
	
	# Knowledge (1)
	@AgentBase.tool(
		description="Search reverse mortgage knowledge base for accurate answers.",
		parameters={"type": "object", "properties": {"question": {"type": "string", "description": "Question text"}}, "required": ["question"]},
		meta_data_token="search_knowledge_v1"
	)
	def search_knowledge(self, args, raw_data):
		"""Tool: Search knowledge base with robust error handling to prevent call hangups."""
		logger.error("=== TOOL CALLED - search_knowledge ===")
		question = args.get("question") if args else None
		
		if not question:
			logger.warning("[WARN] search_knowledge called with no question")
			result = SwaigFunctionResult()
			result.response = "I'd be happy to connect you with one of our specialists who can answer that question in detail."
			return result
		
		try:
			# Call the knowledge service with timeout protection (8 second hard cutoff)
			knowledge_json = self._execute_with_timeout(
				knowledge_service.search_knowledge_core,
				8.0,  # 8 second timeout
				question,
				raw_data
			)
			knowledge_data = json.loads(knowledge_json)
			logger.info(f"[OK] Knowledge search completed for: {question[:50]}...")
			
			# Format as natural language response for Barbara to speak
			if knowledge_data.get("found"):
				response_text = knowledge_data.get("answer", knowledge_data.get("message", ""))
			else:
				response_text = knowledge_data.get("message", "I couldn't find that information. Let me connect you with a specialist.")
			
			result = SwaigFunctionResult()
			result.response = response_text
			return result
		except FutureTimeoutError:
			# Timeout occurred - return fallback response immediately
			logger.error(f"[TIMEOUT] Knowledge search timed out after 8s for: {question[:50]}...")
			result = SwaigFunctionResult()
			result.response = "I'm having trouble accessing that information right now. Let me connect you with one of our specialists who can help answer your question."
			return result
		except Exception as e:
			# CRITICAL: Always return a valid SwaigFunctionResult to prevent call hangup
			logger.error(f"[ERROR] Knowledge search failed: {e}", exc_info=True)
			result = SwaigFunctionResult()
			result.response = "I'm having trouble accessing that information right now. Let me connect you with one of our specialists who can help answer your question."
			return result
	
	@AgentBase.tool(
		description=(
			"CRITICAL: Call this ONLY when user explicitly confirms NO MORE questions. "
			"Do NOT call this until: (1) You asked 'Any other questions?' AND (2) User said 'no', 'nope', 'that's all', 'I'm good'. "
			"This will route the conversation to the next appropriate context."
		),
		parameters={
			"type": "object",
			"properties": {
				"next_context": {
					"type": "string",
					"description": "Where to route: 'book' (if ready to schedule), 'exit' (if needs time to think)",
					"enum": ["book", "exit"]
				}
			},
			"required": ["next_context"]
		}
	)
	def complete_questions(self, args, raw_data):
		"""Tool: Mark questions complete and route explicitly (Holy Guacamole pattern)"""
		next_ctx = args.get("next_context", "exit")
		logger.info(f"=== TOOL CALLED - complete_questions → {next_ctx} ===")
		
		result = SwaigFunctionResult()
		
		# Use Holy Guacamole pattern: swml_change_step()
		result.swml_change_step(next_ctx)
		
		result.data = {"questions_complete": True, "next_context": next_ctx}
		result.response = f"Understood. Let me help you with that."
		
		logger.info(f"🔀 TOOL ROUTING: answer → {next_ctx} (explicit swml_change_step)")
		
		return result
	
	@AgentBase.tool(
		description="Assign a SignalWire tracking number to a lead for attribution.",
		parameters={"type": "object", "properties": {"lead_id": {"type": "string", "description": "Lead UUID"}, "broker_id": {"type": "string", "description": "Broker UUID"}}, "required": ["lead_id", "broker_id"]}
	)
	def assign_tracking_number(self, args, raw_data):
		"""Tool: Assign tracking number (one-time use).
		
		After assigning, toggles itself OFF - tracking number doesn't change mid-call.
		"""
		logger.error("=== TOOL CALLED - assign_tracking_number ===")
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
			error_data = {"error": str(e), "message": "Unable to assign tracking number."}
			swaig_result = SwaigFunctionResult()
			swaig_result.data = error_data
			swaig_result.response = error_data["message"]
			return swaig_result
	
	@AgentBase.tool(
		description="Send appointment confirmation via SMS.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number"}, "appointment_datetime": {"type": "string", "description": "ISO 8601 datetime"}}, "required": ["phone", "appointment_datetime"]}
	)
	def send_appointment_confirmation(self, args, raw_data):
		"""Tool: Send appointment confirmation with robust error handling."""
		logger.error("=== TOOL CALLED - send_appointment_confirmation ===")
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
			error_data = {"success": False, "error": str(e), "message": "Unable to send confirmation."}
			swaig_result = SwaigFunctionResult()
			swaig_result.data = error_data
			swaig_result.response = error_data["message"]
			return swaig_result
	
	@AgentBase.tool(
		description="Verify appointment confirmation code from SMS.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number"}, "code": {"type": "string", "description": "Code to verify"}}, "required": ["phone", "code"]}
	)
	def verify_appointment_confirmation(self, args, raw_data):
		"""Tool: Verify appointment confirmation with robust error handling."""
		logger.error("=== TOOL CALLED - verify_appointment_confirmation ===")
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
			error_data = {"success": False, "error": str(e), "message": "Unable to verify confirmation code."}
			swaig_result = SwaigFunctionResult()
			swaig_result.data = error_data
			swaig_result.response = error_data["message"]
			return swaig_result
	
	# ==================== END TOOL DEFINITIONS ====================
	
	# NOTE: on_swml_request is NOT overridden
	# The SDK will call configure_per_call() automatically for each call
	# All prompt building happens in configure_per_call via ContextBuilder API
	
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
			logger.info(f"[STATS] Conversation completed: {summary}")
			
			if not summary:
				logger.warning("[WARN] No summary provided")
				return
			
			# Extract phone number from raw_data
			phone = None
			if raw_data:
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
							"call_ended_at": raw_data.get("timestamp") if raw_data else None
						}
					}).execute()
					
					logger.info(f"[OK] Call summary saved for lead {state_row['lead_id']}")
			else:
				logger.warning("[WARN] No phone number available to save summary")
				
		except Exception as e:
			logger.error(f"[ERROR] Failed to save call summary: {e}", exc_info=True)

