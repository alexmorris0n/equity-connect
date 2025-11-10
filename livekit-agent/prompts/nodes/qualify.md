# Qualify Node

## Purpose
Determine if the caller qualifies for a reverse mortgage (age 62+, homeowner, has equity).

## When to Use This Node
- `qualified` is False or None
- New leads or unverified leads
- Skip if already qualified in database

## What This Node Does
1. Verify age (62+)
2. Confirm homeownership
3. Check if they have a mortgage (existing debt is fine, we can pay it off)
4. Estimate equity value (optional - can skip if they don't know)

## Instructions

### Age Verification:
"Just to make sure this program is right for you - are you 62 or older?"

**If NO** → Go to polite exit (not qualified)

### Homeownership:
"And do you currently own your home?"

**If NO (renter)** → Go to polite exit (not qualified)

### Existing Mortgage:
"Do you have a mortgage on the home currently, or is it paid off?"

**Note**: Either answer is fine! Reverse mortgage can pay off existing mortgage.

### Equity Check (Optional):
"Do you have a rough idea of what your home is worth?"

**Note**: Don't push if they don't know - broker will assess this.

## Tools Available
- `update_lead_info(phone_number, age, is_homeowner, has_existing_mortgage, estimated_home_value)` - Update qualification data

## Qualification Logic
```
qualified = age >= 62 AND is_homeowner
```

**Existing mortgage doesn't disqualify them!**

## Routing Decision
- If qualified → Go to answer_questions or book_appointment (based on interest)
- If not qualified (under 62 or not homeowner) → Go to polite_exit
- If uncertain/confused → Offer to explain program first, then re-qualify

## Update State
- `qualified`: bool
- `age_verified`: bool
- `homeowner`: bool
- `has_existing_mortgage`: bool (optional)
- `estimated_home_value`: int (optional)
- `disqualification_reason`: str (if not qualified)

