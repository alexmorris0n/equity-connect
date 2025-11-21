#!/usr/bin/env python3
"""Standalone test script for step_criteria_evaluator (no dependencies)."""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import directly
from workflows.step_criteria_evaluator import evaluate_step_criteria

def test_basic():
    """Test basic functionality."""
    print("Testing step_criteria_evaluator...")
    
    # Test 1: Simple equality
    state = {"verified": True}
    result = evaluate_step_criteria("verified == True", state)
    print(f"✓ Test 1 (verified == True): {result} (expected: True)")
    assert result == True, "Test 1 failed"
    
    # Test 2: Number comparison
    state2 = {"greet_turn_count": 2}
    result2 = evaluate_step_criteria("greet_turn_count >= 2", state2)
    print(f"✓ Test 2 (greet_turn_count >= 2): {result2} (expected: True)")
    assert result2 == True, "Test 2 failed"
    
    # Test 3: OR operator
    state3 = {"greet_turn_count": 1, "greeted": True}
    result3 = evaluate_step_criteria("greet_turn_count >= 2 OR greeted == True", state3)
    print(f"✓ Test 3 (OR): {result3} (expected: True)")
    assert result3 == True, "Test 3 failed"
    
    # Test 4: Missing field
    state4 = {}
    result4 = evaluate_step_criteria("verified == True", state4)
    print(f"✓ Test 4 (missing field): {result4} (expected: False)")
    assert result4 == False, "Test 4 failed"
    
    # Test 5: AND operator
    state5 = {"qualified": True, "has_objection": False}
    result5 = evaluate_step_criteria("qualified == True AND has_objection != True", state5)
    print(f"✓ Test 5 (AND): {result5} (expected: True)")
    assert result5 == True, "Test 5 failed"
    
    # Test 6: None comparison
    state6 = {"qualified": None}
    result6 = evaluate_step_criteria("qualified == None", state6)
    print(f"✓ Test 6 (None == None): {result6} (expected: True)")
    assert result6 == True, "Test 6 failed"
    
    # Test 7: != None
    state7 = {"qualified": True}
    result7 = evaluate_step_criteria("qualified != None", state7)
    print(f"✓ Test 7 (!= None): {result7} (expected: True)")
    assert result7 == True, "Test 7 failed"
    
    # Test 8: Literal True
    result8 = evaluate_step_criteria("True", {})
    print(f"✓ Test 8 (literal True): {result8} (expected: True)")
    assert result8 == True, "Test 8 failed"
    
    # Test 9: Complex expression
    state9 = {"greet_turn_count": 2, "greeted": True, "wrong_person": False}
    expr9 = "(greet_turn_count >= 2 AND greeted == True) OR wrong_person == True"
    result9 = evaluate_step_criteria(expr9, state9)
    print(f"✓ Test 9 (complex): {result9} (expected: True)")
    assert result9 == True, "Test 9 failed"
    
    print("\n✅ All tests passed!")

if __name__ == "__main__":
    test_basic()

