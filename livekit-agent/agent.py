"""LiveKit Voice Agent Entrypoint
Provider-agnostic voice agent with flexible STT/TTS/LLM configuration
"""
import logging
import time
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime

from livekit import agents, rtc
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    RunContext,
)
try:
    from livekit.plugins import silero
except ImportError:
    silero = None

# Import services
from services.supabase import get_phone_config, get_lead_by_phone, record_interaction
from services.prompts import get_instructions_for_call_type
from services.call_type import detect_call_type
from services.transcript import TranscriptCapture
from services.config import compute_cost
from services.recordings import start_recording, get_recording_metadata
from services.evaluation import evaluate_call

# Providers are created inline with fallback logic

# Import tools
from tools import all_tools

# Import config
from config import Config

logger = logging.getLogger("livekit-agent")
logging.basicConfig(level=logging.INFO)


class EquityConnectAgent(Agent):
    """Main agent class with personalized instructions"""
    
    def __init__(self, instructions: str, tools: list):
        super().__init__(
            instructions=instructions,
            tools=tools
        )
        self.transcript_capture: Optional[TranscriptCapture] = None
    
    async def on_enter(self):
        """Called when agent becomes active - auto-greet"""
        if self.transcript_capture:
            # Auto-greet will be handled in entrypoint after prompt load
            pass
    
    async def on_user_turn_completed(self, turn_ctx: RunContext, new_message):
        """Called after user speaks - capture transcript"""
        if self.transcript_capture and new_message.text_content:
            self.transcript_capture.add_user_message(
                new_message.text_content,
                timestamp=time.time()
            )
            logger.info(f"💬 User: {new_message.text_content[:100]}")
    
    async def on_agent_turn_completed(self, turn_ctx: RunContext, response):
        """Called after agent responds - capture transcript"""
        if self.transcript_capture and response.text_content:
            self.transcript_capture.add_assistant_message(
                response.text_content,
                timestamp=time.time()
            )
            logger.info(f"🤖 Assistant: {response.text_content[:100]}")


def prewarm(proc: JobProcess):
    """Preload models to reduce latency"""
    logger.info("🔥 Prewarming models...")
    if silero:
        proc.userdata["vad"] = silero.VAD.load()
        logger.info("✅ VAD model loaded")
    else:
        proc.userdata["vad"] = None
        logger.warning("⚠️ Silero VAD plugin not available; proceeding without VAD prewarm")


async def entrypoint(ctx: JobContext):
    """Main agent entrypoint - handles call lifecycle"""
    await ctx.connect()
    
    # Extract call metadata from room
    room = ctx.room
    room_name = room.name
    
    # Check if this is a test room from playground
    import json
    room_metadata_str = room.metadata or "{}"
    try:
        room_metadata_dict = json.loads(room_metadata_str) if isinstance(room_metadata_str, str) else room_metadata_str
    except:
        room_metadata_dict = {}
    
    is_test_room = room_metadata_dict.get("is_test", False)
    template_id_from_room = room_metadata_dict.get("template_id")
    
    if is_test_room and template_id_from_room:
        logger.info(f"🎮 TEST ROOM detected: {room_name} | Template: {room_metadata_dict.get('template_name')}")
        # For test rooms, load template directly and skip phone/lead lookup
        from services.templates import get_supabase_client
        supabase = get_supabase_client()
        template = supabase.table("ai_templates").select("*").eq("id", template_id_from_room).single().execute()
        
        if template.data:
            from services.templates import template_to_phone_config
            phone_config = template_to_phone_config(template.data)
            logger.info(f"🔍 DEBUG: Template loaded - tts_provider='{phone_config.get('tts_provider')}', tts_edenai_provider='{phone_config.get('tts_edenai_provider')}'")
            
            # Use generic test prompt
            prompt_metadata = {
                "prompt": "You are Barbara, a friendly AI assistant testing voice configuration. Greet the user and ask how you can help them today.",
                "call_type": "test",
                "version_number": "test",
                "voice": phone_config.get("tts_voice", "alloy"),
                "vad_threshold": phone_config.get("vad_threshold", 0.5),
                "vad_prefix_padding_ms": phone_config.get("vad_prefix_padding_ms", 300),
                "vad_silence_duration_ms": phone_config.get("vad_silence_duration_ms", 500)
            }
            
            lead = None
            broker = None
            lead_id = None
            broker_id = None
            call_type = "test"
            caller_number = None
            called_number = "+10000000000"
            
            logger.info(f"✅ Test room configured with template: {phone_config.get('template_name')}")
            # Skip to provider initialization (jump past call type detection)
        else:
            logger.error(f"❌ Template {template_id_from_room} not found for test room")
            return
    else:
        # Normal call flow
        # Get SIP metadata (set by LiveKit SIP bridge)
        sip_to = None
        sip_from = None
        
        # Try to get from room metadata or participant metadata
        for participant in room.remote_participants.values():
            # Check participant metadata for SIP info
            # Note: ParticipantKind.SIP may not exist in all SDK versions, so we check metadata instead
            metadata = participant.metadata or {}
            if metadata.get("sip_to") or metadata.get("to"):
                sip_to = metadata.get("sip_to") or metadata.get("to")
                sip_from = metadata.get("sip_from") or metadata.get("from")
                break
        
        # Fallback: try room metadata
        if not sip_to:
            sip_to = room_metadata_dict.get("sip_to") or room_metadata_dict.get("called_number")
            sip_from = room_metadata_dict.get("sip_from") or room_metadata_dict.get("caller_number")
        
        logger.info(f"📞 Call metadata: to={sip_to}, from={sip_from}, room={room_name}")
        
        # Determine call direction and type
        called_number = sip_to or room_name
        caller_number = sip_from
        
        # Detect call type
        call_type_result = await detect_call_type(
            direction="inbound" if caller_number else "outbound",
            caller_phone=caller_number,
            called_phone=called_number
        )
        
        call_type = call_type_result.get("call_type", "inbound-unknown")
        lead = call_type_result.get("lead")
        broker = call_type_result.get("broker")
        lead_id = str(lead["id"]) if lead and lead.get("id") else None
        broker_id = str(broker["id"]) if broker and broker.get("id") else None
        
        logger.info(f"📋 Call type: {call_type}, lead_id={lead_id}, broker_id={broker_id}")
        
        # Get phone configuration from AI template with fallback to legacy config
        from services.templates import get_agent_config_with_template
        phone_config = await get_agent_config_with_template(called_number)
        logger.info(f"⚙️ Template: {phone_config.get('template_name', 'Legacy')} | STT={phone_config.get('stt_provider')}, TTS={phone_config.get('tts_provider')}, LLM={phone_config.get('llm_provider')}")
        
        # Load prompt for call type
        prompt_metadata = await get_instructions_for_call_type(
            direction="inbound" if call_type.startswith("inbound") else "outbound",
            context={
                "lead_id": lead_id,
                "broker_id": broker_id,
                "from": caller_number,
                "to": called_number,
                "call_type": call_type,
                "lead": lead,
                "broker": broker
            }
        )
        
        logger.info(f"📝 Loaded prompt: {prompt_metadata.get('call_type')} v{prompt_metadata.get('version_number') or 'hardcoded'}")
    
    # Initialize transcript capture
    transcript_capture = TranscriptCapture()
    
    # Initialize providers with fallback logic
    from services.fallback import ProviderFallback
    
    fallback_handler = ProviderFallback(phone_config)
    stt_provider = None
    tts_provider = None
    llm_provider = None
    is_realtime = phone_config.get("llm_provider") == "openai_realtime"
    
    # Helper function to create STT provider (returns LiveKit plugin)
    async def create_stt(provider_name: str, config: Dict[str, Any]):
        """Create STT provider as LiveKit plugin"""
        if provider_name == "deepgram":
            if not Config.DEEPGRAM_API_KEY:
                raise ValueError("DEEPGRAM_API_KEY not set")
            from livekit.plugins import deepgram
            return deepgram.STT(
                api_key=Config.DEEPGRAM_API_KEY,
                model=config.get("stt_model", "nova-2")
            )
        elif provider_name == "openai":
            if not Config.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY not set")
            from livekit.plugins import openai
            return openai.STT(api_key=Config.OPENAI_API_KEY)
        elif provider_name == "edenai" or provider_name == "eden_ai":
            # Use Eden AI REST API wrapper (implements LiveKit STT plugin interface)
            # Provides unified API key management and provider switching via config
            if not Config.EDENAI_API_KEY:
                raise ValueError("EDENAI_API_KEY not set")
            from providers.stt import create_edenai_stt_plugin
            underlying_provider = config.get("stt_edenai_provider", "deepgram")
            model = config.get("stt_model")
            return create_edenai_stt_plugin(
                api_key=Config.EDENAI_API_KEY,
                provider=underlying_provider,
                model=model
            )
        else:
            raise ValueError(f"Unknown STT provider: {provider_name}")
    
    # Helper function to create TTS provider (returns LiveKit plugin)
    async def create_tts(provider_name: str, config: Dict[str, Any]):
        """Create TTS provider as LiveKit plugin"""
        logger.error(f"🚨🚨🚨 create_tts CALLED with provider_name='{provider_name}', config keys={list(config.keys())}")
        if provider_name == "elevenlabs":
            if not Config.ELEVENLABS_API_KEY:
                raise ValueError("ELEVENLABS_API_KEY not set")
            from livekit.plugins import elevenlabs
            return elevenlabs.TTS(
                api_key=Config.ELEVENLABS_API_KEY,
                voice=config.get("tts_voice", "shimmer")
            )
        elif provider_name == "openai_tts" or provider_name == "openai":
            if not Config.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY not set")
            from livekit.plugins import openai
            
            # Valid OpenAI voices
            valid_voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'verse', 'ballad', 'ash', 'sage', 'marin', 'cedar']
            requested_voice = config.get("tts_voice", "alloy")
            
            # If voice ID is not a valid OpenAI voice (e.g., ElevenLabs ID), use default
            voice = requested_voice if requested_voice in valid_voices else "echo"
            
            return openai.TTS(
                api_key=Config.OPENAI_API_KEY,
                voice=voice
            )
        elif provider_name == "edenai" or provider_name == "eden_ai":
            # Use Eden AI REST API wrapper (implements LiveKit TTS plugin interface)
            # Provides unified API key management and provider switching via config
            logger.info(f"🔍 EDEN_AI TTS: provider_name='{provider_name}' matched!")
            if not Config.EDENAI_API_KEY:
                logger.error("❌ EDENAI_API_KEY not set!")
                raise ValueError("EDENAI_API_KEY not set")
            logger.info(f"✅ EDENAI_API_KEY is set")
            from providers.tts import create_edenai_tts_plugin
            underlying_provider = config.get("tts_edenai_provider", "elevenlabs")
            voice = config.get("tts_voice")
            logger.info(f"🎤 Creating EdenAI TTS: provider={underlying_provider}, voice={voice}")
            plugin = create_edenai_tts_plugin(
                api_key=Config.EDENAI_API_KEY,
                provider=underlying_provider,
                voice=voice
            )
            logger.info(f"✅ EdenAI TTS plugin created successfully!")
            return plugin
        else:
            raise ValueError(f"Unknown TTS provider: {provider_name}")
    
    # Helper function to create LLM provider (returns LiveKit plugin)
    async def create_llm(provider_name: str, config: Dict[str, Any]):
        """
        Create LLM provider as LiveKit plugin
        
        Routing logic:
        - openai_realtime: Always use official RealtimeModel plugin directly (bypasses OpenRouter/Eden AI)
          Reason: Neither OpenRouter nor Eden AI support GPT-realtime voice streaming
        - openrouter: Use official OpenRouter plugin via openai.LLM.with_openrouter()
        - openai: Use official OpenAI LLM plugin directly
        """
        if provider_name == "openai_realtime":
            # CRITICAL: Always bypass aggregators for realtime - use official plugin directly
            # Neither OpenRouter nor Eden AI support GPT-realtime voice streaming
            if not Config.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY not set")
            from livekit.plugins import openai
            voice = config.get("tts_voice", "alloy")
            return openai.realtime.RealtimeModel(
                api_key=Config.OPENAI_API_KEY,
                voice=voice
            )
        elif provider_name == "openai":
            if not Config.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY not set")
            from livekit.plugins import openai
            return openai.LLM(
                api_key=Config.OPENAI_API_KEY,
                model=config.get("llm_model", "gpt-5")
            )
        elif provider_name == "openrouter":
            # Use official OpenRouter plugin for routing to 100+ LLM providers
            # Supports model fallbacks, provider selection, and auto-routing
            if not Config.OPENROUTER_API_KEY:
                raise ValueError("OPENROUTER_API_KEY not set")
            from livekit.plugins import openai
            model = config.get("llm_model", "anthropic/claude-sonnet-4.5")
            fallback_models = config.get("llm_fallback_models", [])
            if isinstance(fallback_models, str):
                fallback_models = [m.strip() for m in fallback_models.split(",")]
            
            return openai.LLM.with_openrouter(
                model=model,
                fallback_models=fallback_models if fallback_models else None,
                api_key=Config.OPENROUTER_API_KEY
            )
        else:
            raise ValueError(f"Unknown LLM provider: {provider_name}")
    
    try:
        # Create STT provider with fallback (skip if using OpenAI Realtime which has bundled STT)
        if not is_realtime:
            stt_provider, actual_stt = await fallback_handler.create_with_fallback(
                "stt",
                create_stt,
                phone_config.copy()
            )
            logger.info(f"✅ STT provider active: {actual_stt}")
        
        # Create TTS provider with fallback (skip if using OpenAI Realtime which has bundled TTS)
        if not is_realtime:
            # Override TTS voice with prompt metadata if available
            tts_config = phone_config.copy()
            if prompt_metadata.get("voice"):
                tts_config["tts_voice"] = prompt_metadata["voice"]
                logger.info(f"🎙️ Using voice from prompt: {prompt_metadata['voice']}")
            
            tts_provider, actual_tts = await fallback_handler.create_with_fallback(
                "tts",
                create_tts,
                tts_config
            )
            logger.info(f"✅ TTS provider active: {actual_tts}")
        
        # Create LLM provider with fallback
        llm_provider, actual_llm = await fallback_handler.create_with_fallback(
            "llm",
            create_llm,
            phone_config.copy()
        )
        logger.info(f"✅ LLM provider active: {actual_llm}")
        
        # CRITICAL FIX: If we started with is_realtime=True but fell back to non-Realtime LLM,
        # we need to initialize STT/TTS which were skipped earlier AND fix the model name
        if is_realtime and actual_llm != "openai_realtime":
            logger.warning(f"⚠️ Realtime failed, fell back to {actual_llm}. Initializing STT/TTS...")
            is_realtime = False  # Update flag
            
            # Fix model name if it's still the realtime model - recreate LLM with correct model
            if phone_config.get("llm_model") == "gpt-4o-realtime-preview":
                phone_config["llm_model"] = "gpt-4o"  # Use chat model instead
                logger.info("🔄 Recreating LLM with gpt-4o instead of gpt-4o-realtime-preview")
                # Recreate LLM with the correct model
                llm_provider, actual_llm = await fallback_handler.create_with_fallback(
                    "llm",
                    create_llm,
                    phone_config.copy()
                )
                logger.info(f"✅ LLM recreated with correct model: {actual_llm}")
            
            # Initialize STT
            stt_provider, actual_stt = await fallback_handler.create_with_fallback(
                "stt",
                create_stt,
                phone_config.copy()
            )
            logger.info(f"✅ STT provider active: {actual_stt}")
            
            # Initialize TTS  
            tts_config = phone_config.copy()
            if prompt_metadata.get("voice"):
                tts_config["tts_voice"] = prompt_metadata["voice"]
            tts_provider, actual_tts = await fallback_handler.create_with_fallback(
                "tts",
                create_tts,
                tts_config
            )
            logger.info(f"✅ TTS provider active: {actual_tts}")
        
        # Update phone_config with actual providers used (for cost tracking)
        actual_providers = fallback_handler.get_actual_providers()
        phone_config.update({
            "stt_provider": actual_providers.get("stt") or phone_config.get("stt_provider"),
            "tts_provider": actual_providers.get("tts") or phone_config.get("tts_provider"),
            "llm_provider": actual_providers.get("llm") or phone_config.get("llm_provider"),
        })
        
        logger.info("✅ All providers initialized with fallback support")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize providers: {e}")
        # Final fallback - use OpenAI defaults
        try:
            from livekit.plugins import openai
            # Always initialize STT/TTS in fallback mode (we're not using Realtime if we're here)
            stt_provider = openai.STT(api_key=Config.OPENAI_API_KEY)
            tts_provider = openai.TTS(api_key=Config.OPENAI_API_KEY, voice="alloy")
            llm_provider = openai.LLM(api_key=Config.OPENAI_API_KEY, model="gpt-5")
            is_realtime = False  # We're not using Realtime if we fell back
            logger.warning("⚠️ Using OpenAI fallback providers (STT/TTS/LLM)")
        except Exception as final_error:
            logger.error(f"❌ Even fallback providers failed: {final_error}")
            raise
    
    # Configure VAD from prompt metadata
    vad = ctx.proc.userdata.get("vad")
    vad_threshold = prompt_metadata.get("vad_threshold", 0.5)
    vad_prefix_padding_ms = prompt_metadata.get("vad_prefix_padding_ms", 300)
    vad_silence_duration_ms = prompt_metadata.get("vad_silence_duration_ms", 500)
    
    # Create agent session
    session_config: Dict[str, Any] = {
        "llm": llm_provider,
        "vad": vad,
        "allow_interruptions": True,
        "preemptive_generation": True,
    }
    
    # Add STT/TTS if not using Realtime
    if not is_realtime and stt_provider:
        session_config["stt"] = stt_provider
        logger.error(f"🚨 STT added to session_config!")
    if not is_realtime and tts_provider:
        session_config["tts"] = tts_provider
        logger.error(f"🚨 TTS added to session_config! type={type(tts_provider)}")
    else:
        logger.error(f"🚨 TTS NOT added! is_realtime={is_realtime}, tts_provider={tts_provider}")
    
    # Configure turn detection with VAD settings
    if vad:
        session_config["turn_detection"] = "vad"
        session_config["min_endpointing_delay"] = vad_prefix_padding_ms / 1000.0
        session_config["max_endpointing_delay"] = vad_silence_duration_ms / 1000.0
    
    # Add template metadata to room for webhook tracking
    if phone_config.get("template_id"):
        try:
            await ctx.room.update_metadata(str({
                "template_id": phone_config.get("template_id"),
                "template_name": phone_config.get("template_name")
            }))
            logger.info(f"✅ Room metadata updated with template ID")
        except Exception as e:
            logger.warning(f"⚠️ Failed to update room metadata: {e}")
    
    session = AgentSession(**session_config)
    
    # Prepare instructions (convert for GPT-realtime if needed)
    instructions = prompt_metadata.get("prompt", "You are a helpful assistant.")
    
    if is_realtime and phone_config.get("llm_provider") == "openai_realtime":
        # Convert prompt to GPT-realtime format
        from services.prompt_adapter import convert_and_cache_prompt
        
        # Build variable context for injection
        prompt_variables = {
            "leadFirstName": lead.get("first_name", "") if lead else "",
            "leadFullName": lead.get("full_name", "") if lead else "",
            "brokerName": broker.get("contact_name", "") if broker else "",
            "brokerCompany": broker.get("company_name", "") if broker else "",
            "callContext": "inbound" if call_type.startswith("inbound") else "outbound",
            "phoneNumber": caller_number or "",
        }
        
        # Convert to realtime format
        try:
            instructions = convert_and_cache_prompt(
                prompt_content={"role": instructions},  # Wrap in structure
                variables=prompt_variables
            )
            logger.info("✅ Converted prompt to GPT-realtime format")
        except Exception as e:
            logger.error(f"❌ Prompt conversion failed: {e}. Using original.")
    
    # Create agent with instructions and tools
    agent = EquityConnectAgent(
        instructions=instructions,
        tools=all_tools
    )
    agent.transcript_capture = transcript_capture
    
    # Track session metrics
    session_start_time = time.time()
    stt_minutes = 0.0
    tts_chars = 0
    llm_tokens = 0
    
    # Start egress recording if configured
    recording_meta = None
    egress_id = None
    if Config.AWS_BUCKET_NAME:
        try:
            egress_id = await start_recording(room_name=room_name)
            if egress_id:
                logger.info(f"🎙️ Recording started: {egress_id}")
        except Exception as e:
            logger.error(f"❌ Failed to start recording: {e}")
    
    # Set up metrics collection for cost tracking
    @session.on("metrics_collected")
    def on_metrics_collected(ev):
        nonlocal stt_minutes, tts_chars, llm_tokens
        metrics = ev.metrics
        
        # Accumulate STT usage
        if hasattr(metrics, "stt") and metrics.stt:
            stt_minutes += metrics.stt.get("duration", 0) / 60.0
        
        # Accumulate TTS usage
        if hasattr(metrics, "tts") and metrics.tts:
            tts_chars += metrics.tts.get("characters", 0)
        
        # Accumulate LLM usage
        if hasattr(metrics, "llm") and metrics.llm:
            llm_tokens += metrics.llm.get("tokens", 0)
    
    # Start the session
    await session.start(
        agent=agent,
        room=room
    )
    
    # Auto-greet based on call type
    if lead and lead.get("first_name"):
        greet_text = f"Hi {lead['first_name']}! This is Barbara with Equity Connect. How are you today?"
    else:
        greet_text = "Hi! This is Barbara with Equity Connect. What brought you to call today?"
    
    # Override with prompt-specific greeting if available
    if prompt_metadata.get('first_message'):
        greet_text = prompt_metadata['first_message']
    
    await session.say(greet_text, add_to_chat_ctx=True)
    transcript_capture.add_assistant_message(greet_text)
    logger.info(f"👋 Auto-greet: {greet_text[:50]}...")
    
    # Wait for participant to disconnect
    try:
        await ctx.wait_for_participant(timeout=None)
    except Exception:
        pass
    
    # Wait a bit for final messages
    await asyncio.sleep(2)
    
    # Calculate session duration
    session_duration = int(time.time() - session_start_time)
    
    # Get recording metadata if recording was started
    if egress_id:
        try:
            recording_meta = await get_recording_metadata(egress_id)
            if recording_meta:
                logger.info("🎙️ Recording metadata retrieved")
        except Exception as e:
            logger.error(f"❌ Failed to get recording metadata: {e}")
    
    # Fallback: get transcript from session history if capture is empty
    if len(transcript_capture.get_transcript()) == 0 and hasattr(session, "history"):
        transcript_capture.from_session_history(session.history)
    
    # Compute cost
    estimated_cost = compute_cost(
        stt_minutes=stt_minutes,
        tts_chars=tts_chars,
        llm_tokens=llm_tokens if not is_realtime else None,
        llm_provider=phone_config.get("llm_provider", "openai"),
        stt_provider=phone_config.get("stt_provider", "deepgram"),
        tts_provider=phone_config.get("tts_provider", "elevenlabs"),
        llm_model=phone_config.get("llm_model", "gpt-5"),
        stt_model=phone_config.get("stt_model", "nova-2"),
        tts_voice=phone_config.get("tts_voice", "shimmer"),
        is_realtime=is_realtime,
        config=phone_config  # Pass config for Eden AI underlying provider lookup
    )
    
    logger.info(f"💰 Estimated cost: ${estimated_cost:.4f}")
    
    # Format transcript for storage
    transcript_data = transcript_capture.format_for_storage()
    transcript_list = transcript_capture.get_transcript()
    transcript_text = transcript_capture.get_transcript_text()
    
    # Build prompt version string
    prompt_version = None
    if prompt_metadata.get('version_number'):
        prompt_version = f"{prompt_metadata.get('call_type')}-v{prompt_metadata.get('version_number')}"
    
    # Save interaction
    try:
        interaction_id = await record_interaction(
            session_data={
                "lead_id": lead_id,
                "broker_id": broker_id,
                "direction": "inbound" if call_type.startswith("inbound") else "outbound",
                "duration_seconds": session_duration,
                "outcome": "neutral",  # Could be determined from transcript
                "room_name": room_name
            },
            phone_config=phone_config,
            cost=estimated_cost,
            transcript=transcript_list,
            prompt_version=prompt_version,
            recording_meta=recording_meta
        )
        logger.info(f"✅ Interaction saved: {interaction_id}")
        
        # Trigger post-call evaluation (async, non-blocking)
        if interaction_id and transcript_list:
            try:
                # Run evaluation in background task (don't await - let it complete independently)
                asyncio.create_task(evaluate_call(
                    interaction_id=interaction_id,
                    transcript=transcript_list,
                    prompt_version=prompt_version
                ))
                logger.info(f"📊 Post-call evaluation triggered for {interaction_id}")
            except Exception as eval_err:
                logger.error(f"❌ Failed to trigger evaluation: {eval_err}")
    except Exception as e:
        logger.error(f"❌ Failed to save interaction: {e}")
    
    logger.info(f"✅ Call completed: {session_duration}s, {len(transcript_list)} messages")


if __name__ == "__main__":
    import asyncio
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        prewarm_fnc=prewarm
    ))

