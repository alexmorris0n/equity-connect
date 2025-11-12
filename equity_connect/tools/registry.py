from typing import Any, Dict, Callable, Optional

# SWAIG adapter: registers our existing tool functions with SignalWire's function system
# without changing any business logic or signatures.

def _try_register(agent: Any, name: str, description: str, parameters: Dict[str, Any], handler: Callable[..., Any]) -> None:
	"""
	Best-effort registration against SignalWire Agents SDK.
	Attempts multiple known integration points to avoid hard SDK coupling here.
	"""
	# Lazy import to avoid hard dependency during local dev
	SwaigFunction = None
	try:
		from signalwire_agents.core.swaig_function import SwaigFunction as _SwaigFunction  # type: ignore
		SwaigFunction = _SwaigFunction
	except Exception:
		SwaigFunction = None

	if SwaigFunction is not None:
		func = SwaigFunction(
			name=name,
			description=description,
			parameters=parameters,
			callback=handler,
		)
		# Common attach variants
		if hasattr(agent, "add_function"):
			agent.add_function(func)  # type: ignore[attr-defined]
			return
		if hasattr(agent, "register_function"):
			agent.register_function(func)  # type: ignore[attr-defined]
			return
		if hasattr(agent, "skill_manager") and hasattr(agent.skill_manager, "register_function"):
			agent.skill_manager.register_function(func)  # type: ignore[attr-defined]
			return
		# As a fallback, stash for later pickup by the server bootstrap
		_functions = getattr(agent, "_swaig_functions", [])
		_functions.append(func)
		setattr(agent, "_swaig_functions", _functions)
	else:
		# No SDK available yet: collect metadata for later binding
		pendings = getattr(agent, "_pending_tools", [])
		pendings.append({"name": name, "description": description, "parameters": parameters, "handler": handler})
		setattr(agent, "_pending_tools", pendings)


def _p_str(desc: str) -> Dict[str, Any]:
	return {"type": "string", "description": desc}


def _p_opt_str(desc: str) -> Dict[str, Any]:
	return {"type": "string", "description": desc, "nullable": True}


def _p_int(desc: str) -> Dict[str, Any]:
	return {"type": "integer", "description": desc}


def _p_bool(desc: str) -> Dict[str, Any]:
	return {"type": "boolean", "description": desc}


def register_all_tools(agent: Any) -> None:
	# Imports kept local to avoid circular imports at module load time
	from .lead import (
		get_lead_context,
		verify_caller_identity,
		check_consent_dnc,
		update_lead_info,
		find_broker_by_territory,
	)
	from .calendar import (
		check_broker_availability,
		book_appointment,
		reschedule_appointment,
		cancel_appointment,
	)
	from .knowledge import search_knowledge
	from .interaction import (
		save_interaction,
		assign_tracking_number,
		send_appointment_confirmation,
		verify_appointment_confirmation,
	)
	from .conversation_flags import (
		mark_ready_to_book,
		mark_has_objection,
		mark_objection_handled,
		mark_questions_answered,
		mark_qualification_result,
		mark_quote_presented,
		mark_wrong_person,
		clear_conversation_flags,
	)

	# Lead Management (5)
	_try_register(
		agent,
		name="get_lead_context",
		description="Get lead information by phone number; returns lead, broker, property context.",
		parameters={"type": "object", "properties": {"phone": _p_str("Phone number of the lead (any format)")}, "required": ["phone"]},
		handler=lambda args, *_: get_lead_context(args.get("phone")),
	)
	_try_register(
		agent,
		name="verify_caller_identity",
		description="Verify caller identity by name and phone. Creates lead if new.",
		parameters={"type": "object", "properties": {"first_name": _p_str("Caller first name"), "phone": _p_str("Caller phone")}, "required": ["first_name", "phone"]},
		handler=lambda args, *_: verify_caller_identity(args.get("first_name"), args.get("phone")),
	)
	_try_register(
		agent,
		name="check_consent_dnc",
		description="Check consent and DNC status for a phone number.",
		parameters={"type": "object", "properties": {"phone": _p_str("Phone number to check")}, "required": ["phone"]},
		handler=lambda args, *_: check_consent_dnc(args.get("phone")),
	)
	_try_register(
		agent,
		name="update_lead_info",
		description="Update lead fields gathered during the call.",
		parameters={
			"type": "object",
			"properties": {
				"lead_id": _p_str("Lead UUID"),
				"first_name": _p_opt_str("First name"),
				"last_name": _p_opt_str("Last name"),
				"email": _p_opt_str("Email"),
				"phone": _p_opt_str("Phone"),
				"property_address": _p_opt_str("Property address"),
				"property_city": _p_opt_str("Property city"),
				"property_state": _p_opt_str("Property state"),
				"property_zip": _p_opt_str("Property ZIP"),
				"age": _p_int("Age"),
				"money_purpose": _p_opt_str("Money purpose"),
				"amount_needed": {"type": "number", "description": "Amount needed"},
				"timeline": _p_opt_str("Timeline"),
			},
			"required": ["lead_id"],
		},
		handler=lambda args, *_: update_lead_info(
			args.get("lead_id"),
			args.get("first_name"),
			args.get("last_name"),
			args.get("email"),
			args.get("phone"),
			args.get("property_address"),
			args.get("property_city"),
			args.get("property_state"),
			args.get("property_zip"),
			args.get("age"),
			args.get("money_purpose"),
			args.get("amount_needed"),
			args.get("timeline"),
		),
	)
	_try_register(
		agent,
		name="find_broker_by_territory",
		description="Find a broker by ZIP/city/state.",
		parameters={
			"type": "object",
			"properties": {
				"zip_code": _p_opt_str("ZIP code"),
				"city": _p_opt_str("City"),
				"state": _p_opt_str("State abbreviation"),
			},
			"required": [],
		},
		handler=lambda args, *_: find_broker_by_territory(args.get("zip_code"), args.get("city"), args.get("state")),
	)

	# Calendar (4)
	_try_register(
		agent,
		name="check_broker_availability",
		description="Check broker calendar availability for next 14 days.",
		parameters={
			"type": "object",
			"properties": {
				"broker_id": _p_str("Broker UUID"),
				"preferred_day": _p_opt_str("Preferred day (monday..sunday)"),
				"preferred_time": _p_opt_str("Preferred time (morning|afternoon|evening)"),
			},
			"required": ["broker_id"],
		},
		handler=lambda args, *_: check_broker_availability(args.get("broker_id"), args.get("preferred_day"), args.get("preferred_time")),
	)
	_try_register(
		agent,
		name="book_appointment",
		description="Book an appointment and create calendar event.",
		parameters={
			"type": "object",
			"properties": {
				"lead_id": _p_str("Lead UUID"),
				"broker_id": _p_str("Broker UUID"),
				"scheduled_for": _p_str("ISO 8601 datetime"),
				"notes": _p_opt_str("Notes"),
			},
			"required": ["lead_id", "broker_id", "scheduled_for"],
		},
		handler=lambda args, *_: book_appointment(args.get("lead_id"), args.get("broker_id"), args.get("scheduled_for"), args.get("notes")),
	)
	_try_register(
		agent,
		name="reschedule_appointment",
		description="Reschedule an existing appointment.",
		parameters={
			"type": "object",
			"properties": {
				"interaction_id": _p_str("Appointment interaction ID"),
				"new_scheduled_for": _p_str("New ISO 8601 datetime"),
				"reason": _p_opt_str("Reason"),
			},
			"required": ["interaction_id", "new_scheduled_for"],
		},
		handler=lambda args, *_: reschedule_appointment(args.get("interaction_id"), args.get("new_scheduled_for"), args.get("reason")),
	)
	_try_register(
		agent,
		name="cancel_appointment",
		description="Cancel an existing appointment.",
		parameters={
			"type": "object",
			"properties": {
				"interaction_id": _p_str("Appointment interaction ID"),
				"reason": _p_opt_str("Reason"),
			},
			"required": ["interaction_id"],
		},
		handler=lambda args, *_: cancel_appointment(args.get("interaction_id"), args.get("reason")),
	)

	# Knowledge (1)
	_try_register(
		agent,
		name="search_knowledge",
		description="Search reverse mortgage knowledge base for accurate answers.",
		parameters={"type": "object", "properties": {"question": _p_str("Question text")}, "required": ["question"]},
		handler=lambda args, *_: search_knowledge(args.get("question")),
	)

	# Interaction (4)
	_try_register(
		agent,
		name="save_interaction",
		description="Save a call interaction summary and outcome.",
		parameters={
			"type": "object",
			"properties": {
				"lead_id": _p_str("Lead UUID"),
				"broker_id": _p_opt_str("Broker UUID"),
				"duration_seconds": _p_int("Call duration (seconds)"),
				"outcome": _p_str("Outcome"),
				"content": _p_str("Summary content"),
				"recording_url": _p_opt_str("Recording URL"),
				"metadata": _p_opt_str("JSON metadata string"),
			},
			"required": ["lead_id", "outcome", "content"],
		},
		handler=lambda args, *_: save_interaction(
			args.get("lead_id"),
			args.get("broker_id"),
			args.get("duration_seconds"),
			args.get("outcome"),
			args.get("content"),
			args.get("recording_url"),
			args.get("metadata"),
		),
	)
	_try_register(
		agent,
		name="assign_tracking_number",
		description="Assign a SignalWire tracking number to a lead for attribution.",
		parameters={"type": "object", "properties": {"lead_id": _p_str("Lead UUID"), "broker_id": _p_str("Broker UUID")}, "required": ["lead_id", "broker_id"]},
		handler=lambda args, *_: assign_tracking_number(args.get("lead_id"), args.get("broker_id")),
	)
	_try_register(
		agent,
		name="send_appointment_confirmation",
		description="Send appointment confirmation via SMS.",
		parameters={"type": "object", "properties": {"phone": _p_str("Phone number"), "appointment_datetime": _p_str("ISO 8601 datetime")}, "required": ["phone", "appointment_datetime"]},
		handler=lambda args, *_: send_appointment_confirmation(args.get("phone"), args.get("appointment_datetime")),
	)
	_try_register(
		agent,
		name="verify_appointment_confirmation",
		description="Verify appointment confirmation code from SMS.",
		parameters={"type": "object", "properties": {"phone": _p_str("Phone number"), "code": _p_str("Code to verify")}, "required": ["phone", "code"]},
		handler=lambda args, *_: verify_appointment_confirmation(args.get("phone"), args.get("code")),
	)

	# Conversation Flags (7)
	_try_register(
		agent,
		name="mark_ready_to_book",
		description="Mark caller as ready to book an appointment.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone")}, "required": ["phone"]},
		handler=lambda args, *_: mark_ready_to_book(args.get("phone")),
	)
	_try_register(
		agent,
		name="mark_has_objection",
		description="Mark that the caller raised an objection.",
		parameters={
			"type": "object",
			"properties": {
				"phone": _p_str("Caller phone"),
				"current_node": _p_opt_str("Node where objection raised"),
				"objection_type": _p_opt_str("Type of objection"),
			},
			"required": ["phone"],
		},
		handler=lambda args, *_: mark_has_objection(args.get("phone"), args.get("current_node"), args.get("objection_type")),
	)
	_try_register(
		agent,
		name="mark_objection_handled",
		description="Mark that an objection has been resolved.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone")}, "required": ["phone"]},
		handler=lambda args, *_: mark_objection_handled(args.get("phone")),
	)
	_try_register(
		agent,
		name="mark_questions_answered",
		description="Mark that caller's questions have been answered.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone")}, "required": ["phone"]},
		handler=lambda args, *_: mark_questions_answered(args.get("phone")),
	)
	_try_register(
		agent,
		name="mark_qualification_result",
		description="Persist qualification outcome.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone"), "qualified": _p_bool("Qualified?")}, "required": ["phone", "qualified"]},
		handler=lambda args, *_: mark_qualification_result(args.get("phone"), bool(args.get("qualified"))),
	)
	_try_register(
		agent,
		name="mark_quote_presented",
		description="Mark that a quote has been presented with reaction.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone"), "quote_reaction": _p_str("Reaction")}, "required": ["phone", "quote_reaction"]},
		handler=lambda args, *_: mark_quote_presented(args.get("phone"), args.get("quote_reaction")),
	)
	_try_register(
		agent,
		name="mark_wrong_person",
		description="Mark wrong person; optionally indicate if right person is available.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone"), "right_person_available": _p_bool("Right person available?")}, "required": ["phone"]},
		handler=lambda args, *_: mark_wrong_person(args.get("phone"), bool(args.get("right_person_available"))),
	)
	_try_register(
		agent,
		name="clear_conversation_flags",
		description="Clear all conversation flags for a fresh start.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone")}, "required": ["phone"]},
		handler=lambda args, *_: clear_conversation_flags(args.get("phone")),
	)


