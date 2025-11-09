"""STT (Speech-to-Text) provider factory and adapters"""
from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional
from config import Config
import logging
import base64
import httpx
import json

logger = logging.getLogger(__name__)

class STTProvider(ABC):
    """Abstract base class for STT providers"""
    
    @abstractmethod
    async def stream_transcribe(self, audio_stream: AsyncIterator[bytes]) -> AsyncIterator[str]:
        """Stream transcription from audio stream"""
        pass

class DeepgramSTT(STTProvider):
    """Deepgram STT provider"""
    
    def __init__(self, api_key: str, model: str = 'nova-2'):
        self.api_key = api_key
        self.model = model
    
    async def stream_transcribe(self, audio_stream: AsyncIterator[bytes]) -> AsyncIterator[str]:
        """Stream transcription using Deepgram"""
        try:
            from livekit.plugins import deepgram
            # Use LiveKit's Deepgram plugin
            stt = deepgram.STT(
                api_key=self.api_key,
                model=self.model
            )
            async for text in stt.stream_transcribe(audio_stream):
                yield text
        except Exception as e:
            logger.error(f"❌ Deepgram STT error: {e}")
            raise

class OpenAIWhisperSTT(STTProvider):
    """OpenAI Whisper STT provider"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def stream_transcribe(self, audio_stream: AsyncIterator[bytes]) -> AsyncIterator[str]:
        """Stream transcription using OpenAI Whisper"""
        try:
            from livekit.plugins import openai
            stt = openai.STT(api_key=self.api_key)
            async for text in stt.stream_transcribe(audio_stream):
                yield text
        except Exception as e:
            logger.error(f"❌ OpenAI Whisper STT error: {e}")
            raise

class AssemblyAISTT(STTProvider):
    """AssemblyAI STT provider (stub)"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        logger.warning("⚠️ AssemblyAI STT not yet implemented")
    
    async def stream_transcribe(self, audio_stream: AsyncIterator[bytes]) -> AsyncIterator[str]:
        """Stub implementation"""
        raise NotImplementedError("AssemblyAI STT not yet implemented")

class GoogleSTT(STTProvider):
    """Google Speech-to-Text provider (stub)"""
    
    def __init__(self, credentials_json: str):
        self.credentials_json = credentials_json
        logger.warning("⚠️ Google STT not yet implemented")
    
    async def stream_transcribe(self, audio_stream: AsyncIterator[bytes]) -> AsyncIterator[str]:
        """Stub implementation"""
        raise NotImplementedError("Google STT not yet implemented")

class EdenAISTT(STTProvider):
    """Eden AI STT provider - unified API for multiple STT providers"""
    
    def __init__(self, api_key: str, provider: str = 'deepgram', model: Optional[str] = None):
        """
        Initialize Eden AI STT provider
        
        Args:
            api_key: Eden AI API key
            provider: Underlying provider name (e.g., 'deepgram', 'openai', 'assemblyai', 'google')
            model: Optional model name for the provider
        """
        self.api_key = api_key
        self.provider = provider
        self.model = model
        self.base_url = 'https://api.edenai.run/v2'
    
    async def stream_transcribe(self, audio_stream: AsyncIterator[bytes]) -> AsyncIterator[str]:
        """
        Stream transcription using Eden AI
        
        Note: Eden AI doesn't support true streaming, so we buffer the audio
        and send it as a single request. For LiveKit integration, this works
        with the LiveKit STT plugin interface.
        """
        try:
            # Collect audio chunks
            audio_data = b''
            async for chunk in audio_stream:
                audio_data += chunk
            
            if not audio_data:
                return
            
            # Encode audio as base64
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            # Determine file format (assume WAV/PCM for now)
            # Eden AI auto-detects format, but we can specify
            files = {
                'file': ('audio.wav', audio_data, 'audio/wav')
            }
            
            data = {
                'providers': self.provider,
                'language': 'en-US',
            }
            
            if self.model:
                data[f'{self.provider}_settings'] = json.dumps({'model': self.model})
            
            headers = {
                'Authorization': f'Bearer {self.api_key}'
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f'{self.base_url}/audio/speech_to_text',
                    headers=headers,
                    data=data,
                    files=files
                )
                response.raise_for_status()
                result = response.json()
                
                # Extract transcription from Eden AI response
                provider_result = result.get(self.provider, {})
                if provider_result.get('status') == 'success':
                    text = provider_result.get('text', '')
                    if text:
                        yield text
                else:
                    error = provider_result.get('error', 'Unknown error')
                    logger.error(f"❌ Eden AI STT error: {error}")
                    raise Exception(f"Eden AI STT failed: {error}")
                    
        except Exception as e:
            logger.error(f"❌ Eden AI STT error: {e}")
            raise

def create_edenai_stt_plugin(api_key: str, provider: str = 'deepgram', model: Optional[str] = None):
    """
    Create a LiveKit-compatible STT plugin wrapper for Eden AI
    
    This wraps Eden AI's REST API to work with LiveKit's STT interface.
    Note: Eden AI doesn't support true streaming, so audio is buffered.
    """
    from livekit import agents
    from livekit.agents import stt
    
    class EdenAISTTPlugin(stt.STT):
        """LiveKit STT plugin wrapper for Eden AI"""
        
        def __init__(self, api_key: str, provider: str, model: Optional[str]):
            super().__init__()
            self.api_key = api_key
            self.provider = provider
            self.model = model
            self.base_url = 'https://api.edenai.run/v2'
        
        async def _recognize_impl(self, *, buffer: bytes, language: str = "en-US") -> stt.SpeechEvent:
            """Recognize speech from audio buffer"""
            try:
                import httpx
                import json
                
                files = {
                    'file': ('audio.wav', buffer, 'audio/wav')
                }
                
                data = {
                    'providers': self.provider,
                    'language': language,
                }
                
                if self.model:
                    data[f'{self.provider}_settings'] = json.dumps({'model': self.model})
                
                headers = {
                    'Authorization': f'Bearer {self.api_key}'
                }
                
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        f'{self.base_url}/audio/speech_to_text',
                        headers=headers,
                        data=data,
                        files=files
                    )
                    response.raise_for_status()
                    result = response.json()
                    
                    provider_result = result.get(self.provider, {})
                    if provider_result.get('status') == 'success':
                        text = provider_result.get('text', '')
                        if text:
                            return stt.SpeechEvent(
                                type=stt.SpeechEventType.FINAL_TRANSCRIPT,
                                alternatives=[stt.SpeechData(text=text, language=language)]
                            )
                    
                    error = provider_result.get('error', 'Unknown error')
                    logger.error(f"❌ Eden AI STT error: {error}")
                    raise Exception(f"Eden AI STT failed: {error}")
                    
            except Exception as e:
                logger.error(f"❌ Eden AI STT error: {e}")
                raise
    
    return EdenAISTTPlugin(api_key=api_key, provider=provider, model=model)

async def get_stt_provider(config: dict, fallback: Optional[str] = None) -> STTProvider:
    """
    Factory function to get STT provider based on config
    
    Args:
        config: Provider config dict with 'stt_provider' and 'stt_model'
        fallback: Optional fallback provider name
    
    Returns:
        STTProvider instance
    """
    provider_name = config.get('stt_provider', 'deepgram')
    
    # Try primary provider
    try:
        if provider_name == 'deepgram':
            if not Config.DEEPGRAM_API_KEY:
                raise ValueError("DEEPGRAM_API_KEY not set")
            return DeepgramSTT(
                api_key=Config.DEEPGRAM_API_KEY,
                model=config.get('stt_model', 'nova-2')
            )
        elif provider_name == 'openai':
            if not Config.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY not set")
            return OpenAIWhisperSTT(api_key=Config.OPENAI_API_KEY)
        elif provider_name == 'assemblyai':
            if not Config.ASSEMBLYAI_API_KEY:
                raise ValueError("ASSEMBLYAI_API_KEY not set")
            return AssemblyAISTT(api_key=Config.ASSEMBLYAI_API_KEY)
        elif provider_name == 'google':
            if not Config.GOOGLE_APPLICATION_CREDENTIALS_JSON:
                raise ValueError("GOOGLE_APPLICATION_CREDENTIALS_JSON not set")
            return GoogleSTT(credentials_json=Config.GOOGLE_APPLICATION_CREDENTIALS_JSON)
        elif provider_name == 'edenai':
            if not Config.EDENAI_API_KEY:
                raise ValueError("EDENAI_API_KEY not set")
            # Extract underlying provider from config
            underlying_provider = config.get('stt_edenai_provider', 'deepgram')
            model = config.get('stt_model')
            # Return LiveKit-compatible plugin wrapper (not async function)
            return create_edenai_stt_plugin(
                api_key=Config.EDENAI_API_KEY,
                provider=underlying_provider,
                model=model
            )
        else:
            raise ValueError(f"Unknown STT provider: {provider_name}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize {provider_name} STT: {e}")
        
        # Try fallback
        fallback_name = fallback or config.get('stt_fallback_provider') or Config.DEFAULT_FALLBACK_STT_PROVIDER
        if fallback_name and fallback_name != provider_name:
            logger.info(f"🔄 Falling back to {fallback_name} STT")
            fallback_config = config.copy()
            fallback_config['stt_provider'] = fallback_name
            return await get_stt_provider(fallback_config)
        
        raise

