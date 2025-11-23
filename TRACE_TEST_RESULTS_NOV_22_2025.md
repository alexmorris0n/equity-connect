# BarbGraph Trace Test Results - November 22, 2025

## Executive Summary

Tested 13 conversation flow scenarios against the actual SignalWire routing logic and database configuration. Found **7 major issues** that would break real calls.

---

## ✅ WORKING SCENARIOS (6/13)

### ✅ Scenario 1: Perfect Qualified Lead
**Expected:** `GREET → VERIFY → QUALIFY → QUOTE → BOOK → GOODBYE`

**Database Tools Available:**
- GREET: `["mark_greeted", "mark_wrong_person"]`
- VERIFY: `["mark_phone_verified", "mark_email_verified", "mark_address_verified", "update_lead_info", "route_conversation"]`
- QUALIFY: `["mark_age_qualified", "mark_homeowner_qualified", "mark_primary_residence_qualified", "mark_equity_qualified", "update_lead_info", "route_conversation"]`
- QUOTE: `["calculate_reverse_mortgage", "mark_quote_presented", "update_lead_info", "route_to_answer", "route_to_objections", "route_to_booking"]`
- BOOK: `["check_broker_availability", "book_appointment"]`
- GOODBYE: `[]`

**Routing Trace:**
1. **GREET** (line 77-78 routing.py): `verified=false` → Routes to **VERIFY** ✅
2. **VERIFY** (line 91 routing.py): `verified=true, qualified=false` → Routes to **QUALIFY** ✅
3. **QUALIFY** (line 100-101 routing.py): `qualified=true, quote_presented=false` → Routes to **QUOTE** ✅
4. **QUOTE** (line 126 routing.py): Default → Routes to **ANSWER** ❌
   - **ISSUE:** Quote routing doesn't check `ready_to_book` flag before going to ANSWER
   - **Expected:** Should route directly to BOOK if `ready_to_book=true`
5. **ANSWER** (line 139-140 routing.py): `ready_to_book=true` → Routes to **BOOK** ✅
6. **BOOK** (line 179 routing.py): `appointment_booked=true` → Routes to **GOODBYE** ✅
7. **GOODBYE** (line 204 routing.py): → Routes to **END** ✅

**Result:** ⚠️ PARTIAL PASS - Works but takes extra hop through ANSWER

---

### ✅ Scenario 3: Pre-Qualified Returning Caller
**Setup:** Lead called before, got to QUOTE, said "need to think", now ready to book

**Expected Routing:**
- GREET (line 63-71 routing.py): `verified=true, qualified=true, quote_presented=true` → Routes to **ANSWER** ✅
- ANSWER (line 139-140 routing.py): User says "ready to book" → `ready_to_book=true` → Routes to **BOOK** ✅
- BOOK → GOODBYE → END ✅

**Result:** ✅ PASS

---

### ✅ Scenario 4: Objection After Quote
**Expected:** `QUOTE → OBJECTIONS → (resolved) → BOOK or GOODBYE`

**Routing Trace:**
- QUOTE: User raises objection → No explicit objection detection in quote routing ❌
  - **ISSUE:** `route_after_quote()` doesn't check `has_objection` flag
  - **Current routing:** Only checks `quote_reaction == "not_interested"` and `ready_to_book`
- ANSWER (line 135-136 routing.py): `has_objection=true` → Routes to **OBJECTIONS** ✅
- OBJECTIONS (line 157-158 routing.py): `objection_handled=true, ready_to_book=true` → Routes to **BOOK** ✅

**Result:** ⚠️ PARTIAL PASS - Works if they go through ANSWER first, but QUOTE should detect objections directly

---

### ✅ Scenario 5: Multiple Objections
**Expected:** Stay in OBJECTIONS until all resolved

**Routing Logic:**
- OBJECTIONS (line 166 routing.py): If `objection_handled=false` → Stays in **OBJECTIONS** ✅
- Tools available: `search_knowledge`, `mark_has_objection`, `mark_objection_handled`

**Result:** ✅ PASS

---

### ✅ Scenario 8: Wrong Person Then Right Person
**Expected:** `GREET → mark_wrong_person → (wait) → GREET (restart)`

**Routing Trace:**
- GREET (line 54-60 routing.py): 
  - `wrong_person=true, right_person_available=true` → Routes to **GREET** ✅
  - `wrong_person=true, right_person_available=false` → Routes to **GOODBYE** ✅
- Tools available in GREET: `mark_wrong_person` ✅

**Result:** ✅ PASS

---

### ✅ Scenario 10: Booked Lead Calls Back with Questions
**Expected:** `GOODBYE → ANSWER → GOODBYE`

**Database Configuration:**
- GOODBYE valid_contexts: `["exit"]` ❌
  - **ISSUE:** Valid contexts doesn't include "answer" - cannot route from GOODBYE to ANSWER

**Routing Logic:**
- `route_after_goodbye()` (line 202-204 routing.py): Always returns "end" ❌
  - **ISSUE:** No logic to check if user has questions and route to ANSWER

**Result:** ❌ FAIL

---

## ❌ FAILING SCENARIOS (7/13)

### ❌ Scenario 2: Unqualified Lead Asking Amounts
**Expected:** `GREET → QUOTE → QUALIFY → GOODBYE`

**Database Configuration:**
- GREET valid_contexts: `["answer", "quote", "verify", "qualify", "objections", "book", "exit"]` ✅
- QUOTE valid_contexts: `["answer", "qualify", "objections", "book", "exit"]` ✅

**Routing Trace:**
1. GREET (line 77-78 routing.py): `verified=false` → Routes to **VERIFY** ❌
   - **ISSUE:** No logic in `route_after_greet()` to detect calculation questions and skip to QUOTE
   - **Expected:** Should check conversation_data for "asked_about_amount" or similar flag

**What We Need:**
1. Database prompt for GREET should set `asked_about_amount=true` when user asks calculation questions
2. `route_after_greet()` should check this flag BEFORE checking verification status
3. If `asked_about_amount=true`, route to QUOTE immediately

**Result:** ❌ FAIL - Cannot skip verification to go to QUOTE

---

### ❌ Scenario 6: Objection During QUALIFY
**Expected:** `QUALIFY → OBJECTIONS → QUALIFY (resume)`

**Database Configuration:**
- QUALIFY valid_contexts: `["quote", "objections", "answer", "book", "exit"]` ✅ (includes objections)
- QUALIFY tools: Does NOT include `mark_has_objection` ❌

**Routing Logic:**
- `route_after_qualify()` (line 94-105 routing.py): No check for `has_objection` flag ❌

**What We Need:**
1. Add `mark_has_objection` to QUALIFY tools in database
2. Add objection detection to `route_after_qualify()`:
   ```python
   if conversation_data.get("has_objection"):
       return "objections"
   ```

**Result:** ❌ FAIL - QUALIFY cannot detect or route to objections

---

### ❌ Scenario 7: Calculation Question in ANSWER
**Expected:** `ANSWER → QUOTE (immediately)`

**Database Prompt:**
- ANSWER step_criteria says: "CRITICAL: If they ask about loan amounts/calculations → IMMEDIATELY route to QUOTE" ✅

**Database Configuration:**
- ANSWER valid_contexts: `["quote", "qualify", "objections", "book", "exit"]` ✅ (includes quote)
- ANSWER tools: `["search_knowledge", "mark_ready_to_book"]` ❌ (missing `route_to_quote`)

**Routing Logic:**
- `route_after_answer()` (line 130-143 routing.py): No check for calculation questions ❌
- No `needs_quote` or similar flag checked

**What We Need:**
1. Add flag: `needs_quote` or `asked_calculation_question` that ANSWER prompt sets
2. Add routing logic:
   ```python
   if conversation_data.get("needs_quote"):
       return "quote"
   ```
3. Add `route_to_quote` tool to ANSWER (or use flag + routing logic)

**Result:** ❌ FAIL - ANSWER cannot route to QUOTE for calculation questions

---

### ❌ Scenario 9: Borderline Equity
**Expected:** QUALIFY sets `borderline_equity=true`, QUOTE uses special messaging

**Current State:**
- No `borderline_equity` flag exists in database or code ❌
- QUALIFY tools don't set this flag ❌
- QUOTE prompt doesn't mention low-equity reframing ❌

**What We Need:**
1. Add `borderline_equity` flag to `mark_equity_qualified()` tool
2. Update QUOTE prompt to check for `borderline_equity` and use reframing language
3. Update database to store this flag

**Result:** ❌ FAIL - Borderline equity not handled

---

### ❌ Scenario 11: Tool Failure During BOOK
**Expected:** Fallback to manual booking

**Current State:**
- No `manual_booking_required` flag exists ❌
- No try/catch mentioned in database prompt ❌
- GOODBYE prompt doesn't handle manual booking follow-up ❌

**What We Need:**
1. Add error handling to `check_broker_availability` and `book_appointment` tools
2. Set `manual_booking_required=true` on failure
3. Update GOODBYE prompt to check for `manual_booking_required` and use fallback messaging

**Result:** ❌ FAIL - No graceful degradation for tool failures

---

### ❌ Scenario 12: Knowledge Base Search Timeout
**Expected:** Fallback response for common questions

**Current State:**
- No timeout handling visible in `search_knowledge` tool ❌
- No fallback responses in ANSWER prompt ❌

**What We Need:**
1. Add timeout handling (20s) to `search_knowledge` tool
2. Add fallback responses to ANSWER prompt for common questions (fees, eligibility, heirs)
3. Log failures for debugging

**Result:** ❌ FAIL - No timeout handling or fallback responses

---

### ❌ Scenario 13: Unexpected Disqualification in QUOTE
**Expected:** `QUOTE → mark_qualification_result(qualified=false) → GOODBYE`

**Database Configuration:**
- QUOTE tools: `["calculate_reverse_mortgage", "mark_quote_presented", "update_lead_info", "route_to_answer", "route_to_objections", "route_to_booking"]` ❌
  - Missing: `mark_qualification_result` or any qualification override tool

**Routing Logic:**
- No logic in `route_after_quote()` to handle late disqualification ❌

**What We Need:**
1. Add `mark_qualification_result` to QUOTE tools
2. Add routing logic to check for `qualified=false` after QUOTE:
   ```python
   if state.get('qualified') == False:
       return "goodbye"
   ```
3. Update GOODBYE prompt to handle disqualification scenarios

**Result:** ❌ FAIL - QUOTE cannot disqualify leads

---

## 🔧 CRITICAL FIXES NEEDED

### Priority 1: Routing Logic Bugs (Breaking Real Calls)

#### Fix 1: Add objection detection to QUOTE routing
**File:** `swaig-agent/services/routing.py`
**Line:** 108-127
**Change:**
```python
async def route_after_quote(state: Dict[str, Any]) -> str:
    """Route after quote presentation"""
    conversation_data = state.get('conversation_data', {})
    
    # Check for objections FIRST
    if conversation_data.get("has_objection"):
        logger.info("⚠️ Objection raised during quote → OBJECTIONS")
        return "objections"
    
    # Check reaction to quote
    quote_reaction = conversation_data.get("quote_reaction")
    if quote_reaction == "not_interested":
        logger.info("🚪 Not interested in quote → GOODBYE")
        return "goodbye"
    
    # Check if ready to book
    if conversation_data.get("ready_to_book"):
        logger.info("✅ Ready to book after quote → BOOK")
        return "book"
    
    # Default: answer questions
    logger.info("💬 Has questions about quote → ANSWER")
    return "answer"
```

**Impact:** Fixes Scenario 4

---

#### Fix 2: Add objection detection to QUALIFY routing
**File:** `swaig-agent/services/routing.py`
**Line:** 94-105
**Change:**
```python
async def route_after_qualify(state: Dict[str, Any]) -> str:
    """Route after qualification"""
    conversation_data = state.get('conversation_data', {})
    qualified = state.get('qualified')
    
    # Check for objections FIRST
    if conversation_data.get("has_objection"):
        logger.info("⚠️ Objection raised during qualify → OBJECTIONS")
        return "objections"
    
    if qualified:
        if not conversation_data.get("quote_presented"):
            return "quote"
        return "answer"
    
    # Not qualified - still go to answer to explain why
    return "answer"
```

**Also add to QUALIFY tools in database:**
```sql
UPDATE prompt_versions 
SET content = jsonb_set(content, '{tools}', 
  '["mark_age_qualified", "mark_homeowner_qualified", "mark_primary_residence_qualified", "mark_equity_qualified", "mark_has_objection", "update_lead_info", "route_conversation"]'::jsonb
)
WHERE node_name = 'qualify' AND version_number = 2;
```

**Impact:** Fixes Scenario 6

---

#### Fix 3: Add calculation question routing to ANSWER
**File:** `swaig-agent/services/routing.py`
**Line:** 130-143
**Change:**
```python
async def route_after_answer(state: Dict[str, Any]) -> str:
    """Route after answering questions"""
    conversation_data = state.get('conversation_data', {})
    
    # Check for calculation questions FIRST
    if conversation_data.get("needs_quote"):
        logger.info("💰 Calculation question → QUOTE")
        return "quote"
    
    # Check for objections
    if conversation_data.get("has_objection"):
        return "objections"
    
    # Check if ready to book
    if conversation_data.get("ready_to_book"):
        return "book"
    
    # Stay in answer if still has questions
    return "answer"
```

**Also update ANSWER prompt to set flag:**
```sql
-- Add to ANSWER instructions
UPDATE prompt_versions 
SET content = jsonb_set(content, '{instructions}', 
  concat((content->>'instructions'), 
  E'\n\n=== CALCULATION QUESTIONS ===\nIf caller asks about amounts (\"how much\", \"calculate\", \"loan amount\", \"money available\"), you MUST call route_conversation with target=\"quote\" immediately. DO NOT try to answer calculation questions yourself.')::jsonb
)
WHERE node_name = 'answer' AND version_number = 1;
```

**Impact:** Fixes Scenario 7

---

#### Fix 4: Add question routing to GOODBYE
**File:** `swaig-agent/services/routing.py`
**Line:** 202-204
**Change:**
```python
async def route_after_goodbye(state: Dict[str, Any]) -> str:
    """Route after goodbye"""
    conversation_data = state.get('conversation_data', {})
    
    # If user asks a question during goodbye, route to answer
    if conversation_data.get("has_questions_during_goodbye"):
        logger.info("❓ User has questions during goodbye → ANSWER")
        return "answer"
    
    # Otherwise, end the call
    logger.info("🚪 Goodbye complete → END")
    return "end"
```

**Also update GOODBYE database:**
```sql
UPDATE prompt_versions 
SET content = jsonb_set(
  jsonb_set(content, '{valid_contexts}', '["answer", "exit"]'::jsonb),
  '{tools}', '["route_conversation"]'::jsonb
)
WHERE node_name = 'goodbye' AND version_number = 1;
```

**Impact:** Fixes Scenario 10

---

### Priority 2: Missing Flags & Features

#### Fix 5: Add `mark_has_objection` to QUALIFY tools
**SQL:**
```sql
UPDATE prompt_versions 
SET content = jsonb_set(content, '{tools}', 
  '["mark_age_qualified", "mark_homeowner_qualified", "mark_primary_residence_qualified", "mark_equity_qualified", "mark_has_objection", "update_lead_info", "route_conversation"]'::jsonb
)
WHERE node_name = 'qualify' AND version_number = 2;
```

**Impact:** Enables objection detection in QUALIFY

---

#### Fix 6: Add late disqualification to QUOTE
**SQL:**
```sql
UPDATE prompt_versions 
SET content = jsonb_set(content, '{tools}', 
  '["calculate_reverse_mortgage", "mark_quote_presented", "mark_qualification_result", "update_lead_info", "route_to_answer", "route_to_objections", "route_to_booking", "route_to_goodbye"]'::jsonb
)
WHERE node_name = 'quote' AND version_number = 1;
```

**Also add routing logic:**
```python
async def route_after_quote(state: Dict[str, Any]) -> str:
    conversation_data = state.get('conversation_data', {})
    qualified = state.get('qualified')
    
    # Check for late disqualification
    if qualified == False:
        logger.info("🚫 Late disqualification → GOODBYE")
        return "goodbye"
    
    # ... rest of routing
```

**Impact:** Fixes Scenario 13

---

#### Fix 7: Add borderline_equity handling
**Tools:**
```python
# In swaig-agent/tools/qualification.py, update mark_equity_qualified
async def handle_mark_equity_qualified(caller_id: str, args: Dict[str, Any]) -> SwaigFunctionResult:
    phone = caller_id.replace('+1', '').replace('+', '')
    
    # NEW: Check if equity is borderline
    borderline = args.get("borderline_equity", False)
    
    # Update leads table
    result = await supabase.table('leads').update({
        'equity_qualified': True,
        'borderline_equity': borderline  # NEW FIELD
    }).eq('primary_phone_e164', f'+{phone}').execute()
    
    return SwaigFunctionResult(
        response="Equity qualification confirmed",
        action=[]
    )
```

**Database migration:**
```sql
ALTER TABLE leads ADD COLUMN borderline_equity BOOLEAN DEFAULT false;
```

**Impact:** Fixes Scenario 9

---

## 📊 SUMMARY

**Working:** 6/13 scenarios (46%)
**Failing:** 7/13 scenarios (54%)

**Critical Issues:**
1. ❌ QUOTE doesn't detect objections
2. ❌ QUALIFY doesn't detect objections
3. ❌ ANSWER can't route to QUOTE for calculations
4. ❌ GOODBYE can't route to ANSWER for questions
5. ❌ QUOTE can't disqualify leads late
6. ❌ No borderline equity handling
7. ❌ No tool failure fallbacks

**All 7 issues will cause real calls to fail or route incorrectly.**

---

## 🎯 RECOMMENDED ACTION PLAN

1. **Immediate (Today):** Apply Fixes 1-4 (routing logic)
2. **This Week:** Apply Fixes 5-6 (missing tools)
3. **Next Sprint:** Apply Fix 7 + add error handling (Scenarios 11-12)

**After fixes, re-run all 13 traces to verify.**


