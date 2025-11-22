"""
LiveKit Native Agent System

This module contains Barbara's conversation agents using LiveKit's native
agent handoff architecture instead of custom node routing.

Architecture:
- Agents: Long-lived conversation phases (greet, answer, quote, etc.)
- Tasks: Required data collection steps (verify, qualify)
- Tools: Actions agents can take (route, search, mark flags)

Key Difference from Node System:
- No routing_coordinator.py needed (LiveKit handles handoffs)
- No routers.py needed (tools return next agent)
- No step_criteria needed (tool calls determine completion)

Handoff Pattern:
    @function_tool()
    async def route_to_next(self):
        return NextAgent(chat_ctx=self.session.chat_ctx)

Task Pattern:
    class MyTask(AgentTask[ResultType]):
        @function_tool()
        async def complete_task(self):
            self.complete(result)
"""

from .greet import BarbaraGreetAgent
from .verify import BarbaraVerifyTask
from .qualify import BarbaraQualifyTask
from .answer import BarbaraAnswerAgent
from .quote import BarbaraQuoteAgent
from .objections import BarbaraObjectionsAgent
from .book import BarbaraBookAgent
from .goodbye import BarbaraGoodbyeAgent

__all__ = [
    "BarbaraGreetAgent",
    "BarbaraVerifyTask",
    "BarbaraQualifyTask",
    "BarbaraAnswerAgent",
    "BarbaraQuoteAgent",
    "BarbaraObjectionsAgent",
    "BarbaraBookAgent",
    "BarbaraGoodbyeAgent",
]

