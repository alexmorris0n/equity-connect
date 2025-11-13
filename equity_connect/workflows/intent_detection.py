"""Intent detection for proactive routing within nodes.

This module checks if the user's intent matches a different node's purpose,
allowing immediate routing without waiting for tool completion.
"""
import logging
from typing import Literal, Optional, Dict, Any
from equity_connect.services.conversation_state import get_conversation_state, extract_phone_from_messages

logger = logging.getLogger(__name__)


def _db(state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
	"""Fetch DB row based on state phone_number or messages fallback."""
	phone = state.get("phone_number")
	if not phone:
		phone = extract_phone_from_messages(state.get("messages", []))
	if not phone:
		return None
	return get_conversation_state(phone)


def _cd(row: Dict[str, Any]) -> Dict[str, Any]:
	return (row or {}).get("conversation_data") or {}


def check_intent_in_node(current_node: str, state: Dict[str, Any]) -> Optional[Literal["verify", "qualify", "answer", "quote", "objections", "book", "exit"]]:
	"""Check if user intent matches a different node while in current_node.
	
	This allows proactive routing based on user intent, not just tool completion.
	For example, if user says "I want to book with Walter" during greet, route to book immediately.
	
	Args:
		current_node: The node we're currently in
		state: Conversation state dict
		
	Returns:
		Target node name if intent detected, None if stay in current node
	"""
	row = _db(state)
	if not row:
		return None
	cd = _cd(row)
	
	# Intent: User wants to book immediately (any node → book)
	if cd.get("ready_to_book"):
		if current_node != "book":
			logger.info(f"🎯 Intent detected in {current_node}: ready_to_book → BOOK")
			return "book"
	
	# Intent: User has questions (any node → answer, except if already in answer/objections)
	if cd.get("has_questions") or cd.get("questions_asked"):
		if current_node not in ["answer", "objections"]:
			logger.info(f"🎯 Intent detected in {current_node}: has_questions → ANSWER")
			return "answer"
	
	# Intent: User has objections (any node → objections, except if already in objections)
	if cd.get("has_objections"):
		if current_node != "objections":
			logger.info(f"🎯 Intent detected in {current_node}: has_objections → OBJECTIONS")
			return "objections"
	
	# Intent: User wants a quote (qualify/answer → quote)
	if cd.get("wants_quote") or cd.get("quote_requested"):
		if current_node in ["qualify", "answer"]:
			logger.info(f"🎯 Intent detected in {current_node}: wants_quote → QUOTE")
			return "quote"
	
	# Intent: User is verified and needs qualification (greet/verify → qualify)
	if cd.get("verified") and not row.get("qualified"):
		if current_node in ["greet", "verify"]:
			logger.info(f"🎯 Intent detected in {current_node}: verified but not qualified → QUALIFY")
			return "qualify"
	
	# Intent: User needs verification (greet → verify, if not verified)
	if not cd.get("verified") and not row.get("lead_id"):
		if current_node == "greet":
			logger.info(f"🎯 Intent detected in {current_node}: not verified → VERIFY")
			return "verify"
	
	# No intent match - stay in current node
	return None

