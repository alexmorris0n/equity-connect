"""LiveKit Voice Agent - Clean rebuild with native plugins"""
import logging
import os
from typing import Optional
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
)
from livekit.plugins import silero

# Import your custom tools
from tools import all_tools

# Import config
from config import Config

logger = logging.getLogger("livekit-agent")
load_dotenv()

# Set environment variables for LiveKit plugins to auto-discover
# STT Providers
os.environ["DEEPGRAM_API_KEY"] = Config.DEEPGRAM_API_KEY
os.environ["ASSEMBLYAI_API_KEY"] = Config.ASSEMBLYAI_API_KEY

# TTS Providers  
os.environ["ELEVEN_API_KEY"] = Config.ELEVENLABS_API_KEY  # ElevenLabs uses ELEVEN_API_KEY
os.environ["SPEECHIFY_API_KEY"] = Config.SPEECHIFY_API_KEY

# LLM Providers
os.environ["OPENAI_API_KEY"] = Config.OPENAI_API_KEY
os.environ["OPENROUTER_API_KEY"] = Config.OPENROUTER_API_KEY

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


async def entrypoint(ctx: JobContext):
    """Main entrypoint - handles each call"""
    await ctx.connect()
    
    room = ctx.room
    room_name = room.name
    
    # Parse room metadata to check for test template
    import json
    room_metadata = {}
    try:
        room_metadata_str = room.metadata or "{}"
        room_metadata = json.loads(room_metadata_str) if isinstance(room_metadata_str, str) else room_metadata_str
    except Exception as e:
        logger.warning(f"Failed to parse room metadata: {e}")
    
    # Check if this is a test room with template
    is_test = room_metadata.get("is_test", False)
    template_id = room_metadata.get("template_id")
    
    if is_test and template_id:
        # Load template from Supabase
        logger.info(f"🎮 Test room - loading template {template_id}")
        template = await load_template(template_id)
        if not template:
            logger.error(f"❌ Template {template_id} not found")
            return
    else:
        # Regular call - use default template
        logger.info(f"📞 Regular call - using default template")
        template = await load_default_template()
    
    # Build plugin instances from template (required for self-hosted)
    stt_plugin = build_stt_plugin(template)
    llm_plugin = build_llm_plugin(template)
    tts_plugin = build_tts_plugin(template)
    
    logger.info(f"🎙️ STT: {template.get('stt_provider')} - {template.get('stt_model')}")
    logger.info(f"🧠 LLM: {template.get('llm_provider')} - {template.get('llm_model')}")
    logger.info(f"🔊 TTS: {template.get('tts_provider')} - {template.get('tts_voice_id')}")
    
    # Get instructions
    instructions = template.get("instructions", "You are Barbara, a friendly AI assistant for Equity Connect.")
    
    # Create session with plugin instances (required for self-hosted LiveKit)
    session = AgentSession(
        stt=stt_plugin,
        llm=llm_plugin,
        tts=tts_plugin,
        vad=ctx.proc.userdata["vad"],
    )
    
    # Start the agent
    await session.start(
        agent=EquityConnectAgent(instructions=instructions),
        room=ctx.room,
    )


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


def build_stt_plugin(template: dict):
    """Build STT plugin instance from template"""
    from livekit.plugins import deepgram, openai, assemblyai
    
    provider = template.get("stt_provider", "deepgram")
    model = template.get("stt_model", "nova-2")
    language = template.get("stt_language", "en-US")
    
    if provider == "deepgram":
        return deepgram.STT(model=model, language=language)
    elif provider == "assemblyai":
        return assemblyai.STT()
    elif provider == "openai":
        return openai.STT()
    else:
        return deepgram.STT(model="nova-2")  # Safe fallback


def build_llm_plugin(template: dict):
    """Build LLM plugin instance from template"""
    from livekit.plugins import openai
    
    provider = template.get("llm_provider", "openai")
    model = template.get("llm_model", "gpt-4o")
    
    if provider == "openrouter":
        return openai.LLM.with_openrouter(
            model=model,
            api_key=Config.OPENROUTER_API_KEY
        )
    elif provider == "openai":
        return openai.LLM(model=model)
    else:
        return openai.LLM(model="gpt-4o")  # Safe fallback


def build_tts_plugin(template: dict):
    """Build TTS plugin instance from template"""
    from livekit.plugins import elevenlabs, openai, google
    
    provider = template.get("tts_provider", "elevenlabs")
    model = template.get("tts_model", "eleven_turbo_v2_5")
    voice_id = template.get("tts_voice_id", "21m00Tcm4TlvDq8ikWAM")
    
    if provider == "elevenlabs":
        return elevenlabs.TTS(voice=voice_id, model=model)
    elif provider == "openai":
        voice = template.get("tts_voice", "alloy")
        return openai.TTS(voice=voice)
    elif provider == "google":
        voice = template.get("tts_voice_id", "en-US-Neural2-A")
        language = template.get("stt_language", "en-US")
        return google.TTS(voice=voice, language=language)
    else:
        return elevenlabs.TTS(voice=voice_id, model="eleven_turbo_v2_5")  # Safe fallback


if __name__ == "__main__":
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        prewarm_fnc=prewarm
    ))
