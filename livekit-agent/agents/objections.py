"""
Barbara's Objections Agent

Handles concerns and objections. Can route to answer, booking, or goodbye.
"""

from livekit.agents import Agent, function_tool, RunContext
from livekit.agents.llm import ChatContext
from services.prompt_loader import load_node_config
from services.conversation_state import update_conversation_state, get_conversation_state
from tools.knowledge import search_knowledge
from tools.conversation_flags import mark_has_objection, mark_objection_handled
from typing import Optional
import logging

logger = logging.getLogger("agents.objections")


class BarbaraObjectionsAgent(Agent):
    """Agent for handling objections - can route to answer, booking, or goodbye"""
    
    def __init__(
        self, 
        caller_phone: str, 
        lead_data: dict, 
        vertical: str = "reverse_mortgage",
        chat_ctx: Optional[ChatContext] = None
    ):
        config = load_node_config("objections", vertical)
        
        super().__init__(
            instructions=config['instructions'],
            chat_ctx=chat_ctx
        )
        
        self.caller_phone = caller_phone
        self.lead_data = lead_data
        self.vertical = vertical
        
        logger.info(f"BarbaraObjectionsAgent created for {caller_phone}")
    
    async def on_enter(self) -> None:
        """Called when agent takes control - address the concern with context"""
        # First, check if user already expressed an objection in their last message
        history_items = list(self.chat_ctx.items) if hasattr(self.chat_ctx, 'items') else []
        
        # Find the last user message and check if it contains objection language
        user_expressed_objection = False
        last_user_message_text = ""
        
        # Search backwards through history to find last user message
        for item in reversed(history_items):
            if hasattr(item, 'role') and item.role == 'user':
                # Extract message text - content can be a list or string
                if hasattr(item, 'text_content'):
                    # Preferred method if available
                    last_user_message_text = item.text_content()
                elif hasattr(item, 'content'):
                    content = item.content
                    # Handle both list and string content
                    if isinstance(content, list):
                        last_user_message_text = ' '.join(str(c) for c in content if c)
                    else:
                        last_user_message_text = str(content)
                elif hasattr(item, 'text'):
                    last_user_message_text = str(item.text)
                else:
                    continue  # Skip if we can't extract text
                
                # Detect objection language
                objection_indicators = [
                    'worried', 'concerned', 'scared', 'nervous', 'hesitant', 'unsure',
                    'kids told me', 'family said', 'my children', 'my son', 'my daughter',
                    'scam', 'fraud', 'too risky', 'risky', 'dangerous',
                    'lose my home', 'lose the house', 'foreclosure',
                    'heirs', 'inheritance', 'my kids', 'my family',
                    'too expensive', 'fees too high', 'costs too much',
                    'not sure', 'don\'t know', 'skeptical', 'doubtful',
                    'what if', 'what happens if', 'what about'
                ]
                message_lower = last_user_message_text.lower()
                if any(indicator in message_lower for indicator in objection_indicators):
                    user_expressed_objection = True
                    logger.info(f"Detected objection in last user message: {last_user_message_text[:100]}")
                break
        
        # Check conversation state for objection information
        state = get_conversation_state(self.caller_phone)
        conversation_data = state.get('conversation_data', {}) if state else {}
        
        has_objections = conversation_data.get('has_objections', False)
        objection_type = conversation_data.get('last_objection_type')
        objection_handled = conversation_data.get('objection_handled', False)
        node_before_objection = conversation_data.get('node_before_objection')
        
        # Build context about the objection
        objection_context = """
=== OBJECTION CONTEXT ===
"""
        
        if user_expressed_objection:
            # User just expressed an objection in their last message - address it immediately
            objection_context += "- User JUST expressed an objection in their last message\n"
            objection_context += f"- Last message: {last_user_message_text[:200]}\n"
            objection_context += "- Address this specific concern immediately\n"
        elif objection_handled:
            objection_context += "- Previous objection was already handled\n"
            objection_context += "- User may have new concerns or questions\n"
        elif has_objections:
            objection_context += "- User has raised an objection\n"
            if objection_type:
                objection_context += f"- Objection type: {objection_type}\n"
            if node_before_objection:
                objection_context += f"- Came from: {node_before_objection} node\n"
        else:
            objection_context += "- New objection detected (no prior state)\n"
            objection_context += "- Listen carefully to identify the specific concern\n"
        
        objection_context += "===========================\n"
        
        logger.info(f"Objection context for {self.caller_phone}: user_expressed={user_expressed_objection}, has_objections={has_objections}, type={objection_type}, handled={objection_handled}")
        
        # Add history context
        if user_expressed_objection:
            objection_context += "\n=== USER JUST EXPRESSED OBJECTION ===\n"
            objection_context += "They just expressed it in their last message - do not ask 'what's your concern' - address it directly.\n"
            objection_context += "===========================\n"
        
        # Let database prompt handle the actual instructions
        await self.session.generate_reply(instructions=objection_context)
    
    @function_tool()
    async def search_knowledge(self, context: RunContext, question: str) -> str:
        """
        Search knowledge base for objection-specific information.
        
        Call when:
        - You need information to address a specific objection
        - User's concern requires factual information
        
        Args:
            question: The objection or concern to search for (e.g., "family objections", "heirs inheritance", "fees concerns")
        """
        from tools.knowledge import search_knowledge as search_tool
        result = await search_tool(question)
        
        logger.info(f"Knowledge search for objection: {question[:50]}...")
        
        return result
    
    @function_tool()
    async def mark_has_objection(
        self, 
        context: RunContext, 
        objection_type: str
    ):
        """
        Record that user has raised an objection.
        
        Call when:
        - User expresses a concern or objection
        - You've identified the type of objection
        
        Common objection types:
        - third_party_approval (family concerns)
        - cost_fees (worried about fees)
        - heirs_inheritance (worried about heirs)
        - age_discrimination (why age matters)
        
        Args:
            objection_type: Type of objection (e.g., "third_party_approval", "cost_fees")
        """
        # Use existing tool from tools/conversation_flags.py
        result = await mark_has_objection(self.caller_phone, objection_type)
        
        logger.info(f"Objection recorded: {objection_type}")
        
        return result
    
    @function_tool()
    async def mark_objection_handled(self, context: RunContext):
        """
        Mark that objection has been addressed.
        
        Call when:
        - You've addressed the user's concern
        - User seems satisfied with your response
        - Objection has been resolved
        
        Do NOT call if:
        - User still has concerns
        - Objection is unresolved
        """
        # Use existing tool from tools/conversation_flags.py
        result = await mark_objection_handled(self.caller_phone)
        
        logger.info("Objection marked as handled")
        
        return result
    
    @function_tool()
    async def route_to_answer(self, context: RunContext):
        """
        Route to answer agent for questions.
        
        Call when:
        - User has questions after objection addressed
        - User wants more information
        
        Do NOT call for:
        - Ready to book (use route_to_booking)
        - Still has concerns (stay in objections)
        """
        logger.info("Routing to answer - user has questions")
        
        from .answer import BarbaraAnswerAgent
        
        return BarbaraAnswerAgent(
            caller_phone=self.caller_phone,
            lead_data=self.lead_data,
            vertical=self.vertical,
            chat_ctx=self.chat_ctx
        )
    
    @function_tool()
    async def route_to_booking(self, context: RunContext):
        """
        Route to appointment booking.
        
        Call when:
        - Objection has been resolved
        - User is ready to move forward
        - User wants to schedule
        
        Do NOT call if:
        - Objection still unresolved (stay in objections)
        - User has more questions (use route_to_answer)
        """
        logger.info("Routing to booking - objection resolved, user ready")
        
        from .book import BarbaraBookAgent
        
        update_conversation_state(
            self.caller_phone,
            {
                "conversation_data": {
                    "ready_to_book": True
                }
            }
        )
        
        return BarbaraBookAgent(
            caller_phone=self.caller_phone,
            lead_data=self.lead_data,
            vertical=self.vertical,
            chat_ctx=self.chat_ctx
        )
    
    @function_tool()
    async def route_to_goodbye(self, context: RunContext):
        """
        Route to goodbye if objection cannot be resolved or user not interested.
        
        Call when:
        - Objection cannot be resolved
        - User is not interested after addressing concern
        - User wants to end call
        
        Do NOT call if:
        - Objection resolved and user ready (use route_to_booking)
        - User has more questions (use route_to_answer)
        """
        logger.info("Routing to goodbye - objection unresolved or user not interested")
        
        from .goodbye import BarbaraGoodbyeAgent
        
        return BarbaraGoodbyeAgent(
            caller_phone=self.caller_phone,
            lead_data=self.lead_data,
            vertical=self.vertical,
            reason="objection_unresolved",
            chat_ctx=self.chat_ctx
        )

