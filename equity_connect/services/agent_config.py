"""Agent configuration loading from Supabase."""
import logging
import os
from typing import Any, Dict, Optional

from supabase import Client, create_client

logger = logging.getLogger(__name__)

_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
	"""Return cached Supabase client or create one."""
	global _supabase_client
	if _supabase_client is None:
		url = os.getenv("SUPABASE_URL")
		key = os.getenv("SUPABASE_SERVICE_KEY")
		if not url or not key:
			raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
		_supabase_client = create_client(url, key)
	return _supabase_client


def get_agent_params(vertical: str = "reverse_mortgage", language: str = "en-US") -> Dict[str, Any]:
	"""
	Load the agent parameter record for a given vertical/language combination.

	Returns defaults if no row is found or the query fails.
	"""
	defaults = _get_default_params()
	try:
		supabase = get_supabase_client()
		result = supabase.table("agent_params")\
			.select("*")\
			.eq("vertical", vertical)\
			.eq("language", language)\
			.eq("is_active", True)\
			.single()\
			.execute()

		if result.data:
			logger.info(
				f"✅ Loaded agent params for {vertical}/{language}: "
				f"attention_timeout={result.data.get('attention_timeout')}ms"
			)
			merged = {**defaults, **result.data}
			return merged

		logger.warning(f"⚠️ No agent params row found for {vertical}/{language}, using defaults.")
		return defaults
	except Exception as exc:
		logger.error(f"Error loading agent params for {vertical}/{language}: {exc}")
		return defaults


def _get_default_params() -> Dict[str, Any]:
	"""Fallback defaults mirroring database seed values."""
	return {
		"attention_timeout": 8000,
		"attention_timeout_prompt": (
			"The caller may be thinking or didn't hear the question. "
			"Gently ask if they need you to repeat anything or explain it differently. "
			"Stay warm and patient—don't sound frustrated."
		),
		"end_of_speech_timeout": 800,
		"hard_stop_time": "30m",
		"hard_stop_prompt": (
			"I want to make sure I'm respecting your time. We've covered a lot—would you like me to "
			"connect you with {broker.first_name} to continue, or would you prefer to think it over and call back?"
		),
		"first_word_timeout": 1000,
		"acknowledge_interruptions": 3,
		"interrupt_prompt": (
			"The caller interrupted you, which likely means they have an important question or concern. "
			"Acknowledge their interruption warmly ('Oh, absolutely—'), directly address what they said, "
			"then naturally return to your point if needed. Never sound annoyed or frustrated."
		),
		"transparent_barge": True,
		"enable_barge": "complete,partial",
		"ai_volume": 0,
		"background_file": None,
		"background_file_volume": -40,
		"background_file_loops": -1,
		"eleven_labs_stability": None,
		"eleven_labs_similarity": None,
		"max_emotion": 30,
		"wait_for_user_default": False,
		"local_tz_default": "America/Los_Angeles",
		"static_greeting": None,
		"static_greeting_no_barge": False,
		"energy_level": 52,
		"inactivity_timeout": 600000,
		"outbound_attention_timeout": 120000,
		"is_active": True,
	}


if __name__ == "__main__":
	params = get_agent_params()
	print(f"Loaded {len(params.keys())} agent parameters (attention_timeout={params['attention_timeout']}ms)")

