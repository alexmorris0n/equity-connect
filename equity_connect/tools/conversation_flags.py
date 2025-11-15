"""Tools for managing conversation state flags that control node routing.

These tools allow the LLM to signal intent (booking readiness, objections, etc.)
which triggers dynamic routing between conversation nodes.
"""

import logging
from equity_connect.services.conversation_state import update_conversation_state
from typing import Optional

logger = logging.getLogger(__name__)


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


async def mark_has_objection(phone: str, current_node: Optional[str] = None, objection_type: Optional[str] = None) -> str:
	"""Mark that the caller has raised an objection or concern.
	
	Use this when the caller:
	- Expresses doubt or hesitation
	- Raises concerns about cost, eligibility, or process
	- Asks "what if" questions that show resistance
	
	Args:
	    phone: Caller's phone number
	    current_node: The node where the objection was raised (e.g., 'answer', 'qualify', 'quote')
	    objection_type: Optional type of objection (cost, eligibility, trust, timing, family, etc.)
	
	Returns:
	    Confirmation message
	"""
	logger.info(f"⚠️ Objection raised for {phone} (node={current_node}, type={objection_type})")
	
	flags = {
		"has_objections": True,
		"node_before_objection": current_node or "answer",
	}
	if objection_type:
		flags["last_objection_type"] = objection_type
	
	update_conversation_state(phone, {
		"conversation_data": flags
	})
	
	return "Objection noted. Will transition to objection handling."


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


async def mark_qualification_result(phone: str, qualified: bool) -> str:
	"""Persist qualification outcome to conversation state.
	
	Sets both the top-level 'qualified' field (used by routers) and
	conversation_data.qualified (used by node completion checks).
	"""
	logger.info(f"✅ Qualification result for {phone}: qualified={qualified}")
	
	update_conversation_state(phone, {
		"qualified": bool(qualified),
		"conversation_data": {
			"qualified": bool(qualified)
		}
	})
	
	return f"Qualification status saved: {'qualified' if qualified else 'not qualified'}."

async def mark_quote_presented(phone: str, quote_reaction: str) -> str:
	"""Mark that a financial quote has been presented and record the caller's reaction.
	
	Use this when:
	- You've shown them estimated loan amounts
	- You've explained what they could access financially
	- They've responded to the numbers
	
	Args:
	    phone: Caller's phone number
	    quote_reaction: Reaction to quote (positive, skeptical, not_interested, needs_more, etc.)
	
	Returns:
	    Confirmation message
	"""
	logger.info(f"💰 Quote presented to {phone} with reaction: {quote_reaction}")
	
	update_conversation_state(phone, {
		"conversation_data": {
			"quote_presented": True,
			"quote_reaction": quote_reaction,
		}
	})
	
	return f"Quote marked as presented with reaction: {quote_reaction}. Will route based on reaction."


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


async def update_conversation_flag(phone: str, flag: str, value=None, metadata: Optional[dict] = None) -> str:
	"""Unified flag updater used by the SignalWire tool.
	
	Args:
	    phone: Caller's phone number
	    flag: Name of the flag to update
	    value: Optional value (varies per flag)
	    metadata: Optional metadata dict (varies per flag)
	"""
	if not phone:
		return "❌ Missing phone number for flag update."
	
	flag_normalized = (flag or "").strip().lower()
	metadata = metadata or {}
	
	if flag_normalized == "ready_to_book":
		return await mark_ready_to_book(phone)
	
	if flag_normalized == "has_objection":
		return await mark_has_objection(
			phone,
			metadata.get("current_node"),
			metadata.get("objection_type")
		)
	
	if flag_normalized == "objection_handled":
		return await mark_objection_handled(phone)
	
	if flag_normalized == "questions_answered":
		return await mark_questions_answered(phone)
	
	if flag_normalized == "qualified":
		bool_value = value
		if isinstance(bool_value, str):
			bool_value = bool_value.lower() in ["true", "1", "yes"]
		return await mark_qualification_result(phone, bool(bool_value))
	
	if flag_normalized == "quote_presented":
		reaction = value or metadata.get("quote_reaction")
		if not reaction:
			return "❌ quote_reaction value required for quote_presented."
		return await mark_quote_presented(phone, reaction)
	
	if flag_normalized == "wrong_person":
		right_available = value
		if isinstance(right_available, str):
			right_available = right_available.lower() in ["true", "1", "yes"]
		return await mark_wrong_person(phone, bool(right_available))
	
	if flag_normalized == "clear_all":
		return await clear_conversation_flags(phone)
	
	return f"❌ Unsupported flag '{flag}'."



