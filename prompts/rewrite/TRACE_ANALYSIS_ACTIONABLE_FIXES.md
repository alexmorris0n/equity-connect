# Trace Analysis - Actionable Fixes

**Date:** 2025-01-19  
**Source:** Analysis of 13 scenarios in `trace_test.md` vs database node configurations  
**Format:** LLM-actionable with explicit SQL/prompt changes

---

## CRITICAL FIXES (Blocks Scenarios)

### FIX #1: GREET valid_contexts Missing "qualify" ✅ APPLIED

**Issue:**
- GREET instructions say: "Next Context: `verify` (new callers) or `qualify` (returning verified callers)"
- GREET valid_contexts in DB: `["verify", "exit", "answer", "objections"]`
- `qualify` is NOT in valid_contexts

**Affected Scenarios:**
- Scenario 1: Perfect Qualified Lead (GREET → VERIFY → QUALIFY path)
- Scenario 2: Pre-Qualified Returning Caller (GREET should route to QUALIFY for returning verified callers)

**Fix:**
```sql
UPDATE prompt_versions pv
SET content = jsonb_set(
    content,
    '{valid_contexts}',
    '["verify", "exit", "answer", "objections", "qualify"]'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.node_name = 'greet'
  AND p.vertical = 'reverse_mortgage'
  AND pv.is_active = true;
```

**Alternative:** If GREET should NOT route to qualify (instructions are wrong), update GREET instructions to remove mention of routing to `qualify`.

---

### FIX #2: OBJECTIONS Cannot Return to QUALIFY ✅ APPLIED

**Issue:**
- Scenario 6: Objection During QUALIFY expects OBJECTIONS to route back to QUALIFY after resolving objection
- OBJECTIONS valid_contexts in DB: `["answer", "book", "exit", "greet", "objections"]`
- `qualify` is NOT in valid_contexts

**Affected Scenarios:**
- Scenario 6: Objection During QUALIFY (QUALIFY → OBJECTIONS → QUALIFY resume flow)

**Fix:**
```sql
UPDATE prompt_versions pv
SET content = jsonb_set(
    content,
    '{valid_contexts}',
    '["answer", "book", "exit", "greet", "objections", "qualify"]'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.node_name = 'objections'
  AND p.vertical = 'reverse_mortgage'
  AND pv.is_active = true;
```

**Also Update OBJECTIONS Instructions:**
Add explicit instruction: "After resolving objection during qualification, route back to QUALIFY to resume gate questions."

---

## HIGH PRIORITY FIXES (Degrades Experience) ✅ ALL APPLIED

### FIX #3: Missing Explicit Flag-Setting Instructions ✅ APPLIED

**Issue:**
- GREET and VERIFY instructions do NOT explicitly say when to call tools that set flags
- No clear guidance on: `verify_caller_identity` sets `verified=true`, `mark_qualification_result` sets `qualified=true`, etc.

**Affected Scenarios:**
- Scenario 1: Perfect Qualified Lead (flags may not get set correctly)
- All scenarios relying on flag progression

**Fix:**
Update GREET instructions to add:
```
## Flag Setting
- After confirming identity: Call `verify_caller_identity(first_name, phone)` to set verified=true
- This flag enables routing to QUALIFY for returning callers
```

Update VERIFY instructions to add:
```
## Flag Setting
- After verifying contact info: The system automatically sets verified=true
- This enables routing to QUALIFY
```

---

### FIX #4: QUALIFY Missing "All 4 Gates at Once" Handling ✅ APPLIED

**Issue:**
- Scenario 1 asks: "What happens if they volunteer all 4 gate answers at once in QUALIFY?"
- QUALIFY instructions do NOT address this scenario

**Affected Scenarios:**
- Scenario 1: Perfect Qualified Lead (edge case)

**Fix:**
Add to QUALIFY instructions:
```
## Handling Multiple Answers at Once
- If caller volunteers all 4 gate answers in one response:
  - Acknowledge: "Perfect, you've covered everything!"
  - Still call `mark_qualification_result(phone, qualified=true)` ONCE
  - Route to QUOTE immediately
```

---

### FIX #5: QUOTE Missing Math Skill Reference ✅ APPLIED

**Issue:**
- QUOTE instructions say: "Calculate: (property_value × 0.50) - mortgage_balance"
- Instructions do NOT mention using math skill
- Scenario 1 asks: "Does QUOTE calculate correctly using math skill?"

**Affected Scenarios:**
- Scenario 1: Perfect Qualified Lead (calculation accuracy)

**Fix:**
Add to QUOTE instructions:
```
## Calculation Method
- Use the math skill to calculate: (property_value × 0.50) - mortgage_balance = low estimate
- Use the math skill to calculate: (property_value × 0.60) - mortgage_balance = high estimate
- Present as a range: "You could potentially access between $[low] and $[high]"
```

---

### FIX #6: BOOK Missing Error Handling for check_broker_availability ✅ APPLIED

**Issue:**
- BOOK instructions mention "If none work: Offer manual callback" but do NOT address timeout/API errors
- Scenario 11: Tool Failure During BOOK expects fallback for check_broker_availability errors

**Affected Scenarios:**
- Scenario 11: Tool Failure During BOOK

**Fix:**
Add to BOOK instructions:
```
## Error Handling
- If check_broker_availability times out or returns error:
  - Say: "I'm having trouble checking availability right now. Let me have $broker_name call you directly to schedule."
  - Call `update_lead_info(phone, {conversation_data: {manual_booking_required: true}})`
  - Route to EXIT
```

---

## MEDIUM PRIORITY FIXES (Edge Cases) ✅ ALL APPLIED

### FIX #7: EXIT Missing "Send FAQ and Follow Up" Scenario ✅ APPLIED

**Issue:**
- Scenario 4: "My Kids Said No" expects EXIT to handle "send FAQ and follow up"
- EXIT instructions do NOT explicitly address this scenario

**Affected Scenarios:**
- Scenario 4: "My Kids Said No"

**Fix:**
Add to EXIT instructions:
```
## Send FAQ and Follow Up
- If needs_family_buy_in flag is set:
  - Say: "I'll send the Adult Children FAQ to your email. $broker_name will follow up after your family has a chance to review it."
  - Confirm email address
  - Flag: faq_sent, follow_up_scheduled
```

---

### FIX #8: QUALIFY Missing "Interrupted at Gate Question" Tracking ✅ APPLIED

**Issue:**
- Scenario 6: Objection During QUALIFY expects system to remember which gate question was interrupted
- QUALIFY instructions do NOT mention tracking interruption state

**Affected Scenarios:**
- Scenario 6: Objection During QUALIFY

**Fix:**
Add to QUALIFY instructions:
```
## Handling Interruptions
- If objection raised mid-qualification:
  - Before routing to OBJECTIONS: Call `update_lead_info(phone, {conversation_data: {interrupted_at_gate_question: "age"}})`
  - After returning from OBJECTIONS: Check conversation_data.interrupted_at_gate_question
  - Resume at the interrupted question
```

---

### FIX #9: QUALIFY Missing "Pending Birthday" Flag ✅ APPLIED

**Issue:**
- Scenario 8: Almost 62 expects "pre-qualified pending age" flag
- QUALIFY instructions say "Mark qualified=true with note" but do NOT mention specific flag name

**Affected Scenarios:**
- Scenario 8: Almost 62 (61y10m)

**Fix:**
Add to QUALIFY instructions:
```
## Age Proximity Handling (<90 days to 62)
- If <62 but birthday <90 days away:
  - Call `mark_qualification_result(phone, qualified=true)`
  - Call `update_lead_info(phone, {conversation_data: {pending_birthday: true, birthday_date: "YYYY-MM-DD"}})`
  - Say: "We'll schedule everything closer to your birthday."
```

---

### FIX #10: QUOTE Missing Late Disqualification Handling ✅ APPLIED

**Issue:**
- Scenario 13: Unexpected Disqualification in QUOTE expects QUOTE to mark qualified=false
- QUOTE instructions do NOT mention detecting late disqualifiers

**Affected Scenarios:**
- Scenario 13: Unexpected Disqualification in QUOTE

**Fix:**
Add to QUOTE instructions:
```
## Late Disqualification Detection
- If caller reveals disqualifying information (rental property, not primary residence, etc.):
  - Call `mark_qualification_result(phone, qualified=false)`
  - Call `update_lead_info(phone, {conversation_data: {disqualified_in_quote: true, disqualified_reason: "rental_property"}})`
  - Route to EXIT with empathetic explanation
```

---

### FIX #11: EXIT Missing Reschedule Intent Detection ✅ APPLIED

**Issue:**
- Scenario 10: Post-Booking Reschedule Call expects EXIT to detect "they want to reschedule"
- EXIT instructions mention reschedule but do NOT say how to detect intent

**Affected Scenarios:**
- Scenario 10: Post-Booking Reschedule Call

**Fix:**
Add to EXIT instructions:
```
## Reschedule Intent Detection
- Listen for keywords: "reschedule", "change time", "different day", "can't make it", "need to move"
- If detected:
  - Say: "No problem! You can reply to your confirmation email or call $broker_phone directly to reschedule."
  - Flag: reschedule_redirect
```

---

## LOW PRIORITY FIXES (Clarifications) ✅ ALL APPLIED

### FIX #12: BOOK Missing Duration Parameter Instructions ✅ APPLIED

**Issue:**
- Scenario 3: Joint Call with Spouse expects BOOK to request 60-min slot
- BOOK instructions say "Determine Duration" but do NOT say to pass duration to check_broker_availability

**Affected Scenarios:**
- Scenario 3: Joint Call with Spouse

**Fix:**
Add to BOOK instructions:
```
## Duration Handling
- Standard: 30min (default)
- Joint/complex: 60min (if needs_family_buy_in or multiple properties)
- Note: check_broker_availability currently doesn't accept duration parameter - this is a code limitation
- For now: Book 30min slot, mention to broker that longer time may be needed
```

**Note:** This may require code change to check_broker_availability tool to accept duration parameter.

---

### FIX #13: Multiple Contexts Missing Explicit Question Handling Instructions ✅ APPLIED

**Issue:**
- 6 of 8 nodes (GREET, VERIFY, QUALIFY, QUOTE, BOOK, OBJECTIONS) have `search_knowledge` tool and `answer` in valid_contexts
- But instructions do NOT explicitly say "If user asks question, route to ANSWER context"

**Affected Scenarios:**
- Scenario 1B: Questions After Booking
- Scenario 2B: Qualified Lead Calls Back with Questions
- Scenario 2C: Booked Lead Calls Back with Questions

**Fix:**
Add universal question handling instruction to all 6 nodes:
```
## Question Handling
- If user asks ANY question:
  - Route to ANSWER context immediately (use route_to_context tool if automatic routing doesn't trigger)
  - ANSWER context has search_knowledge tool to find answers
```

---

## SUMMARY ✅ ALL FIXES APPLIED AND VERIFIED

**Total Fixes:** 13
- **Critical:** 2 (routing mismatches) ✅ APPLIED & TESTED
- **High:** 4 (flag-setting, calculations, error handling) ✅ APPLIED & TESTED
- **Medium:** 5 (edge cases, tracking, detection) ✅ APPLIED & TESTED
- **Low:** 2 (clarifications, code limitations) ✅ APPLIED & TESTED

**Status:** All 13 fixes have been applied to the database and verified via comprehensive Python tests.

**Test Results:**
- ✅ CRITICAL: Routing Fixes (2/2)
- ✅ HIGH: Instruction Updates (4/4)
- ✅ MEDIUM: Edge Cases (5/5)
- ✅ LOW: Clarifications (2/2)

**Next Steps:**
1. ✅ All fixes applied
2. ✅ All fixes verified via Python tests
3. Ready for production testing with real calls
4. Monitor trace scenarios in production

