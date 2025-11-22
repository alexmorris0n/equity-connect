"""
Barbara's Objections Agent

Handles concerns and objections. Can route to answer, booking, or goodbye.
"""

from livekit.agents import Agent, function_tool, RunContext
from livekit.agents.llm import ChatContext
from services.prompt_loader import load_node_config
from services.conversation_state import update_conversation_state
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
        """Called when agent takes control - address the concern"""
        self.session.generate_reply(
            instructions="Address the user's concern empathetically. Use search_knowledge if you need information to address their specific objection."
        )
    
    @function_tool()
    async def search_knowledge_tool(self, context: RunContext, question: str) -> str:
        """
        Search knowledge base for objection-specific information.
        
        Call when:
        - You need information to address a specific objection
        - User's concern requires factual information
        
        Args:
            question: The objection or concern to search for (e.g., "family objections", "heirs inheritance", "fees concerns")
        """
        result = await search_knowledge(question)
        
        logger.info(f"Knowledge search for objection: {question[:50]}...")
        
        return result
    
    @function_tool()
    async def mark_has_objection_tool(
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
    async def mark_objection_handled_tool(self, context: RunContext):
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
            chat_ctx=self.session.chat_ctx
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
            chat_ctx=self.session.chat_ctx
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
            chat_ctx=self.session.chat_ctx
        )

