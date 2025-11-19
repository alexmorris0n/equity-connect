"""
Database service for Supabase integration
Handles leads, conversation_state, and prompt queries
"""

import os
from supabase import create_client, Client
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")

supabase: Client = create_client(supabase_url, supabase_key)


def normalize_phone(phone: str) -> str:
    """Normalize phone number (remove +1, keep digits)"""
    return phone.replace('+1', '').replace('+', '').strip()


async def get_lead_by_phone(phone: str) -> Optional[Dict[str, Any]]:
    """
    Get lead by phone number
    CRITICAL: Uses 'primary_phone' field (not 'phone')
    """
    normalized = normalize_phone(phone)
    
    try:
        response = supabase.table('leads')\
            .select('*, brokers!assigned_broker_id(id, contact_name, company_name, phone, nmls_number, nylas_grant_id)')\
            .or_(f'primary_phone.ilike.%{normalized}%,primary_phone_e164.eq.{normalized}')\
            .limit(1)\
            .execute()
        
        if response.data:
            logger.info(f"[DB] Lead found: {response.data[0].get('first_name', 'Unknown')}")
            return response.data[0]
        
        logger.info(f"[DB] No lead found for phone: {normalized}")
        return None
        
    except Exception as e:
        logger.error(f"[DB] Error fetching lead: {e}")
        return None


async def get_conversation_state(phone: str) -> Optional[Dict[str, Any]]:
    """Get or create conversation state"""
    normalized = normalize_phone(phone)
    
    try:
        response = supabase.table('conversation_state')\
            .select('*')\
            .eq('phone_number', normalized)\
            .limit(1)\
            .execute()
        
        if response.data:
            return response.data[0]
        
        # Create new state if doesn't exist
        new_state = {
            'phone_number': normalized,
            'current_node': 'greet',
            'conversation_data': {},
            'qualified': None,
            'call_count': 0
        }
        
        insert_response = supabase.table('conversation_state')\
            .insert(new_state)\
            .execute()
        
        if insert_response.data:
            logger.info(f"[DB] Created new conversation state for: {normalized}")
            return insert_response.data[0]
        
        return None
        
    except Exception as e:
        logger.error(f"[DB] Error fetching conversation state: {e}")
        return None


async def update_conversation_state(phone: str, updates: Dict[str, Any]) -> bool:
    """Update conversation state"""
    normalized = normalize_phone(phone)
    
    try:
        # Handle conversation_data updates (merge with existing)
        if 'conversation_data' in updates:
            # Get current state first
            current = await get_conversation_state(phone)
            if current:
                existing_data = current.get('conversation_data', {})
                if isinstance(existing_data, dict) and isinstance(updates['conversation_data'], dict):
                    updates['conversation_data'] = {**existing_data, **updates['conversation_data']}
        
        response = supabase.table('conversation_state')\
            .update(updates)\
            .eq('phone_number', normalized)\
            .execute()
        
        if response.data:
            logger.info(f"[DB] Updated conversation state for: {normalized}")
            return True
        
        return False
        
    except Exception as e:
        logger.error(f"[DB] Error updating conversation state: {e}")
        return False


async def get_node_prompt(node_name: str, vertical: str = "reverse_mortgage") -> Optional[str]:
    """
    Get node prompt from database
    Returns the instructions text from prompt_versions.content JSONB
    """
    try:
        # First get the prompt_id
        prompt_response = supabase.table('prompts')\
            .select('id')\
            .eq('node_name', node_name)\
            .eq('vertical', vertical)\
            .eq('is_active', True)\
            .limit(1)\
            .execute()
        
        if not prompt_response.data:
            logger.warning(f"[DB] No prompt found for node: {node_name}, vertical: {vertical}")
            return None
        
        prompt_id = prompt_response.data[0]['id']
        
        # Get active version
        version_response = supabase.table('prompt_versions')\
            .select('content')\
            .eq('prompt_id', prompt_id)\
            .eq('is_active', True)\
            .order('version_number', desc=True)\
            .limit(1)\
            .execute()
        
        if version_response.data:
            content = version_response.data[0].get('content', {})
            instructions = content.get('instructions', '')
            logger.info(f"[DB] Loaded prompt for node: {node_name}")
            return instructions
        
        logger.warning(f"[DB] No active version found for prompt_id: {prompt_id}")
        return None
        
    except Exception as e:
        logger.error(f"[DB] Error fetching node prompt: {e}")
        return None


async def get_node_config(node_name: str, vertical: str = "reverse_mortgage") -> Optional[Dict[str, Any]]:
    """
    Get full node configuration from database
    Returns dict with instructions, valid_contexts, functions, step_criteria
    """
    try:
        # First get the prompt_id
        prompt_response = supabase.table('prompts')\
            .select('id')\
            .eq('node_name', node_name)\
            .eq('vertical', vertical)\
            .eq('is_active', True)\
            .limit(1)\
            .execute()
        
        if not prompt_response.data:
            logger.warning(f"[DB] No prompt found for node: {node_name}, vertical: {vertical}")
            return None
        
        prompt_id = prompt_response.data[0]['id']
        
        # Get active version
        version_response = supabase.table('prompt_versions')\
            .select('content')\
            .eq('prompt_id', prompt_id)\
            .eq('is_active', True)\
            .order('version_number', desc=True)\
            .limit(1)\
            .execute()
        
        if version_response.data:
            content = version_response.data[0].get('content', {})
            # Vue portal saves as 'tools', but SignalWire expects 'functions'
            # Support both for backward compatibility
            functions = content.get('functions', []) or content.get('tools', [])
            config = {
                'instructions': content.get('instructions', ''),
                'valid_contexts': content.get('valid_contexts', []),
                'functions': functions,
                'step_criteria': content.get('step_criteria', '')
            }
            logger.info(f"[DB] Loaded full config for node: {node_name}")
            logger.info(f"[DB]   - valid_contexts: {config.get('valid_contexts', [])}")
            logger.info(f"[DB]   - functions: {config.get('functions', [])}")
            logger.info(f"[DB]   - step_criteria: {config.get('step_criteria', '')[:100] if config.get('step_criteria') else 'MISSING'}...")
            logger.info(f"[DB]   - instructions length: {len(config.get('instructions', ''))} chars")
            # Log first 500 chars of instructions to see if they mention calling functions
            instructions_preview = config.get('instructions', '')[:500]
            if 'calculate' in instructions_preview.lower() or 'function' in instructions_preview.lower() or 'call ' in instructions_preview.lower():
                logger.info(f"[DB]   - instructions preview (first 500 chars): {instructions_preview}...")
            else:
                logger.warning(f"[DB]   ⚠️  Instructions for '{node_name}' don't mention calling functions! Preview: {instructions_preview[:200]}...")
            return config
        
        logger.warning(f"[DB] No active version found for prompt_id: {prompt_id}")
        return None
        
    except Exception as e:
        logger.error(f"[DB] Error fetching node config: {e}")
        return None


async def get_theme_prompt(vertical: str = "reverse_mortgage") -> Optional[str]:
    """Get theme prompt (universal personality)"""
    try:
        response = supabase.table('theme_prompts')\
            .select('content')\
            .eq('vertical', vertical)\
            .eq('is_active', True)\
            .limit(1)\
            .execute()
        
        if response.data:
            return response.data[0].get('content', '')
        
        return None
        
    except Exception as e:
        logger.error(f"[DB] Error fetching theme prompt: {e}")
        return None


async def get_voice_config(vertical: str = "reverse_mortgage", language_code: str = "en-US") -> Dict[str, Any]:
    """
    Get voice configuration from database
    Returns: {engine, voice_name, model, voice_string}
    """
    try:
        response = supabase.table('agent_voice_config')\
            .select('tts_engine, voice_name, model')\
            .eq('vertical', vertical)\
            .eq('language_code', language_code)\
            .eq('is_active', True)\
            .limit(1)\
            .execute()
        
        if response.data and len(response.data) > 0:
            config = response.data[0]
            engine = config.get('tts_engine', 'elevenlabs')
            voice_name = config.get('voice_name', 'rachel')
            model = config.get('model')
            
            # Validate voice_name is not None/empty
            if not voice_name:
                logger.warning(f"[DB] Voice name is empty in DB, using fallback")
                voice_name = 'rachel'
            
            # Build voice string per SignalWire format
            voice_string = build_voice_string(engine, voice_name)
            
            logger.info(f"[DB] Loaded voice config: {voice_string} (engine: {engine}, voice: {voice_name}, language: {language_code})")
            return {
                "engine": engine,
                "voice_name": voice_name,
                "model": model,
                "voice_string": voice_string
            }
    except Exception as e:
        logger.error(f"[DB] Failed to load voice config from DB: {e}, using fallback", exc_info=True)
    
    # Fallback to defaults
    engine = "elevenlabs"
    voice_name = "rachel"
    voice_string = build_voice_string(engine, voice_name)
    logger.info(f"[DB] Using fallback voice: {voice_string}")
    
    return {
        "engine": engine,
        "voice_name": voice_name,
        "model": None,
        "voice_string": voice_string
    }


def build_voice_string(engine: str, voice_name: str) -> str:
    """Build provider-specific voice string per SignalWire format"""
    formats = {
        "elevenlabs": f"elevenlabs.{voice_name}",
        "openai": f"openai.{voice_name}",
        "google": f"gcloud.{voice_name}",
        "gcloud": f"gcloud.{voice_name}",
        "amazon": f"amazon.{voice_name}",
        "polly": f"amazon.{voice_name}",
        "azure": voice_name,  # Azure uses full voice code as-is
        "microsoft": voice_name,
        "cartesia": f"cartesia.{voice_name}",
        "rime": f"rime.{voice_name}"
    }
    return formats.get(engine.lower(), f"{engine}.{voice_name}")

