# Inbound Unknown Caller Feature

**Date:** November 6, 2025  
**Status:** ✅ Complete - Ready to Deploy

## Problem Statement

Barbara AI was "making up names" on inbound calls because she was instructed to use lead context before determining if the caller was actually in the system. This created a poor experience for:
- Unknown callers (not in system)
- Cold callers (never heard of us)
- Wrong numbers

**Critical for sales:** Using incorrect names pisses people off and kills deals.

---

## Solution

Implemented a **3-tier inbound prompt system** that determines caller status BEFORE loading the conversation prompt:

### 1. **Inbound Unknown** (`inbound-unknown`)
- **When:** Caller's phone number NOT found in database
- **Behavior:** 
  - Answers: "Equity Connect, Barbara speaking. How are you today?"
  - **Asks for their name first** (doesn't assume she knows them)
  - Tries `get_lead_context` tool (they might be in system under different number)
  - If still not found: Treats as new inquiry, collects basic info

### 2. **Inbound Unqualified** (`inbound-unqualified`)
- **When:** Caller found in database but NOT qualified yet
- **Behavior:**
  - Still calls `get_lead_context` to get their info
  - Uses their name: "Hi Testy, this is Barbara..."
  - Collects missing qualification data

### 3. **Inbound Qualified** (`inbound-qualified`)
- **When:** Caller found in database AND qualified
- **Behavior:**
  - Calls `get_lead_context` to get full context
  - Personalizes with name, location, property value, etc.
  - Moves straight to booking appointment

---

## Technical Implementation

### Database Changes

**1. Added `inbound-unknown` to prompts table:**
```sql
-- Updated constraint to allow new call_type
ALTER TABLE prompts ADD CONSTRAINT prompts_call_type_check 
  CHECK (call_type IN (
    'inbound-qualified',
    'inbound-unqualified',
    'inbound-unknown',  -- NEW
    'outbound-warm',
    'outbound-cold',
    -- ... other types
  ));

-- Created new prompt
INSERT INTO prompts (name, call_type, is_active, voice, ...)
VALUES ('inbound-unknown', 'inbound-unknown', true, 'shimmer', ...);

-- Created prompt version with content
INSERT INTO prompt_versions (prompt_id, version_number, content, ...)
VALUES ('8280ecdf-2cb6-42b2-a43a-bd71221bd065', 1, {...}, ...);
```

**2. Auto-populate E.164 phone trigger:**
```sql
-- Ensures primary_phone_e164 is always populated
CREATE TRIGGER trigger_auto_populate_phone_e164
  BEFORE INSERT OR UPDATE OF primary_phone
  ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_phone_e164();

-- Backfilled 130 existing leads with E.164 values
```

### Code Changes

**File:** `barbara-v3/src/services/prompts.ts`

**Changed `determineCallType()` logic:**
```typescript
// OLD: 2 states (qualified, unqualified)
if (leadData?.qualified) {
  return 'inbound-qualified';
}
return 'inbound-unqualified'; // Default for everything else

// NEW: 3 states (qualified, unqualified, unknown)
if (leadData?.id) {
  if (leadData.qualified) {
    return 'inbound-qualified';
  } else {
    return 'inbound-unqualified'; // Known lead, not qualified
  }
} else {
  return 'inbound-unknown'; // Not in system at all
}
```

**Added hardcoded fallback prompt:**
```typescript
const INBOUND_UNKNOWN_PROMPT = `...`;
export { INBOUND_QUALIFIED_PROMPT, OUTBOUND_WARM_PROMPT, INBOUND_UNKNOWN_PROMPT };
```

---

## Phone Lookup Flow

### Call arrives → Bridge extracts phone → Lookup in Supabase

```typescript
// Searches both columns for maximum matching
const orConditions = patterns.flatMap(pattern => [
  `primary_phone.ilike.%${pattern}%`,      // 10-digit: "6505300051"
  `primary_phone_e164.eq.${pattern}`       // E.164: "+16505300051"
]).join(',');

const { data } = await supabase
  .from('leads')
  .select('id, qualified')
  .or(orConditions)
  .limit(1)
  .maybeSingle();
```

**If found:** Returns `{ id: "...", qualified: true/false }`  
**If not found:** Returns `null` → triggers `inbound-unknown` prompt

---

## Testing Scenarios

### ✅ Scenario 1: Known Qualified Lead Calls
**Given:** Lead "Testy Mctesterson" (650) 530-0051 is in database with `qualified=true`  
**When:** They call our tracking number  
**Then:** 
- Bridge looks up by phone → finds lead
- Loads `inbound-qualified` prompt
- Barbara says: "Hi Testy, this is Barbara with Equity Connect..."

### ✅ Scenario 2: Known Unqualified Lead Calls
**Given:** Lead "John Doe" in database with `qualified=false`  
**When:** They call our tracking number  
**Then:**
- Bridge looks up by phone → finds lead
- Loads `inbound-unqualified` prompt
- Barbara says: "Hi John, this is Barbara..."
- Collects missing qualification info

### ✅ Scenario 3: Unknown Caller
**Given:** Random person (555) 123-4567 NOT in database  
**When:** They call our tracking number  
**Then:**
- Bridge looks up by phone → NOT found
- Loads `inbound-unknown` prompt
- Barbara says: "Equity Connect, Barbara speaking. How are you today?"
- Barbara asks: "And who am I speaking with today?"
- Tries `get_lead_context` (might be in system under different number)
- If still not found: Treats as new inquiry

---

## Benefits

✅ **Never makes up names** - Only uses names when confirmed in database  
✅ **Professional with unknowns** - Asks for name politely  
✅ **Personalized with known leads** - Uses context when available  
✅ **Robust phone matching** - Searches both `primary_phone` and `primary_phone_e164`  
✅ **Automatic data integrity** - Trigger keeps phone columns in sync  

---

## Deployment Checklist

- [x] Database constraint updated
- [x] `inbound-unknown` prompt created in Supabase
- [x] E.164 trigger created and backfilled
- [x] `prompts.ts` logic updated
- [x] Hardcoded fallback prompt added
- [x] TypeScript compiles with no errors
- [ ] Deploy Barbara v3 to Fly.io
- [ ] Test with known lead (should use name)
- [ ] Test with unknown number (should ask for name)

---

## Related Files

- `barbara-v3/src/services/prompts.ts` - Prompt selection logic
- `barbara-v3/src/routes/streaming.ts` - Call context injection (unchanged)
- `barbara-v3/src/tools/business/get-lead-context.tool.ts` - Lead lookup tool
- `database/migrations/20251106_auto_populate_e164.sql` - E.164 trigger migration

---

## Next Steps

1. Deploy Barbara v3 to Fly.io
2. Test with real calls
3. Monitor logs to verify correct prompt selection
4. Iterate on `inbound-unknown` prompt based on call outcomes

