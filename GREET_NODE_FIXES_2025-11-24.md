# GREET Node Fixes - Nov 24, 2025 ✅

## Changes Applied

### 1. ✅ Added "goodbye" to valid_contexts
**Before**: `["verify", "qualify", "answer", "quote", "objections", "book"]`
**After**: `["verify", "qualify", "answer", "quote", "objections", "book", "goodbye"]`

**Impact**: Enables wrong_person → GOODBYE routing

---

### 2. ✅ Added Explicit Wrong Person Routing

**Added to all 3 scenarios:**

**INBOUND KNOWN:**
```
6. If NO → "Oh, is [FirstName] available?"
   - If available: mark_wrong_person(right_person_available=true) → route to GOODBYE
   - If not: mark_wrong_person(right_person_available=false) → route to GOODBYE
```

**OUTBOUND KNOWN:**
```
6. If NO → "When is a good time to reach them?"
   - mark_wrong_person(right_person_available=false) → route to GOODBYE
```

**Impact**: Makes routing behavior explicit after wrong_person detection

---

### 3. ✅ Emphasized mark_greeted Tool Calls

**Changed from:**
```
7. Capture why they called → mark_greeted(reason_summary)
```

**To:**
```
7. ⚠️ Call mark_greeted(reason_summary="brief reason") BEFORE routing
```

**Impact**: 
- Visual emphasis (⚠️)
- Example format shown
- Explicit timing (BEFORE routing)
- Ensures tool gets called

---

## Stats

- **Instructions Length**: 1,560 chars (concise, payload-friendly)
- **No Bloat**: Removed redundant wording from previous version
- **Preserved**: CRITICAL TIMING section, STOP-WAIT instructions

---

## What This Fixes

### From Trace Analysis:

✅ **Scenario 8** (partial): Wrong person routing now explicit
✅ **Payload Size**: Kept concise (1,560 chars vs ~1,800 before)
✅ **Tool Calling**: mark_greeted emphasis should improve tool invocation

### Still Needs (code-level):
- Wrong person restart logic (requires handoff detection in code)
- Initial context determination (requires `_get_initial_context()` logic)

---

## Migration Applied

File: `supabase/migrations/20251124_fix_greet_node.sql`
Status: ✅ Applied successfully

---

## Next Node to Fix

**VERIFY** - Issues:
1. No ENTRY CHECK ❌ (scratch this - always verify for returning callers is OK)
2. LLM not calling tools despite instructions
3. Need more explicit "IMMEDIATELY after they provide X, call mark_X_verified()"

Ready to proceed with VERIFY?

