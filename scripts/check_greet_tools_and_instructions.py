#!/usr/bin/env python3
"""Check what tools are in greet context and what instructions say about when to call them"""

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

print('=== GREET CONTEXT CONFIGURATION ===\n')

# Check tools
tools = content.get('tools', [])
print(f'Tools in greet context: {tools}')

# Check instructions
instructions = content.get('instructions', '')
print(f'\n=== INSTRUCTIONS (first 2000 chars) ===')
print(instructions[:2000])

# Check step_criteria
step_criteria = content.get('step_criteria', '')
print(f'\n=== STEP_CRITERIA ===')
print(step_criteria)

# Check skip_user_turn
skip_user_turn = content.get('skip_user_turn', None)
print(f'\n=== SKIP_USER_TURN ===')
print(skip_user_turn)

# Check valid_contexts
valid_contexts = content.get('valid_contexts', [])
print(f'\n=== VALID_CONTEXTS ===')
print(valid_contexts)




