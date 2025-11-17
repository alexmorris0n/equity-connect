#!/usr/bin/env python3
"""Add post-route_to_context and disconnection prevention sections to EXIT context"""

import os
import sys
import json

# Try to load dotenv
try:
    from dotenv import load_dotenv
    try:
        load_dotenv()
    except Exception:
        pass
except ImportError:
    pass

# Try to import supabase
try:
    from supabase import create_client, Client
except ImportError:
    print('[ERROR] supabase package not installed. Run: pip install supabase')
    sys.exit(1)

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print('[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    print('   Set these environment variables or create a .env file')
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

# New sections to add
post_route_section = """## CRITICAL: After route_to_context Tool Completes
**When route_to_context(target_context="answer") completes:**
- The tool has programmatically switched you to the ANSWER context
- **DO NOT** provide any additional response in this EXIT context
- **DO NOT** continue talking - the new context will handle everything
- The context switch is automatic - you are done in this step

**When route_to_context(target_context="greet") completes:**
- The tool has programmatically switched you to the GREET context
- **DO NOT** provide any additional response in this EXIT context
- The new context will handle the greeting and verification

**Pattern:**
1. User asks question → Call route_to_context(target_context="answer")
2. Tool completes → Context switches automatically
3. **STOP** - Do not continue in EXIT context, let ANSWER context take over"""

disconnection_prevention_section = """## CRITICAL: Call Disconnection Prevention
**If you detect the call is about to disconnect or hang up (silence, no response, connection issues):**

**DO NOT just let it hang - take immediate action:**

1. **If user asked a question and call is disconnecting:**
   - IMMEDIATELY call route_to_context(target_context="answer", reason="user_asked_question")
   - The context switch will keep the call alive and route to answer handling

2. **If tool just completed and call is disconnecting:**
   - Provide immediate follow-up response (do not wait)
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

# Add sections if they don't exist
updated = False

if "## CRITICAL: After route_to_context Tool Completes" not in instructions:
    # Insert before "## After Tool Execution / Continuation"
    continuation_pos = instructions.find("## After Tool Execution / Continuation")
    if continuation_pos > 0:
        instructions = instructions[:continuation_pos] + "\n\n" + post_route_section + "\n\n---\n\n---\n\n" + instructions[continuation_pos:]
        updated = True
        print('[OK] Added "After route_to_context Tool Completes" section')
    else:
        # Append before Reschedule section
        reschedule_pos = instructions.find("## Reschedule Intent Detection")
        if reschedule_pos > 0:
            instructions = instructions[:reschedule_pos] + "\n\n---\n\n" + post_route_section + "\n\n---\n\n" + instructions[reschedule_pos:]
            updated = True
            print('[OK] Added "After route_to_context Tool Completes" section')
        else:
            instructions = instructions + "\n\n---\n\n" + post_route_section
            updated = True
            print('[OK] Added "After route_to_context Tool Completes" section at end')
else:
    print('[WARN] "After route_to_context Tool Completes" section already exists')

if "## CRITICAL: Call Disconnection Prevention" not in instructions:
    # Insert before "## Reschedule Intent Detection" or at the end
    reschedule_pos = instructions.find("## Reschedule Intent Detection")
    if reschedule_pos > 0:
        instructions = instructions[:reschedule_pos] + "\n\n---\n\n" + disconnection_prevention_section + "\n\n---\n\n---\n\n" + instructions[reschedule_pos:]
        updated = True
        print('[OK] Added "Call Disconnection Prevention" section')
    else:
        instructions = instructions + "\n\n---\n\n" + disconnection_prevention_section
        updated = True
        print('[OK] Added "Call Disconnection Prevention" section at end')
else:
    print('[WARN] "Call Disconnection Prevention" section already exists')

if updated:
    # Update content
    content['instructions'] = instructions
    
    # Update in database
    supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()
    print('[OK] Updated exit context instructions in database')
else:
    print('[INFO] No updates needed - both sections already exist')

