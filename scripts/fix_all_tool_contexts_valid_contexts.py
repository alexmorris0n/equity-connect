#!/usr/bin/env python3
"""Fix valid_contexts for all tool-using contexts to allow continuation after tool completion"""

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

# Contexts that use tools and need to allow continuation
tool_contexts = {
    'answer': {
        'tools': ['search_knowledge'],
        'required_valid_contexts': ['answer', 'objections', 'book', 'exit'],  # Must include itself for multi-turn Q&A
        'reason': 'Must allow staying in answer context for follow-up questions after search_knowledge completes'
    },
    'book': {
        'tools': ['check_broker_availability', 'book_appointment'],
        'required_valid_contexts': ['book', 'answer', 'exit'],  # Must include itself for back-and-forth booking
        'reason': 'Must allow staying in book context for time negotiations after booking tools complete'
    },
    'verify': {
        'tools': ['verify_caller_identity'],
        'required_valid_contexts': ['qualify', 'answer', 'exit', 'greet'],  # Already has these, but ensure answer is included
        'reason': 'Must allow routing to answer if questions come up during verification'
    },
    'qualify': {
        'tools': ['update_lead_info', 'mark_qualification_result'],
        'required_valid_contexts': ['qualify', 'quote', 'answer', 'exit'],  # Must include itself for multi-turn qualification
        'reason': 'Must allow staying in qualify context for follow-up questions during qualification'
    },
    'quote': {
        'tools': ['mark_quote_presented'],
        'required_valid_contexts': ['quote', 'answer', 'book', 'exit'],  # Must include itself for questions about quote
        'reason': 'Must allow staying in quote context for questions about the quote'
    },
    'objections': {
        'tools': ['mark_has_objection', 'mark_objection_handled'],
        'required_valid_contexts': ['objections', 'answer', 'book', 'exit'],  # Must include itself for multiple objections
        'reason': 'Must allow staying in objections context for multiple objections'
    }
}

for context_name, config in tool_contexts.items():
    result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', context_name).eq('prompt_versions.is_active', True).execute()
    
    if not result.data:
        print(f'[SKIP] {context_name.upper()} context not found')
        continue
    
    version = result.data[0]['prompt_versions'][0]
    content = version['content']
    current_valid_contexts = content.get('valid_contexts', [])
    
    print(f'\n=== {context_name.upper()} CONTEXT ===')
    print(f'Current valid_contexts: {current_valid_contexts}')
    print(f'Required valid_contexts: {config["required_valid_contexts"]}')
    
    # Check if all required contexts are present
    missing = [ctx for ctx in config['required_valid_contexts'] if ctx not in current_valid_contexts]
    
    if missing:
        print(f'[FIX] Missing contexts: {missing}')
        # Add missing contexts
        new_valid_contexts = list(set(current_valid_contexts + config['required_valid_contexts']))
        content['valid_contexts'] = new_valid_contexts
        supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()
        print(f'[SUCCESS] Updated valid_contexts to: {new_valid_contexts}')
        print(f'[REASON] {config["reason"]}')
    else:
        print('[OK] All required valid_contexts already present')

print('\n=== SUMMARY ===')
print('Fixed valid_contexts for all tool-using contexts to allow continuation after tool completion.')










