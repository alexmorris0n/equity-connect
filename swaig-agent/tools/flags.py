"""
Conversation flag tools
Allow LLM to signal routing intent by setting flags in database
Per BarbGraph architecture
"""

from typing import Dict, Any
from services.database import get_conversation_state, update_conversation_state
import logging

logger = logging.getLogger(__name__)


async def handle_handoff_complete(caller_id: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle handoff to correct person - reset conversation state and route to GREET
    Used when wrong person answers initially, then correct person gets on the phone
    """
    phone = caller_id.replace('+1', '').replace('+', '')
    new_person_name = args.get('new_person_name', '')
    
    logger.info(f"[HANDOFF] Completing handoff to correct person: {new_person_name} for {phone}")
    
    # Reset conversation state for fresh start with correct person
    success = await update_conversation_state(phone, {
        "conversation_data": {
            "wrong_person": False,
            "right_person_available": True,
            "greeted": False,  # Reset to greet the correct person
            "handoff_complete": True,
            "correct_person_name": new_person_name
        },
        "current_node": "greet"
    })
    
    if success:
        logger.info(f"[HANDOFF] Successfully reset state for {phone}, routing to GREET")
        return {
            "response": f"Great! Now speaking with {new_person_name}. Starting fresh.",
            "action": [{"route_to": "greet"}]
        }
    
    return {"response": "Error completing handoff"}


async def handle_flag_update(caller_id: str, function_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle flag update functions (mark_greeted, mark_verified, etc.)
    Updates conversation_data JSONB field
    """
    phone = caller_id.replace('+1', '').replace('+', '')
    
    # Get current state
    state = await get_conversation_state(phone)
    if not state:
        return {"response": "Error: Could not find conversation state"}
    
    # Map function names to flag names
    # Support both mark_qualified (bridge name) and mark_qualification_result (Vue/database name)
    flag_map = {
        "mark_greeted": "greeted",
        "mark_verified": "verified",
        "mark_qualified": "qualified",
        "mark_qualification_result": "qualified",  # Vue/database uses this name
        "mark_quote_presented": "quote_presented",
        "mark_ready_to_book": "ready_to_book",
        "mark_has_objection": "has_objection",
        "mark_objection_handled": "objection_handled",
        "mark_questions_answered": "questions_answered",
        "mark_wrong_person": "wrong_person",  # Added for LiveKit compatibility
        "mark_handoff_complete": "handoff_complete",  # Handle wrong person → correct person
    }
    
    flag_name = flag_map.get(function_name)
    if not flag_name:
        return {"response": f"Unknown flag function: {function_name}"}
    
    # Build conversation_data update
    conversation_data_update = {}
    
    # Handle special cases
    if function_name in ["mark_qualified", "mark_qualification_result"]:
        # Also update top-level qualified field
        qualified_value = args.get("qualified", False)
        await update_conversation_state(phone, {"qualified": qualified_value})
        conversation_data_update["qualified"] = qualified_value
        # Optional disqualification reason
        reason = args.get("reason")
        if reason and qualified_value is False:
            conversation_data_update["disqualified_reason"] = reason
    
    elif function_name == "mark_quote_presented":
        # Simple flag - quote was presented
        conversation_data_update["quote_presented"] = True
    
    elif function_name == "mark_has_objection":
        conversation_data_update["has_objection"] = True
        # Capture objection type if provided
        if "objection_type" in args and isinstance(args.get("objection_type"), str):
            conversation_data_update["objection_type"] = args.get("objection_type")
        # Store current node to return to later
        current_node = state.get("current_node", "answer")
        conversation_data_update["node_before_objection"] = current_node
    
    elif function_name == "mark_greeted":
        # Mark greeted and capture reason summary if provided
        conversation_data_update["greeted"] = args.get("greeted", True)
        if "reason_summary" in args and isinstance(args.get("reason_summary"), str):
            conversation_data_update["reason_summary"] = args.get("reason_summary")
    
    elif function_name == "mark_wrong_person":
        conversation_data_update["wrong_person"] = args.get("wrong_person", True)
        if "right_person_available" in args:
            conversation_data_update["right_person_available"] = args["right_person_available"]
    
    elif function_name == "mark_handoff_complete":
        # Special case: Use dedicated handler
        return await handle_handoff_complete(caller_id, args)
    
    else:
        # Simple boolean flag
        flag_value = args.get(flag_name, True)
        conversation_data_update[flag_name] = flag_value
    
    # Update database
    success = await update_conversation_state(phone, {
        "conversation_data": conversation_data_update
    })
    
    if success:
        logger.info(f"[FLAGS] Updated {flag_name} for {phone}")
        
        # Return confirmation message
        confirmations = {
            "mark_greeted": "Greeting completed",
            "mark_verified": "Caller verified",
            "mark_qualified": "Qualification status updated",
            "mark_quote_presented": "Quote presented",
            "mark_ready_to_book": "Caller ready to book",
            "mark_has_objection": "Objection noted",
            "mark_objection_handled": "Objection handled",
            "mark_questions_answered": "Questions answered",
            "mark_wrong_person": "Wrong person noted",
            "mark_handoff_complete": "Handoff complete",
        }
        
        return {
            "response": confirmations.get(function_name, "Flag updated"),
            "action": []  # Routing will happen via route_conversation function
        }
    
    return {"response": "Error updating flag"}

