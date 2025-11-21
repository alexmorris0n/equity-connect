#!/usr/bin/env python3
"""Check book context configuration for skip_user_turn and instructions"""

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

result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', 'book').eq('prompt_versions.is_active', True).execute()

if not result.data:
    print('ERROR: book context not found')
    sys.exit(1)

version = result.data[0]['prompt_versions'][0]
content = version['content']

print('=== BOOK CONTEXT CONFIGURATION ===\n')

# Check steps
steps = content.get('steps', [])
print(f'Number of steps: {len(steps)}\n')

for i, step in enumerate(steps):
    print(f'--- Step {i+1}: {step.get("name", "unnamed")} ---')
    print(f'  skip_user_turn: {step.get("skip_user_turn", "NOT SET")}')
    print(f'  step_criteria: {step.get("step_criteria", "NOT SET")[:150]}...')
    print(f'  functions: {step.get("functions", [])}')
    print()

# Check top-level skip_user_turn
print(f'=== TOP-LEVEL skip_user_turn ===')
print(f'{content.get("skip_user_turn", "NOT SET")}')

# Check instructions for tool calls
instructions = content.get('instructions', '')
print(f'\n=== INSTRUCTIONS (checking for immediate tool calls) ===')
if 'verify_caller_identity' in instructions.lower():
    print('WARNING: Instructions mention verify_caller_identity')
    # Find the context
    idx = instructions.lower().find('verify_caller_identity')
    start = max(0, idx - 200)
    end = min(len(instructions), idx + 200)
    print(f'Context: ...{instructions[start:end]}...')
else:
    print('OK: Instructions do not mention verify_caller_identity')






