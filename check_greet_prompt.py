import os
from dotenv import load_dotenv
from supabase import create_client, Client
import json

load_dotenv()

# Initialize Supabase client
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# Get current GREET prompt
result = supabase.table("prompts").select("*, prompt_versions!inner(*)").eq("node_name", "greet").eq("is_active", True).execute()

if result.data:
    prompt = result.data[0]
    print(f"Prompt ID: {prompt['id']}")
    print(f"Node: {prompt['node_name']}")
    
    for version in prompt['prompt_versions']:
        if version['is_active']:
            print(f"\nVersion: {version['version_number']}")
            print(f"Step Criteria: {version['content'].get('step_criteria', 'N/A')}")
            print(f"\nValid Contexts: {version['content'].get('valid_contexts', [])}")
            print(f"\nInstructions (last 200 chars):\n...{version['content'].get('instructions', '')[-200:]}")


