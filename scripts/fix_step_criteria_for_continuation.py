#!/usr/bin/env python3
"""Fix step_criteria for tool-using contexts to allow continuation instead of ending after tool completion"""

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

# Contexts that need step_criteria updates
context_updates = {
    'qualify': {
        'old_pattern': 'After collecting qualification information and determining eligibility:',
        'new_criteria': 'After collecting qualification information and determining eligibility: Continue in qualify context if they have follow-up questions. If qualified, route to quote context. If not qualified, route to exit context. If they ask questions during qualification, route to answer context. NEVER end the conversation after a single tool call - always allow for follow-up questions.'
    },
    'quote': {
        'old_pattern': 'After presenting the equity estimate and capturing their reaction:',
        'new_criteria': 'After presenting the equity estimate and capturing their reaction: Continue in quote context if they have questions about the quote. If they have questions, route to answer context. If they are ready to book, route to book context. If they raise objections, route to objections context. If not interested, route to exit context. NEVER end the conversation after presenting the quote - always allow for questions.'
    },
    'objections': {
        'old_pattern': 'After addressing the objection and confirming they feel better:',
        'new_criteria': 'After addressing the objection and confirming they feel better: Continue in objections context if they have more objections. If objection is resolved and they are ready to proceed, route to book context. If they have more questions, route to answer context. If still uncomfortable or unwilling to proceed, route to exit context. NEVER end the conversation after handling one objection - allow for multiple objections.'
    }
}

for context_name, update in context_updates.items():
    result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', context_name).eq('prompt_versions.is_active', True).execute()
    
    if not result.data:
        print(f'[SKIP] {context_name.upper()} context not found')
        continue
    
    version = result.data[0]['prompt_versions'][0]
    content = version['content']
    current_criteria = content.get('step_criteria', '')
    
    print(f'\n=== {context_name.upper()} CONTEXT ===')
    print(f'Current step_criteria (first 150 chars): {current_criteria[:150]}...')
    
    # Check if it needs updating
    if 'NEVER end' in current_criteria or 'Continue in' in current_criteria:
        print('[OK] step_criteria already allows continuation')
    else:
        print('[FIX] Updating step_criteria to allow continuation')
        content['step_criteria'] = update['new_criteria']
        supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()
        print('[SUCCESS] Updated step_criteria to allow continuation after tool completion')

print('\n=== SUMMARY ===')
print('Fixed step_criteria for tool-using contexts to allow continuation instead of ending after tool completion.')




