import os
import pytest
from typing import Dict, Any

# Ensure package imports work when running pytest from repo root
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from workflows.routers import (
	route_after_greet,
	route_after_verify,
	route_after_qualify,
	route_after_answer,
	route_after_objections,
	route_after_exit,
)


class DummyState(dict):
	"""Minimal state dict with messages placeholder."""
	def __init__(self, **kwargs):
		super().__init__(messages=[], **kwargs)


def make_row(cd: Dict[str, Any] = None, **top) -> Dict[str, Any]:
	row = {
		"id": "test-row",
		"phone_number": "+15551234567",
		"lead_id": None,
		"qualified": False,
		"current_node": None,
		"conversation_data": cd or {},
		"call_status": "active",
	}
	row.update(top)
	return row


def test_route_known_qualified(monkeypatch):
	"""known qualified → greet → answer"""
	def mock_get(phone):
		return make_row(cd={}, lead_id="uuid-1", qualified=True)
	monkeypatch.setattr("workflows.routers.get_conversation_state", mock_get)
	state = DummyState(phone_number="+15551234567")
	assert route_after_greet(state) == "answer"


def test_route_unknown_caller(monkeypatch):
	"""unknown → greet → verify"""
	def mock_get(phone):
		return None
	monkeypatch.setattr("workflows.routers.get_conversation_state", mock_get)
	state = DummyState(phone_number="+15550999999")
	assert route_after_greet(state) == "verify"


def test_wrong_person_transfer_available(monkeypatch):
	"""wrong person, then right_person_available → exit router sends greet"""
	# First: wrong person, no spouse available yet
	def mock_get_1(phone):
		return make_row(cd={"wrong_person": True, "right_person_available": False})
	monkeypatch.setattr("workflows.routers.get_conversation_state", mock_get_1)
	state = DummyState(phone_number="+15551230000")
	assert route_after_verify(state) == "exit"

	# Next: exit node sets right_person_available=true (simulated)
	def mock_get_2(phone):
		return make_row(cd={"wrong_person": True, "right_person_available": True})
	monkeypatch.setattr("workflows.routers.get_conversation_state", mock_get_2)
	assert route_after_exit(state) == "greet"


def test_answer_loop_cap(monkeypatch):
	"""answer node visits > 5 → exit"""
	def mock_get(phone):
		return make_row(cd={"node_visits": {"answer": 6}})
	monkeypatch.setattr("workflows.routers.get_conversation_state", mock_get)
	state = DummyState(phone_number="+15558889999")
	assert route_after_answer(state) == "exit"


