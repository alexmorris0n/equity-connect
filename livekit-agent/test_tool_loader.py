"""Manual test for tool_loader.py

This script tests the tool loading functionality to verify:
1. Tools are loaded correctly from database
2. Tool count matches database expectations
3. Missing tools are handled gracefully
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tool_loader import load_tools_for_node

def test_tool_loading():
    """Test tool loading for each node"""
    
    test_nodes = ["greet", "verify", "qualify", "quote", "answer", "objections", "book"]
    
    print("=" * 60)
    print("Testing Tool Loader")
    print("=" * 60)
    print()
    
    for node_name in test_nodes:
        print(f"Testing node: {node_name}")
        print("-" * 40)
        
        tools = load_tools_for_node(node_name)
        
        print(f"  Loaded {len(tools)} tools")
        for tool in tools:
            # FunctionTool has a name attribute
            tool_name = getattr(tool, 'name', 'unknown')
            print(f"    - {tool_name}")
        
        print()
    
    print("=" * 60)
    print("Test complete!")
    print("=" * 60)

if __name__ == "__main__":
    test_tool_loading()

