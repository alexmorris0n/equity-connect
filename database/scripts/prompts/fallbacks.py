"""
Fallback expressions for step_criteria conversion.

These are used if AI generation fails or produces invalid output.
All expressions are manually validated and match expected behavior.
"""

# SignalWire fallback - action-oriented natural language
FALLBACK_SIGNALWIRE = {
    "greet": "The user has been greeted and initial rapport has been established.",
    
    "verify": "The caller's identity has been confirmed and their information is verified.",
    
    "qualify": "All required qualification information has been collected and the qualification result has been recorded.",
    
    "answer": "The user's question has been answered.",
    
    "quote": "The equity estimate has been presented and the user's reaction has been observed.",
    
    "objections": "The objection has been resolved and the user has expressed understanding or satisfaction.",
    
    "book": "The appointment has been successfully scheduled or the user has declined to book.",
    
    "goodbye": "The farewell has been said and the caller has responded or remained silent.",
    
    "end": "The terminal state has been reached."
}


# LiveKit fallback - boolean expressions
# These match the existing hardcoded logic in node_completion.py
FALLBACK_LIVEKIT = {
    "greet": "greet_turn_count >= 2 OR greeted == True",
    
    "verify": "verified == True",
    
    "qualify": "qualified != None",
    
    "answer": "questions_answered == True OR ready_to_book == True OR has_objection == True",
    
    "quote": "quote_presented == True",
    
    "objections": "objection_handled == True",
    
    "book": "appointment_booked == True",
    
    "goodbye": "True",
    
    "end": "True"
}


def get_signalwire_fallback(node_name: str) -> str:
    """
    Get fallback SignalWire criteria for a node.
    
    Args:
        node_name: Name of the node
        
    Returns:
        SignalWire-optimized natural language string
    """
    return FALLBACK_SIGNALWIRE.get(node_name, f"The {node_name} step is complete.")


def get_livekit_fallback(node_name: str) -> str:
    """
    Get fallback LiveKit expression for a node.
    
    Args:
        node_name: Name of the node
        
    Returns:
        Boolean expression string
    """
    return FALLBACK_LIVEKIT.get(node_name, "True")


def validate_fallbacks():
    """
    Validate that all fallback expressions are present and correct.
    
    Returns:
        Tuple of (is_valid, errors)
    """
    errors = []
    
    # Check all nodes are covered
    required_nodes = ["greet", "verify", "qualify", "answer", "quote", 
                      "objections", "book", "goodbye", "end"]
    
    for node in required_nodes:
        if node not in FALLBACK_SIGNALWIRE:
            errors.append(f"Missing SignalWire fallback for node: {node}")
        
        if node not in FALLBACK_LIVEKIT:
            errors.append(f"Missing LiveKit fallback for node: {node}")
    
    # Validate LiveKit expressions (syntax check)
    try:
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../livekit-agent'))
        from workflows.step_criteria_evaluator import evaluate_step_criteria
        
        for node, expression in FALLBACK_LIVEKIT.items():
            try:
                # Try to evaluate with empty state (just checks syntax)
                _ = evaluate_step_criteria(expression, {})
            except Exception as e:
                errors.append(f"Invalid LiveKit expression for {node}: {expression} - Error: {e}")
    
    except ImportError:
        # Can't validate without evaluator (not an error, just skip validation)
        pass
    
    is_valid = len(errors) == 0
    return (is_valid, errors)


if __name__ == "__main__":
    """Test fallbacks when run directly."""
    print("=" * 80)
    print("FALLBACK VALIDATION")
    print("=" * 80)
    print()
    
    is_valid, errors = validate_fallbacks()
    
    if is_valid:
        print("All fallbacks validated successfully")
        print()
        print(f"SignalWire fallbacks: {len(FALLBACK_SIGNALWIRE)} nodes")
        print(f"LiveKit fallbacks: {len(FALLBACK_LIVEKIT)} nodes")
        print()
        
        # Show examples
        print("Example fallbacks:")
        print()
        for node in ["greet", "verify", "book"]:
            print(f"Node: {node}")
            print(f"  SW: {FALLBACK_SIGNALWIRE[node]}")
            print(f"  LK: {FALLBACK_LIVEKIT[node]}")
            print()
    else:
        print("Validation failed:")
        for error in errors:
            print(f"  - {error}")
        print()

