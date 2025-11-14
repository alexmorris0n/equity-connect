"""
SignalWire Contexts Builder

Builds the contexts object for SignalWire's native state machine from database prompts.
Each context corresponds to a BarbGraph node (greet, verify, qualify, etc.).
Each context contains steps loaded from the database.

This replaces:
- routers.py (routing logic now in valid_contexts)
- node_completion.py (completion logic now in step_criteria)
- Manual prompt concatenation (SignalWire handles it)
"""

import logging
from typing import Dict, List, Optional
from equity_connect.services.supabase import get_supabase_client
from equity_connect.services.default_contexts import DEFAULT_CONTEXTS, get_default_context

logger = logging.getLogger(__name__)


def build_contexts_object(
    vertical: str = "reverse_mortgage",
    initial_context: str = "greet",
    lead_context: Optional[dict] = None
) -> Dict:
    """Build complete contexts object from database
    
    Queries the database for all contexts/steps for a vertical and constructs
    the SignalWire contexts object ready for agent.set_prompt().
    
    Args:
        vertical: Business vertical (reverse_mortgage, solar, hvac)
        initial_context: Which context to make "default" (for initial entry)
        lead_context: Lead data for variable injection (optional)
        
    Returns:
        {
            "default": {...},  # Points to initial_context
            "greet": {...},
            "verify": {...},
            ...
        }
    """
    
    logger.info(f"🏗️  Building contexts for {vertical}, initial: {initial_context}")
    
    # Query database for all contexts and their steps
    contexts_data = _query_contexts_from_db(vertical)
    
    if not contexts_data:
        logger.error(f"❌ No contexts found for vertical: {vertical}")
        raise ValueError(f"No contexts configured for vertical: {vertical}")
    
    # Backfill contexts that are missing or have no steps with default v1 definitions
    fallback_applied = []
    for ctx_name in DEFAULT_CONTEXTS.keys():
        if ctx_name not in contexts_data or not contexts_data[ctx_name]["steps"]:
            contexts_data[ctx_name] = get_default_context(ctx_name)
            fallback_applied.append(ctx_name)
    
    if fallback_applied:
        logger.warning(f"⚠️ Applied default v1 prompts for contexts: {fallback_applied}")
    
    # Filter out contexts that still have no steps (should not happen, but guard anyway)
    empty_contexts = [name for name, config in contexts_data.items() if not config["steps"]]
    if empty_contexts:
        logger.warning(f"⚠️ Skipping contexts with no active prompts: {empty_contexts}")
    
    contexts_with_steps = {name: cfg for name, cfg in contexts_data.items() if cfg["steps"]}
    
    if not contexts_with_steps:
        logger.error("❌ No contexts with steps available after filtering. Check prompt versions.")
        raise ValueError("No contexts contain steps. Ensure each node has an active prompt version.")
    
    # Build contexts object
    contexts_obj = {}
    
    # Add "default" context (required by SignalWire)
    contexts_obj["default"] = _build_default_context(initial_context)
    
    # Add each context (greet, verify, qualify, etc.) that has steps
    for context_name, context_config in contexts_with_steps.items():
        contexts_obj[context_name] = _build_context(context_name, context_config)
    
    logger.info(f"✅ Built {len(contexts_obj)} contexts: {list(contexts_obj.keys())}")
    
    return contexts_obj


def _query_contexts_from_db(vertical: str) -> Dict:
    """Query database for all contexts and their steps
    
    Returns:
        {
            "greet": {
                "steps": [...],
                "isolated": False,
                "valid_contexts": ["verify", "exit"]
            },
            "verify": {...},
            ...
        }
    """
    
    # Query prompts table for this vertical
    supabase = get_supabase_client()
    response = supabase.table('prompts') \
        .select('*, prompt_versions!inner(*)') \
        .eq('vertical', vertical) \
        .execute()
    
    if not response.data:
        return {}
    
    # Group by context name (node_name in old schema)
    contexts_data = {}
    
    for prompt in response.data:
        context_name = prompt['node_name']  # e.g., "greet", "verify"
        
        if context_name not in contexts_data:
            contexts_data[context_name] = {
                "steps": [],
                "isolated": False,  # TODO: Load from contexts_config table
                "valid_contexts": []  # Will be populated from steps
            }
        
        # Get active version
        active_version = next(
            (v for v in prompt['prompt_versions'] if v['is_active']),
            None
        )
        
        if not active_version:
            continue
        
        content = active_version['content']
        
        # Build step object - CRITICAL: Map 'tools' field to 'functions' array
        step = {
            "name": prompt.get('step_name', 'main'),  # Default step name
            "text": content.get('instructions', ''),
            "step_criteria": content.get('step_criteria', 'User has responded appropriately.'),
            "functions": content.get('tools', [])  # ← READ "tools" FROM DB, OUTPUT AS "functions"
        }
        
        # Add valid_steps if present
        if content.get('valid_steps'):
            step['valid_steps'] = content['valid_steps']
        
        # Add valid_contexts if present
        if content.get('valid_contexts'):
            step['valid_contexts'] = content['valid_contexts']
            # Track at context level too
            contexts_data[context_name]['valid_contexts'].extend(content['valid_contexts'])
        
        contexts_data[context_name]['steps'].append(step)
    
    # Deduplicate valid_contexts at context level
    for context in contexts_data.values():
        context['valid_contexts'] = list(set(context['valid_contexts']))
    
    return contexts_data


def _build_default_context(initial_context: str) -> Dict:
    """Build the required 'default' context that routes to initial context
    
    SignalWire requires a "default" context as the entry point.
    We use it to route immediately to the actual initial context.
    
    Args:
        initial_context: Context name to route to (e.g., "greet", "answer")
        
    Returns:
        Context object with single routing step
    """
    
    return {
        "steps": [
            {
                "name": "route_to_initial",
                "text": f"Route immediately to the {initial_context} context.",
                "step_criteria": "Routing complete.",
                "valid_contexts": [initial_context],
                "skip_user_turn": True  # Don't wait for user, just route
            }
        ]
    }


def _build_context(context_name: str, context_config: Dict) -> Dict:
    """Build a single context object from config
    
    Args:
        context_name: Name of context (greet, verify, etc.)
        context_config: Config from database with steps, isolated, valid_contexts, etc.
        
    Returns:
        Context object ready for SignalWire
    """
    
    context = {
        "steps": context_config['steps']
    }
    
    # Add valid_contexts for routing (CRITICAL for context transitions)
    if context_config.get('valid_contexts'):
        context['valid_contexts'] = context_config['valid_contexts']
    
    # Add isolated flag if true (resets conversation history)
    if context_config.get('isolated'):
        context['isolated'] = True
    
    # Add transition fillers if present
    if context_config.get('enter_fillers'):
        context['enter_fillers'] = context_config['enter_fillers']
    
    if context_config.get('exit_fillers'):
        context['exit_fillers'] = context_config['exit_fillers']
    
    return context


def load_theme(vertical: str) -> str:
    """Load theme prompt for vertical
    
    Theme is the universal personality prompt applied across all contexts.
    
    Args:
        vertical: Business vertical (reverse_mortgage, solar, hvac)
        
    Returns:
        Theme text content
    """
    
    supabase = get_supabase_client()
    response = supabase.table('theme_prompts') \
        .select('content') \
        .eq('vertical', vertical) \
        .eq('is_active', True) \
        .single() \
        .execute()
    
    if not response.data:
        logger.error(f"❌ No theme found for vertical: {vertical}")
        raise ValueError(f"No theme found for vertical: {vertical}")
    
    return response.data['content']

