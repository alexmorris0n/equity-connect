#!/usr/bin/env python3
"""Check answer context configuration for search_knowledge handling"""

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

print('=== ANSWER CONTEXT CONFIGURATION ===')
print(f'step_criteria: {content.get("step_criteria")}')
print(f'skip_user_turn: {content.get("skip_user_turn")}')
print(f'valid_contexts: {content.get("valid_contexts")}')

# Check if step_criteria mentions search_knowledge completion
step_criteria = content.get('step_criteria', '')
if 'search_knowledge' in step_criteria.lower():
    print('\n=== FOUND search_knowledge MENTION IN step_criteria ===')
else:
    print('\n=== NO search_knowledge MENTION IN step_criteria ===')
    print('This is the problem! Barbara needs explicit instructions on what to do after search_knowledge completes.')

# Check if instructions mention what to do after search_knowledge
instructions = content.get('instructions', '')
if 'after search_knowledge' in instructions.lower() or 'after tool' in instructions.lower():
    print('\n=== FOUND post-tool instructions ===')
    # Find the relevant section
    lines = instructions.split('\n')
    for i, line in enumerate(lines):
        if 'after search_knowledge' in line.lower() or 'after tool' in line.lower():
            print(f'Line {i}: {line}')
            # Print context around it
            start = max(0, i-2)
            end = min(len(lines), i+3)
            print('\nContext:')
            for j in range(start, end):
                marker = '>>>' if j == i else '   '
                print(f'{marker} {j}: {lines[j]}')
else:
    print('\n=== NO post-tool instructions found ===')
    print('The answer context does not tell Barbara what to do after search_knowledge completes!')










