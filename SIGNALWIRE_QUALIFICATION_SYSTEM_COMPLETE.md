# SignalWire Granular Qualification System - Implementation Complete

**Date:** November 22, 2025
**Status:** ✅ Complete - Backwards Compatible with LiveKit

## Summary

Implemented granular qualification system in SignalWire to match LiveKit's qualification architecture. Both systems now use identical database fields and routing logic for lead qualification.

## What Was Built

### 1. New Qualification Tools (`swaig-agent/tools/qualification.py`)

Created four new SWAIG functions to update granular qualification fields in the `leads` table:

- **`mark_age_qualified`** → Updates `leads.age_qualified = TRUE`
- **`mark_homeowner_qualified`** → Updates `leads.homeowner_qualified = TRUE`
- **`mark_primary_residence_qualified`** → Updates `leads.primary_residence_qualified = TRUE`
- **`mark_equity_qualified`** → Updates `leads.equity_qualified = TRUE`

Each function:
- Looks up the lead by phone number
- Updates the respective boolean field in the `leads` table
- Triggers the database trigger to recompute `leads.qualified` automatically
- Returns a natural language response to the AI

### 2. Function Registration (`swaig-agent/main.py`)

**Added to function list:**
```python
"function": [
    ...
    "mark_qualified",
    "mark_qualification_result",
    "mark_age_qualified",  # New
    "mark_homeowner_qualified",  # New
    "mark_primary_residence_qualified",  # New
    "mark_equity_qualified",  # New
    ...
]
```

**Added function declarations:**
```python
"mark_age_qualified": {
    "function": "mark_age_qualified",
    "description": "Mark that the caller is 62+ years old (FHA requirement)...",
    "parameters": {"type": "object", "properties": {}}
},
# + 3 more
```

**Added routing handlers:**
```python
elif function_name == "mark_age_qualified":
    result = await mark_age_qualified(caller_id)
elif function_name == "mark_homeowner_qualified":
    result = await mark_homeowner_qualified(caller_id)
elif function_name == "mark_primary_residence_qualified":
    result = await mark_primary_residence_qualified(caller_id)
elif function_name == "mark_equity_qualified":
    result = await mark_equity_qualified(caller_id)
```

### 3. Updated Qualify Context (`swaig-agent/services/contexts.py`)

**Updated functions available in qualify context:**
```python
"qualify": [
    "mark_qualified",  # Legacy (for backwards compatibility)
    "mark_age_qualified",  # New granular tool
    "mark_homeowner_qualified",  # New granular tool
    "mark_primary_residence_qualified",  # New granular tool
    "mark_equity_qualified",  # New granular tool
    "route_conversation"
],
```

### 4. Database Trigger

**Created trigger to auto-compute `qualified`:**
```sql
CREATE OR REPLACE FUNCTION update_lead_qualified_status()
RETURNS TRIGGER AS $$
BEGIN
    NEW.qualified = NEW.age_qualified AND NEW.homeowner_qualified 
                    AND NEW.primary_residence_qualified AND NEW.equity_qualified;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_lead_qualified_status
BEFORE INSERT OR UPDATE OF age_qualified, homeowner_qualified, 
                          primary_residence_qualified, equity_qualified ON leads
FOR EACH ROW
EXECUTE FUNCTION update_lead_qualified_status();
```

### 5. Database Prompt Updated

**Created agent-led qualification prompt:**
- Greets and explains qualifications
- Checks context to see which gates are already qualified
- Only asks about missing gates
- Calls granular tools as each gate is confirmed
- Provides natural conversation style

## Database Schema

**Existing fields (already in database):**
```sql
age_qualified BOOLEAN DEFAULT FALSE
homeowner_qualified BOOLEAN DEFAULT FALSE
primary_residence_qualified BOOLEAN DEFAULT FALSE
equity_qualified BOOLEAN DEFAULT FALSE
qualified BOOLEAN DEFAULT FALSE  -- Summary field
```

**How it works:**
- When any of the 4 granular fields changes
- The trigger automatically sets `qualified = age_qualified AND homeowner_qualified AND primary_residence_qualified AND equity_qualified`
- Both LiveKit and SignalWire read `leads.qualified` to determine if the lead can skip qualification

## How Qualification Works Now

### On Call Start
1. **Fetch lead from database** (`leads.qualified`)
2. **Sync to conversation_state:**
   - `conversation_state.qualified` ← `leads.qualified`
3. **Route based on status:**
   - If `qualified=TRUE` → Skip to "quote" or "answer"
   - If `qualified=FALSE` → Start at "qualify"

### During Qualify Context
1. **AI greets** and explains qualifications
2. **AI checks each gate** (age → homeowner → residence → equity)
3. **AI calls granular tools** as each is confirmed:
   - `mark_age_qualified()` → Sets `leads.age_qualified = TRUE`
   - `mark_homeowner_qualified()` → Sets `leads.homeowner_qualified = TRUE`
   - `mark_primary_residence_qualified()` → Sets `leads.primary_residence_qualified = TRUE`
   - `mark_equity_qualified()` → Sets `leads.equity_qualified = TRUE`
4. **Database trigger** automatically updates `leads.qualified = TRUE` when all four are qualified
5. **Routing logic** checks `conversation_state.qualified` to decide next node

### Future Calls
- Lead with `qualified=TRUE` in database → Skips qualification entirely
- Lead with partial qualification (e.g., age and homeowner only) → AI only asks about missing gates

## Backwards Compatibility

✅ **SignalWire ↔ LiveKit Compatibility:**
- Both systems read/write the same database fields
- Both use identical routing logic
- A lead qualified in LiveKit will skip qualification in SignalWire (and vice versa)

✅ **Legacy Support:**
- Old `mark_qualified` function still exists for backwards compatibility
- New systems should use the four granular tools for better UX

## Complete Feature Parity

| Feature | Verify | Qualify |
|---------|--------|---------|
| **Granular fields** | ✅ 3 fields | ✅ 4 fields |
| **Auto-computed summary** | ✅ `verified` | ✅ `qualified` |
| **Agent leads conversation** | ✅ Yes | ✅ Yes |
| **Database prompt** | ✅ Yes | ✅ Yes |
| **Granular tools** | ✅ 3 tools | ✅ 4 tools |
| **Context-aware** | ✅ Yes | ✅ Yes |
| **Skip if complete** | ✅ Yes | ✅ Yes |
| **SignalWire support** | ✅ Yes | ✅ Yes |
| **LiveKit support** | ✅ Yes | ✅ Yes |

## Testing Checklist

- [ ] **Test 1:** New lead (unqualified) → Agent checks all 4 gates
- [ ] **Test 2:** Partially qualified lead → Agent only checks missing gates
- [ ] **Test 3:** Fully qualified lead → Agent skips qualification entirely
- [ ] **Test 4:** Qualified lead → Agent skips to "quote" or "answer" node
- [ ] **Test 5:** Cross-system test: Qualify in LiveKit → Call via SignalWire (should skip qualification)

## Files Changed

1. ✅ `swaig-agent/tools/qualification.py` (NEW)
2. ✅ `swaig-agent/main.py` (Updated)
3. ✅ `swaig-agent/services/contexts.py` (Updated)
4. ✅ Database trigger created (via Supabase MCP)
5. ✅ Database prompt updated (via Supabase MCP)

## Next Steps

1. **Test with real calls** to ensure smooth qualification flow
2. **Monitor logs** for granular tool calls
3. **Verify cross-system compatibility** (LiveKit ↔ SignalWire)

---

## Architecture Notes

Both systems now follow this pattern:

```
Call Start
    ↓
Fetch leads.qualified
    ↓
Sync to conversation_state.qualified
    ↓
Route based on flag:
    - qualified=F → qualify
    - qualified=T → quote/answer
    ↓
During qualify: Use granular tools to update leads table
    ↓
Database trigger recomputes leads.qualified
    ↓
Routing checks qualified to proceed
```

This ensures:
- ✅ Consistent state across LiveKit and SignalWire
- ✅ No duplicate qualification across channels
- ✅ Granular tracking for better UX
- ✅ Automatic qualification status updates via database triggers
- ✅ Context-aware qualification (only asks for missing gates)




