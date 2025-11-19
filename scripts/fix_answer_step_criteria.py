#!/usr/bin/env python3
"""Fix answer context step_criteria to be more explicit about post-tool continuation"""

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

result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', 'answer').eq('prompt_versions.is_active', True).execute()

if not result.data:
    print('ERROR: No answer context found')
    sys.exit(1)

version = result.data[0]['prompt_versions'][0]
content = version['content']

# Update step_criteria to be more explicit about immediate acknowledgment
new_step_criteria = """After search_knowledge tool completes: 
1. IMMEDIATELY provide the answer clearly and concisely (1-2 sentences) using the knowledge from the tool
2. NEVER leave silence after answering - always provide a follow-up question or transition
3. Then ask if they have any other questions or if they are ready to book
4. Route based on their response: If they have more questions, continue in answer context. If satisfied and ready, route to book context. If they raise objections, route to objections context. If not interested, route to exit context."""

content['step_criteria'] = new_step_criteria

supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()

print('SUCCESS: Updated answer context step_criteria to be more explicit about immediate acknowledgment after search_knowledge completes')







