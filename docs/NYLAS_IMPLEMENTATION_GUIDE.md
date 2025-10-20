# Nylas Calendar Integration - Quick Implementation Guide

## What Changed?

**Before (Multi-Provider OAuth):**
- Complex: 4 different OAuth flows
- Hard to maintain: Switch logic for each provider
- Limited: iCloud didn't work
- Manual: Token refresh for each provider

**After (Nylas):**
- Simple: ONE OAuth flow for all providers
- Easy: ONE API endpoint
- Universal: Works with Google, Outlook, iCloud, Exchange
- Automatic: Nylas handles token refresh
- Bonus: Auto-sends calendar invites to leads!

---

## Files Created

### ✅ Documentation
- `docs/BROKER_CALENDAR_ONBOARDING_NYLAS.md` - Full architecture & setup guide
- `docs/NYLAS_IMPLEMENTATION_GUIDE.md` - This file (quick reference)

### ✅ Database
- `database/migrations/20251020_nylas_calendar.sql` - New schema (replaces old multi-provider)

### ✅ n8n Workflow
- `workflows/broker-calendar-nylas.json` - Simplified workflow (no more Switch node!)

### ✅ Supabase Edge Functions
- `supabase/functions/nylas-auth-url/index.ts` - Generate OAuth URL
- `supabase/functions/nylas-callback/index.ts` - Handle OAuth callback

### ✅ Vue Portal Component
- `portal/src/components/CalendarSync.vue` - Beautiful sync UI for brokers

### ✅ Configuration
- `env.template` - Updated with Nylas credentials

---

## Step-by-Step Implementation (2 Hours)

### Phase 1: Nylas Setup (15 minutes)

1. **Go to Nylas Dashboard**
   ```
   https://dashboard.nylas.com
   ```

2. **Create New Application**
   - Click "Create Application"
   - Name: "Equity Connect Calendar"
   - Click "Create"

3. **Get Your Credentials**
   Copy these 3 values:
   - **Client ID**: `nylas_...`
   - **Client Secret**: `secret_...`
   - **API Key**: `nyk_...`

4. **Set Redirect URI**
   - In Nylas dashboard → App Settings → Redirect URIs
   - Add: `https://portal.equityconnect.com/calendar/callback`
   - For local testing, also add: `http://localhost:3000/calendar/callback`

5. **Enable Providers**
   - In App Settings → Providers
   - Enable: Google, Microsoft, iCloud

6. **Update .env**
   ```bash
   NYLAS_CLIENT_ID=nylas_your_client_id_here
   NYLAS_CLIENT_SECRET=secret_your_secret_here
   NYLAS_API_KEY=nyk_your_api_key_here
   NYLAS_REDIRECT_URI=https://portal.equityconnect.com/calendar/callback
   ```

---

### Phase 2: Database Migration (5 minutes)

```bash
# Connect to your Supabase database
psql -h db.your-project.supabase.co -U postgres -d postgres

# Run the migration
\i database/migrations/20251020_nylas_calendar.sql

# Verify columns added
\d brokers
```

**Expected output:**
```
Column             | Type                     
-------------------+-------------------------
nylas_grant_id     | character varying(200)
calendar_provider  | character varying(20)
calendar_synced_at | timestamp with time zone
timezone           | character varying(50)
```

---

### Phase 3: Deploy Supabase Edge Functions (30 minutes)

1. **Install Supabase CLI** (if not already installed)
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Link to your project**
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. **Deploy Edge Functions**
   ```bash
   # Deploy auth URL generator
   supabase functions deploy nylas-auth-url
   
   # Deploy OAuth callback handler
   supabase functions deploy nylas-callback
   ```

5. **Set Secrets**
   ```bash
   supabase secrets set NYLAS_CLIENT_ID=nylas_your_id
   supabase secrets set NYLAS_CLIENT_SECRET=secret_your_secret
   supabase secrets set NYLAS_API_KEY=nyk_your_key
   supabase secrets set NYLAS_REDIRECT_URI=https://portal.equityconnect.com/calendar/callback
   ```

6. **Test Functions**
   ```bash
   # Test auth URL generation (requires auth token)
   curl -X POST https://your-project.supabase.co/functions/v1/nylas-auth-url \
     -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
     -H "Content-Type: application/json"
   ```

---

### Phase 4: Add Vue Component to Portal (20 minutes)

1. **Copy Component**
   - File already created: `portal/src/components/CalendarSync.vue`
   - Move to your Vue app: `src/components/CalendarSync.vue`

2. **Add Route**
   ```javascript
   // In your Vue Router (src/router/index.js)
   {
     path: '/broker/calendar',
     name: 'CalendarSync',
     component: () => import('@/components/CalendarSync.vue'),
     meta: { requiresAuth: true }
   }
   ```

3. **Add to Dashboard Navigation**
   ```vue
   <!-- In your broker dashboard/nav -->
   <router-link to="/broker/calendar">
     📅 Calendar Settings
   </router-link>
   ```

4. **Handle OAuth Callback**
   ```javascript
   // In src/router/index.js, add route:
   {
     path: '/calendar/callback',
     name: 'CalendarCallback',
     component: () => import('@/components/CalendarSync.vue')
   }
   ```

5. **Test Locally**
   ```bash
   cd portal
   npm run dev
   ```
   - Navigate to http://localhost:3000/broker/calendar
   - Should see "Sync Calendar" button

---

### Phase 5: Import n8n Workflow (20 minutes)

1. **Open n8n**
   ```
   https://n8n.instaroute.com
   ```

2. **Import Workflow**
   - Click "+ Add workflow"
   - Click "⋮" menu → "Import from File"
   - Upload: `workflows/broker-calendar-nylas.json`

3. **Add Nylas Credential**
   - Go to: Credentials → "+ Add Credential"
   - Search: "HTTP Header Auth"
   - Name: "Nylas API Key"
   - Header Name: `Authorization`
   - Header Value: `Bearer nyk_your_api_key_here`
   - Save

4. **Update All Nodes**
   - For each "Nylas: ..." node:
     - Select credential: "Nylas API Key"
   - For "Get Broker Info" nodes:
     - Select credential: "SupaBase Equity Connect"

5. **Activate Workflow**
   - Click "Inactive" toggle → "Active"

6. **Copy Webhook URLs**
   ```
   Availability: https://n8n.instaroute.com/webhook/broker-availability-nylas
   Booking: https://n8n.instaroute.com/webhook/broker-book-appointment-nylas
   ```

7. **Update .env**
   ```bash
   N8N_AVAILABILITY_WEBHOOK=https://n8n.instaroute.com/webhook/broker-availability-nylas
   N8N_BOOKING_WEBHOOK=https://n8n.instaroute.com/webhook/broker-book-appointment-nylas
   ```

---

### Phase 6: Test End-to-End (15 minutes)

#### Test 1: Broker Syncs Calendar

1. **Login as broker** to portal
2. **Go to** `/broker/calendar`
3. **Click** "Sync Calendar"
4. **Choose** Google/Outlook/iCloud
5. **Grant** permissions
6. **Redirected** back to portal
7. **Verify** in Supabase:
   ```sql
   SELECT contact_name, nylas_grant_id, calendar_provider, calendar_synced_at 
   FROM brokers 
   WHERE nylas_grant_id IS NOT NULL;
   ```

#### Test 2: Check Availability

```bash
curl -X POST https://n8n.instaroute.com/webhook/broker-availability-nylas \
  -H "Content-Type: application/json" \
  -d '{
    "broker_id": "YOUR_BROKER_ID",
    "preferred_day": "tuesday",
    "preferred_time": "morning"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "broker_name": "Walter Richards",
  "calendar_provider": "google",
  "available_slots": [
    {
      "datetime": "2025-10-22T10:00:00Z",
      "display": "Tuesday Oct 22 at 10:00 AM",
      "day": "tuesday",
      "time": "10:00 AM"
    }
  ]
}
```

#### Test 3: Book Appointment

```bash
curl -X POST https://n8n.instaroute.com/webhook/broker-book-appointment-nylas \
  -H "Content-Type: application/json" \
  -d '{
    "broker_id": "YOUR_BROKER_ID",
    "lead_id": "test-123",
    "lead_name": "Testy McTesterson",
    "lead_email": "test@example.com",
    "lead_phone": "+16505300051",
    "start_time": 1729598400,
    "end_time": 1729602000,
    "notes": "Interested in reverse mortgage"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Appointment booked successfully",
  "event_id": "nylas-event-123",
  "calendar_invite_sent": true
}
```

**Check:**
- ✅ Event appears in broker's calendar
- ✅ Lead receives calendar invite via email
- ✅ Appointment logged in Supabase `interactions` table

---

## Broker Onboarding Email Template

Send this to each broker:

```
Subject: Setup Your Calendar for Live Appointment Booking

Hi {{ broker_name }},

Great news! We're enabling live appointment booking for your leads.

To get started, please sync your calendar (takes 30 seconds):

👉 https://portal.equityconnect.com/broker/calendar

This works with:
• Google Calendar
• Outlook/Microsoft 365
• iCloud Calendar

Once synced, Barbara will automatically:
✓ Check your real availability
✓ Book appointments when you're free
✓ Send calendar invites to leads

No more "I was busy" excuses from leads! 😊

Questions? Reply to this email.

Thanks,
Equity Connect Team
```

---

## Troubleshooting

### Issue: "Failed to sync calendar"

**Check:**
1. Nylas credentials in `.env` are correct
2. Redirect URI matches exactly (including https://)
3. Supabase Edge Functions deployed successfully
4. Browser console for errors

**Fix:**
```bash
# Re-deploy edge functions
supabase functions deploy nylas-auth-url
supabase functions deploy nylas-callback

# Check logs
supabase functions logs nylas-callback
```

### Issue: "No available slots returned"

**Check:**
1. Broker has `nylas_grant_id` in database
2. n8n workflow is active
3. Nylas API Key credential is correct in n8n

**Debug:**
```bash
# Test n8n webhook directly
curl -X POST https://n8n.instaroute.com/webhook/broker-availability-nylas \
  -H "Content-Type: application/json" \
  -d '{"broker_id": "YOUR_ID"}' \
  -v
```

### Issue: "Calendar invite not sent"

**Check:**
1. `lead_email` is included in booking request
2. Nylas `participants` array includes lead email
3. Check n8n execution logs

**Fix:**
- Update n8n workflow node "Nylas: Create Calendar Event"
- Ensure `participants` array includes both broker and lead

---

## Cost Breakdown

### Nylas Pricing
- **Free Tier**: 5 calendar accounts (good for MVP!)
- **Starter**: $9/account/month (up to 500 accounts)
- **Scale**: Custom pricing

### For Your Use Case
- **5 brokers**: FREE
- **10 brokers**: $45/month (5 free + 5 × $9)
- **100 brokers**: Contact Nylas for enterprise pricing

### Comparison
| Solution | 10 Brokers | 100 Brokers |
|----------|------------|-------------|
| **Nylas** | $45/mo | ~$500/mo |
| Cal.com Cloud | $150/mo | $1,500/mo |
| Multi-Provider OAuth | FREE | FREE (but complex) |

**Nylas is cheaper AND simpler!**

---

## What Barbara Can Now Do

### Tool: check_broker_availability

**Input:**
```javascript
{
  broker_id: "broker-456",
  preferred_day: "tuesday",  // or "any"
  preferred_time: "morning"  // or "afternoon" or "any"
}
```

**Output:**
```javascript
{
  success: true,
  broker_name: "Walter Richards",
  available_slots: [
    {
      datetime: "2025-10-22T10:00:00Z",
      display: "Tuesday Oct 22 at 10:00 AM",
      day: "tuesday",
      time: "10:00 AM"
    }
  ]
}
```

### Tool: book_appointment

**Input:**
```javascript
{
  broker_id: "broker-456",
  lead_id: "lead-789",
  lead_name: "John Doe",
  lead_email: "john@example.com",  // 🆕 Required for invite!
  lead_phone: "+16505300051",
  start_time: 1729598400,  // Unix timestamp
  end_time: 1729602000,    // Unix timestamp (start + 1 hour)
  notes: "Interested in debt consolidation"
}
```

**Output:**
```javascript
{
  success: true,
  message: "Appointment booked successfully",
  event_id: "nylas-event-abc123",
  calendar_invite_sent: true,  // 🆕 Automatically sent!
  broker_name: "Walter Richards",
  scheduled_for: 1729598400
}
```

---

## Next Steps After Implementation

### Week 1: Test with 1-2 Brokers
- Manually sync their calendars
- Test booking flow end-to-end
- Verify invites sent correctly

### Week 2: Roll Out to All Active Brokers
- Send onboarding email to all brokers
- Monitor sync success rate
- Help brokers who have issues

### Week 3: Monitor & Optimize
- Check appointment booking success rate
- Monitor Nylas usage (stay under free tier if possible)
- Collect broker feedback

### Future Enhancements
- **Reschedule tool** - Let leads reschedule
- **Cancel tool** - Let leads cancel
- **Buffer time** - Add 15 min buffer between appointments
- **Multi-timezone** - Better timezone handling
- **SMS reminders** - Remind leads 1 hour before

---

## Support & Documentation

### Resources
- **Nylas Docs**: https://developer.nylas.com/docs
- **Nylas API Reference**: https://developer.nylas.com/docs/api
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **n8n HTTP Request**: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/

### Internal Docs
- Full guide: `docs/BROKER_CALENDAR_ONBOARDING_NYLAS.md`
- Database: `database/migrations/20251020_nylas_calendar.sql`
- Workflow: `workflows/broker-calendar-nylas.json`

---

## Quick Checklist

- [ ] Nylas account created
- [ ] Credentials added to `.env`
- [ ] Database migration run
- [ ] Supabase Edge Functions deployed
- [ ] Vue component added to portal
- [ ] n8n workflow imported & activated
- [ ] Test: Broker can sync calendar
- [ ] Test: Availability check works
- [ ] Test: Booking works
- [ ] Test: Calendar invite received
- [ ] Send onboarding email to brokers

---

**Ready to go live? Let's do this! 🚀**

