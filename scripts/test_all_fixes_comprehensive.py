#!/usr/bin/env python3
"""
Comprehensive test to verify ALL 13 trace analysis fixes.

Tests:
- CRITICAL: Routing fixes (2)
- HIGH: Instruction updates (4)
- MEDIUM: Edge cases (5)
- LOW: Clarifications (2)
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

def test_critical_fixes():
    """Test CRITICAL fixes: Routing (valid_contexts)"""
    print("\n[TEST] CRITICAL: Routing Fixes (2)")
    print("-" * 50)
    
    contexts = build_contexts_object(
        vertical="reverse_mortgage",
        initial_context="greet",
        use_draft=False
    )
    
    greet_valid = contexts.get("greet", {}).get("valid_contexts", [])
    objections_valid = contexts.get("objections", {}).get("valid_contexts", [])
    
    greet_pass = "qualify" in greet_valid
    objections_pass = "qualify" in objections_valid
    
    print(f"GREET has 'qualify': {greet_pass}")
    print(f"OBJECTIONS has 'qualify': {objections_pass}")
    
    return greet_pass and objections_pass

def test_high_priority_fixes():
    """Test HIGH priority fixes: Instruction updates"""
    print("\n[TEST] HIGH PRIORITY: Instruction Updates (4)")
    print("-" * 50)
    
    supabase = get_supabase_client()
    result = supabase.table("prompts").select(
        "node_name, prompt_versions!inner(content)"
    ).eq("vertical", "reverse_mortgage").eq("prompt_versions.is_active", True).in_(
        "node_name", ["greet", "verify", "qualify", "quote", "book"]
    ).execute()
    
    if not result.data:
        return False
    
    checks = {
        "greet": ["## Flag Setting", "verify_caller_identity", "verified=true"],
        "verify": ["## Flag Setting", "verified=true"],
        "qualify": ["## Handling Multiple Answers at Once", "Route to QUOTE immediately"],
        "quote": ["Use the math skill", "property_value × 0.50"],
        "book": ["## Error Handling", "manual_booking_required"]
    }
    
    all_passed = True
    for prompt_data in result.data:
        node_name = prompt_data.get("node_name")
        if node_name not in checks:
            continue
        
        versions = prompt_data.get("prompt_versions", [])
        if not versions:
            continue
        
        instructions = versions[0].get("content", {}).get("instructions", "")
        required = checks[node_name]
        
        node_pass = all(keyword in instructions for keyword in required)
        print(f"{node_name.upper()}: {node_pass}")
        if not node_pass:
            all_passed = False
    
    return all_passed

def test_medium_priority_fixes():
    """Test MEDIUM priority fixes: Edge cases"""
    print("\n[TEST] MEDIUM PRIORITY: Edge Cases (5)")
    print("-" * 50)
    
    supabase = get_supabase_client()
    result = supabase.table("prompts").select(
        "node_name, prompt_versions!inner(content)"
    ).eq("vertical", "reverse_mortgage").eq("prompt_versions.is_active", True).in_(
        "node_name", ["exit", "qualify", "quote"]
    ).execute()
    
    if not result.data:
        return False
    
    checks = {
        "exit": ["## Send FAQ and Follow Up", "## Reschedule Intent Detection"],
        "qualify": ["## Handling Interruptions", "pending_birthday"],
        "quote": ["## Late Disqualification Detection"]
    }
    
    all_passed = True
    for prompt_data in result.data:
        node_name = prompt_data.get("node_name")
        if node_name not in checks:
            continue
        
        versions = prompt_data.get("prompt_versions", [])
        if not versions:
            continue
        
        instructions = versions[0].get("content", {}).get("instructions", "")
        required = checks[node_name]
        
        node_pass = all(keyword in instructions for keyword in required)
        print(f"{node_name.upper()}: {node_pass}")
        if not node_pass:
            all_passed = False
    
    return all_passed

def test_low_priority_fixes():
    """Test LOW priority fixes: Clarifications"""
    print("\n[TEST] LOW PRIORITY: Clarifications (2)")
    print("-" * 50)
    
    supabase = get_supabase_client()
    result = supabase.table("prompts").select(
        "node_name, prompt_versions!inner(content)"
    ).eq("vertical", "reverse_mortgage").eq("prompt_versions.is_active", True).in_(
        "node_name", ["book", "greet", "verify", "qualify", "quote", "objections"]
    ).execute()
    
    if not result.data:
        return False
    
    # Check BOOK for duration handling
    book_pass = False
    question_handling_count = 0
    
    for prompt_data in result.data:
        node_name = prompt_data.get("node_name")
        versions = prompt_data.get("prompt_versions", [])
        if not versions:
            continue
        
        instructions = versions[0].get("content", {}).get("instructions", "")
        
        if node_name == "book":
            book_pass = "Duration Handling" in instructions or "duration parameter" in instructions
        
        if node_name in ["greet", "verify", "qualify", "quote", "book", "objections"]:
            if "## Question Handling" in instructions:
                question_handling_count += 1
    
    question_handling_pass = question_handling_count == 6
    
    print(f"BOOK duration handling: {book_pass}")
    print(f"Question handling (6 nodes): {question_handling_pass} ({question_handling_count}/6)")
    
    return book_pass and question_handling_pass

def main():
    print("=" * 60)
    print("COMPREHENSIVE TRACE FIXES VERIFICATION - ALL 13 FIXES")
    print("=" * 60)
    
    results = []
    results.append(("CRITICAL: Routing (2)", test_critical_fixes()))
    results.append(("HIGH: Instructions (4)", test_high_priority_fixes()))
    results.append(("MEDIUM: Edge Cases (5)", test_medium_priority_fixes()))
    results.append(("LOW: Clarifications (2)", test_low_priority_fixes()))
    
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
        print("[PASS] ALL 13 FIXES VERIFIED")
        return 0
    else:
        print("[FAIL] SOME FIXES NOT VERIFIED")
        return 1

if __name__ == "__main__":
    sys.exit(main())

