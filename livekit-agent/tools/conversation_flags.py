"""Tools for managing conversation state flags that control node routing.

These tools allow the LLM to signal intent (booking readiness, objections, etc.)
which triggers dynamic routing between conversation nodes.
"""

import logging
from livekit.agents.llm import function_tool
from services.conversation_state import update_conversation_state

logger = logging.getLogger(__name__)


@function_tool
async def mark_ready_to_book(phone: str) -> str:
    """Mark that the caller is ready to schedule an appointment.
    
    Use this when the caller:
    - Explicitly says they want to book/schedule
    - Has asked about availability
    - Seems interested and qualified
    
    Args:
        phone: Caller's phone number
    
    Returns:
        Confirmation message
    """
    logger.info(f"🎯 Marking caller ready to book: {phone}")
    
    update_conversation_state(phone, {
        "conversation_data": {
            "ready_to_book": True,
            "questions_answered": True,  # Implicit - they're satisfied enough to book
        }
    })
    
    return "Caller marked as ready to book. Transition to booking node will occur."


@function_tool
async def mark_has_objection(phone: str, objection_type: str) -> str:
    """Mark that the caller has raised an objection or concern.
    
    Use this when the caller:
    - Expresses doubt or hesitation
    - Raises concerns about cost, eligibility, or process
    - Asks "what if" questions that show resistance
    
    Args:
        phone: Caller's phone number
        objection_type: Type of objection (cost, eligibility, trust, timing, family, etc.)
    
    Returns:
        Confirmation message
    """
    logger.info(f"⚠️ Objection raised: {objection_type} for {phone}")
    
    update_conversation_state(phone, {
        "conversation_data": {
            "has_objections": True,
            "last_objection_type": objection_type,
            "node_before_objection": "answer",  # Track where we came from for resumption
        }
    })
    
    return f"Objection marked: {objection_type}. Will route to objection handling."


@function_tool
async def mark_objection_handled(phone: str) -> str:
    """Mark that an objection has been successfully addressed.
    
    Use this when:
    - The caller seems satisfied with your response
    - They say "okay", "that makes sense", "I understand"
    - They move on to other questions
    
    Args:
        phone: Caller's phone number
    
    Returns:
        Confirmation message
    """
    logger.info(f"✅ Objection handled for: {phone}")
    
    update_conversation_state(phone, {
        "conversation_data": {
            "objection_handled": True,
            "has_objections": False,  # Clear objection flag
        }
    })
    
    return "Objection marked as handled. Will route back to answer node."


@function_tool
async def mark_questions_answered(phone: str) -> str:
    """Mark that the caller's questions have been answered.
    
    Use this when:
    - The caller has no more questions
    - They seem satisfied with explanations
    - Natural transition point to next phase
    
    Args:
        phone: Caller's phone number
    
    Returns:
        Confirmation message
    """
    logger.info(f"✅ Questions answered for: {phone}")
    
    update_conversation_state(phone, {
        "conversation_data": {
            "questions_answered": True,
        }
    })
    
    return "Questions marked as answered. Ready for next conversation phase."


@function_tool
async def mark_wrong_person(phone: str, right_person_available: bool = False) -> str:
    """Mark that you're speaking with the wrong person.
    
    Use this when:
    - Caller says they're not the homeowner
    - They say "let me get [spouse/family member]"
    - Wrong number situation
    
    Args:
        phone: Caller's phone number
        right_person_available: Whether the right person can come to the phone now
    
    Returns:
        Confirmation message
    """
    logger.info(f"❌ Wrong person: {phone}, right person available: {right_person_available}")
    
    update_conversation_state(phone, {
        "conversation_data": {
            "wrong_person": True,
            "right_person_available": right_person_available,
        }
    })
    
    if right_person_available:
        return "Wrong person, but right person is available. Will re-greet."
    else:
        return "Wrong person and right person not available. Will route to exit."


@function_tool
async def clear_conversation_flags(phone: str) -> str:
    """Clear all conversation flags for a fresh start.
    
    Use this when:
    - Spouse comes to phone (fresh greeting needed)
    - Call was transferred
    - Starting a new conversation phase
    
    Args:
        phone: Caller's phone number
    
    Returns:
        Confirmation message
    """
    logger.info(f"🔄 Clearing flags for: {phone}")
    
    update_conversation_state(phone, {
        "conversation_data": {
            "wrong_person": False,
            "right_person_available": False,
            "has_objections": False,
            "objection_handled": False,
            "questions_answered": False,
            "ready_to_book": False,
        }
    })
    
    return "Conversation flags cleared. Fresh start."

