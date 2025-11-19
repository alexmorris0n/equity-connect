"""Conversation state service backed by Supabase.

Responsibilities:
- Maintain one durable row per phone_number (optionally lead_id)
- Idempotent lifecycle: start_call, update_conversation_state, mark_call_completed
- Deep-merge semantics for conversation_data:
  - Scalars overwrite
  - Nested dicts merge recursively
  - Arrays append-unique by value
  - Passing None removes the key
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone
import copy
import logging
import re

from .supabase import get_supabase_client, normalize_phone

logger = logging.getLogger(__name__)

TABLE_NAME = "conversation_state"

# -----------------------------
# Deep merge for JSON semantics
# -----------------------------

def _append_unique(existing: List[Any], incoming: List[Any]) -> List[Any]:
	"""Append-unique merge for list values, preserving order of first appearance."""
	seen = set()
	result: List[Any] = []
	for value in existing + incoming:
		key = _to_hashable(value)
		if key not in seen:
			seen.add(key)
			result.append(value)
	return result


def _to_hashable(value: Any) -> Any:
	"""Turn JSON-like values into hashable keys for set membership checks."""
	if isinstance(value, dict):
		# Sort keys for deterministic hashing
		return tuple(sorted((k, _to_hashable(v)) for k, v in value.items()))
	if isinstance(value, list):
		return tuple(_to_hashable(v) for v in value)
	return value


def deep_merge_json(base: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
	"""
	Deep-merge two JSON-like dicts following plan rules.
	- Scalars overwrite
	- Dicts merge recursively
	- Lists append-unique
	- None deletes the key
	"""
	merged = copy.deepcopy(base) if base else {}
	for key, new_value in (updates or {}).items():
		if new_value is None:
			# Delete key if present
			if key in merged:
				del merged[key]
			continue
		old_value = merged.get(key)
		if isinstance(old_value, dict) and isinstance(new_value, dict):
			merged[key] = deep_merge_json(old_value, new_value)
		elif isinstance(old_value, list) and isinstance(new_value, list):
			merged[key] = _append_unique(old_value, new_value)
		else:
			merged[key] = copy.deepcopy(new_value)
	return merged


# -----------------------------
# Core CRUD helpers
# -----------------------------

def _fetch_by_phone(phone: str) -> Optional[Dict[str, Any]]:
	"""Fetch the single conversation_state row for a phone number (various normalizations)."""
	supabase = get_supabase_client()
	normalized = normalize_phone(phone)
	candidates = [phone]
	if normalized and len(normalized) == 10:
		candidates.append(f"+1{normalized}")
		candidates.append(normalized)
	
	# Build OR filter - try each candidate phone number
	# Supabase Python client: .or_() comes after .select()
	or_conditions = ",".join([f"phone_number.eq.{c}" for c in candidates])
	resp = supabase.table(TABLE_NAME).select("*").or_(or_conditions).limit(1).execute()
	if resp.data:
		return resp.data[0]
	return None


def _ensure_phone_format(phone: str) -> Tuple[str, str]:
	"""Return (e164_or_original, last10) tuple for consistent storage/lookup."""
	digits = re.sub(r"\D", "", phone or "")
	last10 = digits[-10:] if len(digits) >= 10 else digits
	e164 = f"+1{last10}" if len(last10) == 10 and not phone.startswith("+") else phone
	return (e164 or phone, last10)


def _reset_transient_fields(existing: Dict[str, Any]) -> Dict[str, Any]:
	"""Compute transient resets while preserving durables per plan."""
	next_values: Dict[str, Any] = {}
	# Top-level fields
	next_values["current_node"] = None
	next_values["call_status"] = "active"
	next_values["call_ended_at"] = None
	next_values["exit_reason"] = None
	next_values["last_call_at"] = datetime.now(timezone.utc).isoformat()
	# Preserve topics_discussed (durable)
	# Conversation data resets (remove transient flags)
	existing_cd = (existing or {}).get("conversation_data") or {}
	transient_keys = {
		"verified",
		"wrong_person",
		"right_person_available",
		"ready_to_book",
		"has_objections",
		"appointment_booked",
		"appointment_datetime",
		"node_visits",
		"kb_sources_count",
		"kb_latency_ms",
		"exit_reason",  # if previously stored in conversation_data
	}
	cd_resets = {k: None for k in transient_keys if k in existing_cd}
	if cd_resets:
		next_values["conversation_data"] = cd_resets
	return next_values


# -----------------------------
# Public API
# -----------------------------

def start_call(phone: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
	"""
	Start (or reuse) a call session for the given phone.
	- If no row exists: create it (call_count=1, status=active)
	- If row exists and active: mark completed (interrupted) then reuse
	- If row exists and completed: reuse, increment call_count
	"""
	if not phone:
		raise ValueError("start_call requires phone")

	phone_value, _ = _ensure_phone_format(phone)
	existing = _fetch_by_phone(phone_value)
	supabase = get_supabase_client()

	if existing is None:
		payload = {
			"phone_number": phone_value,
			"lead_id": (metadata or {}).get("lead_id"),
			"qualified": bool((metadata or {}).get("qualified", False)),
			"current_node": None,
			"conversation_data": {},
			"call_count": 1,
			"last_call_at": datetime.now(timezone.utc).isoformat(),
			"topics_discussed": [],
			"call_status": "active",
			"call_ended_at": None,
			"exit_reason": None,
		}
		resp = supabase.table(TABLE_NAME).insert(payload).select("*").execute()
		return resp.data[0]

	# If an active call exists, mark as completed (interrupted) before reuse
	if existing.get("call_status") == "active":
		supabase.table(TABLE_NAME).update({
			"call_status": "completed",
			"call_ended_at": datetime.now(timezone.utc).isoformat(),
			"exit_reason": "interrupted_or_replaced",
		}).eq("id", existing["id"]).execute()
		# Re-read
		existing = _fetch_by_phone(phone_value) or existing

	# Reuse flow: increment count, reset transients, preserve durables
	reset_updates = _reset_transient_fields(existing)
	update_payload: Dict[str, Any] = {
		"call_count": int(existing.get("call_count", 0)) + 1,
		"last_call_at": datetime.now(timezone.utc).isoformat(),
		# keep lead_id/qualified/topics_discussed unless metadata overrides qualified
	}
	if metadata and "qualified" in metadata:
		update_payload["qualified"] = bool(metadata["qualified"])
	# Merge conversation_data resets if present
	if "conversation_data" in reset_updates:
		# Apply deletions by re-merge with None semantics
		new_cd = deep_merge_json(existing.get("conversation_data") or {}, reset_updates["conversation_data"])
		update_payload["conversation_data"] = new_cd
	# Apply other top-level resets
	for k, v in reset_updates.items():
		if k == "conversation_data":
			continue
		update_payload[k] = v

	resp = supabase.table(TABLE_NAME).update(update_payload).eq("id", existing["id"]).select("*").execute()
	return resp.data[0]


def get_conversation_state(phone: str) -> Optional[Dict[str, Any]]:
	"""Return conversation_state row for phone."""
	return _fetch_by_phone(phone)


def update_conversation_state(phone: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
	"""
	Deep-merge update for conversation_state.
	- conversation_data is deep-merged with append-unique arrays and None deletions
	- top-level fields are overwritten as given
	"""
	row = _fetch_by_phone(phone)
	if not row:
		return None
	supabase = get_supabase_client()

	current_cd = row.get("conversation_data") or {}
	incoming_cd = (updates or {}).get("conversation_data") or {}
	merged_cd = deep_merge_json(current_cd, incoming_cd) if incoming_cd else current_cd

	# Build payload with top-level overwrites + merged conversation_data
	payload = {k: v for k, v in (updates or {}).items() if k != "conversation_data"}
	if incoming_cd or current_cd:
		payload["conversation_data"] = merged_cd

	resp = supabase.table(TABLE_NAME).update(payload).eq("id", row["id"]).select("*").execute()
	return resp.data[0] if resp.data else None


def mark_call_completed(phone: str, exit_reason: Optional[str] = None) -> Optional[Dict[str, Any]]:
	"""
	Idempotent completion:
	- Only transition active -> completed
	- Preserve call_count
	"""
	row = _fetch_by_phone(phone)
	if not row:
		return None
	if row.get("call_status") != "active":
		# Already completed/abandoned; idempotent noop
		return row
	supabase = get_supabase_client()
	payload = {
		"call_status": "completed",
		"call_ended_at": datetime.now(timezone.utc).isoformat(),
		"exit_reason": exit_reason,
	}
	resp = supabase.table(TABLE_NAME).update(payload).eq("id", row["id"]).select("*").execute()
	return resp.data[0] if resp.data else None


def extract_phone_from_messages(messages: List[Any]) -> Optional[str]:
	"""Best-effort extraction of a phone number from message stream metadata or text."""
	# Handle LangChain Message objects (have attributes, not dict keys)
	for msg in messages or []:
		# Try to get metadata from LangChain Message object
		if hasattr(msg, "additional_kwargs"):
			meta = getattr(msg, "additional_kwargs", {})
			if isinstance(meta, dict):
				phone = meta.get("phone_number") or meta.get("from_number") or meta.get("caller")
				if phone:
					return phone
		# Fallback: treat as dict (for backward compatibility)
		elif isinstance(msg, dict):
			meta = msg.get("metadata") or {}
			if isinstance(meta, dict):
				phone = meta.get("phone_number") or meta.get("from_number") or meta.get("caller")
				if phone:
					return phone
	# 2) Search in content text for E.164
	e164 = _search_e164(messages or [])
	if e164:
		return e164
	return None


def _search_e164(messages: List[Any]) -> Optional[str]:
	pattern = re.compile(r"(\+\d{10,15})")
	for msg in messages:
		# Handle LangChain Message objects
		if hasattr(msg, "content"):
			content = getattr(msg, "content", "")
			if isinstance(content, str):
				found = pattern.search(content)
				if found:
					return found.group(1)
		# Fallback: treat as dict
		elif isinstance(msg, dict):
			for key in ("text", "content"):
				val = msg.get(key)
				if isinstance(val, str):
					found = pattern.search(val)
					if found:
						return found.group(1)
	return None


