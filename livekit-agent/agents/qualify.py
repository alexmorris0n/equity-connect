"""
Barbara's Qualification Task

Checks 4 qualification gates: age 62+, homeowner, primary residence, sufficient equity.
MUST complete before quoting. This is a Task (not Agent) because qualification is mandatory.
"""

from livekit.agents import AgentTask, function_tool, RunContext
from livekit.agents.llm import ChatContext
from dataclasses import dataclass
from services.prompt_loader import load_node_config
from services.conversation_state import get_conversation_state
from services.supabase import get_supabase_client
from tools.conversation_flags import mark_qualification_result
from tools.lead import update_lead_info
from typing import Optional
import logging

logger = logging.getLogger("agents.qualify")


@dataclass
class QualificationResult:
    """Result returned when qualification task completes"""
    qualified: bool
    reason: Optional[str]  # Disqualification reason if qualified=False


class BarbaraQualifyTask(AgentTask[QualificationResult]):
    """Task to check qualification gates - MUST complete before quoting"""
    
    def __init__(
        self, 
        caller_phone: str, 
        lead_data: dict, 
        vertical: str = "reverse_mortgage",
        chat_ctx: Optional[ChatContext] = None
    ):
        config = load_node_config("qualify", vertical)
        
        super().__init__(
            instructions=config['instructions'],
            chat_ctx=chat_ctx
        )
        
        self.caller_phone = caller_phone
        self.lead_data = lead_data
        self.vertical = vertical
        
        logger.info(f"BarbaraQualifyTask started for {caller_phone}")
    
    async def on_enter(self) -> None:
        """Start qualification - check history and only check gates that haven't been checked yet"""
        # First, check if user already answered qualification questions in their last message
        history_items = list(self.chat_ctx.items) if hasattr(self.chat_ctx, 'items') else []
        
        # Find the last user message and check if it contains qualification info
        user_provided_qualification = False
        last_user_message_text = ""
        
        # Search backwards through history to find last user message
        for item in reversed(history_items):
            if hasattr(item, 'role') and item.role == 'user':
                # Extract message text - content can be a list or string
                if hasattr(item, 'text_content'):
                    last_user_message_text = item.text_content()
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
                
                # Detect if user provided qualification info (age, homeowner status, etc.)
                qualification_indicators = [
                    'years old', 'age', 'i\'m', 'i am', 'turned',
                    'own', 'owner', 'homeowner', 'my house', 'my property',
                    'primary residence', 'live here', 'full-time',
                    'worth', 'value', 'equity', 'mortgage', 'balance',
                    'dollars', '$', 'thousand', 'hundred thousand'
                ]
                message_lower = last_user_message_text.lower()
                if any(indicator in message_lower for indicator in qualification_indicators):
                    user_provided_qualification = True
                    logger.info(f"Detected qualification info in last user message: {last_user_message_text[:100]}")
                break
        
        lead_id = self.lead_data.get('id')
        if not lead_id:
            logger.warning("No lead_id in lead_data, cannot check qualification status")
            qualification_context = "=== QUALIFICATION CONTEXT ===\n"
            qualification_context += "Lead ID not available - check all qualification gates.\n"
            qualification_context += "===========================\n"
            await self.session.generate_reply(instructions=qualification_context)
            return

        sb = get_supabase_client()
        try:
            response = sb.table('leads').select('age_qualified, homeowner_qualified, primary_residence_qualified, equity_qualified, qualified').eq('id', lead_id).single().execute()
            lead = response.data

            age_qualified = lead.get('age_qualified', False)
            homeowner_qualified = lead.get('homeowner_qualified', False)
            primary_residence_qualified = lead.get('primary_residence_qualified', False)
            equity_qualified = lead.get('equity_qualified', False)
            all_qualified = lead.get('qualified', False)

            if all_qualified:
                logger.info(f"Lead {lead_id} is fully qualified, completing qualification task")
                # Complete the task immediately since already qualified
                self.complete(QualificationResult(
                    qualified=True,
                    reason="Already qualified from previous conversation"
                ))
                return

            # Build context for the agent (no hard-coded instructions)
            qualification_context = "=== QUALIFICATION CONTEXT ===\n"
            qualification_context += "The following gates need to be checked:\n"
            if not age_qualified:
                qualification_context += "- age_qualified = false (need to confirm caller is 62+)\n"
            if not homeowner_qualified:
                qualification_context += "- homeowner_qualified = false (need to confirm caller owns the property)\n"
            if not primary_residence_qualified:
                qualification_context += "- primary_residence_qualified = false (need to confirm property is primary residence)\n"
            if not equity_qualified:
                qualification_context += "- equity_qualified = false (need to confirm sufficient equity)\n"
            
            # Add history context if user provided qualification info
            if user_provided_qualification:
                qualification_context += f"\n=== USER JUST PROVIDED QUALIFICATION INFO ===\n"
                qualification_context += f"Last message: {last_user_message_text[:200]}\n"
                qualification_context += "Extract and use this information immediately - don't ask for it again.\n"
            
            qualification_context += "===========================\n"

            # Let database prompt handle the actual instructions
            await self.session.generate_reply(instructions=qualification_context)
        except Exception as e:
            logger.error(f"Error checking qualification status: {e}")
            qualification_context = "=== QUALIFICATION CONTEXT ===\n"
            qualification_context += "Error checking status - check all qualification gates.\n"
            qualification_context += "===========================\n"
            await self.session.generate_reply(instructions=qualification_context)
    
    @function_tool()
    async def mark_age_qualified(self, context: RunContext):
        """Mark that the caller is 62+ years old (FHA requirement for reverse mortgages)."""
        lead_id = self.lead_data.get('id')
        if not lead_id:
            return "No lead_id available. Cannot mark age as qualified."
        sb = get_supabase_client()
        try:
            sb.table('leads').update({'age_qualified': True}).eq('id', lead_id).execute()
            logger.info(f"Lead {lead_id}: Age marked as qualified (62+).")
            return "Age requirement confirmed (62+)."
        except Exception as e:
            logger.error(f"Error marking age as qualified for lead {lead_id}: {e}")
            return f"Failed to mark age as qualified: {e}"

    @function_tool()
    async def mark_homeowner_qualified(self, context: RunContext):
        """Mark that the caller owns the property."""
        lead_id = self.lead_data.get('id')
        if not lead_id:
            return "No lead_id available. Cannot mark homeowner as qualified."
        sb = get_supabase_client()
        try:
            sb.table('leads').update({'homeowner_qualified': True}).eq('id', lead_id).execute()
            logger.info(f"Lead {lead_id}: Homeowner marked as qualified.")
            return "Homeownership confirmed."
        except Exception as e:
            logger.error(f"Error marking homeowner as qualified for lead {lead_id}: {e}")
            return f"Failed to mark homeowner as qualified: {e}"

    @function_tool()
    async def mark_primary_residence_qualified(self, context: RunContext):
        """Mark that the property is the caller's primary residence (not rental/investment)."""
        lead_id = self.lead_data.get('id')
        if not lead_id:
            return "No lead_id available. Cannot mark primary residence as qualified."
        sb = get_supabase_client()
        try:
            sb.table('leads').update({'primary_residence_qualified': True}).eq('id', lead_id).execute()
            logger.info(f"Lead {lead_id}: Primary residence marked as qualified.")
            return "Primary residence confirmed."
        except Exception as e:
            logger.error(f"Error marking primary residence as qualified for lead {lead_id}: {e}")
            return f"Failed to mark primary residence as qualified: {e}"

    @function_tool()
    async def mark_equity_qualified(self, context: RunContext):
        """Mark that the caller has sufficient equity in the property."""
        lead_id = self.lead_data.get('id')
        if not lead_id:
            return "No lead_id available. Cannot mark equity as qualified."
        sb = get_supabase_client()
        try:
            sb.table('leads').update({'equity_qualified': True}).eq('id', lead_id).execute()
            logger.info(f"Lead {lead_id}: Equity marked as qualified.")
            return "Sufficient equity confirmed."
        except Exception as e:
            logger.error(f"Error marking equity as qualified for lead {lead_id}: {e}")
            return f"Failed to mark equity as qualified: {e}"
    
    @function_tool()
    async def mark_qualified(
        self, 
        context: RunContext, 
        qualified: bool, 
        reason: Optional[str] = None
    ):
        """
        Record qualification result after checking all 4 gates.
        
        4 Qualification Gates:
        1. Age 62+ (FHA requirement for reverse mortgages)
        2. Homeowner (owns the property)
        3. Primary residence (lives there full-time, not rental/investment)
        4. Sufficient equity (has meaningful equity after payoff)
        
        Call this when:
        - All 4 gates have been checked
        - Clear qualification or disqualification determined
        
        Do NOT call until:
        - You have checked all 4 gates
        - You have a clear yes/no answer for qualification
        
        Args:
            qualified: True if passes all gates, False if fails any
            reason: Required if qualified=False (e.g., "age_below_62", "not_primary_residence", "insufficient_equity")
        """
        # Use existing tool from tools/conversation_flags.py
        await mark_qualification_result(self.caller_phone, qualified)
        
        logger.info(f"Qualification complete: qualified={qualified}, reason={reason}")
        
        # After qualification, route to next step
        if qualified:
            # Qualified - go to QUOTE first (perfect route: qualify → quote → answer → book)
            from .quote import BarbaraQuoteAgent
            return BarbaraQuoteAgent(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                chat_ctx=self.chat_ctx
            )
        else:
            # Not qualified - go to goodbye with empathetic message
            from .goodbye import BarbaraGoodbyeAgent
            return BarbaraGoodbyeAgent(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                reason="disqualified",
                disqualification_reason=reason,
                chat_ctx=self.chat_ctx
            )
    
    @function_tool()
    async def update_lead_info_tool(
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
        Update lead information during qualification.
        
        Use when:
        - Collecting qualification data (age, home value, mortgage balance, etc.)
        - Updating information as you check gates
        
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
        result_str = await update_lead_info(
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
        
        logger.info(f"Updated lead {lead_id} during qualification")
        
        return result_str
    
    @function_tool()
    async def route_to_objections(self, context: RunContext):
        """
        Route to objections agent when user raises concerns during qualification.
        
        Call when:
        - User expresses concerns or objections during qualification questions
        - User says things like "Why does that matter?", "Are you discriminating?", "I'm not sure about this"
        - User is hesitant or skeptical about providing qualification information
        
        This allows addressing objections mid-qualification before continuing.
        After objection is resolved, user can return to qualification.
        
        Do NOT call for:
        - Simple answers to qualification questions (continue qualification)
        - General questions (stay in qualify or route to answer)
        """
        logger.info("Routing to objections from QUALIFY - concern detected during qualification")
        
        from services.conversation_state import update_conversation_state
        update_conversation_state(
            self.caller_phone,
            {
                "conversation_data": {
                    "has_objections": True,
                    "node_before_objection": "qualify"
                }
            }
        )
        
        from .objections import BarbaraObjectionsAgent
        
        return BarbaraObjectionsAgent(
            caller_phone=self.caller_phone,
            lead_data=self.lead_data,
            vertical=self.vertical,
            chat_ctx=self.chat_ctx
        )

