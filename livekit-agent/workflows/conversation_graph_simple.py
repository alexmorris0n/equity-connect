"""
Simple Single-Node Conversation Graph for LiveKit Voice Agent

This architecture uses ONE node with state-aware routing instead of multiple sequential nodes.
This works better for turn-based voice conversations where the agent needs to wait for user input.

Architecture:
- Single "converse" node that handles ALL conversation logic
- Conversation state tracks current phase (greeting, verifying, qualifying, etc.)
- LLM reasoning + state determines next response
- LiveKit LLMAdapter automatically streams tokens to TTS
"""

import logging
from typing import TypedDict, Annotated, Any
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from services.conversation_state import (
    extract_phone_from_messages,
    get_conversation_state,
    update_conversation_state,
)

logger = logging.getLogger(__name__)


# Define conversation state (matches LangChain's message format)
class ConversationState(TypedDict):
    messages: Annotated[list, add_messages]


def load_prompt_file(filename: str) -> str:
    """Load a prompt file from the prompts directory."""
    import os
    prompts_dir = os.path.join(os.path.dirname(__file__), "..", "prompts")
    filepath = os.path.join(prompts_dir, filename)
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        logger.error(f"❌ Prompt file not found: {filepath}")
        return ""


# Load unified persona and instructions
PERSONA = load_prompt_file("persona.md")


def build_unified_instructions(conversation_data: dict = None) -> str:
    """
    Build unified instructions that include:
    - Persona
    - Current conversation phase
    - Phase-specific guidance
    - State information
    """
    cd = conversation_data or {}
    current_phase = cd.get("current_phase", "greeting")
    
    # Phase-specific instructions (inline for simplicity)
    phase_guidance = {
        "greeting": """
You're in the GREETING phase. Your goals:
- Warmly greet the caller
- Introduce yourself as Barbara
- Ask how you can help them today
- Move to VERIFICATION phase once they respond
""",
        "verification": """
You're in the VERIFICATION phase. Your goals:
- Confirm caller's name and property information
- Verify they're calling about their property equity
- Build rapport
- Move to QUALIFICATION phase once verified
""",
        "qualification": """
You're in the QUALIFICATION phase. Your goals:
- Ask about property details (value, location, estimated equity)
- Assess eligibility for reverse mortgage/HELOC
- Determine if they're qualified
- Move to QUALIFIED or UNQUALIFIED phase based on answers
""",
        "qualified": """
You're in the QUALIFIED phase. The caller meets criteria. Your goals:
- Explain next steps
- Offer to connect with a broker
- Attempt to book appointment
- Move to BOOKING or EXIT phase
""",
        "unqualified": """
You're in the UNQUALIFIED phase. The caller doesn't meet criteria. Your goals:
- Politely explain they don't qualify
- Offer alternative resources if appropriate
- Thank them for their time
- Move to EXIT phase
""",
        "booking": """
You're in the BOOKING phase. Your goals:
- Collect preferred appointment time
- Confirm contact information
- Use the schedule_appointment tool to book
- Move to EXIT phase after booking
""",
        "exit": """
You're in the EXIT phase. Your goals:
- Summarize what was discussed
- Confirm next steps
- Thank the caller warmly
- End the call gracefully
"""
    }
    
    guidance = phase_guidance.get(current_phase, phase_guidance["greeting"])
    
    # Build full instructions
    instructions = f"""{PERSONA}

## Current Conversation Phase: {current_phase.upper()}

{guidance}

## Important Reminders:
- Keep responses SHORT (2-3 sentences max for phone)
- Speak naturally and conversationally
- Ask ONE question at a time
- Listen actively to caller responses
- Update phase when goals are met

## Conversation State:
- Phase: {current_phase}
- Qualified: {cd.get('qualified', 'unknown')}
- Property Verified: {cd.get('property_verified', False)}
- Name Confirmed: {cd.get('name_confirmed', False)}
"""
    
    return instructions


def create_simple_conversation_graph(llm, tools: list, lead_context: dict = None):
    """
    Create a simple single-node conversation graph optimized for voice.
    
    Args:
        llm: ChatOpenAI instance
        tools: List of callable tools
        lead_context: Optional lead context to inject
    
    Returns:
        Compiled StateGraph
    """
    # Bind tools to LLM
    llm_with_tools = llm.bind_tools(tools)
    
    # Create graph
    workflow = StateGraph(ConversationState)
    
    async def converse_node(state: ConversationState) -> dict:
        """
        Single conversation node that handles all turns.
        
        The LLM + prompt determines routing and phase transitions.
        LiveKit LLMAdapter automatically streams this to TTS.
        """
        messages = state.get("messages", [])
        
        # Extract phone number from messages for state lookup
        phone = extract_phone_from_messages(messages)
        
        # Load current conversation state from Supabase (with graceful fallback)
        conversation_data = {}
        if phone:
            try:
                row = get_conversation_state(phone)
                if row:
                    conversation_data = row.get("conversation_data", {})
                logger.info(f"✅ Loaded conversation state for {phone}: phase={conversation_data.get('current_phase', 'greeting')}")
            except Exception as e:
                # Gracefully degrade if Supabase is unavailable
                logger.warning(f"⚠️ Supabase unavailable, using fallback state: {e}")
                conversation_data = {
                    "current_phase": "greeting",
                    "turn_count": 0,
                    "fallback_mode": True  # Flag that we're operating without DB
                }
        
        # Build dynamic system instructions based on current phase
        instructions = build_unified_instructions(conversation_data)
        
        # Inject lead context into instructions on first turn (if provided)
        if lead_context and len(messages) <= 1:
            context_parts = ["\n[LEAD CONTEXT]"]
            if lead_context.get("first_name"):
                context_parts.append(f"Name: {lead_context['first_name']} {lead_context.get('last_name', '')}")
            if lead_context.get("phone"):
                context_parts.append(f"Phone: {lead_context['phone']}")
            if lead_context.get("status"):
                context_parts.append(f"Status: {lead_context['status']}")
            if lead_context.get("qualified") is not None:
                context_parts.append(f"Qualified: {lead_context['qualified']}")
            
            # Append lead context to instructions (both in one SystemMessage)
            instructions = instructions + "\n" + "\n".join(context_parts)
        
        system_message = SystemMessage(content=instructions)
        
        # Update or prepend system message
        if messages and isinstance(messages[0], SystemMessage):
            messages[0] = system_message
        else:
            messages = [system_message] + messages
        
        # Invoke LLM (LiveKit LLMAdapter streams this automatically)
        logger.info(f"🗣️ CONVERSE node executing (phase: {conversation_data.get('current_phase', 'greeting')})")
        logger.info(f"📨 Sending {len(messages)} messages to LLM...")
        
        try:
            ai_response = await llm_with_tools.ainvoke(messages)
            logger.info(f"✅ LLM response received: {len(getattr(ai_response, 'content', ''))} chars")
        except Exception as e:
            logger.error(f"❌ LLM invocation failed: {e}", exc_info=True)
            raise
        
        # Update conversation state in Supabase (with graceful fallback)
        # Parse LLM response for phase transitions (optional - can also use tool calls)
        try:
            if phone and not conversation_data.get("fallback_mode"):
                # Increment turn count
                turn_count = conversation_data.get("turn_count", 0) + 1
                
                # Simple phase detection from response content
                # (In production, you might use structured output or tool calls)
                content = getattr(ai_response, "content", "").lower()
                current_phase = conversation_data.get("current_phase", "greeting")
                
                # Very basic phase transition logic
                # (This should be more sophisticated in production)
                if current_phase == "greeting" and turn_count > 1:
                    current_phase = "verification"
                elif current_phase == "verification" and "property" in content:
                    current_phase = "qualification"
                # ... add more transition logic as needed
                
                update_data = {
                    "conversation_data": {
                        "turn_count": turn_count,
                        "current_phase": current_phase,
                        **conversation_data  # Preserve existing data
                    }
                }
                update_conversation_state(phone, update_data)
                logger.info(f"📊 Updated state: phase={current_phase}, turns={turn_count}")
            elif phone and conversation_data.get("fallback_mode"):
                logger.info(f"⚠️ Fallback mode active - state updates skipped (will retry on next turn)")
        except Exception as e:
            logger.warning(f"⚠️ Failed to update conversation state: {e}")
            # Continue gracefully - don't fail the call over DB issues
        
        return {"messages": [ai_response]}
    
    # Add single conversation node
    workflow.add_node("converse", converse_node)
    
    # Set entry point - LLMAdapter will invoke graph once per user turn
    workflow.add_edge(START, "converse")
    
    # NO LOOP EDGE! LLMAdapter handles multi-turn by calling graph.astream() repeatedly
    # Adding converse → converse causes infinite loop instead of streaming to TTS
    
    return workflow.compile()

