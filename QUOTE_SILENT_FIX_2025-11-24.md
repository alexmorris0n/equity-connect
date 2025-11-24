# Issue 3: QUOTE Node Gets Stuck Silent - November 24, 2025

## Problem
When Barbara enters the QUOTE node, she announces she'll calculate, then goes **completely silent** for 11+ seconds, then sends an empty response and the user hangs up.

## What Happened

**Barbara**: "Let me quickly calculate an estimate of the amount you might be able to access with a reverse mortgage based on your home value and age."

**[11 seconds of silence]**

**Barbara**: `~LN(English)-; ` (empty response)

**User**: [Hangs up]

## Root Cause

The QUOTE prompt says:
```
1. ⚠️ IMMEDIATELY call calculate_reverse_mortgage(property_value=X, age=Y, mortgage_balance=Z)
   DO NOT speak until you have the result.
```

**The Problem Chain:**
1. Barbara needs `property_value`, `age`, `mortgage_balance` to call the tool
2. These values are **NOT available** in the caller context (lead data not fully loaded)
3. She **cannot call the tool** without the required parameters
4. The prompt instructs: **"DO NOT speak until you have the result"**
5. She **waits indefinitely** for a result that will never come
6. Eventually sends empty response and conversation dies

## Why Data Was Missing

Looking at the lead data from the call:
- ✅ Name: "Testy Mctesterson"
- ✅ Qualified: true
- ✅ Verified: false
- ❌ property_value: **NOT in context**
- ❌ age: **NOT in context**
- ❌ mortgage_balance: **NOT in context**

The `build_context_injection()` function only includes basic info, not detailed property/financial data needed for calculations.

## The Fix

### Option 1: Add Data Validation (Recommended)
Add an ENTRY CHECK that verifies data availability BEFORE attempting calculation:

```
ENTRY CHECK:
- If quote_presented=true: "I already provided your estimate..."
  → Do NOT recalculate

- If missing property_value OR age OR mortgage_balance:
  "To provide an accurate estimate, I need a few details:
   - What is your home currently worth?
   - How old are you?
   - Do you have a mortgage balance, and if so, roughly how much?"
  → Collect data FIRST, then proceed to calculation

=== QUOTE PROCESS ===
1. ⚠️ VERIFY you have: property_value, age, mortgage_balance
2. ⚠️ IMMEDIATELY call calculate_reverse_mortgage(property_value=X, age=Y, mortgage_balance=Z)
   DO NOT speak until you have the result.
...
```

### Option 2: Make Data Collection Part of Process
Change instruction #1 to handle missing data gracefully:

```
1. Check if you have the required data (property_value, age, mortgage_balance):
   
   IF MISSING:
   a) Ask for missing values conversationally:
      "To give you an estimate, can you tell me:
       - What's your home currently worth?
       - How old are you?
       - Do you still owe on a mortgage?"
   b) WAIT for their response
   c) Call update_lead_info() to save the data
   d) THEN proceed to calculation
   
   IF HAVE ALL DATA:
   a) ⚠️ IMMEDIATELY call calculate_reverse_mortgage(property_value=X, age=Y, mortgage_balance=Z)
   b) DO NOT speak until you have the result
...
```

## Migration SQL

```sql
-- Fix QUOTE node to handle missing data gracefully

UPDATE prompt_versions
SET content = jsonb_set(
    content,
    '{instructions}',
    to_jsonb(E'ENTRY CHECK:\n- If quote_presented=true: "I already provided your estimate. Would you like me to explain anything about those numbers or help you with next steps?"\n  → Do NOT recalculate, guide them based on their needs\n\n- If missing property_value OR age OR mortgage_balance from caller information:\n  "To provide an accurate estimate, I need a few quick details:\n   • What is your home currently worth?\n   • How old are you?\n   • Do you have a mortgage balance, and if so, roughly how much?"\n  → Collect missing data FIRST, save with update_lead_info(), THEN proceed to calculation\n\n=== QUOTE PROCESS ===\n\n1. ⚠️ VERIFY you have all required data: property_value, age, mortgage_balance\n   If ANY are missing, ask for them (see ENTRY CHECK above)\n\n2. ⚠️ IMMEDIATELY call calculate_reverse_mortgage(property_value=X, age=Y, mortgage_balance=Z)\n   Example: Home worth $400k, age 68, owes $200k → calculate_reverse_mortgage(property_value=400000, age=68, mortgage_balance=200000)\n   DO NOT speak until you have the result.\n\n3. Present the result conversationally:\n   "Based on your home value and age, you have approximately $X available to access. Your broker will confirm the exact figures, but this gives you a good idea of what is possible."\n\n4. ⚠️ IMMEDIATELY call mark_quote_presented()\n   DO NOT route until tool is called.\n\n5. Route based on their response:\n   - Questions about the quote → stay in QUOTE or route to ANSWER\n   - Disappointment or concerns → route to OBJECTIONS\n   - Ready to move forward → route to BOOK\n   - Not interested → route to GOODBYE\n\n=== LATE DISQUALIFICATION ===\nIf user reveals disqualifying info during QUOTE (e.g., "Oh it is actually a rental"):\n1. Call mark_qualification_result(qualified=false, reason="specific_reason")\n2. Route to GOODBYE for empathetic explanation'),
    true
)
WHERE prompt_id = (
    SELECT id FROM prompts 
    WHERE node_name = 'quote' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND is_active = true;

-- Also add update_lead_info to available tools for QUOTE node
UPDATE prompt_versions
SET content = jsonb_set(
    content,
    '{functions}',
    (content->'functions')::jsonb || '["update_lead_info"]'::jsonb,
    true
)
WHERE prompt_id = (
    SELECT id FROM prompts 
    WHERE node_name = 'quote' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND is_active = true;
```

## Expected Behavior After Fix

### Scenario 1: Data Available
**Barbara enters QUOTE with data** → Calculates immediately → Presents quote ✅

### Scenario 2: Data Missing (the fix)
**Barbara enters QUOTE without data** → Asks for missing values → User provides → Calculates → Presents quote ✅

**Old (broken):**
```
Barbara: "Let me calculate..."
[silence for 11+ seconds]
Barbara: [empty response]
User: [hangs up] ❌
```

**New (fixed):**
```
Barbara: "To provide an accurate estimate, I need a few quick details: 
         What is your home currently worth?"
User: "About 2 million"
Barbara: "How old are you?"
User: "65"
Barbara: "Do you have a mortgage balance?"
User: "No, it's paid off"
Barbara: [Calculates] "Based on your home value and age, you have approximately 
         $1 million available to access..." ✅
```

## Alternative: Load Data from Lead Record

If the data SHOULD be in the context but isn't, we need to fix `build_context_injection()` in `swaig-agent/services/prompts.py` to include:
- `property_value`
- `age` 
- `mortgage_balance` (or calculated_mortgage_balance, or whatever field stores it)

This way Barbara has the data available when she enters QUOTE.


