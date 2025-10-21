# Nylas Calendar Integration - Deployment Checklist

## Current Status
**Date:** October 21, 2025  
**Project:** Equity Connect - Nylas Calendar Integration

---

## ✅ Code Files (Already Complete)

| Component | File | Status |
|-----------|------|--------|
| Database Migration | `database/migrations/20251020_nylas_calendar.sql` | ✅ Ready |
| Supabase Auth URL | `supabase/functions/nylas-auth-url/index.ts` | ✅ Ready |
| Supabase Callback | `supabase/functions/nylas-callback/index.ts` | ✅ Ready |
| Vue Component | `portal/src/components/CalendarSync.vue` | ✅ Ready |
| n8n Workflow | `workflows/broker-calendar-nylas.json` | ✅ Ready |
| Bridge Integration | `bridge/tools.js` (lines 449-849) | ✅ Complete |
| Env Template | `env.template` | ✅ Updated |

---

## 📋 Deployment Steps

### Step 1: Environment Configuration ⏳ IN PROGRESS
**Location:** Create/update `.env` file in project root

```bash
# Required Nylas Credentials (from https://dashboard.nylas.com)
NYLAS_CLIENT_ID=your_nylas_client_id_here
NYLAS_CLIENT_SECRET=your_nylas_client_secret_here
NYLAS_API_KEY=your_nylas_api_key_here
NYLAS_API_URL=https://api.us.nylas.com
NYLAS_REDIRECT_URI=https://portal.equityconnect.com/calendar/callback

# n8n Webhook URLs (will be updated after n8n import)
N8N_AVAILABILITY_WEBHOOK=https://n8n.instaroute.com/webhook/broker-availability-nylas
N8N_BOOKING_WEBHOOK=https://n8n.instaroute.com/webhook/broker-book-appointment-nylas
```

**Action Items:**
- [ ] Create `.env` file if it doesn't exist
- [ ] Add Nylas credentials from dashboard
- [ ] Verify redirect URI matches portal URL

---

### Step 2: Database Migration 🔄 PENDING
**Location:** Run migration on Supabase database

**Commands:**
```bash
# Option A: Via Supabase CLI
supabase db push

# Option B: Via psql
psql -h db.YOUR_PROJECT.supabase.co -U postgres -d postgres -f database/migrations/20251020_nylas_calendar.sql

# Option C: Via Supabase Dashboard
# Copy contents of migration file and run in SQL Editor
```

**What it does:**
- Adds `nylas_grant_id` column to brokers table
- Adds `calendar_provider` column
- Adds `calendar_synced_at` timestamp
- Removes old multi-provider columns
- Creates helper function `get_brokers_needing_calendar_sync()`

**Verification:**
```sql
-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'brokers' 
AND column_name LIKE 'nylas%';

-- Should show:
-- nylas_grant_id | character varying
-- calendar_provider | character varying
-- calendar_synced_at | timestamp with time zone
```

**Action Items:**
- [ ] Run database migration
- [ ] Verify columns added successfully
- [ ] Test helper function

---

### Step 3: Deploy Supabase Edge Functions 🔄 PENDING
**Location:** Deploy both Nylas OAuth functions

**Commands:**
```bash
# Navigate to project root
cd C:\Users\alex\OneDrive\Desktop\Cursor\equity-connect

# Login to Supabase CLI (if not already logged in)
supabase login

# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy both functions
supabase functions deploy nylas-auth-url
supabase functions deploy nylas-callback

# Set environment secrets for the functions
supabase secrets set NYLAS_CLIENT_ID=your_client_id_here
supabase secrets set NYLAS_CLIENT_SECRET=your_secret_here
supabase secrets set NYLAS_API_KEY=your_api_key_here
supabase secrets set NYLAS_REDIRECT_URI=https://portal.equityconnect.com/calendar/callback
```

**What it does:**
- `nylas-auth-url`: Generates OAuth URL for brokers to sync calendar
- `nylas-callback`: Handles OAuth callback, exchanges code for grant_id, saves to database

**Verification:**
```bash
# Test auth URL generation (requires auth token)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/nylas-auth-url \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json"

# Should return:
# {"auth_url": "https://api.us.nylas.com/v3/connect/auth?...", "broker_id": "..."}
```

**Action Items:**
- [ ] Install/update Supabase CLI
- [ ] Deploy both Edge Functions
- [ ] Set environment secrets
- [ ] Test functions with curl

---

### Step 4: Import n8n Workflow 🔄 PENDING
**Location:** n8n dashboard at https://n8n.instaroute.com

**Steps:**
1. **Import Workflow**
   - Open n8n dashboard
   - Click "+ Add workflow"
   - Click "⋮" menu → "Import from File"
   - Upload: `workflows/broker-calendar-nylas.json`

2. **Configure Nylas API Credential**
   - Go to: Credentials → "+ Add Credential"
   - Type: "HTTP Header Auth"
   - Name: "Nylas API Key"
   - Header Name: `Authorization`
   - Header Value: `Bearer nyk_YOUR_API_KEY_HERE`
   - Save

3. **Update All Nylas Nodes**
   - Find nodes: "Nylas: Get Calendar Events" and "Nylas: Create Calendar Event"
   - For each node, select credential: "Nylas API Key"

4. **Verify Supabase Credential**
   - Find nodes: "Get Broker Info", "Log Appointment to Supabase"
   - Ensure they use credential: "SupaBase Equity Connect"

5. **Activate Workflow**
   - Click "Inactive" toggle → "Active"

6. **Copy Webhook URLs**
   ```
   Availability: https://n8n.instaroute.com/webhook/broker-availability-nylas
   Booking: https://n8n.instaroute.com/webhook/broker-book-appointment-nylas
   ```

7. **Update .env with webhook URLs** (if different)

**Verification:**
```bash
# Test availability webhook
curl -X POST https://n8n.instaroute.com/webhook/broker-availability-nylas \
  -H "Content-Type: application/json" \
  -d '{"broker_id": "test-broker-id", "preferred_day": "tuesday", "preferred_time": "morning"}'

# Should return (may fail if broker doesn't exist, but should not return 404)
```

**Action Items:**
- [ ] Import n8n workflow
- [ ] Create Nylas API credential
- [ ] Update all nodes with credentials
- [ ] Activate workflow
- [ ] Copy and save webhook URLs
- [ ] Update .env with webhook URLs

---

### Step 5: Update Bridge/Tools.js 🔄 PENDING
**Location:** `bridge/tools.js`

**Status:** Code is already complete! Just needs to be deployed.

**What's already implemented:**
- `checkBrokerAvailability()` - Lines 449-541
  - Calls Nylas Free/Busy API directly
  - Falls back to standard slots if broker calendar not synced
  
- `bookAppointment()` - Lines 690-849
  - Creates calendar event via Nylas Events API
  - Auto-sends calendar invite to lead
  - Logs interaction to Supabase
  - Creates billing event

**Action Items:**
- [ ] Verify NYLAS_API_KEY is in environment
- [ ] Deploy updated bridge to Northflank
- [ ] Restart bridge service

**Deployment to Northflank:**
```bash
# Commit changes (if any)
git add bridge/tools.js env.template
git commit -m "feat: Nylas calendar integration ready"
git push origin master

# Northflank will auto-deploy
# Or manually trigger deployment in Northflank dashboard
```

---

### Step 6: Add Vue Component to Portal 🔄 PENDING
**Location:** Vue portal application

**File:** `portal/src/components/CalendarSync.vue` is ready

**Integration Steps:**

1. **Add to Vue Router** (`src/router/index.js` or similar):
   ```javascript
   {
     path: '/broker/calendar',
     name: 'CalendarSync',
     component: () => import('@/components/CalendarSync.vue'),
     meta: { requiresAuth: true }
   },
   {
     path: '/calendar/callback',
     name: 'CalendarCallback',
     component: () => import('@/components/CalendarSync.vue')
   }
   ```

2. **Add to Broker Navigation** (sidebar/menu):
   ```vue
   <router-link to="/broker/calendar" class="nav-item">
     📅 Calendar Settings
   </router-link>
   ```

3. **Ensure Supabase Client** (`src/lib/supabase.js`):
   ```javascript
   import { createClient } from '@supabase/supabase-js';
   
   export const supabase = createClient(
     import.meta.env.VITE_SUPABASE_URL,
     import.meta.env.VITE_SUPABASE_ANON_KEY
   );
   ```

**Action Items:**
- [ ] Copy CalendarSync.vue to portal components
- [ ] Add routes to Vue Router
- [ ] Add navigation menu item
- [ ] Verify Supabase client configured
- [ ] Deploy portal updates

---

### Step 7: Test Broker Calendar Sync 🧪 TESTING
**Prerequisites:** Steps 1-6 complete

**Test Scenario:**
1. **Broker logs into portal**
   - Navigate to: `/broker/calendar`
   - Should see "Sync Your Calendar" button

2. **Click "Sync Calendar"**
   - Redirects to Nylas OAuth page
   - Broker chooses provider (Google/Outlook/iCloud)
   - Grants calendar permissions

3. **OAuth Callback**
   - Redirects back to portal
   - Should show "Calendar Connected" with green checkmark
   - Shows provider name (e.g., "Google Calendar")

4. **Verify Database**
   ```sql
   SELECT id, contact_name, nylas_grant_id, calendar_provider, calendar_synced_at
   FROM brokers
   WHERE nylas_grant_id IS NOT NULL
   ORDER BY calendar_synced_at DESC;
   ```
   - Should show broker with grant_id populated

**Action Items:**
- [ ] Test OAuth flow with real broker account
- [ ] Verify grant_id saved to database
- [ ] Verify provider detected correctly
- [ ] Test re-sync functionality

---

### Step 8: Test Check Broker Availability 🧪 TESTING
**Prerequisites:** At least one broker has synced calendar

**Test with Barbara (Real Call):**
1. Call Barbara's number
2. Say: "I'd like to speak with a broker"
3. Barbara should call `check_broker_availability` tool
4. Should return real available slots from broker's calendar

**Test with curl (Direct):**
```bash
# Via n8n webhook
curl -X POST https://n8n.instaroute.com/webhook/broker-availability-nylas \
  -H "Content-Type: application/json" \
  -d '{
    "broker_id": "REAL_BROKER_ID_HERE",
    "preferred_day": "tuesday",
    "preferred_time": "morning"
  }'

# Expected response:
{
  "success": true,
  "broker_name": "Walter Richards",
  "calendar_provider": "google",
  "available_slots": [
    {
      "datetime": "2025-10-22T10:00:00.000Z",
      "display": "Tuesday Oct 22 at 10:00 AM",
      "day": "tuesday",
      "time": "10:00 AM",
      "unix_timestamp": 1729598400
    }
  ]
}
```

**Verify:**
- [ ] Returns available slots (not all busy)
- [ ] Excludes broker's actual busy times
- [ ] Falls back gracefully if broker not synced
- [ ] Response time < 1 second

**Action Items:**
- [ ] Test with synced broker
- [ ] Test with unsynced broker (should show fallback slots)
- [ ] Verify busy times are excluded correctly
- [ ] Check n8n execution logs

---

### Step 9: Test Book Appointment 🧪 TESTING
**Prerequisites:** Step 8 passed

**Test with curl:**
```bash
curl -X POST https://n8n.instaroute.com/webhook/broker-book-appointment-nylas \
  -H "Content-Type: application/json" \
  -d '{
    "broker_id": "REAL_BROKER_ID",
    "lead_id": "test-lead-123",
    "lead_name": "Test Lead",
    "lead_email": "test@example.com",
    "lead_phone": "+16505300051",
    "start_time": 1729598400,
    "end_time": 1729602000,
    "notes": "Testing Nylas calendar integration"
  }'

# Expected response:
{
  "success": true,
  "message": "Appointment booked successfully",
  "event_id": "nylas-event-abc123",
  "calendar_invite_sent": true,
  "broker_name": "Walter Richards",
  "scheduled_for": 1729598400
}
```

**Verify:**
1. **Broker's Calendar**
   - Event appears in broker's Google/Outlook calendar
   - Title: "Reverse Mortgage Consultation - Test Lead"
   - Time matches start_time

2. **Lead's Email**
   - Lead receives calendar invite at test@example.com
   - Can accept/decline
   - Can add to their calendar

3. **Supabase Database**
   ```sql
   SELECT * FROM interactions 
   WHERE lead_id = 'test-lead-123' 
   AND interaction_type = 'appointment_scheduled'
   ORDER BY created_at DESC LIMIT 1;
   ```
   - Should show logged interaction with nylas_event_id

4. **Billing Event**
   ```sql
   SELECT * FROM billing_events
   WHERE metadata->>'nylas_event_id' IS NOT NULL
   ORDER BY created_at DESC LIMIT 1;
   ```
   - Should show $50 appointment booking fee

**Action Items:**
- [ ] Create test appointment
- [ ] Verify event in broker calendar
- [ ] Confirm lead receives email invite
- [ ] Check interaction logged in database
- [ ] Verify billing event created
- [ ] Test with Barbara (real call scenario)

---

### Step 10: Verify Calendar Invites 🧪 TESTING
**Prerequisites:** Step 9 passed

**Test End-to-End Flow:**

1. **Barbara Call Scenario:**
   - Lead calls Barbara
   - Barbara: "Would you like to schedule a time to speak with Walter?"
   - Lead: "Yes, Tuesday at 10 AM works"
   - Barbara calls `book_appointment` tool
   - Barbara: "Perfect! I've scheduled that for you. You'll receive a calendar invite via email."

2. **Lead Experience:**
   - Receives email from broker (via Nylas)
   - Subject: "Invitation: Reverse Mortgage Consultation - [Lead Name]"
   - Contains:
     - ✅ Event details (date, time)
     - ✅ Broker contact info
     - ✅ Lead contact info
     - ✅ "Accept" / "Decline" buttons
     - ✅ "Add to Calendar" link

3. **Broker Experience:**
   - Event automatically added to their calendar
   - Syncs across all devices
   - Shows lead contact info in description

**Action Items:**
- [ ] Complete full end-to-end test with real lead
- [ ] Verify email delivery
- [ ] Test accept/decline functionality
- [ ] Confirm calendar sync works
- [ ] Test reminder notifications

---

## 🎯 Success Criteria

### Minimum Viable Product (MVP)
- [x] All code files created and reviewed
- [ ] Database migration run successfully
- [ ] Supabase Edge Functions deployed
- [ ] n8n workflow imported and active
- [ ] Bridge updated and deployed
- [ ] Vue component integrated in portal
- [ ] At least 1 broker successfully synced calendar
- [ ] Availability check returns real calendar data
- [ ] Booking creates event + sends invite
- [ ] Calendar invites received and functional

### Production Ready
- [ ] 5+ brokers have synced calendars
- [ ] 95%+ success rate on calendar sync
- [ ] Average API response time < 500ms
- [ ] No errors in last 24 hours
- [ ] Billing events created correctly
- [ ] Email delivery 100%
- [ ] Documentation complete
- [ ] Monitoring/alerts configured

---

## 📊 Current Progress

### Overall: ~60% Complete

| Phase | Status | Progress |
|-------|--------|----------|
| Code Development | ✅ Complete | 100% |
| Database Setup | 🔄 Pending | 0% |
| Supabase Functions | 🔄 Pending | 0% |
| n8n Workflow | 🔄 Pending | 0% |
| Bridge Deployment | 🔄 Pending | 0% |
| Portal Integration | 🔄 Pending | 0% |
| Testing | ⏸️ Waiting | 0% |
| Production Launch | ⏸️ Waiting | 0% |

---

## 🚀 Next Immediate Steps

**Today's Focus:**

1. ✅ **Verify Nylas Credentials** (Step 1)
   - Check if `.env` file exists
   - Add Nylas API credentials
   
2. **Run Database Migration** (Step 2)
   - Execute migration SQL
   - Verify columns added

3. **Deploy Supabase Functions** (Step 3)
   - Install Supabase CLI if needed
   - Deploy both OAuth functions
   - Set secrets

---

## 📝 Notes

- **All code is written and ready** - just needs deployment
- **No n8n actually needed for core functionality** - Bridge calls Nylas API directly, but n8n workflow can be used as backup/alternative
- **Fallback slots work** - If broker hasn't synced, system shows standard 9-5 M-F slots
- **Auto-sends invites** - Nylas automatically emails calendar invites to leads
- **Multi-provider** - Works with Google, Outlook, iCloud calendars via one API

---

## 🆘 Troubleshooting

### Issue: "Nylas API returned 401"
**Cause:** Invalid or missing API key  
**Fix:** Verify `NYLAS_API_KEY` in `.env` starts with `nyk_`

### Issue: "Broker calendar not synced"
**Cause:** Broker hasn't completed OAuth flow  
**Fix:** Send broker to `/broker/calendar` to sync

### Issue: "No available slots returned"
**Cause:** Broker's calendar fully booked OR grant_id invalid  
**Fix:** Check broker calendar or re-sync

### Issue: "Calendar invite not sent"
**Cause:** Lead email missing or invalid  
**Fix:** Ensure `lead_email` provided in booking request

---

**Last Updated:** October 21, 2025  
**Status:** Ready for deployment - awaiting Step 1 completion

