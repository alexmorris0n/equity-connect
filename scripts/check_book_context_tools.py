#!/usr/bin/env python3
"""Check what tools are in book context"""

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

print('=== BOOK CONTEXT TOOLS ===\n')
tools = content.get('tools', [])
print(f'Tools: {tools}')

if 'verify_caller_identity' in tools:
    print('\n[ERROR] verify_caller_identity should NOT be in book context!')
    print('Book context should only have booking-related tools.')
else:
    print('\n[OK] verify_caller_identity is not in book context tools')



