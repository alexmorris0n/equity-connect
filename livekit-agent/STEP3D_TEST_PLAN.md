# Step 3D: Test Plan - step_criteria_lk Field Migration

## 🎯 Test Objective

Validate that the LiveKit agent correctly uses `step_criteria_lk` (LiveKit-optimized boolean expressions) with proper fallback to legacy `step_criteria` during the migration period.

**Test Approach:** Use the 13 scenarios from `trace_test.md` to validate node completion logic.

---

## 📋 Test Environment Setup

### **Prerequisites**

1. ✅ Database has `step_criteria_lk` field (from migration)
2. ✅ Code changes deployed (field loading + fallback logic)
3. ✅ LiveKit agent is running
4. ✅ Access to Fly.io logs or local logs

### **Test Data States**

We'll test three database states:

**State A: All nodes using `step_criteria_lk` (NEW)**
- All 9 nodes have `step_criteria_lk` populated
- Tests the primary path

**State B: Mixed state (TRANSITION)**
- Some nodes have `step_criteria_lk`, some don't
- Tests the fallback logic

**State C: Legacy state (BACKWARD COMPATIBILITY)**
- No nodes have `step_criteria_lk`
- All use legacy `step_criteria`
- Tests full backward compatibility

---

## 🧪 Test Scenarios (from trace_test.md)

### **Category 1: Happy Path (3 scenarios)**

#### **Scenario 1: Perfect Qualified Lead**
**Flow:** GREET → VERIFY → QUALIFY → QUOTE → BOOK → GOODBYE

**What to Test:**
1. **GREET completion**
   - Expected criteria: `greet_turn_count >= 2 OR greeted == True`
   - Test: Does GREET stay for 2+ turns?
   - Expected log: `✅ Evaluated step_criteria for greet: 'greet_turn_count >= 2 OR greeted == True' → True`

2. **VERIFY completion**
   - Expected criteria: `verified == True`
   - Test: Does VERIFY complete after verification?
   - Expected log: `✅ Evaluated step_criteria for verify: 'verified == True' → True`

3. **QUALIFY completion**
   - Expected criteria: `qualified != None OR has_objection == True`
   - Test: Does QUALIFY complete after qualification?
   - Expected log: `✅ Evaluated step_criteria for qualify: 'qualified != None OR has_objection == True' → True`

4. **QUOTE completion**
   - Expected criteria: `quote_presented == True OR has_objection == True`
   - Test: Does QUOTE complete after presenting?
   - Expected log: `✅ Evaluated step_criteria for quote: 'quote_presented == True OR has_objection == True' → True`

5. **BOOK completion**
   - Expected criteria: `appointment_booked == True OR manual_booking_required == True`
   - Test: Does BOOK complete after booking?
   - Expected log: `✅ Evaluated step_criteria for book: 'appointment_booked == True OR manual_booking_required == True' → True`

**✅ PASS Criteria:**
- All nodes complete at correct times
- All logs show `step_criteria_lk` being evaluated
- Flow completes as expected

**⚠️ FAIL Indicators:**
- Node completes too early
- Node never completes
- Wrong field is used (legacy instead of new)

---

#### **Scenario 2: Unqualified Lead Asking Amounts**
**Flow:** GREET → QUOTE → QUALIFY → GOODBYE

**What to Test:**
1. **GREET early routing**
   - Test: User asks "How much can I get?" immediately
   - Expected: Routes to QUOTE (not based on completion, but on intent)
   - Log: `⏳ Node 'greet' not complete yet` (turn count < 2)

2. **QUALIFY disqualification**
   - Expected criteria: `qualified != None OR has_objection == True`
   - Test: After setting `qualified=false`, does it complete?
   - Expected log: `✅ Evaluated step_criteria for qualify: 'qualified != None OR has_objection == True' → True`

**✅ PASS Criteria:**
- GREET can route early based on intent (not completion)
- QUALIFY completes correctly with `qualified=false`

---

#### **Scenario 3: Pre-Qualified Returning Caller**
**Flow:** GREET (or ANSWER) → BOOK → GOODBYE

**What to Test:**
1. **State preservation**
   - Pre-existing flags: `greeted=true, verified=true, qualified=true, quote_presented=true`
   - Test: Does agent recognize returning caller?

2. **GREET completion check**
   - Expected: `greet_turn_count >= 2 OR greeted == True`
   - Test: Should complete immediately because `greeted=true` is already set
   - Expected log: `✅ Evaluated step_criteria for greet: 'greet_turn_count >= 2 OR greeted == True' → True`

**✅ PASS Criteria:**
- Agent recognizes pre-set flags
- Nodes complete instantly when criteria already met
- No unnecessary questions asked

---

### **Category 2: Objection Paths (3 scenarios)**

#### **Scenario 4: Objection After Quote**
**Flow:** GREET → VERIFY → QUALIFY → QUOTE → OBJECTIONS → BOOK → GOODBYE

**What to Test:**
1. **QUOTE completion with objection**
   - Expected criteria: `quote_presented == True OR has_objection == True`
   - Test: Should complete when `has_objection=true` is set
   - Expected log: `✅ Evaluated step_criteria for quote: 'quote_presented == True OR has_objection == True' → True`

2. **OBJECTIONS completion**
   - Expected criteria: `objection_handled == True`
   - Test: Only completes after objection is addressed
   - Expected log: `✅ Evaluated step_criteria for objections: 'objection_handled == True' → True`

**✅ PASS Criteria:**
- QUOTE completes on objection detection
- OBJECTIONS routes correctly after handling

---

#### **Scenario 5: Multiple Objections**
**Flow:** QUOTE → OBJECTIONS (cycle) → OBJECTIONS → GOODBYE

**What to Test:**
1. **Multiple OBJECTIONS cycles**
   - Test: Does OBJECTIONS complete after each objection?
   - Expected: Completes and re-enters multiple times

2. **Persistent hesitation detection**
   - Test: After 2+ objections, does it route to GOODBYE?

**✅ PASS Criteria:**
- OBJECTIONS can complete and re-enter
- Eventually routes to appropriate node

---

#### **Scenario 6: Objection During QUALIFY**
**Flow:** GREET → VERIFY → QUALIFY → OBJECTIONS → QUALIFY → ...

**What to Test:**
1. **QUALIFY early routing to OBJECTIONS**
   - Expected criteria: `qualified != None OR has_objection == True`
   - Test: Should complete when `has_objection=true` is set
   - Expected log: `✅ Evaluated step_criteria for qualify: 'qualified != None OR has_objection == True' → True`

2. **Resume qualification after objection**
   - Test: Can return to QUALIFY and complete?

**✅ PASS Criteria:**
- QUALIFY can route to OBJECTIONS mid-flow
- Can resume and complete normally

---

### **Category 3: Edge Cases (4 scenarios)**

#### **Scenario 7: Calculation Question in ANSWER**
**Flow:** ... → ANSWER → QUOTE → ...

**What to Test:**
1. **ANSWER early routing (not completion-based)**
   - Test: User asks "How much can I get?" in ANSWER
   - Expected: Routes to QUOTE immediately (not based on completion)
   - Log: `⏳ Node 'answer' not complete yet`

2. **ANSWER completion criteria**
   - Expected: `questions_answered == True OR ready_to_book == True OR has_objections == True`
   - Test: Should complete after answering question

**✅ PASS Criteria:**
- ANSWER can route to QUOTE on calculation intent
- Completion criteria still works correctly

---

#### **Scenario 8: Wrong Person Then Right Person**
**Flow:** GREET → GOODBYE → GREET → ...

**What to Test:**
1. **GREET with wrong person**
   - Expected: Should complete even if criteria not met (special case)
   - Test: Routes to GOODBYE after `mark_wrong_person()`

2. **GOODBYE "waiting" state**
   - Expected criteria: `True` (always complete)
   - Test: Can route back to GREET for new person

**✅ PASS Criteria:**
- Wrong person routing works
- Can restart conversation for correct person

---

#### **Scenario 9: Borderline Equity (Low Net Proceeds)**
**Flow:** GREET → VERIFY → QUALIFY → QUOTE → OBJECTIONS/GOODBYE

**What to Test:**
1. **QUALIFY with borderline_equity flag**
   - Expected criteria: `qualified != None OR has_objection == True`
   - Test: Sets `qualified=true` AND `borderline_equity=true`

2. **QUOTE with low proceeds**
   - Expected: Completes normally
   - Test: Routes to OBJECTIONS or GOODBYE based on reaction

**✅ PASS Criteria:**
- Borderline equity flag is set correctly
- Routing handles low proceeds gracefully

---

#### **Scenario 10: Booked Lead Calls Back with Questions**
**Flow:** GOODBYE → ANSWER → GOODBYE

**What to Test:**
1. **GOODBYE starting node**
   - Pre-existing: `appointment_booked=true, appointment_datetime='2025-11-21T14:00:00'`
   - Expected criteria: `True` (always complete)
   - Test: Can route to ANSWER for questions

2. **ANSWER → GOODBYE return**
   - Test: After answering, routes back to GOODBYE

**✅ PASS Criteria:**
- GOODBYE can start conversation for booked leads
- Bidirectional routing works

---

### **Category 4: Failure Modes (3 scenarios)**

#### **Scenario 11: Tool Failure During BOOK**
**Flow:** ... → BOOK → GOODBYE

**What to Test:**
1. **BOOK completion with failure**
   - Expected criteria: `appointment_booked == True OR manual_booking_required == True`
   - Test: After tool fails, sets `manual_booking_required=true`
   - Expected log: `✅ Evaluated step_criteria for book: 'appointment_booked == True OR manual_booking_required == True' → True`

**✅ PASS Criteria:**
- Completes even on tool failure
- Manual booking flag triggers completion

---

#### **Scenario 12: Knowledge Base Search Timeout**
**Flow:** ... → ANSWER → ...

**What to Test:**
1. **ANSWER completion despite KB failure**
   - Expected: Uses fallback response, still completes
   - Test: `questions_answered=true` can be set manually

**✅ PASS Criteria:**
- Completion works even if tools fail

---

#### **Scenario 13: Unexpected Disqualification in QUOTE**
**Flow:** ... → QUOTE → GOODBYE

**What to Test:**
1. **QUOTE late disqualification**
   - Test: Can call `mark_qualification_result(qualified=false)` in QUOTE
   - Expected: Node completes and routes to GOODBYE

**✅ PASS Criteria:**
- Late disqualification is handled
- Routes to GOODBYE correctly

---

## 🔍 Log Patterns to Look For

### **✅ SUCCESS Patterns**

#### **1. Using step_criteria_lk (primary path)**
```
✅ Evaluated step_criteria for greet: 'greet_turn_count >= 2 OR greeted == True' → True
```

#### **2. Using legacy step_criteria (fallback)**
```
ℹ️ Node 'greet' using legacy 'step_criteria' field (step_criteria_lk not yet populated)
✅ Evaluated step_criteria for greet: 'greet_turn_count >= 2 OR greeted == True' → True
```

#### **3. Node not complete yet**
```
⏳ Node 'greet' not complete yet
```

#### **4. Hardcoded fallback (safety net)**
```
Could not load step_criteria from DB: ..., using fallback
⏸️ Using hardcoded fallback criteria for greet
```

---

### **⚠️ WARNING Patterns (expected during migration)**

```
ℹ️ Node 'greet' using legacy 'step_criteria' field (step_criteria_lk not yet populated)
```
**Meaning:** Node hasn't been migrated to `step_criteria_lk` yet  
**Action:** Normal during transition period

---

### **❌ ERROR Patterns (need investigation)**

#### **1. Evaluation error**
```
⚠️ step_criteria evaluation failed for greet: <error>, using fallback
```
**Meaning:** Expression syntax error or evaluation failure  
**Action:** Check database for malformed expression

#### **2. DB load error**
```
Could not load step_criteria from DB: <error>, using fallback
```
**Meaning:** Database connection or query failed  
**Action:** Check Supabase connection

#### **3. Node never completes**
```
⏳ Node 'greet' not complete yet
⏳ Node 'greet' not complete yet
⏳ Node 'greet' not complete yet
[repeats indefinitely]
```
**Meaning:** Criteria never evaluates to true  
**Action:** Check expression logic

---

## 📊 Test Execution Checklist

### **Phase 1: Local/Staging Testing**

#### **Test 1: Field Loading**
```bash
# Check logs on agent startup
grep "step_criteria" logs/livekit-agent.log

# Expected: Should show field loading from prompt_loader.py
```

**✅ Pass if:** Logs show fields being loaded

#### **Test 2: Single Call - Happy Path (Scenario 1)**
```bash
# Make test call
# Expected flow: GREET → VERIFY → QUALIFY → QUOTE → BOOK → GOODBYE

# Check logs
grep "Evaluated step_criteria" logs/livekit-agent.log
```

**✅ Pass if:**
- Each node completion is logged
- All use `step_criteria_lk` (or legacy with info message)
- Flow completes as expected

#### **Test 3: Single Call - Early Routing (Scenario 2)**
```bash
# Make test call, ask for amounts immediately
# Expected: GREET routes to QUOTE early

# Check logs
grep "not complete yet" logs/livekit-agent.log
```

**✅ Pass if:**
- GREET shows "not complete yet" but still routes
- Intent-based routing works despite incomplete criteria

#### **Test 4: Returning Caller (Scenario 3)**
```bash
# Set up pre-existing state in DB
# Make test call
# Expected: Recognizes existing flags, skips steps

# Check logs
grep "Evaluated step_criteria" logs/livekit-agent.log
```

**✅ Pass if:**
- Nodes complete instantly when flags already set
- No unnecessary questions

---

### **Phase 2: Migration Testing**

#### **Test 5: Mixed Database State**
```bash
# Database setup:
# - greet, verify, qualify have step_criteria_lk
# - quote, answer, book use legacy step_criteria
# - objections, goodbye, end use hardcoded

# Make test call through entire flow

# Check logs
grep "using legacy 'step_criteria' field" logs/livekit-agent.log
grep "Evaluated step_criteria" logs/livekit-agent.log
```

**✅ Pass if:**
- First 3 nodes use `step_criteria_lk`
- Next 3 nodes show legacy field message
- Last 3 nodes use hardcoded fallback
- Conversation completes normally

---

#### **Test 6: Full Legacy State (Backward Compatibility)**
```bash
# Database setup:
# - NO nodes have step_criteria_lk populated
# - All use legacy step_criteria field

# Make test call

# Check logs
grep "using legacy 'step_criteria' field" logs/livekit-agent.log
```

**✅ Pass if:**
- All nodes show legacy field usage
- Everything works as before
- No errors or warnings

---

### **Phase 3: Edge Case Testing**

#### **Test 7: Objection Cycles (Scenarios 4-6)**
```bash
# Make test call with multiple objections

# Check logs
grep "Evaluated step_criteria for objections" logs/livekit-agent.log
```

**✅ Pass if:**
- OBJECTIONS completes and re-enters correctly
- Eventually routes out appropriately

#### **Test 8: Tool Failures (Scenarios 11-13)**
```bash
# Simulate tool failure (disconnect KB or calendar)
# Make test call

# Check logs
grep "manual_booking_required" logs/livekit-agent.log
```

**✅ Pass if:**
- Fallback flags trigger completion
- Conversation doesn't get stuck

---

## 🎯 Test Success Criteria

### **Overall Test Pass:**
✅ All 13 scenarios complete as expected  
✅ No conversation gets stuck  
✅ Fallback logic works in all cases  
✅ Logs are clear and actionable  
✅ No unexpected errors  

### **Field Usage Validation:**
✅ Nodes with `step_criteria_lk` use it primarily  
✅ Nodes without `step_criteria_lk` fall back to `step_criteria`  
✅ Nodes without either fall back to hardcoded  
✅ Fallback transitions are smooth  

### **Backward Compatibility:**
✅ Agent works with all `step_criteria_lk` populated  
✅ Agent works with no `step_criteria_lk` populated  
✅ Agent works with mixed population  
✅ No breaking changes observed  

---

## 📝 Test Report Template

```markdown
# Step 3D Test Results

## Test Environment
- Date: [DATE]
- Agent Version: [VERSION]
- Database State: [All new / Mixed / All legacy]
- Tester: [NAME]

## Test Results

### Scenario 1: Perfect Qualified Lead
- Flow: ✅ PASS / ❌ FAIL
- Field Usage: [step_criteria_lk / step_criteria / hardcoded]
- Issues: [None / List issues]
- Logs: [Paste relevant logs]

### Scenario 2: Unqualified Lead
- Flow: ✅ PASS / ❌ FAIL
- Field Usage: [...]
- Issues: [...]

[Continue for all 13 scenarios...]

## Overall Assessment
- ✅ APPROVED FOR PRODUCTION
- ⚠️ APPROVED WITH MINOR ISSUES (list issues)
- ❌ BLOCKED (list critical issues)

## Recommendations
1. [Any recommendations]
2. [...]
```

---

## 🚀 Deployment Readiness

### **Ready to Deploy if:**
✅ All critical scenarios pass (1, 2, 7)  
✅ Fallback logic works  
✅ No breaking changes observed  
✅ Logs are helpful for debugging  

### **Block Deployment if:**
❌ Any conversation gets permanently stuck  
❌ Node never completes when it should  
❌ Fallback logic fails  
❌ Critical scenario fails  

---

**Test Plan Complete! Ready for execution.** 🎯

