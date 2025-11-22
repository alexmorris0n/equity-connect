"""
Barbara's Verification Task

Collects and verifies caller identity. MUST complete before continuing.
This is a Task (not Agent) because verification is mandatory and cannot be skipped.
"""

from livekit.agents import AgentTask, function_tool, RunContext
from livekit.agents.llm import ChatContext
from dataclasses import dataclass
from services.prompt_loader import load_node_config
from services.conversation_state import update_conversation_state
from tools.lead import verify_caller_identity, update_lead_info
from typing import Optional
import logging

logger = logging.getLogger("agents.verify")


@dataclass
class VerificationResult:
    """Result returned when verification task completes"""
    verified: bool
    lead_id: Optional[str]


class BarbaraVerifyTask(AgentTask[VerificationResult]):
    """Task to verify caller identity - MUST complete before continuing"""
    
    def __init__(
        self, 
        caller_phone: str, 
        lead_data: dict, 
        vertical: str = "reverse_mortgage",
        chat_ctx: Optional[ChatContext] = None
    ):
        config = load_node_config("verify", vertical)
        
        super().__init__(
            instructions=config['instructions'],
            chat_ctx=chat_ctx
        )
        
        self.caller_phone = caller_phone
        self.lead_data = lead_data
        self.vertical = vertical
        
        logger.info(f"BarbaraVerifyTask started for {caller_phone}")
    
    async def on_enter(self) -> None:
        """Start verification - collect missing info or confirm existing"""
        await self.session.generate_reply(
            instructions="Collect any missing information or confirm existing details. Use 'collect missing, confirm existing' pattern."
        )
    
    @function_tool()
    async def verify_caller_identity_tool(self, context: RunContext, first_name: str):
        """
        Mark caller identity as verified and route to next step.
        
        Call when:
        - You've confirmed their name, address, email, phone
        - All required contact information is collected
        - Information matches lead record
        
        Do NOT call until:
        - You have verified all key details
        
        Args:
            first_name: Caller's first name (required for verification)
        """
        # Use existing tool from tools/lead.py
        result_str = await verify_caller_identity(first_name, self.caller_phone)
        
        import json
        result = json.loads(result_str)
        
        if result.get('success'):
            lead_id = result.get('lead_id')
            
            logger.info(f"Verification complete: confirmed=True, lead_id={lead_id}")
            
            # Complete task - returns result
            self.complete(VerificationResult(
                verified=True,
                lead_id=lead_id
            ))
            
            # After completion, route to next step based on database status
            # Check if qualified - if yes, go to answer, if no, go to qualify
            from services.conversation_state import get_conversation_state
            state = get_conversation_state(self.caller_phone)
            conversation_data = (state.get('conversation_data', {}) if state else {})
            qualified = conversation_data.get('qualified', False)
            
            if qualified:
                # Already qualified - go to main conversation
                from .answer import BarbaraAnswerAgent
                return BarbaraAnswerAgent(
                    caller_phone=self.caller_phone,
                    lead_data=self.lead_data,
                    vertical=self.vertical,
                    chat_ctx=self.chat_ctx
                )
            else:
                # Not qualified - go to qualification
                from .qualify import BarbaraQualifyTask
                return BarbaraQualifyTask(
                    caller_phone=self.caller_phone,
                    lead_data=self.lead_data,
                    vertical=self.vertical,
                    chat_ctx=self.chat_ctx
                )
        else:
            logger.warning(f"Verification failed: {result.get('error', 'Unknown error')}")
            # Still complete task but with verified=False
            self.complete(VerificationResult(
                verified=False,
                lead_id=None
            ))
    
    @function_tool()
    async def update_lead_info_tool(
        self, 
        context: RunContext,
        **kwargs
    ):
        """
        Update lead information during verification.
        
        Use when:
        - Collecting missing information
        - Correcting outdated information
        
        Common fields: email, address, city, state, zip, first_name, last_name
        
        Args:
            Any lead fields to update (first_name, last_name, email, property_address, etc.)
        """
        lead_id = self.lead_data.get('id')
        
        if not lead_id:
            return "No lead_id available. Cannot update lead info."
        
        # Use existing tool from tools/lead.py
        result_str = await update_lead_info(lead_id=lead_id, **kwargs)
        
        logger.info(f"Updated lead {lead_id}: {kwargs}")
        
        return result_str

