"""Tools module - Export all business tools for LiveKit agent"""
from .lead import (
    get_lead_context,
    check_consent_dnc,
    update_lead_info,
    find_broker_by_territory
)
from .calendar import (
    check_broker_availability,
    book_appointment,
    cancel_appointment,
    reschedule_appointment
)
from .knowledge import search_knowledge
from .interaction import (
    save_interaction,
    assign_tracking_number,
    send_appointment_confirmation,
    verify_appointment_confirmation
)

# Export all tools as a list for the agent
__all__ = [
    # Lead management
    "get_lead_context",
    "check_consent_dnc",
    "update_lead_info",
    "find_broker_by_territory",
    # Calendar
    "check_broker_availability",
    "book_appointment",
    "cancel_appointment",
    "reschedule_appointment",
    # Knowledge
    "search_knowledge",
    # Interaction & tracking
    "save_interaction",
    "assign_tracking_number",
    "send_appointment_confirmation",
    "verify_appointment_confirmation",
]

# List of all tools for easy import
all_tools = [
    get_lead_context,
    check_consent_dnc,
    update_lead_info,
    find_broker_by_territory,
    check_broker_availability,
    book_appointment,
    cancel_appointment,
    reschedule_appointment,
    search_knowledge,
    save_interaction,
    assign_tracking_number,
    send_appointment_confirmation,
    verify_appointment_confirmation,
]
