"""
Barbara's Quote Agent

Calculates and presents reverse mortgage quotes. Can route to answer, objections, or booking.
"""

from livekit.agents import Agent, function_tool, RunContext
from livekit.agents.llm import ChatContext
from services.prompt_loader import load_node_config
from services.conversation_state import update_conversation_state
from tools.conversation_flags import mark_quote_presented
from tools.lead import update_lead_info
from typing import Optional
import logging

logger = logging.getLogger("agents.quote")


class BarbaraQuoteAgent(Agent):
    """Agent for presenting quotes - can route to answer, objections, or booking"""
    
    def __init__(
        self, 
        caller_phone: str, 
        lead_data: dict, 
        vertical: str = "reverse_mortgage",
        chat_ctx: Optional[ChatContext] = None
    ):
        config = load_node_config("quote", vertical)
        
        super().__init__(
            instructions=config['instructions'],
            chat_ctx=chat_ctx
        )
        
        self.caller_phone = caller_phone
        self.lead_data = lead_data
        self.vertical = vertical
        
        logger.info(f"BarbaraQuoteAgent created for {caller_phone}")
    
    async def on_enter(self) -> None:
        """Called when agent takes control - calculate and present quote"""
        self.session.generate_reply(
            instructions="Calculate the reverse mortgage quote based on lead data and present it to the user. Use the information from the lead record (age, home value, mortgage balance) to calculate available equity."
        )
    
    @function_tool()
    async def mark_quote_presented_tool(self, context: RunContext, quote_reaction: str):
        """
        Mark that quote has been presented and record user's reaction.
        
        Call when:
        - You've shown them estimated loan amounts
        - You've explained what they could access financially
        - They've responded to the numbers
        
        Args:
            quote_reaction: User's reaction to quote (positive, skeptical, not_interested, needs_more, etc.)
        """
        # Use existing tool from tools/conversation_flags.py
        result = await mark_quote_presented(self.caller_phone, quote_reaction)
        
        logger.info(f"Quote presented with reaction: {quote_reaction}")
        
        return result
    
    @function_tool()
    async def update_lead_info_tool(
        self, 
        context: RunContext,
        **kwargs
    ):
        """
        Update lead information during quote process.
        
        Use when:
        - Collecting missing data needed for calculation (age, home value, mortgage balance)
        - Updating information as you calculate
        
        Common fields: age, estimated_home_value, existing_mortgage_balance
        
        Args:
            Any lead fields to update
        """
        lead_id = self.lead_data.get('id')
        
        if not lead_id:
            return "No lead_id available. Cannot update lead info."
        
        # Use existing tool from tools/lead.py
        result_str = await update_lead_info(lead_id=lead_id, **kwargs)
        
        logger.info(f"Updated lead {lead_id} during quote: {kwargs}")
        
        return result_str
    
    @function_tool()
    async def route_to_answer(self, context: RunContext):
        """
        Route to answer agent for follow-up questions.
        
        Call when:
        - User has questions about the quote
        - User wants more information
        - User asks clarifying questions
        
        Do NOT call for:
        - Concerns/objections (use route_to_objections)
        - Ready to book (use route_to_booking)
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
    async def route_to_objections(self, context: RunContext):
        """
        Route to objection handling.
        
        Call when user expresses concerns about the quote:
        - "That's less than I expected"
        - "I'm worried about..."
        - "My kids said..."
        - Any hesitation or concern
        
        Do NOT call for:
        - Questions (use route_to_answer)
        - Ready to book (use route_to_booking)
        """
        logger.info("Routing to objections - concern detected")
        
        from .objections import BarbaraObjectionsAgent
        
        return BarbaraObjectionsAgent(
            caller_phone=self.caller_phone,
            lead_data=self.lead_data,
            vertical=self.vertical,
            chat_ctx=self.session.chat_ctx
        )
    
    @function_tool()
    async def route_to_booking(self, context: RunContext):
        """
        Route to appointment booking.
        
        Call when user is ready to book after seeing quote:
        - "Let's schedule"
        - "I want to move forward"
        - "Book me"
        
        Do NOT call for:
        - Questions (use route_to_answer)
        - Concerns (use route_to_objections)
        """
        logger.info("Routing to booking - user ready after quote")
        
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

