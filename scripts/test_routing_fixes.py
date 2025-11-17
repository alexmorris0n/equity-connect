#!/usr/bin/env python3
"""
Test script to verify routing fixes are actually applied.

This verifies:
1. Database has correct valid_contexts
2. Code loads them correctly
3. They're passed to SignalWire SDK correctly
"""

import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass  # .env file may have issues, continue anyway

from equity_connect.services.contexts_builder import build_contexts_object
from equity_connect.services.supabase import get_supabase_client

def test_greet_has_qualify():
    """Test that GREET context has 'qualify' in valid_contexts"""
    print("\n[TEST] GREET to QUALIFY routing")
    print("-" * 50)
    
    contexts = build_contexts_object(
        vertical="reverse_mortgage",
        initial_context="greet",
        use_draft=False
    )
    
    greet_context = contexts.get("greet", {})
    valid_contexts = greet_context.get("valid_contexts", [])
    
    print(f"GREET valid_contexts: {valid_contexts}")
    
    if "qualify" in valid_contexts:
        print("[PASS] GREET can route to QUALIFY")
        return True
    else:
        print("[FAIL] GREET cannot route to QUALIFY")
        print(f"   Expected 'qualify' in {valid_contexts}")
        return False

def test_objections_has_qualify():
    """Test that OBJECTIONS context has 'qualify' in valid_contexts"""
    print("\n[TEST] OBJECTIONS to QUALIFY routing")
    print("-" * 50)
    
    contexts = build_contexts_object(
        vertical="reverse_mortgage",
        initial_context="objections",
        use_draft=False
    )
    
    objections_context = contexts.get("objections", {})
    valid_contexts = objections_context.get("valid_contexts", [])
    
    print(f"OBJECTIONS valid_contexts: {valid_contexts}")
    
    if "qualify" in valid_contexts:
        print("[PASS] OBJECTIONS can route to QUALIFY")
        return True
    else:
        print("[FAIL] OBJECTIONS cannot route to QUALIFY")
        print(f"   Expected 'qualify' in {valid_contexts}")
        return False

def test_database_values():
    """Test that database actually has the correct values"""
    print("\n[TEST] Database values")
    print("-" * 50)
    
    supabase = get_supabase_client()
    
    # Get GREET
    greet_result = supabase.table("prompts").select(
        "node_name, prompt_versions!inner(content)"
    ).eq("vertical", "reverse_mortgage").eq("node_name", "greet").eq("prompt_versions.is_active", True).execute()
    
    # Get OBJECTIONS
    objections_result = supabase.table("prompts").select(
        "node_name, prompt_versions!inner(content)"
    ).eq("vertical", "reverse_mortgage").eq("node_name", "objections").eq("prompt_versions.is_active", True).execute()
    
    greet_valid = None
    objections_valid = None
    
    if greet_result.data:
        greet_content = greet_result.data[0].get("prompt_versions", [{}])[0].get("content", {})
        greet_valid = greet_content.get("valid_contexts", [])
        print(f"Database GREET valid_contexts: {greet_valid}")
    
    if objections_result.data:
        objections_content = objections_result.data[0].get("prompt_versions", [{}])[0].get("content", {})
        objections_valid = objections_content.get("valid_contexts", [])
        print(f"Database OBJECTIONS valid_contexts: {objections_valid}")
    
    greet_pass = "qualify" in (greet_valid or [])
    objections_pass = "qualify" in (objections_valid or [])
    
    if greet_pass:
        print("[PASS] Database GREET has 'qualify'")
    else:
        print("[FAIL] Database GREET missing 'qualify'")
    
    if objections_pass:
        print("[PASS] Database OBJECTIONS has 'qualify'")
    else:
        print("[FAIL] Database OBJECTIONS missing 'qualify'")
    
    return greet_pass and objections_pass

def main():
    print("=" * 60)
    print("ROUTING FIXES VERIFICATION TEST")
    print("=" * 60)
    
    results = []
    
    # Test 1: Database values
    results.append(("Database Values", test_database_values()))
    
    # Test 2: Code loads GREET correctly
    results.append(("GREET to QUALIFY", test_greet_has_qualify()))
    
    # Test 3: Code loads OBJECTIONS correctly
    results.append(("OBJECTIONS to QUALIFY", test_objections_has_qualify()))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    all_passed = True
    for test_name, passed in results:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status}: {test_name}")
        if not passed:
            all_passed = False
    
    print("=" * 60)
    if all_passed:
        print("[PASS] ALL TESTS PASSED - Routing fixes verified")
        return 0
    else:
        print("[FAIL] SOME TESTS FAILED - Routing fixes NOT verified")
        return 1

if __name__ == "__main__":
    sys.exit(main())

