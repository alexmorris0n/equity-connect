"""Node completion detection for event-based routing.

This module checks if conversation nodes have met their goals based on DB state flags.
Now supports database-driven step_criteria_lk (LiveKit-optimized boolean expressions) 
with fallback to legacy step_criteria for backward compatibility.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def is_node_complete(node_name: str, state: dict, vertical: str = "reverse_mortgage", use_db_criteria: bool = True, state_row: Optional[dict] = None) -> bool:
    """Check if current node goals are met based on DB state
    
    Args:
        node_name: Name of the node to check (greet, verify, qualify, etc.)
        state: Conversation state dict from database (conversation_data)
        vertical: Business vertical (for loading step_criteria_lk from DB)
        use_db_criteria: If True, try to use step_criteria_lk from database first (with fallback to legacy step_criteria)
        state_row: Optional full state row (for checking lead_id as fallback)
        
    Returns:
        True if the node's goals are met and it's ready to transition
    """
    
    # Try to use database step_criteria if available
    if use_db_criteria:
        try:
            from services.prompt_loader import load_node_config
            from workflows.step_criteria_evaluator import evaluate_step_criteria
            
            config = load_node_config(node_name, vertical)
            
            # Try LiveKit-optimized field first (new system)
            step_criteria_lk = config.get('step_criteria_lk', '').strip()
            
            # Fallback to legacy field if new one is empty (backward compatibility)
            if not step_criteria_lk:
                step_criteria_lk = config.get('step_criteria', '').strip()
                if step_criteria_lk:
                    logger.info(f"ℹ️ Node '{node_name}' using legacy 'step_criteria' field (step_criteria_lk not yet populated)")
            
            if step_criteria_lk:
                # Evaluate step_criteria expression against conversation state
                try:
                    result = evaluate_step_criteria(step_criteria_lk, state)
                    logger.info(f"✅ Evaluated step_criteria for {node_name}: '{step_criteria_lk}' → {result}")
                    # If evaluation succeeded, return the result (but still check special cases below)
                    # We'll return after checking verify node fallbacks
                    evaluated_result = result
                except Exception as eval_error:
                    # Log detailed error information for debugging
                    logger.error(
                        f"⚠️ step_criteria evaluation FAILED for node '{node_name}'\n"
                        f"   Expression: '{step_criteria_lk}'\n"
                        f"   State keys: {list(state.keys()) if state else 'empty'}\n"
                        f"   Error: {type(eval_error).__name__}: {eval_error}\n"
                        f"   Falling back to hardcoded criteria",
                        exc_info=True
                    )
                    evaluated_result = None
            else:
                evaluated_result = None
        except Exception as e:
            logger.error(
                f"❌ Could not load step_criteria from database for node '{node_name}'\n"
                f"   Vertical: {vertical}\n"
                f"   Error: {type(e).__name__}: {e}\n"
                f"   Falling back to hardcoded criteria",
                exc_info=True
            )
            evaluated_result = None
    else:
        evaluated_result = None
    
    # Fallback to hardcoded flag-based completion (existing behavior)
    # NOTE: greet uses turn counting to prevent immediate routing
    completion_criteria = {
        "greet": lambda s: s.get("reason_captured") == True,
        "verify": lambda s: s.get("verified") == True,
        "qualify": lambda s: s.get("qualified") != None,
        "quote": lambda s: s.get("quote_presented") == True,
        "answer": lambda s: s.get("questions_answered") or s.get("ready_to_book") or s.get("has_objections"),
        "objections": lambda s: s.get("objection_handled") == True,
        "book": lambda s: s.get("appointment_booked") == True,
        "exit": lambda s: True,
    }
    
    # Use evaluated step_criteria result if available, otherwise fall back to hardcoded logic
    if evaluated_result is not None:
        result = evaluated_result
        logger.debug(f"Using step_criteria result for {node_name}: {result}")
    else:
        # Fallback to hardcoded flag-based completion (existing behavior)
        checker = completion_criteria.get(node_name)
        result = checker(state) if checker else False
        logger.debug(f"Using hardcoded completion logic for {node_name}: {result}")
    
    # FALLBACK for verify node: If lead_id exists, consider it complete
    # This handles cases where get_lead_context was called but verified flag wasn't set
    if node_name == "verify" and not result and state_row:
        lead_id = state_row.get("lead_id")
        if lead_id:
            logger.info(f"✅ Verify node complete (fallback): lead_id exists ({lead_id})")
            return True
        
        # SAFEGUARD: If verify node has been visited 3+ times, auto-complete
        # This prevents infinite loops when LLM isn't calling tools
        node_visits = state.get("node_visits") or {}
        verify_visits = node_visits.get("verify", 0)
        if verify_visits >= 3:
            logger.warning(f"⚠️ Verify node visited {verify_visits} times - auto-completing to prevent loop")
            # Set verified flag so it completes properly
            from services.conversation_state import update_conversation_state
            phone = state_row.get("phone_number")
            if phone:
                update_conversation_state(phone, {
                    "conversation_data": {
                        "verified": True
                    }
                })
            return True
    
    # DEBUG: Log completion check for verify node
    if node_name == "verify":
        node_visits = state.get("node_visits") or {}
        verify_visits = node_visits.get("verify", 0)
        logger.debug(f"🔍 Verify completion check: verified={state.get('verified')}, lead_id={state_row.get('lead_id') if state_row else None}, visits={verify_visits}, result={result}, state_keys={list(state.keys())[:10]}")
    
    return result

