# GREET Node Routing Fix - November 24, 2025

## Problem Identified
Barbara is skipping the VERIFY node and going directly to ANSWER, even though `phone_verified=false` in the database.

## Root Cause
The GREET node's `step_criteria` and instructions are not explicit enough about WHEN to route to VERIFY. SignalWire's AI sees:
- ✅ Identity confirmed (user said "It is")  
- ✅ Greeting complete
- ❓ Step_criteria says: "Greeted, identity confirmed, reason captured. Route: ... verified=false → VERIFY, ... else → ANSWER"

The AI interprets "else → ANSWER" as the default and routes there, because:
1. The step_criteria doesn't REQUIRE checking verification BEFORE allowing ANSWER
2. The instructions don't explicitly warn against routing to ANSWER when not verified
3. ANSWER is in the `valid_contexts` list, making it an available option

## The Fix

### Step 1: Update `step_criteria` to be more explicit
**Current:**
```
Greeted, identity confirmed, reason captured. Route: calculations → QUOTE, booking → BOOK, wrong_person → GOODBYE, verified=false → VERIFY, qualified=false → QUALIFY, else → ANSWER
```

**Fixed:**
```
Identity confirmed. IF verified=false in caller info MUST route to VERIFY (do not route to ANSWER/QUOTE/QUALIFY). IF verified=true: calculations → QUOTE, booking → BOOK, wrong_person → GOODBYE, qualified=false → QUALIFY, else → ANSWER
```

**Key Changes:**
- Removed "reason captured" (not always needed)
- Made verification check MANDATORY with "MUST"
- Added explicit "do not route to ANSWER/QUOTE/QUALIFY" when not verified
- Restructured to be IF/THEN logic instead of listing options

### Step 2: Add explicit routing instructions
Add this to the END of the GREET node instructions:

```
=== ROUTING AFTER GREETING ===
⚠️ CRITICAL: Check caller information before routing:
- IF phone_verified=false OR email_verified=false OR address_verified=false:
  → MUST route to VERIFY (do not skip verification)
- IF all verified=true AND qualified=false:
  → Route to QUALIFY
- IF all verified=true AND qualified=true:
  → Route to QUOTE (if quote_presented=false) or ANSWER

DO NOT route to ANSWER or QUOTE if verification is incomplete.
```

## Migration SQL

See: `supabase/migrations/20251124_fix_greet_routing.sql`

## How to Apply

### Option 1: Via Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/mxnqfwuhvurajrgoefyg/sql/new
2. Paste the contents of `supabase/migrations/20251124_fix_greet_routing.sql`
3. Click "Run"

### Option 2: Via Command Line (if you have psql and credentials)
```bash
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/20251124_fix_greet_routing.sql
```

### Option 3: Manual Update via Dashboard
1. Go to Prompts table
2. Find the GREET node (node_name='greet', is_active=true)
3. Go to prompt_versions table
4. Find the active version for that prompt_id
5. Update the `content` JSON:
   - Update `step_criteria` field
   - Append the routing instructions to `instructions` field

## Testing After Fix
Make a test call and verify:
1. Barbara greets you
2. Confirms identity
3. **Routes to VERIFY node** (not ANSWER)
4. Asks for phone verification

## Expected Log Entry
After fix, you should see:
```
INFO:services.contexts:[CONTEXTS] Built context 'verify' with X valid transitions
```
Right after the greeting, instead of seeing the ANSWER node.


