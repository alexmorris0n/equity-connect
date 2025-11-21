"""Tool Loader - Dynamically loads tools from database for each conversation node.

This module reads the `prompt_versions.content.tools` array from the database
and converts tool names (strings) into LiveKit FunctionTool objects by looking
them up in the TOOL_REGISTRY.

Example:
    Database has: prompt_versions.content.tools = ["verify_caller_identity", "update_lead_info"]
    
    This loader:
    1. Queries database for node config
    2. Extracts tool names from content.tools array
    3. Maps each name to actual function via TOOL_REGISTRY
    4. Returns list of FunctionTool objects ready for Agent

Documentation Reference:
    LiveKit Docs: /agents/build/tools/#creating-tools-programmatically
    "To create a tool on the fly, use function_tool as a function rather than 
    as a decorator... This is useful to compose specific tools based on the same 
    underlying code or load them from external sources such as a database."
    
    Example from docs (dynamic_tool_creation.py):
        tools = [
            function_tool(
                _get_course_info,
                name="get_course_info",
                description="Get information about a course",
            )
        ]
"""

import logging
from typing import List, Any
from services.prompt_loader import load_node_config
from tool_registry import TOOL_REGISTRY

# FunctionTool type is imported from livekit.agents in production
# For typing purposes, we use Any here since tools are already decorated
FunctionTool = Any

logger = logging.getLogger(__name__)


def load_tools_for_node(node_name: str, vertical: str = "reverse_mortgage") -> List[Any]:
    """Load tools dynamically from database for a given conversation node.
    
    This function:
    1. Loads node configuration from database (includes tools array)
    2. For each tool name in the array, looks up the actual function in TOOL_REGISTRY
    3. Returns a list of FunctionTool objects that can be passed to an Agent
    
    Args:
        node_name: Name of the conversation node (e.g., "greet", "verify", "qualify")
        vertical: Business vertical for prompt loading (default: "reverse_mortgage")
    
    Returns:
        List of FunctionTool objects ready to be used by LiveKit Agent
        
    Example:
        >>> tools = load_tools_for_node("verify")
        >>> # Returns [verify_caller_identity, update_lead_info]
        >>> agent = Agent(instructions="...", tools=tools)
    
    Documentation:
        From LiveKit docs (/agents/build/tools/#adding-tools-dynamically):
        "Tools set in the tools value are available alongside any registered 
        within the class using the @function_tool decorator."
    """
    try:
        # Load node configuration from database
        config = load_node_config(node_name, vertical)
        tool_names = config.get('tools', [])  # e.g. ["verify_caller_identity", "update_lead_info"]
        
        if not tool_names:
            logger.info(f"📦 Node '{node_name}' has no tools configured")
            return []
        
        tools = []
        missing_tools = []
        
        for tool_name in tool_names:
            tool_func = TOOL_REGISTRY.get(tool_name)
            if tool_func:
                # Tool function is already decorated with @function_tool, so it's a FunctionTool
                tools.append(tool_func)
                logger.debug(f"✅ Loaded tool: {tool_name}")
            else:
                missing_tools.append(tool_name)
                logger.warning(f"⚠️ Tool '{tool_name}' not found in TOOL_REGISTRY - skipping")
        
        logger.info(f"📦 Loaded {len(tools)}/{len(tool_names)} tools for node '{node_name}': {tool_names}")
        
        if missing_tools:
            logger.warning(f"⚠️ Missing tools for node '{node_name}': {missing_tools}")
        
        return tools
        
    except Exception as e:
        logger.error(f"❌ Failed to load tools for node '{node_name}': {e}")
        # Return empty list on error - agent can still run without tools
        return []


# Export the loader function
__all__ = ["load_tools_for_node"]

