"""STT (Speech-to-Text) provider factory - Native LiveKit plugins only"""
import logging
from typing import Optional, Dict, Any
from config import Config

logger = logging.getLogger(__name__)


async def create_stt_plugin(provider_name: str, config: Dict[str, Any]):
    """
    Create native LiveKit STT plugin for the specified provider
    
    Supported providers:
    - deepgram: Deepgram STT (native plugin)
    - openai: OpenAI Whisper STT (native plugin)
    - google: Google Cloud STT (native plugin)
    - assemblyai: AssemblyAI STT (native plugin)
    
    Args:
        provider_name: Name of the STT provider
        config: Configuration dict with provider-specific settings
    
    Returns:
        LiveKit STT plugin instance
    """
    logger.info(f"🎙️ Creating STT plugin: {provider_name}")
    
    if provider_name == "deepgram":
        if not Config.DEEPGRAM_API_KEY:
            raise ValueError("DEEPGRAM_API_KEY not set")
        from livekit.plugins import deepgram
        
        model = config.get("stt_model", "nova-2")
        language = config.get("language", "en-US")
        
        return deepgram.STT(
            api_key=Config.DEEPGRAM_API_KEY,
            model=model,
            language=language
        )
    
    elif provider_name == "openai":
        if not Config.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not set")
        from livekit.plugins import openai
        
        return openai.STT(
            api_key=Config.OPENAI_API_KEY
        )
    
    elif provider_name == "google":
        if not Config.GOOGLE_APPLICATION_CREDENTIALS_JSON:
            raise ValueError("GOOGLE_APPLICATION_CREDENTIALS_JSON not set")
        from livekit.plugins import google
        
        language = config.get("language", "en-US")
        
        return google.STT(
            credentials_info=Config.GOOGLE_APPLICATION_CREDENTIALS_JSON,
            language=language
        )
    
    elif provider_name == "assemblyai":
        if not Config.ASSEMBLYAI_API_KEY:
            raise ValueError("ASSEMBLYAI_API_KEY not set")
        from livekit.plugins import assemblyai
        
        return assemblyai.STT(
            api_key=Config.ASSEMBLYAI_API_KEY
        )
    
    else:
        raise ValueError(f"Unknown STT provider: {provider_name}. Supported: deepgram, openai, google, assemblyai")
