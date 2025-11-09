"""
Prompt Adapter for GPT-Realtime API
Converts structured prompts to OpenAI Realtime format
Based on barbara-v3 conversion layer

GPT-realtime requires:
- Single 'instructions' field (not messages array)
- Straightline structure with clear sections
- Bullet points over paragraphs
- No {{user_question}} placeholder
"""

import logging
import hashlib
from typing import Dict, Any, Optional
from functools import lru_cache

logger = logging.getLogger(__name__)

# Emergency fallback prompt if conversion fails catastrophically
EMERGENCY_FALLBACK_PROMPT = """
You are Barbara, a warm, professional voice assistant for Equity Connect.
You help seniors understand reverse mortgage options and schedule appointments with brokers.

PERSONALITY:
- Warm, calm, patient, never pushy
- Short turns (1-2 concise sentences)
- Stop speaking immediately if the caller interrupts

RULES:
- Always verify caller's information first
- Answer questions accurately and simply
- Offer to schedule appointments when appropriate
- Escalate complex questions to a human broker
""".strip()

# In-memory cache for converted prompts (cleared on restart)
PROMPT_CACHE: Dict[str, str] = {}


def convert_prompt_for_realtime(prompt_content: Dict[str, Any], variables: Dict[str, Any]) -> str:
    """
    Convert structured prompt to GPT-realtime format with error handling
    
    Args:
        prompt_content: Dictionary with prompt sections (role, personality, tools, etc.)
        variables: Dictionary of variables to inject (leadFirstName, brokerName, etc.)
    
    Returns:
        Converted prompt string formatted for OpenAI Realtime API
    
    Raises:
        Exception: Only if conversion fails catastrophically (will use emergency fallback)
    """
    try:
        return _convert_prompt_internal(prompt_content, variables)
    except KeyError as e:
        # Log missing variable but don't crash
        logger.warning(f"⚠️ Missing variable in prompt: {e}. Using safe defaults.")
        
        # Fill missing vars with safe defaults
        safe_variables = {
            **variables,
            "leadFirstName": variables.get("leadFirstName") or variables.get("lead_first_name") or "there",
            "brokerName": variables.get("brokerName") or variables.get("broker_name") or "your broker",
            "callContext": variables.get("callContext") or variables.get("call_context") or "inbound",
            "propertyAddress": variables.get("propertyAddress") or variables.get("property_address") or "",
            "estimatedEquity": variables.get("estimatedEquity") or variables.get("estimated_equity") or "",
        }
        
        return _convert_prompt_internal(prompt_content, safe_variables)
    
    except Exception as e:
        # Catastrophic failure - use emergency fallback prompt
        logger.error(f"❌ Prompt conversion failed: {e}. Using emergency fallback.")
        return EMERGENCY_FALLBACK_PROMPT


def convert_and_cache_prompt(prompt_content: Dict[str, Any], variables: Dict[str, Any]) -> str:
    """
    Convert prompt with caching to avoid re-converting on every call
    
    Cache key is based on hash of prompt content + variables
    Cache is in-memory and cleared on service restart
    """
    # Create hash of prompt + variables for cache key
    prompt_hash = hashlib.md5(str(sorted(prompt_content.items())).encode()).hexdigest()
    variables_hash = hashlib.md5(str(sorted(variables.items())).encode()).hexdigest()
    cache_key = f"{prompt_hash}:{variables_hash}"
    
    # Check cache first
    if cache_key in PROMPT_CACHE:
        logger.debug(f"✅ Using cached prompt for {cache_key[:12]}...")
        return PROMPT_CACHE[cache_key]
    
    # Convert and cache
    converted = convert_prompt_for_realtime(prompt_content, variables)
    PROMPT_CACHE[cache_key] = converted
    logger.debug(f"📝 Cached new prompt {cache_key[:12]}... (cache size: {len(PROMPT_CACHE)})")
    
    return converted


def _convert_prompt_internal(prompt_content: Dict[str, Any], variables: Dict[str, Any]) -> str:
    """
    Internal conversion logic (called by convert_prompt_for_realtime)
    """
    parts = []
    
    # 1. Core role (non-negotiable, first)
    if prompt_content.get("role"):
        parts.append(prompt_content["role"].strip())
    else:
        parts.append(
            "You are Barbara, a warm, professional voice assistant for Equity Connect. "
            "You help seniors understand reverse mortgage options, verify their information, "
            "answer questions accurately, and schedule time with their assigned broker."
        )
    
    # 2. Personality & style (critical for voice behavior)
    if prompt_content.get("personality"):
        parts.append(f"PERSONALITY & STYLE:\n{prompt_content['personality'].strip()}")
    else:
        parts.append(
            "PERSONALITY & STYLE:\n"
            "- Warm, calm, patient, never pushy.\n"
            "- Short turns (1–2 concise sentences).\n"
            "- Stop speaking immediately if the caller starts talking.\n"
            "- Use the caller's first name only in the greeting, not repeatedly."
        )
    
    # 3. Realtime-specific behavior (hardcoded runtime rules)
    parts.append(
        "REALTIME BEHAVIOR (OPENAI REALTIME SPECIFIC):\n"
        "- Stop talking immediately if the caller interrupts you.\n"
        "- If there is about 2 seconds of silence, use a soft filler (\"mm-hmm\", \"okay\").\n"
        "- If there is about 5 seconds of silence, gently prompt (\"Whenever you're ready\").\n"
        "- While tools run, briefly narrate once (\"Let me check that for you\").\n"
        "- Speak in natural, concise sentences suited for seniors.\n"
        "- Express all important numbers as words (\"sixty-two\", \"five hundred thousand\").\n"
        "- Do not read bullet points or labels out loud verbatim; respond conversationally."
    )
    
    # 4. Context (with variable injection)
    if prompt_content.get("context"):
        context = inject_variables(prompt_content["context"], variables)
        parts.append(f"CONTEXT:\n{context}")
    
    # 5. Tools (conceptual usage only - actual tool schemas defined in code)
    if prompt_content.get("tools"):
        parts.append(f"TOOLS (HOW TO USE THEM):\n{prompt_content['tools'].strip()}")
    
    # 6. Conversation flow
    if prompt_content.get("conversation_flow"):
        parts.append(f"CONVERSATION FLOW:\n{prompt_content['conversation_flow'].strip()}")
    
    # 7. Rules & constraints
    if prompt_content.get("instructions"):
        parts.append(f"RULES & CONSTRAINTS:\n{prompt_content['instructions'].strip()}")
    
    # 8. Safety & escalation
    if prompt_content.get("safety"):
        parts.append(f"SAFETY & ESCALATION:\n{prompt_content['safety'].strip()}")
    
    # 9. Output format
    if prompt_content.get("output_format"):
        parts.append(f"OUTPUT FORMAT:\n{prompt_content['output_format'].strip()}")
    else:
        parts.append(
            "OUTPUT FORMAT:\n"
            "- Natural spoken language only.\n"
            "- 1–2 sentences per turn unless more detail is requested.\n"
            "- Use words instead of numerals for key numbers and dollar amounts.\n"
            "- Do not read internal labels (like CONTEXT, TOOLS) aloud."
        )
    
    # 10. Pronunciation guide
    if prompt_content.get("pronunciation"):
        parts.append(f"PRONUNCIATION:\n{prompt_content['pronunciation'].strip()}")
    else:
        parts.append(
            "PRONUNCIATION:\n"
            "- \"NMLS\" → say \"N-M-L-S\".\n"
            "- \"Equity\" → say \"EH-kwi-tee\"."
        )
    
    return "\n\n".join(parts).strip()


def inject_variables(text: str, variables: Dict[str, Any]) -> str:
    """
    Inject variables into prompt text
    
    Variables are in {{variable_name}} format
    Removes {{user_question}} placeholder (used for chat completion, not realtime)
    """
    # Remove {{user_question}} placeholder and add safe defaults
    enriched_variables = {
        **variables,
        "user_question": "",  # Remove this placeholder
        "user": variables.get("user") or variables.get("leadFirstName") or variables.get("lead_first_name") or "",
        "context": variables.get("context") or variables.get("callContext") or variables.get("call_context") or "inbound"
    }
    
    result = text
    for key, value in enriched_variables.items():
        # Replace both snake_case and camelCase versions
        result = result.replace(f"{{{{{key}}}}}", str(value))
        
        # Also try camelCase version if key is snake_case
        if "_" in key:
            camel_key = "".join(word.capitalize() if i > 0 else word for i, word in enumerate(key.split("_")))
            result = result.replace(f"{{{{{camel_key}}}}}", str(value))
    
    return result


def clear_prompt_cache():
    """Clear the in-memory prompt cache (useful for testing or memory management)"""
    global PROMPT_CACHE
    cache_size = len(PROMPT_CACHE)
    PROMPT_CACHE = {}
    logger.info(f"🧹 Cleared prompt cache ({cache_size} entries)")


# For backwards compatibility with existing code
def get_cached_converted_prompt(prompt_hash: str, variables_hash: str) -> Optional[str]:
    """Legacy function - use convert_and_cache_prompt instead"""
    cache_key = f"{prompt_hash}:{variables_hash}"
    return PROMPT_CACHE.get(cache_key)

