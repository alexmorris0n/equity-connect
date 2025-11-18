#!/usr/bin/env python3
"""Fix greet context to handle appointment_set leads and fix skip_user_turn"""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Try to load dotenv, but don't fail if it's not available
try:
    from dotenv import load_dotenv
    try:
        load_dotenv()
    except (ValueError, Exception):
        pass  # Ignore dotenv errors
except ImportError:
    pass

from equity_connect.services.supabase import get_supabase_client

supabase = get_supabase_client()

result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', 'greet').eq('prompt_versions.is_active', True).execute()

if not result.data:
    print('ERROR: No greet context found')
    sys.exit(1)

version = result.data[0]['prompt_versions'][0]
content = version['content']

# Fix 1: Set skip_user_turn to False so Barbara waits for user response
content['skip_user_turn'] = False

# Fix 2: Add appointment_set handling to step_criteria
old_step_criteria = content.get('step_criteria', '')
new_step_criteria = """After greeting caller and they respond: 
- If lead status is appointment_set: Acknowledge their appointment and ask if they need to confirm, reschedule, cancel, or have questions. Route to appropriate context (book for reschedule, answer for questions, exit for cancel).
- If they ask a question, route to answer context.
- If they want to verify identity, route to verify context.
- If they express interest, route to qualify context.
- If they have objections, route to objections context.
- If they are not interested or not qualified, route to exit context."""

content['step_criteria'] = new_step_criteria

# Fix 3: Add appointment_set handling section to instructions
instructions = content.get('instructions', '')

# Check if appointment_set section already exists
if 'appointment_set' not in instructions.lower() and 'appointment' not in instructions.lower():
    # Add appointment_set handling section after the greeting section
    appointment_section = """

---

## Handling Appointment_Set Leads (Booked Callbacks)

**CRITICAL: If the lead status is "appointment_set" (they have a booked appointment):**

1. **Acknowledge their appointment immediately:**
   - "Hi $first_name! So good to hear from you again! I see you have an appointment coming up with $broker_name. Is everything still good for that, or did you need to reschedule?"

2. **Listen to their response:**
   - **If they confirm:** "Perfect! Looking forward to it. Was there anything else I could help with today?"
   - **If they need to reschedule:** Route to BOOK context to check availability and reschedule
   - **If they want to cancel:** Acknowledge and offer to reschedule before ending
   - **If they have questions:** Route to ANSWER context to answer their questions
   - **If they just want to confirm details:** Answer their questions, then confirm appointment

3. **NEVER hang up without acknowledging their appointment status first**

**This is a critical scenario - always acknowledge booked appointments before proceeding.**
"""
    
    # Insert after the greeting section (after "After Your Opening")
    if "## After Your Opening" in instructions:
        # Find the position after "After Your Opening" section
        parts = instructions.split("## After Your Opening")
        if len(parts) > 1:
            # Insert the appointment section before "After Your Opening"
            instructions = parts[0] + appointment_section + "\n## After Your Opening" + parts[1]
        else:
            # Append at the end if we can't find the section
            instructions = instructions + appointment_section
    else:
        # Append at the end if we can't find the section
        instructions = instructions + appointment_section
    
    content['instructions'] = instructions

supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()

print('SUCCESS: Fixed greet context:')
print('  1. Set skip_user_turn to False (Barbara will wait for user response)')
print('  2. Added appointment_set handling to step_criteria')
print('  3. Added appointment_set handling section to instructions')




