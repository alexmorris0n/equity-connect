"""Test script for theme prompt loading system"""
import sys
import os

# Fix Windows console encoding for emojis
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Set mock environment variables for testing (avoid loading corrupt .env)
os.environ.setdefault('SUPABASE_URL', 'mock-url')
os.environ.setdefault('SUPABASE_SERVICE_KEY', 'mock-key')

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.prompt_loader import load_theme, load_node_prompt

def test_theme_loading():
    print("\n" + "="*60)
    print("THEME LOADING TEST (Fallback Mode)")
    print("="*60)
    print("Note: Using fallback theme since Supabase credentials not available in test")
    
    # Test 1: Load theme for reverse_mortgage
    print("\n[TEST 1] Loading theme for reverse_mortgage vertical...")
    theme = load_theme("reverse_mortgage")
    print(f"[OK] Theme loaded: {len(theme)} characters")
    print(f"\nFirst 100 chars:\n{theme[:100]}...")
    
    # Test 2: Verify theme has core personality content
    print("\n[TEST 2] Verifying theme structure...")
    if "Barbara" in theme and "Core Personality" in theme:
        print("[OK] Theme contains Barbara core personality")
    else:
        print("[FAIL] Theme missing core personality structure")
        return False
    
    # Test 3: Load node prompt (should include theme)
    print("\n[TEST 3] Loading greet node (should include theme)...")
    greet_prompt = load_node_prompt("greet", "reverse_mortgage")
    print(f"[OK] Greet prompt loaded: {len(greet_prompt)} characters")
    
    # Test 4: Verify theme is in combined prompt
    print("\n[TEST 4] Verifying theme is included in combined prompt...")
    if "Barbara" in greet_prompt and "Core Personality" in greet_prompt:
        print("[OK] Theme found in combined prompt")
    else:
        print("[FAIL] Theme NOT found in combined prompt")
        return False
    
    # Test 5: Check structure (theme separated from node by ---)
    print("\n[TEST 5] Checking prompt structure (theme --- node separation)...")
    parts = greet_prompt.split("---")
    if len(parts) >= 2:
        print(f"[OK] Prompt correctly separated into {len(parts)} parts")
        print(f"   - Part 1 (theme): {len(parts[0])} chars")
        if len(parts) > 1:
            print(f"   - Part 2 (node): {len(parts[1])} chars")
    else:
        print("[FAIL] Prompt structure incorrect - no separator found")
        return False
    
    print("\n" + "="*60)
    print("ALL TESTS PASSED!")
    print("="*60)
    print("\nNote: This tested fallback mode.")
    print("In production, theme will load from Supabase theme_prompts table.")
    print("\n")
    return True

if __name__ == "__main__":
    success = test_theme_loading()
    sys.exit(0 if success else 1)

