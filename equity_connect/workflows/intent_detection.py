"""Intent detection for proactive routing within nodes.

This module checks if the user's intent matches a different node's purpose,
allowing immediate routing without waiting for tool completion.

GUARD RAILS: Some nodes require prerequisites before routing is allowed.
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
	
	GUARD RAILS: Some nodes have prerequisites that must be met before routing:
	- book: Requires qualified=True (can't book unless qualified)
	- quote: Requires qualified=True or at least verified (need basic info)
	- answer: Requires verified=True (need to know who they are)
	
	Args:
		current_node: The node we're currently in
		state: Conversation state dict
		
	Returns:
		Target node name if intent detected AND prerequisites met, None otherwise
	"""
	row = _db(state)
	if not row:
		return None
	cd = _cd(row)
	
	# Get qualification status for guard rails
	is_qualified = row.get("qualified") == True
	is_verified = cd.get("verified") == True
	
	# Intent: User wants to book immediately (any node → book)
	# GUARD RAIL: Must be qualified to book
	if cd.get("ready_to_book"):
		if current_node != "book":
			if not is_qualified:
				# User wants to book but not qualified yet - route to qualify first
				logger.info(f"🚧 Intent: ready_to_book in '{current_node}', but NOT qualified → QUALIFY (must qualify before booking)")
				return "qualify"
			else:
				# Qualified and ready to book - go ahead
				logger.info(f"🎯 Intent: ready_to_book in '{current_node}' (qualified) → BOOK")
				return "book"
	
	# Intent: User has questions (any node → answer, except if already in answer/objections)
	# GUARD RAIL: Must be verified to answer questions (need to know who they are)
	if cd.get("has_questions") or cd.get("questions_asked"):
		if current_node not in ["answer", "objections"]:
			if not is_verified:
				# User has questions but not verified - verify first
				logger.info(f"🚧 Intent: has_questions in '{current_node}', but NOT verified → VERIFY (must verify before answering questions)")
				return "verify"
			else:
				logger.info(f"🎯 Intent: has_questions in '{current_node}' (verified) → ANSWER")
				return "answer"
	
	# Intent: User has objections (any node → objections, except if already in objections)
	# NO GUARD RAIL: Can handle objections at any time (part of sales process)
	if cd.get("has_objections"):
		if current_node != "objections":
			logger.info(f"🎯 Intent: has_objections in '{current_node}' → OBJECTIONS")
			return "objections"
	
	# Intent: User wants a quote (qualify/answer → quote)
	# GUARD RAIL: Must be qualified (or at least have basic info)
	if cd.get("wants_quote") or cd.get("quote_requested"):
		if current_node in ["qualify", "answer", "greet", "verify"]:
			if not is_qualified and not is_verified:
				# User wants quote but no info yet - verify first
				logger.info(f"🚧 Intent: wants_quote in '{current_node}', but NOT verified → VERIFY (need basic info before quote)")
				return "verify"
			elif not is_qualified:
				# User wants quote but not fully qualified - qualify first
				logger.info(f"🚧 Intent: wants_quote in '{current_node}', but NOT qualified → QUALIFY (must qualify before quote)")
				return "qualify"
			else:
				logger.info(f"🎯 Intent: wants_quote in '{current_node}' (qualified) → QUOTE")
				return "quote"
	
	# Intent: User is verified and needs qualification (greet/verify → qualify)
	# NO GUARD RAIL: Natural progression
	if is_verified and not is_qualified:
		if current_node in ["greet", "verify"]:
			logger.info(f"🎯 Intent: verified in '{current_node}', not qualified → QUALIFY")
			return "qualify"
	
	# Intent: User needs verification (greet → verify, if not verified)
	# NO GUARD RAIL: Natural progression
	if not is_verified and not row.get("lead_id"):
		if current_node == "greet":
			logger.info(f"🎯 Intent: not verified in '{current_node}' → VERIFY")
			return "verify"
	
	# No intent match - stay in current node
	return None

