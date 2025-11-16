"""Interaction service stubs used by SWAIG tools."""

import json
import logging

logger = logging.getLogger(__name__)


def assign_tracking_number_core(lead_id: str, broker_id: str) -> str:
	"""Placeholder assign tracking number logic."""
	logger.info(f"Assign tracking number requested lead={lead_id}, broker={broker_id}")
	return json.dumps(
		{
			"success": False,
			"message": "Assign tracking number functionality not yet implemented.",
		}
	)


def send_appointment_confirmation_core(phone: str, appointment_datetime: str) -> str:
	"""Placeholder SMS confirmation logic."""
	logger.info(f"Send appointment confirmation requested for {phone}")
	return json.dumps(
		{
			"success": False,
			"message": "Send appointment confirmation functionality not yet implemented.",
		}
	)


def verify_appointment_confirmation_core(phone: str, code: str) -> str:
	"""Placeholder verification logic."""
	logger.info(f"Verify appointment confirmation requested for {phone}")
	return json.dumps(
		{
			"success": False,
			"message": "Verify appointment confirmation functionality not yet implemented.",
		}
	)

