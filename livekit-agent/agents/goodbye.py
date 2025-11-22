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
        # First, check conversation history to see if user already said something relevant
        history_items = list(self.chat_ctx.items) if hasattr(self.chat_ctx, 'items') else []
        
        # Find the last user message
        last_user_message_text = ""
        user_said_goodbye = False
        user_has_question = False
        
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
                
                # Detect if user said goodbye/thanks
                goodbye_indicators = ['thanks', 'thank you', 'goodbye', 'bye', 'have a good', 'talk to you', 'appreciate it']
                message_lower = last_user_message_text.lower()
                if any(indicator in message_lower for indicator in goodbye_indicators):
                    user_said_goodbye = True
                
                # Detect if user asked a question
                question_indicators = ['?', 'can i', 'what', 'when', 'where', 'who', 'why', 'how']
                if '?' in last_user_message_text or any(indicator in message_lower for indicator in question_indicators):
                    user_has_question = True
                
                break
        
        # Build dynamic context (no hard-coded instructions)
        goodbye_context = "=== GOODBYE CONTEXT ===\n"
        goodbye_context += f"Reason: {self.reason or 'standard'}\n"
        
        if self.reason == "appointment_booked":
            state = get_conversation_state(self.caller_phone)
            conversation_data = (state.get('conversation_data', {}) if state else {})
            appointment_datetime = conversation_data.get('appointment_datetime')
            if appointment_datetime:
                goodbye_context += f"Appointment datetime: {appointment_datetime}\n"
        
        if self.reason == "disqualified" and self.disqualification_reason:
            goodbye_context += f"Disqualification reason: {self.disqualification_reason}\n"
        
        if user_said_goodbye:
            goodbye_context += f"User already said goodbye/thanks: '{last_user_message_text[:100]}'\n"
        elif user_has_question:
            goodbye_context += f"User asked a question: '{last_user_message_text[:100]}'\n"
        
        goodbye_context += "===========================\n"
        
        # Let database prompt handle the actual instructions
        await self.session.generate_reply(
            instructions=goodbye_context
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

