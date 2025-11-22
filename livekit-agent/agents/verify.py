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
    async def verify_caller_identity(self, context: RunContext):
        """
        Mark caller identity as verified after confirming their information.
        
        Call when:
        - You've confirmed their name, address, email, phone
        - All required contact information is collected
        - Information matches lead record or has been updated
        
        Do NOT call until:
        - You have verified all key details
        """
        # Use existing tool from tools/lead.py
        from tools.lead import verify_caller_identity as verify_tool
        
        first_name = self.lead_data.get('first_name', 'Unknown')
        result_str = await verify_tool(first_name, self.caller_phone)
        
        import json
        result = json.loads(result_str)
        
        if result.get('success'):
            lead_id = result.get('lead_id')
            
            logger.info(f"Verification complete: confirmed=True, lead_id={lead_id}")
            
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
        Update lead information during verification.
        
        Use when:
        - Collecting missing information
        - Correcting outdated information
        
        Common fields: email, property_address, property_city, property_state, property_zip, first_name, last_name
        
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
        
        logger.info(f"Updated lead {lead_id}")
        
        return result_str

