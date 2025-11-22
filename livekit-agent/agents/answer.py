"""
Barbara's Answer Agent

Answers questions using knowledge base. Can route to quote, objections, or booking
based on user intent. This is an Agent (not Task) because user can ask multiple
questions and conversation can go in different directions.
"""

from livekit.agents import Agent, function_tool, RunContext
from livekit.agents.llm import ChatContext
from services.prompt_loader import load_node_config
from services.conversation_state import update_conversation_state
from tools.knowledge import search_knowledge
from typing import Optional
import logging

logger = logging.getLogger("agents.answer")


class BarbaraAnswerAgent(Agent):
    """Agent for answering questions - flexible conversation, can route anywhere"""
    
    def __init__(
        self, 
        caller_phone: str, 
        lead_data: dict, 
        vertical: str = "reverse_mortgage",
        chat_ctx: Optional[ChatContext] = None
    ):
        config = load_node_config("answer", vertical)
        
        super().__init__(
            instructions=config['instructions'],
            chat_ctx=chat_ctx
        )
        
        self.caller_phone = caller_phone
        self.lead_data = lead_data
        self.vertical = vertical
        
        logger.info(f"BarbaraAnswerAgent created for {caller_phone}")
    
    async def on_enter(self) -> None:
        """Called when agent takes control - check if user already asked a question"""
        # Check conversation history to see if user already asked something
        # If yes, answer it. If no, prompt for question.
        history_items = list(self.session.chat_ctx.items) if hasattr(self.session.chat_ctx, 'items') else []
        
        # Check if last user message was a question
        user_has_question = False
        if history_items:
            last_item = history_items[-1]
            if hasattr(last_item, 'role') and last_item.role == 'user':
                user_has_question = True
        
        if user_has_question:
            await self.session.generate_reply(
                instructions="Answer the user's question using search_knowledge if needed."
            )
        else:
            await self.session.generate_reply(
                instructions="Prompt the user to ask their question. Be warm and encouraging."
            )
    
    @function_tool()
    async def search_knowledge_tool(self, context: RunContext, question: str) -> str:
        """
        Search knowledge base for answers to user's questions.
        
        Call when:
        - User asks factual question about reverse mortgages
        - You need information to answer accurately
        - Question is about eligibility, fees, process, rules, etc.
        
        Do NOT call for:
        - Calculation questions ("how much can I get?") - use route_to_quote instead
        - Booking requests ("I want to schedule") - use route_to_booking instead
        - Concerns/objections ("I'm worried about...") - use route_to_objections instead
        
        Examples of when to use:
        - "Can my wife stay in the house?"
        - "What are the fees?"
        - "How does this work?"
        - "What if I die?"
        
        Args:
            question: User's question (can be reformulated for better search results)
        """
        # Use existing tool from tools/knowledge.py
        result = await search_knowledge(question)
        
        logger.info(f"Knowledge search completed for: {question[:50]}...")
        
        return result
    
    @function_tool()
    async def route_to_quote(self, context: RunContext):
        """
        CRITICAL ROUTING RULE: Route to quote calculation.
        
        Call IMMEDIATELY when user asks calculation questions:
        - "How much can I get?"
        - "What are my numbers?"
        - "Calculate my equity"
        - "Run those numbers"
        - "What's available to me?"
        - "How much money is available?"
        - ANY variation asking for dollar amounts or calculations
        
        This is a CRITICAL routing rule from trace_test.md Scenario 7.
        Calculation questions go straight to quote - do NOT try to answer them with search_knowledge.
        
        Do NOT call for:
        - General questions about reverse mortgages (use search_knowledge)
        - Questions about fees or process (use search_knowledge)
        - Only call when user explicitly wants numbers calculated
        """
        logger.info("Routing to quote - calculation question detected")
        
        from .quote import BarbaraQuoteAgent
        
        return BarbaraQuoteAgent(
            caller_phone=self.caller_phone,
            lead_data=self.lead_data,
            vertical=self.vertical,
            chat_ctx=self.session.chat_ctx
        )
    
    @function_tool()
    async def route_to_booking(self, context: RunContext):
        """
        ROUTING TOOL: Transfer to appointment booking.
        
        Call when user EXPLICITLY says:
        - "I'm ready to book"
        - "I want to schedule"
        - "Let's set up an appointment"
        - "I'd like to speak with someone"
        - "Schedule me"
        - "Book me"
        
        Do NOT call for:
        - Simple acknowledgments ("okay", "yep", "thanks", "got it")
        - User just confirming they understand your answer
        - User has more questions (stay in answer agent)
        - User says "that helps" or "good to know" (acknowledgment, not booking request)
        
        ONLY call when user clearly and explicitly requests booking/scheduling.
        This is critical - false positives cause bad UX (routing when user just said "yep").
        """
        logger.info("Routing to booking - explicit booking request detected")
        
        from .book import BarbaraBookAgent
        
        # Mark ready to book in database
        update_conversation_state(
            self.caller_phone,
            {
                "conversation_data": {
                    "ready_to_book": True
                }
            }
        )
        
        return BarbaraBookAgent(
            caller_phone=self.caller_phone,
            lead_data=self.lead_data,
            vertical=self.vertical,
            chat_ctx=self.session.chat_ctx
        )
    
    @function_tool()
    async def route_to_objections(self, context: RunContext):
        """
        ROUTING TOOL: Transfer to objection handling.
        
        Call when user expresses concerns or hesitation:
        - "I'm worried about..."
        - "What if [bad thing happens]?"
        - "My kids told me this is a scam"
        - "I'm not sure about this"
        - "I'm nervous"
        - "That sounds risky"
        
        Concerns vs Questions:
        - Question: "Can my wife stay?" (factual, use search_knowledge)
        - Concern: "I'm worried my wife won't be able to stay" (emotional, use this tool)
        
        Key difference:
        - Questions seek information (use search_knowledge)
        - Concerns express fear/hesitation (use this tool to route to objections)
        """
        logger.info("Routing to objections - concern detected")
        
        from .objections import BarbaraObjectionsAgent
        
        return BarbaraObjectionsAgent(
            caller_phone=self.caller_phone,
            lead_data=self.lead_data,
            vertical=self.vertical,
            chat_ctx=self.session.chat_ctx
        )

