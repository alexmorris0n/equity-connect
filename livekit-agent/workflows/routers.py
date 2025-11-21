"""Dynamic routing logic for conversation graph"""
import logging
from typing import Literal, Optional, Dict, Any
from langgraph.graph import END
from .state import ConversationState
from services.conversation_state import get_conversation_state, extract_phone_from_messages

logger = logging.getLogger(__name__)


def validate_transition(from_node: str, to_node: str, vertical: str = "reverse_mortgage") -> tuple[bool, list[str]]:
    """Validate that transition is allowed according to database valid_contexts
    
    Args:
        from_node: Current node name
        to_node: Target node name
        vertical: Business vertical
        
    Returns:
        Tuple of (is_valid: bool, valid_contexts: list[str])
        - is_valid: True if transition is allowed, False if blocked
        - valid_contexts: List of valid transitions from database (empty if not found)
        
    Note:
        - "exit" and END are NOT automatically allowed - they must be in valid_contexts
        - If valid_contexts is empty, returns (True, []) for backward compatibility
    """
    try:
        from services.prompt_loader import load_node_config
        config = load_node_config(from_node, vertical)
        valid_contexts = config.get('valid_contexts', [])
        
        if valid_contexts:
            # Normalize node names for comparison
            # Router functions use "exit" but database has "goodbye"
            to_node_normalized = "exit" if to_node == END else to_node
            
            # Map router's "exit" to database's "goodbye" (database uses "goodbye", not "exit")
            if to_node_normalized == "exit":
                to_node_normalized = "goodbye"
            
            is_valid = to_node_normalized in valid_contexts
            
            if not is_valid:
                logger.warning(f"⚠️ Invalid transition: {from_node} → {to_node} (valid: {valid_contexts})")
            
            return (is_valid, valid_contexts)
        else:
            # No valid_contexts defined - allow all transitions (backward compatible)
            return (True, [])
    except Exception as e:
        logger.debug(f"Could not validate transition: {e}, allowing it")
        return (True, [])  # Fail open for backward compatibility if validation fails


def _db(state: ConversationState) -> Optional[Dict[str, Any]]:
	"""Fetch DB row based on state phone_number or messages fallback."""
	if state is None:
		return None

	cached_row = state.get("_state_row")  # Pre-fetched row (e.g., from LiveKit coordinator)
	if cached_row:
		return cached_row

	phone = state.get("phone_number")  # Preferred if present in graph state
	if not phone:
		phone = extract_phone_from_messages(state.get("messages", []))  # Best-effort
	if not phone:
		return None
	return get_conversation_state(phone)


def _cd(row: Dict[str, Any]) -> Dict[str, Any]:
	return (row or {}).get("conversation_data") or {}


def route_after_greet(state: ConversationState) -> Literal["verify", "qualify", "answer", "quote", "book", "exit", "greet"]:
	"""
	Intent-based routing after greet using call_reason_summary.
	Valid targets (from DB): ["answer", "verify", "quote"]
	
	Route based on captured intent:
	- "quote"/"numbers"/"how much" → quote
	- "book"/"appointment"/"schedule" → book  
	- "question"/"help"/"wondering" → answer
	- No lead_id yet → verify
	- Special cases (wrong_person) → greet/exit
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row yet → VERIFY")
		return "verify"
	cd = _cd(row)

	# Special case: wrong person scenarios
	if cd.get("wrong_person") and cd.get("right_person_available"):
		logger.info("🔁 Re-greet right person now available → GREET")
		return "greet"
	if cd.get("wrong_person"):
		logger.info("🚪 Wrong person → EXIT")
		return "exit"

	# Get the reason summary from mark_greeted
	reason = (cd.get("call_reason_summary") or "").lower()
	
	# Intent-based routing using keywords
	if any(word in reason for word in ["quote", "number", "how much", "equity", "amount", "value", "estimate"]):
		logger.info(f"💰 Intent: Quote request → QUOTE (reason: {reason})")
		return "quote"
	
	if any(word in reason for word in ["book", "appointment", "schedule", "meeting", "consultation", "call back"]):
		logger.info(f"📅 Intent: Booking → BOOK (reason: {reason})")
		return "book"
	
	# If we don't have lead_id yet, need to verify first
	if not row.get("lead_id"):
		logger.info(f"🔍 No lead_id → VERIFY (reason: {reason})")
		return "verify"
	
	# Default: general questions → answer
	logger.info(f"❓ Intent: General questions → ANSWER (reason: {reason})")
	return "answer"


def route_after_verify(state: ConversationState) -> Literal["qualify", "exit", "greet"]:
	"""
	DB-driven routing after verify.
	- If wrong_person and right_person_available → greet
	- If wrong_person → exit
	- If verified → qualify
	- Else → verify (cap handled in node)
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row → VERIFY (implicit)")
		return "verify"  # continue verification until flags are persisted
	cd = _cd(row)

	if cd.get("wrong_person") and cd.get("right_person_available"):
		logger.info("🔁 Re-greet right person now available → GREET")
		return "greet"
	if cd.get("wrong_person"):
		logger.info("🚪 Wrong person → EXIT")
		return "exit"

	if cd.get("verified") or row.get("lead_id"):
		logger.info("✅ Verified → QUALIFY")
		return "qualify"

	# Fallback: continue verification loop (node will apply visit cap)
	logger.info("🔁 Continue VERIFY")
	return "verify"


def route_after_qualify(state: ConversationState) -> Literal["quote", "exit"]:
	"""
	DB-driven routing after qualification.
	- If qualified → quote (present financial estimates)
	- Else → exit
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row → EXIT (cannot determine qualification)")
		return "exit"

	if row.get("qualified"):
		logger.info("✅ Qualified → QUOTE")
		return "quote"

	logger.info("🚪 Not qualified → EXIT")
	return "exit"


def route_after_quote(state: ConversationState) -> Literal["answer", "book", "exit"]:
	"""
	DB-driven routing after quote presentation.
	- If quote_reaction == "not_interested" → exit
	- If ready_to_book → book
	- If has_questions → answer
	- Default → answer
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row → ANSWER")
		return "answer"
	cd = _cd(row)

	# Check if they're not interested (explicit exit)
	if cd.get("quote_reaction") == "not_interested":
		logger.info("🚪 Not interested in quote → EXIT")
		return "exit"

	# Check if ready to book immediately
	if cd.get("ready_to_book"):
		logger.info("📅 Ready to book after quote → BOOK")
		return "book"

	# Default to answer node for questions or further discussion
	logger.info("❓ Questions about quote → ANSWER")
	return "answer"


def route_after_answer(state: ConversationState) -> Literal["answer", "objections", "book", "exit"]:
	"""
	DB-driven routing after answer.
	- If ready_to_book → book
	- Elif has_objections → objections
	- Elif node_visits.answer > 5 → exit
	- Else → answer
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row → ANSWER")
		return "answer"
	cd = _cd(row)

	if cd.get("ready_to_book"):
		logger.info("📅 Ready to book → BOOK")
		return "book"
	if cd.get("has_objections"):
		logger.info("⚠️ Objections → OBJECTIONS")
		return "objections"

	visits = (cd.get("node_visits") or {}).get("answer", 0)
	if visits and visits > 5:
		logger.info("🔚 Answer loop cap reached → EXIT")
		return "exit"

	logger.info("🔄 Continue ANSWER")
	return "answer"


def route_after_objections(state: ConversationState) -> Literal["answer", "objections", "book", "exit", "verify", "qualify", "quote", "greet"]:
	"""
	DB-driven routing after objections.
	- If ready_to_book → book
	- If objection_handled → return to previous node (default: answer)
	- If has_objections → stay in objections
	- Else → answer
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row → ANSWER")
		return "answer"
	cd = _cd(row)

	if cd.get("ready_to_book"):
		logger.info("📅 Ready after objections → BOOK")
		return "book"

	# If objection resolved, resume previous node (default to answer)
	if cd.get("objection_handled"):
		previous_node = cd.get("node_before_objection", "answer")
		# Validate previous_node against allowed nodes to maintain type safety
		allowed_nodes = {"answer", "objections", "book", "exit", "verify", "qualify", "quote", "greet"}
		if previous_node not in allowed_nodes:
			logger.warning(f"Unknown previous_node '{previous_node}', defaulting to ANSWER")
			previous_node = "answer"
		logger.info(f"✅ Objection handled → {previous_node.upper()}")
		return previous_node

	# If objections remain, stay in objections
	if cd.get("has_objections"):
		logger.info("⏳ Objection not resolved → STAY IN OBJECTIONS")
		return "objections"

	logger.info("➡️ Continue ANSWER")
	return "answer"


def route_after_book(state: ConversationState) -> Literal["exit", "answer"]:
	"""
	DB-driven routing after booking attempt.
	- If appointment_booked → exit (success)
	- Else → answer (booking failed, continue conversation)
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row → EXIT")
		return "exit"
	cd = _cd(row)
	
	if cd.get("appointment_booked"):
		logger.info("✅ Appointment booked → EXIT")
		return "exit"
	
	logger.info("⚠️ Booking not completed → ANSWER")
	return "answer"


def route_after_exit(state: ConversationState):
	"""
	DB-driven router after exit node.
	- If conversation_data.right_person_available → greet (re-greet spouse)
	- Else → END
	"""
	row = _db(state)
	if not row:
		logger.info("🔚 No DB row → END")
		return END
	cd = _cd(row)
	if cd.get("right_person_available"):
		logger.info("🔁 right_person_available → GREET")
		return "greet"
	return END

