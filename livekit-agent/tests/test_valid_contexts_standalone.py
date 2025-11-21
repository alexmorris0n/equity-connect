"""
Standalone test for valid_contexts enforcement (no pytest required)
Run with: python livekit-agent/tests/test_valid_contexts_standalone.py
"""

import os
import sys
from unittest.mock import patch

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import directly to avoid langgraph dependency
import sys
import os
import importlib.util

# Add parent directory to path
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)

# Mock END constant (from langgraph.graph) before importing
class END:
    pass

# Import validate_transition directly from file (bypass __init__.py)
spec = importlib.util.spec_from_file_location(
    "routers_module",
    os.path.join(parent_dir, "workflows", "routers.py")
)
routers_module = importlib.util.module_from_spec(spec)
# Inject END into module namespace before loading
import sys
sys.modules['langgraph.graph'] = type(sys)('langgraph.graph')
sys.modules['langgraph.graph'].END = END
spec.loader.exec_module(routers_module)
validate_transition = routers_module.validate_transition


def test_valid_transition_allowed():
    """Test that valid transitions are allowed"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.return_value = {
            'valid_contexts': ['verify', 'qualify', 'goodbye']  # Using 'goodbye' not 'exit'
        }
        
        is_valid, valid_contexts = validate_transition('greet', 'verify', 'reverse_mortgage')
        
        assert is_valid is True, f"Expected True, got {is_valid}"
        assert valid_contexts == ['verify', 'qualify', 'goodbye']
        print("✅ test_valid_transition_allowed: PASSED")


def test_invalid_transition_blocked():
    """Test that invalid transitions are blocked"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.return_value = {
            'valid_contexts': ['verify', 'qualify']  # 'answer' NOT in list
        }
        
        is_valid, valid_contexts = validate_transition('greet', 'answer', 'reverse_mortgage')
        
        assert is_valid is False, f"Expected False, got {is_valid}"
        assert valid_contexts == ['verify', 'qualify']
        print("✅ test_invalid_transition_blocked: PASSED")


def test_exit_maps_to_goodbye():
    """Test that router's 'exit' maps to database's 'goodbye'"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.return_value = {
            'valid_contexts': ['goodbye']  # Database has 'goodbye', not 'exit'
        }
        
        # Router returns 'exit' but database has 'goodbye'
        is_valid, valid_contexts = validate_transition('book', 'exit', 'reverse_mortgage')
        
        assert is_valid is True, f"Expected True (exit→goodbye mapping), got {is_valid}"
        assert valid_contexts == ['goodbye']
        print("✅ test_exit_maps_to_goodbye: PASSED")


def test_end_maps_to_goodbye():
    """Test that END constant maps to 'goodbye'"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.return_value = {
            'valid_contexts': ['goodbye']
        }
        
        # END constant should map to 'exit' then to 'goodbye'
        is_valid, valid_contexts = validate_transition('book', END, 'reverse_mortgage')
        
        assert is_valid is True, f"Expected True (END→exit→goodbye mapping), got {is_valid}"
        assert valid_contexts == ['goodbye']
        print("✅ test_end_maps_to_goodbye: PASSED")


def test_goodbye_not_auto_allowed():
    """Test that 'goodbye' must be in valid_contexts (not auto-allowed)"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.return_value = {
            'valid_contexts': ['verify', 'qualify']  # 'goodbye' NOT in list
        }
        
        is_valid, valid_contexts = validate_transition('greet', 'goodbye', 'reverse_mortgage')
        
        assert is_valid is False, f"Expected False (goodbye not in valid_contexts), got {is_valid}"
        assert valid_contexts == ['verify', 'qualify']
        print("✅ test_goodbye_not_auto_allowed: PASSED")


def test_no_valid_contexts_fallback():
    """Test backward compatibility when valid_contexts is empty"""
    with patch('services.prompt_loader.load_node_config') as mock_load:
        mock_load.return_value = {
            'valid_contexts': []  # Empty list
        }
        
        is_valid, valid_contexts = validate_transition('greet', 'any_node', 'reverse_mortgage')
        
        assert is_valid is True, f"Expected True (backward compatible), got {is_valid}"
        assert valid_contexts == []
        print("✅ test_no_valid_contexts_fallback: PASSED")


def run_all_tests():
    """Run all tests and report results"""
    tests = [
        test_valid_transition_allowed,
        test_invalid_transition_blocked,
        test_exit_maps_to_goodbye,
        test_end_maps_to_goodbye,
        test_goodbye_not_auto_allowed,
        test_no_valid_contexts_fallback,
    ]
    
    passed = 0
    failed = 0
    
    print("=" * 60)
    print("Running valid_contexts Enforcement Tests")
    print("=" * 60)
    print()
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"❌ {test.__name__}: FAILED - {e}")
            failed += 1
        except Exception as e:
            print(f"❌ {test.__name__}: ERROR - {e}")
            failed += 1
        print()
    
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    if failed == 0:
        print("✅ All tests PASSED!")
        return 0
    else:
        print("❌ Some tests FAILED")
        return 1


if __name__ == '__main__':
    exit(run_all_tests())

