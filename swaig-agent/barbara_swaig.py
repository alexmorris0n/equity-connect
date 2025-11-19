"""
Barbara Agent - SignalWire SWAIG Implementation (Python)
Based on official SignalWire AI Agent Starter Pack architecture
"""

from fastapi import FastAPI, Request
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import yaml

app = FastAPI()

# ============================================================================
# SWML Agent Definition (like src/agents.js)
# ============================================================================

@app.post("/agent/barbara")
async def barbara_agent(request: Request):
    """
    Generate SWML for Barbara agent
    This is what SignalWire calls to get the agent configuration
    
    NO JAVASCRIPT NEEDED! Just return a Python dict as JSON/YAML
    """
    
    # Get caller info from request if available
    try:
        body = await request.json()
        caller_id = body.get("caller_id_number", "unknown")
    except:
        caller_id = "unknown"
    
    # Load prompt from database (your existing logic)
    # prompt = await load_prompt_from_db('greet', 'reverse_mortgage', caller_id)
    
    # Just a Python dict - FastAPI converts to JSON automatically!
    swml = {
        "version": "1.0.0",
        "sections": {
            "main": [
                {"answer": {}},
                {
                    "ai": {
                        "prompt": {
                            "text": """
You are Barbara, a friendly AI assistant specializing in reverse mortgages.

# Your Role
Help callers understand reverse mortgages and book consultations with licensed brokers.

# Available Tools
- calculate_reverse_mortgage: Get accurate estimates (no hallucination)
- search_knowledge: Answer questions about reverse mortgages
- book_appointment: Schedule consultation with broker
- verify_caller: Verify caller identity

# Conversation Flow
1. Greet warmly
2. Verify identity
3. Assess qualification
4. Provide estimate
5. Answer questions
6. Handle objections
7. Book appointment
8. Polite goodbye
"""
                        },
                        "params": {
                            "ai_model": "gpt-4o-mini",
                            "openai_asr_engine": "deepgram:nova-3",
                            "end_of_speech_timeout": 700,
                            "attention_timeout": 5000
                        },
                        "languages": [
                            {
                                "name": "English",
                                "code": "en-US",
                                "voice": "elevenlabs.tiffany",
                                "engine": "elevenlabs"
                            }
                        ],
                        "SWAIG": {
                            "includes": [
                                {
                                    "functions": [
                                        "calculate_reverse_mortgage",
                                        "search_knowledge",
                                        "book_appointment",
                                        "verify_caller",
                                        "route_conversation"
                                    ],
                                    "url": f"https://{os.getenv('PUBLIC_URL', 'localhost:8080')}/functions"
                                }
                            ]
                        }
                    }
                }
            ]
        }
    }
    
    # FastAPI automatically converts dict to JSON
    # SignalWire accepts both JSON and YAML
    return swml


# ============================================================================
# Function Declarations (like getFunctionDeclarations in functions.js)
# ============================================================================

@app.post("/functions")
async def get_function_declarations(request: Request):
    """
    SignalWire asks: "What functions do you have?"
    You respond with function definitions
    """
    
    body = await request.json()
    requested_functions = body.get("functions", [])
    
    print(f"[SWAIG] Function declarations requested: {requested_functions}")
    
    function_declarations = []
    
    for function_name in requested_functions:
        if function_name == "calculate_reverse_mortgage":
            function_declarations.append({
                "function": "calculate_reverse_mortgage",
                "purpose": "Calculate available reverse mortgage funds (no hallucination)",
                "argument": {
                    "type": "object",
                    "properties": {
                        "property_value": {
                            "type": "integer",
                            "description": "Estimated property value in dollars"
                        },
                        "age": {
                            "type": "integer",
                            "description": "Age of youngest borrower"
                        },
                        "equity": {
                            "type": "integer",
                            "description": "Current equity in property"
                        }
                    },
                    "required": ["property_value", "age"]
                },
                "web_hook_url": f"https://{os.getenv('PUBLIC_URL')}/functions/calculate_reverse_mortgage"
            })
        
        elif function_name == "search_knowledge":
            function_declarations.append({
                "function": "search_knowledge",
                "purpose": "Search knowledge base for reverse mortgage questions",
                "argument": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The question to search for"
                        }
                    },
                    "required": ["query"]
                },
                "web_hook_url": f"https://{os.getenv('PUBLIC_URL')}/functions/search_knowledge"
            })
        
        elif function_name == "book_appointment":
            function_declarations.append({
                "function": "book_appointment",
                "purpose": "Schedule consultation with broker",
                "argument": {
                    "type": "object",
                    "properties": {
                        "preferred_time": {
                            "type": "string",
                            "description": "Preferred appointment time"
                        },
                        "notes": {
                            "type": "string",
                            "description": "Additional notes"
                        }
                    },
                    "required": ["preferred_time"]
                },
                "web_hook_url": f"https://{os.getenv('PUBLIC_URL')}/functions/book_appointment"
            })
        
        elif function_name == "verify_caller":
            function_declarations.append({
                "function": "verify_caller",
                "purpose": "Verify caller identity and property information",
                "argument": {
                    "type": "object",
                    "properties": {
                        "confirmation": {
                            "type": "boolean",
                            "description": "Did caller confirm their information?"
                        }
                    }
                },
                "web_hook_url": f"https://{os.getenv('PUBLIC_URL')}/functions/verify_caller"
            })
        
        elif function_name == "route_conversation":
            function_declarations.append({
                "function": "route_conversation",
                "purpose": "Determine next conversation step",
                "argument": {
                    "type": "object",
                    "properties": {
                        "current_node": {
                            "type": "string",
                            "description": "Current conversation node"
                        },
                        "user_intent": {
                            "type": "string",
                            "description": "User's intent or response"
                        }
                    }
                },
                "web_hook_url": f"https://{os.getenv('PUBLIC_URL')}/functions/route_conversation"
            })
    
    return {"functions": function_declarations}


# ============================================================================
# Function Implementations (like getWeather in functions.js)
# ============================================================================

@app.post("/functions/calculate_reverse_mortgage")
async def calculate_reverse_mortgage(request: Request):
    """
    Calculate available reverse mortgage funds
    This is your EXISTING LiveKit tool logic
    """
    
    body = await request.json()
    args = body['argument']['parsed'][0]
    
    print(f"[SWAIG] calculate_reverse_mortgage called: {args}")
    
    property_value = args.get('property_value')
    age = args.get('age')
    equity = args.get('equity', property_value)
    
    # Your existing calculation logic
    # result = await reverse_mortgage_calc(property_value, age, equity)
    
    # Mock calculation
    lump_sum = int(property_value * 0.5)
    monthly = int(lump_sum / 240)
    
    return {
        "response": f"Based on a property value of ${property_value:,} and age {age}, you could access approximately ${lump_sum:,} as a lump sum, or about ${monthly:,} per month. This is an estimate only.",
        "action": [
            {
                "set_meta_data": {
                    "quote_presented": True,
                    "estimated_lump_sum": lump_sum
                }
            }
        ]
    }


@app.post("/functions/search_knowledge")
async def search_knowledge(request: Request):
    """
    Search knowledge base
    Your EXISTING LiveKit knowledge tool
    """
    
    body = await request.json()
    args = body['argument']['parsed'][0]
    
    print(f"[SWAIG] search_knowledge called: {args}")
    
    query = args.get('query')
    
    # Your existing knowledge search logic
    # results = await knowledge_service.search(query)
    
    return {
        "response": f"Here's what I found about '{query}': [Your knowledge base result]"
    }


@app.post("/functions/book_appointment")
async def book_appointment(request: Request):
    """
    Book appointment
    Your EXISTING LiveKit booking tool
    """
    
    body = await request.json()
    args = body['argument']['parsed'][0]
    caller_id = body.get('caller_id_num', 'unknown')
    
    print(f"[SWAIG] book_appointment called: {args}")
    
    preferred_time = args.get('preferred_time')
    
    # Your existing booking logic
    # appointment = await create_appointment(caller_id, preferred_time)
    
    return {
        "response": f"Great! I've scheduled your consultation for {preferred_time}. You'll receive a confirmation shortly.",
        "action": [
            {
                "set_meta_data": {
                    "appointment_booked": True,
                    "appointment_time": preferred_time
                }
            }
        ]
    }


@app.post("/functions/verify_caller")
async def verify_caller(request: Request):
    """
    Verify caller identity
    Your EXISTING LiveKit verification logic
    """
    
    body = await request.json()
    args = body['argument']['parsed'][0]
    caller_id = body.get('caller_id_num', 'unknown')
    
    print(f"[SWAIG] verify_caller called: {args}")
    
    # Your existing verification logic
    # verified = await verify_caller_info(caller_id, args)
    
    return {
        "response": "Thank you for confirming your information!",
        "action": [
            {
                "set_meta_data": {
                    "verified": True
                }
            }
        ]
    }


@app.post("/functions/route_conversation")
async def route_conversation(request: Request):
    """
    Route to next conversation node
    Your EXISTING LiveKit routing logic
    """
    
    body = await request.json()
    args = body['argument']['parsed'][0]
    caller_id = body.get('caller_id_num', 'unknown')
    
    print(f"[SWAIG] route_conversation called: {args}")
    
    # Your existing routing logic
    # state = await get_conversation_state(caller_id)
    # next_node = determine_next_node(state, args)
    
    return {
        "response": "Continuing conversation...",
        "action": [
            {
                "set_meta_data": {
                    "current_node": "qualify"  # example
                }
            }
        ]
    }


# ============================================================================
# Health Check
# ============================================================================

@app.get("/healthz")
async def health_check():
    return {"status": "healthy", "agent": "barbara-swaig"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)

