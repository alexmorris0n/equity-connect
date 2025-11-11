"""Dynamic routing logic for conversation graph"""
import logging
from typing import Literal, Optional, Dict, Any
from langgraph.graph import END
from .state import ConversationState
from services.conversation_state import get_conversation_state, extract_phone_from_messages

logger = logging.getLogger(__name__)


def _db(state: ConversationState) -> Optional[Dict[str, Any]]:
	"""Fetch DB row based on state phone_number or messages fallback."""
	phone = state.get("phone_number")  # Preferred if present in graph state
	if not phone:
		phone = extract_phone_from_messages(state.get("messages", []))  # Best-effort
	if not phone:
		return None
	return get_conversation_state(phone)


def _cd(row: Dict[str, Any]) -> Dict[str, Any]:
	return (row or {}).get("conversation_data") or {}


def route_after_greet(state: ConversationState) -> Literal["verify", "qualify", "answer", "exit", "greet"]:
	"""
	DB-driven routing after greet.
	- If wrong_person and right_person_available → greet (re-greet spouse)
	- If wrong_person only → exit
	- If lead_id && qualified → answer
	- If lead_id only → qualify
	- Else → verify
	"""
	row = _db(state)
	if not row:
		logger.info("🔍 No DB row yet → VERIFY")
		return "verify"
	cd = _cd(row)

	if cd.get("wrong_person") and cd.get("right_person_available"):
		logger.info("🔁 Re-greet right person now available → GREET")
		return "greet"
	if cd.get("wrong_person"):
		logger.info("🚪 Wrong person → EXIT")
		return "exit"

	if row.get("lead_id") and row.get("qualified"):
		logger.info("⚡ Known + qualified → ANSWER")
		return "answer"
	if row.get("lead_id"):
		logger.info("🔎 Known lead → QUALIFY")
		return "qualify"

	logger.info("🔍 Unknown → VERIFY")
	return "verify"


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
		return "qualify"  # optimistic path if verification succeeded in-node
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
	return "qualify"


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


def route_after_objections(state: ConversationState) -> Literal["answer", "objections", "book", "exit"]:
	"""
	DB-driven routing after objections.
	- If ready_to_book → book
	- Elif has_objections → answer (acknowledge then continue)
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
	if cd.get("has_objections"):
		logger.info("↔️ Still objections → ANSWER")
		return "answer"

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

