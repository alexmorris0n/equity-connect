"""Prompt loading and variable injection service"""
from typing import Dict, Any, Optional, Tuple
from supabase import Client
from services.supabase import get_supabase_client
import logging
import time

logger = logging.getLogger(__name__)

# In-memory prompt cache
_prompt_cache: Dict[str, Dict[str, Any]] = {}
_cache_ttl_seconds = 300  # 5 minutes
_cache_timestamps: Dict[str, float] = {}

async def load_prompt_for_call_type(call_type: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Load active prompt and version for a call type with caching
    
    Args:
        call_type: One of 'inbound-qualified', 'inbound-unqualified', 'inbound-unknown',
                   'outbound-warm', 'outbound-cold'
    
    Returns:
        Tuple of (prompt_metadata, version_data)
    """
    # Check cache first
    now = time.time()
    if call_type in _prompt_cache:
        cached_time = _cache_timestamps.get(call_type, 0)
        if (now - cached_time) < _cache_ttl_seconds:
            logger.debug(f"📦 Using cached prompt for {call_type}")
            cached = _prompt_cache[call_type]
            return cached['prompt'], cached['version']
    
    # Fetch from Supabase
    logger.debug(f"🔍 Fetching prompt from Supabase for {call_type}")
    supabase = get_supabase_client()
    
    # Query prompts table with join to prompt_versions
    response = supabase.table('prompts')\
        .select('''
            id, name, call_type, voice, vad_threshold,
            vad_prefix_padding_ms, vad_silence_duration_ms,
            runtime, elevenlabs_defaults,
            prompt_versions!inner(id, content, is_active, version_number)
        ''')\
        .eq('call_type', call_type)\
        .eq('is_active', True)\
        .eq('prompt_versions.is_active', True)\
        .execute()
    
    if not response.data or len(response.data) == 0:
        logger.error(f"❌ No prompt found for {call_type}")
        raise Exception(f"No active prompt found for {call_type}")
    
    prompt_data = response.data[0]
    version_data = prompt_data.get('prompt_versions', [])
    
    if isinstance(version_data, list) and len(version_data) > 0:
        version = version_data[0]
    elif isinstance(version_data, dict):
        version = version_data
    else:
        raise Exception(f"No active version found for {call_type}")
    
    prompt_metadata = {
        'id': prompt_data['id'],
        'call_type': call_type,
        'voice': prompt_data.get('voice', 'shimmer'),
        'vad_threshold': prompt_data.get('vad_threshold', 0.5),
        'vad_prefix_padding_ms': prompt_data.get('vad_prefix_padding_ms', 300),
        'vad_silence_duration_ms': prompt_data.get('vad_silence_duration_ms', 500),
        'elevenlabs_defaults': prompt_data.get('elevenlabs_defaults', {}),
        'version_number': version.get('version_number'),
        'version_id': version.get('id'),
    }
    
    # Update cache
    _prompt_cache[call_type] = {
        'prompt': prompt_metadata,
        'version': version
    }
    _cache_timestamps[call_type] = now
    
    logger.info(f"✅ Loaded prompt: {call_type} v{version.get('version_number', 'unknown')}")
    return prompt_metadata, version

def assemble_prompt_markdown(content: Dict[str, Any]) -> str:
    """
    Assemble prompt from JSONB content sections into optimized Markdown
    
    Order: Role → Personality → Context → Tools → Conversation Flow → 
           Rules → Safety → Output → Pronunciation
    """
    parts = []
    
    # 1. Role & Objective
    if content.get('role'):
        parts.append(f"## Role & Objective\n{content['role']}")
    
    # 2. Personality & Tone
    if content.get('personality'):
        parts.append(f"## Personality & Tone\n{content['personality']}")
    
    # 3. Context
    if content.get('context'):
        parts.append(f"## Context\n{content['context']}")
    
    # 4. Tools
    if content.get('tools'):
        parts.append(f"## Tools\n{content['tools']}")
    
    # 5. Conversation Flow
    if content.get('conversation_flow'):
        parts.append(f"## Conversation Flow\n{content['conversation_flow']}")
    
    # 6. Rules & Constraints
    if content.get('instructions'):
        parts.append(f"## Rules & Constraints\n{content['instructions']}")
    
    # 7. Safety & Escalation
    if content.get('safety'):
        parts.append(f"## Safety & Escalation\n{content['safety']}")
    
    # 8. Output Format
    if content.get('output_format'):
        parts.append(f"## Output Format\n{content['output_format']}")
    
    # 9. Pronunciation Guide
    if content.get('pronunciation'):
        parts.append(f"## Pronunciation Guide\n{content['pronunciation']}")
    
    return '\n\n'.join(parts).strip()

def inject_variables(text: str, variables: Dict[str, str]) -> str:
    """
    Replace {{variable}} placeholders in prompt text
    
    Args:
        text: Prompt text with {{variable}} placeholders
        variables: Dict of variable names to values
    
    Returns:
        Text with variables replaced
    """
    result = text
    for key, value in variables.items():
        # Replace all occurrences of {{key}}
        import re
        pattern = re.compile(r'\{\{' + re.escape(key) + r'\}\}', re.IGNORECASE)
        result = pattern.sub(str(value), result)
    return result

def build_variables(lead: Optional[Dict[str, Any]], broker: Optional[Dict[str, Any]], call_type: str, caller_phone: str, called_number: str) -> Dict[str, str]:
    """
    Build 28+ variables from lead/broker/call metadata with safe defaults
    Matches variable names from elevenlabs-webhook/personalize.js
    
    Returns:
        Dict of variable names to values
    """
    # Defaults first (Barbara V3 pattern)
    variables = {
        'brokerFirstName': 'your specialist',
        'brokerFullName': 'your specialist',
        'brokerCompany': 'Barbara',
        'leadFirstName': '',
        'leadLastName': '',
        'propertyCity': '',
        'estimatedEquity': '',
        'callContext': 'inbound',
    }
    
    # Override with actual lead data if available
    if lead and lead.get('brokers'):
        broker_data = lead['brokers']
        broker_name_parts = (broker_data.get('contact_name') or '').split(' ', 1)
        
        variables.update({
            # Lead info
            'leadFirstName': lead.get('first_name', ''),
            'leadLastName': lead.get('last_name', ''),
            'leadFullName': f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
            'leadEmail': lead.get('primary_email', ''),
            'leadPhone': lead.get('primary_phone', ''),
            'leadAge': str(lead.get('age', '')) if lead.get('age') else '',
            
            # Property info
            'propertyAddress': lead.get('property_address', ''),
            'propertyCity': lead.get('property_city', ''),
            'propertyState': lead.get('property_state', ''),
            'propertyZip': lead.get('property_zip', ''),
            'propertyValue': f"${lead['property_value']:,}" if lead.get('property_value') else '',
            'propertyValueWords': number_to_words(lead.get('property_value', 0)),
            'estimatedEquity': f"${lead['estimated_equity']:,}" if lead.get('estimated_equity') else '',
            'estimatedEquityWords': number_to_words(lead.get('estimated_equity', 0)),
            'equity50Percent': f"${int(lead['estimated_equity'] * 0.5):,}" if lead.get('estimated_equity') else '',
            'equity60Percent': f"${int(lead['estimated_equity'] * 0.6):,}" if lead.get('estimated_equity') else '',
            'ownerOccupied': 'yes' if lead.get('owner_occupied') else 'no',
            
            # Broker info
            'brokerFirstName': broker_name_parts[0] if broker_name_parts else 'your specialist',
            'brokerLastName': broker_name_parts[1] if len(broker_name_parts) > 1 else '',
            'brokerFullName': broker_data.get('contact_name', 'your specialist'),
            'brokerCompany': broker_data.get('company_name', 'Barbara'),
            'brokerPhone': broker_data.get('phone', ''),
            'brokerNMLS': broker_data.get('nmls_number', ''),
        })
    elif lead:
        # Lead without broker - override defaults with partial data
        variables.update({
            'leadFirstName': lead.get('first_name', ''),
            'leadLastName': lead.get('last_name', ''),
            'propertyCity': lead.get('property_city', ''),
            'propertyZip': lead.get('property_zip', ''),
            'estimatedEquity': f"${lead['estimated_equity']:,}" if lead.get('estimated_equity') else '',
        })
    
    # Call metadata
    variables.update({
        'callType': call_type,
        'callerPhone': caller_phone,
        'calledNumber': called_number,
    })
    
    return variables

def number_to_words(num: float) -> str:
    """Convert number to words (simple version)"""
    if num >= 1_000_000:
        return f"{(num / 1_000_000):.1f} million"
    elif num >= 1_000:
        return f"{int(num / 1_000)} thousand"
    return str(int(num))

async def get_instructions_for_call_type(direction: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get instructions (prompt) for a call type with variable injection
    
    Args:
        direction: 'inbound' or 'outbound'
        context: Dict with lead_id, broker_id, from, to, call_type, etc.
    
    Returns:
        Dict with prompt, call_type, version_number, voice, vad settings, etc.
    """
    from services.call_type import detect_call_type
    from services.supabase import get_lead_by_phone
    
    # Determine call type if not provided
    call_type = context.get('call_type')
    if not call_type:
        caller_phone = context.get('from')
        called_number = context.get('to')
        call_type_result = await detect_call_type(caller_phone, called_number)
        call_type = call_type_result.get('call_type', 'inbound-unknown')
    
    # Get lead if not provided
    lead = context.get('lead')
    broker = context.get('broker')
    if not lead and context.get('from'):
        lead = await get_lead_by_phone(context['from'])
        if lead and lead.get('brokers'):
            broker = lead['brokers']
    
    # Load prompt and version
    prompt_meta, version_data = await load_prompt_for_call_type(call_type)
    
    # Assemble prompt content
    content = version_data.get('content', {})
    prompt_text = assemble_prompt_markdown(content)
    
    # Build variables
    variables = build_variables(
        lead=lead,
        broker=broker,
        call_type=call_type,
        caller_phone=context.get('from', ''),
        called_number=context.get('to', '')
    )
    
    # Inject variables
    final_prompt = inject_variables(prompt_text, variables)
    
    # Extract first_message from elevenlabs_defaults if available
    first_message = None
    elevenlabs_defaults = prompt_meta.get('elevenlabs_defaults', {})
    if isinstance(elevenlabs_defaults, dict):
        first_message = elevenlabs_defaults.get('first_message')
    
    # Return metadata dict
    return {
        'prompt': final_prompt,
        'call_type': call_type,
        'version_number': prompt_meta.get('version_number'),
        'version_id': prompt_meta.get('version_id'),
        'voice': prompt_meta.get('voice', 'shimmer'),
        'vad_threshold': prompt_meta.get('vad_threshold', 0.5),
        'vad_prefix_padding_ms': prompt_meta.get('vad_prefix_padding_ms', 300),
        'vad_silence_duration_ms': prompt_meta.get('vad_silence_duration_ms', 500),
        'first_message': first_message,
        'source': 'supabase' if prompt_meta.get('id') else 'hardcoded'
    }

