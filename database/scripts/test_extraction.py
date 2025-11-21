"""
Test cases for extraction prompt validation.
Run this to verify extraction quality before running main script.

Usage:
    # Set OpenAI API key
    export OPENAI_API_KEY="sk-..."
    
    # Run tests with mini model (default)
    python database/scripts/test_extraction.py
    
    # Run tests with full model
    python database/scripts/test_extraction.py --model gpt-4o
"""

import os
import sys
import argparse

# Add prompts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'prompts'))

from extraction_prompt import EXTRACTION_PROMPT

# Test cases based on actual database content
TEST_CASES = [
    {
        "node": "greet",
        "input": "Complete after greeting and initial rapport. Route based on their response: If they ask about amounts/calculations (\"how much\", \"loan amount\", \"money available\") → transition to QUOTE context immediately. If they ask general reverse mortgage questions → transition to ANSWER context. If they want to book → transition to BOOK context. If they need verification → transition to VERIFY context. Always provide a clear next action - never end abruptly.",
        "expected": "Initial greeting and rapport established"
    },
    {
        "node": "verify",
        "input": "Complete when caller confirms their info is correct OR you've updated incorrect info. Then route based on their response: If they ask about loan amounts (\"how much can I get?\") → QUOTE. If they have general questions → ANSWER. If they have concerns/objections → OBJECTIONS. Otherwise → QUALIFY.",
        "expected": "Caller confirms identity and information is verified or updated"
    },
    {
        "node": "qualify",
        "input": "Complete when you've gathered all missing qualification info, updated the database, and called mark_qualification_result. Then route based on qualified status and their response: If they raise objections/concerns → OBJECTIONS. If qualified=true → QUOTE. If qualified=false → GOODBYE (exit gracefully).",
        "expected": "All qualification information gathered and qualification result recorded"
    },
    {
        "node": "answer",
        "input": "Complete when you have answered their question. CRITICAL: If they ask about loan amounts/calculations (\"how much\", \"calculate\", \"money available\", \"what can I get\") → IMMEDIATELY route to QUOTE (do NOT answer yourself). For other questions: answer using CALLER INFORMATION or search_knowledge, then ask if they have more questions. Route based on response: more questions → stay in ANSWER, ready to book → BOOK, concerns → OBJECTIONS, all set → GOODBYE.",
        "expected": "User's question has been answered"
    },
    {
        "node": "quote",
        "input": "Complete when you've presented the equity estimate, gauged their reaction, and called mark_quote_presented. Route based on their reaction.",
        "expected": "Equity estimate presented and user reaction gauged"
    },
    {
        "node": "objections",
        "input": "Complete when their objection is resolved and they express understanding or satisfaction. If more objections arise, stay in this context. Route to answer or book when ready.",
        "expected": "Objection resolved and user expresses understanding or satisfaction"
    },
    {
        "node": "book",
        "input": "Appointment booked or declined",
        "expected": "Appointment booked or declined"
    },
    {
        "node": "goodbye",
        "input": "Said farewell and caller responded or stayed silent",
        "expected": "Farewell said and caller responded or stayed silent"
    },
    {
        "node": "end",
        "input": "Terminal state. Call ends here.",
        "expected": "Terminal state reached"
    }
]


def test_extraction(use_model: str = "gpt-4o-mini", verbose: bool = True):
    """
    Test the extraction prompt against all 9 nodes.
    Shows what will be extracted before running full conversion.
    
    Args:
        use_model: Model to use (gpt-4o-mini or gpt-4o)
        verbose: Print detailed output
        
    Returns:
        List of result dicts
    """
    from openai import OpenAI
    
    # Check API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ Error: OPENAI_API_KEY environment variable not set")
        print("   Set it with: export OPENAI_API_KEY='sk-...'")
        sys.exit(1)
    
    client = OpenAI(api_key=api_key)
    
    if verbose:
        print("=" * 80)
        print(f"🧪 Testing Extraction Prompt with {use_model}")
        print("=" * 80)
        print()
    
    results = []
    
    for test in TEST_CASES:
        if verbose:
            print(f"📝 Node: {test['node']}")
            print(f"   Input: {test['input'][:80]}...")
            print(f"   Expected: {test['expected']}")
        
        try:
            # Call GPT with extraction prompt
            response = client.chat.completions.create(
                model=use_model,
                messages=[{
                    "role": "user",
                    "content": EXTRACTION_PROMPT.format(
                        node_name=test['node'],
                        step_criteria_source=test['input']
                    )
                }],
                temperature=0.0,
                max_tokens=100
            )
            
            output = response.choices[0].message.content.strip()
            # Clean up any markdown or quotes
            output = output.replace('```', '').strip()
            output = output.strip('"').strip("'")
            
            if verbose:
                print(f"   Got: {output}")
            
            # Compare (case-insensitive)
            match = output.lower().strip() == test['expected'].lower().strip()
            
            if verbose:
                if match:
                    print(f"   ✅ EXACT MATCH")
                else:
                    print(f"   ⚠️  DIFFERENT (review for quality)")
            
            results.append({
                "node": test['node'],
                "input": test['input'],
                "expected": test['expected'],
                "got": output,
                "match": match,
                "error": None
            })
        
        except Exception as e:
            if verbose:
                print(f"   ❌ ERROR: {e}")
            
            results.append({
                "node": test['node'],
                "input": test['input'],
                "expected": test['expected'],
                "got": None,
                "match": False,
                "error": str(e)
            })
        
        if verbose:
            print()
    
    # Summary
    if verbose:
        print("=" * 80)
        print("📊 SUMMARY")
        print("=" * 80)
        
        exact_matches = sum(1 for r in results if r['match'])
        errors = sum(1 for r in results if r['error'])
        
        print(f"Total nodes: {len(results)}")
        print(f"✅ Exact matches: {exact_matches}/{len(results)}")
        print(f"⚠️  Different (may be OK): {len(results) - exact_matches - errors}")
        print(f"❌ Errors: {errors}")
        print()
        
        # Show detailed comparison table
        print(f"{'Node':<12} | {'Status':<12} | {'Match':<5}")
        print("-" * 80)
        for r in results:
            if r['error']:
                status = "ERROR"
                match_str = "❌"
            elif r['match']:
                status = "EXACT"
                match_str = "✅"
            else:
                status = "DIFFERENT"
                match_str = "⚠️"
            
            print(f"{r['node']:<12} | {status:<12} | {match_str}")
        
        print()
        
        # Show non-matches in detail
        non_matches = [r for r in results if not r['match'] and not r['error']]
        if non_matches:
            print("=" * 80)
            print("⚠️  NON-EXACT MATCHES (Review for Quality)")
            print("=" * 80)
            print()
            
            for r in non_matches:
                print(f"Node: {r['node']}")
                print(f"Expected: {r['expected']}")
                print(f"Got:      {r['got']}")
                print()
    
    return results


def main():
    parser = argparse.ArgumentParser(description='Test extraction prompt quality')
    parser.add_argument('--model', default='gpt-4o-mini', choices=['gpt-4o-mini', 'gpt-4o'],
                        help='Model to use for testing (default: gpt-4o-mini)')
    parser.add_argument('--quiet', action='store_true', help='Only show summary')
    args = parser.parse_args()
    
    results = test_extraction(use_model=args.model, verbose=not args.quiet)
    
    # Exit with error code if any errors occurred
    errors = sum(1 for r in results if r['error'])
    if errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()

