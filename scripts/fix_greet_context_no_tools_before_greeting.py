#!/usr/bin/env python3
"""Fix greet context to explicitly require greeting FIRST before any tools"""

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

result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', 'greet').eq('prompt_versions.is_active', True).execute()

if not result.data:
    print('ERROR: greet context not found')
    sys.exit(1)

version = result.data[0]['prompt_versions'][0]
content = version['content']
instructions = content.get('instructions', '')

# Remove mark_ready_to_book from tools (shouldn't be in greet - user hasn't expressed readiness yet)
tools = content.get('tools', [])
if 'mark_ready_to_book' in tools:
    tools = [t for t in tools if t != 'mark_ready_to_book']
    content['tools'] = tools
    print('[FIX] Removed mark_ready_to_book from greet context tools')

# Add explicit instruction at the very beginning
if '## CRITICAL: GREET FIRST' not in instructions:
    critical_section = """## CRITICAL: GREET FIRST - NO TOOLS BEFORE GREETING

**YOU MUST GREET THE CALLER FIRST BEFORE CALLING ANY TOOLS.**

1. **FIRST:** Say the greeting word-for-word (see greetings below)
2. **THEN:** Wait for their response
3. **ONLY AFTER** they respond: Use tools if needed (e.g., verify_caller_identity if they want to verify, search_knowledge if they ask a question)

**DO NOT call any tools before greeting the caller.**
**DO NOT call mark_ready_to_book in this context - the user hasn't expressed readiness yet.**

---

"""
    instructions = critical_section + instructions
    content['instructions'] = instructions
    print('[FIX] Added explicit "GREET FIRST" instruction to greet context')

# Update step_criteria to emphasize greeting first
step_criteria = content.get('step_criteria', '')
if 'GREET FIRST' not in step_criteria:
    new_step_criteria = """FIRST: Greet the caller using the exact greeting below. Wait for their response. THEN, after greeting and they respond: If lead status is appointment_set: Acknowledge their appointment and ask if they need to confirm, reschedule, cancel, or have questions. Route to appropriate context (book for reschedule, answer for questions, exit for cancel). If they ask a question, route to answer context. If they want to verify identity, route to verify context. If they express interest, route to qualify context. If they have objections, route to objections context. If they are not interested or not qualified, route to exit context."""
    content['step_criteria'] = new_step_criteria
    print('[FIX] Updated step_criteria to emphasize greeting first')

supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()
print('\n[SUCCESS] Fixed greet context: removed mark_ready_to_book, added explicit "GREET FIRST" instruction')


