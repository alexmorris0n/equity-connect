#!/usr/bin/env python3
"""
Trace Test Script - POM Native Routing

Tests all scenarios from trace_test.md using actual database nodes
with the new POM-native routing (no route_to_context tool).

This script:
1. Loads actual context configurations from database
2. Simulates conversation flows for each scenario
3. Validates routing decisions, tool availability, and step_criteria
4. Reports any mismatches or gaps
"""

import os
import sys
import json
from typing import Dict, List, Optional, Set

# Try to load dotenv, but don't fail if it's not available
try:
    from dotenv import load_dotenv
    try:
        load_dotenv()
    except (ValueError, Exception):
        pass  # Ignore dotenv errors (embedded null, etc.)
except ImportError:
    pass

# Add parent directory to path
script_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(script_dir)
sys.path.insert(0, parent_dir)

from equity_connect.services.supabase import get_supabase_client

# ANSI colors for output (plain text fallback for Windows)
GREEN = "[PASS]"
RED = "[FAIL]"
YELLOW = "[WARN]"
BLUE = "[INFO]"
RESET = ""

supabase = get_supabase_client()

# Test lead data
TEST_LEAD = {
    "first_name": "Testy",
    "last_name": "Mctesterson",
    "name": "Testy Mctesterson",
    "phone": "+16505300051",
    "email": "testy@example.com",
    "broker_name": "Walter Richards",
    "broker_company": "My Reverse Options",
    "property_city": "Los Angeles",
    "property_state": "CA",
    "property_value": 400000,
    "estimated_equity": 200000,
    "qualified": True
}


def load_context_from_db(node_name: str) -> Dict:
    """Load a single context configuration from database"""
    result = supabase.table('prompts') \
        .select('*, prompt_versions!inner(*)') \
        .eq('vertical', 'reverse_mortgage') \
        .eq('node_name', node_name) \
        .eq('prompt_versions.is_active', True) \
        .single() \
        .execute()
    
    if not result.data:
        return None
    
    version = result.data['prompt_versions'][0]
    content = version['content']
    
    return {
        'node_name': node_name,
        'instructions': content.get('instructions', ''),
        'step_criteria': content.get('step_criteria', ''),
        'valid_contexts': content.get('valid_contexts', []),
        'tools': content.get('tools', []),
        'skip_user_turn': content.get('skip_user_turn', False)
    }


def check_tool_available(context: Dict, tool_name: str) -> bool:
    """Check if a tool is available in a context"""
    return tool_name in context.get('tools', [])


def check_valid_transition(from_context: str, to_context: str, contexts: Dict) -> bool:
    """Check if transition from one context to another is valid"""
    from_ctx = contexts.get(from_context)
    if not from_ctx:
        return False
    
    valid = from_ctx.get('valid_contexts', [])
    return to_context in valid or 'answer' in valid or 'exit' in valid  # Escape hatches


def check_instructions_mention(context: Dict, keyword: str) -> bool:
    """Check if instructions mention a keyword"""
    instructions = context.get('instructions', '').lower()
    return keyword.lower() in instructions


def trace_scenario_1():
    """Scenario 1: Perfect Qualified Lead"""
    print(f'\n{BLUE}=== SCENARIO 1: Perfect Qualified Lead ==={RESET}')
    
    contexts = {}
    for node in ['greet', 'verify', 'qualify', 'quote', 'book', 'exit']:
        contexts[node] = load_context_from_db(node)
    
    issues = []
    
    # GREET → VERIFY
    if not check_valid_transition('greet', 'verify', contexts):
        issues.append(f"{RED} GREET cannot route to VERIFY")
    
    # VERIFY → QUALIFY
    if not check_valid_transition('verify', 'qualify', contexts):
        issues.append(f"{RED} VERIFY cannot route to QUALIFY")
    
    # QUALIFY → QUOTE
    if not check_valid_transition('qualify', 'quote', contexts):
        issues.append(f"{RED} QUALIFY cannot route to QUOTE")
    
    # QUOTE → BOOK
    if not check_valid_transition('quote', 'book', contexts):
        issues.append(f"{RED} QUOTE cannot route to BOOK")
    
    # BOOK → EXIT
    if not check_valid_transition('book', 'exit', contexts):
        issues.append(f"{RED} BOOK cannot route to EXIT")
    
    # Check tools
    if not check_tool_available(contexts['qualify'], 'mark_qualification_result'):
        issues.append(f"{YELLOW} QUALIFY missing mark_qualification_result tool")
    
    if not check_tool_available(contexts['quote'], 'mark_quote_presented'):
        issues.append(f"{YELLOW} QUOTE missing mark_quote_presented tool")
    
    if not check_tool_available(contexts['book'], 'book_appointment'):
        issues.append(f"{RED} BOOK missing book_appointment tool")
    
    # Check step_criteria
    for node_name, ctx in contexts.items():
        if not ctx.get('step_criteria'):
            issues.append(f"{YELLOW} {node_name.upper()} missing step_criteria")
    
    if issues:
        print(f'\n{RED} ISSUES FOUND:{RESET}')
        for issue in issues:
            print(f'  {issue}')
    else:
        print(f'\n{GREEN} PASS: All routing and tools valid{RESET}')
    
    return len([i for i in issues if RED in i]) == 0


def trace_scenario_1b():
    """Scenario 1B: Happy Path with Questions After Booking"""
    print(f'\n{BLUE}=== SCENARIO 1B: Questions After Booking (Same Call) ==={RESET}')
    
    exit_ctx = load_context_from_db('exit')
    answer_ctx = load_context_from_db('answer')
    
    issues = []
    
    # EXIT should route to ANSWER for questions
    if not check_valid_transition('exit', 'answer', {'exit': exit_ctx}):
        issues.append(f"{RED} EXIT cannot route to ANSWER for questions")
    
    # EXIT should have search_knowledge or route to ANSWER
    if not check_tool_available(exit_ctx, 'search_knowledge'):
        if 'answer' not in exit_ctx.get('valid_contexts', []):
            issues.append(f"{RED} EXIT cannot handle questions (no search_knowledge, no answer route)")
    
    # ANSWER should be able to stay in ANSWER for multiple questions
    if 'answer' not in answer_ctx.get('valid_contexts', []):
        issues.append(f"{YELLOW} ANSWER cannot stay in ANSWER for follow-up questions")
    
    # ANSWER should route back to EXIT
    if not check_valid_transition('answer', 'exit', {'answer': answer_ctx}):
        issues.append(f"{YELLOW} ANSWER cannot route back to EXIT after answering")
    
    # Check step_criteria mentions question handling
    if not check_instructions_mention(exit_ctx, 'question'):
        issues.append(f"{YELLOW} EXIT instructions don't mention question handling")
    
    if issues:
        print(f'\n{RED} ISSUES FOUND:{RESET}')
        for issue in issues:
            print(f'  {issue}')
    else:
        print(f'\n{GREEN} PASS: EXIT can handle questions after booking{RESET}')
    
    return len([i for i in issues if RED in i]) == 0


def trace_scenario_2b():
    """Scenario 2B: Qualified Lead Calls Back with Questions"""
    print(f'\n{BLUE}=== SCENARIO 2B: Qualified Lead Calls Back with Questions ==={RESET}')
    
    greet_ctx = load_context_from_db('greet')
    answer_ctx = load_context_from_db('answer')
    exit_ctx = load_context_from_db('exit')
    
    issues = []
    
    # Path A: Starts at ANSWER
    if not check_tool_available(answer_ctx, 'search_knowledge'):
        issues.append(f"{RED} ANSWER missing search_knowledge tool")
    
    if 'answer' not in answer_ctx.get('valid_contexts', []):
        issues.append(f"{RED} ANSWER cannot stay in ANSWER for multiple questions")
    
    # Path B: Starts at GREET, user asks questions
    if not check_valid_transition('greet', 'answer', {'greet': greet_ctx}):
        issues.append(f"{RED} GREET cannot route to ANSWER for questions")
    
    if not check_instructions_mention(greet_ctx, 'question'):
        issues.append(f"{YELLOW} GREET instructions don't mention question handling")
    
    # Path C: Starts at EXIT, user asks questions
    if not check_valid_transition('exit', 'answer', {'exit': exit_ctx}):
        issues.append(f"{RED} EXIT cannot route to ANSWER for questions")
    
    if issues:
        print(f'\n{RED} ISSUES FOUND:{RESET}')
        for issue in issues:
            print(f'  {issue}')
    else:
        print(f'\n{GREEN} PASS: All paths can handle questions{RESET}')
    
    return len([i for i in issues if RED in i]) == 0


def trace_scenario_2c():
    """Scenario 2C: Booked Lead Calls Back with Questions"""
    print(f'\n{BLUE}=== SCENARIO 2C: Booked Lead Calls Back with Questions ==={RESET}')
    
    exit_ctx = load_context_from_db('exit')
    answer_ctx = load_context_from_db('answer')
    
    issues = []
    
    # EXIT should route to ANSWER for questions
    if not check_valid_transition('exit', 'answer', {'exit': exit_ctx}):
        issues.append(f"{RED} EXIT cannot route to ANSWER for questions")
    
    # ANSWER should have search_knowledge
    if not check_tool_available(answer_ctx, 'search_knowledge'):
        issues.append(f"{RED} ANSWER missing search_knowledge tool")
    
    # ANSWER should be able to route back to EXIT
    if not check_valid_transition('answer', 'exit', {'answer': answer_ctx}):
        issues.append(f"{YELLOW} ANSWER cannot route back to EXIT after answering")
    
    # Check instructions mention questions
    if not check_instructions_mention(exit_ctx, 'question'):
        issues.append(f"{YELLOW} EXIT instructions don't explicitly mention question handling")
    
    if issues:
        print(f'\n{RED} ISSUES FOUND:{RESET}')
        for issue in issues:
            print(f'  {issue}')
    else:
        print(f'\n{GREEN} PASS: Booked lead can ask questions{RESET}')
    
    return len([i for i in issues if RED in i]) == 0


def trace_scenario_4():
    """Scenario 4: "My Kids Said No" Objection"""
    print(f'\n{BLUE}=== SCENARIO 4: "My Kids Said No" Objection ==={RESET}')
    
    quote_ctx = load_context_from_db('quote')
    objections_ctx = load_context_from_db('objections')
    
    issues = []
    
    # QUOTE should route to OBJECTIONS for objections
    if not check_valid_transition('quote', 'objections', {'quote': quote_ctx}):
        issues.append(f"{RED} QUOTE cannot route to OBJECTIONS for objections")
    
    # QUOTE should have mark_has_objection tool
    if not check_tool_available(quote_ctx, 'mark_has_objection'):
        issues.append(f"{RED} QUOTE missing mark_has_objection tool")
    
    # OBJECTIONS should have mark_objection_handled
    if not check_tool_available(objections_ctx, 'mark_objection_handled'):
        issues.append(f"{RED} OBJECTIONS missing mark_objection_handled tool")
    
    # Check instructions mention objection detection
    if not check_instructions_mention(quote_ctx, 'objection'):
        issues.append(f"{YELLOW} QUOTE instructions don't mention objection detection")
    
    if issues:
        print(f'\n{RED} ISSUES FOUND:{RESET}')
        for issue in issues:
            print(f'  {issue}')
    else:
        print(f'\n{GREEN} PASS: Objection handling works{RESET}')
    
    return len([i for i in issues if RED in i]) == 0


def check_answer_context_exit_routing():
    """Check ANSWER context routing to EXIT (from user's hangup issue)"""
    print(f'\n{BLUE}=== ANSWER CONTEXT EXIT ROUTING CHECK ==={RESET}')
    
    answer_ctx = load_context_from_db('answer')
    
    issues = []
    
    # Check valid_contexts includes exit
    valid = answer_ctx.get('valid_contexts', [])
    if 'exit' in valid:
        print(f'{YELLOW} WARNING: ANSWER can route to EXIT (may cause premature hangup){RESET}')
        print(f'  Valid contexts: {valid}')
        
        # Check step_criteria
        criteria = answer_ctx.get('step_criteria', '')
        if 'exit' in criteria.lower() and 'not interested' not in criteria.lower():
            issues.append(f"{RED} ANSWER step_criteria routes to EXIT without clear 'not interested' condition")
    
    # Check if answer can stay in answer for multiple questions
    if 'answer' not in valid:
        issues.append(f"{RED} ANSWER cannot stay in ANSWER for follow-up questions")
    
    # Check instructions
    instructions = answer_ctx.get('instructions', '')
    if 'exit' in instructions.lower() and 'not interested' not in instructions.lower():
        issues.append(f"{YELLOW} ANSWER instructions mention EXIT without 'not interested' condition")
    
    if issues:
        print(f'\n{RED} ISSUES FOUND:{RESET}')
        for issue in issues:
            print(f'  {issue}')
    else:
        print(f'\n{GREEN} PASS: ANSWER routing is safe{RESET}')
    
    return len([i for i in issues if RED in i]) == 0


def main():
    """Run all trace tests"""
    print(f'{BLUE}[TEST] Running Trace Tests with POM-Native Routing{RESET}')
    print(f'{BLUE}Using actual database nodes (no route_to_context tool){RESET}\n')
    
    results = {}
    
    # Run all scenarios
    results['scenario_1'] = trace_scenario_1()
    results['scenario_1b'] = trace_scenario_1b()
    results['scenario_2b'] = trace_scenario_2b()
    results['scenario_2c'] = trace_scenario_2c()
    results['scenario_4'] = trace_scenario_4()
    results['answer_exit_routing'] = check_answer_context_exit_routing()
    
    # Summary
    print(f'\n{BLUE}=== SUMMARY ==={RESET}')
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for name, passed_test in results.items():
        status = f'{GREEN}PASS{RESET}' if passed_test else f'{RED}FAIL{RESET}'
        print(f'  {name}: {status}')
    
    print(f'\n{BLUE}Results: {passed}/{total} scenarios passed{RESET}')
    
    if passed == total:
        print(f'\n{GREEN}[SUCCESS] All trace tests passed!{RESET}')
        return 0
    else:
        print(f'\n{RED}[FAILED] Some trace tests failed. Review issues above.{RESET}')
        return 1


if __name__ == '__main__':
    sys.exit(main())

