#!/usr/bin/env python3
"""Fix verify context step_criteria to include acknowledgment after tool completion"""

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

# New step_criteria that explicitly tells Barbara to acknowledge after tool completion
new_step_criteria = """After verify_caller_identity tool completes: 
1. IMMEDIATELY acknowledge the verification (e.g., "Perfect! I have your information here, [Name]." or "Great! I've got you in our system, [Name].")
2. NEVER leave silence after tool completion - always provide a follow-up response
3. Then route based on verification result: If verified and qualified, route to qualify context. If verified but not qualified, route to qualify context. If wrong person but right person available, route to greet context. If cannot verify or not interested, route to exit context."""

content['step_criteria'] = new_step_criteria

supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()

print('SUCCESS: Updated verify context step_criteria to include acknowledgment after tool completion')

