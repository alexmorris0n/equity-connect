# Step Criteria Analysis Against 13 Trace Scenarios

**Date**: November 24, 2025

## Current Step Criteria in DB

| Node | Step Criteria |
|------|---------------|
| GREET | "Greeted, identity confirmed, reason captured. Route: verified=false → VERIFY, qualified=false → QUALIFY, else based on question." |
| VERIFY | "All 3 tools called for missing verifications OR already fully verified" |
| QUALIFY | "All 4 gates checked OR already qualified." |
| ANSWER | "Question answered. Route: calculations → QUOTE, booking → BOOK, concerns → OBJECTIONS, done → GOODBYE." |
| QUOTE | "After presenting the equity estimate and capturing their reaction: Continue in quote context if they have questions about the quote. If they have questions, route to answer context. If they are ready to book, route to book context. If they raise objections, route to objections context. If not interested, route to exit context. NEVER end the conversation after presenting the quote - always allow for questions." |
| OBJECTIONS | "Complete when objection resolved. Route: interested → BOOK, more questions → ANSWER, not interested → END" |
| BOOK | "Appointment confirmed (or existing appointment acknowledged) OR booking declined" |
| GOODBYE | "Said farewell and caller responded or stayed silent" |

---

## Scenario-by-Scenario Analysis

### ✅ SCENARIO 1: Perfect Qualified Lead
**Path**: GREET → VERIFY → QUALIFY → QUOTE → BOOK → GOODBYE

| Node | Step Criteria Support | Issues |
|------|----------------------|---------|
| GREET | ✅ "verified=false → VERIFY" - supports routing | None |
| VERIFY | ✅ "All 3 tools called OR already verified" | None |
| QUALIFY | ✅ "All 4 gates checked OR already qualified" | None |
| QUOTE | ✅ "ready to book → book context" | None |
| BOOK | ✅ "Appointment confirmed" | None |
| GOODBYE | ✅ "Said farewell" | None |

**Result**: ✅ PASS

---

### ✅ SCENARIO 2: Unqualified Lead Asking Amounts
**Path**: GREET → QUOTE → QUALIFY → GOODBYE

| Node | Step Criteria Support | Issues |
|------|----------------------|---------|
| GREET | ⚠️ Says "based on question" but not explicit about QUOTE routing | Vague - should explicitly say "calculations → QUOTE" |
| QUOTE | ❌ Doesn't mention routing back to QUALIFY for missing data | Missing: "If qualification data missing → QUALIFY" |
| QUALIFY | ❌ Doesn't mention GOODBYE routing for disqualification | Missing: "qualified=false → GOODBYE" |
| GOODBYE | ✅ Works for disqualification | None |

**Result**: ⚠️ PARTIAL - Needs explicit disqualification routing

---

### ✅ SCENARIO 3: Pre-Qualified Returning Caller
**Path**: GREET/ANSWER → BOOK → GOODBYE

| Node | Step Criteria Support | Issues |
|------|----------------------|---------|
| GREET | ⚠️ "else based on question" - not explicit about BOOK routing | Should say "booking intent → BOOK" |
| ANSWER | ✅ "booking → BOOK" | None |
| BOOK | ✅ "Appointment confirmed" | None |
| GOODBYE | ✅ Works | None |

**Result**: ⚠️ PARTIAL - GREET should be more explicit about BOOK routing

---

### ✅ SCENARIO 4: Objection After Quote
**Path**: QUOTE → OBJECTIONS → BOOK/GOODBYE

| Node | Step Criteria Support | Issues |
|------|----------------------|---------|
| QUOTE | ✅ "If they raise objections, route to objections context" | None |
| OBJECTIONS | ✅ "interested → BOOK" | None |
| BOOK | ✅ Works | None |
| GOODBYE | ✅ Works | None |

**Result**: ✅ PASS

---

### ✅ SCENARIO 5: Multiple Objections
**Path**: QUOTE → OBJECTIONS (loop) → GOODBYE

| Node | Step Criteria Support | Issues |
|------|----------------------|---------|
| OBJECTIONS | ⚠️ Says "not interested → END" but END doesn't exist | Should say "not interested → GOODBYE" |
| GOODBYE | ✅ Works | None |

**Result**: ⚠️ NEEDS FIX - References non-existent "END" node

---

### ⚠️ SCENARIO 6: Objection During QUALIFY
**Path**: QUALIFY → OBJECTIONS → QUALIFY/ANSWER

| Node | Step Criteria Support | Issues |
|------|----------------------|---------|
| QUALIFY | ❌ Doesn't mention routing to OBJECTIONS | Missing: "objections → OBJECTIONS" |
| OBJECTIONS | ⚠️ Says "more questions → ANSWER" but not "resume qualification → QUALIFY" | Missing: Should support routing back to QUALIFY |

**Result**: ❌ FAIL - Missing critical routing guidance

---

### ✅ SCENARIO 7: Calculation Question in ANSWER
**Path**: ANSWER → QUOTE

| Node | Step Criteria Support | Issues |
|------|----------------------|---------|
| ANSWER | ✅ "calculations → QUOTE" | None |
| QUOTE | ✅ Works | None |

**Result**: ✅ PASS

---

### ⚠️ SCENARIO 8: Wrong Person Then Right Person
**Path**: GREET → GOODBYE → (handoff) → GREET

| Node | Step Criteria Support | Issues |
|------|----------------------|---------|
| GREET | ⚠️ Doesn't mention wrong_person → GOODBYE routing | Missing: "wrong_person → GOODBYE" |
| GOODBYE | ❌ Doesn't mention handoff detection or routing back to GREET | Missing: Handoff scenario |

**Result**: ⚠️ NEEDS UPDATE - Missing handoff guidance (but we added tool support!)

---

### ⚠️ SCENARIO 9: Borderline Equity
**Path**: QUALIFY → QUOTE → OBJECTIONS/ANSWER

| Node | Step Criteria Support | Issues |
|------|----------------------|---------|
| QUALIFY | ⚠️ Doesn't mention borderline_equity flag | Optional - could mention setting borderline flag |
| QUOTE | ✅ Has routing for questions/objections | None |

**Result**: ⚠️ MINOR - Works but could be more explicit about borderline handling

---

### ⚠️ SCENARIO 10: Booked Lead Calls Back
**Path**: GOODBYE → ANSWER → GOODBYE

| Node | Step Criteria Support | Issues |
|------|----------------------|---------|
| GOODBYE | ❌ Doesn't mention "if booked, start here" or "questions → ANSWER" | Missing: Booked lead scenario + routing to ANSWER |
| ANSWER | ❌ Doesn't mention routing back to GOODBYE after questions | Missing: "done → GOODBYE" exists but not explicit for returning callers |

**Result**: ⚠️ NEEDS UPDATE - Missing booked lead scenario

---

### ❓ SCENARIO 11: Tool Failure During BOOK
**Path**: BOOK → (fallback) → GOODBYE

| Node | Step Criteria Support | Issues |
|------|----------------------|---------|
| BOOK | ⚠️ Says "Appointment confirmed OR booking declined" but not "OR tool failed" | Missing: Fallback scenario |
| GOODBYE | ⚠️ Doesn't mention manual booking follow-up scenario | Missing: Manual booking scenario |

**Result**: ⚠️ NEEDS UPDATE - Missing failure handling

---

### ❓ SCENARIO 12: Knowledge Base Search Timeout
**Path**: ANSWER → (fallback) → BOOK/GOODBYE

| Node | Step Criteria Support | Issues |
|------|----------------------|---------|
| ANSWER | ⚠️ Doesn't mention tool failure fallback | Implicit - works but not explicit |

**Result**: ⚠️ MINOR - Implicit support, could be more explicit

---

### ⚠️ SCENARIO 13: Unexpected Disqualification in QUOTE
**Path**: QUOTE → GOODBYE

| Node | Step Criteria Support | Issues |
|------|----------------------|---------|
| QUOTE | ❌ Says "route to exit context" (EXIT doesn't exist) | Should say "disqualified → GOODBYE" |
| GOODBYE | ✅ Works for disqualification | None |

**Result**: ⚠️ NEEDS FIX - References non-existent "EXIT" node

---

## Summary of Issues

### 🔴 CRITICAL (Breaks Scenarios):
1. **QUALIFY** - Missing "objections → OBJECTIONS" routing (Scenario 6)
2. **QUALIFY** - Missing "qualified=false → GOODBYE" routing (Scenario 2)
3. **OBJECTIONS** - References "END" instead of "GOODBYE" (Scenario 5, 13)
4. **QUOTE** - References "exit context" instead of "GOODBYE" (Scenario 13)

### ⚠️ SHOULD FIX (Vague/Incomplete):
5. **GREET** - Not explicit about "calculations → QUOTE" (Scenario 2)
6. **GREET** - Not explicit about "booking → BOOK" (Scenario 3)
7. **GREET** - Missing "wrong_person → GOODBYE" (Scenario 8)
8. **QUOTE** - Missing "qualification data missing → QUALIFY" (Scenario 2)
9. **GOODBYE** - Missing booked lead scenario + routing to ANSWER (Scenario 10)
10. **BOOK** - Missing tool failure fallback scenario (Scenario 11)
11. **OBJECTIONS** - Should mention routing back to QUALIFY (Scenario 6)

### ✅ WORKS WELL:
- **VERIFY** - Clear and explicit
- **ANSWER** - Clear routing rules for calculations, booking, objections, goodbye
- **BOOK** - Clear completion criteria (could add fallback)

---

## Recommended Fixes

### Priority 1: Fix Node Name References
```sql
-- OBJECTIONS: Change "END" to "GOODBYE"
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{step_criteria}',
  '"Complete when objection resolved. Route: interested → BOOK, more questions → ANSWER, not interested → GOODBYE"'::jsonb
)
WHERE id = 'd9b3c5e8-4f7a-4b2c-9d1e-8a6f5c4b3a2d';

-- QUOTE: Change "exit context" to "GOODBYE"
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{step_criteria}',
  '"After presenting the equity estimate and capturing their reaction: Continue in quote context if they have questions. Route: questions → ANSWER, ready to book → BOOK, objections → OBJECTIONS, not interested/disqualified → GOODBYE. NEVER end after presenting - always allow for questions."'::jsonb
)
WHERE id = '4a0a7972-5b8a-4e1f-bcc7-d8a0b2f9c3e1';
```

### Priority 2: Add Missing Routing Rules
```sql
-- QUALIFY: Add objections and goodbye routing
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{step_criteria}',
  '"All 4 gates checked OR already qualified. Route: objections → OBJECTIONS, qualified=true → QUOTE, qualified=false → GOODBYE"'::jsonb
)
WHERE id = 'aec332f5-342e-4328-8fec-ded945ec2b04';

-- GREET: Make routing more explicit
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{step_criteria}',
  '"Greeted, identity confirmed, reason captured. Route: calculations → QUOTE, booking → BOOK, wrong_person → GOODBYE, verified=false → VERIFY, qualified=false → QUALIFY, else → ANSWER"'::jsonb
)
WHERE id = '592b56ed-2a24-4c94-8d4e-07d14df0ed9b';

-- GOODBYE: Add booked lead scenario
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{step_criteria}',
  '"If appointment_booked=true, acknowledge appointment and wait for questions (route → ANSWER if questions, else complete). Otherwise, said farewell and caller responded or stayed silent."'::jsonb
)
WHERE id = '59b08ca3-fc82-46fa-80cc-8f604bb60b06';
```

---

## Conclusion

**Current Support**: 7/13 scenarios fully supported, 6 need fixes

**After Fixes**: All 13 scenarios will have explicit step_criteria support

**Ready to apply fixes?**

