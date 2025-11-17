#!/usr/bin/env python3
"""Temporarily apply minimal test prompts to database for payload size testing"""

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
    print('[ERROR] supabase package not installed. Run: pip install supabase')
    sys.exit(1)

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print('[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    sys.exit(1)

supabase: Client = create_client(url, key)

# Read minimal test prompts
def read_md_file(filepath):
    """Read markdown file and extract instructions"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        # Extract instructions section (everything after "## Instructions")
        if "## Instructions" in content:
            instructions = content.split("## Instructions")[1].strip()
            # Remove markdown formatting
            instructions = instructions.replace("**", "").replace("*", "")
            return instructions
        return content
    except Exception as e:
        print(f'[ERROR] Failed to read {filepath}: {e}')
        return None

# Minimal test prompts (from MINIMAL_TEST_*.md files)
minimal_prompts = {
    "greet": {
        "instructions": """Say hello to the caller using their first name. Ask how you can help them today.

Tools available:
- route_to_context - Route to another context if needed
- search_knowledge - Answer questions

Next contexts: exit, answer""",
        "step_criteria": "User has responded appropriately.",
        "tools": ["route_to_context", "search_knowledge"],
        "valid_contexts": ["exit", "answer"]
    },
    "exit": {
        "instructions": """Thank the caller and provide a warm goodbye. If they ask a question, route to the answer context.

Tools available:
- route_to_context - Route to answer context for questions
- search_knowledge - Answer questions if staying in this context

Next contexts: greet, answer""",
        "step_criteria": "User has responded appropriately.",
        "tools": ["route_to_context", "search_knowledge"],
        "valid_contexts": ["greet", "answer"]
    }
}

# Backup current prompts first
print("=" * 80)
print("MINIMAL TEST PROMPT APPLIER")
print("=" * 80)

# Get current prompts
result = supabase.table('prompts').select('*, prompt_versions!inner(*)').eq('vertical', 'reverse_mortgage').eq('node_name', 'in', ['greet', 'exit']).eq('prompt_versions.is_active', True).execute()

if not result.data:
    print('[ERROR] No prompts found')
    sys.exit(1)

backups = {}
for prompt in result.data:
    node_name = prompt['node_name']
    version = prompt['prompt_versions'][0]
    backups[node_name] = {
        'id': version['id'],
        'content': version['content'].copy()
    }
    print(f'[BACKUP] Backed up {node_name} context (version ID: {version["id"]})')

# Apply minimal prompts
print("\n[APPLY] Applying minimal test prompts...")
for node_name, minimal_config in minimal_prompts.items():
    if node_name not in backups:
        print(f'[WARN] {node_name} not found in database, skipping')
        continue
    
    version_id = backups[node_name]['id']
    original_content = backups[node_name]['content'].copy()
    
    # Update with minimal content
    updated_content = original_content.copy()
    updated_content['instructions'] = minimal_config['instructions']
    updated_content['step_criteria'] = minimal_config['step_criteria']
    updated_content['tools'] = minimal_config['tools']
    updated_content['valid_contexts'] = minimal_config['valid_contexts']
    
    # Update in database
    supabase.table('prompt_versions').update({'content': updated_content}).eq('id', version_id).execute()
    
    # Calculate size reduction
    original_size = len(json.dumps(original_content).encode('utf-8'))
    new_size = len(json.dumps(updated_content).encode('utf-8'))
    reduction = original_size - new_size
    
    print(f'[OK] Updated {node_name}:')
    print(f'     Original: {original_size:,} bytes ({original_size/1024:.2f} KB)')
    print(f'     Minimal:  {new_size:,} bytes ({new_size/1024:.2f} KB)')
    print(f'     Reduced:  {reduction:,} bytes ({reduction/1024:.2f} KB)')

print("\n" + "=" * 80)
print("MINIMAL TEST PROMPTS APPLIED")
print("=" * 80)
print("\nTo restore original prompts, run:")
print("  python scripts/restore_original_prompts.py")
print("\nOriginal prompts backed up in:")
for node_name in backups.keys():
    print(f"  - prompts/rewrite/MINIMAL_TEST_BACKUP_{node_name}.md")

