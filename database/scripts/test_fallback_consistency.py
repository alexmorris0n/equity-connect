"""
Cross-validation test: Ensure fallbacks match expected conversions.

This verifies that our manual fallbacks are consistent with the
expected outputs shown in demo_conversions.py.
"""

import sys
import os

# Add prompts to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'prompts'))

from fallbacks import FALLBACK_SIGNALWIRE, FALLBACK_LIVEKIT

# Expected conversions from demo_conversions.py
EXPECTED_CONVERSIONS = {
    "greet": {
        "signalwire": "The user has been greeted and initial rapport has been established.",
        "livekit": "greet_turn_count >= 2 OR greeted == True"
    },
    "verify": {
        "signalwire": "The caller's identity has been confirmed and their information is verified.",
        "livekit": "verified == True"
    },
    "qualify": {
        "signalwire": "All required qualification information has been collected and the qualification result has been recorded.",
        "livekit": "qualified != None"
    },
    "answer": {
        "signalwire": "The user's question has been answered.",
        "livekit": "questions_answered == True OR ready_to_book == True OR has_objection == True"
    },
    "quote": {
        "signalwire": "The equity estimate has been presented and the user's reaction has been observed.",
        "livekit": "quote_presented == True"
    },
    "objections": {
        "signalwire": "The objection has been resolved and the user has expressed understanding or satisfaction.",
        "livekit": "objection_handled == True"
    },
    "book": {
        "signalwire": "The appointment has been successfully scheduled or the user has declined to book.",
        "livekit": "appointment_booked == True"
    },
    "goodbye": {
        "signalwire": "The farewell has been said and the caller has responded or remained silent.",
        "livekit": "True"
    },
    "end": {
        "signalwire": "The terminal state has been reached.",
        "livekit": "True"
    }
}


def validate_consistency():
    """Validate that fallbacks match expected conversions."""
    print("=" * 80)
    print("FALLBACK CONSISTENCY VALIDATION")
    print("=" * 80)
    print()
    print("Checking that fallbacks match expected demo conversions...")
    print()
    
    sw_matches = 0
    sw_total = len(EXPECTED_CONVERSIONS)
    lk_matches = 0
    lk_total = len(EXPECTED_CONVERSIONS)
    
    mismatches = []
    
    for node, expected in EXPECTED_CONVERSIONS.items():
        # Check SignalWire
        fallback_sw = FALLBACK_SIGNALWIRE.get(node, "")
        if fallback_sw == expected['signalwire']:
            sw_matches += 1
        else:
            mismatches.append({
                'node': node,
                'type': 'SignalWire',
                'expected': expected['signalwire'],
                'got': fallback_sw
            })
        
        # Check LiveKit
        fallback_lk = FALLBACK_LIVEKIT.get(node, "")
        if fallback_lk == expected['livekit']:
            lk_matches += 1
        else:
            mismatches.append({
                'node': node,
                'type': 'LiveKit',
                'expected': expected['livekit'],
                'got': fallback_lk
            })
    
    # Report
    print("Results:")
    print(f"  SignalWire: {sw_matches}/{sw_total} matches")
    print(f"  LiveKit: {lk_matches}/{lk_total} matches")
    print()
    
    if len(mismatches) == 0:
        print("SUCCESS: All fallbacks match expected conversions!")
        print()
        return True
    else:
        print("MISMATCHES FOUND:")
        print()
        for m in mismatches:
            print(f"Node: {m['node']} ({m['type']})")
            print(f"  Expected: {m['expected']}")
            print(f"  Got:      {m['got']}")
            print()
        return False


if __name__ == "__main__":
    success = validate_consistency()
    sys.exit(0 if success else 1)

