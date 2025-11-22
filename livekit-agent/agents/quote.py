"""
Barbara's Quote Agent

Calculates and presents reverse mortgage quotes. Can route to answer, objections, or booking.
"""

from livekit.agents import Agent, function_tool, RunContext
from livekit.agents.llm import ChatContext
from services.prompt_loader import load_node_config
from services.conversation_state import update_conversation_state
from services.supabase import get_supabase_client
from tools.conversation_flags import mark_quote_presented
from tools.lead import update_lead_info
from tools.quote import calculate_reverse_mortgage as calculate_reverse_mortgage_tool
from typing import Optional
import logging
import json

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
        lead_id = self.lead_data.get('id')
        
        # Build context about available data for calculation
        quote_context = """
=== QUOTE CALCULATION DATA ===
"""
        
        if lead_id:
            sb = get_supabase_client()
            try:
                response = sb.table('leads').select('property_value, estimated_equity, age, mortgage_balance').eq('id', lead_id).single().execute()
                lead = response.data
                
                property_value = lead.get('property_value')
                estimated_equity = lead.get('estimated_equity')
                age = lead.get('age')
                mortgage_balance = lead.get('mortgage_balance')
                
                if property_value:
                    quote_context += f"- property_value = ${property_value:,.0f}\n"
                if estimated_equity:
                    quote_context += f"- estimated_equity = ${estimated_equity:,.0f}\n"
                if age:
                    quote_context += f"- age = {age}\n"
                if mortgage_balance:
                    quote_context += f"- mortgage_balance = ${mortgage_balance:,.0f}\n"
                
                if not property_value:
                    quote_context += "- property_value = MISSING (need to collect)\n"
                if not age:
                    quote_context += "- age = MISSING (need to collect)\n"
                
                quote_context += "===========================\n"
                
                logger.info(f"Quote context for lead {lead_id}: property_value={property_value}, age={age}, equity={estimated_equity}")
            except Exception as e:
                logger.error(f"Error fetching lead data for quote: {e}")
                quote_context += "Error loading lead data. Collect property value and age.\n===========================\n"
        else:
            quote_context += "No lead_id available. Collect property value, age, and mortgage balance.\n===========================\n"
        
        # Generate reply with context - let database prompt handle the greeting and calculation instructions
        await self.session.generate_reply(
            instructions=quote_context + "\nGreet the caller and calculate the reverse mortgage quote using the calculate_reverse_mortgage tool."
        )
    
    @function_tool()
    async def calculate_reverse_mortgage(
        self,
        context: RunContext,
        property_value: float,
        age: int,
        equity: Optional[float] = None,
        mortgage_balance: Optional[float] = None
    ):
        """
        Calculate reverse mortgage loan amounts (lump sum and monthly payment estimates).
        
        CRITICAL: Always use this tool for calculations - never estimate or guess amounts.
        This tool uses HECM calculation principles and returns accurate estimates.
        
        Args:
            property_value: Current estimated home value (required)
            age: Borrower age (must be 62+, required)
            equity: Estimated equity amount (if not provided, calculated from property_value - mortgage_balance)
            mortgage_balance: Current mortgage balance (used to calculate equity if equity not provided)
        
        Returns:
            JSON string with lump_sum, monthly_payment_20yr, monthly_payment_tenure, and note
        """
        logger.info(f"📊 Quote agent calling calculate_reverse_mortgage: property_value=${property_value:,.0f}, age={age}")
        result = await calculate_reverse_mortgage_tool(property_value, age, equity, mortgage_balance)
        return result
    
    @function_tool()
    async def mark_quote_presented(self, context: RunContext, quote_reaction: str):
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
    async def update_lead_info(
        self, 
        context: RunContext,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        property_address: Optional[str] = None,
        property_city: Optional[str] = None,
        property_state: Optional[str] = None,
        property_zip: Optional[str] = None,
        age: Optional[int] = None,
        money_purpose: Optional[str] = None,
        amount_needed: Optional[float] = None,
        timeline: Optional[str] = None
    ):
        """
        Update lead information during quote process.
        
        Use when:
        - Collecting missing data needed for calculation (age, home value, mortgage balance)
        - Updating information as you calculate
        
        Common fields: age, property_address, property_city, property_state, property_zip
        
        Args:
            first_name: First name
            last_name: Last name
            email: Email address
            phone: Phone number
            property_address: Property address
            property_city: Property city
            property_state: Property state
            property_zip: Property ZIP code
            age: Age
            money_purpose: Purpose for the money
            amount_needed: Amount needed
            timeline: Timeline for needing the money
        """
        lead_id = self.lead_data.get('id')
        
        if not lead_id:
            return "No lead_id available. Cannot update lead info."
        
        # Use existing tool from tools/lead.py
        from tools.lead import update_lead_info as update_tool
        result_str = await update_tool(
            lead_id=lead_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            property_address=property_address,
            property_city=property_city,
            property_state=property_state,
            property_zip=property_zip,
            age=age,
            money_purpose=money_purpose,
            amount_needed=amount_needed,
            timeline=timeline
        )
        
        logger.info(f"Updated lead {lead_id} during quote")
        
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
            chat_ctx=self.chat_ctx
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
            chat_ctx=self.chat_ctx
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
            chat_ctx=self.chat_ctx
        )

