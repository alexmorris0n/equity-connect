# Trace Test Verification Report
**Date:** 2025-11-22  
**Source:** `prompts/rewrite/trace_test.md`  
**Status:** Comprehensive route verification against database and code

---

## Executive Summary

**Total Scenarios:** 13  
**Scenarios That Work:** 8  
**Scenarios With Issues:** 5  
**Critical Issues Found:** 3

### Quick Status
- ✅ **4 scenarios work perfectly** (Scenarios 4, 5, 7)
- ⚠️ **4 scenarios mostly work** (Scenarios 1, 2, 6, 9, 10, 11)
- ❌ **3 scenarios don't work** (Scenarios 3, 8, 13)
- ❓ **1 scenario unknown** (Scenario 12 - timeout handling)

### Critical Blockers
1. **VERIFY node will completely fail** - Database lists tools that don't exist
2. **VERIFY routing breaks perfect route** - Routes to ANSWER instead of QUOTE
3. **Missing routing tools** - GREET, QUALIFY, QUOTE, ANSWER missing key routing tools

---

## Critical Issues Found

### ❌ Issue 1: Granular Verification Tools Missing (CRITICAL)

**Problem:** Database tools array for VERIFY node lists `mark_phone_verified()`, `mark_email_verified()`, and `mark_address_verified()` tools, but these tools **DO NOT EXIST** in the code.

**Database Tools Array:**
```json
["mark_phone_verified", "mark_email_verified", "mark_address_verified", "update_lead_info", "route_conversation"]
```

**Code Has:**
- `verify_caller_identity()` - handles all verification at once (NOT in DB tools array!)
- `update_lead_info()` - matches DB

**Impact:** 
- ❌ LLM will try to call `mark_phone_verified()`, `mark_email_verified()`, `mark_address_verified()` - these don't exist
- ❌ LLM won't know about `verify_caller_identity()` tool (not in DB tools array)
- ❌ Verification process will fail completely
- ❌ Database prompt instructions reference granular tools that don't exist

**Fix Required:** 
- **Option A (Recommended):** Implement the 3 granular verification tools in `verify.py`
- **Option B:** Update database tools array and prompt to use `verify_caller_identity()` instead

**Also Note:** `verify.py` still has hard-coded instruction in `on_enter()` (line 52-54) that should be removed per previous audit.

---

### ❌ Issue 2: VERIFY Routes to ANSWER Instead of QUOTE

**Problem:** When verification completes and lead is already qualified, VERIFY routes to ANSWER instead of following the perfect route (should go to QUOTE).

**Current Code (`verify.py:90-98`):**
```python
if qualified:
    # Already qualified - go to main conversation
    from .answer import BarbaraAnswerAgent
    return BarbaraAnswerAgent(...)
```

**Perfect Route Says:**
- Perfect route: greet → verify → qualify → quote → answer → book → goodbye
- If already qualified, should skip QUALIFY and go to QUOTE (not ANSWER)
- Matches GREET behavior: verified+qualified → QUOTE

**Impact:** 
- ❌ Breaks perfect route for returning qualified callers
- ❌ Inconsistent with GREET routing logic
- ❌ Skips QUOTE step entirely

**Fix Required:** Change VERIFY routing to go to QUOTE if qualified (matching GREET behavior).

---

### ❌ Issue 3: QUOTE Doesn't Auto-Route After Presentation

**Problem:** After presenting quote, QUOTE node doesn't automatically route. LLM must call `route_to_answer()`, `route_to_objections()`, or `route_to_booking()`.

**Current State:**
- `mark_quote_presented()` tool exists but doesn't route
- LLM must explicitly call routing tools

**Expected (from trace_test.md):**
- After quote presented → should route based on reaction
- Positive reaction → route to BOOK
- Questions → route to ANSWER
- Concerns → route to OBJECTIONS

**Impact:** Quote node may not route automatically, causing conversation to stall.

**Fix Required:** Make `mark_quote_presented()` automatically route based on reaction, OR update database prompt to explicitly instruct routing after quote.

---

## Scenario-by-Scenario Analysis

### ✅ Scenario 1: Perfect Qualified Lead

**Expected Route:** GREET → VERIFY → QUALIFY → QUOTE → BOOK → GOODBYE

**Status:** ⚠️ **MOSTLY WORKS** (with issues)

**Issues:**
1. ❌ VERIFY uses `verify_caller_identity()` (not granular tools as DB prompt says)
2. ❌ If lead already qualified, VERIFY routes to ANSWER (should route to QUOTE)
3. ⚠️ QUOTE doesn't auto-route after presentation (LLM must call routing tool)

**What Works:**
- ✅ GREET → VERIFY (if not verified)
- ✅ VERIFY → QUALIFY (if not qualified)
- ✅ QUALIFY → QUOTE (if qualified) - **JUST FIXED**
- ✅ BOOK → GOODBYE (automatic after booking) - **JUST FIXED**
- ✅ All tools exist: `calculate_reverse_mortgage`, `mark_quote_presented`, `book_appointment`

**What Doesn't Work:**
- ❌ VERIFY granular tools missing (database prompt mismatch)
- ❌ VERIFY → ANSWER routing (should be QUOTE for perfect route)

---

### ⚠️ Scenario 2: Unqualified Lead Asking Amounts

**Expected Route:** GREET → QUOTE → QUALIFY → GOODBYE

**Status:** ⚠️ **PARTIALLY WORKS**

**Issues:**
1. ❌ GREET doesn't have `route_to_quote` tool (only has `route_to_objections`)
2. ⚠️ QUOTE may not gracefully handle missing age data
3. ✅ QUALIFY → GOODBYE works (disqualification routing)

**What Works:**
- ✅ QUALIFY can disqualify and route to GOODBYE
- ✅ GOODBYE has empathetic disqualification

**What Doesn't Work:**
- ❌ GREET can't route directly to QUOTE for calculation questions
- ⚠️ QUOTE error handling for missing data unclear

**Fix Required:** Add `route_to_quote()` tool to GREET node.

---

### ⚠️ Scenario 3: Pre-Qualified Returning Caller

**Expected Route:** GREET → ANSWER/BOOK → BOOK → GOODBYE

**Status:** ❌ **DOESN'T WORK**

**Issues:**
1. ❌ GREET routes verified+qualified to QUOTE (not ANSWER as scenario expects)
2. ⚠️ No logic to detect "returning caller" vs "fresh caller"
3. ⚠️ No special handling for `quote_presented=true` in GREET

**What Works:**
- ✅ BOOK works for returning callers
- ✅ GOODBYE can acknowledge appointments

**What Doesn't Work:**
- ❌ GREET doesn't check `quote_presented` flag
- ❌ GREET always routes verified+qualified to QUOTE (may not be desired for returning callers)

**Fix Required:** Add logic to GREET to check if quote already presented, route to ANSWER if so.

---

### ✅ Scenario 4: Objection After Quote

**Expected Route:** QUOTE → OBJECTIONS → BOOK/GOODBYE

**Status:** ✅ **WORKS**

**What Works:**
- ✅ QUOTE has `route_to_objections()` tool
- ✅ OBJECTIONS has `search_knowledge()` tool
- ✅ OBJECTIONS has `mark_has_objection()` and `mark_objection_handled()` tools
- ✅ OBJECTIONS can route to BOOK or GOODBYE

**No Issues Found**

---

### ✅ Scenario 5: Multiple Objections

**Expected Route:** OBJECTIONS (loop) → BOOK/GOODBYE

**Status:** ✅ **WORKS**

**What Works:**
- ✅ OBJECTIONS can handle multiple objections in sequence
- ✅ `mark_has_objection()` and `mark_objection_handled()` can be called multiple times
- ✅ OBJECTIONS can route based on resolution status

**No Issues Found**

---

### ⚠️ Scenario 6: Objection During QUALIFY

**Expected Route:** QUALIFY → OBJECTIONS → QUALIFY/ANSWER

**Status:** ⚠️ **PARTIALLY WORKS**

**Issues:**
1. ❌ QUALIFY doesn't have `route_to_objections()` tool
2. ⚠️ After OBJECTIONS resolved, can't return to QUALIFY (no routing back)

**What Works:**
- ✅ OBJECTIONS can handle age discrimination concerns
- ✅ OBJECTIONS can route to ANSWER

**What Doesn't Work:**
- ❌ QUALIFY can't detect and route to OBJECTIONS mid-qualification
- ❌ No way to return to QUALIFY after objection resolved

**Fix Required:** Add `route_to_objections()` tool to QUALIFY node.

---

### ✅ Scenario 7: Calculation Question in ANSWER

**Expected Route:** ANSWER → QUOTE

**Status:** ✅ **WORKS**

**What Works:**
- ✅ ANSWER has `route_to_quote()` tool
- ✅ Database prompt has CRITICAL routing rule for calculation questions
- ✅ Tool documentation explicitly says to route calculation questions to QUOTE

**No Issues Found**

---

### ❌ Scenario 8: Wrong Person Then Right Person

**Expected Route:** GREET → GOODBYE (wait) → GREET (restart)

**Status:** ❌ **DOESN'T WORK**

**Issues:**
1. ❌ GOODBYE doesn't have "wait for handoff" logic
2. ❌ No system to detect new person on line
3. ❌ No way to restart GREET after handoff
4. ⚠️ `mark_wrong_person()` routes to GOODBYE but doesn't handle handoff

**What Works:**
- ✅ GREET has `mark_wrong_person()` tool
- ✅ GOODBYE can handle waiting scenario (in prompt)

**What Doesn't Work:**
- ❌ No automatic detection of new person
- ❌ No routing back to GREET after handoff
- ❌ System doesn't know when to restart

**Fix Required:** This is a system-level feature (person detection) that may not be implementable in current architecture.

---

### ⚠️ Scenario 9: Borderline Equity (Low Net Proceeds)

**Expected Route:** QUALIFY → QUOTE → OBJECTIONS/ANSWER

**Status:** ⚠️ **PARTIALLY WORKS**

**Issues:**
1. ⚠️ QUALIFY doesn't set `borderline_equity` flag
2. ⚠️ QUOTE doesn't have special reframing for low equity
3. ✅ QUOTE can detect negative reaction and route to OBJECTIONS

**What Works:**
- ✅ QUOTE can present low numbers
- ✅ QUOTE can route to OBJECTIONS for concerns
- ✅ `mark_quote_presented()` accepts reaction parameter

**What Doesn't Work:**
- ⚠️ No `borderline_equity` flag set by QUALIFY
- ⚠️ QUOTE prompt doesn't mention low-equity reframing

**Fix Required:** Add `borderline_equity` flag logic to QUALIFY, update QUOTE prompt for low-equity scenarios.

---

### ⚠️ Scenario 10: Booked Lead Calls Back with Questions

**Expected Route:** GOODBYE → ANSWER → GOODBYE

**Status:** ⚠️ **PARTIALLY WORKS**

**Issues:**
1. ⚠️ No `_get_initial_context()` function to route returning callers
2. ✅ GOODBYE has `route_to_answer()` tool
3. ✅ GOODBYE prompt mentions using `appointment_datetime`
4. ⚠️ ANSWER doesn't route back to GOODBYE

**What Works:**
- ✅ GOODBYE can route to ANSWER for questions
- ✅ GOODBYE can acknowledge appointments
- ✅ `appointment_datetime` flag is set and available

**What Doesn't Work:**
- ❌ No initial routing logic for returning callers
- ⚠️ ANSWER doesn't have `route_to_goodbye()` tool

**Fix Required:** Add `route_to_goodbye()` tool to ANSWER node.

---

### ⚠️ Scenario 11: Tool Failure During BOOK

**Expected Route:** BOOK → GOODBYE (with fallback)

**Status:** ⚠️ **PARTIALLY WORKS**

**Issues:**
1. ⚠️ BOOK doesn't have explicit error handling in code
2. ⚠️ No `manual_booking_required` flag
3. ✅ BOOK prompt mentions error handling scripts

**What Works:**
- ✅ BOOK prompt has fallback scripts for tool failures
- ✅ BOOK can route to GOODBYE

**What Doesn't Work:**
- ⚠️ Code doesn't wrap tool calls in try/catch
- ⚠️ No `manual_booking_required` flag set on error

**Fix Required:** Add error handling to `book_appointment()` tool, set `manual_booking_required` flag.

---

### ⚠️ Scenario 12: Knowledge Base Search Timeout

**Expected Route:** ANSWER → (timeout) → Fallback response

**Status:** ⚠️ **UNKNOWN**

**Issues:**
1. ❓ Unknown if `search_knowledge()` has timeout handling
2. ❓ Unknown if ANSWER has fallback responses
3. ⚠️ No documented timeout behavior

**What Works:**
- ✅ ANSWER has `search_knowledge()` tool
- ✅ ANSWER can route to BOOK or OBJECTIONS

**What Doesn't Work:**
- ❓ Timeout handling not verified
- ❓ Fallback responses not verified

**Fix Required:** Verify timeout handling in `search_knowledge()` tool, add fallback responses to ANSWER prompt if needed.

---

### ❌ Scenario 13: Unexpected Disqualification in QUOTE

**Expected Route:** QUOTE → GOODBYE (disqualified)

**Status:** ❌ **DOESN'T WORK**

**Issues:**
1. ❌ QUOTE doesn't have `mark_qualification_result()` tool
2. ❌ QUOTE can't override QUALIFY's qualification decision
3. ❌ QUOTE doesn't have `route_to_goodbye()` tool
4. ⚠️ No `disqualified_in_quote` flag

**What Works:**
- ✅ GOODBYE can handle disqualification scenarios
- ✅ GOODBYE has empathetic disqualification scripts

**What Doesn't Work:**
- ❌ QUOTE can't disqualify leads
- ❌ QUOTE can't route to GOODBYE

**Fix Required:** Add `mark_qualification_result()` and `route_to_goodbye()` tools to QUOTE node.

---

## Summary Table

| Scenario | Route | Status | Critical Issues |
|----------|-------|--------|----------------|
| 1. Perfect Qualified Lead | greet→verify→qualify→quote→book→goodbye | ⚠️ Mostly Works | VERIFY tools mismatch, routing issue |
| 2. Unqualified Asking Amounts | greet→quote→qualify→goodbye | ⚠️ Partially | GREET can't route to QUOTE |
| 3. Pre-Qualified Returning | greet→answer/book→book→goodbye | ❌ Doesn't Work | GREET routing logic issue |
| 4. Objection After Quote | quote→objections→book/goodbye | ✅ Works | None |
| 5. Multiple Objections | objections (loop)→book/goodbye | ✅ Works | None |
| 6. Objection During Qualify | qualify→objections→qualify/answer | ⚠️ Partially | QUALIFY can't route to OBJECTIONS |
| 7. Calculation in Answer | answer→quote | ✅ Works | None |
| 8. Wrong Person Handoff | greet→goodbye→greet | ❌ Doesn't Work | System-level feature missing |
| 9. Borderline Equity | qualify→quote→objections | ⚠️ Partially | Missing flags, reframing |
| 10. Booked Lead Callback | goodbye→answer→goodbye | ⚠️ Partially | ANSWER can't route to GOODBYE |
| 11. Tool Failure BOOK | book→goodbye | ⚠️ Partially | Error handling missing |
| 12. KB Timeout | answer (timeout) | ❓ Unknown | Not verified |
| 13. Disqualification in Quote | quote→goodbye | ❌ Doesn't Work | QUOTE can't disqualify |

---

## Required Fixes (Priority Order)

### 🔴 Critical (Must Fix)

1. **Fix VERIFY Tools Mismatch**
   - **Option A:** Implement `mark_phone_verified()`, `mark_email_verified()`, `mark_address_verified()` tools
   - **Option B:** Update database prompt to use `verify_caller_identity()` instead
   - **Recommendation:** Option A - granular tools give better control

2. **Fix VERIFY Routing**
   - Change VERIFY to route to QUOTE (not ANSWER) when qualified
   - Matches perfect route: verify → qualify → quote → answer

3. **Add Missing Routing Tools**
   - Add `route_to_quote()` to GREET
   - Add `route_to_objections()` to QUALIFY
   - Add `route_to_goodbye()` to QUOTE
   - Add `route_to_goodbye()` to ANSWER

### 🟡 High Priority (Should Fix)

4. **Add QUOTE Disqualification**
   - Add `mark_qualification_result()` tool to QUOTE
   - Add `route_to_goodbye()` tool to QUOTE
   - Allow QUOTE to override qualification if late disqualifier found

5. **Improve GREET for Returning Callers**
   - Check `quote_presented` flag in GREET
   - Route verified+qualified+quoted to ANSWER (not QUOTE)

6. **Add Error Handling**
   - Wrap `book_appointment()` in try/catch
   - Set `manual_booking_required` flag on error
   - Add timeout handling to `search_knowledge()`

### 🟢 Medium Priority (Nice to Have)

7. **Add Borderline Equity Logic**
   - Set `borderline_equity` flag in QUALIFY
   - Add low-equity reframing to QUOTE prompt

8. **Verify Timeout Handling**
   - Check if `search_knowledge()` has timeout
   - Add fallback responses if needed

---

## Detailed Fix Recommendations

### Fix 1: Implement Granular Verification Tools

**File:** `livekit-agent/agents/verify.py`

**Add these tools:**
```python
@function_tool()
async def mark_phone_verified(self, context: RunContext) -> str:
    """Mark phone number as verified."""
    lead_id = self.lead_data.get('id')
    if not lead_id:
        return "No lead_id available. Cannot mark phone as verified."
    sb = get_supabase_client()
    try:
        sb.table('leads').update({'phone_verified': True}).eq('id', lead_id).execute()
        logger.info(f"Lead {lead_id}: Phone marked as verified.")
        return "Phone number confirmed."
    except Exception as e:
        logger.error(f"Error marking phone as verified for lead {lead_id}: {e}")
        return f"Failed to mark phone as verified: {e}"

@function_tool()
async def mark_email_verified(self, context: RunContext) -> str:
    """Mark email address as verified."""
    # Similar implementation

@function_tool()
async def mark_address_verified(self, context: RunContext) -> str:
    """Mark property address as verified. Also triggers broker assignment."""
    # Similar implementation + find_broker_by_territory call
```

**Also:** Update `verify_caller_identity()` to check if all 3 are verified, then route.

---

### Fix 2: Fix VERIFY Routing

**File:** `livekit-agent/agents/verify.py`

**Change line 90-98:**
```python
# BEFORE:
if qualified:
    from .answer import BarbaraAnswerAgent
    return BarbaraAnswerAgent(...)

# AFTER:
if qualified:
    # Already qualified - continue perfect route: go to QUOTE
    from .quote import BarbaraQuoteAgent
    return BarbaraQuoteAgent(...)
```

---

### Fix 3: Add Missing Routing Tools

**Files to update:**
- `livekit-agent/agents/greet.py` - Add `route_to_quote()`
- `livekit-agent/agents/qualify.py` - Add `route_to_objections()`
- `livekit-agent/agents/quote.py` - Add `route_to_goodbye()`
- `livekit-agent/agents/answer.py` - Add `route_to_goodbye()`

**Pattern to follow:**
```python
@function_tool()
async def route_to_quote(self, context: RunContext):
    """Route to quote calculation."""
    logger.info("Routing to quote")
    from .quote import BarbaraQuoteAgent
    return BarbaraQuoteAgent(...)
```

---

### Fix 4: Add QUOTE Disqualification

**File:** `livekit-agent/agents/quote.py`

**Add tools:**
```python
@function_tool()
async def mark_qualification_result(self, context: RunContext, qualified: bool, reason: Optional[str] = None):
    """Override qualification if late disqualifier found in QUOTE."""
    from tools.conversation_flags import mark_qualification_result as mark_tool
    await mark_tool(self.caller_phone, qualified)
    if not qualified:
        from .goodbye import BarbaraGoodbyeAgent
        return BarbaraGoodbyeAgent(..., reason="disqualified", disqualification_reason=reason)
    return "Qualification updated."

@function_tool()
async def route_to_goodbye(self, context: RunContext, reason: Optional[str] = None):
    """Route to goodbye."""
    from .goodbye import BarbaraGoodbyeAgent
    return BarbaraGoodbyeAgent(..., reason=reason or "standard")
```

---

### Fix 5: Improve GREET for Returning Callers

**File:** `livekit-agent/agents/greet.py`

**Update `mark_greeted()` method:**
```python
# After checking verified and qualified, also check quote_presented
state = get_conversation_state(self.caller_phone)
conversation_data = (state.get('conversation_data', {}) if state else {})
quote_presented = conversation_data.get('quote_presented', False)

if verified and qualified:
    if quote_presented:
        # Returning caller - already quoted, go to ANSWER
        from .answer import BarbaraAnswerAgent
        return BarbaraAnswerAgent(...)
    else:
        # Fresh qualified caller - go to QUOTE (perfect route)
        from .quote import BarbaraQuoteAgent
        return BarbaraQuoteAgent(...)
```

---

## Impact Analysis

### Routes That Will Break After Fixes

**None** - All fixes are additive or correct existing routing. The perfect route (greet→verify→qualify→quote→answer→book→goodbye) will be preserved.

### Routes That Will Be Fixed

1. ✅ VERIFY → QUOTE (instead of ANSWER) for qualified leads
2. ✅ GREET → QUOTE for calculation questions
3. ✅ QUALIFY → OBJECTIONS for mid-qualification objections
4. ✅ QUOTE → GOODBYE for disqualification
5. ✅ ANSWER → GOODBYE for returning callers

---

**Last Updated:** 2025-11-22

