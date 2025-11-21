"""
Demo script showing expected extraction output for all 9 nodes.

This shows what the extraction prompt SHOULD produce without needing OpenAI API.
Run the actual test_extraction.py with OpenAI API key to verify.
"""

# Expected extractions for all 9 nodes
EXPECTED_EXTRACTIONS = {
    "greet": {
        "original": "Complete after greeting and initial rapport. Route based on their response: If they ask about amounts/calculations -> transition to QUOTE context immediately.",
        "extracted": "Initial greeting and rapport established",
        "removed": "Route based on their response: If they ask about amounts -> QUOTE..."
    },
    
    "verify": {
        "original": "Complete when caller confirms their info is correct OR you've updated incorrect info. Then route based on their response: If they ask about loan amounts -> QUOTE.",
        "extracted": "Caller confirms identity and information is verified or updated",
        "removed": "Then route based on their response: If they ask about loan amounts -> QUOTE..."
    },
    
    "qualify": {
        "original": "Complete when you've gathered all missing qualification info, updated the database, and called mark_qualification_result. Then route based on qualified status: If objections -> OBJECTIONS.",
        "extracted": "All qualification information gathered and qualification result recorded",
        "removed": "Then route based on qualified status: If objections -> OBJECTIONS..."
    },
    
    "answer": {
        "original": "Complete when you have answered their question. CRITICAL: If they ask about loan amounts -> IMMEDIATELY route to QUOTE.",
        "extracted": "User's question has been answered",
        "removed": "CRITICAL: If they ask about loan amounts -> IMMEDIATELY route to QUOTE..."
    },
    
    "quote": {
        "original": "Complete when you've presented the equity estimate, gauged their reaction, and called mark_quote_presented. Route based on their reaction.",
        "extracted": "Equity estimate presented and user reaction gauged",
        "removed": "Route based on their reaction"
    },
    
    "objections": {
        "original": "Complete when their objection is resolved and they express understanding or satisfaction. If more objections arise, stay in this context. Route to answer or book when ready.",
        "extracted": "Objection resolved and user expresses understanding or satisfaction",
        "removed": "If more objections arise, stay in this context. Route to answer or book when ready"
    },
    
    "book": {
        "original": "Appointment booked or declined",
        "extracted": "Appointment booked or declined",
        "removed": None  # Nothing to remove - already clean
    },
    
    "goodbye": {
        "original": "Said farewell and caller responded or stayed silent",
        "extracted": "Farewell said and caller responded or stayed silent",
        "removed": None  # Nothing to remove - already clean
    },
    
    "end": {
        "original": "Terminal state. Call ends here.",
        "extracted": "Terminal state reached",
        "removed": None  # Nothing to remove - already clean
    }
}


def print_demo():
    """Print expected extraction results."""
    print("=" * 100)
    print("STEP 2A: EXTRACTION DEMO - Expected Results")
    print("=" * 100)
    print()
    print("This shows what the extraction prompt SHOULD produce for all 9 nodes.")
    print("The extraction removes routing logic and keeps only completion criteria.")
    print()
    
    for node_name, data in EXPECTED_EXTRACTIONS.items():
        print(f"{'-' * 100}")
        print(f"Node: {node_name.upper()}")
        print(f"{'-' * 100}")
        print()
        
        print(f"ORIGINAL (from database):")
        print(f"  {data['original']}")
        print()
        
        if data['removed']:
            print(f"REMOVED (routing/instructions):")
            print(f"  {data['removed']}")
            print()
        
        print(f"EXTRACTED (clean completion criteria):")
        print(f"  {data['extracted']}")
        print()
        print()
    
    print("=" * 100)
    print("SUMMARY")
    print("=" * 100)
    print()
    print(f"Total nodes: {len(EXPECTED_EXTRACTIONS)}")
    print(f"Nodes with routing removed: {sum(1 for d in EXPECTED_EXTRACTIONS.values() if d['removed'])}")
    print(f"Already clean nodes: {sum(1 for d in EXPECTED_EXTRACTIONS.values() if not d['removed'])}")
    print()
    print("This extraction provides clean input for Step 2B (SW/LK conversion)")
    print()


if __name__ == "__main__":
    print_demo()

