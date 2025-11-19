#!/usr/bin/env python3
"""Update ANSWER prompt instructions to check CALLER INFORMATION first"""
import os
from supabase import create_client

# Get Supabase credentials
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    exit(1)

sb = create_client(url, key)

new_instructions = """You are in ANSWER context. Your job:

**BEFORE calling search_knowledge, CHECK the CALLER INFORMATION section above.**
If the question is about the caller's property, city, address, age, equity, or value - use that data to answer directly.

Example:
- Question: "What city is my house in?"
- Check CALLER INFORMATION → Property: Los Angeles, CA  
- Answer: "Your home is in Los Angeles, California."

**ONLY call search_knowledge if:**
- Question is about reverse mortgage rules, policies, or general information
- NOT answered by CALLER INFORMATION

After answering, ask: "Any other questions?"
When they say no/none/all set, call complete_questions(next_context="goodbye")"""

# Get the prompt ID
prompt_resp = sb.table("prompts").select("id").eq("node_name", "answer").eq("vertical", "reverse_mortgage").execute()

if not prompt_resp.data:
    print("Error: ANSWER prompt not found")
    exit(1)

prompt_id = prompt_resp.data[0]["id"]

# Update the active version
result = sb.table("prompt_versions") \
    .update({"content": sb.table("prompt_versions").select("content").eq("prompt_id", prompt_id).eq("is_active", True).execute().data[0]["content"]}) \
    .eq("prompt_id", prompt_id) \
    .eq("is_active", True) \
    .execute()

# Actually, let's do this properly with a raw SQL update via RPC
# First get current content
current = sb.table("prompt_versions").select("content").eq("prompt_id", prompt_id).eq("is_active", True).execute()

if current.data:
    current_content = current.data[0]["content"]
    current_content["instructions"] = new_instructions
    
    # Update
    result = sb.table("prompt_versions") \
        .update({"content": current_content}) \
        .eq("prompt_id", prompt_id) \
        .eq("is_active", True) \
        .execute()
    
    print(f"✅ Updated ANSWER instructions")
    print(f"New instructions:\n{new_instructions}")
else:
    print("Error: Could not find active prompt version")



