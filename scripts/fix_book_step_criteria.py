#!/usr/bin/env python3
"""Fix book context step_criteria to be more explicit about post-tool continuation"""

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
    print('ERROR: No book context found')
    sys.exit(1)

version = result.data[0]['prompt_versions'][0]
content = version['content']

# Update step_criteria to be more explicit about immediate acknowledgment
new_step_criteria = """After booking tools (check_broker_availability, book_appointment) complete: 
1. IMMEDIATELY acknowledge the result (e.g., "Perfect! I've got you scheduled for..." or "I see we have availability on...")
2. NEVER leave silence after tool completion - always provide a follow-up response
3. Route based on result: If appointment is successfully booked, route to exit context. If they have questions during booking, route to answer context. If they raise objections, route to objections context. If booking fails or they are not ready, route to exit context."""

content['step_criteria'] = new_step_criteria

supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()

print('SUCCESS: Updated book context step_criteria to be more explicit about immediate acknowledgment after booking tools complete')




