# QUALIFY Node - Equity Calculation Fix
**Date:** November 24, 2025  
**Status:** ✅ COMPLETE

## Problem
The QUALIFY node was only asking "Do you have a rough idea of what your home is worth?" without capturing actual property value or mortgage balance. Users typically don't know their equity, but they DO know:
1. What they think their home is worth
2. How much they owe on their mortgage

## Solution
Updated QUALIFY node to collect property value and mortgage balance, calculate equity, and store both values in the database.

---

## Changes Applied

### 1. Updated QUALIFY Prompt (Database)
**Changed equity question from:**
```
4. EQUITY:
   "Do you have a rough idea of what your home is worth?"
   → mark_equity_qualified(is_qualified=true)
```

**To:**
```
4. EQUITY (3-part question):
   a) "What do you think your home is worth today?"
      ⏸️ WAIT for answer
      Example: User says "About 400k" or "Maybe 350 thousand"
   
   b) "Do you have a mortgage on the property?"
      ⏸️ WAIT for answer
      - If YES → continue to part c
      - If NO → mortgage = 0, skip to calculation
   
   c) "How much do you still owe on your mortgage?"
      ⏸️ WAIT for answer
      Example: User says "200k" or "About 150 thousand"
   
   ⚠️ IMMEDIATELY call update_lead_info(property_value=X, estimated_equity=Y)
      WHERE: estimated_equity = property_value - mortgage_balance
      Example: Home worth $400k, owes $200k → update_lead_info(property_value=400000, estimated_equity=200000)
      Example: Home worth $350k, no mortgage → update_lead_info(property_value=350000, estimated_equity=350000)
   
   ⚠️ THEN call mark_equity_qualified(is_qualified=true)
   DO NOT proceed until BOTH tools are called.
```

### 2. Updated `update_lead_info` Tool Definition (main.py)
**Added `property_value` parameter:**
```python
"update_lead_info": {
    "function": "update_lead_info",
    "description": "Update lead information (name, address, property details, etc.)",
    "parameters": {
        "type": "object",
        "properties": {
            # ... other fields ...
            "age": {"type": "integer", "description": "Caller's age"},
            "property_value": {"type": "number", "description": "Estimated property value"},  # NEW
            "estimated_equity": {"type": "number", "description": "Estimated home equity (property_value - mortgage)"}
        }
    }
},
```

### 3. Updated `update_lead_info` Implementation (tools/lead.py)
**Added handling for `property_value`:**
```python
if 'property_value' in args and args['property_value']:
    update_data['property_value'] = float(args['property_value'])
if 'estimated_equity' in args and args['estimated_equity']:
    update_data['estimated_equity'] = float(args['estimated_equity'])
```

---

## Database Schema
The `leads` table stores:
- ✅ `property_value` (numeric) - What user thinks home is worth
- ✅ `estimated_equity` (numeric) - Calculated as `property_value - mortgage_balance`
- ❌ `mortgage_balance` - NOT stored (only used for calculation)

---

## Conversation Flow Example

**Scenario 1: Has Mortgage**
```
Barbara: "What do you think your home is worth today?"
User: "About 400 thousand"

Barbara: "Do you have a mortgage on the property?"
User: "Yes"

Barbara: "How much do you still owe on your mortgage?"
User: "About 200k"

→ Stores: property_value=400000, estimated_equity=200000
→ Calls: mark_equity_qualified(is_qualified=true)
```

**Scenario 2: No Mortgage (Paid Off)**
```
Barbara: "What do you think your home is worth today?"
User: "Maybe 350k"

Barbara: "Do you have a mortgage on the property?"
User: "No, it's paid off"

→ Stores: property_value=350000, estimated_equity=350000
→ Calls: mark_equity_qualified(is_qualified=true)
```

---

## Related Fixes
This fix also addresses the QUOTE node silence issue:
- QUOTE node uses `calculate_reverse_mortgage(property_value, age, equity)`
- Now `property_value` and `estimated_equity` are both stored during QUALIFY
- Both values injected into context for QUOTE node
- Barbara can successfully call the calculation tool with real data

---

## Files Modified
1. `prompts` table (via SQL UPDATE) - QUALIFY node instructions
2. `swaig-agent/main.py` - Tool definition
3. `swaig-agent/tools/lead.py` - Tool implementation

## Testing Checklist
- [ ] Call Barbara and go through QUALIFY node
- [ ] Verify she asks for property value
- [ ] Verify she asks if you have a mortgage
- [ ] Verify she asks for mortgage balance (if yes)
- [ ] Verify `property_value` is stored in DB
- [ ] Verify `estimated_equity` is calculated and stored correctly
- [ ] Verify QUOTE node can now successfully present a quote


