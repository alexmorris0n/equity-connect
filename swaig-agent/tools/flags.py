"""
Conversation flag tools
Allow LLM to signal routing intent by setting flags in database
Per BarbGraph architecture
"""

from typing import Dict, Any
from services.database import get_conversation_state, update_conversation_state
import logging

logger = logging.getLogger(__name__)


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
    
    elif function_name == "mark_quote_presented":
        conversation_data_update["quote_presented"] = args.get("quote_presented", True)
        if "quote_reaction" in args:
            conversation_data_update["quote_reaction"] = args["quote_reaction"]
    
    elif function_name == "mark_has_objection":
        conversation_data_update["has_objection"] = True
        # Store current node to return to later
        current_node = state.get("current_node", "answer")
        conversation_data_update["node_before_objection"] = current_node
    
    elif function_name == "mark_wrong_person":
        conversation_data_update["wrong_person"] = args.get("wrong_person", True)
        if "right_person_available" in args:
            conversation_data_update["right_person_available"] = args["right_person_available"]
    
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
        }
        
        return {
            "response": confirmations.get(function_name, "Flag updated"),
            "action": []  # Routing will happen via route_conversation function
        }
    
    return {"response": "Error updating flag"}

