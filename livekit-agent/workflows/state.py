"""LangGraph conversation state schema"""
from typing import TypedDict, Optional, List, Annotated
from datetime import datetime
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class ConversationState(TypedDict, total=False):
    """
    Shared state across all nodes in the conversation graph.
    
    This state is updated as the conversation progresses and is used
    by routing functions to determine which node to execute next.
    
    CRITICAL: The 'messages' field uses add_messages reducer to append messages
    automatically as the conversation progresses (per LangGraph pattern).
    """
    
    # Messages (required by LiveKit LLMAdapter - uses add_messages reducer)
    messages: Annotated[List[BaseMessage], add_messages]
    
    # Call Context
    call_type: str  # "inbound-qualified", "inbound-unqualified", "inbound-unknown", "outbound-warm", "outbound-cold"
    room_name: str
    participant_identity: str
    
    # Lead Information
    lead_id: Optional[str]  # UUID if found in database
    caller_name: Optional[str]
    phone_number: Optional[str]
    is_new_lead: bool
    
    # Qualification Status
    qualified: bool
    age_verified: bool
    homeowner: bool
    age: Optional[int]
    has_existing_mortgage: Optional[bool]
    estimated_home_value: Optional[int]
    disqualification_reason: Optional[str]
    
    # Conversation Flow
    caller_engaged: bool  # Responded positively to greeting
    expressed_interest: bool  # Wants to learn more/book
    expressed_interest_in_booking: bool  # Ready to schedule
    ready_to_book: bool
    requested_callback: bool
    wants_email_first: bool
    
    # Questions & Objections
    questions_answered: int
    topics_covered: List[str]  # ["costs", "heirs", "process", etc.]
    has_objections: bool
    objections_raised: List[str]
    objections_resolved: bool
    needs_specialist_callback: bool
    
    # Appointment/Outcome
    appointment_booked: bool
    appointment_datetime: Optional[datetime]
    broker_id: Optional[str]
    booking_method: Optional[str]  # "immediate", "callback_requested", "email_requested"
    confirmation_sent: bool
    
    # Final State
    call_outcome: Optional[str]  # "booked", "callback", "email", "not_qualified", "not_interested", "bad_timing"
    call_ended: bool
    interaction_saved: bool

