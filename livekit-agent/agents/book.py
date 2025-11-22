"""
Barbara's Booking Agent

Schedules appointments with brokers. Can route to answer (for questions) or goodbye (after booking).
"""

from livekit.agents import Agent, function_tool, RunContext
from livekit.agents.llm import ChatContext
from services.prompt_loader import load_node_config
from services.conversation_state import update_conversation_state
from tools.calendar import check_broker_availability, book_appointment
from typing import Optional
import logging

logger = logging.getLogger("agents.book")


class BarbaraBookAgent(Agent):
    """Agent for booking appointments - can route to answer or goodbye"""
    
    def __init__(
        self, 
        caller_phone: str, 
        lead_data: dict, 
        vertical: str = "reverse_mortgage",
        chat_ctx: Optional[ChatContext] = None
    ):
        config = load_node_config("book", vertical)
        
        super().__init__(
            instructions=config['instructions'],
            chat_ctx=chat_ctx
        )
        
        self.caller_phone = caller_phone
        self.lead_data = lead_data
        self.vertical = vertical
        
        logger.info(f"BarbaraBookAgent created for {caller_phone}")
    
    async def on_enter(self) -> None:
        """Called when agent takes control - check history and broker availability"""
        # First, check if user already expressed booking preferences in their last message
        history_items = list(self.chat_ctx.items) if hasattr(self.chat_ctx, 'items') else []
        
        # Find the last user message and check if it contains booking preferences
        user_provided_preferences = False
        user_asked_to_book = False
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
                
                # Detect if user asked to book
                booking_request_indicators = [
                    'book', 'schedule', 'appointment', 'meeting', 'set up',
                    'available', 'when can', 'what time', 'i want to'
                ]
                message_lower = last_user_message_text.lower()
                if any(indicator in message_lower for indicator in booking_request_indicators):
                    user_asked_to_book = True
                
                # Detect if user provided scheduling preferences (day, time)
                preference_indicators = [
                    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
                    'morning', 'afternoon', 'evening', 'tomorrow', 'next week',
                    'am', 'pm', 'o\'clock', ':00', 'at ', 'around'
                ]
                if any(indicator in message_lower for indicator in preference_indicators):
                    user_provided_preferences = True
                
                if user_asked_to_book or user_provided_preferences:
                    logger.info(f"Detected booking request/preferences in last user message: {last_user_message_text[:100]}")
                break
        
        # Build booking context
        booking_context = """
=== BOOKING CONTEXT ===
"""
        
        if user_asked_to_book:
            booking_context += "- User asked to book an appointment\n"
        if user_provided_preferences:
            booking_context += f"- User provided scheduling preferences in last message\n"
            booking_context += f"- Last message: {last_user_message_text[:200]}\n"
            booking_context += "- Extract day/time preferences and use them when checking availability\n"
        
        booking_context += "===========================\n"
        
        # Let database prompt handle the actual instructions
        await self.session.generate_reply(
            instructions=booking_context
        )
    
    @function_tool()
    async def check_broker_availability(
        self, 
        context: RunContext,
        preferred_day: Optional[str] = None,
        preferred_time: Optional[str] = None
    ) -> str:
        """
        Check broker calendar availability for appointment scheduling.
        
        Call when:
        - User wants to book an appointment
        - You need to show available time slots
        
        Args:
            preferred_day: Preferred day of week if user expressed preference (monday, tuesday, etc.)
            preferred_time: Preferred time of day if user expressed preference (morning, afternoon, evening)
        """
        # Get broker_id from lead_data (assigned broker)
        broker_id = self.lead_data.get('assigned_broker_id')
        
        if not broker_id:
            import json
            logger.error(f"❌ No assigned broker for lead: {self.lead_data.get('id')}")
            return json.dumps({
                "success": False,
                "error": "No assigned broker",
                "message": "This lead doesn't have an assigned broker. Please contact support to assign one."
            })
        
        # Use existing tool from tools/calendar.py
        from tools.calendar import check_broker_availability as check_tool
        result = await check_tool(
            broker_id=broker_id,
            preferred_day=preferred_day,
            preferred_time=preferred_time
        )
        
        logger.info(f"Broker availability checked for broker: {broker_id}")
        
        return result
    
    @function_tool()
    async def book_appointment(
        self, 
        context: RunContext,
        appointment_datetime: str,
        appointment_title: Optional[str] = None
    ) -> str:
        """
        Book the appointment with the broker.
        
        Call when:
        - User has selected a time slot
        - User confirms they want to book
        
        Args:
            appointment_datetime: ISO format datetime string (e.g., "2025-11-25T14:00:00")
            appointment_title: Optional title for the appointment
        """
        # Get broker_id and lead_id from lead_data
        broker_id = self.lead_data.get('assigned_broker_id')
        lead_id = self.lead_data.get('id')
        
        if not broker_id:
            import json
            logger.error(f"❌ No assigned broker for lead: {lead_id}")
            return json.dumps({
                "success": False,
                "error": "No assigned broker",
                "message": "Cannot book appointment - no assigned broker. Please contact support."
            })
        
        if not lead_id:
            import json
            logger.error(f"❌ No lead_id available for phone: {self.caller_phone}")
            return json.dumps({
                "success": False,
                "error": "No lead_id",
                "message": "Cannot book appointment - lead information missing."
            })
        
        # Use existing tool from tools/calendar.py
        from tools.calendar import book_appointment as book_tool
        result = await book_tool(
            lead_id=lead_id,
            broker_id=broker_id,
            scheduled_for=appointment_datetime,
            notes=appointment_title
        )
        
        import json
        result_data = json.loads(result)
        
        if result_data.get('success'):
            # Mark appointment booked in database
            update_conversation_state(
                self.caller_phone,
                {
                    "conversation_data": {
                        "appointment_booked": True,
                        "appointment_datetime": appointment_datetime
                    }
                }
            )
            
            logger.info(f"Appointment booked: {appointment_datetime}")
            
            # AUTOMATIC ROUTING: After successful booking, route to goodbye
            from .goodbye import BarbaraGoodbyeAgent
            return BarbaraGoodbyeAgent(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                reason="appointment_booked",
                chat_ctx=self.chat_ctx
            )
        
        return result
    
    @function_tool()
    async def route_to_answer(self, context: RunContext):
        """
        Route to answer agent for questions before booking.
        
        Call when:
        - User has questions before committing to appointment
        - User wants more information
        
        Do NOT call for:
        - Appointment already booked (use route_to_goodbye)
        - User ready to book (stay in book agent)
        """
        logger.info("Routing to answer - user has questions before booking")
        
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
        Route to objections agent when user expresses concerns or hesitation.
        
        Call when:
        - User expresses concerns after booking or during booking process
        - User says "I'm worried about..."
        - User has second thoughts
        - User expresses fear or hesitation
        
        Do NOT call for:
        - General questions (use route_to_answer)
        - Calculation questions (use route_to_quote)
        - User ready to book (stay in book agent)
        """
        logger.info("Routing to objections - concern detected during booking")
        
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
        Route to quote agent when user asks calculation questions.
        
        Call when:
        - User asks "how much can I get?"
        - User wants to see numbers/calculations
        - User asks about their equity or available funds
        - User wants a quote/estimate
        
        Do NOT call for:
        - General questions (use route_to_answer)
        - Concerns/objections (use route_to_objections)
        - User ready to book (stay in book agent)
        """
        logger.info("Routing to quote - calculation question detected during booking")
        
        from .quote import BarbaraQuoteAgent
        
        return BarbaraQuoteAgent(
            caller_phone=self.caller_phone,
            lead_data=self.lead_data,
            vertical=self.vertical,
            chat_ctx=self.chat_ctx
        )
    
    @function_tool()
    async def route_to_goodbye(self, context: RunContext):
        """
        Route to goodbye after booking complete or user declines.
        
        Call when:
        - Appointment successfully booked
        - User declines to book
        - Booking process complete
        
        Do NOT call if:
        - User has questions (use route_to_answer)
        - User has concerns (use route_to_objections)
        - User wants calculations (use route_to_quote)
        - Still in booking process (stay in book agent)
        """
        logger.info("Routing to goodbye - booking complete or declined")
        
        from .goodbye import BarbaraGoodbyeAgent
        
        # Check if appointment was booked
        from services.conversation_state import get_conversation_state
        state = get_conversation_state(self.caller_phone)
        conversation_data = (state.get('conversation_data', {}) if state else {})
        appointment_booked = conversation_data.get('appointment_booked', False)
        
        reason = "appointment_booked" if appointment_booked else "booking_declined"
        
        return BarbaraGoodbyeAgent(
            caller_phone=self.caller_phone,
            lead_data=self.lead_data,
            vertical=self.vertical,
            reason=reason,
            chat_ctx=self.chat_ctx
        )

