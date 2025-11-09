"""TTS (Text-to-Speech) provider factory and adapters"""
from abc import ABC, abstractmethod
from typing import Optional
from config import Config
import logging
import httpx
import json

logger = logging.getLogger(__name__)

class TTSProvider(ABC):
    """Abstract base class for TTS providers"""
    
    @abstractmethod
    async def synthesize(self, text: str) -> bytes:
        """Synthesize speech from text"""
        pass

class ElevenLabsTTS(TTSProvider):
    """ElevenLabs TTS provider"""
    
    def __init__(self, api_key: str, voice: str = 'shimmer'):
        self.api_key = api_key
        self.voice = voice
    
    async def synthesize(self, text: str) -> bytes:
        """Synthesize speech using ElevenLabs"""
        try:
            from livekit.plugins import elevenlabs
            tts = elevenlabs.TTS(
                api_key=self.api_key,
                voice=self.voice
            )
            return await tts.synthesize(text)
        except Exception as e:
            logger.error(f"❌ ElevenLabs TTS error: {e}")
            raise

class OpenAITTS(TTSProvider):
    """OpenAI TTS provider"""
    
    def __init__(self, api_key: str, voice: str = 'alloy'):
        self.api_key = api_key
        self.voice = voice
    
    async def synthesize(self, text: str) -> bytes:
        """Synthesize speech using OpenAI TTS"""
        try:
            from livekit.plugins import openai
            tts = openai.TTS(
                api_key=self.api_key,
                voice=self.voice
            )
            return await tts.synthesize(text)
        except Exception as e:
            logger.error(f"❌ OpenAI TTS error: {e}")
            raise

class PlayHTTTS(TTSProvider):
    """PlayHT TTS provider (stub)"""
    
    def __init__(self, api_key: str, voice: str):
        self.api_key = api_key
        self.voice = voice
        logger.warning("⚠️ PlayHT TTS not yet implemented")
    
    async def synthesize(self, text: str) -> bytes:
        """Stub implementation"""
        raise NotImplementedError("PlayHT TTS not yet implemented")

class DeepgramAuraTTS(TTSProvider):
    """Deepgram Aura TTS provider (stub)"""
    
    def __init__(self, api_key: str, voice: str):
        self.api_key = api_key
        self.voice = voice
        logger.warning("⚠️ Deepgram Aura TTS not yet implemented")
    
    async def synthesize(self, text: str) -> bytes:
        """Stub implementation"""
        raise NotImplementedError("Deepgram Aura TTS not yet implemented")

class GoogleTTS(TTSProvider):
    """Google Cloud TTS provider (stub)"""
    
    def __init__(self, credentials_json: str, voice: str):
        self.credentials_json = credentials_json
        self.voice = voice
        logger.warning("⚠️ Google TTS not yet implemented")
    
    async def synthesize(self, text: str) -> bytes:
        """Stub implementation"""
        raise NotImplementedError("Google TTS not yet implemented")

class EdenAITTS(TTSProvider):
    """Eden AI TTS provider - unified API for multiple TTS providers"""
    
    def __init__(self, api_key: str, provider: str = 'elevenlabs', voice: Optional[str] = None):
        """
        Initialize Eden AI TTS provider
        
        Args:
            api_key: Eden AI API key
            provider: Underlying provider name (e.g., 'elevenlabs', 'openai', 'playht', 'google')
            voice: Voice name for the provider
        """
        self.api_key = api_key
        self.provider = provider
        self.voice = voice
        self.base_url = 'https://api.edenai.run/v2'
    
    async def synthesize(self, text: str) -> bytes:
        """Synthesize speech using Eden AI"""
        try:
            data = {
                'providers': self.provider,
                'text': text,
                'language': 'en-US',
            }
            
            # Add provider-specific settings (voice)
            if self.voice:
                provider_settings = {'voice': self.voice}
                data[f'{self.provider}_settings'] = json.dumps(provider_settings)
            
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f'{self.base_url}/audio/text_to_speech',
                    headers=headers,
                    json=data
                )
                response.raise_for_status()
                result = response.json()
                
                # Extract audio from Eden AI response
                provider_result = result.get(self.provider, {})
                if provider_result.get('status') == 'success':
                    audio_url = provider_result.get('audio_resource_url')
                    if audio_url:
                        # Download the audio file
                        audio_response = await client.get(audio_url)
                        audio_response.raise_for_status()
                        return audio_response.content
                    else:
                        # Some providers return base64 audio
                        audio_base64 = provider_result.get('audio')
                        if audio_base64:
                            import base64
                            return base64.b64decode(audio_base64)
                        raise Exception("No audio data in Eden AI response")
                else:
                    error = provider_result.get('error', 'Unknown error')
                    logger.error(f"❌ Eden AI TTS error: {error}")
                    raise Exception(f"Eden AI TTS failed: {error}")
                    
        except Exception as e:
            logger.error(f"❌ Eden AI TTS error: {e}")
            raise

def create_edenai_tts_plugin(api_key: str, provider: str = 'elevenlabs', voice: Optional[str] = None):
    """
    Create a LiveKit-compatible TTS plugin wrapper for Eden AI
    
    This wraps Eden AI's REST API to work with LiveKit's TTS interface.
    """
    from livekit import agents
    from livekit.agents import tts
    
    class EdenAITTSPlugin(tts.TTS):
        """LiveKit TTS plugin wrapper for Eden AI"""
        
        def __init__(self, api_key: str, provider: str, voice: Optional[str]):
            super().__init__()
            self.api_key = api_key
            self.provider = provider
            self.voice = voice
            self.base_url = 'https://api.edenai.run/v2'
        
        async def synthesize(self, text: str, *, language: str = "en-US") -> tts.SynthesizeStream:
            """Synthesize speech from text"""
            try:
                import httpx
                import json
                
                data = {
                    'providers': self.provider,
                    'text': text,
                    'language': language,
                }
                
                if self.voice:
                    provider_settings = {'voice': self.voice}
                    data[f'{self.provider}_settings'] = json.dumps(provider_settings)
                
                headers = {
                    'Authorization': f'Bearer {self.api_key}',
                    'Content-Type': 'application/json'
                }
                
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        f'{self.base_url}/audio/text_to_speech',
                        headers=headers,
                        json=data
                    )
                    response.raise_for_status()
                    result = response.json()
                    
                    provider_result = result.get(self.provider, {})
                    if provider_result.get('status') == 'success':
                        audio_url = provider_result.get('audio_resource_url')
                        if audio_url:
                            # Stream the audio file in chunks for lower latency playback
                            stream = tts.SynthesizeStream()
                            async with client.stream('GET', audio_url) as audio_response:
                                audio_response.raise_for_status()
                                async for chunk in audio_response.aiter_bytes():
                                    if chunk:
                                        await stream.push_frame(chunk)
                            await stream.aclose()
                            return stream
                        else:
                            # Some providers return base64 audio
                            audio_base64 = provider_result.get('audio')
                            if audio_base64:
                                import base64
                                audio_data = base64.b64decode(audio_base64)
                            else:
                                raise Exception("No audio data in Eden AI response")

                        # Fallback: push the full decoded audio buffer at once
                        stream = tts.SynthesizeStream()
                        await stream.push_frame(audio_data)
                        await stream.aclose()
                        return stream
                    else:
                        error = provider_result.get('error', 'Unknown error')
                        logger.error(f"❌ Eden AI TTS error: {error}")
                        raise Exception(f"Eden AI TTS failed: {error}")
                        
            except Exception as e:
                logger.error(f"❌ Eden AI TTS error: {e}")
                raise
    
    return EdenAITTSPlugin(api_key=api_key, provider=provider, voice=voice)

async def get_tts_provider(config: dict, fallback: Optional[str] = None) -> TTSProvider:
    """
    Factory function to get TTS provider based on config
    
    Args:
        config: Provider config dict with 'tts_provider' and 'tts_voice'
        fallback: Optional fallback provider name
    
    Returns:
        TTSProvider instance
    """
    provider_name = config.get('tts_provider', 'elevenlabs')
    
    # Try primary provider
    try:
        if provider_name == 'elevenlabs':
            if not Config.ELEVENLABS_API_KEY:
                raise ValueError("ELEVENLABS_API_KEY not set")
            return ElevenLabsTTS(
                api_key=Config.ELEVENLABS_API_KEY,
                voice=config.get('tts_voice', 'shimmer')
            )
        elif provider_name == 'openai':
            if not Config.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY not set")
            return OpenAITTS(
                api_key=Config.OPENAI_API_KEY,
                voice=config.get('tts_voice', 'alloy')
            )
        elif provider_name == 'playht':
            if not Config.PLAYHT_API_KEY:
                raise ValueError("PLAYHT_API_KEY not set")
            return PlayHTTTS(
                api_key=Config.PLAYHT_API_KEY,
                voice=config.get('tts_voice', 'default')
            )
        elif provider_name == 'deepgram':
            if not Config.DEEPGRAM_API_KEY:
                raise ValueError("DEEPGRAM_API_KEY not set")
            return DeepgramAuraTTS(
                api_key=Config.DEEPGRAM_API_KEY,
                voice=config.get('tts_voice', 'default')
            )
        elif provider_name == 'google':
            if not Config.GOOGLE_APPLICATION_CREDENTIALS_JSON:
                raise ValueError("GOOGLE_APPLICATION_CREDENTIALS_JSON not set")
            return GoogleTTS(
                credentials_json=Config.GOOGLE_APPLICATION_CREDENTIALS_JSON,
                voice=config.get('tts_voice', 'default')
            )
        elif provider_name == 'edenai':
            if not Config.EDENAI_API_KEY:
                raise ValueError("EDENAI_API_KEY not set")
            # Extract underlying provider from config
            underlying_provider = config.get('tts_edenai_provider', 'elevenlabs')
            voice = config.get('tts_voice')
            # Return LiveKit-compatible plugin wrapper
            return create_edenai_tts_plugin(
                api_key=Config.EDENAI_API_KEY,
                provider=underlying_provider,
                voice=voice
            )
        else:
            raise ValueError(f"Unknown TTS provider: {provider_name}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize {provider_name} TTS: {e}")
        
        # Try fallback
        fallback_name = fallback or config.get('tts_fallback_provider') or Config.DEFAULT_FALLBACK_TTS_PROVIDER
        if fallback_name and fallback_name != provider_name:
            logger.info(f"🔄 Falling back to {fallback_name} TTS")
            fallback_config = config.copy()
            fallback_config['tts_provider'] = fallback_name
            return await get_tts_provider(fallback_config)
        
        raise

