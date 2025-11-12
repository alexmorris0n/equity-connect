import logging
from typing import Any, Dict, Optional

from equity_connect.tools.registry import register_all_tools
from equity_connect.services.prompt_loader import load_node_prompt

logger = logging.getLogger(__name__)

# Optional import of SignalWire base
try:
	from signalwire_agents.core.agent_base import AgentBase  # type: ignore
	_Base = AgentBase
except Exception:
	_Base = object  # fallback for local dev without SDK


class BarbaraAgent(_Base):  # type: ignore[misc]
	def __init__(self, sw_context: Optional[Dict[str, Any]] = None) -> None:
		# When running with SignalWire SDK, call super with name/route
		if _Base is not object:
			try:
				super().__init__(name="barbara-agent", route="/agent")  # type: ignore[misc]
			except Exception:
				# Fallback if signature differs
				try:
					super().__init__()  # type: ignore[misc]
				except Exception:
					pass
		self.ctx = sw_context or {}
		register_all_tools(self)

	async def on_user_input(self, text: str) -> None:
		# ASR → LLM path is managed by SDK; placeholder for hooks if needed.
		return None

	async def speak(self, text: str) -> None:
		# Use SDK say/speak if available, otherwise log.
		say = getattr(self, "say", None)
		if callable(say):
			try:
				await say(text)  # type: ignore[func-returns-value]
			finally:
				# Ensure routing after playback completion
				await self.on_speech_committed()
		else:
			logger.info("speak() called (no SDK say available): %s", text)
			await self.on_speech_committed()

	async def on_speech_committed(self) -> None:
		await self.check_and_route()

	async def load_node(self, node_name: str, vertical: str = "reverse_mortgage") -> None:
		# Build instructions for node and update the agent prompt/instructions.
		instructions = load_node_prompt(node_name=node_name, vertical=vertical)
		await self._update_instructions(instructions)

	async def _update_instructions(self, instructions: str) -> None:
		# Try common SignalWire prompt APIs; otherwise store locally.
		for meth in ("prompt_set", "prompt_replace", "set_prompt"):
			fn = getattr(self, meth, None)
			if callable(fn):
				try:
					res = fn(instructions)  # may be sync
					if hasattr(res, "__await__"):
						await res  # type: ignore[attr-defined]
					return
				except Exception:
					continue
		# Fallback: keep in context for later use
		self.ctx["instructions"] = instructions

	async def check_and_route(self) -> None:
		# Router/checker integration will be connected here with DB state.
		logger.info("check_and_route() placeholder - routing will be wired to DB state")

	async def route_next(self, next_node: str) -> None:
		await self.load_node(next_node)


