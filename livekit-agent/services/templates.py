"""
AI Template Loading Service
Loads AI configuration templates from Supabase with fallback logic
"""

import logging
from typing import Dict, Any, Optional
from services.supabase import get_supabase_client

logger = logging.getLogger(__name__)


async def get_template_for_phone(phone_number: str) -> Optional[Dict[str, Any]]:
    """
    Get AI template for a phone number with fallback chain:
    1. Phone's assigned template
    2. System default template (Budget Friendly)
    3. Emergency fallback (OpenAI Realtime)
    
    Args:
        phone_number: E.164 formatted phone number (e.g., +14155551234)
    
    Returns:
        Template configuration dict or None
    """
    try:
        supabase = get_supabase_client()
        
        # 1. Try phone's assigned template
        phone_result = supabase.table("signalwire_phone_numbers")\
            .select("assigned_ai_template_id")\
            .eq("phone_number", phone_number)\
            .single()\
            .execute()
        
        if phone_result.data and phone_result.data.get("assigned_ai_template_id"):
            template_id = phone_result.data["assigned_ai_template_id"]
            
            template_result = supabase.table("ai_templates")\
                .select("*")\
                .eq("id", template_id)\
                .single()\
                .execute()
            
            if template_result.data:
                logger.info(f"✅ Loaded template: {template_result.data['name']} for {phone_number}")
                return template_result.data
        
        # 2. Fallback to system default (Budget Friendly)
        logger.warning(f"⚠️ No template assigned to {phone_number}, using system default")
        default_result = supabase.table("ai_templates")\
            .select("*")\
            .eq("name", "Budget Friendly")\
            .eq("is_system_default", True)\
            .single()\
            .execute()
        
        if default_result.data:
            logger.info(f"✅ Using system default: {default_result.data['name']}")
            return default_result.data
        
        # 3. Emergency fallback - OpenAI Realtime
        logger.error(f"❌ No system default found! Using emergency fallback")
        realtime_result = supabase.table("ai_templates")\
            .select("*")\
            .eq("name", "OpenAI Realtime (Best Quality)")\
            .eq("is_system_default", True)\
            .single()\
            .execute()
        
        if realtime_result.data:
            return realtime_result.data
        
        # 4. Absolute emergency - return None and agent will use hardcoded defaults
        logger.critical("❌ No templates found in database!")
        return None
    
    except Exception as e:
        logger.error(f"❌ Error loading template: {e}")
        return None


def template_to_phone_config(template: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert AI template to phone_config format for backwards compatibility
    
    This allows the existing agent.py code to work with templates
    by mapping template fields to the expected phone_config structure
    """
    # Map template provider names to legacy phone_config names
    provider_mapping = {
        "eden_ai": "edenai",
        "openai_realtime": "openai_realtime",
        "openrouter": "openrouter"
    }
    
    config = {
        # STT Configuration
        "stt_provider": provider_mapping.get(template.get("stt_provider"), template.get("stt_provider")),
        "stt_model": template.get("stt_model"),
        "stt_language": template.get("stt_language", "en-US"),
        
        # For Eden AI, extract the underlying provider from the model name
        "stt_edenai_provider": extract_edenai_provider(template.get("stt_model"), "stt"),
        
        # TTS Configuration
        "tts_provider": provider_mapping.get(template.get("tts_provider"), template.get("tts_provider")),
        "tts_model": template.get("tts_model"),
        "tts_voice": template.get("tts_voice_id"),
        "tts_speed": template.get("tts_speed", 1.0),
        "tts_stability": template.get("tts_stability", 0.5),
        
        # For Eden AI, extract the underlying provider from the model name
        "tts_edenai_provider": extract_edenai_provider(template.get("tts_model"), "tts"),
        
        # LLM Configuration
        "llm_provider": provider_mapping.get(template.get("llm_provider"), template.get("llm_provider")),
        "llm_model": template.get("llm_model"),
        "llm_temperature": template.get("llm_temperature", 0.7),
        "llm_max_tokens": template.get("llm_max_tokens", 4096),
        "llm_top_p": template.get("llm_top_p", 1.0),
        "llm_frequency_penalty": template.get("llm_frequency_penalty", 0.0),
        "llm_presence_penalty": template.get("llm_presence_penalty", 0.0),
        
        # VAD Configuration
        "vad_enabled": template.get("vad_enabled", True),
        "vad_threshold": template.get("vad_threshold", 0.5),
        "vad_prefix_padding_ms": template.get("vad_prefix_padding_ms", 300),
        "vad_silence_duration_ms": template.get("vad_silence_duration_ms", 500),
        
        # Turn Detection
        "turn_detection_type": template.get("turn_detection_type", "server_vad"),
        
        # Audio Configuration
        "audio_input_transcription": template.get("audio_input_transcription", True),
        "audio_sample_rate": template.get("audio_sample_rate", 24000),
        
        # Template metadata for tracking
        "template_id": template.get("id"),
        "template_name": template.get("name"),
        "estimated_cost_per_minute": template.get("estimated_cost_per_minute", 0.0)
    }
    
    return config


def extract_edenai_provider(model_name: str, service_type: str) -> str:
    """
    Extract underlying provider name from Eden AI model name
    
    Examples:
    - "deepgram-nova-2" → "deepgram"
    - "elevenlabs-multilingual-v2" → "elevenlabs"
    - "playht-2.0-turbo" → "playht"
    """
    if not model_name or model_name == "bundled":
        return ""
    
    # Common pattern: provider-model-version
    parts = model_name.split("-")
    if len(parts) > 0:
        provider = parts[0]
        
        # Map to Eden AI provider names
        provider_map = {
            "deepgram": "deepgram",
            "assemblyai": "assemblyai",
            "google": "google",
            "whisper": "openai",
            "elevenlabs": "elevenlabs",
            "playht": "playht",
            "amazon": "amazon",
            "openai": "openai"
        }
        
        return provider_map.get(provider, provider)
    
    return ""


async def get_agent_config_with_template(phone_number: str) -> Dict[str, Any]:
    """
    Load complete agent configuration using AI template system
    
    This is the main function to call from agent.py
    Returns a phone_config dict that can be used with existing agent code
    """
    # Load template
    template = await get_template_for_phone(phone_number)
    
    if not template:
        logger.warning(f"⚠️ No template found for {phone_number}, using legacy phone_config")
        # Fallback to legacy get_phone_config
        from services.supabase import get_phone_config
        return await get_phone_config(phone_number)
    
    # Convert template to phone_config format
    config = template_to_phone_config(template)
    
    logger.info(f"📋 Template config loaded: {config['template_name']} (${config['estimated_cost_per_minute']}/min)")
    
    return config

