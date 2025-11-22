"""
BarbGraph routing logic
Deterministic node transitions based on conversation state flags
"""

from typing import Optional, Dict, Any, Literal
import logging

logger = logging.getLogger(__name__)


def is_node_complete(node_name: str, conversation_data: Dict[str, Any]) -> bool:
    """
    Check if current node goals are met based on DB state
    Per BarbGraph node completion criteria
    """
    completion_criteria = {
        "greet": lambda cd: cd.get("greeted") == True,
        "verify": lambda cd: cd.get("verified") == True,
        "qualify": lambda cd: cd.get("qualified") is not None,  # Can be True or False
        "quote": lambda cd: cd.get("quote_presented") == True,
        "answer": lambda cd: cd.get("questions_answered") == True or cd.get("ready_to_book") == True,
        "objections": lambda cd: cd.get("objection_handled") == True,
        "book": lambda cd: cd.get("appointment_booked") == True,
        "goodbye": lambda cd: True,  # Always complete immediately
        "end": lambda cd: True,  # Always complete immediately
    }
    
    checker = completion_criteria.get(node_name)
    if checker:
        return checker(conversation_data)
    
    return False


async def route_after_greet(state: Dict[str, Any]) -> str:
    """
    DB-driven routing after greeting
    Per BarbGraph routing logic
    
    EXCEPTION: OBJECTIONS can be accessed from GREET before verify/qualify
    Reason: People won't give personal info if they have objections (e.g., "This is a scam")
    """
    conversation_data = state.get('conversation_data', {})
    qualified = state.get('qualified')
    
    # EXCEPTION 1: Check for objections FIRST (can skip verify/qualify)
    # Example: "This is a scam" - they won't give personal info until we address this
    if conversation_data.get("has_objection"):
        logger.info("⚠️ EXCEPTION: Objection raised during greet → OBJECTIONS (skipping verify/qualify)")
        return "objections"
    
    # EXCEPTION 2: Check for immediate calculation questions (can skip verify/qualify)
    # Example: "How much can I get?" - answer their question first, qualify later
    if conversation_data.get("asked_about_amount"):
        logger.info("💰 EXCEPTION: Calculation question during greet → QUOTE (will qualify after)")
        return "quote"
    
    # Check if wrong person answered
    if conversation_data.get("wrong_person"):
        if conversation_data.get("right_person_available"):
            logger.info("🔄 Wrong person, but right person available → RE-GREET")
            return "greet"
        else:
            logger.info("🚪 Wrong person, not available → GOODBYE")
            return "goodbye"
    
    # Check if already verified and qualified
    if conversation_data.get("verified"):
        if qualified:
            # If qualified but quote not presented, go to quote first
            if not conversation_data.get("quote_presented"):
                logger.info("✅ Verified and qualified → QUOTE")
                return "quote"
            else:
                logger.info("✅ Already verified, qualified, and quoted → ANSWER")
                return "answer"
        else:
            logger.info("✅ Verified, not qualified → QUALIFY")
            return "qualify"
    
    # Default: verify identity
    logger.info("🔍 Not verified → VERIFY")
    return "verify"


async def route_after_verify(state: Dict[str, Any]) -> str:
    """Route after verification"""
    conversation_data = state.get('conversation_data', {})
    qualified = state.get('qualified')
    
    if qualified:
        if not conversation_data.get("quote_presented"):
            return "quote"
        return "answer"
    
    return "qualify"


async def route_after_qualify(state: Dict[str, Any]) -> str:
    """Route after qualification"""
    conversation_data = state.get('conversation_data', {})
    qualified = state.get('qualified')
    
    # Check for objections FIRST
    if conversation_data.get("has_objection"):
        logger.info("⚠️ Objection raised during qualify → OBJECTIONS")
        return "objections"
    
    if qualified:
        if not conversation_data.get("quote_presented"):
            return "quote"
        return "answer"
    
    # Not qualified - still go to answer to explain why
    return "answer"


async def route_after_quote(state: Dict[str, Any]) -> str:
    """
    DB-driven routing after quote presentation
    """
    conversation_data = state.get('conversation_data', {})
    qualified = state.get('qualified')
    
    # Check for late disqualification FIRST
    if qualified == False:
        logger.info("🚫 Late disqualification discovered in quote → GOODBYE")
        return "goodbye"
    
    # Check for objections
    if conversation_data.get("has_objection"):
        logger.info("⚠️ Objection raised during quote → OBJECTIONS")
        return "objections"
    
    # Check reaction to quote
    quote_reaction = conversation_data.get("quote_reaction")
    if quote_reaction == "not_interested":
        logger.info("🚪 Not interested in quote → GOODBYE")
        return "goodbye"
    
    # Check if ready to book
    if conversation_data.get("ready_to_book"):
        logger.info("✅ Ready to book after quote → BOOK")
        return "book"
    
    # Default: answer questions
    logger.info("💬 Has questions about quote → ANSWER")
    return "answer"


async def route_after_answer(state: Dict[str, Any]) -> str:
    """Route after answering questions"""
    conversation_data = state.get('conversation_data', {})
    
    # Check for calculation questions FIRST
    if conversation_data.get("needs_quote"):
        logger.info("💰 Calculation question → QUOTE")
        return "quote"
    
    # Check for objections
    if conversation_data.get("has_objection"):
        return "objections"
    
    # Check if ready to book
    if conversation_data.get("ready_to_book"):
        return "book"
    
    # Stay in answer if still has questions
    return "answer"


async def route_after_objections(state: Dict[str, Any]) -> str:
    """
    DB-driven routing after objection handling
    """
    conversation_data = state.get('conversation_data', {})
    
    if conversation_data.get("wrong_person"):
        logger.info("🚪 Wrong person → GOODBYE")
        return "goodbye"
    
    if conversation_data.get("objection_handled"):
        if conversation_data.get("ready_to_book"):
            logger.info("✅ Objection handled + ready to book → BOOK")
            return "book"
        else:
            # Return to the node they were in before the objection
            previous_node = conversation_data.get("node_before_objection", "answer")
            logger.info(f"✅ Objection handled → {previous_node.upper()}")
            return previous_node
    
    logger.info("⏳ Objection not resolved → STAY IN OBJECTIONS")
    return "objections"


async def route_after_book(state: Dict[str, Any]) -> str:
    """
    Route after booking node
    Can go to: answer (questions), objections (concerns), quote (calculations), goodbye (done)
    """
    conversation_data = state.get('conversation_data', {})
    
    # If appointment booked, go to goodbye
    if conversation_data.get("appointment_booked"):
        logger.info("✅ Appointment booked → GOODBYE")
        return "goodbye"
    
    # If user has objections/concerns during booking
    if conversation_data.get("has_objection"):
        logger.info("⚠️ Objection raised during booking → OBJECTIONS")
        return "objections"
    
    # If user wants to recalculate or verify quote
    if conversation_data.get("needs_quote_recalc"):
        logger.info("💰 Calculation question during booking → QUOTE")
        return "quote"
    
    # If user has questions before committing
    if conversation_data.get("has_questions_before_booking"):
        logger.info("❓ Questions before booking → ANSWER")
        return "answer"
    
    # Default: stay in booking
    logger.info("⏳ Still working on booking → STAY IN BOOK")
    return "book"


async def route_after_goodbye(state: Dict[str, Any]) -> str:
    """Route after goodbye"""
    conversation_data = state.get('conversation_data', {})
    
    # If user asks a question during goodbye, route to answer
    if conversation_data.get("has_questions_during_goodbye"):
        logger.info("❓ User has questions during goodbye → ANSWER")
        return "answer"
    
    # Otherwise, end the call
    logger.info("🚪 Goodbye complete → END")
    return "end"


async def determine_next_node(current_node: str, state: Dict[str, Any]) -> str:
    """
    Determine next node based on current node and state
    Main routing function that calls node-specific routers
    """
    routers = {
        "greet": route_after_greet,
        "verify": route_after_verify,
        "qualify": route_after_qualify,
        "quote": route_after_quote,
        "answer": route_after_answer,
        "objections": route_after_objections,
        "book": route_after_book,
        "goodbye": route_after_goodbye,
        "end": lambda s: "end"
    }
    
    router = routers.get(current_node)
    if router:
        next_node = await router(state)
        return next_node
    
    # Default: stay in current node
    logger.warning(f"[ROUTING] No router for node: {current_node}, staying put")
    return current_node

