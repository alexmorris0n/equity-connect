"""Prompt loading service for node-based conversation flow.

Loads node-specific prompts from database (Plan 2/3 integration) with fallback
to markdown files for development/testing.
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def load_theme(vertical: str = "reverse_mortgage") -> str:
    """Load universal theme prompt for a vertical from database
    
    Theme defines Barbara's core personality across ALL nodes.
    Applied before every node prompt for consistency.
    
    Args:
        vertical: Business vertical (default: "reverse_mortgage")
    
    Returns:
        Theme prompt content defining core personality (assembled from structured sections)
    """
    # TRY DATABASE FIRST (Structured JSONB format)
    try:
        from services.supabase import get_supabase_client
        
        sb = get_supabase_client()
        result = sb.table('theme_prompts').select('content_structured, content').eq('vertical', vertical).eq('is_active', True).execute()
        
        if result.data and len(result.data) > 0:
            row = result.data[0]
            
            # PREFER: Structured format (content_structured JSONB)
            if row.get('content_structured'):
                theme_data = row['content_structured']
                assembled = _assemble_theme(theme_data)
                if assembled:
                    logger.info(f"✅ Loaded structured theme for {vertical}: {len(assembled)} chars")
                    return assembled
            
            # FALLBACK: Old format (content TEXT) for backward compatibility
            if row.get('content'):
                theme = row['content']
                logger.info(f"✅ Loaded legacy theme for {vertical}: {len(theme)} chars (consider migrating to structured format)")
                return theme
            
            logger.warning(f"Database returned empty theme for {vertical}, using fallback")
        else:
            logger.warning(f"No theme found in database for {vertical}, using fallback")
    
    except Exception as e:
        # 🚨 LOUD FALLBACK for exception
        from services.fallbacks import log_theme_fallback, get_fallback_theme
        log_theme_fallback(vertical, f"{type(e).__name__}: {str(e)}", is_exception=True)
        return get_fallback_theme()
    
    # 🚨 LOUD FALLBACK for missing data
    from services.fallbacks import log_theme_fallback, get_fallback_theme
    
    if not result.data:
        log_theme_fallback(vertical, "No rows returned from theme_prompts query", is_exception=False)
    else:
        log_theme_fallback(vertical, "Database returned row but content fields are empty", is_exception=False)
    
    return get_fallback_theme()


def _assemble_theme(theme_data: dict) -> str:
    """Assemble structured theme JSONB into single text block
    
    Combines 5 sections (identity, output_rules, conversational_flow, tools, guardrails)
    into one formatted prompt matching LiveKit's structure.
    
    Args:
        theme_data: Dict with keys: identity, output_rules, conversational_flow, tools, guardrails
    
    Returns:
        Assembled theme as single text block
    """
    sections = []
    
    # Section 1: Identity (no header, just the statement)
    if theme_data.get('identity'):
        sections.append(theme_data['identity'])
    
    # Section 2: Output rules
    if theme_data.get('output_rules'):
        sections.append(f"# Output rules\n\n{theme_data['output_rules']}")
    
    # Section 3: Conversational flow
    if theme_data.get('conversational_flow'):
        sections.append(f"# Conversational flow\n\n{theme_data['conversational_flow']}")
    
    # Section 4: Tools
    if theme_data.get('tools'):
        sections.append(f"# Tools\n\n{theme_data['tools']}")
    
    # Section 5: Guardrails
    if theme_data.get('guardrails'):
        sections.append(f"# Guardrails\n\n{theme_data['guardrails']}")
    
    return "\n\n".join(sections)


def load_node_config(node_name: str, vertical: str = "reverse_mortgage") -> dict:
    """Load full node configuration from database (instructions, step_criteria, valid_contexts, tools)
    
    IMPORTANT: The 'instructions' field returned by this function contains COMBINED content:
        1. Universal theme (identity, output_rules, conversational_flow, tools, guardrails)
        2. Node-specific instructions (role + instructions from prompt_versions.content)
    
    This matches LiveKit's documented workflow pattern where "the main prompt contains 
    general guidelines and an overarching goal, but each individual agent or task holds 
    a more specific and immediate goal within the workflow."
    
    Pattern: Theme → Node Role → Node Instructions
    Example:
        # Identity
        You are Barbara, a warm voice assistant...
        
        # Output rules
        - Large amounts: "1.5 million" not "one million five hundred..."
        
        ---
        
        ## Role
        You are Barbara, a scheduler who books appointments...
        
        ## Instructions
        Check broker availability and schedule appointment...
    
    Returns dict with:
    - instructions: str (COMBINED: theme + node prompt - ready to pass to Agent.__init__)
    - step_criteria: str (when node is complete - for routing logic)
    - valid_contexts: list (allowed transitions - for routing validation)
    - tools: list (available function names - for tool loading)
    - role: str (node-specific role - for reference/debugging)
    """
    try:
        from services.supabase import get_supabase_client
        
        sb = get_supabase_client()
        result = sb.rpc('get_node_prompt', {
            'p_vertical': vertical,
            'p_node_name': node_name
        }).execute()
        
        if result.data and len(result.data) > 0:
            content = result.data[0].get('content', {})
            
            # Build node-specific prompt (role + instructions)
            node_prompt_parts = []
            if content.get('role'):
                node_prompt_parts.append(f"## Role\n{content['role']}\n")
            if content.get('instructions'):
                node_prompt_parts.append(f"## Instructions\n{content['instructions']}")
            
            node_instructions = "\n".join(node_prompt_parts) if node_prompt_parts else ''
            
            # Load universal theme and combine with node instructions
            # This ensures ALL agents get output_rules, conversational_flow, guardrails, etc.
            theme = load_theme(vertical)
            combined_instructions = f"{theme}\n\n---\n\n{node_instructions}" if theme and node_instructions else (theme or node_instructions)
            
            logger.info(f"✅ Loaded config for '{node_name}': theme ({len(theme)} chars) + node ({len(node_instructions)} chars) = {len(combined_instructions)} chars total")
            
            return {
                'instructions': combined_instructions,  # ← COMBINED: theme + node (ready for Agent.__init__)
                'step_criteria': content.get('step_criteria', ''),        # Legacy field (fallback)
                'step_criteria_lk': content.get('step_criteria_lk', ''),  # LiveKit-optimized boolean expressions
                'step_criteria_sw': content.get('step_criteria_sw', ''),  # SignalWire-optimized natural language
                'valid_contexts': content.get('valid_contexts', []),
                'tools': content.get('tools') or content.get('functions', []),  # Support both fields
                'role': content.get('role', '')  # Node-specific role (for reference)
            }
    except Exception as e:
        # 🚨 LOUD FALLBACK for exception
        from services.fallbacks import log_node_config_fallback, get_fallback_node_config
        log_node_config_fallback(node_name, vertical, f"{type(e).__name__}: {str(e)}", is_exception=True, has_fallback=node_name in ["greet", "verify", "qualify", "quote", "answer", "objections", "book", "goodbye", "end"])
        fallback = get_fallback_node_config(node_name)
        if fallback:
            return fallback
        else:
            # No fallback available for this node
            return {
                'instructions': '',
                'step_criteria': '',
                'step_criteria_lk': '',
                'step_criteria_sw': '',
                'valid_contexts': [],
                'tools': [],
                'role': ''
            }
    
    # 🚨 LOUD FALLBACK for missing data
    from services.fallbacks import log_node_config_fallback, get_fallback_node_config
    log_node_config_fallback(node_name, vertical, "No active prompt_version found in database", is_exception=False, has_fallback=node_name in ["greet", "verify", "qualify", "quote", "answer", "objections", "book", "goodbye", "end"])
    
    fallback = get_fallback_node_config(node_name)
    if fallback:
        return fallback
    else:
        # No fallback available for this node
        return {
            'instructions': '',
            'step_criteria': '',
            'step_criteria_lk': '',
            'step_criteria_sw': '',
            'valid_contexts': [],
            'tools': [],
            'role': ''
        }


def load_node_prompt(node_name: str, vertical: str = "reverse_mortgage") -> str:
    """Load node prompt from database or fallback to markdown file
    
    This connects Plan 1 (backend) → Plan 2 (database) → Plan 3 (Vue portal).
    Portal edits are immediately available to the agent runtime.
    
    Args:
        node_name: Node name (e.g., "greet", "verify", "qualify")
        vertical: Business vertical (default: "reverse_mortgage")
    
    Returns:
        Node prompt content (generic instructions, no call-type branching)
    """
    # TRY DATABASE FIRST (Plan 2/3 integration)
    try:
        from services.supabase import get_supabase_client
        
        sb = get_supabase_client()
        result = sb.rpc('get_node_prompt', {
            'p_vertical': vertical,
            'p_node_name': node_name
        }).execute()
        
        if result.data and len(result.data) > 0:
            # Extract JSONB content from Plan 2 structure
            content = result.data[0].get('content', {})
            
            # Build prompt from JSONB fields (Plan 2/3 schema)
            # SignalWire uses: content.instructions (required)
            # LiveKit compatible: content.role (optional), content.instructions (required)
            prompt_parts = []
            if content.get('role'):
                prompt_parts.append(f"## Role\n{content['role']}\n")
            if content.get('instructions'):
                prompt_parts.append(f"## Instructions\n{content['instructions']}")
            elif content.get('text'):  # Fallback for old structure
                prompt_parts.append(content['text'])
            
            if prompt_parts:
                node_prompt = "\n".join(prompt_parts)
                logger.info(f"✅ Loaded {node_name} from database (vertical={vertical})")
                
                # Load theme and combine: Theme → Node
                theme = load_theme(vertical)
                combined_prompt = f"{theme}\n\n---\n\n{node_prompt}"
                
                logger.info(f"Combined theme ({len(theme)} chars) + node ({len(node_prompt)} chars) = {len(combined_prompt)} chars")
                return combined_prompt
            else:
                # Database returned a row but content is empty
                logger.warning(f"Database returned empty content for {node_name}/{vertical}, falling back to file")
                # Fall through to file fallback
    
    except Exception as e:
        logger.warning(f"Failed to load from database: {e}, falling back to file")
    
    # FALLBACK TO FILE (development/testing)
    module_dir = os.path.dirname(__file__)
    prompt_path = os.path.join(module_dir, "..", "prompts", vertical, "nodes", f"{node_name}.md")
    prompt_path = os.path.abspath(prompt_path)
    
    try:
        with open(prompt_path, 'r') as f:
            node_prompt = f.read()
            logger.info(f"✅ Loaded {node_name} from file: {prompt_path}")
            
            # Load theme and combine
            theme = load_theme(vertical)
            combined_prompt = f"{theme}\n\n---\n\n{node_prompt}"
            
            return combined_prompt
    except FileNotFoundError:
        logger.warning(f"Prompt file not found: {prompt_path}")
        return f"You are in the {node_name} phase. Continue naturally."


def build_context_injection(call_type: str, lead_context: dict, phone_number: str) -> str:
    """Build context string to inject before node prompt
    
    This provides the LLM with situational awareness so the same node prompt
    can adapt to different call types (inbound/outbound, qualified/unqualified).
    
    Args:
        call_type: Type of call (inbound-qualified, outbound-warm, etc.)
        lead_context: Dict with lead_id, name, qualified, property info, etc.
        phone_number: Caller's phone number
    
    Returns:
        Formatted context string to prepend to node prompt
    """
    # Determine call direction
    is_inbound = call_type.startswith("inbound")
    is_qualified = lead_context.get("qualified", False)
    lead_id = lead_context.get("lead_id")
    lead_name = lead_context.get("name", "Unknown")
    
    context_parts = [
        "=== CALL CONTEXT ===",
        f"Call Type: {call_type}",
        f"Direction: {'Inbound' if is_inbound else 'Outbound'}",
        f"Phone: {phone_number}",
        f"IMPORTANT: Use this phone number ({phone_number}) when calling tools that require a phone parameter.",
    ]
    
    if lead_id:
        context_parts.append(f"Lead Status: Known (ID: {lead_id})")
        context_parts.append(f"Lead Name: {lead_name}")
        context_parts.append(f"Qualified: {'Yes' if is_qualified else 'No'}")
        
        # Add property context if available
        property_parts = []
        if lead_context.get("property_address"):
            property_parts.append(lead_context['property_address'])
        elif lead_context.get("property_city") or lead_context.get("property_state"):
            # Construct address from city/state if address not available
            addr_parts = []
            if lead_context.get("property_city"):
                addr_parts.append(lead_context['property_city'])
            if lead_context.get("property_state"):
                addr_parts.append(lead_context['property_state'])
            if addr_parts:
                property_parts.append(", ".join(addr_parts))
        
        if property_parts:
            context_parts.append(f"Property: {', '.join(property_parts)}")
        
        if lead_context.get("estimated_equity"):
            context_parts.append(f"Est. Equity: ${lead_context['estimated_equity']:,}")
        
        # Add email if available (for verification scenarios)
        if lead_context.get("email") or lead_context.get("primary_email"):
            context_parts.append(f"Email: {lead_context.get('email') or lead_context.get('primary_email')}")
    else:
        context_parts.append("Lead Status: Unknown (new caller)")
    
    context_parts.append("===================\n")
    
    return "\n".join(context_parts)

