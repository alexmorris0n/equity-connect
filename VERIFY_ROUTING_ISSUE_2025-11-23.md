# Issue: Routing to VERIFY for Already-Qualified Returning Caller

## Problem
Testy Mctesterson is being routed to VERIFY even though:
- **56 calls already made** (returning caller)
- **Fully QUALIFIED** ✅ (all 4 qualification flags = true)
- **Status: appointment_set** (already progressed in pipeline)
- **Only missing: verified flag** (phone_verified, email_verified = false)

## Current State
```json
{
  "qualified": true,           ✅
  "age_qualified": true,       ✅
  "homeowner_qualified": true, ✅
  "primary_residence_qualified": true, ✅
  "equity_qualified": true,    ✅
  "verified": false,           ❌ (triggers VERIFY routing)
  "phone_verified": false,     ❌
  "email_verified": false,     ❌
  "address_verified": true,    ✅
  "call_count": 56
}
```

## Root Cause
**GREET node step_criteria:**
```
"If they need verification → transition to VERIFY context."
```

The AI is interpreting `verified = false` as "needs verification" even though:
1. This is a **returning caller** (56 calls)
2. They're already **QUALIFIED** (more important than verified)
3. They're at **appointment_set** stage (past verification)

## The Logic Issue

**VERIFY should only be for:**
- New callers who need identity/contact verification
- Unqualified callers who need to verify qualification criteria

**VERIFY should NOT be for:**
- Returning qualified callers asking questions
- Callers with appointment_set status
- Callers who've had 56 previous calls!

## Solution Options

### Option 1: Skip VERIFY for Qualified Callers (RECOMMENDED)
Update GREET node routing logic:

```yaml
Route based on their response:
  - If QUALIFIED (all 4 flags = true) AND returning caller (call_count > 1):
    → Skip VERIFY, route directly to ANSWER/QUOTE/BOOK
  - If NOT qualified OR new caller (call_count = 0):
    → Route to VERIFY or QUALIFY as needed
```

### Option 2: Smart VERIFY Node (Check First)
Update VERIFY node to check if already qualified:

```yaml
VERIFY node entry logic:
1. Check if caller is already qualified
2. If qualified = true: 
   - Say: "I see you're already set up with us. What can I help you with today?"
   - Route directly to ANSWER
3. If qualified = false:
   - Proceed with verification process
```

### Option 3: Separate Verification from Qualification
The issue is confusing two concepts:
- **Verification** = Confirming phone/email/address
- **Qualification** = Confirming age/homeowner/primary residence/equity

For a **returning qualified caller**, verification is unnecessary.

## Recommended Fix

**Update GREET node step_criteria:**

```yaml
step_criteria: |
  Complete after greeting, rapport, and purpose discovery.
  
  ROUTING LOGIC:
  1. Check if caller is QUALIFIED (qualified = true in database)
  2. If QUALIFIED:
     - Skip VERIFY node (they're already set up)
     - Route based on their question:
       * Amounts/calculations → QUOTE
       * General questions → ANSWER
       * Ready to book → BOOK
       * Concerns → OBJECTIONS
  3. If NOT QUALIFIED or NEW CALLER:
     - Route to VERIFY to confirm identity and eligibility
     
  NEVER send qualified returning callers to VERIFY.
```

## Implementation

Would you like me to:
1. Update GREET node to skip VERIFY for qualified callers?
2. Update VERIFY node to check qualification first and skip if already qualified?
3. Both (belt and suspenders approach)?

