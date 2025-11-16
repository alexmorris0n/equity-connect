"""Barbara - AI Voice Agent for EquityConnect using SignalWire SDK"""
import os
import logging
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from signalwire_agents import AgentBase, ContextBuilder  # type: ignore
from signalwire_agents.core.function_result import SwaigFunctionResult  # type: ignore
from equity_connect.services.agent_config import get_agent_params
from equity_connect.services.contexts_builder import build_contexts_object, load_theme
from equity_connect.services.conversation_state import get_conversation_state
from signalwire_pom import PromptObjectModel  # type: ignore

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
			use_pom=True,  # Enable POM for contexts
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
		
		self._current_call_phone: Optional[str] = None
		self._reset_test_state()
		
		logger.info("✅ BarbaraAgent initialized with dynamic configuration and 21 tools")
	
	def configure_per_call(self, query_params: Dict[str, Any], body_params: Dict[str, Any], headers: Dict[str, Any], agent):
		"""Configure agent for incoming call using SignalWire contexts"""
		
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
					logger.warning(f"⚠️ Failed to parse prompt_payload from query params: {e}")
			logger.info(f"🧪 Found test mode vars in query_params: test_mode={test_mode}, version_id={version_id}")
		
		# Fallback: Check body_params for nested format (alternative/legacy format)
		if not test_mode and not version_id:
			user_vars = body_params.get('vars', {}).get('userVariables', {})
			if isinstance(user_vars, str):
				# Sometimes user_vars comes as JSON string
				try:
					user_vars = json.loads(user_vars)
				except json.JSONDecodeError as e:
					# JSON parsing failed - log error and raise to prevent silent failure
					logger.error(f"❌ Failed to parse user_vars JSON: {e}. Raw value: {user_vars[:100] if len(user_vars) > 100 else user_vars}")
					raise ValueError(f"Invalid JSON in userVariables: {e}") from e
				except Exception as e:
					# Unexpected error during JSON parsing
					logger.error(f"❌ Unexpected error parsing user_vars: {e}")
					raise ValueError(f"Failed to parse userVariables: {e}") from e
			
			if user_vars:
				test_mode = self._to_bool(user_vars.get('test_mode', False))
				version_id = user_vars.get('version_id')
				vertical = user_vars.get('vertical')
				node_name = user_vars.get('node_name')
				if user_vars.get('prompt_payload'):
					prompt_payload = user_vars.get('prompt_payload')
				logger.info(f"🧪 Found test mode vars in body_params: test_mode={test_mode}, version_id={version_id}")
		
		# Normalize prompt payload (if string)
		if isinstance(prompt_payload, str):
			try:
				prompt_payload = json.loads(prompt_payload)
			except Exception as e:
				logger.warning(f"⚠️ Failed to decode prompt_payload JSON: {e}")
				prompt_payload = None
		
		if test_mode and (version_id or prompt_payload):
			logger.info(f"🧪 TEST MODE: Loading prompt {'payload override' if prompt_payload else f'version {version_id}'}")
			
			# Load prompt content from database
			try:
				from equity_connect.test_barbara import get_prompt_version_from_db
				if prompt_payload:
					prompt_content = prompt_payload
					logger.info("🧪 Using inline prompt payload override for test mode")
					version_data = {}
				else:
					version_data = get_prompt_version_from_db(version_id)
					prompt_content = version_data.get('content', {})
				# Use vertical/node_name from query_params/body_params, or fallback to defaults / payload hints
				vertical = vertical or version_data.get('vertical') or 'reverse_mortgage'
				node_name = node_name or version_data.get('node_name') or 'greet'
				
				logger.info(f"✓ Loaded test prompt: {vertical}/{node_name}")
				
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
				
				logger.info(f"✅ Test mode configuration complete")
				return
				
			except Exception as e:
				logger.error(f"❌ Failed to load test prompt: {e}")
				raise
		else:
			# Normal call flow (production)
			logger.info("📞 Production call - using active prompts")
		
		# 1. Extract call info
		phone = body_params.get('From') or query_params.get('phone')
		broker_id = query_params.get('broker_id')
		call_direction = (
			body_params.get('Direction')
			or body_params.get('direction')
			or query_params.get('direction')
			or "inbound"
		)
		if isinstance(call_direction, str):
			call_direction = call_direction.lower()
		else:
			call_direction = "inbound"
		if call_direction not in {"inbound", "outbound"}:
			call_direction = "inbound"
		active_vertical = vertical or "reverse_mortgage"
		
		logger.info(f"📞 Configuring agent for {call_direction} call from {phone}")
		
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
		logger.info(f"✅ Voice configured: {voice_string} ({voice_config['engine']})")
		
		# 3. Get lead context
		try:
			lead_context = self._get_lead_context(phone, broker_id)
		except Exception as e:
			logger.error(f"❌ Failed to get lead context: {e}")
			raise
		
		# Use lead context phone as fallback when not provided (e.g., CLI tests)
		if not phone:
			phone = lead_context.get("phone") or lead_context.get("lead_phone") or lead_context.get("lead_id")
			if phone:
				logger.info(f"ℹ️ Using lead context phone fallback: {phone}")
		
		# 3b. Load runtime agent params
		agent_params = get_agent_params(vertical=active_vertical, language="en-US")
		caller_tz = lead_context.get("timezone") or agent_params.get("local_tz_default", "America/Los_Angeles")
		wait_for_user = True if call_direction == "inbound" else agent_params.get("wait_for_user_default", False)
		
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
			f"🎛️ Runtime params applied: wait_for_user={wait_for_user}, "
			f"attention_timeout={params_payload['attention_timeout']}ms"
		)
		
		# 4. Set meta_data variables (SignalWire substitutes in prompts)
		agent.set_global_data({
			"lead": {
				"first_name": lead_context.get("first_name", "there"),
				"name": lead_context.get("name", "Unknown"),
				"phone": phone,
				"email": lead_context.get("email", ""),
				"id": lead_context.get("lead_id", "")
			},
			"property": {
				"city": lead_context.get("property_city", "Unknown"),
				"state": lead_context.get("property_state", ""),
				"address": lead_context.get("property_address", ""),
				"equity": lead_context.get("estimated_equity", 0),
				"equity_formatted": f"${lead_context.get('estimated_equity', 0):,}" if lead_context.get('estimated_equity') else "$0"
			},
			"status": {
				"qualified": lead_context.get("qualified", False),
				"call_type": call_direction,
				"broker_name": lead_context.get("broker_name", ""),
				"broker_company": lead_context.get("broker_company", "")
			}
		})
		
		logger.info(f"✅ Variables set for {lead_context.get('name', 'Unknown')}")
		
		# 4. Determine initial context
		if phone:
			initial_context = self._get_initial_context(phone)
		else:
			logger.info("ℹ️ No phone available; defaulting initial context to 'greet'")
			initial_context = "greet"
		logger.info(f"🎯 Initial context: {initial_context}")
		
		# 5. Build contexts from DB
		try:
			contexts_obj = build_contexts_object(
				vertical=active_vertical,
				initial_context=initial_context,
				lead_context=lead_context
			)
		except Exception as e:
			logger.error(f"❌ Failed to build contexts: {e}")
			raise
		
		# 6. Load theme
		try:
			theme_text = load_theme(active_vertical)
		except Exception as e:
			logger.error(f"❌ Failed to load theme: {e}")
			raise
		
		# 7. Configure agent with contexts
		self._apply_prompt_and_contexts(theme_text, contexts_obj, agent_instance=agent)
		logger.info(f"✅ Agent configured with {len(contexts_obj)} contexts")
	
	def _override_prompt_for_test(self, agent, vertical: str, node_name: str, content: dict):
		"""
		Override agent's prompt configuration for testing.
		This replaces the active prompt with the test version.
		"""
		logger.info(f"🧪 Overriding prompt for test: {vertical}/{node_name}")
		
		# Load theme for the vertical
		try:
			theme_text = load_theme(vertical)
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
		
		# Configure agent with test prompt
		self._apply_prompt_and_contexts(theme_text, contexts_obj, agent_instance=agent)
		logger.info(f"✅ Prompt override complete for test: {node_name}")

	def _apply_prompt_and_contexts(self, theme_text: Optional[str], contexts_obj: Dict[str, Any], agent_instance=None):
		"""Apply prompt text and contexts using the current SignalWire SDK API."""
		target_agent = agent_instance or self
		target_agent.pom = PromptObjectModel()
		if theme_text:
			target_agent.prompt_add_section("Base Prompt", theme_text)
		contexts_builder = self._populate_contexts_from_dict(target_agent, contexts_obj)
		# Ensure SignalWire SDK knows contexts are defined so they serialize into SWML
		setattr(target_agent, "_contexts_builder", contexts_builder)
		setattr(target_agent, "_contexts_defined", True)

	def _populate_contexts_from_dict(self, agent_instance, contexts_obj: Dict[str, Any]):
		contexts_builder = ContextBuilder(agent_instance)
		for ctx_name, ctx_config in contexts_obj.items():
			if not ctx_config:
				continue
			context = contexts_builder.add_context(ctx_name)
			valid_contexts = self._ensure_list(ctx_config.get("valid_contexts"))
			if valid_contexts:
				context.set_valid_contexts(valid_contexts)
			if ctx_config.get("isolated") and hasattr(context, "set_isolated"):
				context.set_isolated(True)
			if ctx_config.get("enter_fillers") and hasattr(context, "set_enter_fillers"):
				context.set_enter_fillers(ctx_config["enter_fillers"])
			if ctx_config.get("exit_fillers") and hasattr(context, "set_exit_fillers"):
				context.set_exit_fillers(ctx_config["exit_fillers"])

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

		agent_instance.define_contexts(contexts_builder)
		return contexts_builder

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
	
	def _get_lead_context(self, phone: str, broker_id: Optional[str] = None) -> Dict[str, Any]:
		"""Query Supabase directly for lead information
		
		Cannot call tools from configure_per_call (sync vs async mismatch).
		Duplicates query logic from tools/lead.py get_lead_context.
		
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
			logger.info(f"🔍 Looking up lead by phone: {phone}")
			
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
					"lead_id": "",
					"property_city": "Unknown",
					"property_state": "",
					"property_address": "",
					"estimated_equity": 0,
					"qualified": False,
					"broker_name": "",
					"broker_company": ""
				}
			
			# Query lead with broker join
			query = sb.table('leads').select('''
				id, first_name, last_name, primary_email, primary_phone,
				property_address, property_city, property_state, property_zip,
				estimated_equity, status, qualified,
				brokers:assigned_broker_id (
					id, contact_name, company_name
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
					"lead_id": "",
					"property_city": "Unknown",
					"property_state": "",
					"property_address": "",
					"estimated_equity": 0,
					"qualified": False,
					"broker_name": "",
					"broker_company": ""
				}
			
			lead = response.data[0]
			broker = lead.get('brokers')
			
			# Determine qualification
			is_qualified = lead.get('status') in ['qualified', 'appointment_set', 'showed', 'application', 'funded']
			
			# Build full name
			first_name = lead.get('first_name', '')
			last_name = lead.get('last_name', '')
			full_name = f"{first_name} {last_name}".strip() or "Unknown"
			
			logger.info(f"✅ Lead found: {full_name} ({lead.get('status')})")
			
			# Return structured dict
			return {
				"name": full_name,
				"first_name": first_name,
				"last_name": last_name,
				"email": lead.get('primary_email', ''),
				"lead_id": str(lead['id']),
				"property_city": lead.get('property_city', 'Unknown'),
				"property_state": lead.get('property_state', ''),
				"property_address": lead.get('property_address', ''),
				"estimated_equity": lead.get('estimated_equity', 0),
				"qualified": is_qualified,
				"broker_name": broker.get('contact_name', '') if broker else '',
				"broker_company": broker.get('company_name', '') if broker else ''
			}
			
		except Exception as e:
			logger.error(f'❌ Error getting lead context: {e}')
			return {
				"name": "Unknown",
				"first_name": "there",
				"last_name": "",
				"email": "",
				"lead_id": "",
				"property_city": "Unknown",
				"property_state": "",
				"property_address": "",
				"estimated_equity": 0,
				"qualified": False,
				"broker_name": "",
				"broker_company": ""
			}
	
	def _get_initial_context(self, phone: str) -> str:
		"""Determine which context to start in based on conversation state
		
		Multi-call persistence: resume where caller left off.
		
		Args:
			phone: Caller's phone number
			
		Returns:
			Context name to start in (default: "greet")
		"""
		state = get_conversation_state(phone)
		
		if not state:
			logger.info("🆕 New caller - starting at greet")
			return "greet"
		
		cd = state.get("conversation_data", {})
		qualified = state.get("qualified", False)
		
		# Check in priority order (most complete first)
		if cd.get("appointment_booked"):
			logger.info("✅ Appointment booked - starting at exit")
			return "exit"
		
		if cd.get("ready_to_book"):
			logger.info("📅 Ready to book - starting at book")
			return "book"
		
		if cd.get("quote_presented") and cd.get("quote_reaction") in ["positive", "skeptical"]:
			logger.info("💰 Quote presented - starting at answer")
			return "answer"
		
		if qualified and not cd.get("quote_presented"):
			logger.info("✅ Qualified, no quote - starting at quote")
			return "quote"
		
		if cd.get("verified") and not qualified:
			logger.info("🔍 Verified, not qualified - starting at qualify")
			return "qualify"
		
		if cd.get("greeted"):
			logger.info("👋 Greeted, not verified - starting at verify")
			return "verify"
		
		logger.info("🎬 Starting from greet")
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
				logger.info(f"✅ Loaded voice config from DB: {result.data['tts_engine']} - {result.data['voice_name']}")
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
				logger.debug(f"🔁 Skill '{skill_name}' already loaded, skipping")
				return
			agent_obj.add_skill(skill_name)
			logger.info(f"✅ Added skill '{skill_name}'")
		except Exception as exc:
			logger.warning(f"⚠️ Could not add skill '{skill_name}': {exc}")
	
	def _reset_test_state(self):
		self._test_mode = False
		self._test_use_draft = False
		self._test_start_node: Optional[str] = None
		self._test_stop_on_route = False
		self._test_nodes_visited: List[str] = []
		self._test_pending_events: List[Dict[str, Any]] = []
		self._test_completed = False
		self._current_call_phone = None
		self._test_vertical = "reverse_mortgage"
		self._test_call_mode = "full"
	
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
		
		if cd.get("appointment_booked"):
			return "exit"
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
	
	# Lead Management (5)
	@AgentBase.tool(
		description="Get lead information by phone number; returns lead, broker, property context.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number of the lead (any format)"}}, "required": ["phone"]}
	)
	async def get_lead_context(self, args, raw_data):
		"""Tool wrapper: Get lead information by phone number"""
		print("🚨🚨🚨 WRAPPER CALLED - get_lead_context 🚨🚨🚨")  # DIAGNOSTIC
		logger.error("🚨🚨🚨 WRAPPER CALLED - get_lead_context 🚨🚨🚨")  # Force to ERROR level
		logger.debug(f"🔧 DEBUG: get_lead_context wrapper called with args: {args}")
		from equity_connect.tools.lead import get_lead_context as get_lead_context_impl
		result = await get_lead_context_impl(args.get("phone"))
		logger.debug(f"✅ DEBUG: get_lead_context tool returned result (length: {len(str(result)) if result else 0} chars)")
		return result
	
	@AgentBase.tool(
		description="Verify caller identity by name and phone. Creates lead if new.",
		parameters={"type": "object", "properties": {"first_name": {"type": "string", "description": "Caller first name"}, "phone": {"type": "string", "description": "Caller phone"}}, "required": ["first_name", "phone"]}
	)
	async def verify_caller_identity(self, args, raw_data):
		from equity_connect.tools.lead import verify_caller_identity as verify_caller_identity_impl
		return await verify_caller_identity_impl(args.get("first_name"), args.get("phone"))
	
	@AgentBase.tool(
		description="Check consent and DNC status for a phone number.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number to check"}}, "required": ["phone"]}
	)
	async def check_consent_dnc(self, args, raw_data):
		from equity_connect.tools.lead import check_consent_dnc as check_consent_dnc_impl
		return await check_consent_dnc_impl(args.get("phone"))
	
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
	async def update_lead_info(self, args, raw_data):
		from equity_connect.tools.lead import update_lead_info as update_lead_info_impl
		return await update_lead_info_impl(
			args.get("lead_id"), args.get("first_name"), args.get("last_name"),
			args.get("email"), args.get("phone"), args.get("property_address"),
			args.get("property_city"), args.get("property_state"), args.get("property_zip"),
			args.get("age"), args.get("money_purpose"), args.get("amount_needed"),
			args.get("timeline"), args.get("conversation_data")
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
		from equity_connect.tools.lead import find_broker_by_territory as find_broker_by_territory_impl
		return await find_broker_by_territory_impl(args.get("zip_code"), args.get("city"), args.get("state"))
	
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
		from equity_connect.tools.calendar import check_broker_availability as check_broker_availability_impl
		return await check_broker_availability_impl(args.get("broker_id"), args.get("preferred_day"), args.get("preferred_time"), raw_data)
	
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
		from equity_connect.tools.calendar import book_appointment as book_appointment_impl
		return await book_appointment_impl(args.get("lead_id"), args.get("broker_id"), args.get("scheduled_for"), args.get("notes"), raw_data)
	
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
		from equity_connect.tools.calendar import reschedule_appointment as reschedule_appointment_impl
		return await reschedule_appointment_impl(args.get("interaction_id"), args.get("new_scheduled_for"), args.get("reason"))
	
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
		from equity_connect.tools.calendar import cancel_appointment as cancel_appointment_impl
		return await cancel_appointment_impl(args.get("interaction_id"), args.get("reason"))
	
	# Knowledge (1)
	@AgentBase.tool(
		description="Search reverse mortgage knowledge base for accurate answers.",
		parameters={"type": "object", "properties": {"question": {"type": "string", "description": "Question text"}}, "required": ["question"]},
		meta_data_token="search_knowledge_v1"
	)
	async def search_knowledge(self, args, raw_data):
		from equity_connect.tools.knowledge import search_knowledge as search_knowledge_impl
		return await search_knowledge_impl(args.get("question"), raw_data)
	
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
		from equity_connect.tools.interaction import save_interaction as save_interaction_impl
		
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
		
		return await save_interaction_impl(
			args.get("lead_id"), args.get("broker_id"), args.get("duration_seconds"),
			args.get("outcome"), args.get("content"), args.get("recording_url"), metadata_json
		)
	
	@AgentBase.tool(
		description="Assign a SignalWire tracking number to a lead for attribution.",
		parameters={"type": "object", "properties": {"lead_id": {"type": "string", "description": "Lead UUID"}, "broker_id": {"type": "string", "description": "Broker UUID"}}, "required": ["lead_id", "broker_id"]}
	)
	async def assign_tracking_number(self, args, raw_data):
		from equity_connect.tools.interaction import assign_tracking_number as assign_tracking_number_impl
		return await assign_tracking_number_impl(args.get("lead_id"), args.get("broker_id"))
	
	@AgentBase.tool(
		description="Send appointment confirmation via SMS.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number"}, "appointment_datetime": {"type": "string", "description": "ISO 8601 datetime"}}, "required": ["phone", "appointment_datetime"]}
	)
	async def send_appointment_confirmation(self, args, raw_data):
		from equity_connect.tools.interaction import send_appointment_confirmation as send_appointment_confirmation_impl
		return await send_appointment_confirmation_impl(args.get("phone"), args.get("appointment_datetime"))
	
	@AgentBase.tool(
		description="Verify appointment confirmation code from SMS.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Phone number"}, "code": {"type": "string", "description": "Code to verify"}}, "required": ["phone", "code"]}
	)
	async def verify_appointment_confirmation(self, args, raw_data):
		from equity_connect.tools.interaction import verify_appointment_confirmation as verify_appointment_confirmation_impl
		return await verify_appointment_confirmation_impl(args.get("phone"), args.get("code"))
	
	# Conversation Flags (7)
	@AgentBase.tool(
		description="Mark caller as ready to book an appointment.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}}, "required": ["phone"]}
	)
	async def mark_ready_to_book(self, args, raw_data):
		from equity_connect.tools.conversation_flags import mark_ready_to_book as mark_ready_to_book_impl
		return await mark_ready_to_book_impl(args.get("phone"))
	
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
		from equity_connect.tools.conversation_flags import mark_has_objection as mark_has_objection_impl
		return await mark_has_objection_impl(args.get("phone"), args.get("current_node"), args.get("objection_type"))
	
	@AgentBase.tool(
		description="Mark that an objection has been resolved.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}}, "required": ["phone"]}
	)
	async def mark_objection_handled(self, args, raw_data):
		from equity_connect.tools.conversation_flags import mark_objection_handled as mark_objection_handled_impl
		return await mark_objection_handled_impl(args.get("phone"))
	
	@AgentBase.tool(
		description="Mark that caller's questions have been answered.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}}, "required": ["phone"]}
	)
	async def mark_questions_answered(self, args, raw_data):
		from equity_connect.tools.conversation_flags import mark_questions_answered as mark_questions_answered_impl
		return await mark_questions_answered_impl(args.get("phone"))
	
	@AgentBase.tool(
		description="Persist qualification outcome.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}, "qualified": {"type": "boolean", "description": "Qualified?"}}, "required": ["phone", "qualified"]}
	)
	async def mark_qualification_result(self, args, raw_data):
		from equity_connect.tools.conversation_flags import mark_qualification_result as mark_qualification_result_impl
		return await mark_qualification_result_impl(args.get("phone"), bool(args.get("qualified")))
	
	@AgentBase.tool(
		description="Mark that a quote has been presented with reaction.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}, "quote_reaction": {"type": "string", "description": "Reaction"}}, "required": ["phone", "quote_reaction"]}
	)
	async def mark_quote_presented(self, args, raw_data):
		from equity_connect.tools.conversation_flags import mark_quote_presented as mark_quote_presented_impl
		return await mark_quote_presented_impl(args.get("phone"), args.get("quote_reaction"))
	
	@AgentBase.tool(
		description="Mark wrong person; optionally indicate if right person is available.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}, "right_person_available": {"type": "boolean", "description": "Right person available?"}}, "required": ["phone"]}
	)
	async def mark_wrong_person(self, args, raw_data):
		from equity_connect.tools.conversation_flags import mark_wrong_person as mark_wrong_person_impl
		return await mark_wrong_person_impl(args.get("phone"), bool(args.get("right_person_available")))
	
	@AgentBase.tool(
		description="Clear all conversation flags for a fresh start.",
		parameters={"type": "object", "properties": {"phone": {"type": "string", "description": "Caller phone"}}, "required": ["phone"]}
	)
	async def clear_conversation_flags(self, args, raw_data):
		from equity_connect.tools.conversation_flags import clear_conversation_flags as clear_conversation_flags_impl
		return await clear_conversation_flags_impl(args.get("phone"))
	
	# ==================== END TOOL DEFINITIONS ====================
	
	def on_swml_request(
		self,
		request_data: Optional[Dict[str, Any]] = None,
		callback_path: Optional[str] = None,
		request: Optional[Any] = None
	) -> Optional[Dict[str, Any]]:
		"""Handle incoming call - configure agent with SignalWire contexts
		
		SignalWire calls this BEFORE the agent starts talking for SWML webhook flows.
		This is the PRIMARY configuration method for production (not configure_per_call).
		
		Args:
			request_data: Call parameters from SignalWire (From, To, CallSid, etc.)
			callback_path: Callback path (unused)
			request: FastAPI Request object (unused)
			
		Returns:
			Optional SWML modifications (None = use defaults)
		"""
		try:
			raw_request_payload = json.dumps(request_data, indent=2, default=str)
		except (TypeError, ValueError) as exc:
			raw_request_payload = str(request_data)
			logger.warning(f"⚠️ Unable to JSON serialize request_data for logging: {exc}")
		logger.info(f"📞 RAW REQUEST DATA: {raw_request_payload}")
		logger.info(f"📞 DEBUG: on_swml_request called with request_data keys: {list(request_data.keys()) if request_data else 'None'}")
		logger.debug(f"📞 DEBUG: Full request_data: {request_data}")
		logger.debug(f"📞 DEBUG: request_data type: {type(request_data)}")
		
		try:
			self._reset_test_state()
			
			# ==================== STEP 1: EXTRACT CALL CONTEXT ====================
			# Extract call parameters from SignalWire
			# SignalWire sends data in nested 'call' dict
			if request_data:
				call_data = request_data.get("call", {}) or {}
				from_phone = self._extract_signalwire_value(
					call_data.get("from")
					or call_data.get("from_number"),
					request_data.get("From")
					or request_data.get("from_number"),
					call_data.get("caller_id_num"),
				)
				to_phone = self._extract_signalwire_value(
					call_data.get("to")
					or call_data.get("to_number"),
					request_data.get("To")
					or request_data.get("to_number"),
					call_data.get("call_to"),
				)
				call_sid = self._extract_signalwire_value(
					call_data.get("call_id")
					or call_data.get("sid"),
					request_data.get("CallSid")
					or request_data.get("call_id"),
					call_data.get("segment_id")
					or call_data.get("id"),
				)
			else:
				from_phone = None
				to_phone = None
				call_sid = None
			
			# Determine call direction
			# For inbound: From = caller's number, To = our SignalWire number
			# For outbound: From = our SignalWire number, To = lead's number
			user_vars = {}
			if request_data:
				call_data = request_data.get("call", {}) or {}
				call_direction_value = self._extract_signalwire_value(
					call_data.get("direction"),
					request_data.get("Direction") or request_data.get("direction"),
					"inbound"
				)
				if isinstance(call_direction_value, str):
					call_direction = call_direction_value.lower()
				else:
					call_direction = "inbound"
				user_vars = call_data.get("user_variables") or call_data.get("userVariables") or {}
			else:
				call_direction = "inbound"
			
			if not user_vars:
				user_vars = (request_data or {}).get("userVariables") or {}
				if not user_vars:
					user_vars = (request_data or {}).get("vars", {}).get("userVariables", {})
			
			test_config = self._extract_test_config(user_vars)
			self._test_mode = test_config["enabled"]
			self._test_use_draft = test_config["use_draft"]
			self._test_start_node = test_config["start_node"]
			self._test_stop_on_route = test_config["stop_on_route"]
			self._test_call_mode = test_config["mode"]
			self._test_vertical = test_config["vertical"]
			
			# Determine which phone number to use for DB lookup
			if call_direction == "inbound":
				phone = from_phone  # Caller's number
			else:
				phone = to_phone  # Lead's number (we're calling them)
			
			self._current_call_phone = phone
			logger.info(f"📞 {call_direction.upper()} call: From={from_phone}, To={to_phone}, CallSid={call_sid}")
			active_vertical = self._test_vertical or "reverse_mortgage"
			
			# ==================== STEP 2: CONFIGURE AI ====================
			# This is CRITICAL for SWML webhook flows - configure_per_call() is NOT called
			# Apply ALL configuration BEFORE loading prompts
			
			# Load voice configuration from database (configurable per language)
			voice_config = self._get_voice_config(vertical=active_vertical, language_code="en-US")
			voice_string = self._build_voice_string(voice_config["engine"], voice_config["voice_name"])
			
			# Configure language with dynamic voice
			language_params = {
				"name": "English",
				"code": "en-US",
				"voice": voice_string,
				"engine": voice_config["engine"],
				"speech_fillers": ["Let me check on that...", "One moment please...", "I'm looking that up now..."],
				"function_fillers": ["Processing...", "Just a second...", "Looking that up..."]
			}
			
			# Add model if specified (for Rime Arcana, Amazon Neural/Generative, etc.)
			if voice_config.get("model"):
				language_params["model"] = voice_config["model"]
			
			self.add_language(**language_params)
			logger.info(f"✅ Voice configured: {voice_string} ({voice_config['engine']})")
			
			# LLM and conversation parameters (load from Supabase agent_params table)
			agent_params = get_agent_params(vertical=active_vertical, language="en-US")
			caller_tz = agent_params.get("local_tz_default", "America/Los_Angeles")
			wait_for_user = True if call_direction == "inbound" else agent_params.get("wait_for_user_default", False)
			
			params_payload = {
				"ai_model": agent_params.get("ai_model", "gpt-4o-mini"),
				"wait_for_user": wait_for_user,
				"direction": call_direction,
				"local_tz": caller_tz,
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
				"temperature": 0.7,
				"max_tokens": 150,
				"top_p": 0.9,
				"swaig_post_conversation": True,
				"swaig_allow_swml": True,
				"swaig_allow_settings": True,
				"swaig_set_global_data": True,
				"function_wait_for_talking": False,
				"debug_webhook_url": os.getenv("SIGNALWIRE_DEBUG_WEBHOOK_URL"),
				"debug_webhook_level": 1,
			}
			self.set_params(params_payload)
			logger.info(
				f"✅ AI params configured via Supabase: wait_for_user={wait_for_user}, "
				f"attention_timeout={params_payload['attention_timeout']}ms"
			)
			
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
			
			# Skills: datetime and math
			try:
				self.add_skill("datetime")
				logger.info("✅ Added datetime skill")
			except Exception as e:
				logger.debug(f"Skill 'datetime' already loaded: {e}")
			try:
				self.add_skill("math")
				logger.info("✅ Added math skill")
			except Exception as e:
				logger.debug(f"Skill 'math' already loaded: {e}")
			
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
			
			# ==================== STEP 3: LOAD LEAD BY PHONE NUMBER ====================
			# SignalWire only provides phone number, so we MUST look up lead by phone
			# For inbound: from_number is the caller (lead)
			# For outbound: to_number is the lead
			current_node = "greet"  # Default for new callers
			lead_context = None
			lead_id = None
			
			if phone:
				# Add a small delay at the start to let the call ring while we do the work
				# This ensures caller hears 1-2 rings while we load context
				import time
				start_time = time.time()
				logger.info(f"⏳ Starting context injection (call will ring during this time)")
				
				# CRITICAL: Always look up lead by phone number FIRST
				# SignalWire doesn't provide lead_id, we must find it from phone number
				logger.info(f"🔍 Looking up lead by phone number: {phone} (direction: {call_direction})")
				from equity_connect.services.supabase import get_supabase_client
				import re
				try:
					sb = get_supabase_client()
					# Generate search patterns (same logic as get_lead_context)
					phone_digits = re.sub(r'\D', '', phone)
					last10 = phone_digits[-10:] if len(phone_digits) >= 10 else phone_digits
					patterns = [phone, last10, f"+1{last10}" if len(last10) == 10 else phone]
					
					# Build OR query for phone lookup
					or_conditions = []
					for pattern in patterns:
						if pattern:
							or_conditions.append(f"primary_phone.ilike.%{pattern}%")
							or_conditions.append(f"primary_phone_e164.eq.{pattern}")
					
					if or_conditions:
						or_filter = ','.join(or_conditions)
						lead_lookup = sb.table('leads').select('id').or_(or_filter).limit(1).execute()
						
						if lead_lookup.data and len(lead_lookup.data) > 0:
							lead_id = str(lead_lookup.data[0]['id'])
							logger.info(f"✅ Found existing lead by phone: {lead_id}")
						else:
							logger.info(f"🆕 No lead found for {phone} - this is a new caller")
				except Exception as e:
					logger.warning(f"Failed to lookup lead by phone: {e}")
				
				# ==================== STEP 4: INITIALIZE CONVERSATION STATE ====================
				# Initialize or reuse conversation_state row for this call
				from equity_connect.services.conversation_state import start_call, get_conversation_state, update_conversation_state
				
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
				
				# If we found a lead_id, update conversation_state with it
				if lead_id:
					update_conversation_state(phone, {"lead_id": lead_id})
					logger.info(f"✅ Updated conversation_state with lead_id: {lead_id}")
				
				# Get conversation state (now with lead_id if found)
				state_row = get_conversation_state(phone)
				
				# ==================== STEP 5: LOAD FULL LEAD DATA ====================
				# If we found a lead, load full lead data for context injection
				if lead_id:
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
							
							# Build name - handle None/empty last_name gracefully (Pythonic pattern)
							full_name = " ".join([s for s in [lead_data.get('first_name'), lead_data.get('last_name')] if s])
							first_name = lead_data.get('first_name') or ''
							last_name = lead_data.get('last_name')
							
							lead_context = {
								"lead_id": lead_id,
								"name": full_name,
								"first_name": first_name,
								"last_name": last_name,
								"qualified": (state_row.get("qualified") if state_row else None) or lead_data.get('status') in ['qualified', 'appointment_set'],
								"property_address": lead_data.get('property_address'),
								"property_city": lead_data.get('property_city'),
								"property_state": lead_data.get('property_state'),
								"property_value": lead_data.get('property_value'),
								"estimated_equity": lead_data.get('estimated_equity'),
								"primary_email": lead_data.get('primary_email'),
								"age": lead_data.get('age'),
								"conversation_data": state_row.get("conversation_data", {}) if state_row else {}
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
									# Broker info (for calendar tools)
									"broker_id": lead_context["broker_id"],
									"broker_name": lead_context["broker_name"],
									"broker_company": lead_context.get("broker_company"),
									"broker_email": lead_context.get("broker_email"),
									"broker_phone": broker_data.get('phone'),
									"broker_nylas_grant_id": lead_context["broker_nylas_grant_id"],
									"broker_timezone": lead_context.get("broker_timezone"),
									# Lead identity (always know who they are)
									"lead_id": lead_context["lead_id"],
									"lead_name": lead_context["name"],
									"lead_first_name": lead_context["first_name"],
									"lead_phone": phone,
									"lead_email": lead_context.get("primary_email"),
									"lead_age": lead_context.get("age"),
									# Property info (this is a property-based product!)
									"property_address": lead_context.get("property_address"),
									"property_city": lead_context.get("property_city"),
									"property_state": lead_context.get("property_state"),
									"property_value": lead_context.get("property_value"),
									"estimated_equity": lead_context.get("estimated_equity"),
									# Status (don't re-qualify if already qualified)
									"qualified": lead_context.get("qualified"),
									"lead_status": lead_data.get('status'),
									"owner_occupied": lead_data.get('owner_occupied'),
									# Call metadata
									"call_direction": call_direction
								})
								logger.info(f"✅ Injected lead & broker data into global_data for persistent LLM memory")
							else:
								logger.info(f"👤 Loaded full lead data: {lead_context['name']}, {lead_context.get('property_city')}, {lead_context.get('property_state')} (no broker assigned)")
						else:
							logger.warning(f"Lead {lead_id} not found in leads table")
							lead_context = {
								"lead_id": lead_id,
								"qualified": state_row.get("qualified") if state_row else False,
								"conversation_data": state_row.get("conversation_data", {}) if state_row else {}
							}
					except Exception as e:
						logger.error(f"Failed to load lead data: {e}")
						lead_context = {
							"lead_id": lead_id,
							"qualified": state_row.get("qualified") if state_row else False,
							"conversation_data": state_row.get("conversation_data", {}) if state_row else {}
						}
				
				# ==================== STEP 6: SET GLOBAL DATA VARIABLES ====================
				# Set variables for SignalWire to substitute in context prompts
				if lead_context:
					broker_full_name = lead_context.get("broker_name") or ""
					broker_first_name = broker_full_name.split(" ")[0] if broker_full_name else ""
					self.set_global_data({
						"lead": {
							"first_name": lead_context.get("first_name", "there"),
							"name": lead_context.get("name", "Unknown"),
							"phone": phone,
							"email": lead_context.get("email", ""),
							"id": lead_context.get("lead_id", "")
						},
						"property": {
							"city": lead_context.get("property_city", "Unknown"),
							"state": lead_context.get("property_state", ""),
							"address": lead_context.get("property_address", ""),
							"equity": lead_context.get("estimated_equity", 0),
							"equity_formatted": f"${lead_context.get('estimated_equity', 0):,}" if lead_context.get('estimated_equity') else "$0"
						},
						"broker": {
							"first_name": broker_first_name,
							"full_name": broker_full_name,
							"company": lead_context.get("broker_company", "")
						},
						"status": {
							"qualified": lead_context.get("qualified", False),
							"call_type": call_direction,
							"broker_name": lead_context.get("broker_name", ""),
							"broker_company": lead_context.get("broker_company", "")
						}
					})
					logger.info(f"✅ Variables set for {lead_context.get('name', 'Unknown')}")
				else:
					# Unknown caller - minimal global data
					self.set_global_data({
						"lead": {
							"first_name": "there",
							"name": "Unknown",
							"phone": phone or "Unknown",
							"email": "",
							"id": ""
						},
						"property": {
							"city": "Unknown",
							"state": "",
							"address": "",
							"equity": 0,
							"equity_formatted": "$0"
						},
						"broker": {
							"first_name": "",
							"full_name": "",
							"company": ""
						},
						"status": {
							"qualified": False,
							"call_type": call_direction,
							"broker_name": "",
							"broker_company": ""
						}
					})
				
				# ==================== STEP 7: DETERMINE INITIAL CONTEXT ====================
				if self._test_mode and self._test_start_node:
					initial_context = self._test_start_node
				else:
					initial_context = self._get_initial_context(phone)
				logger.info(f"🎯 Initial context: {initial_context}")
				
				# ==================== STEP 8: BUILD CONTEXTS FROM DB ====================
				try:
					contexts_obj = build_contexts_object(
						vertical=active_vertical,
						initial_context=initial_context,
						lead_context=lead_context,
						use_draft=self._test_use_draft
					)
				except Exception as e:
					logger.error(f"❌ Failed to build contexts: {e}")
					raise
				
				# ==================== STEP 9: LOAD THEME ====================
				try:
					theme_text = load_theme(active_vertical, use_draft=self._test_use_draft)
				except Exception as e:
					logger.error(f"❌ Failed to load theme: {e}")
					raise
				
				# ==================== STEP 10: APPLY CONTEXTS ====================
				self._apply_prompt_and_contexts(theme_text, contexts_obj)
				logger.info(f"✅ Agent configured with {len(contexts_obj)} contexts")
				
				if self._test_mode:
					self._handle_test_context_change(initial_context)
				
				logger.info(
					f"✅ Agent configured with contexts: voice={voice_string}, "
					f"model={params_payload.get('ai_model')}, initial_context={initial_context}, phone={phone}"
				)
			else:
				logger.warning("⚠️ No phone number found in request - using default configuration")
				# Apply fallback for unknown caller
				try:
					contexts_obj = build_contexts_object(
						vertical=active_vertical,
						initial_context="greet",
						lead_context=None,
						use_draft=self._test_use_draft
					)
					theme_text = load_theme(active_vertical, use_draft=self._test_use_draft)
					self._apply_prompt_and_contexts(theme_text, contexts_obj)
				except Exception as e:
					logger.error(f"Failed to build fallback contexts: {e}")
					raise
			
			# ==================== STEP 11: RETURN ====================
			# Return None - no SWML modifications needed, use SDK defaults
			return None
			
		except Exception as e:
			logger.error(f"❌ Error in on_swml_request: {e}", exc_info=True)
			# Fail loud - don't degrade gracefully
			raise
	
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
					
					logger.info(f"✅ Call summary saved for lead {state_row['lead_id']}")
			else:
				logger.warning("⚠️ No phone number available to save summary")
				
		except Exception as e:
			logger.error(f"❌ Failed to save call summary: {e}", exc_info=True)
	
