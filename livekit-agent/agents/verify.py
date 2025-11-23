"""
Barbara's Verification Task

Collects and verifies caller identity. MUST complete before continuing.
This is a Task (not Agent) because verification is mandatory and cannot be skipped.
"""

from livekit.agents import AgentTask, function_tool, RunContext, ToolError
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

    def _store_session_verification_state(self, context: RunContext, **fields) -> None:
        """Persist verification progress inside the session userdata via RunContext."""
        session = getattr(context, "session", None)
        if not session:
            return
        userdata = getattr(session, "userdata", None)
        if userdata is None:
            try:
                session.userdata = {}  # type: ignore[attr-defined]
                userdata = session.userdata
            except Exception as exc:  # pragma: no cover - defensive
                logger.debug(f"Unable to initialize session userdata: {exc}")
                return
        if isinstance(userdata, dict):
            verification_state = userdata.get("verification_state", {})
            verification_state.update({k: v for k, v in fields.items() if v is not None})
            userdata["verification_state"] = verification_state
            return
        for key, value in fields.items():
            try:
                setattr(userdata, key, value)
            except AttributeError:
                logger.debug(f"Unable to set session userdata field {key}")
    
    async def on_enter(self) -> None:
        """Start verification - collect missing info or confirm existing"""
        # Build dynamic context (no hard-coded instructions)
        verify_context = "=== VERIFICATION CONTEXT ===\n"
        
        # Check what verification fields are needed
        lead_id = self.lead_data.get('id')
        if lead_id:
            from services.supabase import get_supabase_client
            sb = get_supabase_client()
            try:
                response = sb.table('leads').select('phone_verified, email_verified, address_verified').eq('id', lead_id).single().execute()
                lead = response.data
                verify_context += f"Phone verified: {lead.get('phone_verified', False)}\n"
                verify_context += f"Email verified: {lead.get('email_verified', False)}\n"
                verify_context += f"Address verified: {lead.get('address_verified', False)}\n"
            except Exception as e:
                logger.error(f"Error checking verification status: {e}")
        
        # Check history for verification info
        history_items = list(self.chat_ctx.items) if hasattr(self.chat_ctx, 'items') else []
        for item in reversed(history_items):
            if hasattr(item, 'role') and item.role == 'user':
                if hasattr(item, 'text_content'):
                    last_message = item.text_content()
                elif hasattr(item, 'content'):
                    content = item.content
                    last_message = ' '.join(str(c) for c in content if c) if isinstance(content, list) else str(content)
                else:
                    continue
                verify_context += f"Last user message: {last_message[:200]}\n"
                verify_context += "Extract verification info if provided.\n"
                break
        
        verify_context += "===========================\n"
        
        # Let database prompt handle the actual instructions
        await self.session.generate_reply(instructions=verify_context)
    
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

            self._store_session_verification_state(
                context,
                verified=True,
                lead_id=lead_id
            )

            try:
                update_conversation_state(self.caller_phone, {
                    "lead_id": lead_id,
                    "conversation_data": {
                        "verified": True,
                        "verification_source": "barbara_verify_task"
                    }
                })
            except Exception as state_error:
                logger.warning(f"Unable to persist verification state: {state_error}")

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
            self._store_session_verification_state(context, verified=False)
            self.complete(VerificationResult(
                verified=False,
                lead_id=None
            ))
    
    @function_tool()
    async def mark_phone_verified(self, context: RunContext, phone_number: str):
        """
        Mark phone number as verified after confirming it with the caller.
        
        Call when:
        - You've confirmed their phone number verbally
        - They've acknowledged it's correct
        
        Args:
            phone_number: The phone number being verified (e.g., "555-123-4567")
        """
        lead_id = self.lead_data.get('id')
        if not lead_id:
            raise ToolError("No lead_id available. Cannot mark phone verified.")
        
        from services.supabase import get_supabase_client
        sb = get_supabase_client()
        
        try:
            sb.table('leads').update({
                'phone_verified': True
            }).eq('id', lead_id).execute()
            
            logger.info(f"✅ Phone verified for lead {lead_id}: {phone_number}")
            self._store_session_verification_state(
                context,
                phone_verified=True,
                verified_phone_number=phone_number
            )
            try:
                update_conversation_state(self.caller_phone, {
                    "conversation_data": {
                        "phone_verified": True,
                        "verified_phone_number": phone_number
                    }
                })
            except Exception as state_error:
                logger.warning(f"Unable to persist phone verification state: {state_error}")
            return f"Phone number {phone_number} verified successfully."
        except Exception as e:
            logger.error(f"Failed to mark phone verified: {e}")
            raise ToolError(f"Error verifying phone: {str(e)}") from e
    
    @function_tool()
    async def mark_email_verified(self, context: RunContext, email: str):
        """
        Mark email address as verified after confirming it with the caller.
        
        Call when:
        - You've confirmed their email address verbally
        - They've spelled it out or acknowledged it's correct
        
        Args:
            email: The email address being verified (e.g., "john@example.com")
        """
        lead_id = self.lead_data.get('id')
        if not lead_id:
            raise ToolError("No lead_id available. Cannot mark email verified.")
        
        from services.supabase import get_supabase_client
        sb = get_supabase_client()
        
        try:
            # Update email if provided and mark as verified
            sb.table('leads').update({
                'primary_email': email,
                'email_verified': True
            }).eq('id', lead_id).execute()
            
            logger.info(f"✅ Email verified for lead {lead_id}: {email}")
            self._store_session_verification_state(
                context,
                email_verified=True,
                verified_email=email
            )
            try:
                update_conversation_state(self.caller_phone, {
                    "conversation_data": {
                        "email_verified": True,
                        "verified_email": email
                    }
                })
            except Exception as state_error:
                logger.warning(f"Unable to persist email verification state: {state_error}")
            return f"Email {email} verified successfully."
        except Exception as e:
            logger.error(f"Failed to mark email verified: {e}")
            raise ToolError(f"Error verifying email: {str(e)}") from e
    
    @function_tool()
    async def mark_address_verified(
        self, 
        context: RunContext, 
        address: str,
        city: str,
        state: str,
        zip_code: str
    ):
        """
        Mark property address as verified after confirming it with the caller.
        
        Call when:
        - You've confirmed their full property address
        - They've acknowledged it's correct
        
        Args:
            address: Street address (e.g., "123 Main St")
            city: City name (e.g., "Springfield")
            state: State abbreviation (e.g., "CA")
            zip_code: ZIP code (e.g., "12345")
        """
        lead_id = self.lead_data.get('id')
        if not lead_id:
            raise ToolError("No lead_id available. Cannot mark address verified.")
        
        from services.supabase import get_supabase_client
        sb = get_supabase_client()
        
        try:
            # Update address fields and mark as verified
            update_data = {
                'property_address': address,
                'property_city': city,
                'property_state': state,
                'property_zip': zip_code,
                'address_verified': True
            }
            
            sb.table('leads').update(update_data).eq('id', lead_id).execute()
            
            logger.info(f"✅ Address verified for lead {lead_id}: {address}, {city}, {state} {zip_code}")
            
            # BONUS: Auto-assign broker based on territory after address verification
            from tools.broker import find_broker_by_territory
            try:
                broker_result = await find_broker_by_territory(state, city, zip_code)
                import json
                broker_data = json.loads(broker_result)
                if broker_data.get('success') and broker_data.get('broker_id'):
                    logger.info(f"✅ Auto-assigned broker {broker_data['broker_id']} based on territory")
            except Exception as broker_error:
                logger.warning(f"Could not auto-assign broker: {broker_error}")
            
            full_address = f"{address}, {city}, {state} {zip_code}"
            self._store_session_verification_state(
                context,
                address_verified=True,
                verified_address=full_address
            )
            try:
                update_conversation_state(self.caller_phone, {
                    "conversation_data": {
                        "address_verified": True,
                        "verified_address": full_address
                    }
                })
            except Exception as state_error:
                logger.warning(f"Unable to persist address verification state: {state_error}")
            return f"Property address {full_address} verified successfully."
        except Exception as e:
            logger.error(f"Failed to mark address verified: {e}")
            raise ToolError(f"Error verifying address: {str(e)}") from e
    
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
            raise ToolError("No lead_id available. Cannot update lead info.")
        
        # Use existing tool from tools/lead.py
        from tools.lead import update_lead_info as update_tool
        try:
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
        except Exception as exc:
            logger.error(f"Failed to update lead info: {exc}")
            raise ToolError(f"Error updating lead info: {str(exc)}") from exc
        
        logger.info(f"Updated lead {lead_id}")
        updated_fields = {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": phone,
            "property_address": property_address,
            "property_city": property_city,
            "property_state": property_state,
            "property_zip": property_zip,
            "age": age,
            "money_purpose": money_purpose,
            "amount_needed": amount_needed,
            "timeline": timeline
        }
        filtered_updates = {k: v for k, v in updated_fields.items() if v is not None}
        if filtered_updates:
            self._store_session_verification_state(context, **filtered_updates)
            try:
                update_conversation_state(self.caller_phone, {
                    "conversation_data": filtered_updates
                })
            except Exception as state_error:
                logger.warning(f"Unable to persist lead info updates: {state_error}")
        
        return result_str
