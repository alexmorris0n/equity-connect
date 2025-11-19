"""
Build SignalWire contexts structure from database
Implements native SignalWire context switching per docs/SignalWire Promp Context.md
"""

from typing import Dict, Any, List, Optional
from services.database import get_node_prompt, get_theme_prompt, get_node_config
from services.prompts import build_context_injection
import logging

logger = logging.getLogger(__name__)

# All 8 nodes in order
ALL_NODES = ["greet", "verify", "qualify", "quote", "answer", "objections", "book", "goodbye", "end"]


async def build_contexts_structure(
    lead_context: Optional[Dict[str, Any]] = None,
    phone_number: Optional[str] = None,
    vertical: str = "reverse_mortgage",
    starting_node: str = "greet"
) -> Dict[str, Any]:
    """
    Build complete SignalWire contexts structure from database
    
    Returns:
    {
        "default": {  # Starting context
            "steps": [...]
        },
        "greet": {
            "steps": [...]
        },
        "verify": {
            "steps": [...]
        },
        ...
    }
    """
    # Load theme (universal personality)
    theme = await get_theme_prompt(vertical)
    
    # Build context injection (caller info)
    context_block = ""
    if lead_context and phone_number:
        context_block = build_context_injection(lead_context, phone_number, "inbound")
    
    # Build all contexts
    contexts = {}
    
    for node_name in ALL_NODES:
        # Load full node configuration from database (instructions, valid_contexts, functions)
        node_config = await get_node_config(node_name, vertical)
        
        if not node_config:
            logger.warning(f"[CONTEXTS] No config found for node: {node_name}, using fallback")
            node_instructions = f"You are Barbara. Continue the conversation naturally in the {node_name} stage."
            valid_contexts = get_valid_contexts_for_node(node_name)  # Fallback to hardcoded
            functions = get_functions_for_node(node_name)  # Fallback to hardcoded
        else:
            node_instructions = node_config.get('instructions', '')
            # Load valid_contexts from database (fallback to hardcoded if missing)
            valid_contexts = node_config.get('valid_contexts') or get_valid_contexts_for_node(node_name)
            # Load functions from database (fallback to hardcoded if missing)
            functions = node_config.get('functions') or get_functions_for_node(node_name)
        
        # Combine: Theme → Context → Node Instructions
        full_prompt_parts = []
        if theme:
            full_prompt_parts.append(theme)
        if context_block:
            full_prompt_parts.append(context_block)
        if node_instructions:
            full_prompt_parts.append(node_instructions)
        
        full_prompt = "\n\n".join(full_prompt_parts)
        
        # Build step for this context
        step = {
            "name": "main",
            "text": full_prompt,
            "valid_contexts": valid_contexts
        }
        
        # Add functions available in this node (from database)
        if functions:
            step["functions"] = functions
        
        # Add step_criteria if available in database
        if node_config and node_config.get('step_criteria'):
            step["step_criteria"] = node_config.get('step_criteria')
        
        # Set as default if it's the starting node
        if node_name == starting_node:
            contexts["default"] = {
                "steps": [step]
            }
        else:
            contexts[node_name] = {
                "steps": [step]
            }
        
        logger.info(f"[CONTEXTS] Built context '{node_name}' with {len(valid_contexts)} valid transitions")
    
    logger.info(f"[CONTEXTS] Built {len(contexts)} contexts (default: {starting_node})")
    return contexts


def get_valid_contexts_for_node(node_name: str) -> List[str]:
    """
    Get valid context transitions for a node
    Based on BarbGraph routing logic
    """
    routing_map = {
        "greet": ["verify", "answer", "goodbye"],
        "verify": ["qualify", "answer", "goodbye"],
        "qualify": ["quote", "goodbye", "answer"],
        "quote": ["answer", "book", "goodbye"],
        "answer": ["objections", "book", "goodbye"],
        "objections": ["answer", "book", "goodbye"],
        "book": ["goodbye"],
        "goodbye": ["end"],
        "end": []  # Terminal
    }
    
    return routing_map.get(node_name, [])


def get_functions_for_node(node_name: str) -> List[str]:
    """
    Get available SWAIG functions for a node
    """
    function_map = {
        "greet": ["mark_greeted", "route_conversation"],
        "verify": ["mark_verified", "route_conversation"],
        "qualify": ["mark_qualified", "route_conversation"],
        "quote": ["mark_quote_presented", "calculate_reverse_mortgage", "route_conversation"],
        "answer": ["search_knowledge", "mark_ready_to_book", "route_conversation"],
        "objections": ["search_knowledge", "mark_ready_to_book", "route_conversation"],
        "book": ["book_appointment", "mark_ready_to_book", "route_conversation"],
        "goodbye": ["route_conversation"],
        "end": []
    }
    
    return function_map.get(node_name, [])

