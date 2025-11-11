"""LangGraph conversation workflow with dynamic routing"""
import logging
import os
from typing import Literal
from langgraph.graph import StateGraph, END, START
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_openai import ChatOpenAI

from .state import ConversationState
from .routers import (
    route_after_greet,
    route_after_verify,
    route_after_qualify,
    route_after_answer,
    route_after_objections,
    route_after_exit,
)
from services.conversation_state import (
    get_conversation_state,
    update_conversation_state,
    extract_phone_from_messages,
)

logger = logging.getLogger(__name__)


def load_prompt_file(filename: str) -> str:
    """Load prompt content from markdown file"""
    prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", filename)
    with open(prompt_path, 'r') as f:
        return f.read()


def load_node_prompt(node_name: str) -> str:
    """Load node-specific prompt"""
    return load_prompt_file(f"nodes/{node_name}.md")


# Load persona and intent (applied globally to all nodes)
PERSONA = load_prompt_file("persona.md")
INTENT = load_prompt_file("intent.md")


def create_node_function(node_name: str, llm_with_tools):
    """
    Factory to create node functions that properly invoke the LLM.
    
    Each node:
    1. Loads its specific prompt
    2. Adds system message with persona + intent + node instructions
    3. Invokes LLM with conversation history (LiveKit LLMAdapter handles streaming)
    4. Returns updated state with new AI message
    
    NOTE: We use ainvoke() here, but LiveKit's LLMAdapter wraps the entire graph
    and calls graph.astream(stream_mode="messages") which handles token streaming to TTS.
    """
    node_prompt = load_node_prompt(node_name)
    
    async def node_function(state: ConversationState) -> dict:
        logger.info(f"🔵 {node_name.upper()} node executing")
        
        # Build system message for this node
        system_msg = SystemMessage(content=f"{PERSONA}\n\n{INTENT}\n\n{node_prompt}")
        
        # Get conversation history from state
        messages = state.get("messages", [])
        
        # Prepend system message if this is first message, or replace it
        if not messages or not isinstance(messages[0], SystemMessage):
            messages = [system_msg] + messages
        else:
            messages[0] = system_msg  # Update system message with node-specific instructions
        
        # Invoke LLM with tools (LLMAdapter handles streaming at graph level)
        ai_response = await llm_with_tools.ainvoke(messages)
        
        # Persist deterministic JSON outputs and node_visits to Supabase
        try:
            import json
            phone = state.get("phone_number") or extract_phone_from_messages(messages)
            if phone:
                # Parse JSON-only response if present
                parsed: dict = {}
                content = getattr(ai_response, "content", None)
                if isinstance(content, str):
                    try:
                        parsed = json.loads(content.strip())
                        if not isinstance(parsed, dict):
                            parsed = {}
                    except Exception:
                        parsed = {}
                # Compute node visit count
                row = get_conversation_state(phone)
                current_visits = 0
                if row:
                    cd = (row.get("conversation_data") or {})
                    current_visits = int((cd.get("node_visits") or {}).get(node_name, 0))
                visit_updates = {"node_visits": {node_name: current_visits + 1}}
                # Merge parsed with visit updates
                cd_updates = {**parsed, **visit_updates} if parsed else visit_updates
                update_conversation_state(phone, {"conversation_data": cd_updates, "current_node": node_name})
        except Exception as e:
            logger.warning(f"Failed to persist node updates for {node_name}: {e}")
        
        # Return updated state with new message
        return {"messages": messages + [ai_response]}
    
    return node_function


def create_conversation_graph(llm: ChatOpenAI, tools: list, lead_context: dict = None) -> StateGraph:
    """
    Build the conversation graph with dynamic routing.
    
    Args:
        llm: ChatOpenAI instance (configured with model, temperature, etc.)
        tools: List of callable tools for the agent
        lead_context: Optional lead context to inject (phone, name, qualified, etc.)
    
    Returns:
        Compiled LangGraph workflow
    """
    # Bind tools to LLM
    llm_with_tools = llm.bind_tools(tools)
    
    # Create graph
    workflow = StateGraph(ConversationState)
    
    # Inject lead context as initial system message (if provided)
    if lead_context:
        def greet_with_context(state: ConversationState) -> dict:
            # Build context message
            context_parts = [f"[SYSTEM - Lead Context]"]
            if lead_context.get("first_name"):
                context_parts.append(f"- Caller Name: {lead_context.get('first_name')} {lead_context.get('last_name', '')}".strip())
            if lead_context.get("phone"):
                context_parts.append(f"- Phone: {lead_context['phone']}")
            if lead_context.get("status"):
                context_parts.append(f"- Status: {lead_context['status']}")
            if lead_context.get("qualified"):
                context_parts.append(f"- Qualified: {'Yes' if lead_context['qualified'] else 'No'}")
            if lead_context.get("property_city") and lead_context.get("property_state"):
                context_parts.append(f"- Location: {lead_context['property_city']}, {lead_context['property_state']}")
            if lead_context.get("property_value"):
                context_parts.append(f"- Property Value: ${lead_context['property_value']:,.0f}")
            if lead_context.get("estimated_equity"):
                context_parts.append(f"- Estimated Equity: ${lead_context['estimated_equity']:,.0f}")
            if lead_context.get("broker_name"):
                context_parts.append(f"- Assigned Broker: {lead_context['broker_name']}")
            if lead_context.get("new_caller"):
                context_parts.append("- This is a NEW CALLER (not in database)")
            
            context_message = "\n".join(context_parts)
            
            # Prepend context as system message, then run greet node
            messages = state.get("messages", [])
            messages.insert(0, SystemMessage(content=context_message))
            logger.info(f"💉 Injected lead context: {lead_context.get('first_name', 'Unknown')}")
            
            # Now run the greet node logic
            return create_node_function("greet", llm_with_tools)({"messages": messages})
        
        workflow.add_node("greet", greet_with_context)
    else:
        # No context - just add greet normally
        workflow.add_node("greet", create_node_function("greet", llm_with_tools))
    
    # Add remaining nodes using factory (ensures each node properly calls LLM)
    workflow.add_node("verify", create_node_function("verify", llm_with_tools))
    workflow.add_node("qualify", create_node_function("qualify", llm_with_tools))
    workflow.add_node("answer", create_node_function("answer", llm_with_tools))
    workflow.add_node("objections", create_node_function("objections", llm_with_tools))
    workflow.add_node("book", create_node_function("book", llm_with_tools))
    workflow.add_node("exit", create_node_function("exit", llm_with_tools))
    
    # Set entry point
    workflow.add_edge(START, "greet")
    
    # Add conditional routing
    workflow.add_conditional_edges("greet", route_after_greet)
    workflow.add_conditional_edges("verify", route_after_verify)
    workflow.add_conditional_edges("qualify", route_after_qualify)
    workflow.add_conditional_edges("answer", route_after_answer)
    workflow.add_conditional_edges("objections", route_after_objections)
    
    # Book goes to exit; exit is conditionally routed by route_after_exit
    workflow.add_edge("book", "exit")
    workflow.add_conditional_edges("exit", route_after_exit)
    
    return workflow.compile()

