#!/usr/bin/env python3
"""Check all contexts that use tools to ensure they have explicit post-tool continuation"""

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

# Contexts that commonly use tools
tool_contexts = ['book', 'qualify', 'quote', 'objections']

for context_name in tool_contexts:
    result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', context_name).eq('prompt_versions.is_active', True).execute()
    
    if not result.data:
        print(f'\n=== {context_name.upper()} CONTEXT: NOT FOUND ===')
        continue
    
    version = result.data[0]['prompt_versions'][0]
    content = version['content']
    step_criteria = content.get('step_criteria', '')
    
    print(f'\n=== {context_name.upper()} CONTEXT ===')
    print(f'step_criteria (first 200 chars): {step_criteria[:200]}...')
    
    # Check for explicit post-tool instructions
    has_immediate = 'immediately' in step_criteria.lower() or 'never leave silence' in step_criteria.lower()
    has_tool_mention = any(tool in step_criteria.lower() for tool in ['tool', 'complete', 'finish', 'after'])
    
    if has_immediate and has_tool_mention:
        print('[OK] Has explicit post-tool continuation instructions')
    elif has_tool_mention:
        print('[WARN] Mentions tools but not explicit about immediate continuation')
    else:
        print('[ERROR] No post-tool continuation instructions found')

