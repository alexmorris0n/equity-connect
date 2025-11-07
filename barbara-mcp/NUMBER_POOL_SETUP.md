# SignalWire Number Pool Integration with ElevenLabs

## Overview

The Barbara MCP now supports **dynamic phone number selection** for outbound calls, allowing you to use different SignalWire numbers based on:
1. Explicit number selection (n8n passes `from_phone` parameter)
2. Broker-assigned number pools
3. Default fallback number

This ensures each broker can use their assigned numbers for outbound calls, improving deliverability and maintaining consistent caller ID.

---

## What Changed

### 1. **Database Migration** ✅
Added `elevenlabs_phone_number_id` column to `signalwire_phone_numbers` table:

```sql
ALTER TABLE signalwire_phone_numbers 
ADD COLUMN elevenlabs_phone_number_id VARCHAR UNIQUE;

COMMENT ON COLUMN signalwire_phone_numbers.elevenlabs_phone_number_id IS 
  'ElevenLabs phone number ID for SIP trunk outbound calls (e.g., pn_abc123...)';
```

### 2. **Barbara MCP Updates** ✅
- Added `from_phone` parameter to `create_outbound_call` tool
- Added Supabase integration for number pool lookup
- Implemented 3-tier fallback logic:
  1. Use `from_phone` if provided → Look up ElevenLabs ID
  2. Use broker's assigned number → Query by `assigned_broker_id`
  3. Use default fallback → `ELEVENLABS_PHONE_NUMBER_ID` env var

### 3. **New Dependencies** ✅
- `@supabase/supabase-js`: For database queries

### 4. **New Environment Variables** ✅
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

---

## Setup Instructions

### Step 1: Register Numbers in ElevenLabs

For each SignalWire number you want to use for outbound calls:

1. Go to https://elevenlabs.io/app/conversational-ai
2. Click on your agent → "Phone Numbers" tab
3. Click "Add Phone Number" → Choose "SIP Trunk"
4. Enter your SignalWire SIP trunk details
5. Add the phone number (e.g., `+14244851544`)
6. **Copy the `phone_number_id`** (starts with `pn_...`)

### Step 2: Update Supabase Table

For each number you registered in ElevenLabs, update the `signalwire_phone_numbers` table:

```sql
-- Example for number +14244851544
UPDATE signalwire_phone_numbers 
SET elevenlabs_phone_number_id = 'pn_abc123...'  -- Replace with actual ID from Step 1
WHERE number = '+14244851544';  -- Replace with actual number

-- Example for broker-assigned number
UPDATE signalwire_phone_numbers 
SET 
  elevenlabs_phone_number_id = 'pn_xyz789...',
  assigned_broker_id = 'uuid-of-broker',  -- Link to broker
  assigned_broker_company = 'Broker Company Name'
WHERE number = '+15551234567';
```

Verify:
```sql
SELECT number, elevenlabs_phone_number_id, assigned_broker_id, status
FROM signalwire_phone_numbers
WHERE status = 'active'
ORDER BY number;
```

### Step 3: Update Barbara MCP Environment

Add Supabase credentials to your `.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...  # From Supabase dashboard
```

### Step 4: Install Dependencies

```bash
cd barbara-mcp
npm install
```

This will install the new `@supabase/supabase-js` dependency.

### Step 5: Test Number Selection

**Test 1: Explicit number selection**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_outbound_call",
      "arguments": {
        "to_phone": "+16505300051",
        "from_phone": "+14244851544",  # ← Explicit number
        "lead_id": "lead-uuid",
        "lead_first_name": "Test"
      }
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "from_number": "+14244851544",  # ← Confirms number used
  "conversation_id": "conv_...",
  "sip_call_id": "..."
}
```

**Test 2: Broker-assigned number (automatic)**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_outbound_call",
      "arguments": {
        "to_phone": "+16505300051",
        "broker_id": "broker-uuid",  # ← Will use broker's assigned number
        "lead_id": "lead-uuid",
        "lead_first_name": "Test"
      }
    }
  }'
```

**Test 3: Default fallback**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_outbound_call",
      "arguments": {
        "to_phone": "+16505300051",
        "lead_id": "lead-uuid",
        "lead_first_name": "Test"
      }
    }
  }'
```

---

## How It Works

### Number Selection Logic

```
┌─────────────────────────────────────────┐
│ n8n calls create_outbound_call          │
└──────────────┬──────────────────────────┘
               │
               ▼
     ┌─────────────────────┐
     │ from_phone provided?│
     └─────────┬───────────┘
               │
         ┌─────┴─────┐
         │ YES       │ NO
         ▼           ▼
   ┌─────────┐  ┌──────────────┐
   │ Query   │  │ broker_id    │
   │ by      │  │ provided?    │
   │ number  │  └──────┬───────┘
   └────┬────┘         │
        │        ┌─────┴─────┐
        │        │ YES       │ NO
        │        ▼           ▼
        │  ┌──────────┐  ┌─────────┐
        │  │ Query by │  │ Use     │
        │  │ broker_id│  │ default │
        │  └─────┬────┘  │ fallback│
        │        │       └────┬────┘
        │        │            │
        └────────┴────────────┘
                 │
                 ▼
   ┌──────────────────────────┐
   │ elevenlabs_phone_number_id│
   │ found in Supabase?       │
   └─────────┬────────────────┘
             │
       ┌─────┴─────┐
       │ YES       │ NO
       ▼           ▼
   ┌────────┐  ┌──────────┐
   │ Use it │  │ Use      │
   │        │  │ default  │
   └───┬────┘  └────┬─────┘
       │            │
       └────────────┘
                │
                ▼
   ┌─────────────────────────────┐
   │ Call ElevenLabs SIP trunk   │
   │ with selected phone_number_id│
   └─────────────────────────────┘
```

### Code Flow

1. **Barbara MCP receives call request** from n8n with:
   - `to_phone` (required)
   - `from_phone` (optional)
   - `broker_id` (optional)
   - Lead/broker dynamic variables

2. **Number lookup**:
   ```javascript
   if (from_phone) {
     // Look up by specific number
     SELECT elevenlabs_phone_number_id 
     FROM signalwire_phone_numbers 
     WHERE number = from_phone AND status = 'active';
   } else if (broker_id) {
     // Look up broker's assigned number
     SELECT elevenlabs_phone_number_id 
     FROM signalwire_phone_numbers 
     WHERE assigned_broker_id = broker_id AND status = 'active'
     LIMIT 1;
   } else {
     // Use default from env
     elevenlabs_phone_number_id = ELEVENLABS_PHONE_NUMBER_ID;
   }
   ```

3. **Call ElevenLabs API**:
   ```javascript
   POST https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call
   {
     "agent_id": ELEVENLABS_AGENT_ID,
     "agent_phone_number_id": elevenlabs_phone_number_id,  // Selected ID
     "to_number": normalizedPhone,
     "conversation_initiation_client_data": {
       "dynamic_variables": { ...all lead/broker data }
     }
   }
   ```

---

## n8n Integration

### Example 1: Explicit Number (from workflow variable)

```javascript
// n8n workflow node: Call Barbara MCP
{
  "tool": "create_outbound_call",
  "arguments": {
    "to_phone": "{{ $json.lead.phone }}",
    "from_phone": "{{ $json.assigned_number }}",  // ← From number pool logic
    "lead_id": "{{ $json.lead.id }}",
    "broker_id": "{{ $json.broker.id }}",
    ...
  }
}
```

### Example 2: Auto-Select by Broker

```javascript
// n8n workflow node: Call Barbara MCP
{
  "tool": "create_outbound_call",
  "arguments": {
    "to_phone": "{{ $json.lead.phone }}",
    // No from_phone - will auto-select from broker's pool
    "broker_id": "{{ $json.broker.id }}",
    "lead_id": "{{ $json.lead.id }}",
    ...
  }
}
```

---

## Troubleshooting

### Issue: "Number not found in pool, using default"

**Cause:** The `from_phone` number doesn't exist in `signalwire_phone_numbers` table or doesn't have an `elevenlabs_phone_number_id`.

**Fix:**
1. Verify number exists:
   ```sql
   SELECT * FROM signalwire_phone_numbers WHERE number = '+14244851544';
   ```
2. Register in ElevenLabs and update table (see Step 1-2 above)

### Issue: "No numbers found for broker, using default"

**Cause:** No numbers are assigned to that broker with ElevenLabs IDs.

**Fix:**
```sql
-- Assign number to broker
UPDATE signalwire_phone_numbers
SET 
  assigned_broker_id = 'broker-uuid-here',
  elevenlabs_phone_number_id = 'pn_abc123...'
WHERE number = '+15551234567';
```

### Issue: "Missing SUPABASE_URL or SUPABASE_ANON_KEY"

**Cause:** Environment variables not set.

**Fix:** Add to `.env` or deployment platform:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Cost Impact

**No additional cost!** 

Using the number pool just changes which SignalWire number is used for the call. ElevenLabs charges the same regardless of which number ID you use.

---

## Next Steps

1. ✅ Set up number pool in Supabase
2. ✅ Test with a single number first
3. ✅ Expand to all broker-assigned numbers
4. ✅ Update n8n workflows to pass `from_phone` or rely on broker assignment
5. ✅ Monitor logs to verify correct numbers are being used

---

**Questions?** Check the full migration guide: `MIGRATION_TO_ELEVENLABS.md`

