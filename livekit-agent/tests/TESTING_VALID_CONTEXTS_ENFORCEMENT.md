# Testing Guide: valid_contexts Enforcement (Step 1)

## Overview

This guide tests that `valid_contexts` enforcement works correctly in LiveKit, matching SignalWire's behavior where invalid transitions are **blocked** (fail closed).

## Test Strategy

### 1. Unit Tests (Automated)

**File:** `test_valid_contexts_enforcement.py`

Run tests:
```bash
cd livekit-agent
pytest tests/test_valid_contexts_enforcement.py -v
```

**Test Cases:**
- ✅ Valid transitions are allowed
- ✅ Invalid transitions are blocked
- ✅ "exit" is NOT automatically allowed (must be in valid_contexts)
- ✅ END constant is normalized to "exit"
- ✅ Empty valid_contexts allows all (backward compatible)
- ✅ Database errors fail open (backward compatible)

### 2. Integration Test Scenarios

#### Scenario A: Valid Transition (Should Work)

**Setup:**
1. Ensure `greet` node in database has `valid_contexts: ["verify", "exit"]`
2. Make a call
3. Agent greets user
4. User responds (completes greet node)

**Expected Behavior:**
- ✅ Router suggests `greet → verify`
- ✅ `validate_transition()` returns `(True, ["verify", "exit"])`
- ✅ Transition proceeds normally
- ✅ Log shows: `🧭 Router: greet → verify`
- ✅ Agent loads verify node

**Logs to Check:**
```
✅ Evaluated step_criteria for greet: 'greet_turn_count >= 2 OR greeted == True' → True
🧭 Router: greet → verify
📍 Loading node: verify
```

#### Scenario B: Invalid Transition (Should Block)

**Setup:**
1. Ensure `greet` node has `valid_contexts: ["verify"]` (NO "answer" in list)
2. Manually set DB flags to force router to suggest `greet → answer`
   - Set `lead_id` and `qualified=True` in conversation_state
3. Make a call and complete greet node

**Expected Behavior:**
- ❌ Router suggests `greet → answer`
- ❌ `validate_transition()` returns `(False, ["verify"])`
- ❌ Transition is **BLOCKED**
- ❌ Log shows: `❌ BLOCKED: Invalid transition greet → answer (valid: ['verify'])`
- ❌ Agent **stays in greet node** (doesn't transition)

**Logs to Check:**
```
❌ BLOCKED: Invalid transition greet → answer (valid: ['verify'])
⏸️  Staying in current node 'greet' - router suggested invalid transition
```

#### Scenario C: Exit Not Allowed (Should Block)

**Setup:**
1. Ensure `greet` node has `valid_contexts: ["verify"]` (NO "exit" in list)
2. Router suggests `greet → exit` (e.g., wrong person scenario)

**Expected Behavior:**
- ❌ Transition to "exit" is **BLOCKED**
- ❌ Agent stays in greet node
- ❌ Log shows error

**Note:** This might break wrong_person flow if "exit" isn't in valid_contexts. We may need to update database to include "exit" in greet's valid_contexts.

### 3. Manual Testing Checklist

#### Pre-Test Setup

1. **Check Database Configuration:**
   ```sql
   SELECT node_name, content->>'valid_contexts' as valid_contexts
   FROM prompt_versions
   WHERE vertical = 'reverse_mortgage' AND is_active = true
   ORDER BY node_name;
   ```

2. **Verify Test Scenarios:**
   - `greet` should have `valid_contexts: ["verify", "exit"]` (or similar)
   - `verify` should have `valid_contexts: ["qualify", "exit"]` (or similar)
   - `answer` should have `valid_contexts: ["objections", "book", "exit"]` (or similar)

#### Test 1: Normal Flow (Valid Transitions)

- [ ] Make call
- [ ] Complete greet node (2+ turns)
- [ ] Verify agent transitions to verify node
- [ ] Check logs for: `🧭 Router: greet → verify` (no error)
- [ ] Complete verify node
- [ ] Verify agent transitions to qualify node
- [ ] Check logs for: `🧭 Router: verify → qualify` (no error)

#### Test 2: Invalid Transition (Blocked)

**Option A: Temporarily Modify Database**
```sql
-- Remove "answer" from greet's valid_contexts
UPDATE prompt_versions
SET content = jsonb_set(
    content,
    '{valid_contexts}',
    '["verify"]'::jsonb
)
WHERE node_name = 'greet' AND vertical = 'reverse_mortgage' AND is_active = true;
```

- [ ] Make call with known qualified lead
- [ ] Router would normally suggest `greet → answer`
- [ ] Check logs for: `❌ BLOCKED: Invalid transition greet → answer`
- [ ] Verify agent **stays in greet node** (doesn't transition)
- [ ] **RESTORE DATABASE** after test

**Option B: Use Test Mode**
- [ ] Create test node with restricted valid_contexts
- [ ] Test blocking behavior
- [ ] Verify logs show blocking

#### Test 3: Exit Restriction

- [ ] Ensure a node (e.g., `answer`) has `valid_contexts: ["objections", "book"]` (NO "exit")
- [ ] Trigger router to suggest `answer → exit` (e.g., loop cap reached)
- [ ] Check logs for: `❌ BLOCKED: Invalid transition answer → exit`
- [ ] Verify agent stays in answer node

### 4. Log Verification

**Success Indicators:**
```
✅ Evaluated step_criteria for {node}: '{criteria}' → True
🧭 Router: {from_node} → {to_node}
📍 Loading node: {to_node}
```

**Blocking Indicators:**
```
❌ BLOCKED: Invalid transition {from_node} → {to_node} (valid: {valid_contexts})
⏸️  Staying in current node '{from_node}' - router suggested invalid transition
```

**No Transition Logs After Blocking:**
- Should NOT see: `📍 Loading node: {blocked_node}`
- Should NOT see: `🧭 Router: {from_node} → {blocked_node}` (success)

### 5. Database Verification

**Check Current valid_contexts:**
```sql
SELECT 
    p.node_name,
    pv.content->>'valid_contexts' as valid_contexts,
    pv.is_active
FROM prompts p
JOIN prompt_versions pv ON p.id = pv.prompt_id
WHERE p.vertical = 'reverse_mortgage'
  AND pv.is_active = true
ORDER BY p.node_name;
```

**Expected Results:**
- All nodes should have `valid_contexts` arrays
- Common patterns:
  - `greet`: `["verify", "exit"]`
  - `verify`: `["qualify", "exit"]`
  - `qualify`: `["quote", "exit"]`
  - `quote`: `["answer", "book", "exit"]`
  - `answer`: `["objections", "book", "exit"]`
  - `objections`: `["answer", "book", "exit"]`
  - `book`: `["exit"]`
  - `goodbye`: `[]` (terminal node)

### 6. Edge Cases

#### Case 1: Empty valid_contexts
- [ ] Node with empty `valid_contexts: []`
- [ ] Should allow all transitions (backward compatible)
- [ ] Logs should show: `🧭 Router: {from} → {to}` (no blocking)

#### Case 2: Database Unavailable
- [ ] Simulate database connection failure
- [ ] Should fail open (allow transition)
- [ ] Logs should show: `Could not validate transition: {error}, allowing it`

#### Case 3: Missing valid_contexts Key
- [ ] Node config missing `valid_contexts` key entirely
- [ ] Should allow all transitions (backward compatible)

### 7. Comparison with SignalWire

**SignalWire Behavior:**
- Invalid transitions are **blocked** by SDK
- Agent stays in current context
- No error logs (handled silently by SignalWire)

**LiveKit Behavior (After Step 1):**
- Invalid transitions are **blocked** by our code
- Agent stays in current node
- Error logs for debugging: `❌ BLOCKED: Invalid transition`

**Result:** ✅ **Behavior matches SignalWire** (with better logging)

## Rollback Plan

If blocking causes issues:

1. **Temporary Fix:** Comment out blocking code:
   ```python
   # if not is_valid:
   #     logger.error(...)
   #     return
   ```

2. **Permanent Fix:** Update database to include all needed transitions in `valid_contexts`

## Next Steps After Testing

1. ✅ Verify all tests pass
2. ✅ Verify manual tests show blocking behavior
3. ✅ Update database `valid_contexts` if needed
4. ✅ Proceed to Step 2: Filter router results by `valid_contexts`

