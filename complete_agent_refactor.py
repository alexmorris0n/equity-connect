#!/usr/bin/env python3
"""Complete the agent.py refactor - Final cleanup and modifications"""

import os
import re

# Read the current file
script_dir = os.path.dirname(os.path.abspath(__file__))
agent_file = os.path.join(script_dir, "livekit-agent", "agent.py")

with open(agent_file, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Original file: {len(content)} characters")

# Step 1: Remove all old BarbaraAgent class code
# Find the start: after "from node_agent import BarbaraNodeAgent"
# Find the end: before "def prewarm(proc: JobProcess):"

# Pattern to match: everything between the imports and prewarm that contains old class code
pattern = r'(from node_agent import BarbaraNodeAgent\n\n)(.*?)(def prewarm\(proc: JobProcess\):)'

def replacement(match):
    return match.group(1) + '\n' + match.group(3)

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

print(f"After removing BarbaraAgent class: {len(content)} characters")

# Step 2: Find and modify agent creation (around "Load initial prompt" comment)
# Replace BarbaraAgent instantiation with RoutingCoordinator + BarbaraNodeAgent

old_agent_creation = r'''# Load initial prompt.*?agent = BarbaraAgent\(
        instructions=initial_instructions,
        phone_number=caller_phone,
        vertical="reverse_mortgage",
        call_type=call_type,
        lead_context=lead_context
    \)'''

new_agent_creation = '''# Create routing coordinator
    coordinator = RoutingCoordinator(
        phone=caller_phone,
        vertical="reverse_mortgage"
    )
    
    # Create initial greet agent (database-driven)
    agent = BarbaraNodeAgent(
        node_name="greet",
        vertical="reverse_mortgage",
        phone_number=caller_phone,
        chat_ctx=None,  # Fresh conversation
        coordinator=coordinator
    )'''

content = re.sub(old_agent_creation, new_agent_creation, content, flags=re.DOTALL)

print(f"After modifying agent creation: {len(content)} characters")

# Step 3: Remove manual routing hook
# Find and remove the "agent_speech_committed" event hook

old_hook = r'''    # Hook routing checks after each agent turn.*?session\.on\("agent_speech_committed", on_agent_finished_speaking\)\n'''

content = re.sub(old_hook, '', content, flags=re.DOTALL)

print(f"After removing manual routing hook: {len(content)} characters")

# Write the result
with open(agent_file, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n✅ agent.py refactor complete!")
print(f"   - BarbaraAgent class removed")
print(f"   - Agent creation updated to use RoutingCoordinator + BarbaraNodeAgent")
print(f"   - Manual routing hook removed (now automatic)")
print(f"\nReady for testing!")

