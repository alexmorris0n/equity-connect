"""TTS (Text-to-Speech) provider factory - Native LiveKit plugins only"""
import logging
from typing import Optional, Dict, Any
from config import Config

logger = logging.getLogger(__name__)


async def create_tts_plugin(provider_name: str, config: Dict[str, Any]):
    """
    Create native LiveKit TTS plugin for the specified provider
    
    Supported providers:
    - elevenlabs: ElevenLabs TTS (native plugin)
    - openai: OpenAI TTS (native plugin)
    - google: Google Cloud TTS (native plugin)
    - speechify: Speechify TTS (native plugin)
    
    Args:
        provider_name: Name of the TTS provider
        config: Configuration dict with provider-specific settings
    
    Returns:
        LiveKit TTS plugin instance
    """
    logger.info(f"🎤 Creating TTS plugin: {provider_name}")
    
    if provider_name == "elevenlabs":
        if not Config.ELEVENLABS_API_KEY:
            raise ValueError("ELEVENLABS_API_KEY not set")
        from livekit.plugins import elevenlabs
        
        voice = config.get("tts_voice", "shimmer")
        model = config.get("tts_model", "eleven_turbo_v2_5")  # Fast, high-quality model
        
        return elevenlabs.TTS(
            api_key=Config.ELEVENLABS_API_KEY,
            voice=voice,
            model=model
        )
    
    elif provider_name == "openai" or provider_name == "openai_tts":
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
    
    elif provider_name == "google":
        if not Config.GOOGLE_APPLICATION_CREDENTIALS_JSON:
            raise ValueError("GOOGLE_APPLICATION_CREDENTIALS_JSON not set")
        from livekit.plugins import google
        
        voice = config.get("tts_voice", "en-US-Neural2-A")
        language = config.get("language", "en-US")
        
        return google.TTS(
            credentials_info=Config.GOOGLE_APPLICATION_CREDENTIALS_JSON,
            voice=voice,
            language=language
        )
    
    elif provider_name == "speechify":
        if not Config.SPEECHIFY_API_KEY:
            raise ValueError("SPEECHIFY_API_KEY not set")
        from livekit.plugins import speechify
        
        voice = config.get("tts_voice", "mrbeast")
        
        return speechify.TTS(
            api_key=Config.SPEECHIFY_API_KEY,
            voice=voice
        )
    
    else:
        raise ValueError(f"Unknown TTS provider: {provider_name}. Supported: elevenlabs, openai, google, speechify")
