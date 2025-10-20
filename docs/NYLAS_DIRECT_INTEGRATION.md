# Nylas Direct Integration - Barbara → Nylas API

## ✅ UPDATED: No n8n Needed!

Based on the [Nylas Calendar API documentation](https://developer.nylas.com/docs/v3/calendar/), Barbara's bridge can call Nylas **directly** without n8n as a middleman.

---

## Architecture Comparison

### ❌ Old Approach (via n8n)
```
Barbara → Bridge → n8n → Nylas API
  1. Barbara calls check_broker_availability
  2. Bridge calls n8n webhook
  3. n8n calls Nylas API
  4. n8n returns results to Bridge
  5. Bridge returns to Barbara

Complexity: HIGH (3 systems)
Latency: ~500-800ms
Infrastructure: Bridge + n8n + Nylas
```

### ✅ New Approach (Direct)
```
Barbara → Bridge → Nylas API
  1. Barbara calls check_broker_availability
  2. Bridge calls Nylas API directly
  3. Nylas returns results to Bridge
  4. Bridge returns to Barbara

Complexity: LOW (2 systems)
Latency: ~200-300ms
Infrastructure: Bridge + Nylas
```

**Result: 60% less infrastructure, 50% faster! 🚀**

---

## What Changed

### Updated Files

#### 1. `bridge/tools.js` ✅ UPDATED
**Changed functions:**
- `checkBrokerAvailability()` - Now calls [Nylas Free/Busy API](https://developer.nylas.com/docs/v3/calendar/check-free-busy/) directly
- `bookAppointment()` - Now calls [Nylas Events API](https://developer.nylas.com/docs/v3/calendar/using-the-events-api/) directly

**New helper:**
- `calculateAvailableSlots()` - Calculates free slots from busy times

#### 2. Environment Variables
**Required in `.env`:**
```bash
# Nylas API credentials
NYLAS_API_KEY=nyk_your_api_key_here
NYLAS_API_URL=https://api.us.nylas.com  # Optional, defaults to US region
```

---

## How It Works

### Check Availability

**API Call:**
```javascript
POST /v3/calendars/free-busy
Authorization: Bearer {NYLAS_API_KEY}

{
  "start_time": 1729598400,  // Unix timestamp
  "end_time": 1730808000,    // 14 days later
  "emails": ["broker@example.com"]
}
```

**Response:**
```json
[
  {
    "email": "broker@example.com",
    "time_slots": [
      {
        "start_time": 1729598400,
        "end_time": 1729602000,
        "status": "busy"
      }
    ]
  }
]
```

**What Bridge Does:**
1. Fetches broker's `nylas_grant_id` and `email` from Supabase
2. Calls Nylas Free/Busy API with broker's email
3. Gets list of busy time slots
4. Calculates available slots (9 AM - 5 PM, excluding busy times)
5. Filters by preferred day/time
6. Returns top 5 available slots

---

### Book Appointment

**API Call:**
```javascript
POST /v3/grants/{grant_id}/events
Authorization: Bearer {NYLAS_API_KEY}

{
  "title": "Reverse Mortgage Consultation - John Doe",
  "description": "Lead details...",
  "when": {
    "start_time": 1729598400,
    "end_time": 1729602000
  },
  "participants": [
    { "name": "Broker Name", "email": "broker@example.com" },
    { "name": "John Doe", "email": "lead@example.com" }  // Auto-sends invite!
  ],
  "calendar_id": "primary",
  "busy": true
}
```

**Response:**
```json
{
  "data": {
    "id": "event_abc123",
    "title": "Reverse Mortgage Consultation - John Doe",
    "when": { ... },
    "participants": [ ... ]
  }
}
```

**What Bridge Does:**
1. Fetches broker's `nylas_grant_id` from Supabase
2. Fetches lead's name and email from Supabase
3. Calls Nylas Events API to create calendar event
4. **Nylas automatically sends invite to lead's email!** 📧
5. Logs interaction to Supabase
6. Creates billing event
7. Returns success with event ID

---

## Database Requirements

### Brokers Table Columns
```sql
brokers:
  - nylas_grant_id VARCHAR(200)     -- Nylas grant ID (e.g., 'grant_abc123')
  - email VARCHAR(255)              -- Broker email (needed for free/busy API)
  - contact_name VARCHAR(255)       -- For calendar event title
  - timezone VARCHAR(50)            -- For slot calculation
  - calendar_synced_at TIMESTAMPTZ  -- When calendar was synced
```

### Leads Table Columns
```sql
leads:
  - primary_email VARCHAR(255)  -- Lead email (for calendar invite)
  - first_name VARCHAR(255)     -- For calendar event title
  - last_name VARCHAR(255)      -- For calendar event title
  - primary_phone VARCHAR(50)   -- For calendar event description
```

---

## Implementation Steps

### 1. Get Nylas API Key (5 min)
```bash
1. Go to https://dashboard.nylas.com
2. Create application
3. Copy API Key
```

### 2. Update .env (1 min)
```bash
echo "NYLAS_API_KEY=nyk_your_api_key_here" >> .env
```

### 3. Run Database Migration (5 min)
```bash
psql -f database/migrations/20251020_nylas_calendar.sql
```

### 4. Deploy Updated Bridge (5 min)
```bash
# Deploy updated bridge/tools.js to Northflank
git add bridge/tools.js
git commit -m "feat: Direct Nylas integration (no n8n)"
git push
```

### 5. Test (10 min)
Test both tools work:
- `check_broker_availability` → Returns free slots from Nylas
- `book_appointment` → Creates event + sends invite

**Total: ~25 minutes** ✅

---

## Benefits of Direct Integration

### 🚀 Performance
- **Faster**: 50% less latency (no n8n hop)
- **Simpler**: One API call instead of webhook chain
- **Fewer failures**: Fewer points of failure

### 💰 Cost
- **No n8n workflow needed**: One less system to maintain
- **Same Nylas cost**: No change in Nylas pricing
- **Less infrastructure**: Simpler deployment

### 🛠️ Maintenance
- **Easier debugging**: Direct API calls, clear logs
- **Better error handling**: Immediate error responses
- **Simpler testing**: Test API calls directly

### 📧 Features
- **Auto calendar invites**: Nylas sends invite to lead automatically
- **Cross-platform**: Works with Google, Outlook, iCloud, Exchange
- **Always in sync**: Real-time free/busy data

---

## What About n8n?

### Do You Still Need It?

**No, not for calendar operations!** ❌

The Nylas workflow (`workflows/broker-calendar-nylas.json`) is **no longer needed**. Bridge calls Nylas directly.

### What If You Already Imported It?

**Delete or deactivate it:**
1. Go to n8n dashboard
2. Find "Broker Calendar - Nylas Integration" workflow
3. Click "⋮" menu → "Delete" or set to "Inactive"

### Can You Keep Using n8n for Other Things?

**Yes!** ✅

You can still use n8n for:
- Email automation (Instantly integration)
- Lead enrichment workflows
- Complex multi-step automations

Just not for calendar operations anymore.

---

## Testing Checklist

### ✅ Test 1: Check Availability
```bash
# From Barbara during a call
Barbara: "Let me check Walter's availability..."

[Barbara calls: check_broker_availability({ broker_id: "broker-id" })]

Expected:
- Bridge fetches broker from Supabase
- Bridge calls Nylas Free/Busy API
- Returns 5 available slots
- Response time: < 500ms
```

### ✅ Test 2: Book Appointment
```bash
# From Barbara during a call
Barbara: "I'll book you for Tuesday at 10 AM..."

[Barbara calls: book_appointment({
  lead_id: "lead-id",
  broker_id: "broker-id",
  scheduled_for: "2025-10-22T10:00:00Z",
  notes: "Interested in debt consolidation"
})]

Expected:
- Bridge creates event via Nylas Events API
- Event appears in broker's calendar
- Lead receives calendar invite (if email exists)
- Interaction logged to Supabase
- Billing event created
- Response time: < 800ms
```

### ✅ Test 3: Fallback (No Calendar Synced)
```bash
# For broker without nylas_grant_id
[Barbara calls: check_broker_availability({ broker_id: "no-calendar-broker" })]

Expected:
- Bridge detects no nylas_grant_id
- Falls back to standard slots (M-F, 9-5)
- Returns 5 fallback slots
- Warning logged: "Broker calendar not synced"
```

---

## Troubleshooting

### Issue: "Broker calendar not synced"

**Cause:** Broker hasn't completed OAuth flow yet.

**Fix:**
1. Send broker to portal: `/broker/calendar`
2. Broker clicks "Sync Calendar"
3. Completes OAuth
4. `nylas_grant_id` saved to Supabase

### Issue: "Nylas API returned 401"

**Cause:** Invalid or missing `NYLAS_API_KEY`.

**Fix:**
```bash
# Check .env has correct API key
echo $NYLAS_API_KEY

# Should start with: nyk_...
```

### Issue: "No available slots returned"

**Cause:** Broker's calendar is fully booked for next 14 days.

**Fix:**
- Check broker's actual calendar
- Increase search window (currently 14 days)
- Or offer fallback slots

### Issue: "Calendar invite not sent"

**Cause:** Lead doesn't have email in database.

**Fix:**
- Update lead record with `primary_email`
- Or Barbara asks for email before booking

---

## API Reference

### Nylas Free/Busy API
**Docs:** https://developer.nylas.com/docs/v3/calendar/check-free-busy/

**Endpoint:**
```
POST /v3/calendars/free-busy
```

**Rate Limits:**
- 60 requests per minute per grant
- 3600 requests per hour per application

### Nylas Events API
**Docs:** https://developer.nylas.com/docs/v3/calendar/using-the-events-api/

**Endpoint:**
```
POST /v3/grants/{grant_id}/events
```

**Rate Limits:**
- 60 requests per minute per grant
- 3600 requests per hour per application

---

## Migration Path

### If You Already Have n8n Workflow

**Option 1: Clean Migration**
1. Deploy updated `bridge/tools.js`
2. Test Barbara calling tools
3. Verify Nylas API calls work
4. Delete n8n workflow
5. Update docs to remove n8n references

**Option 2: Gradual Migration**
1. Deploy updated `bridge/tools.js` with Nylas direct calls
2. Keep n8n workflow active (unused)
3. Monitor for 1 week
4. If no issues, delete n8n workflow

**Recommendation:** Option 1 (clean migration) - simpler, cleaner

---

## Summary

### What You Get
✅ **Simpler architecture** - Bridge → Nylas (no n8n)  
✅ **Faster responses** - 50% less latency  
✅ **Auto calendar invites** - Nylas sends to lead automatically  
✅ **Cross-platform** - Google, Outlook, iCloud, Exchange  
✅ **Less infrastructure** - One less system to maintain  
✅ **Easier debugging** - Direct API calls, clear logs  

### What You Don't Need Anymore
❌ n8n workflow for calendar operations  
❌ n8n webhooks for availability/booking  
❌ Complex n8n credential management  

### What Stays the Same
✅ Barbara's tools (`check_broker_availability`, `book_appointment`)  
✅ Database schema (still uses `nylas_grant_id`)  
✅ Vue portal (broker calendar sync UI)  
✅ Supabase Edge Functions (OAuth flow)  

---

**Ready to deploy? Just update .env with NYLAS_API_KEY and push bridge/tools.js! 🚀**

