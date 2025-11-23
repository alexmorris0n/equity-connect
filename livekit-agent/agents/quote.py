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
        """Called when agent takes control - check history and calculate quote"""
        # First, check if user already asked for quote or provided numbers in their last message
        history_items = list(self.chat_ctx.items) if hasattr(self.chat_ctx, 'items') else []
        
        # Find the last user message and check if it's a quote request or contains numbers
        user_asked_for_quote = False
        user_provided_numbers = False
        last_user_message_text = ""
        
        # Search backwards through history to find last user message
        for item in reversed(history_items):
            if hasattr(item, 'role') and item.role == 'user':
                # Extract message text - content can be a list or string
                if hasattr(item, 'text_content'):
                    last_user_message_text = item.text_content  # Property, not method
                elif hasattr(item, 'content'):
                    content = item.content
                    if isinstance(content, list):
                        last_user_message_text = ' '.join(str(c) for c in content if c)
                    else:
                        last_user_message_text = str(content)
                elif hasattr(item, 'text'):
                    last_user_message_text = str(item.text)
                else:
                    continue
                
                # Detect if user asked for quote
                quote_request_indicators = [
                    'how much', 'what can i get', 'how much can i', 'calculate',
                    'run the numbers', 'what are my numbers', 'quote', 'estimate'
                ]
                message_lower = last_user_message_text.lower()
                if any(indicator in message_lower for indicator in quote_request_indicators):
                    user_asked_for_quote = True
                
                # Detect if user provided numbers (property value, age, etc.)
                number_indicators = [
                    '$', 'dollars', 'thousand', 'hundred thousand', 'million',
                    'worth', 'value', 'age', 'years old', 'mortgage', 'balance'
                ]
                if any(indicator in message_lower for indicator in number_indicators):
                    user_provided_numbers = True
                
                if user_asked_for_quote or user_provided_numbers:
                    logger.info(f"Detected quote request/numbers in last user message: {last_user_message_text[:100]}")
                break
        
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
        
        # Add history context if user asked for quote or provided numbers
        if user_asked_for_quote or user_provided_numbers:
            quote_context += f"\n=== USER JUST ASKED FOR QUOTE / PROVIDED NUMBERS ===\n"
            quote_context += f"Last message: {last_user_message_text[:200]}\n"
            if user_asked_for_quote:
                quote_context += "User asked for a quote - calculate it immediately.\n"
            if user_provided_numbers:
                quote_context += "User provided numbers - extract and use them immediately.\n"
            quote_context += "===========================\n"
        
        # Let database prompt handle the actual instructions
        await self.session.generate_reply(
            instructions=quote_context
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
    async def mark_qualification_result(
        self,
        context: RunContext,
        qualified: bool,
        reason: Optional[str] = None
    ) -> str:
        """
        Mark qualification status - used for late disqualification during quote.
        
        Call when:
        - User reveals disqualifying information during quote (e.g., "actually it's a rental property")
        - You discover they don't meet requirements that weren't caught in QUALIFY
        - Late disqualification triggers are detected
        
        Late disqualification triggers:
        - "Actually, it's a rental property" → non_primary_residence
        - "I rent it out to tenants" → non_primary_residence
        - "I'm only 58" or "I'm 60" → age_below_62
        - "I don't own it, I'm renting" → not_homeowner
        - "The bank owns it, I'm underwater" → insufficient_equity
        
        Args:
            qualified: Whether the caller qualifies (typically False for late disqualification)
            reason: Disqualification reason if qualified=False:
                - "age_below_62" - Must be 62 or older
                - "non_primary_residence" - Must be primary residence, not rental/investment
                - "not_homeowner" - Must own the property
                - "insufficient_equity" - Must have meaningful equity
        
        After calling this with qualified=False, the system will automatically route to GOODBYE.
        """
        from tools.conversation_flags import mark_qualification_result as mark_tool
        
        # Mark qualification in conversation state
        result = await mark_tool(self.caller_phone, qualified)
        
        # Also update leads table if we have lead_id
        lead_id = self.lead_data.get('id')
        if lead_id:
            from services.supabase import get_supabase_client
            sb = get_supabase_client()
            try:
                update_data = {'qualified': qualified}
                if not qualified and reason:
                    # Store disqualification reason in conversation_data, not leads table
                    from services.conversation_state import update_conversation_state
                    update_conversation_state(
                        self.caller_phone,
                        {
                            "conversation_data": {
                                "disqualified": True,
                                "disqualification_reason": reason
                            }
                        }
                    )
                
                sb.table('leads').update(update_data).eq('id', lead_id).execute()
                logger.info(f"Lead {lead_id}: Updated qualified={qualified}, reason={reason}")
            except Exception as e:
                logger.error(f"Error updating lead qualification: {e}")
        
        logger.info(f"[QUOTE] Marked qualified={qualified}, reason={reason} for {self.caller_phone}")
        
        # If disqualified, route to goodbye
        if not qualified:
            from .goodbye import BarbaraGoodbyeAgent
            return BarbaraGoodbyeAgent(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                reason="disqualified",
                disqualification_reason=reason,
                chat_ctx=self.chat_ctx
            )
        
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
    
    @function_tool()
    async def route_to_goodbye(self, context: RunContext, reason: Optional[str] = None):
        """
        Route to goodbye agent.
        
        Call when:
        - User is disqualified during quote (e.g., reveals rental property, insufficient equity)
        - User declines to continue after seeing quote
        - Conversation should end gracefully
        
        Args:
            reason: Optional reason for goodbye (e.g., "disqualified", "not_interested", "standard")
        """
        logger.info(f"Routing to goodbye from QUOTE - reason: {reason or 'standard'}")
        
        from .goodbye import BarbaraGoodbyeAgent
        
        return BarbaraGoodbyeAgent(
            caller_phone=self.caller_phone,
            lead_data=self.lead_data,
            vertical=self.vertical,
            reason=reason or "standard",
            chat_ctx=self.chat_ctx
        )

