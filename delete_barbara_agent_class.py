#!/usr/bin/env python3
"""Delete BarbaraAgent class from agent.py"""

import os

# Get the correct path
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
agent_file = os.path.join(base_dir, 'livekit-agent', 'agent.py')

print(f"Looking for: {agent_file}")
print(f"Exists: {os.path.exists(agent_file)}")

if os.path.exists(agent_file):
    with open(agent_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Delete lines 33-353 (BarbaraAgent class)
    # Keep lines 0-31 (index 0-31) + lines 353+ (index 353+)
    new_lines = lines[:32] + lines[353:]
    
    with open(agent_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print(f"✅ Deleted BarbaraAgent class")
    print(f"Original: {len(lines)} lines → New: {len(new_lines)} lines")
    print(f"Deleted: {len(lines) - len(new_lines)} lines")
else:
    print("❌ File not found!")
    print(f"Current dir: {os.getcwd()}")
    print("Files in livekit-agent/:")
    lk_dir = os.path.join(base_dir, 'livekit-agent')
    if os.path.exists(lk_dir):
        print(os.listdir(lk_dir)[:10])

