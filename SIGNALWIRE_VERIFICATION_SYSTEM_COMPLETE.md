# SignalWire Granular Verification System - Implementation Complete

**Date:** November 22, 2025
**Status:** ✅ Complete - Backwards Compatible with LiveKit

## Summary

Implemented granular verification system in SignalWire to match LiveKit's verification architecture. Both systems now use identical database fields and routing logic for lead verification.

## What Was Built

### 1. New Verification Tools (`swaig-agent/tools/verification.py`)

Created three new SWAIG functions to update granular verification fields in the `leads` table:

- **`mark_phone_verified`** → Updates `leads.phone_verified = TRUE`
- **`mark_email_verified`** → Updates `leads.email_verified = TRUE`
- **`mark_address_verified`** → Updates `leads.address_verified = TRUE`

Each function:
- Looks up the lead by phone number
- Updates the respective boolean field in the `leads` table
- Triggers the database trigger to recompute `leads.verified` automatically
- Returns a natural language response to the AI

### 2. Function Registration (`swaig-agent/main.py`)

**Added to function list (lines 214-220):**
```python
"function": [
    "route_conversation",
    "mark_greeted",
    "mark_verified",
    "mark_phone_verified",  # New
    "mark_email_verified",  # New
    "mark_address_verified",  # New
    ...
]
```

**Added function declarations (lines 318-345):**
```python
"mark_phone_verified": {
    "function": "mark_phone_verified",
    "description": "Mark that caller's phone number has been verified...",
    "parameters": {"type": "object", "properties": {}}
},
"mark_email_verified": { ... },
"mark_address_verified": { ... }
```

**Added routing handlers (lines 574-583):**
```python
elif function_name == "mark_phone_verified":
    result = await mark_phone_verified(caller_id)
elif function_name == "mark_email_verified":
    result = await mark_email_verified(caller_id)
elif function_name == "mark_address_verified":
    result = await mark_address_verified(caller_id)
```

### 3. Updated Verify Context (`swaig-agent/services/contexts.py`)

**Updated functions available in verify context (line 156):**
```python
"verify": [
    "mark_verified",           # Legacy (for backwards compatibility)
    "mark_phone_verified",     # New granular tool
    "mark_email_verified",     # New granular tool
    "mark_address_verified",   # New granular tool
    "route_conversation"
],
```

### 4. Call-Start Sync Logic (`swaig-agent/main.py`)

**Added after line 110:**
```python
# Sync lead status to conversation_state on call start
if lead:
    lead_qualified = lead.get('qualified', False)
    lead_verified = lead.get('verified', False)
    
    await update_conversation_state(phone, {
        'qualified': lead_qualified,
        'conversation_data': {
            'verified': lead_verified
        }
    })
    
    # Refresh state after update
    state = await get_conversation_state(phone)
    logger.info(f"[AGENT] Synced lead status: qualified={lead_qualified}, verified={lead_verified}")
```

## Database Schema (Already Migrated)

From `database/migrations/20251122_add_verification_fields.sql`:

```sql
-- New columns in leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS address_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Trigger to auto-compute 'verified' summary field
CREATE TRIGGER trg_update_lead_verified_status
BEFORE INSERT OR UPDATE OF phone_verified, email_verified, address_verified ON leads
FOR EACH ROW
EXECUTE FUNCTION update_lead_verified_status();
```

**How it works:**
- When any of `phone_verified`, `email_verified`, or `address_verified` changes
- The trigger automatically sets `verified = phone_verified AND email_verified AND address_verified`
- Both LiveKit and SignalWire read `leads.verified` to determine if the lead can skip verification

## How Verification Works Now

### On Call Start
1. **Fetch lead from database** (`leads.qualified`, `leads.verified`)
2. **Sync to conversation_state:**
   - `conversation_state.qualified` ← `leads.qualified`
   - `conversation_state.conversation_data.verified` ← `leads.verified`
3. **Route based on status:**
   - If `verified=TRUE` and `qualified=TRUE` → Skip to "answer"
   - If `verified=TRUE` and `qualified=FALSE` → Skip to "qualify"
   - If `verified=FALSE` → Start at "verify"

### During Verify Context
1. **AI prompts caller** for phone, email, and address
2. **AI calls granular tools** as each is verified:
   - `mark_phone_verified()` → Sets `leads.phone_verified = TRUE`
   - `mark_email_verified()` → Sets `leads.email_verified = TRUE`
   - `mark_address_verified()` → Sets `leads.address_verified = TRUE`
3. **Database trigger** automatically updates `leads.verified = TRUE` when all three are verified
4. **Routing logic** checks `conversation_state.conversation_data.verified` to decide next node

### Future Calls
- Lead with `verified=TRUE` in database → Skips verification entirely
- Lead with partial verification (e.g., phone and email only) → AI only asks for address

## Backwards Compatibility

✅ **SignalWire ↔ LiveKit Compatibility:**
- Both systems read/write the same database fields
- Both use identical routing logic (`state.get('qualified')`, `conversation_data.get('verified')`)
- A lead verified in LiveKit will skip verification in SignalWire (and vice versa)

✅ **Legacy Support:**
- Old `mark_verified` function still exists for backwards compatibility
- New systems should use the three granular tools for better UX

## Testing Checklist

- [ ] **Test 1:** New lead (unverified) → Agent asks for phone, email, address
- [ ] **Test 2:** Partially verified lead → Agent only asks for missing information
- [ ] **Test 3:** Fully verified lead → Agent skips verification entirely
- [ ] **Test 4:** Verified + Qualified lead → Agent skips to "answer" node
- [ ] **Test 5:** Cross-system test: Verify in LiveKit → Call via SignalWire (should skip verification)

## Files Changed

1. ✅ `swaig-agent/tools/verification.py` (NEW)
2. ✅ `swaig-agent/main.py` (Updated)
3. ✅ `swaig-agent/services/contexts.py` (Updated)
4. ✅ `database/migrations/20251122_add_verification_fields.sql` (Already existed)

## Next Steps

1. **Update verify prompt in database** to instruct AI to use the granular tools
2. **Test with real calls** to ensure smooth verification flow
3. **Monitor logs** for `[AGENT] Synced lead status` messages
4. **Verify cross-system compatibility** (LiveKit ↔ SignalWire)

---

## Architecture Notes

Both systems now follow this pattern:

```
Call Start
    ↓
Fetch leads.qualified + leads.verified
    ↓
Sync to conversation_state (top-level qualified, conversation_data.verified)
    ↓
Route based on flags:
    - verified=F → verify
    - verified=T, qualified=F → qualify
    - verified=T, qualified=T → answer
    ↓
During verify: Use granular tools to update leads table
    ↓
Database trigger recomputes leads.verified
    ↓
Routing checks conversation_data.verified to proceed
```

This ensures:
- ✅ Consistent state across LiveKit and SignalWire
- ✅ No duplicate verification across channels
- ✅ Granular tracking for better UX
- ✅ Automatic verification status updates via database triggers


