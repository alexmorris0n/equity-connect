"""LiveKit Voice Agent - Clean rebuild with native plugins

Latest: Force English turn detector due to LiveKit Inference multilingual bug
"""
import logging
import os
from typing import Optional
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    AgentStateChangedEvent,
    JobContext,
    RoomInputOptions,
    RoomOutputOptions,
    JobExecutorType,
    JobProcess,
    UserStateChangedEvent,
    WorkerOptions,
    cli,
)
from livekit.agents.llm import ChatContext, ChatMessage
from livekit.plugins import silero

# Import English turn detector only to avoid registering multilingual runner at startup
from livekit.plugins.turn_detector import english  # noqa: F401

# Import ALL plugins at TOP LEVEL (required for plugin registration on main thread)
from livekit.plugins import deepgram, openai, assemblyai, elevenlabs, google
from livekit.plugins import noise_cancellation
from livekit.plugins.turn_detector.english import EnglishModel
from livekit.plugins.turn_detector.multilingual import MultilingualModel

# Import agent handoff components
from routing_coordinator import RoutingCoordinator
from node_agent import BarbaraNodeAgent
from session_data import BarbaraSessionData


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


def prewarm(proc: JobProcess):
    """Load models before first call"""
    proc.userdata["vad"] = silero.VAD.load()
    logger.info("✅ Silero VAD loaded (speech gate only)")
    # Turn detector modules imported at top level to register in main worker process


async def entrypoint(ctx: JobContext):
    """Main entrypoint - handles each call"""
    logger.info("🚀 ENTRYPOINT: Starting call handler")
    await ctx.connect()
    logger.info("✅ ENTRYPOINT: Connected to LiveKit room")
    
    room = ctx.room
    room_name = room.name
    logger.info(f"📞 ENTRYPOINT: Room name: {room_name}")
    
    # Try to extract phone number from room name as early fallback
    # LiveKit SIP rooms are named like: sip-_+16505300051_LWWx7vjKCBcD
    caller_phone: Optional[str] = None
    if room_name.startswith("sip-") and "+" in room_name:
        # Extract phone number from room name pattern: sip-_+16505300051_...
        import re
        phone_match = re.search(r'\+1?\d{10,}', room_name)
        if phone_match:
            caller_phone = phone_match.group(0)
            logger.info(f"📞 Extracted phone from room name: {caller_phone}")
    
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
    
    # If no room metadata, check participant metadata (for custom data)
    if not metadata or not metadata.get("template_id"):
        try:
            # Get the first participant's metadata (custom test data)
            participants = list(room.remote_participants.values())
            if participants:
                participant = participants[0]
                
                # Try participant.metadata for custom test configurations
                participant_metadata_str = participant.metadata or "{}"
                logger.info(f"🔍 Raw participant.metadata: {participant_metadata_str}")
                if participant_metadata_str and participant_metadata_str != "{}":
                    metadata = json.loads(participant_metadata_str) if isinstance(participant_metadata_str, str) else participant_metadata_str
                    logger.info(f"✅ Using participant metadata: {metadata}")
        except Exception as e:
            logger.warning(f"Failed to parse participant metadata: {e}")
            
    # Check if this is a test room with template + prompt
    is_test = metadata.get("is_test", False)
    template_id = metadata.get("template_id")  # Config: STT/TTS/LLM/voice
    call_type = metadata.get("call_type", "test-demo")  # Prompt: instructions
    raw_direction = metadata.get("call_direction") or metadata.get("direction")
    if raw_direction:
        call_direction = str(raw_direction).lower()
    else:
        call_direction = "outbound" if str(call_type).startswith("outbound") else "inbound"
    logger.info(f"🔍 Final: is_test={is_test}, template_id={template_id}, call_type={call_type}, call_direction={call_direction}")
    
    # Extract phone metadata for conversation state
    # OFFICIAL LIVEKIT SIP PATTERN: participant.attributes['sip.phoneNumber']
    # This is the CORRECT field for inbound SIP caller ID
    # See: https://docs.livekit.io/sip/sip-participant/
    # Note: caller_phone may already be set from room name extraction above
    # Try to get more accurate phone from participant attributes (overwrites room name if available)
    called_number = None
    
    # First, try to get from SIP participant attributes (CORRECT METHOD)
    try:
        participants = list(room.remote_participants.values())
        if participants:
            participant = participants[0]
            
            # Log ALL participant attributes for debugging
            logger.info(f"🔍 Participant attributes: {participant.attributes}")
            logger.info(f"🔍 Participant identity: {participant.identity}")
            logger.info(f"🔍 Participant name: {participant.name}")
            
            # Check if this is a SIP participant
            from livekit import rtc
            if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP:
                # Try multiple possible attribute names (LiveKit may use different names)
                # Common patterns: sip_from, sip_to, sip.phoneNumber, sip_from_number, etc.
                caller_phone = (
                    participant.attributes.get('sip_from') or
                    participant.attributes.get('sip.phoneNumber') or
                    participant.attributes.get('sip_from_number') or
                    participant.attributes.get('caller_number') or
                    participant.attributes.get('from')
                )
                
                called_number = (
                    participant.attributes.get('sip_to') or
                    participant.attributes.get('sip.trunkPhoneNumber') or
                    participant.attributes.get('sip_to_number') or
                    participant.attributes.get('called_number') or
                    participant.attributes.get('to')
                )
                
                logger.info(f"✅ SIP Participant: FROM {caller_phone} → TO {called_number}")
                
                # Also check room metadata for SIP info
                if not caller_phone:
                    logger.info(f"🔍 Checking room metadata for SIP info...")
                    room_meta = room.metadata or "{}"
                    try:
                        room_data = json.loads(room_meta) if isinstance(room_meta, str) else room_meta
                        caller_phone = room_data.get('sip_from') or room_data.get('from')
                        called_number = room_data.get('sip_to') or room_data.get('to')
                        logger.info(f"✅ Found in room metadata: FROM {caller_phone} → TO {called_number}")
                    except:
                        pass
    except Exception as e:
        logger.warning(f"Failed to extract SIP attributes: {e}", exc_info=True)
    
    # Fallback to metadata (for custom/test calls)
    if not caller_phone:
        caller_phone = (
            metadata.get("phone_number") or  # Custom metadata
            metadata.get("sip_from") or  # Legacy fallback
            metadata.get("from") or  # Legacy fallback
            metadata.get("caller")  # Legacy fallback
        )
        if caller_phone:
            logger.info(f"📞 ENTRYPOINT: Using metadata phone: {caller_phone}")
    
    if not called_number:
        called_number = metadata.get("sip_to") or metadata.get("to")
    
    # FINAL PHONE EXTRACTION SUMMARY
    if caller_phone:
        logger.info(f"✅ ENTRYPOINT: Phone number extracted successfully: {caller_phone}")
    else:
        logger.warning(f"⚠️ ENTRYPOINT: NO PHONE NUMBER FOUND - will use room_name as fallback")
    
    lead_id = metadata.get("lead_id")
    qualified = metadata.get("qualified", False)
    
    # For inbound calls, query Supabase to get full lead context by phone number
    lead_context = None
    logger.info(f"🔍 ENTRYPOINT: Lead lookup check - caller_phone={caller_phone}, lead_id={lead_id}")
    if caller_phone and not lead_id:
        logger.info(f"🔍 ENTRYPOINT: Looking up lead by phone: {caller_phone}")
        try:
            # Query Supabase for lead by phone number
            from services.supabase import get_supabase_client
            supabase = get_supabase_client()
            # Supabase Python client: .or_() comes after .select()
            or_conditions = f"primary_phone.ilike.%{caller_phone}%,primary_phone_e164.eq.{caller_phone}"
            response = supabase.table("leads").select(
                "*, brokers!assigned_broker_id(*)"
            ).or_(or_conditions).limit(1).execute()
            
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
                    "name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),  # Full name for context
                    "email": lead.get("primary_email"),
                    "primary_email": lead.get("primary_email"),  # Alias for consistency
                    "phone": caller_phone,
                    "property_address": lead.get("property_address"),
                    "property_city": lead.get("property_city"),
                    "property_state": lead.get("property_state"),
                    "property_zip": lead.get("property_zip"),
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
            logger.info(f"📒 ENTRYPOINT: start_call recorded for {caller_phone}")
        except Exception as e:
            logger.warning(f"⚠️ ENTRYPOINT: Failed to start_call for {caller_phone}: {e}")
            # FALLBACK: If start_call fails but we have lead_id, manually update state
            if lead_id:
                try:
                    from services.conversation_state import update_conversation_state
                    update_conversation_state(str(caller_phone), {
                        "lead_id": str(lead_id),
                        "qualified": bool(qualified)
                    })
                    logger.info(f"✅ ENTRYPOINT: Manually set lead_id={lead_id} in conversation state (fallback)")
                except Exception as e2:
                    logger.error(f"❌ ENTRYPOINT: Failed to set lead_id fallback: {e2}")
    
    logger.info(f"🎮 ENTRYPOINT: Loading active components")
    
    # Load ACTIVE components (STT, LLM, TTS) from database
    from services.supabase import get_supabase_client
    supabase = get_supabase_client()
    
    # Get active STT (from LiveKit tables)
    stt_result = supabase.table("livekit_available_stt_models").select("*").eq("is_active", True).maybe_single().execute()
    active_stt = getattr(stt_result, "data", None) if stt_result else None
    
    # Get active LLM (from LiveKit tables)
    llm_result = supabase.table("livekit_available_llm_models").select("*").eq("is_active", True).maybe_single().execute()
    active_llm = getattr(llm_result, "data", None) if llm_result else None
    
    # Get active TTS (from LiveKit tables)
    tts_result = supabase.table("livekit_available_voices").select("*").eq("is_active", True).maybe_single().execute()
    active_tts = getattr(tts_result, "data", None) if tts_result else None
    
    stt_provider = active_stt.get("provider") if active_stt else "NOT SET"
    stt_model = active_stt.get("model_name") if active_stt else "NOT SET"
    logger.info(f"🎙️ ACTIVE STT: {stt_provider}/{stt_model}")
    
    llm_provider = active_llm.get("provider") if active_llm else "NOT SET"
    llm_model = active_llm.get("model_name") if active_llm else "NOT SET"
    logger.info(f"🧠 ACTIVE LLM: {llm_provider}/{llm_model}")
    
    tts_provider = active_tts.get("provider") if active_tts else "NOT SET"
    tts_voice = active_tts.get("voice_name") if active_tts else "NOT SET"
    logger.info(f"🔊 ACTIVE TTS: {tts_provider}/{tts_voice}")
    
    # Check for active realtime model (takes precedence over pipeline)
    realtime_result = supabase.table("livekit_available_realtime_models").select("*").eq("is_active", True).maybe_single().execute()
    active_realtime = getattr(realtime_result, "data", None) if realtime_result else None
    
    if active_realtime:
        logger.info(f"🚀 ACTIVE REALTIME: {active_realtime.get('provider')}/{active_realtime.get('model_name')} (takes precedence over pipeline)")
        provider = active_realtime.get("provider")
        if provider == "openai-realtime":
            model_type = "openai_realtime"
        elif provider == "google-realtime":
            model_type = "gemini_live"
        else:
            model_type = "pipeline"
            logger.warning(f"⚠️ Unknown realtime provider: {provider}, falling back to pipeline")
    else:
        model_type = "pipeline"
        logger.info("📊 No active realtime model, using pipeline mode")
    
    # Determine TTS mode: custom voices need plugin, standard voices use LiveKit Inference
    is_custom_voice = active_tts.get("is_custom", False) if active_tts else False
    if is_custom_voice:
        logger.info(f"✨ Using ElevenLabs PLUGIN for custom voice (requires API key)")
    
    # Build template from active components
    template = {
        "model_type": model_type,
        "stt_provider": active_stt.get("provider") if active_stt else "deepgram",
        "stt_model": active_stt.get("model_name") if active_stt else "nova-2",
        "stt_language": "en",
        "tts_provider": active_tts.get("provider") if active_tts else "elevenlabs",
        "tts_model": active_tts.get("model") if active_tts else "eleven_turbo_v2_5",
        "tts_voice_id": active_tts.get("voice_id") if active_tts else "EXAVITQu4vr4xnSDxMaL",
        "tts_use_plugin": is_custom_voice, # If TRUE, use elevenlabs plugin instead of LiveKit Inference
        "llm_provider": active_llm.get("provider") if active_llm else "openai",
        "llm_model": active_llm.get("model_name") if active_llm else "gpt-4o",
        "llm_temperature": 0.7,
        "llm_max_tokens": 4096,
        "vad_silence_duration_ms": 500,
        "use_turn_detector": True,
        "turn_detector_threshold": 0.25,
        "min_endpointing_delay": 0.1,
        "max_endpointing_delay": 3.0,
        "allow_interruptions": True,
        "preemptive_generation": True,
        "enable_web_search": True,
        "web_search_max_results": 5
    }
    
    instructions = "You are Barbara, a warm voice assistant. Be friendly and helpful."
    
    logger.info(f"✅ ENTRYPOINT: Active components loaded")
    
    # Get VAD settings FIRST (used by both STT and AgentSession)
    vad_silence_duration_ms = template.get("vad_silence_duration_ms", 500)
    
    # model_type is already set above based on active_realtime or defaults to "pipeline"
    logger.info(f"🔧 ENTRYPOINT: Model type: {model_type}")
    
    # === REALTIME MODEL MODE ===
    # Note: Realtime models have optimized built-in turn detection - we use that instead of LiveKit's
    if model_type == "openai_realtime":
        logger.info("🚀 Using OpenAI Realtime API (bundled STT+LLM+TTS)")
        
        from livekit.plugins.openai import realtime
        from openai.types.beta.realtime.session import TurnDetection
        
        # Get model name from active_realtime (database) or fallback to template/default
        realtime_model_name = active_realtime.get("model_id_full") if active_realtime else template.get("realtime_model", "gpt-realtime")
        
        # Build turn detection config - use OpenAI's built-in turn detection (optimized for realtime)
        turn_detection_type = template.get("realtime_turn_detection_type", "server_vad")
        turn_detection_config = None
        
        if turn_detection_type == "server_vad":
            turn_detection_config = TurnDetection(
                type="server_vad",
                threshold=template.get("realtime_vad_threshold", 0.5),
                prefix_padding_ms=template.get("realtime_prefix_padding_ms", 300),
                silence_duration_ms=template.get("realtime_silence_duration_ms", 500),
                create_response=True,
                interrupt_response=True,
            )
        elif turn_detection_type == "semantic_vad":
            eagerness = template.get("realtime_eagerness", "auto")
            turn_detection_config = TurnDetection(
                type="semantic_vad",
                eagerness=eagerness,
                create_response=True,
                interrupt_response=True,
            )
        
        logger.info(f"🎯 Turn Detection: {turn_detection_type} (OpenAI built-in - optimized for realtime)")
        
        # Parse modalities (can be string or array)
        modalities = template.get("realtime_modalities", ["text", "audio"])
        if isinstance(modalities, str):
            modalities = [m.strip() for m in modalities.split(",")]
        
        # Create realtime model - use model_id_full from database (just the model name, no provider prefix)
        realtime_model = realtime.RealtimeModel(
            model=realtime_model_name,  # e.g., "gpt-4o-realtime-preview" or "gpt-realtime"
            voice=template.get("realtime_voice", "alloy"),
            temperature=template.get("realtime_temperature", 0.8),
            modalities=modalities,
            turn_detection=turn_detection_config,
        )
        
        logger.info(f"🎙️ OpenAI Realtime: model={realtime_model_name}, voice={template.get('realtime_voice', 'alloy')}, temp={template.get('realtime_temperature', 0.8)}")
        
        # Use realtime model as LLM (it handles STT and TTS internally)
        llm_instance = realtime_model
        stt_string = None
        tts_string = None
        
    elif model_type == "gemini_live":
        logger.info("🚀 Using Gemini Live API (bundled STT+LLM+TTS)")
        
        from livekit.plugins import google
        from google.genai.types import Modality
        
        # Get model name from active_realtime (database) or fallback to template/default
        gemini_model_name = active_realtime.get("model_id_full") if active_realtime else template.get("gemini_model", "gemini-2.0-flash-exp")
        
        # Parse modalities (can be string or array)
        modalities = template.get("gemini_modalities", ["AUDIO"])
        if isinstance(modalities, str):
            modalities = [m.strip() for m in modalities.split(",")]
        # Convert to Modality enum if needed
        modality_enums = []
        for m in modalities:
            if m.upper() == "AUDIO":
                modality_enums.append(Modality.AUDIO)
            elif m.upper() == "TEXT":
                modality_enums.append(Modality.TEXT)
        
        # Build realtime model config
        # Note: Gemini Live has built-in VAD-based turn detection (enabled by default)
        # We use that instead of LiveKit's TurnDetector for optimal performance
        realtime_kwargs = {
            "model": gemini_model_name,  # e.g., "gemini-2.0-flash-exp" or "gemini-2.5-flash-native-audio-preview-09-2025"
            "voice": template.get("gemini_voice", "Puck"),
            "temperature": template.get("gemini_temperature", 0.8),
            "modalities": modality_enums if modality_enums else [Modality.AUDIO],
        }
        
        logger.info("🎯 Turn Detection: Built-in VAD (Gemini Live - optimized for realtime)")
        
        # Add optional fields
        if template.get("gemini_instructions"):
            realtime_kwargs["instructions"] = template.get("gemini_instructions")
        if template.get("gemini_enable_affective_dialog"):
            realtime_kwargs["enable_affective_dialog"] = True
        if template.get("gemini_proactivity"):
            realtime_kwargs["proactivity"] = True
        if template.get("gemini_vertexai"):
            realtime_kwargs["vertexai"] = True
        
        # Create realtime model
        realtime_model = google.realtime.RealtimeModel(**realtime_kwargs)
        
        logger.info(f"🎙️ Gemini Live: model={gemini_model_name}, voice={template.get('gemini_voice', 'Puck')}, temp={template.get('gemini_temperature', 0.8)}")
        
        # Use realtime model as LLM (it handles STT and TTS internally)
        llm_instance = realtime_model
        stt_string = None
        tts_string = None
        
    else:
        # === LIVEKIT INFERENCE MODE (Pipeline) ===
        # Use model_id_full from database directly (per LiveKit docs)
        # Format is already correct in DB: "provider/model:voice_id", "provider/model:lang", "provider/model"
        
        # STT model string - use model_id_full from database
        if active_stt and active_stt.get("model_id_full"):
            stt_string = active_stt["model_id_full"]  # e.g., "deepgram/nova-3:en" or "deepgram/nova-3:multi"
            logger.info(f"🎙️ ENTRYPOINT: STT initialized - {stt_string} (LiveKit Inference)")
        else:
            # 🚨 LOUD FALLBACK
            from services.fallbacks import log_model_fallback, get_fallback_model
            stt_string = get_fallback_model("livekit", "stt")
            log_model_fallback("livekit", "stt", "No active STT model found in database (is_active=true)", stt_string)
        
        # Extract STT model and language from model_id_full
        # Format: "provider/model:language" (e.g., "deepgram/nova-3:multi" → model="deepgram/nova-3", lang="multi")
        stt_model = stt_string
        stt_language = None
        if ":" in stt_string:
            stt_model, stt_language = stt_string.rsplit(":", 1)
        else:
            stt_language = "en"  # Default if no language specified
        
        # 🧪 TEMPORARY: Test Deepgram plugin instead of LiveKit Inference for STT
        # This bypasses LiveKit Inference and uses your own Deepgram API key
        USE_DEEPGRAM_PLUGIN = True  # Set to False to revert to LiveKit Inference
        if USE_DEEPGRAM_PLUGIN and Config.DEEPGRAM_API_KEY:
            from livekit.plugins import deepgram
            stt_plugin = deepgram.STT(
                api_key=Config.DEEPGRAM_API_KEY,
                model="nova-3",  # Extract from stt_model if needed
                language=stt_language if stt_language else "en"
            )
            logger.info(f"🧪 TEMPORARY: Using Deepgram PLUGIN for STT (bypassing LiveKit Inference)")
            stt_string = None  # Signal to use plugin instead of Inference string
        else:
            stt_plugin = None
        
        # LLM model string - use model_id_full from database
        if active_llm and active_llm.get("model_id_full"):
            llm_string = active_llm["model_id_full"]  # e.g., "openai/gpt-5"
            logger.info(f"🧠 ENTRYPOINT: LLM initialized - {llm_string} (LiveKit Inference)")
        else:
            # 🚨 LOUD FALLBACK
            from services.fallbacks import log_model_fallback, get_fallback_model
            llm_string = get_fallback_model("livekit", "llm")
            log_model_fallback("livekit", "llm", "No active LLM model found in database (is_active=true)", llm_string)
        
        # TTS model string - Check if we need plugin for custom voices
        tts_use_plugin = is_custom_voice
        
        if tts_use_plugin and active_tts:
            # Custom voice - use plugin with API key (not LiveKit Inference)
            logger.info(f"✨ ENTRYPOINT: TTS via PLUGIN - {active_tts.get('provider')}/{active_tts.get('model')}:{active_tts.get('voice_id')} (custom voice)")
            tts_string = None  # Will use build_tts_plugin() instead
        elif active_tts and active_tts.get("voice_id_full"):
            # Standard voice - use voice_id_full from database (format: provider/model:voice_id)
            tts_string = active_tts["voice_id_full"]  # e.g., "elevenlabs/eleven_turbo_v2_5:Xb7hH8MSUJpSbSDYk0k2"
            logger.info(f"🔊 ENTRYPOINT: TTS initialized - {tts_string} (LiveKit Inference)")
        else:
            # 🚨 LOUD FALLBACK
            from services.fallbacks import log_model_fallback, get_fallback_model
            tts_string = get_fallback_model("livekit", "tts")
            log_model_fallback("livekit", "tts", "No active TTS voice found in database (is_active=true)", tts_string)
        
        llm_instance = None  # Will use llm_string for pipeline mode
    
    # Get interruption settings from template
    allow_interruptions = template.get("allow_interruptions", True)
    min_interruption_duration = template.get("min_interruption_duration", 0.5)
    preemptive_generation = template.get("preemptive_generation", True)
    resume_false_interruption = template.get("resume_false_interruption", True)
    false_interruption_timeout = template.get("false_interruption_timeout", 1.0)
    
    # Initialize variables for both modes
    turn_detector = None
    min_endpointing_delay = None
    max_endpointing_delay = None
    
    if model_type == "pipeline":
        # Pipeline mode logging and turn detector setup
        if template.get('enable_web_search', False):
            logger.info(f"🌐 Web Search: ENABLED (max_results={template.get('web_search_max_results', 5)})")
        logger.info(f"🎛️ VAD: Silero (speech gate only)")
        logger.info(f"🎯 TurnDetector: SOLE SOURCE OF TRUTH for turn ending")
        logger.info(f"🔄 Interruptions: enabled={allow_interruptions}, min_duration={min_interruption_duration}s, preemptive={preemptive_generation}")
        logger.info(f"📝 Prompt: {call_type} (instructions loaded)")
        
        # Load TurnDetector with EOU built-in (only for pipeline mode)
        # EnglishModel and MultilingualModel have EOU integrated (no separate class needed)
        # unlikely_threshold: Lower = faster turn detection, Higher = more cautious
        # 
        # Auto-select turn detector based on STT language (per LiveKit docs):
        # - EnglishModel: Only supports "en", faster and more accurate for English (98.8% accuracy)
        # - MultilingualModel: Supports "multi" and 14 languages (en, es, fr, de, it, pt, nl, zh, ja, ko, id, tr, ru, hi)
        #   Can work with STT language="multi" because it relies on STT to report detected language
        # 
        # Template override takes precedence if explicitly set, otherwise auto-detect from STT
        template_turn_detector = template.get("turn_detector_model")
        if template_turn_detector in ("english", "multilingual"):
            turn_detector_model = template_turn_detector
            logger.info(f"🎯 Using template-specified turn detector: {turn_detector_model}")
        elif template_turn_detector:
            logger.warning(
                f"⚠️ Deprecated turnDetector value '{template_turn_detector}' ignored. "
                "Valid values: 'english' or 'multilingual'. Falling back to auto-select."
            )
        else:
            # Auto-detect based on STT language
            # Per LiveKit docs: Use MultilingualModel when language="multi" for automatic language detection
            # Docs example: MultilingualModel() + inference.STT(language="multi")
            # "LiveKit Inference performs automatic language detection and passes that value to the turn detector"
            if stt_language == "multi":
                turn_detector_model = "multilingual"
                logger.info(f"🌍 Auto-selected MultilingualModel (STT will auto-detect language)")
            elif stt_language and stt_language != "en":
                turn_detector_model = "multilingual"
                logger.info(f"🌍 Auto-selected MultilingualModel (STT language: {stt_language})")
            else:
                turn_detector_model = "english"
                logger.info(f"🇺🇸 Auto-selected EnglishModel (STT language: {stt_language or 'en'})")
        
        unlikely_threshold = 0.25  # Aggressive for faster turn detection
        
        try:
            if turn_detector_model == "multilingual":
                from livekit.plugins.turn_detector.multilingual import MultilingualModel
                turn_detector = MultilingualModel(unlikely_threshold=unlikely_threshold)
                logger.info(f"🎯 ENTRYPOINT: Turn Detector initialized - MULTILINGUAL with EOU (unlikely_threshold={unlikely_threshold})")
            else:
                from livekit.plugins.turn_detector.english import EnglishModel
                turn_detector = EnglishModel(unlikely_threshold=unlikely_threshold)
                logger.info(f"🎯 ENTRYPOINT: Turn Detector initialized - ENGLISH with EOU (unlikely_threshold={unlikely_threshold})")
        except Exception as e:
            logger.error(f"❌ CRITICAL: Turn detector init failed ({e})")
            raise
        
        # Create session with LiveKit Inference (full unified billing)
        # Format: STT="provider/model", LLM="provider/model", TTS="provider/model:voice_id"
        min_endpointing_delay = 0.1  # Very aggressive - 100ms
        max_endpointing_delay = 3.0  # Prevent lengthy delays
        
        logger.info(f"⏱️ TurnDetector timing: min={min_endpointing_delay}s, max={max_endpointing_delay}s")
        logger.info(f"🚀 Full LiveKit Inference mode - unified billing for STT/LLM/TTS")
    else:
        # Realtime models have built-in turn detection, no separate turn detector needed
        logger.info(f"🚀 Realtime model mode - built-in turn detection")
    
    # IMPORTANT: Ensure caller_phone is set before creating agent
    # If caller_phone is None/empty, the agent won't be able to look up conversation state
    if not caller_phone:
        logger.warning(f"⚠️ ENTRYPOINT: No caller_phone available - using room_name as fallback identifier: {room_name}")
        caller_phone = room_name  # Use room name as fallback for state tracking
    else:
        logger.info(f"✅ ENTRYPOINT: Final caller_phone for agent: {caller_phone}")
    
    # Detect vertical from metadata (for multi-vertical support)
    vertical = metadata.get("vertical", "reverse_mortgage")
    logger.info(f"🏢 ENTRYPOINT: Vertical: {vertical}")
    
    # ✅ Create userdata instance (matches docs pattern)
    # From docs: "session = AgentSession[MySessionInfo](userdata=MySessionInfo(), ...)"
    lead_has_name = bool(lead_context and (lead_context.get("name") or lead_context.get("first_name")))
    userdata = BarbaraSessionData(
        phone_number=caller_phone,
        vertical=vertical,
        current_node="greet",
        lead_context=lead_context,
        call_type=call_type,
        call_direction=call_direction,
        outbound_intro_pending=(call_direction == "outbound" and lead_has_name)
    )
    logger.debug(f"📝 Created BarbaraSessionData: current_node='greet'")
    
    # Create routing coordinator
    coordinator = RoutingCoordinator(
        phone=caller_phone,
        vertical=vertical
    )
    
    # ✅ Store coordinator in userdata (matches docs pattern)
    # From docs: "context.userdata.user_name = name"
    userdata.coordinator = coordinator
    logger.debug(f"📝 Stored coordinator in userdata")
    
    logger.info(f"🤖 ENTRYPOINT: Creating BarbaraNodeAgent for 'greet' node - phone={caller_phone}, vertical={vertical}")
    # Create initial greet agent (database-driven, no need for explicit instructions)
    agent = BarbaraNodeAgent(
        node_name="greet",
        vertical=vertical,
        phone_number=caller_phone,
        chat_ctx=None,  # Fresh conversation
        coordinator=coordinator,
        lead_context=lead_context
    )
    logger.info(f"✅ ENTRYPOINT: BarbaraAgent created")
    
    # Create session - different config for realtime vs pipeline
    if model_type in ["openai_realtime", "gemini_live"]:
        # Realtime model mode - use realtime model as LLM (handles STT+TTS internally)
        # Realtime models use their built-in turn detection (optimized for their architecture)
        # ✅ Pass userdata with type annotation (matches docs pattern)
        session = AgentSession[BarbaraSessionData](
            llm=llm_instance,  # RealtimeModel instance (has built-in turn detection)
            vad=ctx.proc.userdata["vad"],
            userdata=userdata,  # ✅ Pass BarbaraSessionData instance
            # Interruption settings from template
            allow_interruptions=allow_interruptions,
            min_interruption_duration=min_interruption_duration,
            resume_false_interruption=resume_false_interruption,
            false_interruption_timeout=false_interruption_timeout,
            # Response generation settings from template
            preemptive_generation=preemptive_generation,
        )
    else:
        # Pipeline mode - separate STT, LLM, TTS
        # Handle custom voice case
        tts_for_session = tts_string
        if tts_string is None:
            # Custom voice - use plugin with active_tts data
            tts_for_session = build_tts_plugin(active_tts)
            logger.info(f"✨ Using TTS PLUGIN for custom voice")
        
        # Use Deepgram plugin if enabled, otherwise use LiveKit Inference string
        stt_for_session = stt_plugin if stt_plugin else stt_string
        
        # ✅ Pass userdata with type annotation (matches docs pattern)
        session = AgentSession[BarbaraSessionData](
            stt=stt_for_session,  # Plugin instance OR LiveKit Inference string format
            llm=llm_string,  # LiveKit Inference string format
            tts=tts_for_session,  # LiveKit Inference string OR plugin instance
            vad=ctx.proc.userdata["vad"],
            userdata=userdata,  # ✅ Pass BarbaraSessionData instance
            turn_detection=turn_detector,  # EnglishModel or MultilingualModel - SOLE source of truth
            # Endpointing timing - faster response
            min_endpointing_delay=min_endpointing_delay,
            max_endpointing_delay=max_endpointing_delay,
            # Interruption settings from template
            allow_interruptions=allow_interruptions,
            min_interruption_duration=min_interruption_duration,
            resume_false_interruption=resume_false_interruption,
            false_interruption_timeout=false_interruption_timeout,
            # Response generation settings from template
            preemptive_generation=preemptive_generation,
        )
    
    def _install_session_state_observers():
        @session.on("user_state_changed")
        def _log_user_state(ev: UserStateChangedEvent):
            new_state = getattr(ev, "new_state", None)
            old_state = getattr(ev, "old_state", None)
            reason = getattr(ev, "reason", None)
            logger.info(
                f"👂 USER STATE: {old_state} -> {new_state} (reason={reason})"
            )
        
        @session.on("agent_state_changed")
        def _log_agent_state(ev: AgentStateChangedEvent):
            new_state = getattr(ev, "new_state", None)
            old_state = getattr(ev, "old_state", None)
            phase = getattr(ev, "phase", None)
            logger.info(
                f"🤖 AGENT STATE: {old_state} -> {new_state} (phase={phase})"
            )
    
    _install_session_state_observers()
    
    # Start the session with custom BarbaraAgent that auto-greets on entry
    # The session property is set automatically when session.start() is called
    logger.info(f"🎬 ENTRYPOINT: Starting AgentSession...")
    exit_reason: Optional[str] = None
    try:
        await session.start(
            agent=agent,  # Pass our pre-created agent with phone number
            room=ctx.room,
            room_input_options=RoomInputOptions(
                noise_cancellation=noise_cancellation.BVC()
            ),
            room_output_options=RoomOutputOptions(
                audio_enabled=True,  # CRITICAL: Enable audio output for TTS
            ),
        )
        logger.info(f"✅ ENTRYPOINT: AgentSession started - agent.on_enter() should be called next")
        
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
        "instructions": "You are Barbara, a friendly AI assistant.",
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



def build_tts_plugin(active_tts: dict):
    """Build TTS plugin instance from active_tts database row for custom voices"""
    from livekit.agents.types import NOT_GIVEN
    
    provider = active_tts.get("provider", "elevenlabs")
    model = active_tts.get("model", "eleven_turbo_v2_5")
    voice_id = active_tts.get("voice_id", "21m00Tcm4TlvDq8ikWAM")
    
    # Default TTS parameters (could be added to DB in future)
    tts_speed = 1.0
    tts_stability = 0.5
    
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
        return openai.TTS(
            voice=voice_id,
            speed=tts_speed
        )
    elif provider == "google":
        return google.TTS(
            voice_name=voice_id, 
            language="en-US",  # Default language
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
