"""Deprecated lead tool module.

All SWAIG tools now live directly on the agent and call
`equity_connect.services.lead_service`. This module remains only so legacy
imports fail loudly if used.
"""

raise ImportError(
	"equity_connect.tools.lead is deprecated. Use equity_connect.services.lead_service instead."
)
