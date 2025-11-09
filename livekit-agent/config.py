"""Configuration loader for LiveKit agent"""
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

class Config:
    # LiveKit
    LIVEKIT_URL: str = os.getenv("LIVEKIT_URL", "")
    LIVEKIT_API_KEY: str = os.getenv("LIVEKIT_API_KEY", "")
    LIVEKIT_API_SECRET: str = os.getenv("LIVEKIT_API_SECRET", "")
    LIVEKIT_SIP_DOMAIN: str = os.getenv("LIVEKIT_SIP_DOMAIN", "")
    LIVEKIT_SIP_USERNAME: str = os.getenv("LIVEKIT_SIP_USERNAME", "")
    LIVEKIT_SIP_PASSWORD: str = os.getenv("LIVEKIT_SIP_PASSWORD", "")
    
    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    
    # STT Providers (Native LiveKit Plugins)
    DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ASSEMBLYAI_API_KEY: str = os.getenv("ASSEMBLYAI_API_KEY", "")
    
    # TTS Providers (Native LiveKit Plugins)
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    SPEECHIFY_API_KEY: str = os.getenv("SPEECHIFY_API_KEY", "")
    
    # LLM Providers
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    GOOGLE_AI_API_KEY: str = os.getenv("GOOGLE_AI_API_KEY", "")
    
    # Google Cloud (STT/TTS)
    GOOGLE_APPLICATION_CREDENTIALS_JSON: Optional[str] = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    GOOGLE_PROJECT_ID: str = os.getenv("GOOGLE_PROJECT_ID", "barbara-475319")
    
    # Business Logic
    NYLAS_API_KEY: str = os.getenv("NYLAS_API_KEY", "")
    
    # SignalWire (for outbound calls)
    SIGNALWIRE_PROJECT_ID: str = os.getenv("SIGNALWIRE_PROJECT_ID", "")
    SIGNALWIRE_TOKEN: str = os.getenv("SIGNALWIRE_TOKEN", "")
    SIGNALWIRE_SPACE: str = os.getenv("SIGNALWIRE_SPACE", "")
    
    # API Server
    API_SERVER_PORT: int = int(os.getenv("API_SERVER_PORT", "8080"))
    API_SERVER_HOST: str = os.getenv("API_SERVER_HOST", "0.0.0.0")
    BRIDGE_API_KEY: str = os.getenv("BRIDGE_API_KEY", "")  # For authentication
    
    # Fallbacks
    DEFAULT_FALLBACK_STT_PROVIDER: str = os.getenv("DEFAULT_FALLBACK_STT_PROVIDER", "openai")
    DEFAULT_FALLBACK_TTS_PROVIDER: str = os.getenv("DEFAULT_FALLBACK_TTS_PROVIDER", "openai")
    DEFAULT_FALLBACK_LLM_PROVIDER: str = os.getenv("DEFAULT_FALLBACK_LLM_PROVIDER", "openai")
    
    # Recording (Egress)
    AWS_BUCKET_NAME: str = os.getenv("AWS_BUCKET_NAME", "")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    # S3-compatible options (for MinIO/R2/Spaces)
    S3_ENDPOINT: Optional[str] = os.getenv("S3_ENDPOINT")
    S3_FORCE_PATH_STYLE: bool = os.getenv("S3_FORCE_PATH_STYLE", "false").lower() == "true"

    # Supabase Storage (recordings)
    SUPABASE_RECORDINGS_BUCKET: str = os.getenv("SUPABASE_RECORDINGS_BUCKET", "call-recordings")
    
    # Pricing override (optional JSON)
    PRICING_JSON: Optional[str] = os.getenv("PRICING_JSON")
    
    @classmethod
    def validate(cls) -> bool:
        """Validate required configuration"""
        required = [
            cls.LIVEKIT_URL,
            cls.LIVEKIT_API_KEY,
            cls.LIVEKIT_API_SECRET,
            cls.SUPABASE_URL,
            cls.SUPABASE_SERVICE_KEY,
        ]
        return all(required)

