#!/usr/bin/env python3
"""Check all steps in greet context for skip_user_turn settings"""

import os
import sys
import json

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

print('=== GREET CONTEXT STEPS ===\n')

# Check steps
steps = content.get('steps', [])
print(f'Number of steps: {len(steps)}\n')

for i, step in enumerate(steps):
    print(f'--- Step {i+1}: {step.get("name", "unnamed")} ---')
    print(f'  skip_user_turn: {step.get("skip_user_turn", "NOT SET")}')
    print(f'  step_criteria: {step.get("step_criteria", "NOT SET")[:100]}...')
    print(f'  functions: {step.get("functions", [])}')
    print()

# Also check top-level skip_user_turn
print(f'=== TOP-LEVEL skip_user_turn ===')
print(f'{content.get("skip_user_turn", "NOT SET")}')

