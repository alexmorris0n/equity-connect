#!/usr/bin/env python3
"""Update EXIT context with explicit question detection examples"""

import os
import sys
import json

# Try to load dotenv, but don't fail if it's not available
try:
    from dotenv import load_dotenv
    try:
        load_dotenv()
    except (ValueError, Exception):
        pass
except ImportError:
    pass

# Try to get from environment, but also check common locations
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# If not in env, try reading from .env file manually
if not url or not key:
    try:
        with open('.env', 'r') as f:
            for line in f:
                if line.startswith('SUPABASE_URL='):
                    url = line.split('=', 1)[1].strip().strip('"').strip("'")
                elif line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
                    key = line.split('=', 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass

if not url or not key:
    print('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    sys.exit(1)

from supabase import create_client, Client
supabase: Client = create_client(url, key)

# Get EXIT context
exit_result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', 'exit').eq('prompt_versions.is_active', True).execute()

if not exit_result.data:
    print('ERROR: EXIT context not found')
    sys.exit(1)

version = exit_result.data[0]['prompt_versions'][0]
content = version['content']

# Update instructions with initial greeting and explicit question examples
new_instructions = """# Exit Context

## Pre-Loaded Data (Already Available)
- Name: $first_name $last_name
- Broker: $broker_name (phone: $broker_phone)

**CRITICAL: All lead data is already pre-loaded at call start.**

---

## Initial Greeting (When Call Starts Here)

**If this is the start of the call and appointment is booked:**
- Greet warmly: "Hi $first_name! This is Barbara. I see you have an appointment scheduled. How can I help you today?"
- Then LISTEN for their response

**If this is mid-call:**
- Continue from where you left off

---

## Immediate Actions (After Initial Greeting)

**CRITICAL: Question Detection - If caller asks ANY question (examples: "what are the fees?", "how much does it cost?", "tell me about...", "can you explain...", "I want to know about...", or any statement seeking information):**
- **IMMEDIATELY call route_to_context(target_context="answer", reason="user_asked_question")**
- Do NOT try to answer in this context - route immediately
- The route_to_context tool will switch you to the ANSWER context where you can use search_knowledge

**If wrong person but right person available:**
- Call route_to_context(target_context="greet")

**If wants to reschedule:**
- Direct to broker at $broker_phone, flag cancellation_redirect

**Otherwise:**
- Thank caller, confirm next steps, end professionally
- Use update_lead_info to set appropriate flags

---

## After Tool Completion
- Provide follow-up response - never leave silence
- If question asked: Route to answer context immediately
- If scenario complete: Warm close

**Valid next contexts:** answer, greet"""

# Update step_criteria with explicit question detection
new_step_criteria = """CRITICAL: After ANY user input, check if they asked a question (words like "what", "how", "tell me", "explain", "fees", "cost", "about", or any information-seeking statement). If YES: IMMEDIATELY call route_to_context(target_context="answer", reason="user_asked_question") - do NOT wait, do NOT try to answer here. If NO question and route_to_context was called: Context has switched - do NOT continue in this step. If update_lead_info was called: Provide appropriate follow-up. If no tool called but scenario complete: Provide warm close. NEVER leave silence - always respond or route."""

content['instructions'] = new_instructions
content['step_criteria'] = new_step_criteria

# Update in database
supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()
print('✅ Updated EXIT context with explicit question detection examples')
print('✅ Updated step_criteria with explicit question detection keywords')

