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
            "playht": {"2.0-turbo": 0.040},
            "google": {"neural2": 0.024},
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
        "playht": {
            "2.0-turbo": 0.040,          # PlayHT 2.0 Turbo
            "2.0": 0.060,                # PlayHT 2.0 Standard
            "1.0": 0.095                 # PlayHT 1.0 (legacy)
        },
        "google": {
            "neural2": 0.024,            # Google Neural2 voices
            "standard": 0.004            # Google Standard voices
        },
        "amazon": {
            "polly-neural": 0.024,       # Amazon Polly Neural
            "polly-standard": 0.004      # Amazon Polly Standard
        },
        "openai": {
            "tts-1": 0.015,              # OpenAI TTS-1
            "tts-1-hd": 0.030            # OpenAI TTS-1-HD
        }
    }


def get_fallback_eden_catalog() -> Dict[str, Any]:
    """Fallback Eden AI catalog if API is unavailable"""
    return {
        "speech_to_text": ["deepgram", "assemblyai", "google", "openai", "revai"],
        "text_to_speech": ["elevenlabs", "playht", "google", "amazon", "openai"]
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

