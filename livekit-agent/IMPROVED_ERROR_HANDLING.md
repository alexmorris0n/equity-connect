# Improved Error Handling for step_criteria Evaluation

## ✅ Changes Made

### **Problem**
Original error logging was too generic:
```python
logger.warning(f"⚠️ step_criteria evaluation failed for {node_name}: {eval_error}, using fallback")
```

**Issues:**
- Didn't show which expression failed
- Didn't show what state was available
- Hard to debug in production logs
- No context about why it failed

---

### **Solution**
Enhanced error logging with detailed context:

```python
logger.error(
    f"⚠️ step_criteria evaluation FAILED for node '{node_name}'\n"
    f"   Expression: '{step_criteria_lk}'\n"
    f"   State keys: {list(state.keys()) if state else 'empty'}\n"
    f"   Error: {type(eval_error).__name__}: {eval_error}\n"
    f"   Falling back to hardcoded criteria",
    exc_info=True
)
```

**Benefits:**
- ✅ Shows exact expression that failed
- ✅ Shows available state keys (for debugging)
- ✅ Shows error type and message
- ✅ Includes full stack trace with `exc_info=True`
- ✅ Clear indication of fallback behavior

---

## 📊 Error Log Examples

### **Example 1: Syntax Error in Expression**

**Scenario:** Database has malformed expression
```sql
step_criteria_lk = "greet_turn_count >= 2 AND"  -- Missing right side
```

**Log Output:**
```
⚠️ step_criteria evaluation FAILED for node 'greet'
   Expression: 'greet_turn_count >= 2 AND'
   State keys: ['greet_turn_count', 'greeted', 'phone_number']
   Error: SyntaxError: Unexpected end of expression after AND
   Falling back to hardcoded criteria
Traceback (most recent call last):
  File ".../node_completion.py", line 48, in is_node_complete
    result = evaluate_step_criteria(step_criteria_lk, state)
  File ".../step_criteria_evaluator.py", line 56, in evaluate_step_criteria
    result = _evaluate_expression(tokens, state)
  ...
```

**Action:** Fix database expression

---

### **Example 2: Field Type Mismatch**

**Scenario:** Comparing wrong types
```sql
step_criteria_lk = "greet_turn_count == 'two'"  -- Comparing number to string
```

**Log Output:**
```
⚠️ step_criteria evaluation FAILED for node 'greet'
   Expression: 'greet_turn_count == 'two''
   State keys: ['greet_turn_count', 'greeted']
   Error: TypeError: Cannot compare int with str
   Falling back to hardcoded criteria
```

**Action:** Fix type in expression

---

### **Example 3: Empty State**

**Scenario:** State dict is empty or None
```python
state = {}  # No flags set yet
```

**Log Output:**
```
⚠️ step_criteria evaluation FAILED for node 'greet'
   Expression: 'greeted == True'
   State keys: empty
   Error: KeyError: 'greeted'
   Falling back to hardcoded criteria
```

**Action:** This is actually normal for first turn - evaluator should handle gracefully (returns False)

---

### **Example 4: Database Load Error**

**Scenario:** Cannot connect to Supabase

**Log Output:**
```
❌ Could not load step_criteria from database for node 'greet'
   Vertical: reverse_mortgage
   Error: ConnectionError: Failed to connect to Supabase
   Falling back to hardcoded criteria
Traceback (most recent call last):
  File ".../node_completion.py", line 34, in is_node_complete
    config = load_node_config(node_name, vertical)
  File ".../prompt_loader.py", line 135, in load_node_config
    result = supabase.table('prompt_versions').select('*').execute()
  ...
```

**Action:** Check Supabase connection

---

## 🔍 How to Use These Logs

### **Debugging Steps**

1. **Check the Expression**
   ```
   Expression: 'greet_turn_count >= 2 AND'
   ```
   - Is syntax correct?
   - Are field names spelled correctly?
   - Are operators valid?

2. **Check Available State**
   ```
   State keys: ['greet_turn_count', 'greeted']
   ```
   - Does state have the fields used in expression?
   - Are field names matching exactly?

3. **Check Error Type**
   ```
   Error: SyntaxError: Unexpected end of expression after AND
   ```
   - Syntax error → Fix expression format
   - Type error → Fix type comparison
   - Key error → Field doesn't exist in state
   - Connection error → Check database

4. **Check Stack Trace**
   ```
   Traceback (most recent call last):
     ...
   ```
   - Shows exact line where it failed
   - Shows call chain
   - Helps pinpoint root cause

---

## 🛠️ Common Fixes

### **Fix 1: Syntax Errors**

**Problem:**
```sql
step_criteria_lk = "greet_turn_count >= 2 AND"
```

**Solution:**
```sql
step_criteria_lk = "greet_turn_count >= 2 AND greeted == True"
```

---

### **Fix 2: Missing Fields**

**Problem:**
```sql
step_criteria_lk = "greeting_count >= 2"  -- Wrong field name
```

**Solution:**
```sql
step_criteria_lk = "greet_turn_count >= 2"  -- Correct field name
```

---

### **Fix 3: Type Mismatches**

**Problem:**
```sql
step_criteria_lk = "greet_turn_count == '2'"  -- String comparison
```

**Solution:**
```sql
step_criteria_lk = "greet_turn_count >= 2"  -- Number comparison
```

---

### **Fix 4: Database Connection**

**Problem:**
```
Error: ConnectionError: Failed to connect to Supabase
```

**Solution:**
- Check `SUPABASE_URL` environment variable
- Check `SUPABASE_KEY` environment variable
- Check network connectivity
- Check Supabase service status

---

## 📝 Testing the Error Handling

### **Test 1: Invalid Expression**

```python
# In Supabase, temporarily set invalid expression
UPDATE prompt_versions
SET content = jsonb_set(content, '{step_criteria_lk}', '"greet_turn_count >= AND"')
WHERE content->>'node_name' = 'greet'
AND is_active = true;

# Make test call
# Check logs for detailed error message
```

**Expected Log:**
```
⚠️ step_criteria evaluation FAILED for node 'greet'
   Expression: 'greet_turn_count >= AND'
   State keys: [...]
   Error: SyntaxError: ...
   Falling back to hardcoded criteria
```

---

### **Test 2: Database Disconnect**

```bash
# Temporarily set wrong Supabase URL
export SUPABASE_URL="https://invalid.supabase.co"

# Restart agent
# Make test call
# Check logs
```

**Expected Log:**
```
❌ Could not load step_criteria from database for node 'greet'
   Vertical: reverse_mortgage
   Error: ConnectionError: ...
   Falling back to hardcoded criteria
```

---

## ✅ Benefits of Improved Error Handling

### **1. Faster Debugging**
- See exact problem immediately
- No need to guess what failed
- Can fix database issues without code changes

### **2. Better Production Monitoring**
- Can set up alerts on these errors
- Can track which expressions fail most often
- Can identify database connectivity issues

### **3. Clearer Logs**
- Anyone can understand what went wrong
- Non-technical stakeholders can read logs
- Easier to document and share issues

### **4. Safer Fallbacks**
- Always falls back gracefully
- Never breaks the conversation
- Users don't notice the failure

---

## 🎯 Summary

**Before:**
```python
logger.warning(f"⚠️ step_criteria evaluation failed for {node_name}: {eval_error}, using fallback")
```
- Generic
- Hard to debug
- Missing context

**After:**
```python
logger.error(
    f"⚠️ step_criteria evaluation FAILED for node '{node_name}'\n"
    f"   Expression: '{step_criteria_lk}'\n"
    f"   State keys: {list(state.keys()) if state else 'empty'}\n"
    f"   Error: {type(eval_error).__name__}: {eval_error}\n"
    f"   Falling back to hardcoded criteria",
    exc_info=True
)
```
- Detailed
- Easy to debug
- Full context
- Includes stack trace

---

**✅ Error handling improved! Ready for production debugging.**

