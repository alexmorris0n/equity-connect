# Fix: QUOTE Node Missing Data - November 24, 2025

## Summary
Barbara went silent in QUOTE because she needs `property_value`, `age`, and `mortgage_balance` to call `calculate_reverse_mortgage()`, but while the first two ARE injected into context, `mortgage_balance` is not (and there's no such field in the DB).

## Root Cause
1. `build_context_injection()` injects `property_value` and `age` ✅
2. But **NO `mortgage_balance` field exists** in the leads table ❌
3. The `calculate_reverse_mortgage` tool expects 3 parameters
4. Without all parameters, Barbara can't call the tool
5. Prompt says "DO NOT speak until you have the result"
6. Gets stuck waiting indefinitely

## The Solution

### Option 1: Calculate mortgage_balance from equity
If `estimated_equity` and `property_value` exist, we can calculate:
```
mortgage_balance = property_value - estimated_equity
```

For Testy:
- property_value: $2,000,000
- estimated_equity: $1,000,000
- **mortgage_balance = $1,000,000** (calculated)

### Option 2: Add ENTRY CHECK to collect missing data
Update QUOTE prompt to ask for missing values before attempting calculation.

## Recommended Fix: Inject calculated mortgage_balance

Update `build_context_injection()` to calculate and inject mortgage_balance:

```python
if lead_context.get('property_value') and lead_context.get('estimated_equity'):
    mortgage_balance = lead_context['property_value'] - lead_context['estimated_equity']
    context_parts.append(f"Mortgage Balance: ${mortgage_balance:,}")
```

This way Barbara has all three values needed for the calculation tool.


