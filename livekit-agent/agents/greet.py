"""
Barbara's Greeting Agent

Establishes rapport and routes to appropriate next step based on database status.
Checks conversation_data flags to determine if verification/qualification are needed.
"""

from livekit.agents import Agent, function_tool, RunContext
from livekit.agents.llm import ChatContext
from services.prompt_loader import load_node_config
from services.conversation_state import update_conversation_state, get_conversation_state
from typing import Optional
import logging

logger = logging.getLogger("agents.greet")


class BarbaraGreetAgent(Agent):
    """Barbara's greeting agent - establishes rapport and determines next step"""
    
    def __init__(
        self, 
        caller_phone: str, 
        lead_data: dict, 
        vertical: str = "reverse_mortgage",
        chat_ctx: Optional[ChatContext] = None
    ):
        # Load from database (same as node system)
        try:
            config = load_node_config("greet", vertical)
            instructions = config['instructions']
            logger.info(f"✅ Loaded greet config from database for {vertical}")
        except Exception as e:
            logger.error(f"❌ Failed to load greet config: {e}")
            # Fallback to basic instructions
            instructions = "You are Barbara, a friendly AI assistant for reverse mortgage inquiries. Greet the caller warmly."
        
        super().__init__(
            instructions=instructions,
            chat_ctx=chat_ctx
        )
        
        self.caller_phone = caller_phone
        self.lead_data = lead_data
        self.vertical = vertical
        
        logger.info(f"BarbaraGreetAgent created for {caller_phone}")
    
    async def on_enter(self) -> None:
        """Called when agent takes control - deliver scripted greeting"""
        first_name = self.lead_data.get('first_name', 'there')
        
        logger.info(f"🎤 Generating greeting for {first_name}...")
        self.session.generate_reply(
            instructions=f"Deliver your warm greeting to {first_name}. Ask how they're doing today."
        )
        logger.info(f"✅ Greeting generation triggered for {first_name}")
    
    @function_tool()
    async def mark_greeted(self, context: RunContext, reason_summary: str):
        """
        Mark caller as greeted and route to appropriate next step.
        
        Call this after:
        - Caller has responded to your greeting
        - You've captured why they're calling (reason_summary)
        
        Args:
            reason_summary: One-sentence description of why they called
                Examples: "Caller has questions", "Wants to know how much they can access", 
                         "Called back after receiving materials", "Ready to book appointment"
        
        This tool checks the database to determine if verification/qualification
        are already complete from a previous call, and routes accordingly.
        """
        # Check database status - EVERY call checks current flags
        state = get_conversation_state(self.caller_phone)
        conversation_data = (state.get('conversation_data', {}) if state else {})
        
        verified = conversation_data.get('verified', False)
        qualified = conversation_data.get('qualified', False)
        
        # Mark greeted with reason
        update_conversation_state(
            self.caller_phone,
            {
                "conversation_data": {
                    "greeted": True,
                    "greeting_reason": reason_summary
                }
            }
        )
        
        logger.info(f"Greeted: {self.caller_phone} - reason: {reason_summary}")
        logger.info(f"Database status: verified={verified}, qualified={qualified}")
        
        # If asking to book explicitly, route to booking
        if any(keyword in reason_summary.lower() for keyword in ['book', 'appointment', 'schedule', 'meeting']):
            logger.info(f"Booking request detected in reason - routing to book")
            update_conversation_state(
                self.caller_phone,
                {"conversation_data": {"ready_to_book": True}}
            )
            from .book import BarbaraBookAgent
            return BarbaraBookAgent(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                chat_ctx=self.chat_ctx
            )
        
        # Route based on CURRENT database state
        if verified and qualified:
            # Both complete - skip to main conversation
            logger.info(f"Caller already verified + qualified, skipping to answer")
            from .answer import BarbaraAnswerAgent
            
            return BarbaraAnswerAgent(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                chat_ctx=self.chat_ctx
            )
        
        elif verified and not qualified:
            # Verified but not qualified - skip verify, run qualify
            logger.info(f"Caller already verified, skipping to qualification")
            from .qualify import BarbaraQualifyTask
            
            return BarbaraQualifyTask(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                chat_ctx=self.chat_ctx
            )
        
        else:
            # Not verified (or missing) - run verification
            logger.info(f"Caller needs verification")
            from .verify import BarbaraVerifyTask
            
            return BarbaraVerifyTask(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                chat_ctx=self.chat_ctx
            )
    
    @function_tool()
    async def mark_wrong_person(
        self, 
        context: RunContext, 
        right_person_available: bool,
        relationship: str
    ):
        """
        Record that wrong person answered the phone.
        
        Call when:
        - Person who answered is not the lead
        - Example: Wife answers but call is for husband
        
        Args:
            right_person_available: True if correct person can come to phone now
            relationship: Relationship to lead (e.g., "spouse", "child", "caregiver")
        """
        from .goodbye import BarbaraGoodbyeAgent
        
        update_conversation_state(
            self.caller_phone,
            {
                "conversation_data": {
                    "wrong_person": True,
                    "right_person_available": right_person_available,
                    "wrong_person_relationship": relationship
                }
            }
        )
        
        if right_person_available:
            # Wait for handoff (handled in goodbye)
            return BarbaraGoodbyeAgent(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                reason="waiting_for_correct_person",
                chat_ctx=self.chat_ctx
            )
        else:
            # End call politely
            return BarbaraGoodbyeAgent(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                reason="wrong_person_unavailable",
                chat_ctx=self.chat_ctx
            )

