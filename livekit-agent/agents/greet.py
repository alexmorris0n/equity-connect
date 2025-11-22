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
        
        # Build dynamic context (no hard-coded instructions)
        greet_context = "=== GREETING CONTEXT ===\n"
        greet_context += f"Caller name: {first_name}\n"
        greet_context += "===========================\n"
        
        # Let database prompt handle the actual instructions
        await self.session.generate_reply(instructions=greet_context)
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
        # Check database status - EVERY call checks current flags from DATABASE
        # Get the lead from database to check verified status
        lead_id = self.lead_data.get('id')
        if not lead_id:
            logger.warning("No lead_id in lead_data, defaulting to unverified/unqualified")
            verified = False
            qualified = False
        else:
            from services.supabase import get_supabase_client
            sb = get_supabase_client()
            try:
                response = sb.table('leads').select('verified, qualified').eq('id', lead_id).single().execute()
                lead = response.data
                # verified is from leads.verified (auto-computed from phone/email/address)
                verified = lead.get('verified', False)
                # qualified is from leads.qualified
                qualified = lead.get('qualified', False)
                logger.info(f"Database status for {self.caller_phone}: verified={verified}, qualified={qualified}")
            except Exception as e:
                logger.error(f"Error fetching lead verification status: {e}")
                verified = False
                qualified = False
        
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
        # PERFECT ROUTE: greet → verify → qualify → quote → answer → book → goodbye
        # Skip steps that are already complete, but stay on the route
        if verified and qualified:
            # Both complete - skip verify & qualify, but continue route: go to QUOTE
            logger.info(f"Caller already verified + qualified, skipping to quote (perfect route)")
            from .quote import BarbaraQuoteAgent
            
            return BarbaraQuoteAgent(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                chat_ctx=self.chat_ctx
            )
        
        elif verified and not qualified:
            # Verified but not qualified - skip verify, continue route: go to QUALIFY
            logger.info(f"Caller already verified, skipping to qualification (perfect route)")
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
    
    @function_tool()
    async def route_to_objections(self, context: RunContext):
        """
        Route to objections agent - EXCEPTION: Can be accessed from GREET before verify/qualify.
        
        Call when:
        - User expresses concerns or objections in greeting
        - User is hesitant or skeptical before giving personal info
        - User says things like "I'm not sure about this", "I heard bad things", "This sounds like a scam"
        
        CRITICAL: This is the ONLY exception to the verify/qualify requirement.
        People won't give personal information if they have objections, so we must address
        objections first, even before verification.
        
        Do NOT call for:
        - General questions (use mark_greeted to route normally)
        - Booking requests (use mark_greeted with booking keyword)
        """
        logger.info("Routing to objections from GREET - user has concerns before verify/qualify")
        
        update_conversation_state(
            self.caller_phone,
            {
                "conversation_data": {
                    "has_objections": True,
                    "node_before_objection": "greet"
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
    
    @function_tool()
    async def route_to_quote(self, context: RunContext):
        """
        Route to quote calculation - EXCEPTION: Can be accessed from GREET for calculation questions.
        
        Call when:
        - User asks "How much can I get?" in greeting
        - User asks calculation questions before verification
        - User wants to know amounts immediately
        
        This allows routing to QUOTE before verification/qualification for calculation questions.
        QUOTE will handle missing data gracefully and route back to QUALIFY if needed.
        
        Do NOT call for:
        - General questions (use mark_greeted to route normally)
        - Booking requests (use mark_greeted with booking keyword)
        """
        logger.info("Routing to quote from GREET - calculation question detected")
        
        from .quote import BarbaraQuoteAgent
        
        return BarbaraQuoteAgent(
            caller_phone=self.caller_phone,
            lead_data=self.lead_data,
            vertical=self.vertical,
            chat_ctx=self.chat_ctx
        )

