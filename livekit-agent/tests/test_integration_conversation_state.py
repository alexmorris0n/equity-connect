import os
import pytest
from datetime import datetime, timedelta

# Ensure package imports work when running pytest from repo root
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.conversation_state import (
	start_call,
	get_conversation_state,
	update_conversation_state,
	mark_call_completed,
)


skip_no_supabase = pytest.mark.skipif(
	not (os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_KEY")),
	reason="Supabase credentials not set"
)


@skip_no_supabase
def test_start_call_reuse_and_idempotent_completion():
	"""Ensure call_count increments only on start_call and completion is idempotent."""
	phone = "+15551231234"

	# Fresh start
	row1 = start_call(phone, {"lead_id": None, "qualified": False})
	assert row1["call_status"] == "active"
	assert int(row1["call_count"]) >= 1

	# Complete once
	mark1 = mark_call_completed(phone, exit_reason="hangup")
	assert mark1 and mark1["call_status"] == "completed"

	# Complete again (idempotent)
	mark2 = mark_call_completed(phone, exit_reason="hangup")
	assert mark2 and mark2["call_status"] == "completed"
	assert mark2["call_count"] == mark1["call_count"]

	# Start a new call (reuse row) - increments count
	row2 = start_call(phone, {"qualified": True})
	assert row2["call_status"] == "active"
	assert int(row2["call_count"]) == int(mark2["call_count"]) + 1


@skip_no_supabase
def test_wrong_person_transfer_available_flow():
	"""Simulate wrong person then spouse becomes available; router will re-greet."""
	phone = "+15557654321"
	start_call(phone, {"lead_id": None, "qualified": False})

	# After verify: wrong person, not yet available
	update_conversation_state(phone, {
		"current_node": "verify",
		"conversation_data": {
			"verified": False,
			"wrong_person": True,
			"right_person_available": False
		}
	})
	row = get_conversation_state(phone)
	assert row and row["conversation_data"].get("wrong_person") is True

	# Exit node detects availability after brief hold
	update_conversation_state(phone, {
		"current_node": "exit",
		"conversation_data": {
			"right_person_available": True
		}
	})
	row2 = get_conversation_state(phone)
	assert row2 and row2["conversation_data"].get("right_person_available") is True


