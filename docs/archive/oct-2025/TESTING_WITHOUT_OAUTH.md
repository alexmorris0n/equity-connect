# Testing Nylas Without OAuth (API Key Only)

**Status:** Testing with Sandbox/API Key  
**Goal:** Verify calendar functions work, upgrade to production later for broker OAuth

---

## What We're Testing

✅ **Barbara's calendar tools** (work with API key only):
- `checkBrokerAvailability()` - Check real calendar availability
- `bookAppointment()` - Create calendar events

❌ **Skipping for now** (needs production app + client_secret):
- Broker OAuth flow (calendar sync)
- Supabase Edge Functions

---

## Setup Steps

### Step 1: Verify API Key in .env

Make sure your `.env` has:
```bash
NYLAS_API_KEY=nyk_your_api_key_here
```

### Step 2: Create Mock Grant ID for Testing

Since we can't do OAuth yet, we'll manually add a test grant_id to a broker.

**Option A: Use your own calendar (recommended for testing)**

1. Go to https://dashboard.nylas.com
2. Look for "Connected Accounts" or "Grants"
3. You should see your own calendar connected (sandbox comes with some test accounts)
4. Copy the `grant_id` (looks like: `grant_abc123xyz789`)

**Option B: Manually insert a mock one**

We'll update this after we connect your own account.

### Step 3: Update Broker with Grant ID

```sql
-- Update Dan Thomas with your test grant_id
UPDATE brokers
SET 
  nylas_grant_id = 'YOUR_GRANT_ID_HERE',
  calendar_provider = 'google',  -- or 'microsoft', 'icloud'
  calendar_synced_at = NOW(),
  email = 'your_calendar_email@gmail.com'
WHERE contact_name = 'Dan Thomas';
```

---

## Testing Guide

### Test 1: n8n Workflow Import ⏳ NEXT

**File:** `workflows/broker-calendar-nylas.json`

**Steps:**
1. Open https://n8n.instaroute.com
2. Click "+ Add workflow"
3. Import the JSON file
4. Add Nylas API Key credential:
   - Type: HTTP Header Auth
   - Name: "Nylas API Key"
   - Header: `Authorization`
   - Value: `Bearer YOUR_API_KEY`
5. Update both Nylas nodes with this credential
6. Activate workflow

**Expected:** Workflow imports successfully

---

### Test 2: Direct Nylas API Call

Test the API key works by calling Nylas directly:

```javascript
// Test script
const NYLAS_API_KEY = 'nyk_your_key';
const grant_id = 'grant_abc123';

// 1. Test getting calendar events
const response = await fetch(
  `https://api.us.nylas.com/v3/grants/${grant_id}/events?limit=5`,
  {
    headers: {
      'Authorization': `Bearer ${NYLAS_API_KEY}`,
      'Content-Type': 'application/json'
    }
  }
);

const events = await response.json();
console.log('Calendar events:', events);
```

**Expected:** Returns your calendar events

---

### Test 3: Test n8n Availability Webhook

```bash
# PowerShell
$body = @{
  broker_id = "dan-thomas-broker-id"
  preferred_day = "tuesday"
  preferred_time = "morning"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "https://n8n.instaroute.com/webhook/broker-availability-nylas" `
  -ContentType "application/json" `
  -Body $body
```

**Expected Response:**
```json
{
  "success": true,
  "broker_name": "Dan Thomas",
  "available_slots": [
    {
      "datetime": "2025-10-22T10:00:00Z",
      "display": "Tuesday Oct 22 at 10:00 AM",
      "unix_timestamp": 1729598400
    }
  ]
}
```

---

### Test 4: Test n8n Booking Webhook

```bash
# PowerShell
$body = @{
  broker_id = "dan-thomas-broker-id"
  lead_id = "test-lead-123"
  lead_name = "Test Lead"
  lead_email = "test@example.com"
  lead_phone = "+16505551234"
  start_time = 1729598400
  end_time = 1729602000
  notes = "Testing Nylas integration"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "https://n8n.instaroute.com/webhook/broker-book-appointment-nylas" `
  -ContentType "application/json" `
  -Body $body
```

**Expected:**
- Event created in broker's calendar
- If lead email provided, invite sent
- Response shows success

---

### Test 5: Test Barbara Bridge Directly

Since bridge/tools.js already has Nylas integration, we can test it:

```javascript
// In bridge - these functions already exist!

// Check availability
const availability = await checkBrokerAvailability({
  broker_id: 'dan-thomas-id',
  preferred_day: 'tuesday',
  preferred_time: 'morning'
});
console.log('Available slots:', availability);

// Book appointment
const booking = await bookAppointment({
  lead_id: 'test-lead-123',
  broker_id: 'dan-thomas-id',
  scheduled_for: '2025-10-22T10:00:00Z',
  notes: 'Test booking'
});
console.log('Booking result:', booking);
```

**Expected:** Both return success with real calendar data

---

## Limitations (Until Production Upgrade)

⚠️ **What won't work yet:**
- Brokers can't sync their own calendars (no OAuth)
- Max 10 connected accounts (sandbox limit)
- You'll need to manually add grant_ids for testing

✅ **What WILL work:**
- Barbara can check availability (if grant_id exists)
- Barbara can book appointments
- Calendar invites sent to leads
- All core calendar functions

---

## When to Upgrade to Production

Upgrade when:
- ✅ Testing is complete and working
- ✅ Ready to onboard real brokers
- ✅ Need more than 10 calendar accounts
- ✅ Want brokers to self-service sync their calendars

Cost: ~$9/broker/month (first 5 free)

---

## Next Steps - Testing Plan

1. ✅ Verify NYLAS_API_KEY in .env
2. ⏳ Get a test grant_id from Nylas dashboard
3. ⏳ Update one broker with test grant_id
4. ⏳ Import n8n workflow
5. ⏳ Test availability check
6. ⏳ Test booking
7. ⏳ Test with Barbara in real call
8. ✅ Verify everything works
9. 🚀 Upgrade to production when ready to roll out

---

**Current Status:** Ready to test with API key only!  
**Blocked By:** None - we have everything we need  
**Next Action:** Import n8n workflow and test!

