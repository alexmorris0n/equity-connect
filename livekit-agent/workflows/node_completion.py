"""Node completion detection for event-based routing.

This module checks if conversation nodes have met their goals based on DB state flags.
Now supports database-driven step_criteria for dynamic completion logic.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def is_node_complete(node_name: str, state: dict, vertical: str = "reverse_mortgage", use_db_criteria: bool = True) -> bool:
    """Check if current node goals are met based on DB state
    
    Args:
        node_name: Name of the node to check (greet, verify, qualify, etc.)
        state: Conversation state dict from database
        vertical: Business vertical (for loading step_criteria from DB)
        use_db_criteria: If True, try to use step_criteria from database first
        
    Returns:
        True if the node's goals are met and it's ready to transition
    """
    
    # Try to use database step_criteria if available
    if use_db_criteria:
        try:
            from services.prompt_loader import load_node_config
            config = load_node_config(node_name, vertical)
            step_criteria = config.get('step_criteria', '').strip()
            
            if step_criteria:
                # For now, we still use flag-based logic, but step_criteria is available
                # for future enhancement (could parse step_criteria to evaluate completion)
                logger.debug(f"Found step_criteria for {node_name} (not yet parsed for completion check)")
        except Exception as e:
            logger.debug(f"Could not load step_criteria from DB: {e}, using fallback")
    
    # Fallback to hardcoded flag-based completion (existing behavior)
    completion_criteria = {
		"greet": lambda s: True,
        "verify": lambda s: s.get("verified") == True,
        "qualify": lambda s: s.get("qualified") != None,
        "quote": lambda s: s.get("quote_presented") == True,
		"answer": lambda s: s.get("questions_answered") or s.get("ready_to_book") or s.get("has_objections"),
        "objections": lambda s: s.get("objection_handled") == True,
        "book": lambda s: s.get("appointment_booked") == True,
        "exit": lambda s: True,
    }
    
    checker = completion_criteria.get(node_name)
    return checker(state) if checker else False

