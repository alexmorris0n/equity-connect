"""Node Agent Factory - Creates database-driven agents for specific conversation nodes.

This module provides the BarbaraNodeAgent class which creates agent instances
that are configured from database settings for a specific conversation node.

Each node (greet, verify, qualify, etc.) gets its own agent instance with:
- Node-specific instructions from prompt_versions.content.instructions
- Node-specific tools from prompt_versions.content.tools (via tool_loader)
- Conversation history preserved via chat_ctx parameter

Documentation Reference:
    LiveKit Docs: /agents/build/agents-handoffs/#defining-an-agent
    "Extend the `Agent` class to define a custom agent"
    
    Example from docs:
        class HelpfulAssistant(Agent):
            def __init__(self):
                super().__init__(instructions="You are a helpful voice AI assistant.")
            
            async def on_enter(self) -> None:
                await self.session.generate_reply(instructions="Greet the user...")
    
    From drive-thru/agent.py (lines 49-87):
        class DriveThruAgent(Agent):
            def __init__(self, *, userdata: Userdata) -> None:
                instructions = (
                    COMMON_INSTRUCTIONS
                    + "\\n\\n"
                    + menu_instructions("drink", items=userdata.drink_items)
                )
                super().__init__(
                    instructions=instructions,
                    tools=[
                        self.build_regular_order_tool(...),
                        self.build_combo_order_tool(...),
                    ],
                )
"""

import logging
from typing import Optional
from livekit.agents import Agent
from livekit.agents.llm import ChatContext, ChatMessage
from services.prompt_loader import load_node_config
from tool_loader import load_tools_for_node

logger = logging.getLogger(__name__)


class BarbaraNodeAgent(Agent):
    """Agent for a specific conversation node with database-driven configuration.
    
    This agent is configured entirely from database settings:
    - Instructions: Loaded from prompt_versions.content.instructions
    - Tools: Loaded from prompt_versions.content.tools array
    
    Each node gets its own agent instance, allowing complete separation of:
    - Conversation logic per node
    - Tool availability per node
    - Instructions/personality per node
    
    Example:
        # Create agent for verify node
        verify_agent = BarbaraNodeAgent(
            node_name="verify",
            vertical="reverse_mortgage",
            phone_number="+15551234567",
            chat_ctx=previous_agent.chat_ctx  # Preserve history
        )
        
        # Agent has verify-specific instructions and tools
        # When session.update_agent(verify_agent) is called, this agent takes control
    
    Documentation:
        From LiveKit docs (/agents/build/agents-handoffs/#setting-the-active-agent):
        "The active agent is the agent currently in control of the session... 
        You can change the active agent using the update_agent method"
        
        From LiveKit docs (/agents/build/agents-handoffs/#context-preservation):
        "To include the prior conversation, set the chat_ctx parameter in the 
        Agent or AgentTask constructor. You can either copy the prior agent's 
        chat_ctx..."
    """
    
    def __init__(
        self, 
        node_name: str, 
        vertical: str = "reverse_mortgage",
        phone_number: Optional[str] = None,
        chat_ctx: Optional[ChatContext] = None,
        coordinator: Optional[any] = None
    ):
        """Initialize a node-specific agent with database configuration.
        
        Args:
            node_name: Name of conversation node (greet, verify, qualify, quote, etc.)
            vertical: Business vertical for prompt loading (default: reverse_mortgage)
            phone_number: Caller's phone number for state tracking
            chat_ctx: Previous conversation history to preserve across agent handoffs
            coordinator: Optional RoutingCoordinator instance for automatic routing
        
        Raises:
            Exception: If node config cannot be loaded from database
        """
        # Load configuration from database
        try:
            config = load_node_config(node_name, vertical)
            instructions = config.get('instructions', '')
            
            if not instructions:
                logger.warning(f"⚠️ Node '{node_name}' has no instructions in database")
                instructions = f"You are handling the {node_name} phase of the conversation."
            
            # Load tools from database
            tools = load_tools_for_node(node_name, vertical)
            
            # Validate critical nodes have tools configured
            CRITICAL_NODES = ["verify", "qualify", "quote", "book"]
            if node_name in CRITICAL_NODES and len(tools) == 0:
                error_msg = f"CRITICAL: Node '{node_name}' requires tools but loaded 0! Check database configuration."
                logger.error(f"❌ {error_msg}")
                raise ValueError(error_msg)
            
            logger.info(f"🏗️ Creating BarbaraNodeAgent for node '{node_name}' with {len(tools)} tools")
            
        except Exception as e:
            logger.error(f"❌ Failed to load config for node '{node_name}': {e}")
            raise
        
        # Initialize Agent with database-loaded config
        # Documentation: Agent constructor accepts instructions, tools, and chat_ctx
        # From docs: "super().__init__(instructions=..., tools=..., chat_ctx=...)"
        super().__init__(
            instructions=instructions,
            tools=tools,
            chat_ctx=chat_ctx  # Preserves conversation history across handoffs
        )
        
        # ✅ NO custom attributes stored on self - matches docs pattern
        # State is accessed via self.session.userdata instead
        
        logger.info(f"✅ BarbaraNodeAgent created: node='{node_name}', tools={len(tools)}, has_history={chat_ctx is not None}, has_coordinator={coordinator is not None}")
        
    async def on_enter(self) -> None:
        """Called when this agent becomes the active agent in the session.
        
        This is a LiveKit lifecycle hook that fires when:
        - session.start(agent=this_agent) is called (initial agent)
        - session.update_agent(this_agent) is called (handoff to this agent)
        
        We use this to:
        1. Log the node transition for debugging
        2. Trigger immediate speech to execute the node's instructions
        
        Documentation:
            From LiveKit docs (/agents/build/agents-handoffs/#defining-an-agent):
            "async def on_enter(self) -> None:
                await self.session.generate_reply(instructions='Greet the user...')"
        
            From docs "Passing state" section:
            "userdata: MySessionInfo = self.session.userdata
             await self.session.generate_reply(instructions=f'Greet {userdata.user_name}...')"
        """
        logger.info(f"🎯 ON_ENTER: BarbaraNodeAgent entered node '{self.session.userdata.current_node}'")
        
        # Generate agent speech based on node instructions
        # This ensures the agent immediately acts according to the new node's purpose
        await self.session.generate_reply(
            instructions=f"Begin the {self.session.userdata.current_node} conversation phase. Follow the instructions for this node."
        )
        
        logger.info(f"✅ ON_ENTER complete for node '{self.session.userdata.current_node}'")
    
    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        """Called when user's turn ends, before agent's reply.
        
        If a routing coordinator is attached, delegate routing checks to it.
        This enables automatic node transitions based on step_criteria and routing logic.
        
        Args:
            turn_ctx: Full ChatContext up to but not including user's latest message
            new_message: User's latest message representing their current turn
        
        Documentation:
            From LiveKit docs (/agents/build/nodes/#on_user_turn_completed):
            "Called when the user has finished speaking, and the LLM is about to respond.
            This is a good opportunity to update the chat context or edit the new message 
            before it is sent to the LLM."
            
            From docs "Passing state" section:
            "if self.session.userdata.user_name and self.session.userdata.age:
                 return CustomerServiceAgent()"
        """
        if self.session.userdata.coordinator:
            logger.debug(f"🔄 on_user_turn_completed: Delegating to coordinator for routing check")
            try:
                await self.session.userdata.coordinator.check_and_route(self, self.session)
            except Exception as e:
                logger.warning(f"⚠️ Routing check failed in on_user_turn_completed: {e}")
                # Don't block agent reply if routing check fails
        else:
            logger.debug(f"🔄 on_user_turn_completed: No coordinator attached, skipping routing check")


# Export the agent class
__all__ = ["BarbaraNodeAgent"]

