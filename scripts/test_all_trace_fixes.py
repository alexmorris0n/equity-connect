#!/usr/bin/env python3
"""
Comprehensive test to verify ALL trace analysis fixes.

Tests:
- CRITICAL: Routing fixes (valid_contexts)
- HIGH: Instruction updates (flag setting, error handling, etc.)
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
    pass

from equity_connect.services.contexts_builder import build_contexts_object
from equity_connect.services.supabase import get_supabase_client

def test_critical_routing_fixes():
    """Test CRITICAL fixes: Routing (valid_contexts)"""
    print("\n[TEST] CRITICAL: Routing Fixes")
    print("-" * 50)
    
    contexts = build_contexts_object(
        vertical="reverse_mortgage",
        initial_context="greet",
        use_draft=False
    )
    
    greet_context = contexts.get("greet", {})
    objections_context = contexts.get("objections", {})
    
    greet_valid = greet_context.get("valid_contexts", [])
    objections_valid = objections_context.get("valid_contexts", [])
    
    greet_pass = "qualify" in greet_valid
    objections_pass = "qualify" in objections_valid
    
    print(f"GREET valid_contexts: {greet_valid}")
    print(f"  -> Has 'qualify': {greet_pass}")
    print(f"OBJECTIONS valid_contexts: {objections_valid}")
    print(f"  -> Has 'qualify': {objections_pass}")
    
    return greet_pass and objections_pass

def test_high_priority_instruction_fixes():
    """Test HIGH priority fixes: Instruction updates"""
    print("\n[TEST] HIGH PRIORITY: Instruction Updates")
    print("-" * 50)
    
    supabase = get_supabase_client()
    
    # Get all nodes we fixed
    result = supabase.table("prompts").select(
        "node_name, prompt_versions!inner(content)"
    ).eq("vertical", "reverse_mortgage").eq("prompt_versions.is_active", True).in_(
        "node_name", ["greet", "verify", "qualify", "quote", "book"]
    ).execute()
    
    if not result.data:
        print("[FAIL] Could not fetch prompt data")
        return False
    
    all_passed = True
    
    for prompt_data in result.data:
        node_name = prompt_data.get("node_name")
        versions = prompt_data.get("prompt_versions", [])
        if not versions:
            continue
        
        content = versions[0].get("content", {})
        instructions = content.get("instructions", "")
        
        # Check for expected fixes based on node
        if node_name == "greet":
            has_flag_section = "## Flag Setting" in instructions
            has_verify_tool = "verify_caller_identity" in instructions and "verified=true" in instructions
            print(f"GREET: Flag Setting section: {has_flag_section}, verify_caller_identity mention: {has_verify_tool}")
            if not (has_flag_section and has_verify_tool):
                all_passed = False
        
        elif node_name == "verify":
            has_flag_section = "## Flag Setting" in instructions
            has_verified_mention = "verified=true" in instructions
            print(f"VERIFY: Flag Setting section: {has_flag_section}, verified=true mention: {has_verified_mention}")
            if not (has_flag_section and has_verified_mention):
                all_passed = False
        
        elif node_name == "qualify":
            has_multiple_answers = "## Handling Multiple Answers at Once" in instructions
            has_route_to_quote = "Route to QUOTE immediately" in instructions
            print(f"QUALIFY: Multiple answers section: {has_multiple_answers}, route to QUOTE: {has_route_to_quote}")
            if not (has_multiple_answers and has_route_to_quote):
                all_passed = False
        
        elif node_name == "quote":
            has_math_skill = "Use the math skill" in instructions
            has_calculation = "property_value × 0.50" in instructions or "property_value × 0.60" in instructions
            print(f"QUOTE: Math skill mention: {has_math_skill}, calculation details: {has_calculation}")
            if not (has_math_skill and has_calculation):
                all_passed = False
        
        elif node_name == "book":
            has_error_handling = "## Error Handling" in instructions
            has_manual_booking = "manual_booking_required" in instructions
            print(f"BOOK: Error Handling section: {has_error_handling}, manual_booking_required: {has_manual_booking}")
            if not (has_error_handling and has_manual_booking):
                all_passed = False
    
    return all_passed

def main():
    print("=" * 60)
    print("COMPREHENSIVE TRACE FIXES VERIFICATION TEST")
    print("=" * 60)
    
    results = []
    
    # Test CRITICAL fixes
    results.append(("CRITICAL: Routing Fixes", test_critical_routing_fixes()))
    
    # Test HIGH priority fixes
    results.append(("HIGH: Instruction Updates", test_high_priority_instruction_fixes()))
    
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
        print("[PASS] ALL TESTS PASSED - All fixes verified")
        return 0
    else:
        print("[FAIL] SOME TESTS FAILED - Review failed tests above")
        return 1

if __name__ == "__main__":
    sys.exit(main())

