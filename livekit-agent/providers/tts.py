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
            provider: Underlying provider name (e.g., 'elevenlabs', 'openai', 'deepgram', 'google', 'amazon', 'microsoft')
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
                # Different providers use different parameter names
                if self.provider == 'elevenlabs':
                    provider_settings = {'voice_id': self.voice}
                elif self.provider == 'openai':
                    provider_settings = {'voice': self.voice}
                elif self.provider == 'playht':
                    provider_settings = {'voice': self.voice}
                elif self.provider == 'google':
                    provider_settings = {'voice_name': self.voice}
                else:
                    provider_settings = {'voice': self.voice}  # Default
                
                # Pass dict object (not JSON string) since we use json=data
                data[f'{self.provider}_settings'] = provider_settings
            
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
    from contextlib import asynccontextmanager
    from typing import AsyncIterator
    
    class EdenAITTSPlugin(tts.TTS):
        """LiveKit TTS plugin wrapper for Eden AI"""
        
        def __init__(self, api_key: str, provider: str, voice: Optional[str]):
            # Initialize LiveKit TTS base class with required capabilities
            super().__init__(
                capabilities=tts.TTSCapabilities(streaming=False),
                sample_rate=24000,
                num_channels=1
            )
            self.api_key = api_key
            self.edenai_provider = provider  # Use different name to avoid conflict with base class
            self.voice = voice
            self.base_url = 'https://api.edenai.run/v2'
        
        @asynccontextmanager
        async def synthesize(self, text: str, *, language: str = "en-US", **kwargs) -> AsyncIterator:
            """Synthesize speech from text - async context manager that yields an async iterator"""
            # Note: LiveKit may pass conn_options and other kwargs, we accept them with **kwargs
            logger.error(f"🚨🚨🚨 SYNTHESIZE CALLED! text='{text[:50]}...', provider={self.edenai_provider}, voice={self.voice}")
            
            async def _generate_audio():
                """Inner async generator for audio chunks"""
                import httpx
                import json
                from livekit.agents import tts as lk_tts
                from livekit import rtc
                
                logger.error(f"🚨 _generate_audio STARTED! provider={self.edenai_provider}")
                try:
                    data = {
                        'providers': self.edenai_provider,
                        'text': text,
                        'language': language,
                        'option': 'MALE',  # Required by EdenAI: MALE or FEMALE
                        # Note: ElevenLabs only supports mp3, not wav
                        # Other providers may support 'audio_format': 'wav'
                    }
                    
                    if self.voice:
                        # Different providers use different parameter names
                        if self.edenai_provider == 'elevenlabs':
                            provider_settings = {
                                'voice_id': self.voice,
                            }
                        elif self.edenai_provider == 'openai':
                            provider_settings = {'voice': self.voice}
                        elif self.edenai_provider == 'google':
                            provider_settings = {'voice_name': self.voice}
                        else:
                            # Default for amazon, microsoft, deepgram, lovoai
                            provider_settings = {'voice': self.voice}
                        
                        # Pass dict object (not JSON string) since we use json=data
                        data[f'{self.edenai_provider}_settings'] = provider_settings
                    
                    logger.error(f"🚨 ABOUT TO CALL EDENAI API! provider={self.edenai_provider}, voice={self.voice}, text_len={len(text)}")
                    logger.error(f"🚨 REQUEST DATA: {json.dumps(data, indent=2)}")
                    
                    headers = {
                        'Authorization': f'Bearer {self.api_key}',
                        'Content-Type': 'application/json'
                    }
                    
                    logger.error(f"🚨 Creating httpx client...")
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        logger.error(f"🚨 Posting to EdenAI...")
                        response = await client.post(
                            f'{self.base_url}/audio/text_to_speech',
                            headers=headers,
                            json=data
                        )
                        logger.error(f"🚨 EdenAI Response: status={response.status_code}, body={response.text[:500]}")
                        response.raise_for_status()
                        result = response.json()
                        logger.error(f"🚨 EdenAI response received! status={response.status_code}")
                        
                        provider_result = result.get(self.edenai_provider, {})
                        logger.error(f"🚨 Provider result: {provider_result.get('status')}")
                        if provider_result.get('status') == 'success':
                            audio_url = provider_result.get('audio_resource_url')
                            if audio_url:
                                # Download the complete audio file
                                audio_response = await client.get(audio_url)
                                audio_response.raise_for_status()
                                audio_data = audio_response.content
                            else:
                                # Some providers return base64 audio
                                audio_base64 = provider_result.get('audio')
                                if audio_base64:
                                    import base64
                                    audio_data = base64.b64decode(audio_base64)
                                else:
                                    raise Exception("No audio data in Eden AI response")

                            # Smart format detection and conversion
                            import av
                            import io
                            import numpy as np
                            
                            logger.error(f"🚨 Received {len(audio_data)} bytes, detecting format...")
                            
                            # Detect audio format by magic bytes
                            if audio_data[:4] == b'RIFF':  # WAV format
                                logger.error("✅ WAV detected, extracting PCM from container...")
                                # WAV files have a 44-byte header, PCM data follows
                                pcm_bytes = audio_data[44:]
                            
                            elif audio_data[:3] == b'ID3' or audio_data[:2] == b'\xff\xfb':  # MP3 format
                                logger.error("🔄 MP3 detected, decoding with PyAV...")
                                container = av.open(io.BytesIO(audio_data))
                                audio_frames = []
                                actual_sample_rate = None
                                actual_channels = None
                                for frame in container.decode(audio=0):
                                    if actual_sample_rate is None:
                                        actual_sample_rate = frame.sample_rate
                                        actual_channels = len(frame.layout.channels)
                                        logger.error(f"📊 MP3 metadata: {actual_sample_rate}Hz, {actual_channels} channels")
                                    audio_frames.append(frame.to_ndarray())
                                
                                # Convert float32 [-1.0, 1.0] to int16 PCM [-32768, 32767]
                                pcm_data = np.concatenate(audio_frames).flatten()
                                
                                # Resample if needed (WebRTC supports: 8k, 16k, 24k, 48k - NOT 44.1k!)
                                target_rate = self._sample_rate  # 24000 Hz (our config)
                                if actual_sample_rate != target_rate:
                                    from scipy import signal
                                    logger.error(f"🔄 Resampling: {actual_sample_rate}Hz → {target_rate}Hz...")
                                    num_samples = int(len(pcm_data) * target_rate / actual_sample_rate)
                                    pcm_data = signal.resample(pcm_data, num_samples)
                                
                                pcm_bytes = (pcm_data * 32767).astype(np.int16).tobytes()
                                # Use our target sample rate (24000 Hz), not the source rate
                                self._num_channels = actual_channels or self._num_channels
                            
                            elif audio_data[:4] == b'fLaC':  # FLAC format
                                logger.error("🔄 FLAC detected, decoding with PyAV...")
                                container = av.open(io.BytesIO(audio_data))
                                audio_frames = []
                                actual_sample_rate = None
                                actual_channels = None
                                for frame in container.decode(audio=0):
                                    if actual_sample_rate is None:
                                        actual_sample_rate = frame.sample_rate
                                        actual_channels = len(frame.layout.channels)
                                        logger.error(f"📊 FLAC metadata: {actual_sample_rate}Hz, {actual_channels} channels")
                                    audio_frames.append(frame.to_ndarray())
                                
                                # Convert float32 [-1.0, 1.0] to int16 PCM [-32768, 32767]
                                pcm_data = np.concatenate(audio_frames).flatten()
                                
                                # Resample if needed (WebRTC supports: 8k, 16k, 24k, 48k - NOT 44.1k!)
                                target_rate = self._sample_rate  # 24000 Hz (our config)
                                if actual_sample_rate != target_rate:
                                    from scipy import signal
                                    logger.error(f"🔄 Resampling: {actual_sample_rate}Hz → {target_rate}Hz...")
                                    num_samples = int(len(pcm_data) * target_rate / actual_sample_rate)
                                    pcm_data = signal.resample(pcm_data, num_samples)
                                
                                pcm_bytes = (pcm_data * 32767).astype(np.int16).tobytes()
                                # Use our target sample rate (24000 Hz), not the source rate
                                self._num_channels = actual_channels or self._num_channels
                            
                            else:
                                logger.error("❓ Unknown format, trying PyAV fallback...")
                                try:
                                    container = av.open(io.BytesIO(audio_data))
                                    audio_frames = []
                                    actual_sample_rate = None
                                    actual_channels = None
                                    for frame in container.decode(audio=0):
                                        if actual_sample_rate is None:
                                            actual_sample_rate = frame.sample_rate
                                            actual_channels = len(frame.layout.channels)
                                            logger.error(f"📊 Unknown format metadata: {actual_sample_rate}Hz, {actual_channels} channels")
                                        audio_frames.append(frame.to_ndarray())
                                    
                                    # Convert float32 [-1.0, 1.0] to int16 PCM [-32768, 32767]
                                    pcm_data = np.concatenate(audio_frames).flatten()
                                    
                                    # Resample if needed (WebRTC supports: 8k, 16k, 24k, 48k - NOT 44.1k!)
                                    target_rate = self._sample_rate  # 24000 Hz (our config)
                                    if actual_sample_rate != target_rate:
                                        from scipy import signal
                                        logger.error(f"🔄 Resampling: {actual_sample_rate}Hz → {target_rate}Hz...")
                                        num_samples = int(len(pcm_data) * target_rate / actual_sample_rate)
                                        pcm_data = signal.resample(pcm_data, num_samples)
                                    
                                    pcm_bytes = (pcm_data * 32767).astype(np.int16).tobytes()
                                    # Use our target sample rate (24000 Hz), not the source rate
                                    self._num_channels = actual_channels or self._num_channels
                                except Exception as decode_error:
                                    logger.error(f"⚠️ PyAV decode failed: {decode_error}, treating as raw PCM...")
                                    pcm_bytes = audio_data
                            
                            logger.error(f"🚨 Creating AudioFrame: {len(pcm_bytes)} bytes PCM")
                            audio_frame = rtc.AudioFrame(
                                data=pcm_bytes,
                                sample_rate=self._sample_rate,
                                num_channels=self._num_channels,
                                samples_per_channel=len(pcm_bytes) // (2 * self._num_channels)  # 16-bit = 2 bytes
                            )
                            logger.error(f"🚨 Yielding SynthesizedAudio...")
                            yield lk_tts.SynthesizedAudio(
                                request_id="",
                                frame=audio_frame
                            )
                            logger.error(f"🚨 SynthesizedAudio yielded successfully!")
                        else:
                            error = provider_result.get('error', 'Unknown error')
                            logger.error(f"❌ Eden AI TTS error: {error}")
                            raise Exception(f"Eden AI TTS failed: {error}")
                            
                except Exception as e:
                    logger.error(f"❌ Eden AI TTS error in _generate_audio: {e}")
                    raise
            
            # Yield the async generator
            logger.error(f"🚨 About to yield _generate_audio() generator...")
            yield _generate_audio()
            logger.error(f"🚨 Generator yielded, context manager done!")
    
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

