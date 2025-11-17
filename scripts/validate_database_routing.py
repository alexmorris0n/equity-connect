#!/usr/bin/env python3
"""
Database Routing Configuration Validator

Validates that all contexts have proper routing configuration in the database:
- valid_contexts arrays are set (not null/empty)
- tools arrays are populated with all tools mentioned in instructions
- Routing paths are valid (target contexts exist)
- Tools exist and are registered in the agent

This catches configuration bugs that swaig-test misses (it only validates SWML structure).
"""

import os
import sys
import json
from typing import Dict, List, Set, Optional

# Load environment variables from .env file (if exists)
try:
    from dotenv import load_dotenv  # type: ignore[reportMissingImports]
    load_dotenv()
except ImportError:
    # python-dotenv not installed, but environment variables might be set already
    pass
except Exception:
    # .env file may have issues, but environment variables might be set already
    pass

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from equity_connect.services.supabase import get_supabase_client

# Expected routing paths (from migration docs)
EXPECTED_ROUTING = {
    'greet': ['verify', 'exit', 'answer'],
    'verify': ['qualify', 'exit', 'answer'],
    'qualify': ['quote', 'exit', 'answer'],
    'quote': ['answer', 'book', 'exit'],
    'answer': ['objections', 'book', 'exit'],
    'objections': ['answer', 'book', 'exit'],
    'book': ['exit'],
    'exit': ['answer', 'greet'],
}

# All valid tools that exist in the agent
VALID_TOOLS = {
    'get_lead_context', 'verify_caller_identity', 'check_consent_dnc',
    'update_lead_info', 'find_broker_by_territory',
    'check_broker_availability', 'book_appointment', 'reschedule_appointment', 'cancel_appointment',
    'search_knowledge',
    'save_interaction', 'assign_tracking_number', 'send_appointment_confirmation', 'verify_appointment_confirmation',
    'mark_ready_to_book', 'mark_has_objection', 'mark_objection_handled', 'mark_questions_answered',
    'mark_quote_presented', 'mark_qualification_result', 'mark_wrong_person', 'clear_conversation_flags'
}

# All valid context names
VALID_CONTEXTS = set(EXPECTED_ROUTING.keys())


def extract_tools_from_text(text: str) -> Set[str]:
    """Extract tool names mentioned in prompt instructions"""
    tools_mentioned = set()
    text_lower = text.lower()
    
    for tool in VALID_TOOLS:
        # Check for tool name in various formats
        if tool in text_lower:
            tools_mentioned.add(tool)
        # Also check for mark_* functions
        if f'mark_{tool.split("_")[-1]}' in text_lower:
            # Handle cases like "mark_ready_to_book" vs "ready_to_book"
            base_name = tool.replace('mark_', '')
            if f'mark_{base_name}' in text_lower:
                tools_mentioned.add(f'mark_{base_name}')
    
    return tools_mentioned


def validate_context(context_name: str, content: Dict) -> Dict:
    """Validate a single context's configuration
    Returns dict with errors and fixes:
    {
        'errors': [...],
        'fixes': {
            'missing_tools': [...],
            'missing_valid_contexts': [...],
            'invalid_tools': [...],
            'invalid_targets': [...],
            'missing_step_criteria': bool,
            'skip_user_turn_issue': bool
        }
    }
    """
    errors = []
    fixes = {
        'missing_tools': [],
        'missing_valid_contexts': [],
        'invalid_tools': [],
        'invalid_targets': [],
        'missing_step_criteria': False,
        'skip_user_turn_issue': False
    }
    
    # Check valid_contexts
    valid_contexts = content.get('valid_contexts')
    if valid_contexts is None:
        errors.append("valid_contexts is NULL (routing won't work)")
        expected = EXPECTED_ROUTING.get(context_name, [])
        if expected:
            fixes['missing_valid_contexts'] = expected
            errors.append(f"ACTION REQUIRED: Set valid_contexts to: {expected}")
    elif not isinstance(valid_contexts, list) or len(valid_contexts) == 0:
        errors.append("valid_contexts is empty (can't route anywhere)")
        expected = EXPECTED_ROUTING.get(context_name, [])
        if expected:
            fixes['missing_valid_contexts'] = expected
            errors.append(f"ACTION REQUIRED: Set valid_contexts to: {expected}")
    else:
        # Validate routing targets exist
        expected = set(EXPECTED_ROUTING.get(context_name, []))
        actual = set(valid_contexts)
        
        # Check if all valid contexts exist
        invalid_targets = actual - VALID_CONTEXTS
        if invalid_targets:
            fixes['invalid_targets'] = list(invalid_targets)
            errors.append(f"valid_contexts contains invalid targets: {invalid_targets} - Remove these")
        
        # Check for missing expected routes
        missing_expected = expected - actual
        if missing_expected:
            fixes['missing_valid_contexts'] = list(missing_expected)
            errors.append(f"Missing expected routes: {missing_expected} - Add these to valid_contexts")
        
        # Warn if has unexpected (might be intentional)
        unexpected = actual - expected
        if unexpected:
            print(f"[WARN] {context_name}: Has unexpected routes: {unexpected} (may be intentional)")
    
    # Check tools
    tools = content.get('tools', [])
    if not isinstance(tools, list):
        errors.append("tools is not an array")
        fixes['missing_tools'] = []  # Can't auto-fix if not an array
    elif len(tools) == 0:
        errors.append("tools array is empty (LLM has no tools available)")
    else:
        # Check if tools exist
        invalid_tools = set(tools) - VALID_TOOLS
        if invalid_tools:
            fixes['invalid_tools'] = list(invalid_tools)
            errors.append(f"tools contains invalid tools: {invalid_tools} - Remove these")
    
    # Check if tools mentioned in instructions are in tools array
    instructions = content.get('instructions', '')
    if instructions:
        tools_mentioned = extract_tools_from_text(instructions)
        tools_array = set(content.get('tools', []))
        missing_tools = tools_mentioned - tools_array
        if missing_tools:
            fixes['missing_tools'] = list(missing_tools)
            errors.append(f"Instructions mention tools not in tools array: {missing_tools} - ADD THESE TOOLS")
        
        # Check if instructions mention answering questions but answer not in valid_contexts
        # Skip this check for 'answer' context itself (doesn't need to route to itself)
        if context_name != 'answer':
            instructions_lower = instructions.lower()
            mentions_questions = any(phrase in instructions_lower for phrase in [
                'ask a question', 'asks a question', 'if they ask', 'when asked',
                'route to answer', 'route to the answer', 'answer context',
                'questions handling', 'handle questions', 'answering questions'
            ])
            if mentions_questions:
                valid_contexts_list = content.get('valid_contexts', [])
                if 'answer' not in valid_contexts_list:
                    fixes['missing_valid_contexts'] = list(set(fixes['missing_valid_contexts'] + ['answer']))
                    errors.append("Instructions mention answering questions but 'answer' not in valid_contexts - ADD 'answer' to valid_contexts")
    
    # Check step_criteria (CRITICAL: prevents call hangups after tool execution)
    # Skip check for 'default' context (it's just a routing context with 'none' criteria)
    if context_name != 'default':
        step_criteria = content.get('step_criteria')
        if step_criteria is None:
            fixes['missing_step_criteria'] = True
            errors.append("step_criteria is NULL (will default to generic 'User has responded appropriately' - may cause hangups after tools)")
            errors.append("ACTION REQUIRED: Set step_criteria to explicit continuation instruction")
        elif isinstance(step_criteria, str) and step_criteria.lower() == 'none':
            # 'none' is valid for routing contexts, but warn if it seems wrong
            print(f"[WARN] {context_name}: step_criteria is 'none' (valid for routing contexts only)")
        elif not isinstance(step_criteria, str) or len(step_criteria.strip()) < 20:
            fixes['missing_step_criteria'] = True
            errors.append(f"step_criteria is too short/generic: '{step_criteria}' - Set explicit continuation instructions")
    
    # Check skip_user_turn (CRITICAL: if true, context won't wait for user input)
    skip_user_turn = content.get('skip_user_turn')
    # Contexts that need user input should have skip_user_turn: false
    contexts_needing_user_input = ['exit', 'answer', 'greet', 'qualify', 'quote']
    if context_name in contexts_needing_user_input:
        if skip_user_turn is True:
            fixes['skip_user_turn_issue'] = True
            errors.append(f"skip_user_turn is TRUE but {context_name} needs user input - Set skip_user_turn to FALSE")
    
    return {
        'errors': errors,
        'fixes': fixes
    }


def validate_all_contexts(vertical: str = 'reverse_mortgage') -> Dict:
    """Validate all contexts for a vertical
    Returns:
    {
        'errors': {context_name: [error_messages]},
        'fixes': {context_name: {missing_tools: [...], missing_valid_contexts: [...]}}
    }
    """
    supabase = get_supabase_client()
    
    # Query all active prompts and versions
    response = supabase.table('prompts')\
        .select('*, prompt_versions!inner(*)') \
        .eq('vertical', vertical) \
        .eq('is_active', True) \
        .execute()
    
    if not response.data:
        print(f"[ERROR] No active prompts found for vertical: {vertical}")
        return {'errors': {}, 'fixes': {}}
    
    all_errors = {}
    all_fixes = {}
    
    print(f"\n[VALIDATING] Routing configuration for {vertical}...\n")
    
    for prompt in response.data:
        context_name = prompt['node_name']
        
        # Get active version
        active_version = next(
            (v for v in prompt['prompt_versions'] if v.get('is_active')),
            None
        )
        
        if not active_version:
            all_errors[context_name] = ["No active version found"]
            continue
        
        content = active_version.get('content', {})
        result = validate_context(context_name, content)
        
        if result['errors']:
            all_errors[context_name] = result['errors']
            all_fixes[context_name] = result['fixes']
    
    return {
        'errors': all_errors,
        'fixes': all_fixes
    }


def auto_fix_context(vertical: str, context_name: str, fixes: Dict) -> bool:
    """Auto-fix a context's configuration by applying fixes to the database
    Returns True if fixes were applied, False otherwise
    """
    supabase = get_supabase_client()
    
    # Get the prompt and active version
    response = supabase.table('prompts')\
        .select('id, prompt_versions!inner(*)') \
        .eq('vertical', vertical) \
        .eq('node_name', context_name) \
        .eq('is_active', True) \
        .execute()
    
    if not response.data or not response.data[0]:
        return False
    
    prompt = response.data[0]
    prompt_id = prompt['id']
    
    # Get active version
    active_version = next(
        (v for v in prompt['prompt_versions'] if v.get('is_active')),
        None
    )
    
    if not active_version:
        return False
    
    version_id = active_version['id']
    content = active_version.get('content', {})
    updated = False
    
    # Apply fixes
    if fixes.get('missing_tools'):
        current_tools = set(content.get('tools', []))
        new_tools = list(current_tools | set(fixes['missing_tools']))
        content['tools'] = new_tools
        updated = True
    
    if fixes.get('invalid_tools'):
        current_tools = set(content.get('tools', []))
        new_tools = list(current_tools - set(fixes['invalid_tools']))
        content['tools'] = new_tools
        updated = True
    
    if fixes.get('missing_valid_contexts'):
        current_contexts = set(content.get('valid_contexts', []))
        new_contexts = list(current_contexts | set(fixes['missing_valid_contexts']))
        content['valid_contexts'] = new_contexts
        updated = True
    
    if fixes.get('invalid_targets'):
        current_contexts = set(content.get('valid_contexts', []))
        new_contexts = list(current_contexts - set(fixes['invalid_targets']))
        content['valid_contexts'] = new_contexts
        updated = True
    
    # Auto-fix step_criteria if missing
    if fixes.get('missing_step_criteria'):
        # Set a default continuation instruction
        default_step_criteria = "After completing any scenario or tool, always provide a clear follow-up: acknowledge the action, ask if there is anything else, or route to answer context if they ask a question. Never end the call abruptly - always provide a next action."
        content['step_criteria'] = default_step_criteria
        updated = True
    
    # Auto-fix skip_user_turn if issue detected
    if fixes.get('skip_user_turn_issue'):
        content['skip_user_turn'] = False
        updated = True
    
    # Update database if changes were made
    if updated:
        supabase.table('prompt_versions')\
            .update({'content': content})\
            .eq('id', version_id)\
            .execute()
        return True
    
    return False


def auto_fix_all(vertical: str, fixes: Dict[str, Dict]) -> Dict[str, bool]:
    """Auto-fix all contexts for a vertical
    Returns dict mapping context_name -> success bool
    """
    results = {}
    for context_name, context_fixes in fixes.items():
        try:
            results[context_name] = auto_fix_context(vertical, context_name, context_fixes)
        except Exception as e:
            print(f"[ERROR] Failed to auto-fix {context_name}: {e}")
            results[context_name] = False
    return results


def main():
    """Main validation function"""
    vertical = sys.argv[1] if len(sys.argv) > 1 else 'reverse_mortgage'
    
    print("=" * 80)
    print("DATABASE ROUTING CONFIGURATION VALIDATOR")
    print("=" * 80)
    print(f"Validating: {vertical}")
    print(f"Expected routing paths: {len(EXPECTED_ROUTING)} contexts")
    print(f"Valid tools: {len(VALID_TOOLS)} tools")
    print("=" * 80)
    
    result = validate_all_contexts(vertical)
    errors = result['errors']
    fixes = result['fixes']
    
    print("\n" + "=" * 80)
    print("VALIDATION RESULTS")
    print("=" * 80)
    
    if not errors:
        print("[SUCCESS] All contexts configured correctly!")
        print("   - All valid_contexts arrays set")
        print("   - All tools arrays populated")
        print("   - All routing targets valid")
        # Return JSON for API consumption
        if '--json' in sys.argv:
            print("\n" + json.dumps({'success': True, 'errors': {}, 'fixes': {}}))
        return 0
    
    print(f"\n[ERROR] Found {sum(len(e) for e in errors.values())} configuration errors:\n")
    
    for context_name, context_errors in sorted(errors.items()):
        print(f"[{context_name.upper()}]:")
        for error in context_errors:
            print(f"   - {error}")
        
        # Show fixes for this context
        context_fixes = fixes.get(context_name, {})
        if context_fixes.get('missing_tools'):
            print(f"   -> AUTO-FIX: Add tools: {context_fixes['missing_tools']}")
        if context_fixes.get('missing_valid_contexts'):
            print(f"   -> AUTO-FIX: Add valid_contexts: {context_fixes['missing_valid_contexts']}")
        if context_fixes.get('invalid_tools'):
            print(f"   -> AUTO-FIX: Remove invalid tools: {context_fixes['invalid_tools']}")
        if context_fixes.get('invalid_targets'):
            print(f"   -> AUTO-FIX: Remove invalid targets: {context_fixes['invalid_targets']}")
        if context_fixes.get('missing_step_criteria'):
            print(f"   -> AUTO-FIX: Set step_criteria to explicit continuation instruction")
        if context_fixes.get('skip_user_turn_issue'):
            print(f"   -> AUTO-FIX: Set skip_user_turn to FALSE (needs user input)")
        print()
    
    print("=" * 80)
    print("\n[IMPACT] These errors will cause:")
    print("   - Calls to hang/disconnect (if valid_contexts is null or step_criteria missing)")
    print("   - Tools not available when LLM tries to use them")
    print("   - Routing failures (if targets don't exist)")
    print("   - Call hangups after tool execution (if step_criteria not set or skip_user_turn: true)")
    print("\n[FIX] Fix these in the database before deploying!\n")
    
    # Handle auto-fix if --auto-fix flag is provided
    if '--auto-fix' in sys.argv:
        print("\n" + "=" * 80)
        print("AUTO-FIXING ISSUES")
        print("=" * 80)
        
        fix_results = auto_fix_all(vertical, fixes)
        
        fixed_count = sum(1 for success in fix_results.values() if success)
        print(f"\n[RESULT] Fixed {fixed_count} out of {len(fix_results)} contexts")
        
        for context_name, success in fix_results.items():
            if success:
                print(f"   ✓ {context_name}: Fixed")
            else:
                print(f"   ✗ {context_name}: Failed to fix")
        
        # Re-validate after fixing
        if fixed_count > 0:
            print("\n[RE-VALIDATING] After auto-fix...")
            result_after = validate_all_contexts(vertical)
            errors_after = result_after['errors']
            
            if not errors_after:
                print("[SUCCESS] All issues fixed! Validation now passes.")
                if '--json' in sys.argv:
                    print("\n" + json.dumps({
                        'success': True,
                        'errors': {},
                        'fixes': {},
                        'auto_fixed': fix_results
                    }))
                return 0
            else:
                remaining_errors = sum(len(e) for e in errors_after.values())
                print(f"[WARNING] {remaining_errors} errors remain after auto-fix")
                if '--json' in sys.argv:
                    print("\n" + json.dumps({
                        'success': False,
                        'errors': errors_after,
                        'fixes': result_after['fixes'],
                        'auto_fixed': fix_results
                    }))
                return 1
        
        # Return JSON for API consumption
        if '--json' in sys.argv:
            print("\n" + json.dumps({
                'success': False,
                'errors': errors,
                'fixes': fixes,
                'auto_fixed': fix_results
            }))
        
        return 1 if fixed_count == 0 else 0
    
    # Return JSON for API consumption
    if '--json' in sys.argv:
        print("\n" + json.dumps({
            'success': False,
            'errors': errors,
            'fixes': fixes
        }))
    
    return 1


if __name__ == '__main__':
    sys.exit(main())

