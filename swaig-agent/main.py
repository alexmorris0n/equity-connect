"""
Barbara SWAIG Agent - SignalWire AI Gateway Implementation
Preserves BarbGraph 8-node event-driven routing architecture
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from typing import Dict, Any, List, Optional
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Barbara SWAIG Agent")

# Import services
from services.database import get_lead_by_phone, get_conversation_state, update_conversation_state
from services.routing import determine_next_node, is_node_complete
from services.prompts import build_full_prompt

# ============================================================================
# 1. AGENT CONFIGURATION ENDPOINT
# ============================================================================

@app.post("/agent/barbara")
async def barbara_agent(request: Request):
    """
    Generate SWML configuration for Barbara agent
    Called by SignalWire when call starts
    
    Per official SignalWire starter pack pattern
    """
    try:
        # Extract caller info from SignalWire request
        body = await request.json()
        
        # DEBUG: Log full webhook structure (first 2000 chars to avoid huge logs)
        body_str = str(body)[:2000]
        logger.info(f"[AGENT] Webhook body structure (truncated): {body_str}")
        
        # Extract phone number from SignalWire webhook structure
        # Based on actual webhook payloads, check multiple possible locations
        # PRIORITY ORDER: Check most common structures first
        
        caller_id = None
        direction = 'inbound'
        
        # Structure 1: body['call']['from_number'] (MOST COMMON - initial call webhook)
        call_obj = body.get('call', {})
        if call_obj:
            direction = call_obj.get('direction', 'inbound').lower()
            if call_obj.get('from_number'):
                caller_id = call_obj.get('from_number')
                logger.info(f"[AGENT] Found phone in call.from_number: {caller_id}")
            elif call_obj.get('from'):
                caller_id = call_obj.get('from')
                logger.info(f"[AGENT] Found phone in call.from: {caller_id}")
            elif call_obj.get('to_number') and direction == 'outbound':
                caller_id = call_obj.get('to_number')
                logger.info(f"[AGENT] Found phone in call.to_number (outbound): {caller_id}")
        
        # Structure 2: params.request_payload.SWMLCall.from_number (error webhook example)
        if not caller_id:
            params = body.get('params', {})
            if params:
                direction = params.get('direction', direction).lower()
                request_payload = params.get('request_payload', {})
                swml_call = request_payload.get('SWMLCall', {})
                if swml_call.get('from_number'):
                    caller_id = swml_call.get('from_number')
                    logger.info(f"[AGENT] Found phone in params.request_payload.SWMLCall.from_number: {caller_id}")
                elif swml_call.get('to_number') and direction == 'outbound':
                    caller_id = swml_call.get('to_number')
                    logger.info(f"[AGENT] Found phone in params.request_payload.SWMLCall.to_number: {caller_id}")
                
                # Structure 3: params.request_payload.caller_id_number
                if not caller_id and request_payload.get('caller_id_number'):
                    caller_id = request_payload.get('caller_id_number')
                    logger.info(f"[AGENT] Found phone in params.request_payload.caller_id_number: {caller_id}")
                
                # Structure 4: params.device.params.from_number
                if not caller_id:
                    device_params = params.get('device', {}).get('params', {})
                    if device_params.get('from_number'):
                        caller_id = device_params.get('from_number')
                        logger.info(f"[AGENT] Found phone in params.device.params.from_number: {caller_id}")
                    elif device_params.get('to_number') and direction == 'outbound':
                        caller_id = device_params.get('to_number')
                        logger.info(f"[AGENT] Found phone in params.device.params.to_number: {caller_id}")
        
        # Structure 5: Top-level fallbacks
        if not caller_id:
            caller_id = body.get('From') or body.get('caller_id_number') or body.get('caller_id_num')
            if caller_id:
                logger.info(f"[AGENT] Found phone in top-level: {caller_id}")
        
        # Final fallback
        if not caller_id:
            caller_id = 'unknown'
            logger.error(f"[AGENT] Could not extract phone number. Body top-level keys: {list(body.keys())}")
        
        # Normalize phone number (remove +1 and +)
        phone = caller_id.replace('+1', '').replace('+', '').strip() if caller_id != 'unknown' else 'unknown'
        logger.info(f"[AGENT] Call from: {caller_id} (normalized: {phone}, direction: {direction})")
        
        # Load lead and conversation state from database
        lead = await get_lead_by_phone(phone)
        state = await get_conversation_state(phone)
        
        # Determine starting node (multi-call persistence)
        current_node = "greet"
        if state:
            # Resume where we left off
            if state.get('conversation_data', {}).get('appointment_booked'):
                current_node = "goodbye"
            elif state.get('conversation_data', {}).get('ready_to_book'):
                current_node = "book"
            elif state.get('qualified'):
                current_node = "answer"
            current_node = state.get('current_node', current_node)
        
        logger.info(f"[AGENT] Starting at node: {current_node}")
        
        # Build contexts structure (all 8 nodes) from database
        from services.contexts import build_contexts_structure
        contexts = await build_contexts_structure(
            lead_context=lead,
            phone_number=phone,
            vertical="reverse_mortgage",
            starting_node=current_node
        )
        
        # Load active models from database (component-based configuration)
        from services.database import get_active_signalwire_models
        active_models = await get_active_signalwire_models()
        
        llm_model = active_models.get("llm_model", "gpt-4o-mini")
        stt_model = active_models.get("stt_model", "deepgram:nova-3")
        voice_string = active_models.get("tts_voice_string", "elevenlabs.rachel")
        
        # Validate voice_string is not None/empty
        if not voice_string or voice_string == "None":
            logger.error(f"[AGENT] Invalid voice_string: {voice_string}, using fallback")
            voice_string = "elevenlabs.rachel"
        
        logger.info(f"[AGENT] Active models loaded:")
        logger.info(f"[AGENT]   LLM: {llm_model}")
        logger.info(f"[AGENT]   STT: {stt_model}")
        logger.info(f"[AGENT]   TTS: {voice_string}")
        logger.info(f"[AGENT] Built {len(contexts)} contexts with native SignalWire context switching")
        
        # Build SWML response (per SignalWire official docs)
        # CRITICAL: Using prompt.contexts for native context switching (not single prompt.text)
        # This enables the AI to switch between contexts based on valid_contexts in each step
        swml = {
            "version": "1.0.0",
            "sections": {
                "main": [
                    {"answer": {}},
                    {
                        "ai": {
                            # Post-conversation webhook (top level of ai, not in params)
                            "post_prompt_url": f"https://{os.getenv('PUBLIC_URL', 'localhost:8080')}/webhooks/post-conversation",
                            "prompt": {
                                "temperature": 0.6,
                                # Use contexts structure instead of single text prompt
                                # This enables native SignalWire context switching
                                "contexts": contexts
                            },
                            "params": {
                                # LLM Configuration (OpenAI) - Loaded from database
                                # Per SignalWire docs: gpt-4o-mini, gpt-4.1-mini, gpt-4.1-nano
                                "ai_model": llm_model,
                                # STT Configuration (Deepgram via OpenAI ASR engine) - Loaded from database
                                # Per SignalWire docs: deepgram:nova-2, deepgram:nova-3
                                "openai_asr_engine": stt_model,
                                # Call behavior settings
                                "end_of_speech_timeout": 700,
                                "attention_timeout": 5000,
                                "enable_barge": "complete,partial",
                                "transparent_barge": True,
                                "wait_for_user": False,  # Barbara speaks first
                                "save_conversation": True,
                                "conversation_id": phone,
                                # Conscience prompt to reinforce guardrails
                                "conscience": "Remember to stay in character as Barbara, a reverse mortgage specialist. Always use the calculate_reverse_mortgage function for any financial calculations - never estimate or guess numbers.",
                                # Timezone for time-related functions
                                "local_tz": "America/Los_Angeles",
                                # Debug webhook for real-time testing/monitoring
                                "debug_webhook_url": f"https://{os.getenv('PUBLIC_URL', 'localhost:8080')}/webhooks/debug",
                                "debug_webhook_level": 2  # 0=off, 1=basic, 2=verbose
                            },
                            "languages": [{
                                "name": "English",
                                "code": "en-US",
                                # TTS Configuration - Loaded from agent_voice_config table
                                # Format: engine.voice_id (e.g., elevenlabs.rachel, openai.alloy)
                                "voice": voice_string,
                                # Speech fillers removed - they play before EVERY turn including first greeting
                                # This was causing "Let me think..." before every response
                                # Use function_fillers only for tool calls instead
                                # Function fillers played during tool execution (not before every turn)
                                "function_fillers": [
                                    "Let me check that for you...",
                                    "One moment while I look that up...",
                                    "Calculating that now..."
                                ]
                            }],
                            "SWAIG": {
                                # CRITICAL: Use "function" (singular), not "functions" (plural)!
                                "includes": [{
                                    "function": [  # Changed from "functions"
                                        "route_conversation",
                                        "mark_greeted",
                                        "mark_verified",
                                        "mark_qualified",
                                        "mark_qualification_result",  # Vue/database uses this name
                                        "mark_quote_presented",
                                        "mark_ready_to_book",
                                        "mark_wrong_person",  # Added for LiveKit compatibility
                                        "mark_objection_handled",  # Added for LiveKit compatibility
                                        "mark_has_objection",  # Added for LiveKit compatibility
                                        "calculate_reverse_mortgage",
                                        "search_knowledge",
                                        "book_appointment",
                                        "verify_caller_identity",  # Added for LiveKit compatibility
                                        "update_lead_info",  # Added for LiveKit compatibility
                                        "check_broker_availability"  # Added for LiveKit compatibility
                                    ],
                                    "url": f"https://{os.getenv('PUBLIC_URL', 'localhost:8080')}/functions"
                                }],
                                # Native SignalWire functions
                                "native_functions": [
                                    "check_time",
                                    "wait_seconds",
                                    "wait_for_user"
                                ]
                            }
                        }
                    }
                ]
            }
        }
        
        logger.info(f"[AGENT] SWML generated for node: {current_node}")
        return JSONResponse(content=swml)
        
    except Exception as e:
        logger.error(f"[AGENT] Error: {e}", exc_info=True)
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )


# ============================================================================
# 2. FUNCTION DISCOVERY ENDPOINT
# ============================================================================

@app.post("/functions")
async def get_function_declarations(request: Request):
    """
    SignalWire asks: "What functions do you have?"
    Handles signature discovery requests (action: "get_signature")
    Return function declarations per official SignalWire docs
    """
    try:
        body = await request.json()
        
        # Check if this is a signature request (function discovery)
        action = body.get("action")
        if action == "get_signature":
            requested_functions = body.get("functions", [])
            logger.info(f"[FUNCTIONS] Signature request for: {requested_functions}")
        else:
            # If no action specified, assume signature request (backward compatibility)
            requested_functions = body.get("functions", [])
            logger.info(f"[FUNCTIONS] Declarations requested (no action): {requested_functions}")
        
        base_url = os.getenv('PUBLIC_URL', 'localhost:8080')
        function_declarations = []
        
        # Define all available functions
        # CRITICAL: Use "description" not "purpose" (purpose is deprecated)
        function_specs = {
            "route_conversation": {
                "function": "route_conversation",
                "description": "Check if node transition needed after user response",
                "parameters": {  # Changed from "argument" - declarations use "parameters"
                    "type": "object",
                    "properties": {
                        "current_node": {"type": "string", "description": "Current conversation node"},
                        "user_intent": {"type": "string", "description": "User's intent or response"}
                    }
                }
            },
            "mark_greeted": {
                "function": "mark_greeted",
                "description": "Mark that greeting has been completed",
                "parameters": {  # Changed from "argument"
                    "type": "object",
                    "properties": {
                        "greeted": {"type": "boolean", "description": "Greeting completed"}
                    }
                }
            },
            "mark_verified": {
                "function": "mark_verified",
                "description": "Mark that caller identity has been verified",
                "parameters": {  # Changed from "argument"
                    "type": "object",
                    "properties": {
                        "verified": {"type": "boolean", "description": "Identity verified"}
                    }
                }
            },
            "mark_qualified": {
                "function": "mark_qualified",
                "description": "Mark caller qualification status (age 62+, owner-occupied, equity)",
                "parameters": {  # Changed from "argument"
                    "type": "object",
                    "properties": {
                        "qualified": {"type": "boolean", "description": "Meets qualification criteria"}
                    }
                }
            },
            "mark_qualification_result": {
                "function": "mark_qualification_result",
                "description": "Mark caller qualification status (age 62+, owner-occupied, equity). Same as mark_qualified - use this when database/Vue uses mark_qualification_result name.",
                "parameters": {  # Changed from "argument"
                    "type": "object",
                    "properties": {
                        "qualified": {"type": "boolean", "description": "Meets qualification criteria"}
                    }
                }
            },
            "mark_quote_presented": {
                "function": "mark_quote_presented",
                "description": "Mark that financial quote has been presented",
                "parameters": {  # Changed from "argument"
                    "type": "object",
                    "properties": {
                        "quote_presented": {"type": "boolean", "description": "Quote presented"},
                        "quote_reaction": {"type": "string", "description": "positive, skeptical, not_interested"}
                    }
                }
            },
            "mark_ready_to_book": {
                "function": "mark_ready_to_book",
                "description": "Mark that caller is ready to schedule appointment",
                "parameters": {  # Changed from "argument"
                    "type": "object",
                    "properties": {
                        "ready_to_book": {"type": "boolean", "description": "Ready to schedule"}
                    }
                }
            },
            "calculate_reverse_mortgage": {
                "function": "calculate_reverse_mortgage",
                "description": "ALWAYS call this when presenting a quote or answering 'how much can I get?' questions. Calculate available reverse mortgage funds using accurate HECM formulas - NEVER estimate or guess amounts. Use this function every time you need to provide financial estimates to avoid hallucination.",
                "parameters": {  # Changed from "argument"
                    "type": "object",
                    "properties": {
                        "property_value": {"type": "integer", "description": "Property value in dollars"},
                        "age": {"type": "integer", "description": "Age of youngest borrower"},
                        "equity": {"type": "integer", "description": "Current equity"}
                    },
                    "required": ["property_value", "age"]
                }
            },
            "search_knowledge": {
                "function": "search_knowledge",
                "description": "Search knowledge base for reverse mortgage questions",
                "parameters": {  # Changed from "argument"
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Question to search for"}
                    },
                    "required": ["query"]
                }
            },
            "book_appointment": {
                "function": "book_appointment",
                "description": "Schedule consultation with assigned broker",
                "parameters": {  # Changed from "argument"
                    "type": "object",
                    "properties": {
                        "preferred_time": {"type": "string", "description": "Preferred appointment time"},
                        "notes": {"type": "string", "description": "Additional notes"}
                    },
                    "required": ["preferred_time"]
                }
            },
            "mark_wrong_person": {
                "function": "mark_wrong_person",
                "description": "Mark that wrong person answered the call",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "wrong_person": {"type": "boolean", "description": "Wrong person answered"},
                        "right_person_available": {"type": "boolean", "description": "Is the right person available?"}
                    }
                }
            },
            "mark_objection_handled": {
                "function": "mark_objection_handled",
                "description": "Mark that caller's objection has been resolved",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "objection_handled": {"type": "boolean", "description": "Objection resolved"}
                    }
                }
            },
            "mark_has_objection": {
                "function": "mark_has_objection",
                "description": "Mark that caller has raised an objection or concern",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "has_objection": {"type": "boolean", "description": "Caller has objection"}
                    }
                }
            },
            "verify_caller_identity": {
                "function": "verify_caller_identity",
                "description": "Verify caller identity by name and phone. Creates lead if new.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "first_name": {"type": "string", "description": "Caller's first name"},
                        "phone": {"type": "string", "description": "Caller's phone number"}
                    },
                    "required": ["first_name", "phone"]
                }
            },
            "update_lead_info": {
                "function": "update_lead_info",
                "description": "Update lead information (name, address, property details, etc.)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "phone": {"type": "string", "description": "Caller's phone number"},
                        "first_name": {"type": "string", "description": "First name"},
                        "last_name": {"type": "string", "description": "Last name"},
                        "property_address": {"type": "string", "description": "Property address"},
                        "property_city": {"type": "string", "description": "Property city"},
                        "property_state": {"type": "string", "description": "Property state"},
                        "property_zip": {"type": "string", "description": "Property ZIP code"},
                        "age": {"type": "integer", "description": "Caller's age"},
                        "estimated_equity": {"type": "number", "description": "Estimated home equity"}
                    }
                }
            },
            "check_broker_availability": {
                "function": "check_broker_availability",
                "description": "Check if assigned broker has availability for appointment",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "preferred_date": {"type": "string", "description": "Preferred date (optional)"},
                        "preferred_time": {"type": "string", "description": "Preferred time (optional)"}
                    }
                }
            }
        }
        
        # Build declarations for requested functions
        # CRITICAL: Return array directly, NOT wrapped in {"functions": [...]}
        # Per SignalWire docs, signature requests return arrays
        for func_name in requested_functions:
            if func_name in function_specs:
                spec = function_specs[func_name].copy()
                spec["web_hook_url"] = f"https://{base_url}/functions/{func_name}"
                function_declarations.append(spec)
                logger.info(f"[FUNCTIONS] Added: {func_name}")
        
        # Return array directly (not wrapped in object)
        return JSONResponse(content=function_declarations)
        
    except Exception as e:
        logger.error(f"[FUNCTIONS] Error: {e}", exc_info=True)
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )


# ============================================================================
# 3. FUNCTION HANDLERS (Tools + Routing)
# ============================================================================

async def handle_routing_check(caller_id: str, current_node: str, args: dict):
    """
    BarbGraph routing logic - check if node transition needed
    """
    phone = caller_id.replace('+1', '').replace('+', '')
    
    # Get current state
    state = await get_conversation_state(phone)
    if not state:
        return {"response": "Continue conversation"}
    
    # Check if current node is complete
    conversation_data = state.get('conversation_data', {})
    if is_node_complete(current_node, conversation_data):
        # Determine next node using BarbGraph routers
        next_node = await determine_next_node(current_node, state)
        
        if next_node and next_node != current_node:
            logger.info(f"[ROUTING] {current_node} → {next_node}")
            
            # Update database for tracking
            await update_conversation_state(phone, {'current_node': next_node})
            
            # SignalWire handles context switching automatically via valid_contexts
            # All contexts are already defined in the initial SWML, so the AI will
            # transition naturally when valid_contexts allows it
            logger.info(f"[ROUTING] Database updated to {next_node}. SignalWire will handle context switch.")
            return {
                "response": f"Ready to transition to {next_node}. The AI will switch contexts automatically based on valid_contexts."
            }
    
    return {"response": "Continue current node"}


@app.post("/functions/{function_name}")
async def handle_function_call(function_name: str, request: Request):
    """
    Handle all SWAIG function calls
    Routes to appropriate handler based on function name
    """
    try:
        body = await request.json()
        args = body['argument']['parsed'][0] if body['argument']['parsed'] else {}
        caller_id = body.get('caller_id_num', 'unknown')
        
        logger.info(f"[FUNCTION] {function_name} called by {caller_id}")
        logger.info(f"[FUNCTION] Args: {args}")
        
        # Import tool handlers
        from tools.flags import handle_flag_update
        from tools.calculate import handle_calculate
        from tools.knowledge import handle_knowledge_search
        from tools.booking import handle_booking, handle_check_broker_availability
        from tools.lead import handle_verify_caller_identity, handle_update_lead_info
        
        # Route to appropriate handler
        if function_name == "route_conversation":
            result = await handle_routing_check(caller_id, args.get('current_node', 'greet'), args)
        
        elif function_name.startswith("mark_"):
            result = await handle_flag_update(caller_id, function_name, args)
        
        elif function_name == "calculate_reverse_mortgage":
            result = await handle_calculate(caller_id, args)
        
        elif function_name == "search_knowledge":
            result = await handle_knowledge_search(caller_id, args)
        
        elif function_name == "book_appointment":
            result = await handle_booking(caller_id, args)
        
        elif function_name == "verify_caller_identity":
            result = await handle_verify_caller_identity(caller_id, args)
        
        elif function_name == "update_lead_info":
            result = await handle_update_lead_info(caller_id, args)
        
        elif function_name == "check_broker_availability":
            result = await handle_check_broker_availability(caller_id, args)
        
        else:
            result = {"response": f"Unknown function: {function_name}"}
        
        logger.info(f"[FUNCTION] {function_name} completed")
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.error(f"[FUNCTION] Error in {function_name}: {e}", exc_info=True)
        return JSONResponse(
            content={"response": f"Error: {str(e)}"},
            status_code=500
        )


# ============================================================================
# 4. DEBUG WEBHOOK (Real-time call monitoring for testing)
# ============================================================================

@app.post("/webhooks/debug")
async def debug_webhook(request: Request):
    """
    SignalWire sends real-time debug data for every AI interaction
    Per ai.params docs: debug_webhook_url receives interaction data in real-time
    
    Level 2 (verbose) includes:
    - Every AI turn (what AI said)
    - Every user utterance (what user said)
    - Function calls and responses
    - Latency information
    - Token usage
    """
    try:
        body = await request.json()
        
        # Log the debug data (you can also save to database, send to monitoring service, etc.)
        logger.info(f"[DEBUG] 🔍 Real-time interaction:")
        logger.info(f"[DEBUG] Data: {body}")
        
        # Extract useful info for quick debugging
        interaction_type = body.get('type', 'unknown')
        content = body.get('content', '')
        role = body.get('role', '')
        function_name = body.get('function', '')
        
        if function_name:
            logger.info(f"[DEBUG] 🔧 Function called: {function_name}")
            logger.info(f"[DEBUG] Args: {body.get('argument', {})}")
        
        if role == 'user':
            logger.info(f"[DEBUG] 👤 User said: {content}")
        elif role == 'assistant':
            logger.info(f"[DEBUG] 🤖 AI said: {content}")
        
        # Log latency if available
        if 'latency' in body:
            logger.info(f"[DEBUG] ⏱️ Latency: {body.get('latency')}ms")
        
        # Log tokens if available
        if 'tokens' in body:
            logger.info(f"[DEBUG] 🎫 Tokens: {body.get('tokens')}")
        
        # Always return 200 (SignalWire doesn't care about response, just needs to know we received it)
        return JSONResponse(content={"received": True})
        
    except Exception as e:
        logger.error(f"[DEBUG] Error processing debug webhook: {e}", exc_info=True)
        # Still return 200 to avoid SignalWire retries
        return JSONResponse(content={"received": False, "error": str(e)})


# ============================================================================
# 5. POST-CONVERSATION WEBHOOK (Optional - for analytics/logging)
# ============================================================================

@app.post("/webhooks/post-conversation")
async def post_conversation_webhook(request: Request):
    """
    SignalWire sends conversation data after call ends
    Per ai.post_prompt_url docs, receives full conversation log, tokens, SWAIG logs, etc.
    
    Request includes:
    - action: "post_conversation"
    - call_log: Full conversation transcript
    - swaig_log: All function calls and responses
    - total_input_tokens, total_output_tokens
    - call_start_date, call_end_date, ai_start_date, ai_end_date
    - caller_id_number, call_id, conversation_id
    - post_prompt_data: AI's summary response
    """
    try:
        body = await request.json()
        action = body.get('action')
        
        if action != "post_conversation":
            logger.warning(f"[POST-CALL] Unexpected action: {action}")
            return JSONResponse(content={"response": "ok"})
        
        logger.info(f"[POST-CALL] Conversation ended - processing summary")
        
        # Extract key information per SignalWire docs
        conversation_id = body.get('conversation_id')
        call_id = body.get('call_id')
        caller_id_number = body.get('caller_id_number', body.get('caller_id_num'))
        call_log = body.get('call_log', [])  # Full transcript
        swaig_log = body.get('swaig_log', [])  # Function execution log
        total_input_tokens = body.get('total_input_tokens', 0)
        total_output_tokens = body.get('total_output_tokens', 0)
        post_prompt_data = body.get('post_prompt_data', {})
        
        # Calculate duration
        call_start = body.get('call_start_date', 0)
        call_end = body.get('call_end_date', 0)
        duration_seconds = (call_end - call_start) / 1_000_000 if call_end and call_start else 0
        
        logger.info(f"[POST-CALL] Call {call_id}: {len(call_log)} messages, {len(swaig_log)} function calls, {total_input_tokens + total_output_tokens} tokens, {duration_seconds:.1f}s")
        
        # TODO: Save to database (interactions table)
        # TODO: Log metrics (duration, tokens, outcome)
        # TODO: Extract outcome from post_prompt_data.parsed or post_prompt_data.substituted
        
        # SignalWire expects {"response": "ok"} per docs
        return JSONResponse(content={"response": "ok"})
        
    except Exception as e:
        logger.error(f"[POST-CALL] Error: {e}", exc_info=True)
        # Always return 200 with {"response": "ok"} per SignalWire docs
        return JSONResponse(content={"response": "ok"})


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/healthz")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "agent": "barbara-swaig"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Barbara SWAIG Agent",
        "version": "1.0.0",
        "endpoints": {
            "agent": "/agent/barbara",
            "functions": "/functions",
            "debug": "/webhooks/debug",
            "post_call": "/webhooks/post-conversation",
            "health": "/healthz"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
