"""
Provider Catalog Service
Polls Eden AI and OpenRouter APIs to get live pricing and available models
Caches results for 24 hours to avoid rate limits
"""

import logging
import httpx
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from config import Config

logger = logging.getLogger(__name__)

# In-memory cache (persists for lifetime of worker process)
CATALOG_CACHE = {
    "eden_ai_providers": None,
    "eden_ai_timestamp": None,
    "openrouter_models": None,
    "openrouter_timestamp": None,
    "elevenlabs_voices": None,
    "elevenlabs_timestamp": None
}

CACHE_DURATION = timedelta(hours=24)


async def get_eden_ai_stt_pricing(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Get STT pricing from Eden AI for all providers
    Cached for 24 hours
    
    Returns:
        {
            "deepgram": {"nova-2": 0.0043, "base": 0.0036},
            "assemblyai": {"best": 0.00037},
            "google": {"latest": 0.006},
            ...
        }
    """
    cache_key = "eden_ai_stt_pricing"
    timestamp_key = "eden_ai_stt_timestamp"
    
    # Check cache
    if not force_refresh and CATALOG_CACHE.get(cache_key) and CATALOG_CACHE.get(timestamp_key):
        if datetime.now() - CATALOG_CACHE[timestamp_key] < CACHE_DURATION:
            logger.debug("✅ Using cached Eden AI STT pricing")
            return CATALOG_CACHE[cache_key]
    
    # Fetch fresh data
    if not Config.EDENAI_API_KEY:
        logger.warning("⚠️ EDENAI_API_KEY not set, using fallback STT pricing")
        return get_fallback_stt_pricing()
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Eden AI pricing endpoint (if available)
            # For now, use info endpoint to get provider list
            response = await client.get(
                "https://api.edenai.run/v2/info/providers",
                headers={"Authorization": f"Bearer {Config.EDENAI_API_KEY}"}
            )
            
            if response.status_code == 200:
                # Parse pricing from response or use fallback
                # Eden AI doesn't expose pricing via API, so we maintain curated list
                pricing = get_fallback_stt_pricing()
                CATALOG_CACHE[cache_key] = pricing
                CATALOG_CACHE[timestamp_key] = datetime.now()
                logger.info("✅ Refreshed Eden AI STT pricing")
                return pricing
            else:
                logger.error(f"❌ Eden AI API error: {response.status_code}")
                return get_fallback_stt_pricing()
    
    except Exception as e:
        logger.error(f"❌ Failed to fetch Eden AI STT pricing: {e}")
        return get_fallback_stt_pricing()


async def get_eden_ai_tts_pricing(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Get TTS pricing from Eden AI for all providers
    Cached for 24 hours
    
    Returns:
        {
            "elevenlabs": {"multilingual-v2": 0.180, "turbo-v2.5": 0.090},
            "openai": {"tts-1": 0.0023, "tts-1-hd": 0.0045},
            "deepgram": {"aura": 0.0023},
            "google": {"neural": 0.024, "standard": 0.006},
            ...
        }
    """
    cache_key = "eden_ai_tts_pricing"
    timestamp_key = "eden_ai_tts_timestamp"
    
    # Check cache
    if not force_refresh and CATALOG_CACHE.get(cache_key) and CATALOG_CACHE.get(timestamp_key):
        if datetime.now() - CATALOG_CACHE[timestamp_key] < CACHE_DURATION:
            logger.debug("✅ Using cached Eden AI TTS pricing")
            return CATALOG_CACHE[cache_key]
    
    # Fetch fresh data
    if not Config.EDENAI_API_KEY:
        logger.warning("⚠️ EDENAI_API_KEY not set, using fallback TTS pricing")
        return get_fallback_tts_pricing()
    
    try:
        # Eden AI doesn't expose pricing via API
        # We maintain a curated list based on official provider pricing
        pricing = get_fallback_tts_pricing()
        CATALOG_CACHE[cache_key] = pricing
        CATALOG_CACHE[timestamp_key] = datetime.now()
        logger.info("✅ Refreshed Eden AI TTS pricing")
        return pricing
    
    except Exception as e:
        logger.error(f"❌ Failed to fetch Eden AI TTS pricing: {e}")
        return get_fallback_tts_pricing()


async def get_eden_ai_providers(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Get available providers from Eden AI
    Cached for 24 hours
    """
    cache_key = "eden_ai_providers"
    timestamp_key = "eden_ai_timestamp"
    
    # Check cache
    if not force_refresh and CATALOG_CACHE.get(cache_key) and CATALOG_CACHE.get(timestamp_key):
        if datetime.now() - CATALOG_CACHE[timestamp_key] < CACHE_DURATION:
            logger.debug("✅ Using cached Eden AI providers")
            return CATALOG_CACHE[cache_key]
    
    # Fetch fresh data
    if not Config.EDENAI_API_KEY:
        logger.warning("⚠️ EDENAI_API_KEY not set, using fallback catalog")
        return get_fallback_eden_catalog()
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.edenai.run/v2/info/providers",
                headers={"Authorization": f"Bearer {Config.EDENAI_API_KEY}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                CATALOG_CACHE[cache_key] = data
                CATALOG_CACHE[timestamp_key] = datetime.now()
                logger.info("✅ Refreshed Eden AI provider catalog")
                return data
            else:
                logger.error(f"❌ Eden AI API error: {response.status_code}")
                return get_fallback_eden_catalog()
    
    except Exception as e:
        logger.error(f"❌ Failed to fetch Eden AI providers: {e}")
        return get_fallback_eden_catalog()


async def get_openrouter_models(force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Get available models from OpenRouter with live pricing
    Cached for 24 hours
    
    Returns list of models with pricing, context window, and capabilities
    """
    cache_key = "openrouter_models"
    timestamp_key = "openrouter_timestamp"
    
    # Check cache
    if not force_refresh and CATALOG_CACHE[cache_key] and CATALOG_CACHE[timestamp_key]:
        if datetime.now() - CATALOG_CACHE[timestamp_key] < CACHE_DURATION:
            logger.debug("✅ Using cached OpenRouter models")
            return CATALOG_CACHE[cache_key]
    
    # Fetch fresh data
    if not Config.OPENROUTER_API_KEY:
        logger.warning("⚠️ OPENROUTER_API_KEY not set, using fallback catalog")
        return get_fallback_openrouter_catalog()
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {Config.OPENROUTER_API_KEY}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                models = data.get("data", [])
                
                # Filter and format models
                formatted_models = []
                for model in models:
                    formatted_models.append({
                        "id": model.get("id"),
                        "name": model.get("name"),
                        "description": model.get("description"),
                        "context_length": model.get("context_length"),
                        "pricing": {
                            "prompt": float(model.get("pricing", {}).get("prompt", 0)),
                            "completion": float(model.get("pricing", {}).get("completion", 0))
                        },
                        "top_provider": model.get("top_provider", {}).get("name"),
                        "architecture": model.get("architecture", {})
                    })
                
                CATALOG_CACHE[cache_key] = formatted_models
                CATALOG_CACHE[timestamp_key] = datetime.now()
                logger.info(f"✅ Refreshed OpenRouter catalog ({len(formatted_models)} models)")
                return formatted_models
            else:
                logger.error(f"❌ OpenRouter API error: {response.status_code}")
                return get_fallback_openrouter_catalog()
    
    except Exception as e:
        logger.error(f"❌ Failed to fetch OpenRouter models: {e}")
        return get_fallback_openrouter_catalog()


async def get_elevenlabs_voices(force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Get available voices from ElevenLabs (via Eden AI)
    Cached for 24 hours
    """
    cache_key = "elevenlabs_voices"
    timestamp_key = "elevenlabs_timestamp"
    
    # Check cache
    if not force_refresh and CATALOG_CACHE[cache_key] and CATALOG_CACHE[timestamp_key]:
        if datetime.now() - CATALOG_CACHE[timestamp_key] < CACHE_DURATION:
            logger.debug("✅ Using cached ElevenLabs voices")
            return CATALOG_CACHE[cache_key]
    
    # For now, return static list
    # TODO: Add Eden AI voice listing endpoint when available
    voices = get_fallback_elevenlabs_voices()
    CATALOG_CACHE[cache_key] = voices
    CATALOG_CACHE[timestamp_key] = datetime.now()
    
    return voices


def get_fallback_stt_pricing() -> Dict[str, Any]:
    """
    Fallback STT pricing from official provider documentation
    Updated: January 2025
    """
    return {
        "deepgram": {
            "nova-2": 0.0043,      # Deepgram Nova 2 - best accuracy
            "base": 0.0036,        # Deepgram Base - good quality
            "whisper": 0.0048      # Deepgram Whisper cloud
        },
        "assemblyai": {
            "best": 0.00037,       # AssemblyAI Best - $0.37 per hour
            "nano": 0.00012        # AssemblyAI Nano - ultra cheap
        },
        "google": {
            "latest": 0.006,       # Google Speech Latest
            "chirp": 0.008         # Google Chirp (multilingual)
        },
        "openai": {
            "whisper-1": 0.006     # Whisper via OpenAI API
        },
        "revai": {
            "human-parity": 0.02   # Rev.ai Human Parity
        }
    }


def get_fallback_tts_pricing() -> Dict[str, Any]:
    """
    Fallback TTS pricing from official provider documentation
    Updated: January 2025
    Pricing per minute of generated audio (~150 words)
    """
    return {
        "elevenlabs": {
            "multilingual-v2": 0.180,    # ElevenLabs Multilingual V2 - best quality
            "turbo-v2.5": 0.090,         # ElevenLabs Turbo V2.5 - fast & good
            "turbo-v2": 0.090            # ElevenLabs Turbo V2
        },
        "openai": {
            "tts-1": 0.0023,             # OpenAI TTS-1 - $0.015/1K chars (~150 chars/min = $0.00225)
            "tts-1-hd": 0.0045           # OpenAI TTS-1-HD - $0.030/1K chars
        },
        "deepgram": {
            "aura": 0.0023               # Deepgram Aura - $0.015/1K chars (same as OpenAI)
        },
        "google": {
            "neural": 0.024,             # Google Neural voices - $16/1M chars
            "wavenet": 0.024,            # Google Wavenet - $16/1M chars
            "standard": 0.006,           # Google Standard - $4/1M chars
            "studio": 0.024              # Google Studio - $0.16/1K chars
        },
        "amazon": {
            "neural": 0.024,             # Amazon Polly Neural - $16/1M chars
            "standard": 0.006            # Amazon Polly Standard - $4/1M chars
        },
        "microsoft": {
            "neural": 0.024              # Microsoft Azure Neural - $16/1M chars
        },
        "lovoai": {
            "standard": 0.240            # Lovoai - $160/1M chars (expensive!)
        }
    }


def get_fallback_eden_catalog() -> Dict[str, Any]:
    """Fallback Eden AI catalog if API is unavailable"""
    return {
        "speech_to_text": ["deepgram", "assemblyai", "google", "openai", "revai"],
        "text_to_speech": ["elevenlabs", "openai", "deepgram", "google", "amazon", "microsoft", "lovoai"]
    }


def get_fallback_openrouter_catalog() -> List[Dict[str, Any]]:
    """Fallback OpenRouter catalog if API is unavailable"""
    return [
        {"id": "openai/gpt-4o", "name": "GPT-4 Omni", "pricing": {"prompt": 0.0000025, "completion": 0.00001}},
        {"id": "openai/gpt-4o-mini", "name": "GPT-4 Omni Mini", "pricing": {"prompt": 0.00000015, "completion": 0.0000006}},
        {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet", "pricing": {"prompt": 0.000003, "completion": 0.000015}},
        {"id": "anthropic/claude-3-haiku", "name": "Claude 3 Haiku", "pricing": {"prompt": 0.00000025, "completion": 0.00000125}},
        {"id": "meta-llama/llama-3.1-70b-instruct", "name": "Llama 3.1 70B", "pricing": {"prompt": 0.00000088, "completion": 0.00000088}},
        {"id": "google/gemini-pro-1.5", "name": "Gemini 1.5 Pro", "pricing": {"prompt": 0.0000035, "completion": 0.0000105}},
    ]


def get_fallback_elevenlabs_voices() -> List[Dict[str, Any]]:
    """Fallback ElevenLabs voice catalog"""
    return [
        {"id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel", "gender": "female", "accent": "American"},
        {"id": "AZnzlk1XvdvUeBnXmlld", "name": "Domi", "gender": "female", "accent": "American"},
        {"id": "EXAVITQu4vr4xnSDxMaL", "name": "Bella", "gender": "female", "accent": "American"},
        {"id": "ErXwobaYiN019PkySvjV", "name": "Antoni", "gender": "male", "accent": "American"},
        {"id": "pNInz6obpgDQGcFmaJgB", "name": "Adam", "gender": "male", "accent": "American"},
        {"id": "yoZ06aMxZJJ28mfd3POQ", "name": "Sam", "gender": "male", "accent": "American"},
    ]


async def get_eden_ai_tts_voices(provider: str, model: str, force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Get available TTS voices from Eden AI provider info API
    
    Args:
        provider: Underlying provider (e.g., 'elevenlabs', 'openai', 'google', 'deepgram')
        model: Model name (e.g., 'elevenlabs-multilingual-v2')
        force_refresh: Force cache refresh
    
    Returns:
        List of voice objects with voice_id, display_name, gender, accent, etc.
    """
    cache_key = f"eden_ai_voices_{provider}_{model}"
    timestamp_key = f"{cache_key}_timestamp"
    
    # Check cache
    if not force_refresh and CATALOG_CACHE.get(cache_key) and CATALOG_CACHE.get(timestamp_key):
        if datetime.now() - CATALOG_CACHE[timestamp_key] < CACHE_DURATION:
            logger.debug(f"✅ Using cached Eden AI voices for {provider}/{model}")
            return CATALOG_CACHE[cache_key]
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Use the provider_subfeatures API to get voice models
            response = await client.get(
                f"https://api.edenai.run/v2/info/provider_subfeatures?feature__name=audio&subfeature__name=text_to_speech&provider__name={provider}",
                headers={
                    "Authorization": f"Bearer {Config.EDENAI_API_KEY}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Extract voices from the response
                voices = []
                if data and len(data) > 0:
                    provider_info = data[0]  # First result should be our provider
                    
                    # Get voices from models field
                    models = provider_info.get("models", [])
                    for voice_model in models:
                        voices.append({
                            "voice_id": voice_model.get("value") or voice_model.get("name"),
                            "display_name": voice_model.get("display_name") or voice_model.get("name"),
                            "name": voice_model.get("name"),
                            "gender": voice_model.get("gender", "unknown"),
                            "accent": voice_model.get("accent") or voice_model.get("language", "en-US"),
                            "age": voice_model.get("age"),
                            "language": voice_model.get("language")
                        })
                
                # Cache and return
                CATALOG_CACHE[cache_key] = voices
                CATALOG_CACHE[timestamp_key] = datetime.now()
                
                logger.info(f"✅ Loaded {len(voices)} voices from Eden AI API for {provider}/{model}")
                return voices
            else:
                logger.error(f"❌ Eden AI provider info API error: {response.status_code}")
                # Fall back to hardcoded
                return get_fallback_voices(provider)
                
    except Exception as e:
        logger.error(f"❌ Error fetching Eden AI voices: {e}")
        # Fall back to hardcoded
        return get_fallback_voices(provider)


def get_fallback_voices(provider: str) -> List[Dict[str, Any]]:
    """Fallback hardcoded voices if API fails"""
    voices_db = {
        "elevenlabs": [
            # Custom Voices
            {"voice_id": "6aDn1KB0hjpdcocrUkmq", "display_name": "Tiffany (Custom)", "name": "Tiffany", "gender": "female", "accent": "American", "age": "young"},
            {"voice_id": "P7x743VjyZEOihNNygQ9", "display_name": "Dakota (Premium)", "name": "Dakota", "gender": "female", "accent": "American", "age": "young"},
            {"voice_id": "DLsHlh26Ugcm6ELvS0qi", "display_name": "Ms. Walker (Custom)", "name": "Ms. Walker", "gender": "female", "accent": "American", "age": "middle"},
            {"voice_id": "DTKMou8ccj1ZaWGBiotd", "display_name": "Jamahal (Custom)", "name": "Jamahal", "gender": "male", "accent": "American", "age": "young"},
            {"voice_id": "9T9vSqRrPPxIs5wpyZfK", "display_name": "Eric B (Custom)", "name": "Eric B", "gender": "male", "accent": "American", "age": "middle"},
            {"voice_id": "UgBBYS2sOqTuMpoF3BR0", "display_name": "Mark (Custom)", "name": "Mark", "gender": "male", "accent": "American", "age": "middle"},
            # Standard ElevenLabs Voices
            {"voice_id": "21m00Tcm4TlvDq8ikWAM", "display_name": "Rachel", "name": "Rachel", "gender": "female", "accent": "American", "age": "young"},
            {"voice_id": "AZnzlk1XvdvUeBnXmlld", "display_name": "Domi", "name": "Domi", "gender": "female", "accent": "American", "age": "young"},
            {"voice_id": "EXAVITQu4vr4xnSDxMaL", "display_name": "Bella", "name": "Bella", "gender": "female", "accent": "American", "age": "middle"},
            {"voice_id": "ErXwobaYiN019PkySvjV", "display_name": "Antoni", "name": "Antoni", "gender": "male", "accent": "American", "age": "young"},
            {"voice_id": "MF3mGyEYCl7XYWbV9V6O", "display_name": "Elli", "name": "Elli", "gender": "female", "accent": "American", "age": "young"},
            {"voice_id": "TxGEqnHWrfWFTfGW9XjX", "display_name": "Josh", "name": "Josh", "gender": "male", "accent": "American", "age": "young"},
            {"voice_id": "VR6AewLTigWG4xSOukaG", "display_name": "Arnold", "name": "Arnold", "gender": "male", "accent": "American", "age": "middle"},
            {"voice_id": "pNInz6obpgDQGcFmaJgB", "display_name": "Adam", "name": "Adam", "gender": "male", "accent": "American", "age": "middle"},
            {"voice_id": "yoZ06aMxZJJ28mfd3POQ", "display_name": "Sam", "name": "Sam", "gender": "male", "accent": "American", "age": "young"},
        ],
        "openai": [
            {"voice_id": "alloy", "display_name": "Alloy", "name": "Alloy", "gender": "neutral", "accent": "Neutral"},
            {"voice_id": "echo", "display_name": "Echo", "name": "Echo", "gender": "male", "accent": "American"},
            {"voice_id": "fable", "display_name": "Fable", "name": "Fable", "gender": "neutral", "accent": "British"},
            {"voice_id": "onyx", "display_name": "Onyx", "name": "Onyx", "gender": "male", "accent": "American"},
            {"voice_id": "nova", "display_name": "Nova", "name": "Nova", "gender": "female", "accent": "American"},
            {"voice_id": "shimmer", "display_name": "Shimmer", "name": "Shimmer", "gender": "female", "accent": "American"},
        ],
        "deepgram": [
            {"voice_id": "aura-asteria-en", "display_name": "Asteria", "name": "Asteria", "gender": "female", "accent": "American"},
            {"voice_id": "aura-luna-en", "display_name": "Luna", "name": "Luna", "gender": "female", "accent": "American"},
            {"voice_id": "aura-stella-en", "display_name": "Stella", "name": "Stella", "gender": "female", "accent": "American"},
            {"voice_id": "aura-athena-en", "display_name": "Athena", "name": "Athena", "gender": "female", "accent": "British"},
            {"voice_id": "aura-hera-en", "display_name": "Hera", "name": "Hera", "gender": "female", "accent": "American"},
            {"voice_id": "aura-orion-en", "display_name": "Orion", "name": "Orion", "gender": "male", "accent": "American"},
            {"voice_id": "aura-arcas-en", "display_name": "Arcas", "name": "Arcas", "gender": "male", "accent": "American"},
            {"voice_id": "aura-perseus-en", "display_name": "Perseus", "name": "Perseus", "gender": "male", "accent": "American"},
            {"voice_id": "aura-angus-en", "display_name": "Angus", "name": "Angus", "gender": "male", "accent": "Irish"},
            {"voice_id": "aura-orpheus-en", "display_name": "Orpheus", "name": "Orpheus", "gender": "male", "accent": "American"},
            {"voice_id": "aura-helios-en", "display_name": "Helios", "name": "Helios", "gender": "male", "accent": "British"},
            {"voice_id": "aura-zeus-en", "display_name": "Zeus", "name": "Zeus", "gender": "male", "accent": "American"},
        ],
        "google": [
            {"voice_id": "en-US-Neural2-A", "display_name": "US Neural2 A (Male)", "name": "Neural2-A", "gender": "male", "accent": "American"},
            {"voice_id": "en-US-Neural2-C", "display_name": "US Neural2 C (Female)", "name": "Neural2-C", "gender": "female", "accent": "American"},
            {"voice_id": "en-US-Neural2-F", "display_name": "US Neural2 F (Female)", "name": "Neural2-F", "gender": "female", "accent": "American"},
            {"voice_id": "en-US-Neural2-J", "display_name": "US Neural2 J (Male)", "name": "Neural2-J", "gender": "male", "accent": "American"},
        ],
    }
    voices = voices_db.get(provider, [])
    logger.info(f"⚠️ Using fallback voices: {len(voices)} for {provider}")
    return voices


async def refresh_all_catalogs():
    """
    Refresh all provider catalogs
    Call this on worker startup or via admin endpoint
    """
    logger.info("🔄 Refreshing all provider catalogs...")
    
    await get_eden_ai_providers(force_refresh=True)
    await get_openrouter_models(force_refresh=True)
    await get_elevenlabs_voices(force_refresh=True)
    
    logger.info("✅ All catalogs refreshed")


def calculate_openrouter_cost_per_minute(model_id: str, tokens_per_minute: int = 200) -> float:
    """
    Calculate OpenRouter cost per minute for a specific model
    
    Args:
        model_id: Model ID (e.g., 'openai/gpt-4o')
        tokens_per_minute: Estimated tokens per minute (default 200 for voice)
    
    Returns:
        Cost in USD per minute
    """
    models = CATALOG_CACHE.get("openrouter_models", [])
    
    for model in models:
        if model["id"] == model_id:
            # Average of prompt + completion pricing
            prompt_price = model["pricing"]["prompt"]
            completion_price = model["pricing"]["completion"]
            avg_price_per_token = (prompt_price + completion_price) / 2
            
            return avg_price_per_token * tokens_per_minute
    
    # Fallback pricing
    return 0.0002 * tokens_per_minute


def clear_cache():
    """Clear all cached provider data (useful for testing)"""
    global CATALOG_CACHE
    CATALOG_CACHE = {
        "eden_ai_providers": None,
        "eden_ai_timestamp": None,
        "openrouter_models": None,
        "openrouter_timestamp": None,
        "elevenlabs_voices": None,
        "elevenlabs_timestamp": None
    }
    logger.info("🧹 Cleared provider catalog cache")

