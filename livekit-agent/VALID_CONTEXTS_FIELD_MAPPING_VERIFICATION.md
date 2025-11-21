# valid_contexts Field Mapping Verification

## ✅ Database Structure Verified

**Project:** `mxnqfwuhvurajrgoefyg` (Equity Connect)

### Database Data (Confirmed via Supabase MCP)

```json
{
  "greet": ["answer", "verify", "quote"],
  "verify": ["qualify", "answer", "quote", "objections"],
  "qualify": ["goodbye", "quote", "objections"],
  "quote": ["answer", "book", "goodbye"],
  "answer": ["goodbye", "book", "objections", "quote"],
  "objections": ["answer", "book", "goodbye"],
  "book": ["goodbye"],
  "goodbye": ["answer"],
  "end": []
}
```

### Field Mapping Verification

**✅ CORRECT:** `load_node_config()` reads:
- `content.get('valid_contexts', [])` → Returns list (JSONB array parsed correctly)
- Field exists in database
- Data type: JSONB array (confirmed: `jsonb_typeof = "array"`)

## ⚠️ Node Name Mismatch Found

### Issue: Router Functions vs Database

**Router Functions Return:**
- `"exit"` (string) - Used for ending conversation
- `END` (langgraph constant) - Used for terminal state

**Database Has:**
- `"goodbye"` node (not "exit")
- `"end"` node (terminal, empty valid_contexts)

**Current Code:**
```python
# Line 36 in routers.py
to_node_normalized = "exit" if to_node == END else to_node
```

This normalizes `END` → `"exit"`, but database doesn't have `"exit"` - it has `"goodbye"`!

### Impact

1. Router returns `"exit"` → Validation checks for `"exit"` in valid_contexts
2. Database has `"goodbye"` → Validation fails (blocks transition)
3. Router returns `END` → Normalized to `"exit"` → Still fails

## 🔧 Required Fix

### Option 1: Normalize "exit" → "goodbye" (Recommended)

Update `validate_transition()` to map router's "exit" to database's "goodbye":

```python
# In validate_transition()
to_node_normalized = "exit" if to_node == END else to_node

# ADD THIS MAPPING:
if to_node_normalized == "exit":
    to_node_normalized = "goodbye"  # Map router's "exit" to DB's "goodbye"
```

### Option 2: Update Router Functions

Change all router functions to return `"goodbye"` instead of `"exit"`:
- More invasive (affects all router functions)
- Requires updating type hints
- Better long-term alignment with database

### Option 3: Add "exit" to Database

Add `"exit"` as alias for `"goodbye"` in database:
- Less clean (duplicate nodes)
- Not recommended

## ✅ Recommended Solution

**Use Option 1** - Normalize in validation function:

```python
def validate_transition(from_node: str, to_node: str, vertical: str = "reverse_mortgage") -> tuple[bool, list[str]]:
    # ... existing code ...
    
    if valid_contexts:
        # Normalize node names for comparison
        to_node_normalized = "exit" if to_node == END else to_node
        
        # Map router's "exit" to database's "goodbye"
        if to_node_normalized == "exit":
            to_node_normalized = "goodbye"
        
        is_valid = to_node_normalized in valid_contexts
        # ... rest of code ...
```

This way:
- Router functions can continue using `"exit"` (no breaking changes)
- Validation correctly maps to database's `"goodbye"`
- `END` constant → `"exit"` → `"goodbye"` (works correctly)

## 📋 Summary

| Component | Node Name | Status |
|-----------|-----------|--------|
| Database | `"goodbye"`, `"end"` | ✅ Correct |
| Router Functions | `"exit"`, `END` | ⚠️ Mismatch |
| Validation Code | Currently: `"exit"` | ❌ Needs mapping |
| Field Mapping | `content.get('valid_contexts')` | ✅ Correct |

**Action Required:** Add normalization mapping `"exit"` → `"goodbye"` in `validate_transition()`

