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
        """Start qualification - only check gates that haven't been checked yet"""
        lead_id = self.lead_data.get('id')
        if not lead_id:
            logger.warning("No lead_id in lead_data, cannot check qualification status")
            # Fallback to generic instructions if lead_id is missing
            await self.session.generate_reply(
                instructions="Check the 4 qualification gates."
            )
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
                logger.info(f"Lead {lead_id} is fully qualified, skipping qualification")
                # on_enter() must return None - cannot return Agent instances
                # Instead, generate a reply that instructs the agent to immediately call mark_qualified
                # which will handle routing to the next agent
                await self.session.generate_reply(
                    instructions="Qualification is already complete. Immediately call mark_qualified with qualified=True to route to the answer agent."
                )
                return

            needs_qualification = []
            if not age_qualified:
                needs_qualification.append("age (62+)")
            if not homeowner_qualified:
                needs_qualification.append("homeownership")
            if not primary_residence_qualified:
                needs_qualification.append("primary residence")
            if not equity_qualified:
                needs_qualification.append("sufficient equity")

            logger.info(f"Lead {lead_id} needs qualification: {', '.join(needs_qualification)}")

            # Build context for the agent
            qualification_context = f"""
=== QUALIFICATION STATUS ===
The following gates need to be checked:
"""
            if not age_qualified:
                qualification_context += "- age_qualified = false (need to confirm caller is 62+)\n"
            if not homeowner_qualified:
                qualification_context += "- homeowner_qualified = false (need to confirm caller owns the property)\n"
            if not primary_residence_qualified:
                qualification_context += "- primary_residence_qualified = false (need to confirm property is primary residence)\n"
            if not equity_qualified:
                qualification_context += "- equity_qualified = false (need to confirm sufficient equity)\n"
            
            qualification_context += "===========================\n"

            # Generate reply with context - let database prompt handle the greeting
            await self.session.generate_reply(
                instructions=qualification_context + "\nGreet the caller and begin checking the qualification gates."
            )
        except Exception as e:
            logger.error(f"Error checking qualification status: {e}")
            await self.session.generate_reply(
                instructions="Check the 4 qualification gates: age 62+, homeowner, primary residence, sufficient equity."
            )
    
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
            # Qualified - go to main conversation
            from .answer import BarbaraAnswerAgent
            return BarbaraAnswerAgent(
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

