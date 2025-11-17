#!/usr/bin/env python3
"""Update GREET context for smart POM routing based on global_data flags"""

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
    print('ERROR: greet context not found')
    sys.exit(1)

version = result.data[0]['prompt_versions'][0]
content = version['content']

print('=== UPDATING GREET CONTEXT FOR POM ROUTING ===\n')

# 1. Update valid_contexts
new_valid_contexts = ["greet", "verify", "qualify", "quote", "answer", "book", "exit"]
content['valid_contexts'] = new_valid_contexts
print(f'[FIX] Updated valid_contexts to: {new_valid_contexts}')

# 2. Update step_criteria
new_step_criteria = "Greeting is complete when Barbara has acknowledged the caller AND determined next appropriate context based on their status."
content['step_criteria'] = new_step_criteria
print(f'[FIX] Updated step_criteria to: {new_step_criteria[:80]}...')

# 3. Add routing logic to instructions
instructions = content.get('instructions', '')

# Check if routing logic already exists
if "## Routing Logic (Check Global Data)" in instructions:
    print('[INFO] Routing logic already exists - will replace it')
    # Find and replace the existing section
    import re
    # Remove old routing logic section if it exists
    pattern = r'## Routing Logic.*?## Critical Rules'
    if re.search(pattern, instructions, re.DOTALL):
        instructions = re.sub(pattern, '', instructions, flags=re.DOTALL)

# Add new routing logic section before "Critical Rules" or at the end
routing_section = """
## Routing Logic (Check Global Data)

After greeting, check these flags in order:

1. **If `{global_data.appointment_booked}` is true:**
   - Say: "Hi {first_name}! You're all set with your appointment. Is there anything else I can help with?"
   - Route to EXIT

2. **If `{global_data.ready_to_book}` is true:**
   - Say: "Hi {first_name}! Great to hear from you again. Let's get that appointment scheduled with {broker_name}."
   - Route to BOOK

3. **If `{global_data.quote_presented}` is true:**
   - Say: "Hi {first_name}! Good to hear from you. Do you have any questions about the numbers we discussed?"
   - Route to ANSWER

4. **If `{global_data.qualified}` is true:**
   - Say: "Hi {first_name}! Thanks for calling back. What questions can I answer for you?"
   - Route to ANSWER

5. **If `{global_data.verified}` is true:**
   - Say: "Hi {first_name}! Let me ask a few quick questions to see if this is a good fit for you."
   - Route to QUALIFY

6. **Otherwise (new caller):**
   - Deliver full greeting
   - Route to VERIFY

## Critical Rules

- ALWAYS greet by name first
- Keep returning caller greetings brief (one sentence)
- Let the context determine next steps, don't re-explain everything
"""

# Insert routing section before "Critical Rules" if it exists, otherwise append
if "## Critical Rules" in instructions:
    instructions = instructions.replace("## Critical Rules", routing_section + "\n## Critical Rules")
else:
    instructions += routing_section

content['instructions'] = instructions
print('[FIX] Added routing logic instructions based on global_data flags')

# Update in database
supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()
print('\n[SUCCESS] Updated GREET context for smart POM routing')

