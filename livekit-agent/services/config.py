"""Configuration and pricing service"""
from typing import Dict, Any, Optional
import json
import os
from config import Config

# Default pricing map (per minute or per token)
# STT: per minute of audio
# TTS: per minute of audio (or per character)
# LLM: per 1K tokens (input/output may differ)
DEFAULT_PRICING = {
    # STT Providers
    'deepgram': {
        'nova-2': 0.0043,  # per minute
        'whisper': 0.0043,
        'nova': 0.0043,
    },
    'openai': {
        'whisper': 0.006,  # per minute
    },
    'assemblyai': {
        'default': 0.00025,  # per second = $0.015/min
    },
    'google_stt': {
        'default': 0.006,  # per minute (standard model)
    },
    
    # TTS Providers
    'elevenlabs': {
        'default': 0.08,  # per minute
        'shimmer': 0.08,
        'alloy': 0.08,
    },
    'openai_tts': {
        'default': 0.015,  # per minute
        'alloy': 0.015,
        'echo': 0.015,
        'shimmer': 0.015,
        'ash': 0.015,
        'ballad': 0.015,
        'coral': 0.015,
        'sage': 0.015,
        'verse': 0.015,
        'cedar': 0.015,
        'marin': 0.015,
    },
    'playht': {
        'default': 0.05,  # per minute
    },
    'deepgram_aura': {
        'default': 0.06,  # per minute
    },
    'google_tts': {
        'default': 0.016,  # per minute (standard voice)
    },
    
    # LLM Providers
    'openai_llm': {
        'gpt-5': 0.01,  # per 1K tokens (input+output avg)
        'gpt-5-mini': 0.002,
        'gpt-4o': 0.005,
        'gpt-4o-mini': 0.00015,
    },
    'openai_realtime': {
        'default': 0.06,  # per minute (bundled STT+LLM)
    },
           'openrouter': {
               # OpenRouter pricing (via official plugin)
               'anthropic/claude-sonnet-4.5': 0.003,
               'anthropic/claude-3-5-sonnet-20241022': 0.003,
               'anthropic/claude-3-opus-20240229': 0.015,
               'openai/gpt-5': 0.01,
               'openai/gpt-5-mini': 0.002,
               'openai/gpt-4o': 0.005,
               'google/gemini-2.0-flash-exp': 0.000075,
               'google/gemini-pro': 0.0005,
               'meta/llama-3-70b': 0.0007,
           },
    'anthropic': {
        'claude-3-5-sonnet-20241022': 0.003,
        'claude-3-opus-20240229': 0.015,
    },
    'google_gemini': {
        'gemini-2.0-flash-exp': 0.000075,
        'gemini-pro': 0.0005,
    },
}

def load_pricing_map() -> Dict[str, Any]:
    """Load pricing map from env or use defaults"""
    if Config.PRICING_JSON:
        try:
            return json.loads(Config.PRICING_JSON)
        except json.JSONDecodeError:
            pass
    return DEFAULT_PRICING

def _normalize_provider_name(provider: str) -> str:
    """Normalize provider names to match pricing map keys"""
    provider_lower = provider.lower()
    
    # Map common variations to pricing keys
    provider_map = {
        'deepgram': 'deepgram',
        'openai': 'openai',
        'assemblyai': 'assemblyai',
        'google': 'google_stt',  # Default to STT for Google
        'google_stt': 'google_stt',
        'elevenlabs': 'elevenlabs',
        'openai_tts': 'openai_tts',
        'playht': 'playht',
        'play.ht': 'playht',
        'deepgram_aura': 'deepgram_aura',
        'google_tts': 'google_tts',
        'openai_llm': 'openai_llm',
        'openai_realtime': 'openai_realtime',
               'openrouter': 'openrouter',
        'anthropic': 'anthropic',
        'google_gemini': 'google_gemini',
    }
    
    return provider_map.get(provider_lower, provider_lower)

def compute_cost(
    stt_minutes: float,
    tts_chars: int,
    llm_tokens: Optional[int],
    llm_provider: str,
    stt_provider: str,
    tts_provider: str,
    llm_model: str,
    stt_model: Optional[str] = None,
    tts_voice: Optional[str] = None,
    is_realtime: bool = False,
    config: Optional[Dict[str, Any]] = None
) -> float:
    """
    Compute estimated cost for a call
    
    Args:
        stt_minutes: STT usage in minutes
        tts_chars: TTS characters synthesized
        llm_tokens: LLM tokens used (None for Realtime)
        llm_provider: LLM provider name
        stt_provider: STT provider name
        tts_provider: TTS provider name
        llm_model: LLM model name
        stt_model: STT model name (optional, for model-specific pricing)
        tts_voice: TTS voice name (optional, for voice-specific pricing)
        is_realtime: Whether using OpenAI Realtime (bundled pricing)
    
    Returns:
        Estimated cost in USD
    """
    pricing = load_pricing_map()
    total_cost = 0.0
    
    # Normalize provider names
    stt_provider_norm = _normalize_provider_name(stt_provider)
    tts_provider_norm = _normalize_provider_name(tts_provider)
    llm_provider_norm = _normalize_provider_name(llm_provider)

    # If using Eden AI for STT/TTS, price by the underlying provider
    if stt_provider_norm == 'edenai' and config:
        underlying_stt = config.get('stt_edenai_provider', 'deepgram')
        stt_provider_norm = _normalize_provider_name(underlying_stt)
    if tts_provider_norm == 'edenai' and config:
        underlying_tts = config.get('tts_edenai_provider', 'elevenlabs')
        tts_provider_norm = _normalize_provider_name(underlying_tts)
    
    # OpenAI Realtime has bundled pricing (STT + LLM)
    if is_realtime and llm_provider_norm == 'openai_realtime':
        realtime_pricing = pricing.get('openai_realtime', {}).get('default', 0.06)
        total_cost += stt_minutes * realtime_pricing
        return round(total_cost, 4)
    
    # STT cost
    stt_pricing = pricing.get(stt_provider_norm, {})
    stt_rate = None
    if isinstance(stt_pricing, dict):
        # Try model-specific pricing first, then fallback to defaults
        if stt_model:
            stt_rate = stt_pricing.get(stt_model.lower())
        if not stt_rate:
            stt_rate = stt_pricing.get('nova-2') or stt_pricing.get('whisper') or stt_pricing.get('default', 0.005)
    else:
        stt_rate = stt_pricing if isinstance(stt_pricing, (int, float)) else 0.005
    
    # AssemblyAI uses per-second pricing
    if stt_provider_norm == 'assemblyai':
        stt_seconds = stt_minutes * 60
        stt_rate_per_sec = stt_pricing.get('default', 0.00025) if isinstance(stt_pricing, dict) else 0.00025
        total_cost += stt_seconds * stt_rate_per_sec
    else:
        total_cost += stt_minutes * stt_rate
    
    # TTS cost (approximate: ~150 words/min = ~750 chars/min)
    tts_minutes = tts_chars / 750.0 if tts_chars > 0 else 0
    tts_pricing = pricing.get(tts_provider_norm, {})
    tts_rate = None
    if isinstance(tts_pricing, dict):
        # Try voice-specific pricing first
        if tts_voice:
            tts_rate = tts_pricing.get(tts_voice.lower())
        if not tts_rate:
            tts_rate = tts_pricing.get('default', 0.08)
    else:
        tts_rate = tts_pricing if isinstance(tts_pricing, (int, float)) else 0.08
    
    total_cost += tts_minutes * tts_rate
    
    # LLM cost
    if llm_tokens and llm_tokens > 0:
        llm_pricing = pricing.get(llm_provider_norm, {})
        if isinstance(llm_pricing, dict):
            # For OpenRouter, model names include provider prefix (e.g., 'openai/gpt-5')
            # Try exact match first, then try without prefix
            llm_rate = llm_pricing.get(llm_model)
            if not llm_rate:
                # Try model name without provider prefix
                model_name_only = llm_model.split('/')[-1] if '/' in llm_model else llm_model
                llm_rate = llm_pricing.get(model_name_only)
            if not llm_rate:
                llm_rate = llm_pricing.get('default', 0.005)
        else:
            llm_rate = llm_pricing if isinstance(llm_pricing, (int, float)) else 0.005
        
        total_cost += (llm_tokens / 1000.0) * llm_rate
    
    return round(total_cost, 4)

