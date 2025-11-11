"""LiveKit Voice Agent - Clean rebuild with native plugins"""
import logging
import os
from typing import Optional
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RoomInputOptions,
    RoomOutputOptions,
    JobExecutorType,
    JobProcess,
    WorkerOptions,
    cli,
)
from livekit.plugins import silero

# Import English turn detector only to avoid registering multilingual runner at startup
from livekit.plugins.turn_detector import english  # noqa: F401

# Import ALL plugins at TOP LEVEL (required for plugin registration on main thread)
from livekit.plugins import deepgram, openai, assemblyai, elevenlabs, google
from livekit.plugins import noise_cancellation
from livekit.plugins import langchain as livekit_langchain  # Only the plugin itself

# Import your custom tools
from tools import all_tools


class EquityConnectAgent(Agent):
    """Voice agent for Equity Connect calls"""
    
    def __init__(self, instructions: str):
        super().__init__(
            instructions=instructions,
            tools=all_tools,  # Your custom Supabase RAG/KB tools
        )
    
    async def on_enter(self):
        """Called when agent joins - greet the user"""
        self.session.generate_reply(
            instructions="Greet the user warmly and ask how you can help them today."
        )


# Import config
from config import Config
from services.conversation_state import (
    start_call as cs_start_call,
    mark_call_completed as cs_mark_call_completed,
)

logger = logging.getLogger("livekit-agent")
load_dotenv()

# Set environment variables for LiveKit plugins to auto-discover
# Also ensure HuggingFace caches are consistent across subprocesses
# STT Providers
os.environ["DEEPGRAM_API_KEY"] = Config.DEEPGRAM_API_KEY
os.environ["ASSEMBLYAI_API_KEY"] = Config.ASSEMBLYAI_API_KEY

# TTS Providers  
os.environ["ELEVEN_API_KEY"] = Config.ELEVENLABS_API_KEY  # ElevenLabs uses ELEVEN_API_KEY
os.environ["SPEECHIFY_API_KEY"] = Config.SPEECHIFY_API_KEY

# LLM Providers
os.environ["OPENAI_API_KEY"] = Config.OPENAI_API_KEY
os.environ["OPENROUTER_API_KEY"] = Config.OPENROUTER_API_KEY

# HF cache locations (inference subprocess inherits these)
os.environ.setdefault("HF_HOME", "/root/.cache/huggingface")
os.environ.setdefault("HF_HUB_CACHE", os.path.join(os.environ["HF_HOME"], "hub"))
os.environ.setdefault("TRANSFORMERS_CACHE", os.environ["HF_HOME"])

# Google Cloud (if JSON credentials are set)
if Config.GOOGLE_APPLICATION_CREDENTIALS_JSON:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS_JSON"] = Config.GOOGLE_APPLICATION_CREDENTIALS_JSON


class EquityConnectAgent(Agent):
    """Voice agent for Equity Connect calls"""
    
    def __init__(self, instructions: str):
        super().__init__(
            instructions=instructions,
            tools=all_tools,  # Your Supabase tools
        )
    
    async def on_enter(self):
        """Called when agent joins - greet the user"""
        self.session.generate_reply(
            instructions="Greet the user warmly and ask how you can help them today."
        )


def prewarm(proc: JobProcess):
    """Load models before first call"""
    proc.userdata["vad"] = silero.VAD.load()
    logger.info("✅ Silero VAD loaded (speech gate only)")
    # Turn detector modules imported at top level to register in main worker process


async def entrypoint(ctx: JobContext):
    """Main entrypoint - handles each call"""
    await ctx.connect()
    
    room = ctx.room
    room_name = room.name
    caller_phone: Optional[str] = None
    
    # Parse metadata - check BOTH room metadata AND participant metadata AND participant attributes
    # NOTE: LiveKit SIP dispatch rule can pass data via:
    # 1. "metadata" field → room.metadata (JSON string)
    # 2. "attributes" field → participant.attributes (dict)
    import json
    metadata = {}
    
    # Try room metadata first
    try:
        room_metadata_str = room.metadata or "{}"
        logger.info(f"🔍 Raw room.metadata: {room_metadata_str}")
        if room_metadata_str and room_metadata_str != "{}":
            metadata = json.loads(room_metadata_str) if isinstance(room_metadata_str, str) else room_metadata_str
            logger.info(f"✅ Using room metadata: {metadata}")
    except Exception as e:
        logger.warning(f"Failed to parse room metadata: {e}")
    
    # If no room metadata, check participant metadata (from token) or attributes (from SIP)
    if not metadata or not metadata.get("template_id"):
        try:
            # Get the first participant's metadata (should be the SIP participant)
            participants = list(room.remote_participants.values())
            if participants:
                participant = participants[0]
                
                # Try participant.metadata first
                participant_metadata_str = participant.metadata or "{}"
                logger.info(f"🔍 Raw participant.metadata: {participant_metadata_str}")
                if participant_metadata_str and participant_metadata_str != "{}":
                    metadata = json.loads(participant_metadata_str) if isinstance(participant_metadata_str, str) else participant_metadata_str
                    logger.info(f"✅ Using participant metadata: {metadata}")
                
                # Also try participant.attributes (SIP-specific)
                if hasattr(participant, 'attributes') and participant.attributes:
                    logger.info(f"🔍 Raw participant.attributes: {participant.attributes}")
                    # Merge attributes into metadata (attributes take precedence)
                    metadata.update(participant.attributes)
                    logger.info(f"✅ Merged participant attributes: {metadata}")
        except Exception as e:
            logger.warning(f"Failed to parse participant metadata/attributes: {e}")
            
    # Check if this is a test room with template + prompt
    is_test = metadata.get("is_test", False)
    template_id = metadata.get("template_id")  # Config: STT/TTS/LLM/voice
    call_type = metadata.get("call_type", "test-demo")  # Prompt: instructions
    logger.info(f"🔍 Final: is_test={is_test}, template_id={template_id}, call_type={call_type}")
    
    # Extract phone metadata for conversation state
    caller_phone = metadata.get("phone_number") or metadata.get("from") or metadata.get("caller")
    lead_id = metadata.get("lead_id")
    qualified = metadata.get("qualified", False)
    
    # For inbound calls, query Supabase to get full lead context by phone number
    lead_context = None
    if caller_phone and not lead_id:
        logger.info(f"🔍 Looking up lead by phone: {caller_phone}")
        try:
            # Query Supabase for lead by phone number
            response = await supabase_client.from_("leads").select(
                "*, brokers!assigned_broker_id(*)"
            ).or_(
                f"primary_phone.ilike.%{caller_phone}%,primary_phone_e164.eq.{caller_phone}"
            ).limit(1).execute()
            
            if response.data and len(response.data) > 0:
                lead = response.data[0]
                lead_id = lead["id"]
                broker = lead.get("brokers")
                
                # Determine qualification status
                is_qualified = lead["status"] in ["qualified", "appointment_set", "showed", "application", "funded"]
                qualified = is_qualified
                
                lead_context = {
                    "lead_id": lead_id,
                    "broker_id": lead.get("assigned_broker_id"),
                    "first_name": lead.get("first_name"),
                    "last_name": lead.get("last_name"),
                    "email": lead.get("primary_email"),
                    "phone": caller_phone,
                    "property_city": lead.get("property_city"),
                    "property_state": lead.get("property_state"),
                    "property_value": lead.get("property_value"),
                    "estimated_equity": lead.get("estimated_equity"),
                    "age": lead.get("age"),
                    "status": lead.get("status"),
                    "qualified": is_qualified,
                    "broker_name": broker.get("contact_name") if broker else None,
                    "broker_company": broker.get("company_name") if broker else None,
                }
                logger.info(f"✅ Lead found: {lead.get('first_name')} {lead.get('last_name')} (Status: {lead.get('status')})")
            else:
                logger.info(f"⚠️ No lead found for phone: {caller_phone}")
                lead_context = {
                    "phone": caller_phone,
                    "new_caller": True
                }
        except Exception as e:
            logger.error(f"❌ Error looking up lead: {e}")
            lead_context = {
                "phone": caller_phone,
                "lookup_error": str(e)
            }
    
    if caller_phone:
        try:
            cs_start_call(str(caller_phone), {"lead_id": lead_id, "qualified": bool(qualified)})
            logger.info(f"📒 start_call recorded for {caller_phone}")
        except Exception as e:
            logger.warning(f"Failed to start_call for {caller_phone}: {e}")
    
    if is_test and template_id:
        # Load template (configuration) from Supabase
        logger.info(f"🎮 Test room - loading template {template_id} + prompt {call_type}")
        template = await load_template(template_id)
        if not template:
            logger.error(f"❌ Template {template_id} not found")
            return
        
        # Load prompt (instructions) from prompts table
        instructions = await load_prompt_instructions(call_type)
        if not instructions:
            logger.warning(f"⚠️ Prompt {call_type} not found, using fallback")
            instructions = "You are Barbara, a warm voice assistant for Equity Connect. Be friendly and helpful."
    else:
        # Regular call - use default template + prompt
        logger.info(f"📞 Regular call - using defaults")
        template = await load_default_template()
        instructions = "You are Barbara, a warm voice assistant for Equity Connect. Be friendly and helpful."
    
    # Get VAD settings FIRST (used by both STT and AgentSession)
    vad_silence_duration_ms = template.get("vad_silence_duration_ms", 500)
    
    # Build plugin instances from template (required for self-hosted)
    stt_plugin = build_stt_plugin(template, vad_silence_duration_ms)
    llm_plugin = build_llm_plugin(template)
    tts_plugin = build_tts_plugin(template)
        
    # Get interruption settings from template
    allow_interruptions = template.get("allow_interruptions", True)
    min_interruption_duration = template.get("min_interruption_duration", 0.5)
    preemptive_generation = template.get("preemptive_generation", True)
    resume_false_interruption = template.get("resume_false_interruption", True)
    false_interruption_timeout = template.get("false_interruption_timeout", 1.0)
    
    logger.info(f"🎙️ STT: {template.get('stt_provider')} - {template.get('stt_model')} (endpointing=OFF)")
    logger.info(f"🧠 LLM: {template.get('llm_provider')} - {template.get('llm_model')} (temp={template.get('llm_temperature', 0.7)}, top_p={template.get('llm_top_p', 1.0)})")
    if template.get('enable_web_search', False):
        logger.info(f"🌐 Web Search: ENABLED (max_results={template.get('web_search_max_results', 5)})")
    logger.info(f"🔊 TTS: {template.get('tts_provider')} - {template.get('tts_voice_id')} (speed={template.get('tts_speed', 1.0)})")
    logger.info(f"🎛️ VAD: Silero (speech gate only)")
    logger.info(f"🎯 TurnDetector: SOLE SOURCE OF TRUTH for turn ending")
    logger.info(f"🔄 Interruptions: enabled={allow_interruptions}, min_duration={min_interruption_duration}s, preemptive={preemptive_generation}")
    logger.info(f"📝 Prompt: {call_type} (instructions loaded)")
    
    # Load TurnDetector - Use fastest available model
    # EOU (semantic) would be ideal but may not be available in current plugin version
    turn_detector = None
    turn_detector_model = template.get("turn_detector_model", "english")
    # Balanced threshold: Fast but not interrupting
    turn_detector_threshold = template.get("turn_detector_threshold", 0.3)  # Sweet spot
    
    try:
        # Try EOU first (if available in plugin version)
        try:
            from livekit.plugins.turn_detector.eou import EOUModel
            turn_detector = EOUModel()
            logger.info(f"🎯 Turn Detector: EOU (semantic transformer)")
        except (ImportError, AttributeError, ModuleNotFoundError) as e:
            logger.warning(f"⚠️ EOU not available ({e}), falling back to VAD-only")
            # Fall back to VAD-only with threshold
            if turn_detector_model == "multilingual":
                from livekit.plugins.turn_detector.multilingual import MultilingualModel
                turn_detector = MultilingualModel(unlikely_threshold=turn_detector_threshold)
                logger.info(f"🎯 Turn Detector: MULTILINGUAL VAD (threshold={turn_detector_threshold})")
            else:
                from livekit.plugins.turn_detector.english import EnglishModel
                # EnglishModel uses 'unlikely_threshold' parameter
                turn_detector = EnglishModel(unlikely_threshold=turn_detector_threshold)
                logger.info(f"🎯 Turn Detector: ENGLISH VAD (threshold={turn_detector_threshold})")
    except Exception as e:
        logger.error(f"❌ CRITICAL: Turn detector init failed ({e})")
        raise
    
    # Create session with TurnDetector ONLY (no endpointing delays)
    logger.info(f"⏱️ TurnDetector will manage ALL timing (no artificial delays)")
    
    session = AgentSession(
        stt=stt_plugin,
        llm=llm_plugin,
        tts=tts_plugin,
        vad=ctx.proc.userdata["vad"],
        turn_detection=turn_detector,  # EnglishModel or MultilingualModel - SOLE source of truth
        # Interruption settings from template
        allow_interruptions=allow_interruptions,
        min_interruption_duration=min_interruption_duration,
        resume_false_interruption=resume_false_interruption,
        false_interruption_timeout=false_interruption_timeout,
        # Response generation settings from template
        preemptive_generation=preemptive_generation,
        # NO min/max_endpointing_delay - TurnDetector handles this internally
    )
    
    # Start the session with custom EquityConnectAgent that auto-greets on entry
    exit_reason: Optional[str] = None
    try:
        await session.start(
            agent=EquityConnectAgent(instructions=instructions),  # Custom agent with on_enter() greeting
            room=ctx.room,
            room_input_options=RoomInputOptions(
                noise_cancellation=noise_cancellation.BVC()
            ),
            room_output_options=RoomOutputOptions(
                audio_enabled=True,  # CRITICAL: Enable audio output for TTS
            ),
        )
        
        exit_reason = "hangup"
    except Exception as e:
        logger.error(f"Session error: {e}")
        exit_reason = "error"
        raise
    finally:
        if caller_phone:
            try:
                cs_mark_call_completed(caller_phone, exit_reason=exit_reason)
                logger.info(f"📒 mark_call_completed for {caller_phone} ({exit_reason})")
            except Exception as e:
                logger.warning(f"Failed to mark_call_completed for {caller_phone}: {e}")


async def load_template(template_id: str) -> Optional[dict]:
    """Load template from Supabase"""
    try:
        from services.templates import get_supabase_client
        supabase = get_supabase_client()
        result = supabase.table("ai_templates").select("*").eq("id", template_id).single().execute()
        return result.data if result.data else None
    except Exception as e:
        logger.error(f"Failed to load template: {e}")
        return None


async def load_default_template() -> dict:
    """Load default/fallback template"""
    try:
        from services.templates import get_supabase_client
        supabase = get_supabase_client()
        result = supabase.table("ai_templates").select("*").eq("is_system_default", True).limit(1).single().execute()
        return result.data if result.data else get_hardcoded_fallback()
    except Exception as e:
        logger.warning(f"Failed to load default template: {e}")
        return get_hardcoded_fallback()


async def load_prompt_instructions(call_type: str) -> Optional[str]:
    """Load prompt instructions from prompts table and format from JSONB sections"""
    try:
        from services.templates import get_supabase_client
        supabase = get_supabase_client()
        
        # Get prompt with active version
        result = supabase.table("prompts").select("""
            id,
            prompt_versions!inner(
                id,
                content,
                is_active,
                version_number
            )
        """).eq("call_type", call_type).eq("is_active", True).eq("prompt_versions.is_active", True).single().execute()
        
        if not result.data:
            logger.warning(f"No prompt found for call_type: {call_type}")
            return None
        
        # Get the active version's content (JSONB with 9 sections)
        version = result.data.get("prompt_versions")
        if isinstance(version, list):
            version = version[0] if version else None
        
        if not version or not version.get("content"):
            logger.warning(f"No active version found for {call_type}")
            return None
        
        # Format JSONB sections into single prompt string
        sections = version["content"]
        parts = []
        
        # Assemble sections in order (like barbara-v3 formatPromptContent)
        if sections.get("role"):
            parts.append(sections["role"])
        if sections.get("personality"):
            parts.append(f"PERSONALITY & STYLE:\n{sections['personality']}")
        if sections.get("context"):
            parts.append(f"CONTEXT:\n{sections['context']}")
        if sections.get("conversation_flow"):
            parts.append(f"CONVERSATION FLOW:\n{sections['conversation_flow']}")
        if sections.get("instructions"):
            parts.append(f"RULES & CONSTRAINTS:\n{sections['instructions']}")
        if sections.get("output_format"):
            parts.append(f"OUTPUT FORMAT:\n{sections['output_format']}")
        
        formatted = "\n\n".join(parts).strip()
        logger.info(f"✅ Loaded prompt {call_type} v{version.get('version_number')} ({len(formatted)} chars)")
        
        return formatted
        
    except Exception as e:
        logger.error(f"Failed to load prompt {call_type}: {e}")
        return None


def get_hardcoded_fallback() -> dict:
    """Hardcoded fallback if database is unavailable"""
    return {
        "stt_provider": "deepgram",
        "stt_model": "nova-2",
        "stt_language": "en-US",
        "tts_provider": "elevenlabs",
        "tts_model": "eleven_turbo_v2_5",
        "tts_voice_id": "21m00Tcm4TlvDq8ikWAM",
        "llm_provider": "openai",
        "llm_model": "gpt-4o",
        "instructions": "You are Barbara, a friendly AI assistant for Equity Connect.",
    }


def build_stt_plugin(template: dict, vad_silence_duration_ms: int, use_turn_detector: bool = True):
    """Build STT plugin instance from template - NO endpointing (TurnDetector handles it)
    
    Args:
        template: Template configuration dict
        vad_silence_duration_ms: DEPRECATED - kept for backwards compat
        use_turn_detector: DEPRECATED - always True now
    """
    provider = template.get("stt_provider", "deepgram")
    model = template.get("stt_model", "nova-2")
    language = template.get("stt_language", "en-US")
    
    if provider == "deepgram":
        # NO endpointing - TurnDetector is sole source of truth
        return deepgram.STT(
            model=model, 
            language=language,
            endpointing_ms=0  # Disabled - TurnDetector handles this
        )
    elif provider == "assemblyai":
        # NO turn detection - TurnDetector handles this
        return assemblyai.STT(max_turn_silence=0)
    elif provider == "openai":
        # OpenAI STT - LiveKit VAD + TurnDetector manage turns
        return openai.STT()
    else:
        # Safe fallback - NO endpointing
        return deepgram.STT(model="nova-2", endpointing_ms=0)


def build_llm_plugin(template: dict):
    """Build LLM plugin instance from template with all LLM parameters"""
    provider = template.get("llm_provider", "openai")
    model = template.get("llm_model", "gpt-4o")
    
    # Get LLM parameters from template
    temperature = template.get("llm_temperature", 0.7)
    max_tokens = template.get("llm_max_tokens", 4096)
    top_p = template.get("llm_top_p", 1.0)
    frequency_penalty = template.get("llm_frequency_penalty", 0.0)
    presence_penalty = template.get("llm_presence_penalty", 0.0)
    
    # Get web search settings
    enable_web_search = template.get("enable_web_search", False)
    web_search_max_results = template.get("web_search_max_results", 5)
    
    if provider == "openrouter":
        # Build plugins list if web search is enabled
        plugins = []
        if enable_web_search:
            plugins.append(
                openai.OpenRouterWebPlugin(
                    max_results=web_search_max_results,
                    search_prompt="Search for relevant real-time information to answer the user's question"
                )
            )
        
        return openai.LLM.with_openrouter(
            model=model,
            api_key=Config.OPENROUTER_API_KEY,
            temperature=temperature,
            top_p=top_p,
            plugins=plugins if plugins else None,
        )
    elif provider == "openai":
        return openai.LLM(
            model=model,
            temperature=temperature,
            top_p=top_p,
        )
    else:
        return openai.LLM(model="gpt-4o", temperature=0.7)  # Safe fallback



def build_tts_plugin(template: dict):
    """Build TTS plugin instance from template with provider-specific settings"""
    from livekit.agents.types import NOT_GIVEN
    
    provider = template.get("tts_provider", "elevenlabs")
    model = template.get("tts_model", "eleven_turbo_v2_5")
    voice_id = template.get("tts_voice_id", "21m00Tcm4TlvDq8ikWAM")
    
    # Get TTS parameters from template
    tts_speed = template.get("tts_speed", 1.0)
    tts_stability = template.get("tts_stability", 0.5)
    
    if provider == "elevenlabs":
        # ElevenLabs supports stability and other voice settings
        voice_settings = elevenlabs.VoiceSettings(
            stability=tts_stability,
            similarity_boost=0.75,  # Good default
        )
        return elevenlabs.TTS(
            voice_id=voice_id, 
            model=model,
            voice_settings=voice_settings
        )
    elif provider == "openai":
        voice = template.get("tts_voice", "alloy")
        return openai.TTS(
            voice=voice,
            speed=tts_speed
        )
    elif provider == "google":
        voice_name = template.get("tts_voice_id", "en-US-Neural2-A")
        language = template.get("stt_language", "en-US")
        return google.TTS(
            voice_name=voice_name, 
            language=language,
            speaking_rate=tts_speed
        )
    else:
        return elevenlabs.TTS(voice_id=voice_id, model="eleven_turbo_v2_5")  # Safe fallback


if __name__ == "__main__":
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        prewarm_fnc=prewarm,
        agent_name="inbound-agent",  # Register with LiveKit Cloud for dispatch routing
        initialize_process_timeout=120.0,  # Increase timeout for ONNX model loading (default: 10s)
        job_executor_type=JobExecutorType.THREAD  # Use threads to bypass Fly.io IPC restrictions
    ))
