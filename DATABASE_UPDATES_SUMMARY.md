# Database Updates - Function Call Instructions

## Summary

Updated all node instructions in the database to include **explicit function calls** and **LiveKit-style conversation state flags**.

## Key Changes

### 1. **QUOTE Node (CRITICAL FIX)**
**Problem:** Used `calculate("{property_value} - {mortgage_balance}")` - treating it like a math expression
**Fix:** Now explicitly instructs: `calculate_reverse_mortgage(property_value={value}, age={age}, equity={equity})`
**Tools array:** Updated from `["calculate", ...]` to `["calculate_reverse_mortgage", ...]`

### 2. **ANSWER Node**
**Problem:** Referenced non-existent `complete_questions` function
**Fix:** Removed reference, now uses natural context transitions and `mark_ready_to_book()`
**Tools array:** Updated from `["search_knowledge", "complete_questions"]` to `["search_knowledge", "mark_ready_to_book"]`

### 3. **GREET Node**
**Problem:** Referenced non-existent `route_to_answer_for_question` function
**Fix:** Removed reference, now relies on SignalWire's native context switching via `valid_contexts`

### 4. **GOODBYE Node**
**Problem:** Referenced non-existent `route_to_answer_for_question` function
**Fix:** Removed reference, now relies on natural context transitions
**Tools array:** Cleared to `[]` (no tools needed, just transitions)

## LiveKit-Style Flags Added

All instructions now explicitly mention the conversation state flags they should set:

- **GREET**: `conversation_data.greeted = true`
- **VERIFY**: `conversation_data.verified = true` (via `mark_verified()`)
- **QUALIFY**: `conversation_data.qualified = true/false` (via `mark_qualified()`)
- **QUOTE**: `conversation_data.quote_presented = true`, `quote_reaction = ...` (via `mark_quote_presented()`)
- **ANSWER**: `conversation_data.ready_to_book = true` (via `mark_ready_to_book()`)
- **OBJECTIONS**: `conversation_data.objections_handled = true` (via `mark_objection_handled()`)
- **BOOK**: `conversation_data.appointment_booked = true` (via `book_appointment()`)

## Critical Improvements

### Before
```
Calculate using the math skill:
- Equity: calculate("{property_value} - {mortgage_balance}")
```
❌ AI tries to parse as math expression, doesn't call function

### After
```
CRITICAL: Call the calculate_reverse_mortgage function:
- You MUST call: calculate_reverse_mortgage(property_value={property_value}, age={age}, equity={equity})
- DO NOT do the math yourself - always use this function
- Wait for the function result before speaking
```
✅ AI knows to call the function explicitly

## Testing Impact

**Before these changes:**
- AI stayed in GREET context entire call
- AI never called any functions (calculate, search_knowledge, etc.)
- AI answered from GPT-4o's training data (hallucination risk)

**Expected after these changes:**
- AI will call `calculate_reverse_mortgage()` when presenting quotes
- AI will call `search_knowledge()` for policy questions
- AI will call `mark_*()` functions to set conversation state flags
- Context transitions will work based on flags and `valid_contexts`

## Next Steps

1. Deploy to Fly.io via GitHub Actions
2. Test call with quote request → Should see function call in logs
3. Test call with policy question → Should see `search_knowledge()` call
4. Monitor debug webhook for real-time function execution

## Files Modified

- **Database Tables:**
  - `prompt_versions.content.instructions` (all 9 nodes)
  - `prompt_versions.content.tools` (quote, answer, goodbye nodes)

- **Code (No changes needed):**
  - `swaig-agent/services/contexts.py` already has `FUNCTION_NAME_MAP` to handle legacy names
  - No Python code changes required

