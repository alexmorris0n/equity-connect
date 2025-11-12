from typing import Any, Dict

# Tool registration using SignalWire's official define_tool API.
# All business logic remains in tool files unchanged.


def _p_str(desc: str) -> Dict[str, Any]:
	return {"type": "string", "description": desc}


def _p_opt_str(desc: str) -> Dict[str, Any]:
	return {"type": "string", "description": desc, "nullable": True}


def _p_int(desc: str) -> Dict[str, Any]:
	return {"type": "integer", "description": desc}


def _p_bool(desc: str) -> Dict[str, Any]:
	return {"type": "boolean", "description": desc}


def register_all_tools(agent: Any) -> None:
	"""Register all 21 tools using SignalWire's define_tool API.
	
	All tool business logic remains unchanged - only the registration mechanism is adapted.
	"""
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
	agent.define_tool(
		name="get_lead_context",
		description="Get lead information by phone number; returns lead, broker, property context.",
		parameters={"type": "object", "properties": {"phone": _p_str("Phone number of the lead (any format)")}, "required": ["phone"]},
		handler=lambda args, raw_data: get_lead_context(args.get("phone")),
	)
	agent.define_tool(
		name="verify_caller_identity",
		description="Verify caller identity by name and phone. Creates lead if new.",
		parameters={"type": "object", "properties": {"first_name": _p_str("Caller first name"), "phone": _p_str("Caller phone")}, "required": ["first_name", "phone"]},
		handler=lambda args, raw_data: verify_caller_identity(args.get("first_name"), args.get("phone")),
	)
	agent.define_tool(
		name="check_consent_dnc",
		description="Check consent and DNC status for a phone number.",
		parameters={"type": "object", "properties": {"phone": _p_str("Phone number to check")}, "required": ["phone"]},
		handler=lambda args, raw_data: check_consent_dnc(args.get("phone")),
	)
	agent.define_tool(
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
		handler=lambda args, raw_data: update_lead_info(
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
	agent.define_tool(
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
		handler=lambda args, raw_data: find_broker_by_territory(args.get("zip_code"), args.get("city"), args.get("state")),
	)

	# Calendar (4)
	agent.define_tool(
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
		handler=lambda args, raw_data: check_broker_availability(args.get("broker_id"), args.get("preferred_day"), args.get("preferred_time")),
	)
	agent.define_tool(
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
		handler=lambda args, raw_data: book_appointment(args.get("lead_id"), args.get("broker_id"), args.get("scheduled_for"), args.get("notes")),
	)
	agent.define_tool(
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
		handler=lambda args, raw_data: reschedule_appointment(args.get("interaction_id"), args.get("new_scheduled_for"), args.get("reason")),
	)
	agent.define_tool(
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
		handler=lambda args, raw_data: cancel_appointment(args.get("interaction_id"), args.get("reason")),
	)

	# Knowledge (1)
	agent.define_tool(
		name="search_knowledge",
		description="Search reverse mortgage knowledge base for accurate answers.",
		parameters={"type": "object", "properties": {"question": _p_str("Question text")}, "required": ["question"]},
		handler=lambda args, raw_data: search_knowledge(args.get("question")),
	)

	# Interaction (4)
	agent.define_tool(
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
		handler=lambda args, raw_data: save_interaction(
			args.get("lead_id"),
			args.get("broker_id"),
			args.get("duration_seconds"),
			args.get("outcome"),
			args.get("content"),
			args.get("recording_url"),
			args.get("metadata"),
		),
	)
	agent.define_tool(
		name="assign_tracking_number",
		description="Assign a SignalWire tracking number to a lead for attribution.",
		parameters={"type": "object", "properties": {"lead_id": _p_str("Lead UUID"), "broker_id": _p_str("Broker UUID")}, "required": ["lead_id", "broker_id"]},
		handler=lambda args, raw_data: assign_tracking_number(args.get("lead_id"), args.get("broker_id")),
	)
	agent.define_tool(
		name="send_appointment_confirmation",
		description="Send appointment confirmation via SMS.",
		parameters={"type": "object", "properties": {"phone": _p_str("Phone number"), "appointment_datetime": _p_str("ISO 8601 datetime")}, "required": ["phone", "appointment_datetime"]},
		handler=lambda args, raw_data: send_appointment_confirmation(args.get("phone"), args.get("appointment_datetime")),
	)
	agent.define_tool(
		name="verify_appointment_confirmation",
		description="Verify appointment confirmation code from SMS.",
		parameters={"type": "object", "properties": {"phone": _p_str("Phone number"), "code": _p_str("Code to verify")}, "required": ["phone", "code"]},
		handler=lambda args, raw_data: verify_appointment_confirmation(args.get("phone"), args.get("code")),
	)

	# Conversation Flags (7)
	agent.define_tool(
		name="mark_ready_to_book",
		description="Mark caller as ready to book an appointment.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone")}, "required": ["phone"]},
		handler=lambda args, raw_data: mark_ready_to_book(args.get("phone")),
	)
	agent.define_tool(
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
		handler=lambda args, raw_data: mark_has_objection(args.get("phone"), args.get("current_node"), args.get("objection_type")),
	)
	agent.define_tool(
		name="mark_objection_handled",
		description="Mark that an objection has been resolved.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone")}, "required": ["phone"]},
		handler=lambda args, raw_data: mark_objection_handled(args.get("phone")),
	)
	agent.define_tool(
		name="mark_questions_answered",
		description="Mark that caller's questions have been answered.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone")}, "required": ["phone"]},
		handler=lambda args, raw_data: mark_questions_answered(args.get("phone")),
	)
	agent.define_tool(
		name="mark_qualification_result",
		description="Persist qualification outcome.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone"), "qualified": _p_bool("Qualified?")}, "required": ["phone", "qualified"]},
		handler=lambda args, raw_data: mark_qualification_result(args.get("phone"), bool(args.get("qualified"))),
	)
	agent.define_tool(
		name="mark_quote_presented",
		description="Mark that a quote has been presented with reaction.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone"), "quote_reaction": _p_str("Reaction")}, "required": ["phone", "quote_reaction"]},
		handler=lambda args, raw_data: mark_quote_presented(args.get("phone"), args.get("quote_reaction")),
	)
	agent.define_tool(
		name="mark_wrong_person",
		description="Mark wrong person; optionally indicate if right person is available.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone"), "right_person_available": _p_bool("Right person available?")}, "required": ["phone"]},
		handler=lambda args, raw_data: mark_wrong_person(args.get("phone"), bool(args.get("right_person_available"))),
	)
	agent.define_tool(
		name="clear_conversation_flags",
		description="Clear all conversation flags for a fresh start.",
		parameters={"type": "object", "properties": {"phone": _p_str("Caller phone")}, "required": ["phone"]},
		handler=lambda args, raw_data: clear_conversation_flags(args.get("phone")),
	)


