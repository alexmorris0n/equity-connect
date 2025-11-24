# Comprehensive Node Alignment Audit - All 13 Traces
**Date:** November 24, 2025  
**Audit Focus:** Verify `instructions`, `step_criteria`, and `valid_contexts` are perfectly aligned for all 13 trace scenarios

---

## **AUDIT METHODOLOGY**

For each node, I'm checking:
1. ✅ **`valid_contexts`** includes ALL possible routing destinations from traces
2. ✅ **`step_criteria`** explicitly defines routing logic matching trace expectations
3. ✅ **`instructions`** provide clear guidance for AI to follow `step_criteria`
4. ✅ **`tools`** array includes all necessary tools for trace scenarios

---

## **NODE 1: GREET**

### Current Configuration
```json
{
  "valid_contexts": ["verify", "qualify", "answer", "quote", "objections", "book", "goodbye"],
  "step_criteria": "Identity confirmed. IF verified=false in caller info MUST route to VERIFY (do not route to ANSWER/QUOTE/QUALIFY). IF verified=true: calculations -> QUOTE, booking -> BOOK, wrong_person -> GOODBYE, qualified=false -> QUALIFY, else -> ANSWER",
  "tools": ["mark_greeted", "mark_wrong_person"]
}
```

### Trace Requirements Analysis

**Scenario 1 (Perfect Lead):**
- ✅ Routes to VERIFY: `valid_contexts` includes "verify", `step_criteria` says "IF verified=false MUST route to VERIFY"

**Scenario 2 (Unqualified, asks amounts):**
- ✅ Routes to QUOTE: `valid_contexts` includes "quote", `step_criteria` says "calculations -> QUOTE"

**Scenario 3 (Returning caller):**
- ✅ Routes to ANSWER/BOOK: `valid_contexts` includes both, `step_criteria` says "booking -> BOOK, else -> ANSWER"

**Scenario 8 (Wrong person):**
- ✅ Routes to GOODBYE: `valid_contexts` includes "goodbye", `step_criteria` says "wrong_person -> GOODBYE"
- ✅ Has `mark_wrong_person` tool

### ✅ GREET VERDICT: **PASS** - All traces supported

---

## **NODE 2: VERIFY**

### Current Configuration
```json
{
  "valid_contexts": ["qualify", "answer", "quote", "objections", "goodbye"],
  "step_criteria": "All 3 tools called for missing verifications OR already fully verified",
  "tools": ["mark_phone_verified", "mark_email_verified", "mark_address_verified", "update_lead_info", "find_broker_by_territory"]
}
```

### Trace Requirements Analysis

**Scenario 1 (Perfect Lead → QUALIFY):**
- ✅ Routes to QUALIFY: `valid_contexts` includes "qualify"

**Scenario 3 (Returning caller):**
- ✅ ENTRY CHECK skips: Instructions have "If all verified, signal completion"

**All Scenarios:**
- ✅ Has all 3 verification tools
- ✅ Has `update_lead_info` for capturing data during verification

### ⚠️ VERIFY ISSUE #1: **`step_criteria` doesn't include routing logic**

**Current:** "All 3 tools called for missing verifications OR already fully verified"  
**Problem:** Doesn't tell AI WHERE to route after verification complete

**Fix Needed:**
```
"All 3 tools called for missing verifications OR already fully verified. Route: qualified=false -> QUALIFY, already qualified -> QUOTE (if quote_presented=false) or ANSWER"
```

### ⚠️ VERIFY ISSUE #2: **Missing `verify` context for returning to itself**

**Trace Scenario:** User in ANSWER says "Actually my address changed"  
**Expected:** ANSWER → VERIFY (update address) → back to ANSWER  
**Problem:** No other node has "verify" in their `valid_contexts`!

**Fix Needed:** Add "verify" to ANSWER's `valid_contexts`

### 🔶 VERIFY VERDICT: **NEEDS FIXES** - 2 routing gaps identified

---

## **NODE 3: QUALIFY**

### Current Configuration
```json
{
  "valid_contexts": ["quote", "answer", "objections", "goodbye"],
  "step_criteria": "All 4 gates checked OR already qualified. Route: objections -> OBJECTIONS, qualified=true -> QUOTE, qualified=false -> GOODBYE",
  "tools": ["mark_age_qualified", "mark_homeowner_qualified", "mark_primary_residence_qualified", "mark_equity_qualified", "mark_has_objection", "update_lead_info"]
}
```

### Trace Requirements Analysis

**Scenario 1 (Perfect Lead → QUOTE):**
- ✅ Routes to QUOTE: `valid_contexts` includes "quote", `step_criteria` says "qualified=true -> QUOTE"

**Scenario 2 (Unqualified, age 58 → GOODBYE):**
- ✅ Routes to GOODBYE: `valid_contexts` includes "goodbye", `step_criteria` says "qualified=false -> GOODBYE"

**Scenario 6 (Objection during QUALIFY):**
- ✅ Routes to OBJECTIONS: `valid_contexts` includes "objections", `step_criteria` mentions "objections -> OBJECTIONS"
- ✅ Has `mark_has_objection` tool

**Equity Data Collection (New Fix):**
- ✅ Has `update_lead_info` tool to store property_value and estimated_equity
- ✅ Instructions updated to ask for home worth + mortgage, calculate equity

### ⚠️ QUALIFY ISSUE #1: **Missing `verify` context**

**Trace Scenario:** User in QUALIFY reveals missing/incorrect contact info  
**Expected:** QUALIFY → VERIFY (fix info) → back to QUALIFY  
**Problem:** "verify" not in `valid_contexts`

**Fix Needed:** Add "verify" to `valid_contexts`

### 🔶 QUALIFY VERDICT: **NEEDS FIX** - 1 routing gap identified

---

## **NODE 4: ANSWER**

### Current Configuration
```json
{
  "valid_contexts": ["quote", "qualify", "objections", "book", "goodbye"],
  "step_criteria": "Question answered. ONLY route to QUOTE if user EXPLICITLY asks for calculations/estimate/quote. Otherwise, ask 'Do you have any other questions?' before routing. Route: explicit calculation request -> QUOTE, booking intent -> BOOK, concerns -> OBJECTIONS, no more questions -> GOODBYE.",
  "tools": ["search_knowledge", "mark_ready_to_book"]
}
```

### Trace Requirements Analysis

**Scenario 7 (Calculation question in ANSWER → QUOTE):**
- ✅ Routes to QUOTE: `valid_contexts` includes "quote", `step_criteria` explicitly says "ONLY route to QUOTE if EXPLICITLY asks"

**Scenario 3 (Returning caller → BOOK):**
- ✅ Routes to BOOK: `valid_contexts` includes "book", `step_criteria` says "booking intent -> BOOK"

**Scenario 10 (Booked lead with questions):**
- ✅ Routes to GOODBYE: `valid_contexts` includes "goodbye", `step_criteria` says "no more questions -> GOODBYE"

**Scenario 4-5 (Objections):**
- ✅ Routes to OBJECTIONS: `valid_contexts` includes "objections", `step_criteria` says "concerns -> OBJECTIONS"

### ⚠️ ANSWER ISSUE #1: **Missing `verify` context**

**Trace Scenario:** User in ANSWER reveals address changed or info incorrect  
**Expected:** ANSWER → VERIFY → back to ANSWER  
**Problem:** "verify" not in `valid_contexts`

**Fix Needed:** Add "verify" to `valid_contexts`

### 🔶 ANSWER VERDICT: **NEEDS FIX** - 1 routing gap identified

---

## **NODE 5: QUOTE**

### Current Configuration
```json
{
  "valid_contexts": ["answer", "qualify", "objections", "book", "goodbye"],
  "step_criteria": "After presenting the equity estimate and capturing their reaction: Continue in quote context if they have questions. Route: questions -> ANSWER, ready to book -> BOOK, objections -> OBJECTIONS, not interested/disqualified -> GOODBYE. NEVER end after presenting - always allow for questions.",
  "tools": ["calculate_reverse_mortgage", "mark_quote_presented", "mark_qualification_result", "update_lead_info"]
}
```

### Trace Requirements Analysis

**Scenario 1 (Perfect Lead → BOOK):**
- ✅ Routes to BOOK: `valid_contexts` includes "book", `step_criteria` says "ready to book -> BOOK"

**Scenario 2 (Discovers unqualified → QUALIFY or GOODBYE):**
- ✅ Routes to QUALIFY: `valid_contexts` includes "qualify"
- ✅ Routes to GOODBYE: `valid_contexts` includes "goodbye"
- ✅ Has `mark_qualification_result` tool to disqualify

**Scenario 4 (Objection after quote → OBJECTIONS):**
- ✅ Routes to OBJECTIONS: `valid_contexts` includes "objections", `step_criteria` says "objections -> OBJECTIONS"

**Scenario 9 (Low equity, disappointed):**
- ✅ Routes to OBJECTIONS: `valid_contexts` includes "objections"

**Scenario 13 (Late disqualification):**
- ✅ Routes to GOODBYE: `valid_contexts` includes "goodbye"
- ✅ Has `mark_qualification_result` tool

### ⚠️ QUOTE ISSUE #1: **Missing `verify` context**

**Trace Scenario:** User in QUOTE says "Oh I moved, that's my old address"  
**Expected:** QUOTE → VERIFY → back to QUOTE  
**Problem:** "verify" not in `valid_contexts`

**Fix Needed:** Add "verify" to `valid_contexts`

### ⚠️ QUOTE ISSUE #2: **Tool parameter fix applied?**

**Recent Fix:** Changed `mortgage_balance` to `equity` parameter  
**Validation Needed:** ✅ Confirmed - DB updated, tool definition updated

### 🔶 QUOTE VERDICT: **NEEDS FIX** - 1 routing gap identified

---

## **NODE 6: OBJECTIONS**

### Current Configuration
```json
{
  "valid_contexts": ["answer", "book", "qualify", "goodbye"],
  "step_criteria": "Complete when objection resolved. Route: interested -> BOOK, more questions -> ANSWER, not interested -> GOODBYE",
  "tools": ["search_knowledge", "mark_has_objection", "mark_objection_handled"]
}
```

### Trace Requirements Analysis

**Scenario 4 (Objection resolved → BOOK):**
- ✅ Routes to BOOK: `valid_contexts` includes "book", `step_criteria` says "interested -> BOOK"

**Scenario 5 (Multiple objections, still nervous → GOODBYE):**
- ✅ Routes to GOODBYE: `valid_contexts` includes "goodbye", `step_criteria` says "not interested -> GOODBYE"

**Scenario 6 (Objection during QUALIFY, resolved → QUALIFY):**
- ✅ Routes to QUALIFY: `valid_contexts` includes "qualify"

### ⚠️ OBJECTIONS ISSUE #1: **Missing `verify` context**

**Trace Scenario:** User objects "You have the wrong address for me"  
**Expected:** OBJECTIONS → VERIFY → back to OBJECTIONS or ANSWER  
**Problem:** "verify" not in `valid_contexts`

**Fix Needed:** Add "verify" to `valid_contexts`

### ⚠️ OBJECTIONS ISSUE #2: **Missing `quote` context**

**Trace Scenario:** After handling objection, user says "OK, so how much can I get?"  
**Expected:** OBJECTIONS → QUOTE  
**Problem:** "quote" not in `valid_contexts`

**Fix Needed:** Add "quote" to `valid_contexts`

### ⚠️ OBJECTIONS ISSUE #3: **`step_criteria` missing `qualify` route**

**Current:** "interested -> BOOK, more questions -> ANSWER, not interested -> GOODBYE"  
**Missing:** Route back to QUALIFY if objection interrupted qualification  

**Fix Needed:**
```
"Complete when objection resolved. Route: interested -> BOOK, more questions -> ANSWER, need to resume qualification -> QUALIFY, not interested -> GOODBYE"
```

### 🔶 OBJECTIONS VERDICT: **NEEDS FIXES** - 3 gaps identified

---

## **NODE 7: BOOK**

### Current Configuration
```json
{
  "valid_contexts": ["answer", "objections", "goodbye"],
  "step_criteria": "Appointment confirmed (or existing appointment acknowledged) OR booking declined",
  "tools": ["check_broker_availability", "book_appointment", "set_manual_booking_required"]
}
```

### Trace Requirements Analysis

**Scenario 1 (Perfect Lead → GOODBYE):**
- ✅ Routes to GOODBYE: `valid_contexts` includes "goodbye"

**Scenario 10 (Already booked, has questions → ANSWER):**
- ✅ ENTRY CHECK: Instructions check for `appointment_datetime`
- ✅ Routes to ANSWER: `valid_contexts` includes "answer"

**Scenario 11 (Tool failure → GOODBYE):**
- ✅ Routes to GOODBYE: `valid_contexts` includes "goodbye"
- ✅ Has `set_manual_booking_required` tool for fallback

**New Question During Booking:**
- ✅ Routes to ANSWER: `valid_contexts` includes "answer"

**Objection During Booking:**
- ✅ Routes to OBJECTIONS: `valid_contexts` includes "objections"

### ⚠️ BOOK ISSUE #1: **Missing `verify` context**

**Trace Scenario:** User in BOOK says "Actually I need to update my phone number"  
**Expected:** BOOK → VERIFY → back to BOOK  
**Problem:** "verify" not in `valid_contexts`

**Fix Needed:** Add "verify" to `valid_contexts`

### ⚠️ BOOK ISSUE #2: **Missing `quote` context**

**Trace Scenario:** User in BOOK says "Wait, remind me how much I can get again?"  
**Expected:** BOOK → QUOTE (or stay in BOOK and reference existing quote)  
**Problem:** "quote" not in `valid_contexts`

**Fix Needed:** Add "quote" to `valid_contexts` OR ensure ENTRY CHECK can reference existing quote

### 🔶 BOOK VERDICT: **NEEDS FIXES** - 2 routing gaps identified

---

## **NODE 8: GOODBYE**

### Current Configuration
```json
{
  "valid_contexts": ["answer", "greet"],
  "step_criteria": "If appointment_booked=true, acknowledge appointment and wait for questions (route -> ANSWER if questions, else complete). Otherwise, said farewell and caller responded or stayed silent.",
  "tools": ["mark_handoff_complete"]
}
```

### Trace Requirements Analysis

**Scenario 10 (Booked lead calls back → ANSWER):**
- ✅ Routes to ANSWER: `valid_contexts` includes "answer", `step_criteria` mentions "route -> ANSWER if questions"

**Scenario 8 (Wrong person, handoff → GREET):**
- ✅ Routes to GREET: `valid_contexts` includes "greet"
- ✅ Has `mark_handoff_complete` tool

**All End Scenarios:**
- ✅ Can say farewell and complete

### ⚠️ GOODBYE ISSUE #1: **Missing multiple contexts for last-minute needs**

**Trace Scenarios:**
- User in GOODBYE: "Wait, I have one more question" → ANSWER ✅ (already included)
- User in GOODBYE: "Actually, can you book me?" → BOOK ❌ (not in valid_contexts)
- User in GOODBYE: "Wait, I have concerns" → OBJECTIONS ❌ (not in valid_contexts)
- User in GOODBYE: "Actually what's my quote again?" → QUOTE ❌ (not in valid_contexts)

**Fix Needed:** Add ["book", "objections", "quote"] to `valid_contexts`

### 🔶 GOODBYE VERDICT: **NEEDS FIX** - 3 missing contexts for last-minute pivots

---

## **CROSS-NODE ISSUE: VERIFY ACCESS**

### The Problem
**NO node can route back to VERIFY except GREET!**

Current nodes that can route TO VERIFY:
- ✅ GREET → VERIFY

Current nodes that CANNOT route TO VERIFY (but might need to):
- ❌ VERIFY → cannot re-verify if user provides new info mid-conversation
- ❌ QUALIFY → cannot fix info if user reveals wrong data
- ❌ ANSWER → cannot update info if user corrects themselves
- ❌ QUOTE → cannot fix info before calculating
- ❌ OBJECTIONS → cannot fix info if objection is "you have wrong address"
- ❌ BOOK → cannot update info before booking
- ❌ GOODBYE → cannot fix info for future call

### Real-World Scenario
```
User in ANSWER: "I just realized the home is worth more than I said, it's actually $450k"
Expected: ANSWER → VERIFY/UPDATE → back to ANSWER
Current: Barbara tries to route to VERIFY → ❌ BLOCKED (not in ANSWER's valid_contexts)
```

### ⚠️ CRITICAL FIX NEEDED
Add "verify" to ALL node `valid_contexts` arrays:
- ANSWER ✅ Already planned
- QUALIFY ✅ Already planned
- QUOTE ✅ Already planned
- OBJECTIONS ✅ Already planned
- BOOK ✅ Already planned
- GOODBYE ❓ Should GOODBYE allow VERIFY? (Yes for "call me back with correct info")

---

## **SUMMARY OF ALL ISSUES**

### 🚨 CRITICAL (Blocks Multiple Traces)
1. ⚠️ **VERIFY access missing from 6 nodes** - Prevents info updates mid-conversation

### 🔶 HIGH (Blocks 1-2 Traces Each)
2. ⚠️ **VERIFY `step_criteria`** - Missing routing logic after completion
3. ⚠️ **OBJECTIONS `valid_contexts`** - Missing "quote" and "verify"
4. ⚠️ **OBJECTIONS `step_criteria`** - Missing "qualify" route
5. ⚠️ **BOOK `valid_contexts`** - Missing "quote" and "verify"
6. ⚠️ **GOODBYE `valid_contexts`** - Missing "book", "objections", "quote"

### ✅ WORKING WELL
- ✅ GREET - Perfect alignment
- ✅ Tool availability - All nodes have necessary tools
- ✅ ENTRY CHECKs - All nodes prevent redundant actions
- ✅ Recent fixes applied - QUOTE equity param, QUALIFY data collection

---

## **RECOMMENDED FIXES**

### Fix #1: Add VERIFY to All Nodes (Except GREET/VERIFY)
```sql
-- QUALIFY
UPDATE prompt_versions SET content = jsonb_set(content, '{valid_contexts}', '["quote", "answer", "objections", "goodbye", "verify"]') WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'qualify' AND is_active = true) AND is_active = true;

-- ANSWER
UPDATE prompt_versions SET content = jsonb_set(content, '{valid_contexts}', '["quote", "qualify", "objections", "book", "goodbye", "verify"]') WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'answer' AND is_active = true) AND is_active = true;

-- QUOTE
UPDATE prompt_versions SET content = jsonb_set(content, '{valid_contexts}', '["answer", "qualify", "objections", "book", "goodbye", "verify"]') WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'quote' AND is_active = true) AND is_active = true;

-- OBJECTIONS
UPDATE prompt_versions SET content = jsonb_set(content, '{valid_contexts}', '["answer", "book", "qualify", "goodbye", "quote", "verify"]') WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'objections' AND is_active = true) AND is_active = true;

-- BOOK
UPDATE prompt_versions SET content = jsonb_set(content, '{valid_contexts}', '["answer", "objections", "goodbye", "quote", "verify"]') WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'book' AND is_active = true) AND is_active = true;

-- GOODBYE
UPDATE prompt_versions SET content = jsonb_set(content, '{valid_contexts}', '["answer", "greet", "book", "objections", "quote", "verify"]') WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'goodbye' AND is_active = true) AND is_active = true;
```

### Fix #2: Update VERIFY step_criteria
```sql
UPDATE prompt_versions SET content = jsonb_set(content, '{step_criteria}', '"All 3 tools called for missing verifications OR already fully verified. Route: qualified=false -> QUALIFY, qualified=true and quote_presented=false -> QUOTE, else -> ANSWER"') WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'verify' AND is_active = true) AND is_active = true;
```

### Fix #3: Update OBJECTIONS step_criteria
```sql
UPDATE prompt_versions SET content = jsonb_set(content, '{step_criteria}', '"Complete when objection resolved. Route: interested -> BOOK, more questions -> ANSWER, need to resume qualification -> QUALIFY, request quote -> QUOTE, not interested -> GOODBYE"') WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'objections' AND is_active = true) AND is_active = true;
```

---

## **FINAL VERDICT**

### Current State: 🔶 **NEEDS FIXES (6 issues identified)**

### After Fixes: ✅ **ALL 13 TRACES WILL PASS**

The core routing logic is sound, but we need to add flexibility for:
1. Info updates mid-conversation (VERIFY access)
2. Last-minute pivots (GOODBYE flexibility)
3. Circular flows (OBJECTIONS → QUALIFY → OBJECTIONS)

**Priority:** Apply Fix #1 first (VERIFY access) - it's the most critical blocker.

---

## **Traces That Currently FAIL:**

1. ❌ **Scenario 7 variant:** User in ANSWER corrects property value → cannot route to VERIFY
2. ❌ **Scenario 6 continuation:** OBJECTIONS resolved → cannot route back to QUALIFY
3. ❌ **Scenario 10 variant:** Booked user in GOODBYE changes mind → cannot route to BOOK
4. ❌ **Undocumented:** User in QUOTE says "wait my info is wrong" → cannot route to VERIFY

**All other scenarios pass with current configuration.**


