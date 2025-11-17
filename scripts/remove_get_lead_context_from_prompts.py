#!/usr/bin/env python3
"""Remove get_lead_context references from prompt instructions"""

import os
import sys

# Try to load dotenv, but don't fail if it's not available
try:
    from dotenv import load_dotenv
    try:
        load_dotenv()
    except (ValueError, Exception):
        # Handle embedded null character or other dotenv errors
        pass
except ImportError:
    pass

from supabase import create_client, Client

# Try to get from environment, but also check common locations
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# If not in env, try reading from .env file manually
if not url or not key:
    try:
        with open('.env', 'r') as f:
            for line in f:
                if line.startswith('SUPABASE_URL='):
                    url = line.split('=', 1)[1].strip().strip('"').strip("'")
                elif line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
                    key = line.split('=', 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass

if not url or not key:
    print('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    sys.exit(1)

supabase: Client = create_client(url, key)

# Update EXIT context
exit_result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', 'exit').eq('prompt_versions.is_active', True).execute()

if exit_result.data:
    version = exit_result.data[0]['prompt_versions'][0]
    instructions = version['content']['instructions']
    
    # Remove references to get_lead_context
    instructions = instructions.replace(
        '## Pre-Loaded Data (Already Available - DO NOT Call get_lead_context)',
        '## Pre-Loaded Data (Already Available)'
    )
    instructions = instructions.replace(
        '**CRITICAL: All lead data is already pre-loaded. DO NOT call get_lead_context - it is unnecessary and will cause errors.**',
        '**CRITICAL: All lead data is already pre-loaded at call start.**'
    )
    
    content = version['content']
    content['instructions'] = instructions
    
    supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()
    print('✅ Updated EXIT context - removed get_lead_context references')
else:
    print('⚠️  EXIT context not found')

# Update VERIFY context
verify_result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', 'verify').eq('prompt_versions.is_active', True).execute()

if verify_result.data:
    version = verify_result.data[0]['prompt_versions'][0]
    instructions = version['content']['instructions']
    
    # Remove references to get_lead_context
    instructions = instructions.replace(
        '## Pre-Loaded Data (Use This - Don\'t Call get_lead_context)',
        '## Pre-Loaded Data (Use This)'
    )
    
    content = version['content']
    content['instructions'] = instructions
    
    supabase.table('prompt_versions').update({'content': content}).eq('id', version['id']).execute()
    print('✅ Updated VERIFY context - removed get_lead_context references')
else:
    print('⚠️  VERIFY context not found')

print('✅ Done - removed all get_lead_context references from prompts')

