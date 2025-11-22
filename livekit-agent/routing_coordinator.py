"""Routing Coordinator - Manages node transitions via agent handoffs.

This module provides the routing logic that was previously in BarbaraAgent.
It's extracted into a separate coordinator to work with node-specific agents.

The coordinator:
1. Checks if current node is complete (via step_criteria_lk boolean expressions or hardcoded fallback)
2. Determines next node (via router functions + database valid_contexts)
3. Creates new BarbaraNodeAgent for next node
4. Performs handoff via session.update_agent()
"""

import logging
from typing import Optional
from langgraph.graph import END

from services.conversation_state import get_conversation_state, update_conversation_state
from workflows.node_completion import is_node_complete
from workflows.routers import (
    route_after_greet,
    route_after_verify,
    route_after_qualify,
    route_after_quote,
    route_after_answer,
    route_after_objections,
    route_after_book,
    route_after_exit,
    validate_transition,
)

logger = logging.getLogger(__name__)


class RoutingCoordinator:
    """Coordinates routing between conversation nodes.
    
    This replaces the routing logic that was previously embedded in BarbaraAgent.
    It works with node-specific agents and performs handoffs via session.update_agent().
    """
    
    def __init__(self, phone: str, vertical: str = "reverse_mortgage"):
        """Initialize routing coordinator.
        
        Args:
            phone: Caller's phone number for state tracking
            vertical: Business vertical for routing logic
        """
        self.phone = phone
        self.vertical = vertical
        self._routing_in_progress = False  # Guard against concurrent routing calls
        
        # Map node names to router functions
        self.routers = {
            "greet": route_after_greet,
            "verify": route_after_verify,
            "qualify": route_after_qualify,
            "quote": route_after_quote,
            "answer": route_after_answer,
            "objections": route_after_objections,
            "book": route_after_book,
            "exit": route_after_exit,
            "goodbye": lambda s_row, s: END,  # Goodbye always ends
        }
    
    async def check_and_route(self, current_agent, session) -> Optional[str]:
        """Check if current node is complete and route to next node if needed.
        
        Args:
            current_agent: The currently active BarbaraNodeAgent
            session: The AgentSession instance
            
        Returns:
            Next node name if routing occurred, None if staying in current node
        """
        # Guard against concurrent routing calls (prevents double-handoff)
        if self._routing_in_progress:
            logger.debug(f"⏸️  Routing already in progress, skipping duplicate check")
            return None
        
        self._routing_in_progress = True
        try:
            return await self._do_routing_check(current_agent, session)
        finally:
            self._routing_in_progress = False
    
    async def _do_routing_check(self, current_agent, session) -> Optional[str]:
        """Internal routing logic (called by check_and_route with lock protection).
        
        Args:
            current_agent: The currently active BarbaraNodeAgent
            session: The AgentSession instance
            
        Returns:
            Next node name if routing occurred, None if staying in current node
        """
        # ✅ Access current_node via session.userdata (matches docs pattern)
        # From docs: "if self.session.userdata.user_name and self.session.userdata.age"
        current_node = session.userdata.current_node
        logger.info(f"🔍 Routing check from node: {current_node}")
        
        # Get conversation state from DB
        state_row = get_conversation_state(self.phone)
        if not state_row:
            logger.warning("No state found in DB")
            return None
        
        # Extract conversation_data (contains flags)
        cd = state_row.get("conversation_data") or {}
        
        # Increment turn count for current node (supports step_criteria_lk turn counting expressions)
        try:
            node_turn_key = f"{current_node}_turn_count"
            current_count = cd.get(node_turn_key, 0)
            new_count = current_count + 1
            
            # Update turn count in conversation_data
            updated_cd = cd.copy()
            updated_cd[node_turn_key] = new_count
            update_conversation_state(self.phone, {
                "conversation_data": updated_cd
            })
            logger.debug(f"📊 Incremented {node_turn_key}: {current_count} → {new_count}")
        except Exception as e:
            logger.warning(f"Failed to increment turn count for {current_node}: {e}")
        
        # Increment node visit count for ANSWER and VERIFY nodes to enable loop cap logic
        try:
            if current_node in ["answer", "verify"]:
                node_visits = cd.get("node_visits") or {}
                visits = (node_visits.get(current_node) or 0) + 1
                node_visits[current_node] = visits
                update_conversation_state(self.phone, {
                    "conversation_data": {
                        "node_visits": node_visits
                    }
                })
                logger.debug(f"📊 Node '{current_node}' visit count: {visits}")
        except Exception as e:
            logger.warning(f"Failed to increment node visits: {e}")
        
        # Get updated state after turn count increment
        state_row = get_conversation_state(self.phone)
        state = state_row.get("conversation_data", {}) if state_row else {}
        try:
            session.userdata.call_reason_summary = state.get("call_reason_summary")
        except Exception as userdata_error:
            logger.debug(f"Failed to copy call_reason_summary into session userdata: {userdata_error}")
        
        # Check if current node is complete (supports database step_criteria_lk boolean expressions)
        if not is_node_complete(current_node, state, vertical=self.vertical, state_row=state_row):
            logger.info(f"⏳ Node '{current_node}' not complete yet")
            return None
        
        # Route to next node using router logic
        next_node = self.route_next(current_node, state_row, state)
        
        # Validate transition against database valid_contexts (enforce like SignalWire)
        is_valid, valid_contexts = validate_transition(current_node, next_node, vertical=self.vertical)
        
        if not is_valid:
            logger.error(f"❌ BLOCKED: Invalid transition {current_node} → {next_node} (valid: {valid_contexts})")
            logger.info(f"⏸️  Staying in current node '{current_node}' - router suggested invalid transition")
            return None  # Don't transition - stay in current node (fail closed, like SignalWire)
        
        logger.info(f"🧭 Router: {current_node} → {next_node}")
        
        if next_node == END or next_node == "goodbye":
            logger.info("🏁 Conversation complete")
            # Optionally say goodbye
            await session.generate_reply(
                instructions="Say a warm goodbye and thank them for their time."
            )
            return "goodbye"
        elif next_node != current_node:
            # Perform agent handoff to new node
            await self.handoff_to_node(next_node, current_agent, session)
            return next_node
        
        return None
    
    def route_next(self, current_node: str, state_row: dict | None, conversation_data: dict | None) -> str:
        """Use router functions to determine next node.
        
        Args:
            current_node: Current node name
            state_row: Full conversation state row from database
            conversation_data: conversation_data field (flags and state)
            
        Returns:
            Next node name (or END)
        """
        router_func = self.routers.get(current_node)
        if not router_func:
            logger.warning(f"No router for node '{current_node}' - ending")
            return END
        
        try:
            state_payload = {
                "phone_number": self.phone,
                "_state_row": state_row,
            }
            if conversation_data is not None:
                state_payload["_conversation_data"] = conversation_data
            next_node = router_func(state_payload)
            logger.info(f"📍 Router '{current_node}' suggests: {next_node}")
            return next_node
        except Exception as e:
            logger.error(f"Router error for '{current_node}': {e}")
            return END
    
    async def handoff_to_node(self, next_node: str, current_agent, session):
        """Perform agent handoff to a new node.
        
        Creates a new BarbaraNodeAgent for the target node and updates the session.
        Preserves conversation history via chat_ctx.
        
        Includes error handling: If handoff fails, conversation continues in current node.
        
        Args:
            next_node: Target node name
            current_agent: Current BarbaraNodeAgent instance
            session: AgentSession instance
        """
        from node_agent import BarbaraNodeAgent
        
        try:
            logger.info(f"🔄 Handoff: {session.userdata.current_node} → {next_node}")
            
            # ✅ Update userdata BEFORE creating new agent (matches docs pattern)
            # From docs: "context.userdata.user_name = name" then handoff
            session.userdata.current_node = next_node
            logger.debug(f"📝 Updated session.userdata.current_node = '{next_node}'")

            # Get filler utterance to cover handoff latency
            filler = self._handoff_filler_for(next_node, session)
            if filler:
                # Use session.say() for instant TTS without LLM call
                logger.info(f"🗣️ Speaking filler before handoff: '{filler}'")
                await session.say(filler, allow_interruptions=False)
            
            # Safely extract chat_ctx (validate structure)
            chat_ctx = None
            try:
                chat_ctx = current_agent.chat_ctx
                # Validate chat_ctx has required structure
                if not hasattr(chat_ctx, 'items'):
                    logger.warning(f"⚠️ chat_ctx missing 'items' attribute, using fresh context")
                    chat_ctx = None
            except Exception as ctx_error:
                logger.error(f"❌ Failed to access chat_ctx: {ctx_error}, using fresh context")
                chat_ctx = None
            
            # Create new agent for target node
            new_agent = BarbaraNodeAgent(
                node_name=next_node,
                vertical=self.vertical,
                phone_number=self.phone,
                chat_ctx=chat_ctx,  # Preserve conversation history (or None if invalid)
                coordinator=self,  # Pass coordinator reference for automatic routing
                lead_context=getattr(session.userdata, "lead_context", None)
            )
            
            # Perform handoff (triggers new_agent.on_enter())
            session.update_agent(new_agent)
            logger.info(f"✅ Handoff complete: now in '{next_node}'")
            
            # ✅ Prevent old agent from generating a reply after handoff
            # From LiveKit docs: "raise StopResponse() to stop the agent from generating a reply"
            # This prevents duplicate responses when routing in on_user_turn_completed
            from livekit.agents.llm import StopResponse
            raise StopResponse()
            
        except Exception as e:
            logger.error(f"❌ Handoff FAILED: {session.userdata.current_node} → {next_node}: {e}", exc_info=True)
            # Stay in current agent - conversation continues
            logger.info(f"⏸️  Staying in '{session.userdata.current_node}' due to handoff failure")
            # Optionally inform user there's a technical issue
            try:
                await session.generate_reply(
                    instructions="Continue the conversation naturally. If there was a brief pause, acknowledge it casually and continue."
                )
            except Exception as recovery_error:
                logger.error(f"❌ Failed to generate recovery message: {recovery_error}")

    def _handoff_filler_for(self, next_node: str, session) -> Optional[str]:
        """Return a short filler utterance to cover agent swap latency."""
        reason = getattr(session.userdata, "call_reason_summary", None)
        if next_node == "answer":
            return "Perfect, let me help you with that."
        if next_node == "verify":
            return "Let me just pull up your information real quick."
        if next_node == "qualify":
            return "Great, let me ask you a few quick questions."
        if next_node == "quote":
            return "Perfect, let me run those numbers for you."
        if next_node == "book":
            return "Excellent, let me get you scheduled."
        if next_node == "objections":
            return "Let me address that for you."
        if next_node == "goodbye":
            return None  # Let goodbye node handle its own farewell
        return None


# Export the coordinator class
__all__ = ["RoutingCoordinator"]

