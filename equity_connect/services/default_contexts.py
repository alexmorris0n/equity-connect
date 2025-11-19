"""Default BarbGraph contexts used when Supabase data is missing.

These definitions mirror the original v1 prompt structure so that
SignalWire contexts can still be constructed even if the database
has not been seeded yet.
"""

from copy import deepcopy
from typing import Dict, Any

_BASE_VALID_CONTEXTS = [
	"greet",
	"verify",
	"qualify",
	"quote",
	"answer",
	"objections",
	"book",
	"goodbye",
	"end"
]


def _step(name: str, text: str, criteria: str, functions=None):
	return {
		"name": name,
		"text": text,
		"step_criteria": criteria,
		"functions": functions or []
	}


DEFAULT_CONTEXTS: Dict[str, Dict[str, Any]] = {
	"greet": {
		"steps": [
			_step(
				"main",
				"Warmly greet the caller, introduce yourself as Barbara from Equity Connect, "
				"and uncover why they reached out today. Keep responses short and empathetic.",
				"Caller feels welcomed and you understand their reason for calling."
			)
		],
		"valid_contexts": ["verify", "answer", "goodbye", "end"]
	},
	"verify": {
		"steps": [
			_step(
				"confirm_identity",
				"Confirm the caller's name and acknowledge details from pre-loaded lead data. "
				"If unknown, create a new lead.",
				"Lead context loaded or newly created.",
				["verify_caller_identity", "mark_wrong_person"]
			)
		],
		"valid_contexts": ["qualify", "quote", "answer", "goodbye"]
	},
	"qualify": {
		"steps": [
			_step(
				"collect_requirements",
				"Ask only the remaining qualification questions (age, home ownership, "
				"equity, occupancy). Update the lead record as you learn details.",
				"Enough information collected to determine qualification status.",
				["update_lead_info", "mark_wrong_person"]
			)
		],
		"valid_contexts": ["quote", "answer", "goodbye"]
	},
	"quote": {
		"steps": [
			_step(
				"share_estimate",
				"Explain the estimated range they may access, stress that exact numbers "
				"come from the licensed broker, and capture their reaction.",
				"Quote shared and caller reaction captured.",
				["mark_quote_presented", "mark_questions_answered", "mark_ready_to_book"]
			)
		],
		"valid_contexts": ["answer", "book", "goodbye"]
	},
	"answer": {
		"steps": [
			_step(
				"respond",
				"Invite questions, use search_knowledge for accurate answers, and keep "
				"responses concise. Detect readiness to book or new objections.",
				"Caller indicates their questions are answered or they want next steps.",
				["search_knowledge", "mark_ready_to_book", "mark_has_objection", "mark_questions_answered"]
			)
		],
		"valid_contexts": ["objections", "book", "goodbye"]
	},
	"objections": {
		"steps": [
			_step(
				"address_concern",
				"Acknowledge the concern, clarify with facts, and confirm whether the "
				"caller feels better about moving forward.",
				"Objection handled and caller comfortable proceeding or opting out.",
				["search_knowledge", "mark_objection_handled", "mark_wrong_person"]
			)
		],
		"valid_contexts": ["answer", "book", "goodbye"]
	},
	"book": {
		"steps": [
			_step(
				"schedule",
				"Check broker availability, offer options, confirm the time the caller "
				"chooses, and send confirmations.",
				"Appointment booked or clear follow-up action taken.",
				["check_broker_availability", "book_appointment", "assign_tracking_number"]
			)
		],
		"valid_contexts": ["goodbye"]
	},
	"goodbye": {
		"steps": [
			_step(
				"farewell",
				"Summarize any next steps, thank the caller, and handle wrong-person or "
				"callback scenarios. Confirm the caller feels taken care of.",
				"Conversation closed with a clear next step.",
				["mark_wrong_person"]
			)
		],
		"valid_contexts": ["end"]
	},
	"end": {
		"steps": [
			_step(
				"hangup",
				"The call is ending. Say nothing and disconnect.",
				"Call disconnected.",
				[]
			)
		],
		"valid_contexts": []
	}
}


def get_default_context(name: str) -> Dict[str, Any]:
	context = DEFAULT_CONTEXTS.get(name)
	return deepcopy(context) if context else {}

