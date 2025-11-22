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
        """Start qualification - check 4 gates"""
        await self.session.generate_reply(
            instructions="Begin checking the 4 qualification gates: age 62+, homeowner, primary residence, sufficient equity."
        )
    
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
        **kwargs
    ):
        """
        Update lead information during qualification.
        
        Use when:
        - Collecting qualification data (age, home value, mortgage balance, etc.)
        - Updating information as you check gates
        
        Common fields: age, property_address, estimated_home_value, existing_mortgage_balance
        
        Args:
            Any lead fields to update
        """
        lead_id = self.lead_data.get('id')
        
        if not lead_id:
            return "No lead_id available. Cannot update lead info."
        
        # Use existing tool from tools/lead.py
        result_str = await update_lead_info(lead_id=lead_id, **kwargs)
        
        logger.info(f"Updated lead {lead_id} during qualification: {kwargs}")
        
        return result_str

