"""Deprecated calendar tool module.

All SWAIG tools are registered directly on the agent and call
`equity_connect.services.calendar_service`. Import from that module instead.
"""

raise ImportError(
	"equity_connect.tools.calendar is deprecated. Use equity_connect.services.calendar_service instead."
)
