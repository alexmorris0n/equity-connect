"""
Session userdata for LiveKit agent state management.

This follows the LiveKit pattern for storing custom state across agent handoffs.
Documentation: https://docs.livekit.io/agents/build/agents-handoffs#passing-state
"""

from dataclasses import dataclass
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from routing_coordinator import RoutingCoordinator

@dataclass
class BarbaraSessionData:
    """Custom session state for Barbara voice agent.
    
    Attributes:
        coordinator: Reference to RoutingCoordinator for managing node transitions
        phone_number: Caller's phone number for database lookups
        vertical: Business vertical (e.g., "reverse_mortgage")
        current_node: Name of the current conversation node
    
    Example from LiveKit docs:
        @dataclass
        class MySessionInfo:
            user_name: str | None = None
            age: int | None = None
    """
    coordinator: Optional["RoutingCoordinator"] = None
    phone_number: Optional[str] = None
    vertical: str = "reverse_mortgage"
    current_node: Optional[str] = None

