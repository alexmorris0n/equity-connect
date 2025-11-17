#!/usr/bin/env python3
"""Trim EXIT context to essential instructions only - reduce from 6.3 KB to ~2 KB"""

import os
import sys
import json

# Try to load dotenv
try:
    from dotenv import load_dotenv
    try:
        load_dotenv()
    except Exception:
        pass
except ImportError:
    pass

try:
    from supabase import create_client, Client
except ImportError:
    print('[ERROR] supabase package not installed')
    sys.exit(1)

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print('[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    sys.exit(1)

supabase: Client = create_client(url, key)

# Get current EXIT context
result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', 'exit').eq('prompt_versions.is_active', True).execute()

if not result.data:
    print('[ERROR] No exit context found')
    sys.exit(1)

version = result.data[0]['prompt_versions'][0]
content = version['content']
original_instructions = content['instructions']
original_size = len(original_instructions.encode('utf-8'))

print("=" * 80)
print("TRIM EXIT CONTEXT")
print("=" * 80)
print(f"\nOriginal size: {original_size:,} bytes ({original_size/1024:.2f} KB)")

# Trimmed EXIT context - essential instructions only (~2 KB target)
trimmed_instructions = """# Exit Context

## Pre-Loaded Data
- Name: $first_name $last_name
- Broker: $broker_name (phone: $broker_phone)

---

## Exit Scenarios

1. **Booked** - Recap date/time, remind about confirmation
2. **Needs Time** - Acknowledge, flag needs_time_to_decide
3. **Manual Follow-up** - Explain broker will reach out, flag manual_booking_required
4. **Cancellation/Reschedule** - Direct to broker at $broker_phone, flag cancellation_redirect
5. **Wrong Person** - Leave message, provide callback, flag wrong_person_unavailable
6. **Disqualified** - Acknowledge kindly, flag disqualified_reason
7. **Voicemail** - Leave <20sec message with callback (repeat 2x), flag voicemail_left
8. **Hostile/Stop** - Acknowledge, apologize, flag do_not_contact, end immediately
9. **Trust/Coercion** - Reiterate broker will call directly, exit gently

---

## Question Handling
**If caller asks ANY question:**
- IMMEDIATELY call route_to_context(target_context="answer", reason="user_asked_question")
- Do NOT answer questions here - route to ANSWER context

---

## After Tool Completion
**After any tool completes:**
- Provide follow-up response - never leave silence
- If question asked: Route to answer context immediately
- If scenario complete: Warm close and ask if anything else

**Valid next contexts:** answer, greet"""

trimmed_size = len(trimmed_instructions.encode('utf-8'))
reduction = original_size - trimmed_size

print(f"Trimmed size: {trimmed_size:,} bytes ({trimmed_size/1024:.2f} KB)")
print(f"Reduction: {reduction:,} bytes ({reduction/1024:.2f} KB) - {int((reduction/original_size)*100)}% smaller")

# Update content
content['instructions'] = trimmed_instructions
# Keep step_criteria simple
content['step_criteria'] = "User has responded appropriately. If question asked, route to answer context immediately."

# Update in database
supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()

print("\n[OK] EXIT context trimmed and updated in database")
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Original: {original_size:,} bytes ({original_size/1024:.2f} KB)")
print(f"Trimmed:  {trimmed_size:,} bytes ({trimmed_size/1024:.2f} KB)")
print(f"Saved:    {reduction:,} bytes ({reduction/1024:.2f} KB)")
print(f"\nThis should reduce context switch payloads significantly!")

