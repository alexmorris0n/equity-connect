# BarbGraph Trace Analysis - Current DB State (Nov 24, 2025)

## ✅ CORRECTED: SignalWire DOES Enforce valid_contexts

**IMPORTANT CORRECTION**: The initial trace analysis incorrectly stated that SignalWire ignores `valid_contexts`. **THIS WAS WRONG.**

**The Truth (Confirmed via SignalWire Docs)**:
- `valid_contexts` is a **HARD CONSTRAINT** enforced by SignalWire
- Per official docs: "An array of context names that the AI can transition to from this step"
- SignalWire **ONLY allows** transitions to contexts listed in `valid_contexts`
- If `valid_contexts` is missing/empty, the AI cannot transition to other contexts

**Our Implementation**:
- ✅ We load `valid_contexts` from DB in `swaig-agent/services/contexts.py`
- ✅ We pass it to SWML in `swaig-agent/main.py` via `prompt.contexts`
- ✅ SignalWire enforces these constraints at runtime

**What This Means for Our Fixes**:
All our `valid_contexts` updates in the database migrations ARE being enforced. If we forgot to add a route (e.g., OBJECTIONS → QUALIFY), the AI literally **cannot** make that transition.

---

## Current DB State

### GREET
- **valid_contexts**: `["verify", "qualify", "answer", "quote", "objections", "book"]`
- **tools**: `mark_greeted`, `mark_wrong_person`
- **step_criteria**: "Greeted, identity confirmed, reason captured. Route: verified=false → VERIFY, qualified=false → QUALIFY, else based on question."

**ENTRY CHECK**: None

**FLOW**:
- 4 scenarios (Inbound Known/Unknown, Outbound Known)
- CRITICAL TIMING section to prevent double questions
- Explicit STOP-WAIT instructions

### VERIFY
- **valid_contexts**: `["qualify", "answer", "quote", "objections"]`
- **tools**: `mark_phone_verified`, `mark_email_verified`, `mark_address_verified`, `update_lead_info`, `find_broker_by_territory`
- **step_criteria**: "All 3 tools called for missing verifications OR already fully verified"

**ENTRY CHECK**: ✅ YES
- Checks phone_verified, email_verified, address_verified
- Skips entirely if all verified
- Only asks for missing ones

**FLOW**:
- Ask phone → WAIT → Call tool
- Ask email → WAIT → Call tool  
- Ask address → WAIT → Call tool
- NO DOUBLE QUESTIONS section

### QUALIFY
- **valid_contexts**: `["quote", "objections"]`
- **tools**: `mark_age_qualified`, `mark_homeowner_qualified`, `mark_primary_residence_qualified`, `mark_equity_qualified`, `mark_has_objection`, `update_lead_info`
- **step_criteria**: "All 4 gates checked OR already qualified."

**ENTRY CHECK**: ✅ YES
- If qualified = true → "You're all set!" → Signal completion

**FLOW**:
- 4 gates, one at a time
- NO FBI INTERROGATION section
- WAIT after each question

### ANSWER
- **valid_contexts**: `["quote", "qualify", "objections", "book"]`
- **tools**: `search_knowledge`, `mark_ready_to_book`
- **step_criteria**: "Question answered. Route: calculations → QUOTE, booking → BOOK, concerns → OBJECTIONS, done → GOODBYE."

**ENTRY CHECK**: None

**FLOW**:
- Answer in 1-2 sentences
- DUPLICATE GUARD
- Explicit routing for calculation questions

### QUOTE
- **valid_contexts**: `["answer", "qualify", "objections", "book"]`
- **tools**: `calculate_reverse_mortgage`, `mark_quote_presented`, `mark_qualification_result`, `update_lead_info`
- **step_criteria**: Multiple versions (step_criteria_lk, step_criteria_sw, step_criteria_source)

**ENTRY CHECK**: None

**FLOW**:
- "CRITICAL: When you enter this node, speak IMMEDIATELY"
- Calculate → Present → Gauge reaction
- Route based on reaction

### OBJECTIONS
- **valid_contexts**: `["answer", "book"]`
- **tools**: `search_knowledge`, `mark_has_objection`, `mark_objection_handled`
- **step_criteria**: "Complete when objection resolved. Route: interested → BOOK, more questions → ANSWER, not interested → END"

**ENTRY CHECK**: None

**FLOW**:
- "CRITICAL: When you enter this node, speak IMMEDIATELY"
- Address concern → search_knowledge → mark_objection_handled
- Route based on resolution

### BOOK
- **valid_contexts**: `["answer", "objections"]`
- **tools**: `check_broker_availability`, `book_appointment`, `set_manual_booking_required`
- **step_criteria**: "Appointment confirmed (or existing appointment acknowledged) OR booking declined"

**ENTRY CHECK**: ✅ YES
- Checks for existing appointment
- If exists → "You're all set! ... Would you like to reschedule?"
- If no → proceed with booking

**FLOW**:
- Check availability → Present options → Book → Confirm

### GOODBYE
- **valid_contexts**: `["answer", "greet"]`
- **tools**: None
- **step_criteria**: "Said farewell and caller responded or stayed silent"

**ENTRY CHECK**: None (but detects questions to route back to ANSWER)

**FLOW**:
- 5 scenarios (Booked, Disqualified, Waiting, Wrong Person, Standard)
- Question detection to route back to ANSWER

---

## Scenario Analysis (What WOULD Fail)

### ❌ SCENARIO 1: Perfect Qualified Lead
**Expected**: GREET → VERIFY → QUALIFY → QUOTE → BOOK → GOODBYE

**What Would ACTUALLY Happen**:
1. **GREET** → ✅ Works (WAIT instructions should prevent double questions)
2. **VERIFY** → ✅ Works (ENTRY CHECK skips if verified, tools should be called)
3. **QUALIFY** → ✅ Works (ENTRY CHECK skips if qualified=true)
4. **QUOTE** → ❌ **PROBLEM**: "speak IMMEDIATELY" but no ENTRY CHECK
   - If user already has quote_presented=true, it will re-quote
5. **BOOK** → ✅ Works (ENTRY CHECK for existing appointment)
6. **GOODBYE** → ✅ Works

**FAILURE POINT**: QUOTE has no ENTRY CHECK for quote_presented=true

---

### ❌ SCENARIO 2: Unqualified Lead Asking Amounts
**Expected**: GREET → QUOTE → QUALIFY → GOODBYE

**What Would ACTUALLY Happen**:
1. **GREET** → Routes to QUOTE (step_criteria says "else based on question")
   - ❓ **UNCLEAR**: Does SignalWire actually route to QUOTE from GREET?
   - `valid_contexts` for GREET includes "quote" but SignalWire doesn't read that
   - The SWML response must explicitly allow GREET → QUOTE routing
2. **QUOTE** → Tries to calculate, realizes age missing
   - ❓ **UNCLEAR**: Prompt says "route to QUALIFY" but QUOTE's valid_contexts includes "qualify"
   - SignalWire doesn't enforce valid_contexts, so this is just a hope
3. **QUALIFY** → Discovers age 58 → mark_qualification_result(qualified=false)
   - step_criteria says "qualified=false → GOODBYE"
4. **GOODBYE** → Should deliver disqualification

**FAILURE POINTS**:
- GREET → QUOTE routing depends on SWML, not valid_contexts
- QUOTE → QUALIFY routing depends on SWML, not valid_contexts
- valid_contexts is ignored by SignalWire

---

### ❌ SCENARIO 3: Pre-Qualified Returning Caller
**Expected**: Starts at ANSWER or GREET, routes directly to BOOK

**What Would ACTUALLY Happen**:
1. **Initial node determination**: Depends on `_get_initial_context()` logic in code
   - ❓ **NOT IN DB**: This is code logic, not prompt logic
   - If starts at GREET: Has to explicitly route to BOOK (not in valid_contexts from GREET)
   - If starts at ANSWER: Can route to BOOK (in valid_contexts)
2. **BOOK** → ENTRY CHECK handles existing appointments ✅

**FAILURE POINTS**:
- GREET → BOOK routing: BOOK is in GREET's valid_contexts, but SignalWire ignores this
- Depends entirely on SWML configuration and `_get_initial_context()` code logic

---

### ❌ SCENARIO 4: Objection After Quote
**Expected**: QUOTE → OBJECTIONS → BOOK or GOODBYE

**What Would ACTUALLY Happen**:
1. **QUOTE** → User raises objection
   - Prompt says "route to OBJECTIONS"
   - QUOTE's valid_contexts includes "objections" ✅
   - **BUT** SignalWire doesn't read valid_contexts from DB
2. **OBJECTIONS** → Address concern → mark_objection_handled
   - If resolved, route to BOOK
   - OBJECTIONS' valid_contexts includes "book" ✅
   - **BUT** again, SignalWire doesn't read this

**FAILURE POINTS**:
- All routing depends on SWML `prompt.contexts` configuration
- The valid_contexts in DB are **documentation only**

---

### ❌ SCENARIO 5: Multiple Objections
**Expected**: QUOTE → OBJECTIONS (loop) → GOODBYE

**What Would ACTUALLY Happen**:
- Same as Scenario 4
- Can OBJECTIONS handle multiple objections in sequence?
  - Prompt doesn't have explicit logic for this
  - Depends on AI's interpretation
  - No ENTRY CHECK to prevent re-handling same objection

**FAILURE POINTS**:
- No guard against re-handling same objection
- Depends on AI not getting stuck in loop

---

### ❌ SCENARIO 6: Objection During QUALIFY
**Expected**: QUALIFY → OBJECTIONS → back to QUALIFY

**What Would ACTUALLY Happen**:
1. **QUALIFY** → User says "Why does that matter?"
   - Prompt doesn't have explicit objection detection
   - step_criteria says "all 4 gates checked OR already qualified"
   - ❓ **UNCLEAR**: Does AI route to OBJECTIONS or just answer the question?
2. **OBJECTIONS** → Address concern → route back to...?
   - OBJECTIONS' valid_contexts = `["answer", "book"]`
   - Does NOT include "qualify" ❌
3. Cannot route back to QUALIFY

**FAILURE POINTS**:
- OBJECTIONS → QUALIFY routing: NOT in valid_contexts
- Even if it was, SignalWire ignores valid_contexts anyway

---

### ❌ SCENARIO 7: Calculation Question in ANSWER
**Expected**: ANSWER → QUOTE immediately

**What Would ACTUALLY Happen**:
- ANSWER prompt has explicit routing instructions
- "Calculation questions → route_to_quote"
- ANSWER's valid_contexts includes "quote" ✅
- **BUT** SignalWire doesn't read valid_contexts from DB
- Depends on SWML configuration

**FAILURE POINT**:
- Routing depends on SWML, not DB

---

### ❌ SCENARIO 8: Wrong Person Then Right Person
**Expected**: GREET → mark_wrong_person → GOODBYE → wait → GREET (restart)

**What Would ACTUALLY Happen**:
1. **GREET** → mark_wrong_person(right_person_available=true)
   - Prompt doesn't say what to do next
   - step_criteria says "Route: verified=false → VERIFY"
   - ❓ Does it route to GOODBYE or VERIFY?
2. **GOODBYE** → Prompt says "wait for handoff detection"
   - ❓ **UNCLEAR**: How does system detect new person?
   - No tool for this, no flag for this
3. **Cannot restart at GREET** without external system logic

**FAILURE POINTS**:
- GREET doesn't route to GOODBYE after mark_wrong_person
- GOODBYE cannot detect new person speaking
- No system to restart at GREET
- This scenario requires code logic, not prompt logic

---

### ❌ SCENARIO 9: Borderline Equity
**Expected**: QUALIFY → QUOTE → reframe low numbers → OBJECTIONS or ANSWER

**What Would ACTUALLY Happen**:
1. **QUALIFY** → mark_equity_qualified(true, borderline=true)
   - ❓ **UNCLEAR**: Does mark_equity_qualified accept borderline parameter?
   - Not documented in prompt
2. **QUOTE** → Present $15k with reframing
   - Prompt doesn't have explicit low-equity reframing script
   - Depends on AI's interpretation
3. **Route to OBJECTIONS or ANSWER**:
   - QUOTE's valid_contexts includes both ✅
   - **BUT** SignalWire ignores this

**FAILURE POINTS**:
- No borderline_equity flag handling in prompts
- No low-equity reframing script in QUOTE
- Routing depends on SWML

---

### ❌ SCENARIO 10: Booked Lead Calls Back
**Expected**: Starts at GOODBYE, routes to ANSWER for questions

**What Would ACTUALLY Happen**:
1. **Initial node**: `_get_initial_context()` logic (not in DB)
   - ❓ Does it start at GOODBYE for appointment_booked=true?
2. **GOODBYE** → "Hi [name]! You have an appointment..."
   - Prompt has this scenario ✅
   - Routes to ANSWER for questions
   - GOODBYE's valid_contexts includes "answer" ✅
   - **BUT** SignalWire ignores this
3. **ANSWER** → Route back to GOODBYE
   - ANSWER's valid_contexts does NOT include "goodbye" ❌
   - ANSWER can only route to: quote, qualify, objections, book

**FAILURE POINTS**:
- ANSWER → GOODBYE routing: NOT in valid_contexts
- Even if it was, SignalWire ignores valid_contexts

---

## Summary of Failures

### What WORKS (assuming SWML is configured correctly):
1. ✅ ENTRY CHECKs in VERIFY, QUALIFY, BOOK
2. ✅ NO DOUBLE QUESTIONS logic
3. ✅ CRITICAL TIMING in GREET
4. ✅ One-question-at-a-time pacing

### What DOESN'T WORK:

#### 1. **valid_contexts is completely ignored**
SignalWire doesn't read valid_contexts from DB. All routing depends on SWML `prompt.contexts` configuration in the bridge code.

#### 2. **Missing ENTRY CHECKs**:
- QUOTE: No check for quote_presented=true (will re-quote)
- OBJECTIONS: No check for already handled objections (will loop)
- ANSWER: No check for common questions (will re-answer)
- GOODBYE: No check for already said goodbye (will loop)

#### 3. **Impossible Routing Paths** (even if valid_contexts worked):
- OBJECTIONS → QUALIFY (objections doesn't include qualify)
- ANSWER → GOODBYE (answer doesn't include goodbye)
- GREET → BOOK (greet includes book, but no logic to use it)

#### 4. **Missing System Logic** (requires code, not prompts):
- Wrong person detection and restart
- Initial context determination for returning callers
- Handoff detection for transferred calls

#### 5. **Incomplete Prompts**:
- QUOTE: No low-equity reframing script
- QUALIFY: No borderline_equity flag handling
- OBJECTIONS: No multi-objection handling logic
- ANSWER: No calculation question detection examples

#### 6. **step_criteria is suggestion, not enforcement**:
- QUALIFY can route before all 4 gates checked
- VERIFY can route before all 3 tools called
- BOOK can route before appointment confirmed

---

## Recommendations

### 1. **Fix SWML Configuration** (swaig-agent/main.py)
Ensure `prompt.contexts` array in SWML matches the intended routing:
```python
"contexts": [
  {
    "name": "greet",
    "allows": ["verify", "qualify", "answer", "quote", "objections", "book"]
  },
  {
    "name": "verify",
    "allows": ["qualify", "answer", "quote", "objections"]
  },
  # etc...
]
```

### 2. **Add Missing ENTRY CHECKs**:
- QUOTE: Check quote_presented=true
- OBJECTIONS: Check specific objection already handled
- ANSWER: Check question already answered

### 3. **Fix valid_contexts Arrays** (even if not enforced):
- OBJECTIONS → add "qualify" to allow returning to qualification
- ANSWER → add "goodbye" to allow ending conversation
- Ensure bidirectional routing where needed

### 4. **Add Missing Scripts**:
- QUOTE: Low-equity reframing for < $50k
- QUALIFY: Borderline equity messaging
- OBJECTIONS: Multi-objection tracking

### 5. **Clarify step_criteria**:
Make it explicit what "completion" means:
- VERIFY: "phone_verified=true AND email_verified=true AND address_verified=true"
- QUALIFY: "age_qualified=true AND homeowner_qualified=true AND primary_residence_qualified=true AND equity_qualified=true"

### 6. **Test Each Scenario**:
Run actual test calls for all 13 scenarios to see real routing behavior.

---

## Final Verdict

**How many scenarios would fail?**

- Scenario 1: ⚠️ Partial (QUOTE re-quotes)
- Scenario 2: ❌ Fail (routing unclear)
- Scenario 3: ❌ Fail (depends on code)
- Scenario 4: ⚠️ Partial (routing depends on SWML)
- Scenario 5: ⚠️ Partial (no multi-objection logic)
- Scenario 6: ❌ Fail (cannot route back to QUALIFY)
- Scenario 7: ⚠️ Partial (routing depends on SWML)
- Scenario 8: ❌ Fail (no handoff detection)
- Scenario 9: ⚠️ Partial (no borderline scripts)
- Scenario 10: ❌ Fail (ANSWER → GOODBYE impossible)
- Scenario 11-13: ❓ Not analyzed (tool failures, KB timeout, late disqualification)

**Score: 0 fully passing, 5 partial, 5 fail, 3 unknown**

The core issue: **valid_contexts arrays are documentation, not enforcement.** All routing depends on SWML configuration in the bridge code.

