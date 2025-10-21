# Nylas Integration - Quick Start Guide

## ✅ What's Already Done

All the code is written and ready! Here's what we have:

- ✅ Database migration SQL file
- ✅ Supabase Edge Functions (OAuth handlers)
- ✅ Vue CalendarSync component
- ✅ n8n workflow JSON
- ✅ Bridge tools.js with Nylas API integration
- ✅ Environment template with all variables
- ✅ Deployment scripts and documentation

## 🚀 Quick Deployment (3 Steps)

### Step 1: Run Database Migration (5 minutes)

**Option A: Via Supabase Dashboard (Easiest)**

1. Open https://supabase.com/dashboard
2. Go to your project → SQL Editor
3. Click "New query"
4. Copy contents from `run-migration.sql`
5. Click "Run"
6. ✅ Done! You should see success message

**Option B: Via Command Line**

```powershell
# If you have Supabase CLI installed
supabase db execute -f database/migrations/20251020_nylas_calendar.sql
```

**Verify it worked:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'brokers' 
AND column_name LIKE 'nylas%';
```

You should see:
- nylas_grant_id
- calendar_provider  
- calendar_synced_at

---

### Step 2: Deploy Supabase Edge Functions (10 minutes)

**Prerequisites:**
- Supabase CLI installed: `npm install -g supabase`
- Nylas API credentials from https://dashboard.nylas.com

**Commands:**

```powershell
# Make sure you're in the project directory
cd C:\Users\alex\OneDrive\Desktop\Cursor\equity-connect

# Login to Supabase (if not already)
supabase login

# Link to your project (if not already)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy both OAuth functions
supabase functions deploy nylas-auth-url
supabase functions deploy nylas-callback

# Set environment secrets (use your actual values)
supabase secrets set NYLAS_CLIENT_ID=your_client_id_here
supabase secrets set NYLAS_CLIENT_SECRET=your_secret_here
supabase secrets set NYLAS_API_KEY=your_api_key_here
supabase secrets set NYLAS_REDIRECT_URI=https://portal.equityconnect.com/calendar/callback
```

**Verify it worked:**
```powershell
supabase functions list
```

You should see:
- nylas-auth-url
- nylas-callback

---

### Step 3: Import n8n Workflow (5 minutes)

1. **Go to:** https://n8n.instaroute.com
2. **Click:** "+ Add workflow"
3. **Click:** ⋮ menu → "Import from File"
4. **Select:** `workflows/broker-calendar-nylas.json`
5. **Create Nylas credential:**
   - Go to: Credentials → "+ Add Credential"
   - Type: "HTTP Header Auth"
   - Name: "Nylas API Key"
   - Header Name: `Authorization`
   - Header Value: `Bearer YOUR_NYLAS_API_KEY`
   - Save
6. **Update workflow nodes:**
   - Click "Nylas: Get Calendar Events" node
   - Select credential: "Nylas API Key"
   - Click "Nylas: Create Calendar Event" node
   - Select credential: "Nylas API Key"
7. **Activate workflow:** Toggle "Inactive" → "Active"

---

## 🧪 Test It Works

### Test 1: Check Database
```sql
SELECT * FROM get_brokers_needing_calendar_sync();
```

Should show list of active brokers without calendar synced.

### Test 2: Test Nylas API
```powershell
# Via PowerShell (replace YOUR_API_KEY)
$headers = @{"Authorization"="Bearer YOUR_API_KEY"}
Invoke-RestMethod -Uri "https://api.us.nylas.com/v3/grants" -Headers $headers
```

Should return list of connected accounts (might be empty if no one synced yet).

### Test 3: Test n8n Webhook
```powershell
# Test availability webhook
Invoke-RestMethod -Method Post `
  -Uri "https://n8n.instaroute.com/webhook/broker-availability-nylas" `
  -ContentType "application/json" `
  -Body '{"broker_id":"test","preferred_day":"tuesday"}'
```

Should return error "Broker not found" (that's OK - means webhook works).

---

## 🎯 Next Steps

### For Brokers to Use:
1. Add `CalendarSync.vue` to your Vue portal
2. Add route: `/broker/calendar`
3. Brokers visit that page to sync their calendar
4. They choose Google/Outlook/iCloud and grant permissions
5. Done! Barbara can now check their real availability

### For Barbara to Use:
Already works! Barbara has these tools:
- `check_broker_availability` - Returns real available slots
- `book_appointment` - Creates calendar event + sends invite

---

## 📝 Configuration Checklist

Make sure these are in your `.env`:

```bash
# Nylas (REQUIRED)
NYLAS_CLIENT_ID=your_client_id_here
NYLAS_CLIENT_SECRET=your_secret_here  
NYLAS_API_KEY=your_api_key_here
NYLAS_API_URL=https://api.us.nylas.com
NYLAS_REDIRECT_URI=https://portal.equityconnect.com/calendar/callback

# n8n Webhooks (REQUIRED)
N8N_AVAILABILITY_WEBHOOK=https://n8n.instaroute.com/webhook/broker-availability-nylas
N8N_BOOKING_WEBHOOK=https://n8n.instaroute.com/webhook/broker-book-appointment-nylas

# Supabase (ALREADY HAVE)
SUPABASE_URL=https://your_project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
```

---

## 🆘 Troubleshooting

### "supabase: command not found"
```powershell
npm install -g supabase
```

### "Failed to deploy functions"
Make sure you're linked to your project:
```powershell
supabase link --project-ref YOUR_PROJECT_REF
```

### "Nylas API returns 401"
Check your `NYLAS_API_KEY` in .env starts with `nyk_`

### "Broker calendar not synced"
Normal! Brokers need to visit `/broker/calendar` page to sync.

---

## ⚡ Super Quick Summary

1. **Run SQL:** Copy `run-migration.sql` into Supabase SQL Editor
2. **Deploy Functions:** `supabase functions deploy nylas-auth-url && supabase functions deploy nylas-callback`
3. **Import n8n:** Upload `workflows/broker-calendar-nylas.json` to n8n

**That's it! Everything else is already built.**

---

**Need help?** Check `NYLAS_DEPLOYMENT_CHECKLIST.md` for detailed instructions.

**Want to test?** Use the PowerShell script: `./deploy-nylas.ps1`

