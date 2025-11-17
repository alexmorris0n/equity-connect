#!/usr/bin/env python3
"""Fix EXIT context to handle all scenarios and prevent hangups"""

import os
import sys
import json

# Try to load dotenv, but don't fail if it's not available
try:
    from dotenv import load_dotenv
    try:
        load_dotenv()
    except Exception:
        pass  # Ignore errors loading .env
except ImportError:
    pass

from supabase import create_client, Client

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print('[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
    print('   Make sure .env file exists with these variables')
    sys.exit(1)

supabase: Client = create_client(url, key)

# Get exit context
result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', 'exit').eq('prompt_versions.is_active', True).execute()

if not result.data:
    print('[ERROR] No exit context found')
    sys.exit(1)

version = result.data[0]['prompt_versions'][0]
content = version['content']
instructions = content['instructions']

# Update step_criteria to handle ALL scenarios
new_step_criteria = """CRITICAL: After ANY action (tool call, user response, or scenario handling):
1) If user asked a question: IMMEDIATELY call route_to_context(target_context="answer", reason="user_asked_question") - the tool will switch contexts automatically.
2) If route_to_context was called: The context has switched programmatically - do NOT continue in this step, let the new context handle it. Do NOT provide additional response.
3) If update_lead_info was called: Provide appropriate follow-up based on scenario (thank them, offer help, graceful goodbye).
4) If no tool was called but scenario is complete: Provide warm close and graceful goodbye.
5) NEVER leave silence - always provide a response or route to another context."""

# Add explicit post-route_to_context section to instructions
post_route_section = """## CRITICAL: After route_to_context Tool Completes
**When route_to_context(target_context="answer") completes:**
- The tool has programmatically switched you to the ANSWER context
- **DO NOT** provide any additional response in this EXIT context
- **DO NOT** continue talking - the new context will handle everything
- The context switch is automatic - you're done in this step

**When route_to_context(target_context="greet") completes:**
- The tool has programmatically switched you to the GREET context
- **DO NOT** provide any additional response in this EXIT context
- The new context will handle the greeting and verification

**Pattern:**
1. User asks question → Call route_to_context(target_context="answer")
2. Tool completes → Context switches automatically
3. **STOP** - Do not continue in EXIT context, let ANSWER context take over"""

# Add call disconnection prevention section
disconnection_prevention_section = """## CRITICAL: Call Disconnection Prevention
**If you detect the call is about to disconnect or hang up (silence, no response, connection issues):**

**DO NOT just let it hang - take immediate action:**

1. **If user asked a question and call is disconnecting:**
   - IMMEDIATELY call route_to_context(target_context="answer", reason="user_asked_question")
   - The context switch will keep the call alive and route to answer handling

2. **If tool just completed and call is disconnecting:**
   - Provide immediate follow-up response (don't wait)
   - If question was asked: Route to answer context immediately
   - If scenario complete: Provide warm close and ask if anything else

3. **If silence detected after your last statement:**
   - Ask: "Is there anything else I can help you with?"
   - Offer: "Feel free to call back if you have questions"
   - Provide broker contact: "$broker_name at $broker_phone"

4. **If connection seems unstable:**
   - Say: "I want to make sure we got everything covered. Do you have any questions?"
   - Route to answer context if questions exist
   - Provide callback number if needed

**NEVER let the call hang without:**
- Routing to appropriate context (answer, greet, etc.)
- Providing a clear next step
- Offering callback/contact information
- Asking if anything else is needed"""

# Add both sections to instructions
sections_added = []

# Add post-route section
if "## CRITICAL: After route_to_context Tool Completes" not in instructions:
    # Insert before "## After Tool Execution / Continuation"
    continuation_section = instructions.find("## After Tool Execution / Continuation")
    if continuation_section > 0:
        instructions = instructions[:continuation_section] + "\n\n" + post_route_section + "\n\n---\n\n---\n\n" + instructions[continuation_section:]
        sections_added.append("After route_to_context Tool Completes")
    else:
        # Append before last section
        instructions = instructions + "\n\n---\n\n" + post_route_section
        sections_added.append("After route_to_context Tool Completes")
else:
    print('[WARN] "After route_to_context Tool Completes" section already exists')

# Add disconnection prevention section (always at the end, before Reschedule section)
if "## CRITICAL: Call Disconnection Prevention" not in instructions:
    # Insert before "## Reschedule Intent Detection" or at the end
    reschedule_section = instructions.find("## Reschedule Intent Detection")
    if reschedule_section > 0:
        instructions = instructions[:reschedule_section] + "\n\n---\n\n" + disconnection_prevention_section + "\n\n---\n\n---\n\n" + instructions[reschedule_section:]
        sections_added.append("Call Disconnection Prevention")
    else:
        # Append at end
        instructions = instructions + "\n\n---\n\n" + disconnection_prevention_section
        sections_added.append("Call Disconnection Prevention")
else:
    print('[WARN] "Call Disconnection Prevention" section already exists')

if sections_added:
    print(f'[OK] Added sections: {", ".join(sections_added)}')

# Update content
content['instructions'] = instructions
content['step_criteria'] = new_step_criteria

# Update in database
supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()
print('[OK] Updated exit context step_criteria and instructions in database')
print('\n[INFO] Updated step_criteria:')
print(new_step_criteria[:200] + '...')

