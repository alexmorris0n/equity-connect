"""
Barbara's Goodbye Agent

Terminal agent for ending calls gracefully. Can route back to answer if user has questions.
"""

from livekit.agents import Agent, function_tool, RunContext
from livekit.agents.llm import ChatContext
from services.prompt_loader import load_node_config
from services.conversation_state import get_conversation_state
from typing import Optional
import logging

logger = logging.getLogger("agents.goodbye")


class BarbaraGoodbyeAgent(Agent):
    """Terminal agent for ending calls - can route back to answer if needed"""
    
    def __init__(
        self, 
        caller_phone: str, 
        lead_data: dict, 
        vertical: str = "reverse_mortgage",
        reason: Optional[str] = None,
        disqualification_reason: Optional[str] = None,
        chat_ctx: Optional[ChatContext] = None
    ):
        config = load_node_config("goodbye", vertical)
        
        super().__init__(
            instructions=config['instructions'],
            chat_ctx=chat_ctx
        )
        
        self.caller_phone = caller_phone
        self.lead_data = lead_data
        self.vertical = vertical
        self.reason = reason
        self.disqualification_reason = disqualification_reason
        
        logger.info(f"BarbaraGoodbyeAgent created for {caller_phone}, reason={reason}")
    
    async def on_enter(self) -> None:
        """Called when agent takes control - deliver appropriate goodbye message"""
        # Check reason and deliver appropriate message
        if self.reason == "appointment_booked":
            # Get appointment datetime from database
            state = get_conversation_state(self.caller_phone)
            conversation_data = (state.get('conversation_data', {}) if state else {})
            appointment_datetime = conversation_data.get('appointment_datetime')
            
            if appointment_datetime:
                self.session.generate_reply(
                    instructions=f"Confirm the appointment on {appointment_datetime} and deliver warm goodbye. Thank them for their time."
                )
            else:
                self.session.generate_reply(
                    instructions="Confirm the appointment and deliver warm goodbye. Thank them for their time."
                )
        
        elif self.reason == "disqualified":
            self.session.generate_reply(
                instructions=f"Deliver empathetic goodbye explaining they don't qualify. Reason: {self.disqualification_reason}. Be warm and understanding."
            )
        
        elif self.reason == "waiting_for_correct_person":
            self.session.generate_reply(
                instructions="Tell them you'll wait while they get the correct person on the phone. Be patient and friendly."
            )
        
        elif self.reason == "wrong_person_unavailable":
            self.session.generate_reply(
                instructions="Politely end the call since the correct person isn't available. Offer to call back later."
            )
        
        else:
            # Standard goodbye
            self.session.generate_reply(
                instructions="Deliver warm goodbye. Thank them for their time and offer to help if they have more questions."
            )
    
    @function_tool()
    async def route_to_answer(self, context: RunContext):
        """
        Route back to answer agent if user has questions.
        
        Call when:
        - User asks a question during goodbye
        - User wants more information before ending call
        
        Do NOT call for:
        - Standard goodbye acknowledgment
        - User just saying "thanks" or "goodbye"
        """
        logger.info("Routing to answer - user has questions during goodbye")
        
        from .answer import BarbaraAnswerAgent
        
        return BarbaraAnswerAgent(
            caller_phone=self.caller_phone,
            lead_data=self.lead_data,
            vertical=self.vertical,
            chat_ctx=self.chat_ctx
        )

