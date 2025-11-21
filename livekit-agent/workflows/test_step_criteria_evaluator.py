"""Unit tests for step_criteria_evaluator.

Run with: python -m pytest livekit-agent/workflows/test_step_criteria_evaluator.py -v
"""

import pytest
from workflows.step_criteria_evaluator import evaluate_step_criteria


class TestStepCriteriaEvaluator:
    """Test cases for step_criteria expression evaluation."""
    
    def test_simple_equality_true(self):
        """Test simple equality with True."""
        state = {"verified": True}
        assert evaluate_step_criteria("verified == True", state) == True
    
    def test_simple_equality_false(self):
        """Test simple equality with False."""
        state = {"verified": False}
        assert evaluate_step_criteria("verified == True", state) == False
    
    def test_missing_field(self):
        """Test missing field returns False."""
        state = {}
        assert evaluate_step_criteria("verified == True", state) == False
    
    def test_none_comparison(self):
        """Test None comparison."""
        state = {"qualified": None}
        assert evaluate_step_criteria("qualified == None", state) == True
        assert evaluate_step_criteria("qualified != None", state) == False
    
    def test_not_none_comparison(self):
        """Test != None comparison."""
        state = {"qualified": True}
        assert evaluate_step_criteria("qualified != None", state) == True
        assert evaluate_step_criteria("qualified == None", state) == False
    
    def test_number_comparison_greater_equal(self):
        """Test >= comparison with numbers."""
        state = {"greet_turn_count": 2}
        assert evaluate_step_criteria("greet_turn_count >= 2", state) == True
        assert evaluate_step_criteria("greet_turn_count >= 3", state) == False
    
    def test_number_comparison_less_than(self):
        """Test < comparison with numbers."""
        state = {"greet_turn_count": 1}
        assert evaluate_step_criteria("greet_turn_count < 2", state) == True
        assert evaluate_step_criteria("greet_turn_count < 1", state) == False
    
    def test_or_operator(self):
        """Test OR logical operator."""
        state1 = {"greet_turn_count": 2, "greeted": False}
        assert evaluate_step_criteria("greet_turn_count >= 2 OR greeted == True", state1) == True
        
        state2 = {"greet_turn_count": 1, "greeted": True}
        assert evaluate_step_criteria("greet_turn_count >= 2 OR greeted == True", state2) == True
        
        state3 = {"greet_turn_count": 1, "greeted": False}
        assert evaluate_step_criteria("greet_turn_count >= 2 OR greeted == True", state3) == False
    
    def test_and_operator(self):
        """Test AND logical operator."""
        state1 = {"qualified": True, "has_objection": False}
        assert evaluate_step_criteria("qualified == True AND has_objection != True", state1) == True
        
        state2 = {"qualified": True, "has_objection": True}
        assert evaluate_step_criteria("qualified == True AND has_objection != True", state2) == False
    
    def test_not_operator(self):
        """Test NOT logical operator."""
        state = {"has_objection": True}
        assert evaluate_step_criteria("NOT has_objection == True", state) == False
        assert evaluate_step_criteria("NOT has_objection == False", state) == True
    
    def test_complex_expression(self):
        """Test complex expression with parentheses."""
        state = {"greet_turn_count": 2, "greeted": True, "wrong_person": False}
        expr = "(greet_turn_count >= 2 AND greeted == True) OR wrong_person == True"
        assert evaluate_step_criteria(expr, state) == True
    
    def test_string_comparison(self):
        """Test string comparison."""
        state = {"quote_reaction": "positive"}
        assert evaluate_step_criteria('quote_reaction == "positive"', state) == True
        assert evaluate_step_criteria('quote_reaction == "negative"', state) == False
    
    def test_literal_true(self):
        """Test literal True expression."""
        assert evaluate_step_criteria("True", {}) == True
    
    def test_literal_false(self):
        """Test literal False expression."""
        assert evaluate_step_criteria("False", {}) == False
    
    def test_empty_expression(self):
        """Test empty expression returns False."""
        assert evaluate_step_criteria("", {}) == False
        assert evaluate_step_criteria("   ", {}) == False
    
    def test_multiple_conditions(self):
        """Test multiple OR conditions."""
        state = {"questions_answered": False, "ready_to_book": True, "has_objections": False}
        expr = "questions_answered == True OR ready_to_book == True OR has_objections == True"
        assert evaluate_step_criteria(expr, state) == True
    
    def test_greet_node_criteria(self):
        """Test GREET node criteria from trace_test.md."""
        state1 = {"greet_turn_count": 2, "greeted": False}
        assert evaluate_step_criteria("greet_turn_count >= 2 OR greeted == True", state1) == True
        
        state2 = {"greet_turn_count": 1, "greeted": True}
        assert evaluate_step_criteria("greet_turn_count >= 2 OR greeted == True", state2) == True
        
        state3 = {"greet_turn_count": 1, "greeted": False}
        assert evaluate_step_criteria("greet_turn_count >= 2 OR greeted == True", state3) == False
    
    def test_verify_node_criteria(self):
        """Test VERIFY node criteria."""
        state = {"verified": True}
        assert evaluate_step_criteria("verified == True", state) == True
        
        state = {"verified": False}
        assert evaluate_step_criteria("verified == True", state) == False
    
    def test_qualify_node_criteria(self):
        """Test QUALIFY node criteria."""
        state1 = {"qualified": True, "has_objection": False}
        assert evaluate_step_criteria("qualified != None OR has_objection == True", state1) == True
        
        state2 = {"qualified": None, "has_objection": True}
        assert evaluate_step_criteria("qualified != None OR has_objection == True", state2) == True
        
        state3 = {"qualified": None, "has_objection": False}
        assert evaluate_step_criteria("qualified != None OR has_objection == True", state3) == False
    
    def test_quote_node_criteria(self):
        """Test QUOTE node criteria."""
        state1 = {"quote_presented": True, "has_objection": False}
        assert evaluate_step_criteria("quote_presented == True OR has_objection == True", state1) == True
        
        state2 = {"quote_presented": False, "has_objection": True}
        assert evaluate_step_criteria("quote_presented == True OR has_objection == True", state2) == True
    
    def test_answer_node_criteria(self):
        """Test ANSWER node criteria."""
        state = {"questions_answered": False, "ready_to_book": True, "has_objections": False}
        expr = "questions_answered == True OR ready_to_book == True OR has_objections == True"
        assert evaluate_step_criteria(expr, state) == True
    
    def test_objections_node_criteria(self):
        """Test OBJECTIONS node criteria."""
        state = {"objection_handled": True}
        assert evaluate_step_criteria("objection_handled == True", state) == True
    
    def test_book_node_criteria(self):
        """Test BOOK node criteria."""
        state1 = {"appointment_booked": True, "manual_booking_required": False}
        expr = "appointment_booked == True OR manual_booking_required == True"
        assert evaluate_step_criteria(expr, state1) == True
        
        state2 = {"appointment_booked": False, "manual_booking_required": True}
        assert evaluate_step_criteria(expr, state2) == True
    
    def test_malformed_expression(self):
        """Test malformed expressions return False safely."""
        state = {"verified": True}
        # Missing operator
        assert evaluate_step_criteria("verified True", state) == False
        # Unclosed parenthesis
        assert evaluate_step_criteria("(verified == True", state) == False
        # Invalid operator
        assert evaluate_step_criteria("verified === True", state) == False

