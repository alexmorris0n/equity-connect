"""Test script for theme prompt loading system"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.prompt_loader import load_theme, load_node_prompt

def test_theme_loading():
    print("\n" + "="*60)
    print("THEME LOADING TEST")
    print("="*60)
    
    # Test 1: Load theme for reverse_mortgage
    print("\n[TEST 1] Loading theme for reverse_mortgage vertical...")
    theme = load_theme("reverse_mortgage")
    print(f"✅ Theme loaded: {len(theme)} characters")
    print(f"\nFirst 200 chars:\n{theme[:200]}...")
    
    # Test 2: Load node prompt (should include theme)
    print("\n[TEST 2] Loading greet node (should include theme)...")
    greet_prompt = load_node_prompt("greet", "reverse_mortgage")
    print(f"✅ Greet prompt loaded: {len(greet_prompt)} characters")
    
    # Test 3: Verify theme is in combined prompt
    print("\n[TEST 3] Verifying theme is included...")
    if "Barbara - Core Personality" in greet_prompt:
        print("✅ Theme found in combined prompt")
    else:
        print("❌ Theme NOT found in combined prompt")
        return False
    
    # Test 4: Check structure
    print("\n[TEST 4] Checking prompt structure...")
    parts = greet_prompt.split("---")
    if len(parts) >= 2:
        print(f"✅ Prompt correctly separated into {len(parts)} parts (theme, node)")
        print(f"   - Part 1 (theme): {len(parts[0])} chars")
        print(f"   - Part 2 (node): {len(parts[1])} chars")
    else:
        print("❌ Prompt structure incorrect")
        return False
    
    print("\n" + "="*60)
    print("ALL TESTS PASSED ✅")
    print("="*60 + "\n")
    return True

if __name__ == "__main__":
    test_theme_loading()

