#!/usr/bin/env python3
"""Fix step_criteria for all contexts to be POM-native (no route_to_context calls)"""

import os
import sys
import json

# Try to load dotenv, but don't fail if it's not available
try:
    from dotenv import load_dotenv
    try:
        load_dotenv()
    except (ValueError, Exception):
        pass  # Ignore dotenv errors (embedded null, etc.)
except ImportError:
    pass

from supabase import create_client, Client

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print('[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    sys.exit(1)

supabase: Client = create_client(url, key)

# POM-native step_criteria for each context (no route_to_context calls)
step_criteria_updates = {
    'greet': 'After greeting caller and they respond: If they ask a question, route to answer context. If they want to verify identity, route to verify context. If they express interest, route to qualify context. If they have objections, route to objections context. If they are not interested or not qualified, route to exit context.',
    
    'verify': 'After verifying caller identity and contact info: If verified and qualified, route to qualify context. If verified but not qualified, route to qualify context. If wrong person but right person available, route to greet context. If cannot verify or not interested, route to exit context.',
    
    'qualify': 'After collecting qualification information and determining eligibility: If qualified, route to quote context. If not qualified, route to exit context. If they ask questions during qualification, route to answer context.',
    
    'quote': 'After presenting the equity estimate and capturing their reaction: If they have questions, route to answer context. If they are ready to book, route to book context. If they raise objections, route to objections context. If they are not interested, route to exit context.',
    
    'book': 'After checking availability and booking appointment: If appointment is successfully booked, route to exit context. If they have questions during booking, route to answer context. If they raise objections, route to objections context. If booking cannot be completed, route to answer context.',
    
    'objections': 'After addressing the objection and confirming they feel better: If objection is resolved and they are ready to proceed, route to book context. If they have more questions, route to answer context. If objection persists or they are not interested, route to exit context.',
    
    'answer': 'After search_knowledge tool completes: Provide the answer clearly and concisely (1-2 sentences). Then ask if they have any other questions or if they are ready to book. If they have more questions, continue in answer context. If satisfied and ready, route to book context. If they raise objections, route to objections context. If not interested, route to exit context. NEVER leave silence after answering - always provide a follow-up question or transition.',
    
    'exit': 'After any user input: If they ask a question, route to answer context. If they want to reschedule, route to book context. If wrong person but right person available, route to greet context. Otherwise, if conversation is complete, provide warm close and end call.'
}

# Get all active prompt versions
result = supabase.table('prompts').select('id, node_name, prompt_versions!inner(id, content)').eq('vertical', 'reverse_mortgage').eq('prompt_versions.is_active', True).execute()

if not result.data:
    print('[ERROR] No prompts found')
    sys.exit(1)

updated_count = 0
for prompt in result.data:
    node_name = prompt['node_name']
    version = prompt['prompt_versions'][0]
    
    if node_name not in step_criteria_updates:
        print(f'[SKIP] {node_name} - no update defined')
        continue
    
    current_content = version['content']
    new_criteria = step_criteria_updates[node_name]
    
    # Check if update is needed
    current_criteria = current_content.get('step_criteria', '')
    if current_criteria == new_criteria:
        print(f'[SKIP] {node_name} - already has correct step_criteria')
        continue
    
    # Update step_criteria
    current_content['step_criteria'] = new_criteria
    
    # Update in database
    supabase.table('prompt_versions').update({'content': current_content}).eq('id', version['id']).execute()
    
    print(f'[OK] {node_name} - updated step_criteria')
    updated_count += 1

print(f'\n[SUCCESS] Updated {updated_count} contexts with POM-native step_criteria')

