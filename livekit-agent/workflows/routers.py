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


def _get_valid_contexts(from_node: str, vertical: str = "reverse_mortgage") -> list[str]:
	"""Load valid_contexts from database for a node"""
	try:
		from services.prompt_loader import load_node_config
		config = load_node_config(from_node, vertical)
		return config.get('valid_contexts', [])
	except Exception as e:
		logger.warning(f"Could not load valid_contexts for {from_node}: {e}")
		return []


def _pick_route(from_node: str, valid_contexts: list[str], state_row: dict, intent_keywords: dict[str, list[str]] = None) -> str:
	"""Pick best route from valid_contexts based on conversation state
	
	Args:
		from_node: Current node name
		valid_contexts: List of allowed next nodes from DB
		state_row: Full conversation state row
		intent_keywords: Optional dict mapping node names to keywords to check in call_reason_summary
		
	Returns:
		Best matching node from valid_contexts
	"""
	if not valid_contexts:
		logger.warning(f"No valid_contexts for {from_node}, cannot route")
		return "goodbye"
	
	cd = _cd(state_row)
	
	# Check intent keywords if provided (for greet routing)
	if intent_keywords:
		reason = (cd.get("call_reason_summary") or "").lower()
		for node, keywords in intent_keywords.items():
			if node in valid_contexts and any(word in reason for word in keywords):
				logger.info(f"🎯 Intent match: '{reason}' → {node.upper()}")
				return node
	
	# Check common state flags and pick first valid match
	# Priority order: ready_to_book → has_objections → needs quote → default
	
	if cd.get("ready_to_book") and "book" in valid_contexts:
		return "book"
	
	if cd.get("has_objections") and "objections" in valid_contexts:
		return "objections"
	
	if cd.get("needs_quote") and "quote" in valid_contexts:
		return "quote"
	
	if cd.get("questions_answered") and "goodbye" in valid_contexts:
		return "goodbye"
	
	# Default routing preferences
	if "answer" in valid_contexts:
		return "answer"
	if "quote" in valid_contexts:
		return "quote"
	if "verify" in valid_contexts:
		return "verify"
	if "qualify" in valid_contexts:
		return "qualify"
	
	# Fallback to first valid context
	logger.info(f"Using fallback route: {valid_contexts[0]}")
	return valid_contexts[0]


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


def route_after_verify(state: ConversationState) -> Literal["qualify", "answer", "quote", "objections", "exit", "greet"]:
	"""
	Route after verify using DB valid_contexts.
	Valid targets: ["qualify", "answer", "quote", "objections"]
	
	Special cases:
	- wrong_person scenarios (greet/exit)
	- Default flow to qualify or answer
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row → VERIFY (implicit)")
		return "verify"
	cd = _cd(row)

	# Special cases
	if cd.get("wrong_person") and cd.get("right_person_available"):
		logger.info("🔁 Re-greet right person now available → GREET")
		return "greet"
	if cd.get("wrong_person"):
		logger.info("🚪 Wrong person → EXIT")
		return "exit"

	# Load valid contexts from DB
	valid_contexts = _get_valid_contexts("verify")
	
	# If verified or lead_id exists, route based on intent
	if cd.get("verified") or row.get("lead_id"):
		next_node = _pick_route("verify", valid_contexts, row)
		logger.info(f"✅ Verified → {next_node.upper()}")
		return next_node
	
	# Continue verification loop (node will apply visit cap)
	logger.info("🔁 Continue VERIFY")
	return "verify"


def route_after_qualify(state: ConversationState) -> Literal["quote", "objections", "goodbye", "exit"]:
	"""
	Route after qualify using DB valid_contexts.
	Valid targets: ["goodbye", "quote", "objections"]
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row → EXIT (cannot determine qualification)")
		return "exit"

	valid_contexts = _get_valid_contexts("qualify")
	
	# If not qualified, exit
	if not row.get("qualified"):
		logger.info("🚪 Not qualified → GOODBYE")
		return "goodbye" if "goodbye" in valid_contexts else "exit"
	
	# If qualified, pick best route
	next_node = _pick_route("qualify", valid_contexts, row)
	logger.info(f"✅ Qualified → {next_node.upper()}")
	return next_node


def route_after_quote(state: ConversationState) -> Literal["answer", "book", "goodbye", "exit"]:
	"""
	Route after quote using DB valid_contexts.
	Valid targets: ["answer", "book", "goodbye"]
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row → ANSWER")
		return "answer"
	
	cd = _cd(row)
	valid_contexts = _get_valid_contexts("quote")

	# If not interested, exit
	if cd.get("quote_reaction") == "not_interested":
		logger.info("🚪 Not interested in quote → GOODBYE")
		return "goodbye" if "goodbye" in valid_contexts else "exit"

	# Pick best route based on state
	next_node = _pick_route("quote", valid_contexts, row)
	logger.info(f"After quote → {next_node.upper()}")
	return next_node


def route_after_answer(state: ConversationState) -> Literal["answer", "objections", "book", "quote", "goodbye", "exit"]:
	"""
	Route after answer using DB valid_contexts.
	Valid targets: ["goodbye", "book", "objections", "quote"]
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row → ANSWER")
		return "answer"
	
	cd = _cd(row)
	valid_contexts = _get_valid_contexts("answer")

	# Check for loop cap
	visits = (cd.get("node_visits") or {}).get("answer", 0)
	if visits and visits > 5:
		logger.info("🔚 Answer loop cap reached → GOODBYE")
		return "goodbye" if "goodbye" in valid_contexts else "exit"

	# Pick best route based on state
	next_node = _pick_route("answer", valid_contexts, row)
	logger.info(f"After answer → {next_node.upper()}")
	return next_node


def route_after_objections(state: ConversationState) -> Literal["answer", "objections", "book", "goodbye", "exit"]:
	"""
	Route after objections using DB valid_contexts.
	Valid targets: ["answer", "book", "goodbye"]
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row → ANSWER")
		return "answer"
	
	cd = _cd(row)
	valid_contexts = _get_valid_contexts("objections")

	# If objection resolved, pick best route
	if cd.get("objection_handled"):
		next_node = _pick_route("objections", valid_contexts, row)
		logger.info(f"✅ Objection handled → {next_node.upper()}")
		return next_node

	# If objections remain, stay in objections
	if cd.get("has_objections"):
		logger.info("⏳ Objection not resolved → STAY IN OBJECTIONS")
		return "objections"

	# Default to answer
	logger.info("➡️ Default route → ANSWER")
	return "answer" if "answer" in valid_contexts else valid_contexts[0]


def route_after_book(state: ConversationState) -> Literal["goodbye", "exit", "answer"]:
	"""
	Route after book using DB valid_contexts.
	Valid targets: ["goodbye"]
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row → EXIT")
		return "exit"
	
	cd = _cd(row)
	valid_contexts = _get_valid_contexts("book")

	# If appointment booked, say goodbye
	if cd.get("appointment_booked"):
		logger.info("✅ Appointment booked → GOODBYE")
		return "goodbye" if "goodbye" in valid_contexts else "exit"
	
	logger.info("⚠️ Booking not completed → ANSWER")
	return "answer" if "answer" in valid_contexts else "goodbye"


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

