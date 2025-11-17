#!/usr/bin/env python3
"""Fix exit context instructions to use route_to_context instead of get_lead_context"""

import os
import sys

# Try to load dotenv, but don't fail if it's not available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from supabase import create_client, Client

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase: Client = create_client(url, key)

# Get exit context
result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', 'exit').eq('prompt_versions.is_active', True).execute()

if not result.data:
    print('❌ No exit context found')
    sys.exit(1)

version = result.data[0]['prompt_versions'][0]
instructions = version['content']['instructions']

# Old problematic section
old_section = """## CRITICAL: Handling get_lead_context Tool Calls
**When get_lead_context tool completes:**
- The tool provides lead data for context
- **BUT if the user asked a question that triggered this tool:**
  - **YOU MUST immediately acknowledge their question**
  - **YOU MUST route to the ANSWER context RIGHT NOW**
  - Do NOT just say "got it" and wait - route immediately to answer their question

**Pattern:**
1. User asks question → get_lead_context called → tool completes
2. You acknowledge: "I can help with that."
3. **Route to ANSWER context immediately** to use search_knowledge tool

**DO NOT** remain in exit context after get_lead_context completes with a pending question."""

# New correct section
new_section = """## CRITICAL: Handling Questions - Use route_to_context Tool
**When the caller asks ANY question:**
- **IMMEDIATELY call the route_to_context tool** with target_context="answer" and reason="user_asked_question"
- Do NOT call get_lead_context for routing - that tool is only for loading lead data (and is already loaded at call start)
- Do NOT try to answer questions in this context - route to ANSWER context immediately

**Pattern:**
1. User asks question
2. **Call route_to_context(target_context="answer", reason="user_asked_question")** immediately
3. The tool will switch you to the ANSWER context where you can use search_knowledge

**DO NOT** remain in exit context when a question is asked - always route immediately using route_to_context."""

# Old questions handling section
old_questions = """## Questions Handling
**CRITICAL: If the caller asks ANY question:**
- Acknowledge briefly: "I can help with that." or "Let me answer that for you."
- **Route to the ANSWER context immediately** (use the answer context to handle the question with search_knowledge tool)
- Do NOT try to answer questions in this context - you don't have the knowledge search tool here

**After answering in the ANSWER context, you can route back here if appropriate.**"""

# New questions handling section
new_questions = """## Questions Handling
**CRITICAL: If the caller asks ANY question:**
- **IMMEDIATELY call the route_to_context tool** with target_context="answer" and reason="user_asked_question"
- The route_to_context tool will programmatically switch you to the ANSWER context
- Once in ANSWER context, use the search_knowledge tool to find the answer
- After answering, you can route back here if appropriate using route_to_context(target_context="exit")"""

# Replace sections
if old_section in instructions:
    instructions = instructions.replace(old_section, new_section)
    print('✅ Replaced "CRITICAL: Handling get_lead_context Tool Calls" section')
else:
    print('⚠️  "CRITICAL: Handling get_lead_context Tool Calls" section not found (may already be fixed)')

if old_questions in instructions:
    instructions = instructions.replace(old_questions, new_questions)
    print('✅ Replaced "Questions Handling" section')
else:
    print('⚠️  "Questions Handling" section not found or already updated')

# Update content
content = version['content']
content['instructions'] = instructions

# Update in database
supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()
print('✅ Updated exit context instructions in database')

