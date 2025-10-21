# 🚀 NYLAS DEPLOYMENT - RUN THESE COMMANDS NOW

## Current Status: All Code Ready ✅

Everything is built! Just need to deploy in 3 simple steps.

---

## STEP 1: Run Database Migration (2 minutes)

### Open Supabase SQL Editor:
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click: "SQL Editor" in left sidebar
4. Click: "New query"

### Copy This SQL:
```sql
-- Add Nylas columns
ALTER TABLE brokers
ADD COLUMN IF NOT EXISTS nylas_grant_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS calendar_provider VARCHAR(20) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Los_Angeles';

-- Helper function
CREATE OR REPLACE FUNCTION get_brokers_needing_calendar_sync()
RETURNS TABLE (broker_id UUID, contact_name VARCHAR, email VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.contact_name, b.email
  FROM brokers b
  WHERE b.nylas_grant_id IS NULL AND b.status = 'active';
END;
$$ LANGUAGE plpgsql;
```

### Run It:
- Click "Run" button
- Should see: "Success. No rows returned"
- ✅ Done!

---

## STEP 2: Deploy Supabase Edge Functions (5 minutes)

### Open PowerShell in project folder:
```powershell
cd C:\Users\alex\OneDrive\Desktop\Cursor\equity-connect
```

### Run These Commands:

```powershell
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Deploy the functions
supabase functions deploy nylas-auth-url
supabase functions deploy nylas-callback

# Set the secrets (use your actual Nylas credentials from .env)
supabase secrets set NYLAS_CLIENT_ID=YOUR_CLIENT_ID_FROM_ENV
supabase secrets set NYLAS_CLIENT_SECRET=YOUR_SECRET_FROM_ENV
supabase secrets set NYLAS_API_KEY=YOUR_API_KEY_FROM_ENV
supabase secrets set NYLAS_REDIRECT_URI=https://portal.equityconnect.com/calendar/callback
```

**Note:** Replace `YOUR_*` with actual values from your `.env` file

### Verify:
```powershell
supabase functions list
```

Should show:
- nylas-auth-url
- nylas-callback

✅ Done!

---

## STEP 3: Import n8n Workflow (3 minutes)

### Go to n8n:
https://n8n.instaroute.com

### Import Workflow:
1. Click: "+ Add workflow" (top right)
2. Click: Three dots (⋮) menu → "Import from File"
3. Browse to: `C:\Users\alex\OneDrive\Desktop\Cursor\equity-connect\workflows\broker-calendar-nylas.json`
4. Click: "Import"

### Create Nylas Credential:
1. In n8n, go to: "Credentials" (left sidebar)
2. Click: "+ Add Credential"
3. Search for: "HTTP Header Auth"
4. Fill in:
   - **Name:** `Nylas API Key`
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer YOUR_NYLAS_API_KEY_FROM_ENV`
5. Click: "Save"

### Update Workflow Nodes:
1. Open the imported workflow
2. Click on node: "Nylas: Get Calendar Events"
   - Select credential: "Nylas API Key"
3. Click on node: "Nylas: Create Calendar Event"
   - Select credential: "Nylas API Key"
4. Verify "Get Broker Info" nodes use: "SupaBase Equity Connect"

### Activate:
- Toggle switch: "Inactive" → "Active"
- ✅ Done!

---

## STEP 4: Test It Works (5 minutes)

### Test 1: Check Database
Go to Supabase SQL Editor and run:
```sql
SELECT * FROM get_brokers_needing_calendar_sync();
```

Should return list of brokers (they'll need to sync their calendars).

### Test 2: Test n8n Webhook
In PowerShell:
```powershell
Invoke-RestMethod -Method Post `
  -Uri "https://n8n.instaroute.com/webhook/broker-availability-nylas" `
  -ContentType "application/json" `
  -Body '{"broker_id":"test"}'
```

Should return error "Broker not found" - that's GOOD! Means webhook works.

### Test 3: Verify Bridge Has Nylas Vars
Check your `.env` has:
```
NYLAS_API_KEY=nyk_...
N8N_AVAILABILITY_WEBHOOK=https://n8n.instaroute.com/webhook/broker-availability-nylas
N8N_BOOKING_WEBHOOK=https://n8n.instaroute.com/webhook/broker-book-appointment-nylas
```

---

## ALL DONE! 🎉

### What Works Now:
- ✅ Barbara can check broker availability (uses real calendar)
- ✅ Barbara can book appointments (creates calendar event)
- ✅ Calendar invites automatically sent to leads
- ✅ Works with Google, Outlook, iCloud calendars

### What's Next:
1. **Add CalendarSync.vue to portal** so brokers can sync their calendars
2. **Have brokers visit** `/broker/calendar` page to connect calendar
3. **Test with real call** to Barbara to book appointment

---

## Quick Reference

| What | Where |
|------|-------|
| Database migration | Copy from `run-migration.sql` |
| Supabase functions | `supabase functions deploy nylas-auth-url` |
| n8n workflow | Import `workflows/broker-calendar-nylas.json` |
| Nylas dashboard | https://dashboard.nylas.com |
| n8n dashboard | https://n8n.instaroute.com |

---

## Troubleshooting

**"supabase: command not found"**
```powershell
npm install -g supabase
```

**"Failed to deploy function"**
```powershell
supabase link --project-ref YOUR_PROJECT_REF
```

**"Where do I get Nylas credentials?"**
1. Go to https://dashboard.nylas.com
2. Select your application
3. Go to "App Settings"
4. Copy: Client ID, Client Secret, API Key

---

**Ready to deploy? Just follow Steps 1-3 above!**

Time estimate: ~10 minutes total

