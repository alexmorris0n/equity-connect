#!/usr/bin/env python3
"""Check verify context configuration"""

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

result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', 'verify').eq('prompt_versions.is_active', True).execute()

if not result.data:
    print('ERROR: No verify context found')
    sys.exit(1)

version = result.data[0]['prompt_versions'][0]
content = version['content']

print('=== VERIFY CONTEXT CONFIGURATION ===')
print(f'step_criteria: {content.get("step_criteria")}')
print(f'skip_user_turn: {content.get("skip_user_turn")}')
print(f'valid_contexts: {content.get("valid_contexts")}')
print(f'\nInstructions (full):')
print(content.get('instructions', ''))
print('\n=== TOOLS ===')
print(f'tools: {content.get("tools", [])}')

