"""
Unit tests for valid_contexts enforcement (Step 1)

Tests that validate_transition() correctly blocks invalid transitions
and allows valid ones, matching SignalWire behavior.
"""

import os
import pytest
from unittest.mock import patch, MagicMock

# Ensure package imports work when running pytest from repo root
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from workflows.routers import validate_transition
from langgraph.graph import END


def test_valid_transition_allowed():
    """Test that valid transitions are allowed"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.return_value = {
            'valid_contexts': ['verify', 'qualify', 'exit']
        }
        
        is_valid, valid_contexts = validate_transition('greet', 'verify', 'reverse_mortgage')
        
        assert is_valid is True
        assert valid_contexts == ['verify', 'qualify', 'exit']


def test_invalid_transition_blocked():
    """Test that invalid transitions are blocked"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.return_value = {
            'valid_contexts': ['verify', 'qualify']  # 'answer' NOT in list
        }
        
        is_valid, valid_contexts = validate_transition('greet', 'answer', 'reverse_mortgage')
        
        assert is_valid is False
        assert valid_contexts == ['verify', 'qualify']


def test_exit_not_automatically_allowed():
    """Test that 'exit' must be in valid_contexts (not auto-allowed)"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.return_value = {
            'valid_contexts': ['verify', 'qualify']  # 'exit' NOT in list
        }
        
        is_valid, valid_contexts = validate_transition('greet', 'exit', 'reverse_mortgage')
        
        assert is_valid is False  # Should be blocked
        assert valid_contexts == ['verify', 'qualify']


def test_exit_allowed_when_in_valid_contexts():
    """Test that 'exit' is allowed when explicitly in valid_contexts"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.return_value = {
            'valid_contexts': ['verify', 'exit']
        }
        
        is_valid, valid_contexts = validate_transition('greet', 'exit', 'reverse_mortgage')
        
        assert is_valid is True
        assert valid_contexts == ['verify', 'exit']


def test_end_normalized_to_exit():
    """Test that END constant is normalized to 'exit' for comparison"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.return_value = {
            'valid_contexts': ['exit']  # Only 'exit' in list
        }
        
        # END should be normalized to 'exit' and allowed
        is_valid, valid_contexts = validate_transition('book', END, 'reverse_mortgage')
        
        assert is_valid is True
        assert valid_contexts == ['exit']


def test_no_valid_contexts_fallback():
    """Test backward compatibility when valid_contexts is empty"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.return_value = {
            'valid_contexts': []  # Empty list
        }
        
        is_valid, valid_contexts = validate_transition('greet', 'any_node', 'reverse_mortgage')
        
        assert is_valid is True  # Should allow all (backward compatible)
        assert valid_contexts == []


def test_missing_valid_contexts_key():
    """Test when valid_contexts key doesn't exist in config"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.return_value = {}  # No valid_contexts key
        
        is_valid, valid_contexts = validate_transition('greet', 'verify', 'reverse_mortgage')
        
        assert is_valid is True  # Should allow all (backward compatible)
        assert valid_contexts == []


def test_database_error_fallback():
    """Test that database errors don't crash - fail open for safety"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.side_effect = Exception("Database connection failed")
        
        is_valid, valid_contexts = validate_transition('greet', 'verify', 'reverse_mortgage')
        
        assert is_valid is True  # Fail open for backward compatibility
        assert valid_contexts == []


def test_real_greet_node_valid_contexts():
    """Test with realistic greet node valid_contexts from database"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        # Typical greet node valid_contexts: ["verify", "exit"]
        mock_load.return_value = {
            'valid_contexts': ['verify', 'exit']
        }
        
        # Valid transitions
        assert validate_transition('greet', 'verify', 'reverse_mortgage')[0] is True
        assert validate_transition('greet', 'exit', 'reverse_mortgage')[0] is True
        
        # Invalid transitions (should be blocked)
        assert validate_transition('greet', 'qualify', 'reverse_mortgage')[0] is False
        assert validate_transition('greet', 'answer', 'reverse_mortgage')[0] is False
        assert validate_transition('greet', 'quote', 'reverse_mortgage')[0] is False


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

