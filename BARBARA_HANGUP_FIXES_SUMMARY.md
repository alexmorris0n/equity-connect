# Barbara Hangup Issue - 24 Hour Fix Summary
**Date:** November 17, 2025  
**Issue:** Barbara (SignalWire AI Agent) keeps hanging up prematurely, especially after answering questions or asking "Any other questions?"

---

## Initial Problem

Barbara was hanging up immediately after:
1. Answering a question and asking "Any other questions?"
2. Asking for user's age/address during verification
3. Completing any tool call (especially `search_knowledge`)

The call would terminate without waiting for user response, going straight to exit language ("I want to respect your time... think it over") and then hanging up.

---

## Root Causes Identified

### 1. **Incorrect `SwaigFunctionResult` Usage**
- **Problem:** Tools were passing JSON strings directly to `SwaigFunctionResult()` constructor
- **Impact:** SignalWire SDK couldn't parse tool outputs, causing agent to hang up
- **Example:** `SwaigFunctionResult(json_string)` ❌

### 2. **Blocking I/O Operations Without Timeouts**
- **Problem:** Supabase queries and Nylas API calls were synchronous with no timeout protection
- **Impact:** Slow operations caused SignalWire to terminate calls after timeout
- **Affected Operations:** `search_knowledge`, `configure_per_call`, calendar/lead services

### 3. **Premature Routing in ANSWER Context**
- **Problem:** `step_criteria` was being evaluated immediately after Barbara finished speaking, before user responded
- **Impact:** Agent routed to EXIT context without waiting for user's answer to "Any other questions?"
- **Root Cause:** SignalWire SDK evaluates `step_criteria` after each turn, and LLM was marking step complete too early

### 4. **`skip_user_turn` Boolean Conversion Bug**
- **Problem:** Database stored `skip_user_turn` as string `"false"`, but Python `bool("false")` = `True`
- **Impact:** Agent skipped waiting for user input even when it should wait
- **Location:** Both `barbara_agent.py` and `contexts_builder.py`

### 5. **VERIFY Context Asking for Pre-Loaded Data**
- **Problem:** Instructions didn't explicitly tell Barbara to USE pre-loaded age/address data
- **Impact:** Barbara asked for information she already had, then hung up after receiving it
- **Missing:** Age wasn't even listed in pre-loaded data section

### 6. **`update_lead_info` Tool Bug**
- **Problem:** Tool was called with name instead of `lead_id`, causing database errors
- **Impact:** Tool failures may have contributed to routing issues

---

## Fixes Applied

### ✅ Fix #1: Corrected `SwaigFunctionResult` Usage
**Files Modified:**
- `equity_connect/agent/barbara_agent.py` (all 22 tools)

**Changes:**
```python
# Before (WRONG):
result_json = json.dumps({...})
swaig_result = SwaigFunctionResult(result_json)
return swaig_result

# After (CORRECT):
result_data = json.loads(result_json)
swaig_result = SwaigFunctionResult()
swaig_result.data = result_data  # Dict, not JSON string
swaig_result.response = result_data.get("message", "")
return swaig_result
```

**Status:** ✅ Fixed - All tools now correctly set `.data` and `.response` attributes

---

### ✅ Fix #2: Added Timeout Protection to Blocking Operations
**Files Modified:**
- `equity_connect/agent/barbara_agent.py`

**Changes:**
- Added `_execute_with_timeout()` helper using `ThreadPoolExecutor`
- Applied timeouts to:
  - `search_knowledge`: 8 seconds
  - `verify_caller_identity`: 5 seconds
  - `check_broker_availability`: 6 seconds
  - `book_appointment`: 8 seconds
  - `_query_lead_direct`: 5 seconds (with fallback)
  - `build_contexts_object`: 10 seconds (with fallback)

**Status:** ✅ Fixed - All blocking operations now have timeout protection

---

### ✅ Fix #3: Fixed `skip_user_turn` Boolean Conversion
**Files Modified:**
- `equity_connect/agent/barbara_agent.py` (line ~720)
- `equity_connect/services/contexts_builder.py` (line ~225)

**Changes:**
```python
# Before (WRONG):
skip_user_turn = bool(step_cfg.get("skip_user_turn", False))
# bool("false") = True ❌

# After (CORRECT):
skip_user_turn_raw = step_cfg.get("skip_user_turn", False)
if isinstance(skip_user_turn_raw, str):
    skip_user_turn = skip_user_turn_raw.lower() in ('true', '1', 'yes')
else:
    skip_user_turn = bool(skip_user_turn_raw)
```

**Status:** ✅ Fixed - String "false" now correctly converts to boolean `False`

---

### ✅ Fix #4: Updated ANSWER Context `step_criteria`
**Database Changes:**
- Updated `prompt_versions.content->>'step_criteria'` for ANSWER context

**Changes:**
- Added explicit "CRITICAL RULE" requiring user to EXPLICITLY SPEAK before completion
- Added 3-step process: STOP → WAIT → THEN evaluate
- Added "ABSOLUTE RULE" prohibiting routing immediately after speaking
- Added "EXPLICIT PROHIBITION" against routing to exit unless user says "no"/"that's all"
- Clarified that silence, hesitation, or ambiguous responses mean STAY in answer context

**Status:** ✅ Updated in database - Still testing effectiveness

---

### ✅ Fix #5: Updated ANSWER Context Instructions
**Database Changes:**
- Updated `prompt_versions.content->>'instructions'` for ANSWER context

**Changes:**
- Added explicit "#Step Criteria" section matching context-level criteria
- Updated "Completion Criteria" to require user response before completion
- Clarified `mark_questions_answered` should only be called AFTER user confirms
- Added "ABSOLUTE RULE" in instructions section

**Status:** ✅ Updated in database - Aligned with step_criteria

---

### ✅ Fix #6: Updated VERIFY Context
**Database Changes:**
- Updated `prompt_versions.content->>'step_criteria'` for VERIFY context
- Updated `prompt_versions.content->>'instructions'` for VERIFY context

**Changes:**
- Added age to pre-loaded data section: `- Age: $lead_age (if available)`
- Changed section title to "Pre-Loaded Data (Use This - DO NOT Ask For It)"
- Added explicit instruction: "**CRITICAL: This information is already in the system. Use it to confirm/verify, NOT to ask for it.**"
- Updated step 4: "**DO NOT ask 'what's your address?' - you already have it. Just confirm it.**"
- Updated step 5: "**If age is in pre-loaded data ($lead_age), you already have it - don't ask for it.**"
- Added explicit wait instructions in step_criteria

**Status:** ✅ Updated in database

---

### ✅ Fix #7: Fixed `update_lead_info` Tool
**Files Modified:**
- `equity_connect/agent/barbara_agent.py` (line ~1384)

**Changes:**
- Added logic to get `lead_id` from `raw_data` (global_data) if not in args
- Falls back to looking up lead by phone if `lead_id` still not available
- Prevents "invalid input syntax for type uuid" errors

**Status:** ✅ Fixed

---

### ✅ Fix #8: Reordered ANSWER Context `valid_contexts`
**Database Changes:**
- Updated `prompt_versions.content->>'valid_contexts'` for ANSWER context

**Changes:**
- Before: `["book", "exit", "greet", "objections", "answer"]`
- After: `["answer", "book", "objections", "greet", "exit"]`
- Put `answer` first (default stay) and `exit` last (explicit choice only)

**Status:** ✅ Updated in database - May help with default routing behavior

---

### ✅ Fix #9: Changed `transparent_barge` Default
**Files Modified:**
- `equity_connect/services/agent_config.py`
- `database/migrations/20251114_add_agent_params.sql`

**Changes:**
- Changed default from `True` to `False`
- Agent now stops speaking immediately when interrupted

**Status:** ✅ Fixed - Not directly related to hangup issue but improves UX

---

---

### ✅ Fix #10: CRITICAL Indentation Bug - Root Cause of Racing Behavior ⭐
**Date:** November 18, 2025  
**Files Modified:**
- `equity_connect/agent/barbara_agent.py` (lines 683-735)

**Problem:**
The `_apply_contexts_via_builder()` method had a catastrophic indentation error. The entire step processing block (lines 699-735) was indented OUTSIDE the context loop (line 683), causing it to only configure steps for the LAST context (exit) using the final iteration's variables.

**What Happened:**
```python
# BEFORE (WRONG):
for ctx_name, ctx_config in contexts_data.items():  # Line 683
    context = contexts_builder.add_context(ctx_name)
    # ... context properties ...
# Lines 699-735 were HERE (outside loop) ❌

# This meant:
# - Loop created 8 contexts: greet, verify, qualify, quote, answer, objections, book, exit
# - After loop ended, ctx_config = exit's config, context = exit context
# - Step configuration only applied to EXIT
```

**Result:**
- **greet:** No steps configured (empty)
- **verify:** No steps configured (empty)
- **qualify:** No steps configured (empty)
- **quote:** No steps configured (empty)
- **answer:** No steps configured (empty) ← **THIS CAUSED THE RACING!**
- **objections:** No steps configured (empty)
- **book:** No steps configured (empty)
- **exit:** ✅ Steps configured (last iteration)

**Impact:**
When Barbara entered ANSWER context:
1. No steps configured → nothing to evaluate
2. SignalWire treated empty context as immediately complete
3. Routed to EXIT (only context with configuration)
4. Spoke exit language: "I want to respect your time..."
5. Hung up

**This explains the exact "racing through all steps to exit" behavior!**

**Fix:**
```python
# AFTER (CORRECT):
for ctx_name, ctx_config in contexts_data.items():  # Line 683
    context = contexts_builder.add_context(ctx_name)
    # ... context properties ...
    
    # Lines 699-735 now INSIDE loop ✅
    for idx, step_cfg in enumerate(ctx_config.get("steps", [])):
        step = context.add_step(step_name)
        step.set_text(step_cfg["text"])
        step.set_step_criteria(step_cfg["step_criteria"])
        # ... all step configuration ...
```

**Status:** ✅ **CRITICAL FIX** - All 8 contexts now properly configured with steps

---

### ✅ Fix #11: Unreachable Code in `_ensure_skill`
**Date:** November 18, 2025  
**Files Modified:**
- `equity_connect/agent/barbara_agent.py` (line 1010)

**Problem:**
Line 1010 `agent_obj.add_skill(skill_name)` was unreachable due to incorrect indentation after a `return` statement.

**Before:**
```python
if hasattr(agent_obj, "has_skill") and agent_obj.has_skill(skill_name):
    logger.debug(f"Skill already loaded, skipping")
    return
    agent_obj.add_skill(skill_name)  # ❌ UNREACHABLE
```

**After:**
```python
if hasattr(agent_obj, "has_skill") and agent_obj.has_skill(skill_name):
    logger.debug(f"Skill already loaded, skipping")
    return
agent_obj.add_skill(skill_name)  # ✅ Now executes when skill not present
```

**Impact:**
- Skills like `datetime` and `math` were never actually added
- Barbara couldn't do date calculations for scheduling
- Barbara couldn't do math for quote estimates (50-60% rule)

**Status:** ✅ Fixed - Skills now properly added

---

### ✅ Fix #12: Updated All `step_criteria` to Short, Objective Format
**Date:** November 18, 2025  
**Database Changes:**
- Updated `prompt_versions.content->>'step_criteria'` for ALL 8 contexts

**Problem:**
- `step_criteria` were long instructional texts (1,423 characters for ANSWER)
- Official SignalWire pattern uses short, objective statements (20-50 characters)
- Long instructional criteria confused SignalWire's evaluator

**Changes:**

| Context | Before (Length) | After (Length) | New Criteria |
|---------|-----------------|----------------|--------------|
| answer | 1,423 chars | 55 chars | `User said no more questions or explicitly ready to book` |
| verify | 1,274 chars | 52 chars | `Caller identity confirmed and correct person on line` |
| greet | 124 chars | 52 chars | `User stated reason for calling or confirmed identity` |
| qualify | 373 chars | 41 chars | `User answered all qualification questions` |
| quote | 412 chars | 51 chars | `Quote presented and user acknowledged understanding` |
| objections | 417 chars | 51 chars | `Objection resolved and user expressed understanding` |
| book | 554 chars | 43 chars | `Appointment scheduled and confirmed by user` |
| exit | 610 chars | 47 chars | `Farewell exchanged or caller ended conversation` |

**Pattern (from official SignalWire docs and Holy Guacamole example):**
- Short (20-60 characters)
- Objective (factual condition)
- Simple (past tense statement)
- Verifiable (can check from conversation history)

**Status:** ✅ All 8 contexts updated - Matches official pattern

---

## Current Status

### ✅ Resolved Issues:
1. `SwaigFunctionResult` usage - All tools fixed
2. Timeout protection - All blocking operations protected
3. `skip_user_turn` boolean conversion - Fixed
4. `update_lead_info` tool bug - Fixed
5. VERIFY context asking for pre-loaded data - Fixed
6. `transparent_barge` default - Changed to False
7. **⭐ CRITICAL: Indentation bug - All contexts now properly configured**
8. **Unreachable code in `_ensure_skill` - Skills now properly added**
9. **All `step_criteria` updated to short, objective format - Matches official pattern**

### 🧪 Ready for Testing:
The combination of Fix #10 (indentation), Fix #11 (skills), and Fix #12 (short criteria) should completely resolve the racing/premature routing issue.

---

## Root Cause Analysis

The racing behavior was caused by **THREE compounding bugs**:

1. **Indentation bug (Fix #10)** - Only EXIT context had steps configured; all others were empty
2. **Long `step_criteria` (Fix #12)** - Instructional text instead of objective conditions
3. **Skills not added (Fix #11)** - Missing datetime/math capabilities

**The Perfect Storm:**
- ANSWER context was empty (no steps) due to indentation bug
- SignalWire saw empty context → treated as complete → routed immediately
- EXIT was the only configured context → Barbara went there
- Spoke exit language and hung up

**All three bugs are now fixed.**

---

## Code References

- **Agent Implementation:** `equity_connect/agent/barbara_agent.py`
- **Context Builder:** `equity_connect/services/contexts_builder.py`
- **Database Prompts:** `prompts` table → `prompt_versions` table → `content` JSONB field
- **Active Context:** ANSWER context (`node_name = 'answer'`, `vertical = 'reverse_mortgage'`)

---

## Next Steps

1. **Await SignalWire Support Response** on SDK behavior regarding `step_criteria` evaluation timing
2. **Consider Alternative Approaches:**
   - Remove `exit` from `valid_contexts` temporarily to test if that's causing default routing
   - Add explicit routing instructions in `step_criteria` that default to staying in answer context
   - Check if there's a SignalWire setting to require user input before evaluating completion

---

**Summary:** We've fixed all code-level bugs (tool return values, timeouts, boolean conversion), but the core issue appears to be SignalWire SDK evaluating `step_criteria` too early, before the user responds. We need clarification from SignalWire on how `step_criteria` evaluation timing works and if there's a way to force waiting for user input.

