"""Tool Registry - Maps database tool names to actual Python function implementations.

This registry enables dynamic tool loading from the database. Each node's 
`prompt_versions.content.tools` array contains tool names (strings) that are 
mapped to real @function_tool decorated functions via this registry.

Example database entry:
    prompt_versions.content.tools = ["verify_caller_identity", "update_lead_info"]

These names are looked up in TOOL_REGISTRY to get the actual callable functions.

Documentation Reference:
    LiveKit Docs: /agents/build/tools/#creating-tools-programmatically
    "To create a tool on the fly, use function_tool as a function rather than 
    as a decorator... This is useful to compose specific tools based on the same 
    underlying code or load them from external sources such as a database."
"""

# Import all tool functions from the tools module
from tools.lead import (
    get_lead_context,
    verify_caller_identity,
    check_consent_dnc,
    update_lead_info,
    find_broker_by_territory
)
from tools.calendar import (
    check_broker_availability,
    book_appointment,
    cancel_appointment,
    reschedule_appointment
)
from tools.knowledge import (
    search_knowledge
)
from tools.interaction import (
    save_interaction,
    assign_tracking_number,
    send_appointment_confirmation,
    verify_appointment_confirmation
)
from tools.conversation_flags import (
    mark_greeted,
    mark_ready_to_book,
    mark_has_objection,
    mark_objection_handled,
    mark_questions_answered,
    mark_qualification_result,
    mark_quote_presented,
    mark_wrong_person,
    clear_conversation_flags
)

# Registry mapping tool names (from database) to actual function implementations
# All functions are already decorated with @function_tool in their respective modules
TOOL_REGISTRY = {
    # Lead management tools (5 tools)
    "get_lead_context": get_lead_context,
    "verify_caller_identity": verify_caller_identity,
    "check_consent_dnc": check_consent_dnc,
    "update_lead_info": update_lead_info,
    "find_broker_by_territory": find_broker_by_territory,
    
    # Calendar tools (4 tools)
    "check_broker_availability": check_broker_availability,
    "book_appointment": book_appointment,
    "cancel_appointment": cancel_appointment,
    "reschedule_appointment": reschedule_appointment,
    
    # Knowledge base tool (1 tool)
    "search_knowledge": search_knowledge,
    
    # Interaction & tracking tools (4 tools)
    "save_interaction": save_interaction,
    "assign_tracking_number": assign_tracking_number,
    "send_appointment_confirmation": send_appointment_confirmation,
    "verify_appointment_confirmation": verify_appointment_confirmation,
    
    # Conversation flow flags (9 tools)
    "mark_greeted": mark_greeted,
    "mark_ready_to_book": mark_ready_to_book,
    "mark_has_objection": mark_has_objection,
    "mark_objection_handled": mark_objection_handled,
    "mark_questions_answered": mark_questions_answered,
    "mark_qualification_result": mark_qualification_result,
    "mark_quote_presented": mark_quote_presented,
    "mark_wrong_person": mark_wrong_person,
    "clear_conversation_flags": clear_conversation_flags,
}

# Total: 22 tools registered

# Export the registry
__all__ = ["TOOL_REGISTRY"]

