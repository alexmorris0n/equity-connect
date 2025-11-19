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
from equity_connect.services.default_contexts import DEFAULT_CONTEXTS

logger = logging.getLogger(__name__)


def build_contexts_object(
    vertical: str = "reverse_mortgage",
    initial_context: str = "greet",
    lead_context: Optional[dict] = None,
    use_draft: bool = False
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
    
    logger.warning(f"🏗️  [STARTUP] Building contexts for {vertical}, initial: {initial_context}")
    
    # Query database for all contexts and their steps
    contexts_data = _query_contexts_from_db(vertical, use_draft=use_draft, lead_context=lead_context)
    
    logger.warning(f"🏗️  [STARTUP] Loaded {len(contexts_data)} contexts from database: {list(contexts_data.keys())}")
    
    if not contexts_data:
        logger.error(f"❌ No contexts found for vertical: {vertical}")
        raise ValueError(f"No contexts configured for vertical: {vertical}")
    
    # Validate all required contexts exist and have at least one step
    missing_contexts = [ctx for ctx in DEFAULT_CONTEXTS.keys() if ctx not in contexts_data]
    empty_contexts = [name for name, config in contexts_data.items() if not config["steps"]]
    
    if missing_contexts or empty_contexts:
        logger.error(
            "❌ Context validation failed. Missing contexts: %s | Empty contexts: %s",
            missing_contexts or [],
            empty_contexts or []
        )
        raise ValueError(
            "Contexts validation failed. "
            f"Missing contexts: {missing_contexts or 'none'} | "
            f"Empty contexts: {empty_contexts or 'none'}"
        )
    
    contexts_with_steps = contexts_data
    
    # Build contexts object
    contexts_obj = {}
    
    # Add "default" context (required by SignalWire)
    contexts_obj["default"] = _build_default_context(initial_context)
    
    # Add each context (greet, verify, qualify, etc.) that has steps
    for context_name, context_config in contexts_with_steps.items():
            contexts_obj[context_name] = _build_context(context_name, context_config)
    
    # DIAGNOSTIC: Log payload size and validate JSON structure
    import json
    try:
        contexts_json = json.dumps(contexts_obj)
        contexts_size = len(contexts_json.encode('utf-8'))
        logger.info(f"[PAYLOAD] Contexts object size: {contexts_size:,} bytes ({contexts_size/1024:.2f} KB)")
        
        if contexts_size > 50 * 1024:
            logger.warning(f"[PAYLOAD] WARNING: Contexts payload exceeds 50 KB - close to 64 KB limit!")
        elif contexts_size > 60 * 1024:
            logger.error(f"[PAYLOAD] ERROR: Contexts payload exceeds 60 KB - may cause hangups!")
        
        # Log size per context
        for ctx_name, ctx_config in contexts_obj.items():
            ctx_json = json.dumps(ctx_config)
            ctx_size = len(ctx_json.encode('utf-8'))
            if ctx_size > 5 * 1024:
                logger.warning(f"[PAYLOAD] Context '{ctx_name}': {ctx_size:,} bytes ({ctx_size/1024:.2f} KB) - large!")
            else:
                logger.info(f"[PAYLOAD] Context '{ctx_name}': {ctx_size:,} bytes ({ctx_size/1024:.2f} KB)")
        
        logger.info("[PAYLOAD] Contexts JSON structure is valid")
    except Exception as e:
        logger.error(f"[PAYLOAD] ERROR: Contexts JSON validation failed: {e}")
        logger.error(f"[PAYLOAD] This will cause serialization failures and hangups!")
        raise ValueError(f"Contexts JSON structure is invalid: {e}") from e
    
    logger.info(f"✅ Built {len(contexts_obj)} contexts: {list(contexts_obj.keys())}")
    
    # DIAGNOSTIC: Log final valid_contexts for each context
    for ctx_name, ctx_config in contexts_with_steps.items():
        final_valid = ctx_config.get('valid_contexts', [])
        logger.info(f"🔍 [FINAL CONFIG] Context '{ctx_name}': final valid_contexts = {final_valid}")
    
    return contexts_obj


def _query_contexts_from_db(vertical: str, use_draft: bool = False, lead_context: Optional[dict] = None) -> Dict:
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
        
        draft_version = next(
            (v for v in prompt['prompt_versions'] if v.get('is_draft')),
            None
        )
        active_version = next(
            (v for v in prompt['prompt_versions'] if v.get('is_active')),
            None
        )
        
        version_to_use = draft_version if use_draft and draft_version else active_version
        
        if not version_to_use:
            continue
        
        content = version_to_use['content']
        
        # Get the raw prompt template
        prompt_template = content.get('instructions', '')
        
        # Substitute variables if lead_context provided
        if lead_context:
            from string import Template
            
            # Prepare template variables with safe fallbacks
            # Get conversation_data for dynamic state variables
            conversation_data = lead_context.get('conversation_data', {})
            
            template_vars = {
                'first_name': lead_context.get('first_name') or "there",
                'last_name': lead_context.get('last_name') or "",
                'full_name': lead_context.get('name') or "Unknown",
                'lead_phone': lead_context.get('primary_phone') or lead_context.get('phone') or "",
                'lead_email': lead_context.get('primary_email') or lead_context.get('email') or "",
                'lead_age': lead_context.get('age') or "",
                'broker_name': lead_context.get('broker_name') or "your mortgage advisor",
                'broker_company': lead_context.get('broker_company') or "our team",
                'broker_phone': lead_context.get('broker_phone') or "",
                'broker_email': lead_context.get('broker_email') or "",
                'property_address': lead_context.get('property_address') or "your property",
                'property_city': lead_context.get('property_city') or "your area",
                'property_state': lead_context.get('property_state') or "",
                'property_zip': lead_context.get('property_zip') or "",
                'property_value': lead_context.get('property_value') or "",
                'estimated_equity': lead_context.get('estimated_equity') or "",
                'qualified': str(lead_context.get('qualified', False)).lower(),
                'call_direction': lead_context.get('call_direction') or "inbound",
                'quote_presented': str(conversation_data.get('quote_presented', False)).lower(),
                'verified': str(conversation_data.get('verified', False)).lower(),
                # Dynamic state variables (from conversation_data)
                'appointment_booked': str(conversation_data.get('appointment_booked', False)).lower(),
                'ready_to_book': str(conversation_data.get('ready_to_book', False)).lower(),
            }
            
            prompt_text = Template(prompt_template).safe_substitute(template_vars)
            logger.info(f"[SUBSTITUTED] Prompt for {context_name} (first 150 chars): {prompt_text[:150]}...")
        else:
            # No lead context - use template as-is
            prompt_text = prompt_template
            logger.info(f"[RAW] Prompt for {context_name} with $variables (first 150 chars): {prompt_text[:150] if prompt_text else 'empty'}...")
        
        # Build step object - CRITICAL: Map 'tools' field to 'functions' array
        step = {
            "name": prompt.get('step_name', 'main'),  # Default step name
            "text": prompt_text,  # ← Substituted text with actual values
            "step_criteria": content.get('step_criteria', 'User has responded appropriately.'),
            "functions": content.get('tools', [])  # ← READ "tools" FROM DB, OUTPUT AS "functions"
        }
        
        # CRITICAL: Default to False (wait for user) if not explicitly set
        # This prevents tools from being called before greeting
        # Convert string "false"/"true" to boolean (JSONB stores as strings)
        skip_user_turn_raw = content.get('skip_user_turn', False)
        if isinstance(skip_user_turn_raw, str):
            step['skip_user_turn'] = skip_user_turn_raw.lower() in ('true', '1', 'yes')
        else:
            step['skip_user_turn'] = bool(skip_user_turn_raw)
        
        # Add valid_steps if present
        if content.get('valid_steps'):
            step['valid_steps'] = content['valid_steps']
        
        # Add valid_contexts if present
        if content.get('valid_contexts'):
            valid_ctx_list = content['valid_contexts']
            
            # CRITICAL FIX: Prevent "Racing to Exit" across ALL contexts
            # Only BOOK and OBJECTIONS should naturally route to goodbye/end
            # All other contexts must wait for explicit tool-driven routing
            if context_name not in ['book', 'objections', 'goodbye']:
                original_len = len(valid_ctx_list)
                original_list = valid_ctx_list.copy()
                valid_ctx_list = [ctx for ctx in valid_ctx_list if ctx not in ['goodbye', 'end']]
                if len(valid_ctx_list) < original_len:
                    logger.warning(f"[ANTI-RACE] STEP-LEVEL {context_name.upper()}: Removed goodbye/end from {original_list} → {valid_ctx_list}")
                elif 'goodbye' in original_list or 'end' in original_list:
                    logger.error(f"[ANTI-RACE] ERROR: Filter should have removed goodbye/end but didn't! Original: {original_list}, Filtered: {valid_ctx_list}")
            
            step['valid_contexts'] = valid_ctx_list
            # Track at context level too
            contexts_data[context_name]['valid_contexts'].extend(valid_ctx_list)
        
        contexts_data[context_name]['steps'].append(step)
    
    # Deduplicate valid_contexts at context level
    for context_name, context in contexts_data.items():
        context['valid_contexts'] = list(set(context['valid_contexts']))
        
        # CRITICAL: Apply anti-racing filter to context-level valid_contexts too
        # Context-level valid_contexts can override step-level restrictions
        if context_name not in ['book', 'objections', 'goodbye']:
            original_len = len(context['valid_contexts'])
            original_list = context['valid_contexts'].copy()
            context['valid_contexts'] = [ctx for ctx in context['valid_contexts'] if ctx not in ['goodbye', 'end']]
            if len(context['valid_contexts']) < original_len:
                logger.warning(f"[ANTI-RACE] CONTEXT-LEVEL {context_name.upper()}: Removed goodbye/end from {original_list} → {context['valid_contexts']}")
            elif 'goodbye' in original_list or 'end' in original_list:
                logger.error(f"[ANTI-RACE] ERROR: Context-level filter should have removed goodbye/end but didn't! Original: {original_list}, Filtered: {context['valid_contexts']}")
    
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
				"text": "You are Barbara, a professional assistant. Follow the context instructions carefully.",
				"step_criteria": "Route immediately to the initial context.",  # Valid criteria string
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


def load_theme(vertical: str, use_draft: bool = False, lead_context: Optional[dict] = None) -> str:
    """Load theme prompt for vertical with optional variable substitution
    
    Theme is the universal personality prompt applied across all contexts.
    
    Args:
        vertical: Business vertical (reverse_mortgage, solar, hvac)
        use_draft: Load draft version if True
        lead_context: Optional lead data for variable substitution
        
    Returns:
        Theme text content (with variables substituted if lead_context provided)
    """
    
    supabase = get_supabase_client()
    
    # Load theme content (draft or active)
    if use_draft:
        draft_response = supabase.table('theme_prompts') \
            .select('content') \
            .eq('vertical', vertical) \
            .eq('is_draft', True) \
            .order('updated_at', desc=True) \
            .limit(1) \
            .execute()
        
        if not draft_response.data:
            logger.error(f"❌ No draft theme found for vertical: {vertical}")
            raise ValueError(f"No draft theme found for vertical: {vertical}")
    
        theme_content = draft_response.data[0]['content']
    else:
        response = supabase.table('theme_prompts') \
            .select('content') \
            .eq('vertical', vertical) \
            .eq('is_active', True) \
            .single() \
            .execute()
        
        if not response.data:
            logger.error(f"❌ No theme found for vertical: {vertical}")
            raise ValueError(f"No theme found for vertical: {vertical}")
        
        theme_content = response.data['content']
    
    # Substitute variables if lead_context provided
    if lead_context:
        from string import Template
        
        # Get conversation_data for dynamic state variables
        conversation_data = lead_context.get('conversation_data', {})
        
        # Prepare template variables with safe fallbacks
        template_vars = {
            'first_name': lead_context.get('first_name') or "there",
            'last_name': lead_context.get('last_name') or "",
            'full_name': lead_context.get('name') or "Unknown",
            'lead_phone': lead_context.get('primary_phone') or lead_context.get('phone') or "",
            'lead_email': lead_context.get('primary_email') or lead_context.get('email') or "",
            'lead_age': lead_context.get('age') or "",
            'broker_name': lead_context.get('broker_name') or "your mortgage advisor",
            'broker_company': lead_context.get('broker_company') or "our team",
            'broker_phone': lead_context.get('broker_phone') or "",
            'broker_email': lead_context.get('broker_email') or "",
            'property_address': lead_context.get('property_address') or "your property",
            'property_city': lead_context.get('property_city') or "your area",
            'property_state': lead_context.get('property_state') or "",
            'property_zip': lead_context.get('property_zip') or "",
            'property_value': lead_context.get('property_value') or "",
            'estimated_equity': lead_context.get('estimated_equity') or "",
            'qualified': str(lead_context.get('qualified', False)).lower(),
            'call_direction': lead_context.get('call_direction') or "inbound",
            'quote_presented': str(conversation_data.get('quote_presented', False)).lower(),
            'verified': str(conversation_data.get('verified', False)).lower(),
            # Dynamic state variables (from conversation_data)
            'appointment_booked': str(conversation_data.get('appointment_booked', False)).lower(),
            'ready_to_book': str(conversation_data.get('ready_to_book', False)).lower(),
        }
        
        theme_text = Template(theme_content).safe_substitute(template_vars)
        logger.info(f"[OK] Loaded theme for {vertical} and substituted variables")
        return theme_text
    else:
        # No lead context - return template as-is
        logger.info(f"[OK] Loaded theme for {vertical} with $variables intact")
        return theme_content


