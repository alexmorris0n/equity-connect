# Broker Calendar Onboarding - Nylas Integration

## Overview

**Problem:** Brokers use different calendar systems (Google, Outlook, iCloud, etc.)

**Solution:** Nylas - ONE API for ALL calendar providers

### What is Nylas?

Nylas is a unified calendar API that:
- ✅ Handles OAuth for Google, Microsoft, iCloud, etc.
- ✅ Stores tokens securely (you never touch them)
- ✅ Auto-refreshes expired tokens
- ✅ One API for all providers
- ✅ Sends calendar invites automatically

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 BROKER CALENDAR FLOW                 │
└─────────────────────────────────────────────────────┘

📧 Broker receives email: "Sync Your Calendar"
  ↓
Clicks link → Vue Portal (portal.equityconnect.com)
  ↓
Broker logs in (Supabase Auth)
  ↓
"Sync Calendar" button → Nylas OAuth popup
  ↓
Broker signs into Google/Outlook/etc.
  ↓
Nylas returns grant_id (e.g., "nylas-grant-abc123")
  ↓
Portal saves to Supabase: brokers.nylas_grant_id
  ↓
✅ Calendar synced!

───────────────────────────────────────────────────────

📞 Lead calls Barbara
  ↓
Barbara: "Would you like to speak with Walter?"
Lead: "Yes!"
  ↓
Barbara calls tool: check_broker_availability()
  ↓
Bridge → n8n webhook
  ↓
n8n:
  1. Get broker from Supabase (fetch nylas_grant_id)
  2. Call Nylas API: GET /v3/grants/{grant_id}/events
  3. Calculate free slots (9 AM - 5 PM, excluding busy times)
  4. Return available slots
  ↓
Barbara: "Walter is free Tuesday at 10 AM or Thursday at 2 PM"
Lead: "Tuesday at 10 AM"
  ↓
Barbara calls tool: book_appointment()
  ↓
Bridge → n8n webhook
  ↓
n8n:
  1. Get broker's nylas_grant_id
  2. Call Nylas API: POST /v3/grants/{grant_id}/events
     - Creates event on broker's calendar
     - Nylas automatically sends invite to lead's email
  3. Log to Supabase interactions table
  4. Return success
  ↓
Barbara: "You're all set! Walter will call you Tuesday at 10 AM. 
         Check your email for the calendar invite."
  ↓
✅ Lead receives calendar invite
✅ Broker sees event in their calendar
✅ Logged in Supabase for tracking
```

---

## Benefits vs. Multi-Provider OAuth

### **Old Approach (Multi-Provider)**
- ❌ Manage 4 different OAuth flows
- ❌ 4 different credential types in n8n
- ❌ Complex switch logic
- ❌ Token refresh for each provider
- ❌ Can't send invites easily
- ❌ iCloud doesn't work

### **Nylas Approach**
- ✅ ONE OAuth flow for all providers
- ✅ ONE API endpoint
- ✅ Nylas handles token refresh
- ✅ Auto-sends calendar invites
- ✅ Works with Google, Outlook, iCloud, Exchange
- ✅ Simple n8n workflow

---

## Database Schema

### **New Schema (Nylas)**

```sql
-- Simple! Just one column
ALTER TABLE brokers
ADD COLUMN IF NOT EXISTS nylas_grant_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS calendar_provider VARCHAR(20),  -- Auto-detected by Nylas
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Los_Angeles',
ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ;

-- Remove old columns (if they exist)
ALTER TABLE brokers
DROP COLUMN IF EXISTS calendar_credential_name,
DROP COLUMN IF EXISTS google_calendar_id,
DROP COLUMN IF EXISTS outlook_calendar_id,
DROP COLUMN IF EXISTS ghl_location_id,
DROP COLUMN IF EXISTS icloud_calendar_url;

-- Comments
COMMENT ON COLUMN brokers.nylas_grant_id IS 'Nylas grant ID (e.g., nylas-grant-abc123)';
COMMENT ON COLUMN brokers.calendar_provider IS 'Auto-detected: google | microsoft | icloud';
COMMENT ON COLUMN brokers.calendar_synced_at IS 'When broker last synced their calendar';

-- Example
UPDATE brokers 
SET nylas_grant_id = 'nylas-grant-abc123',
    calendar_provider = 'google',
    calendar_synced_at = NOW()
WHERE id = 'broker-456';
```

---

## Nylas Setup

### **Step 1: Create Nylas Application**

1. Go to https://dashboard.nylas.com
2. Create new application
3. Get your credentials:
   - **Client ID**: `nylas_client_id_xxx`
   - **Client Secret**: `nylas_secret_xxx`
   - **API Key**: `nylas_api_key_xxx`

4. Set redirect URI:
   - `https://portal.equityconnect.com/calendar/callback`

5. Enable providers:
   - ✅ Google
   - ✅ Microsoft
   - ✅ iCloud

### **Step 2: Store Credentials**

```bash
# In your .env
NYLAS_CLIENT_ID=nylas_client_id_xxx
NYLAS_CLIENT_SECRET=nylas_secret_xxx
NYLAS_API_KEY=nylas_api_key_xxx
NYLAS_REDIRECT_URI=https://portal.equityconnect.com/calendar/callback
```

---

## Vue Portal - Calendar Sync Component

### **Component: CalendarSync.vue**

```vue
<template>
  <div class="calendar-sync">
    <div v-if="!calendarSynced" class="sync-needed">
      <h2>📅 Sync Your Calendar</h2>
      <p>To enable live appointment booking, connect your calendar:</p>
      
      <button @click="syncCalendar" class="btn-primary" :disabled="loading">
        <span v-if="!loading">🔄 Sync Calendar</span>
        <span v-else>⏳ Connecting...</span>
      </button>
      
      <p class="help-text">
        Works with Google Calendar, Outlook, and iCloud
      </p>
    </div>
    
    <div v-else class="sync-complete">
      <h2>✅ Calendar Synced</h2>
      <p>Your {{ calendarProvider }} calendar is connected</p>
      <p class="text-muted">Last synced: {{ lastSynced }}</p>
      
      <button @click="resyncCalendar" class="btn-secondary">
        🔄 Re-sync Calendar
      </button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';

export default {
  name: 'CalendarSync',
  setup() {
    const loading = ref(false);
    const calendarSynced = ref(false);
    const calendarProvider = ref('');
    const lastSynced = ref('');
    
    // Check if calendar already synced
    onMounted(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: broker } = await supabase
        .from('brokers')
        .select('nylas_grant_id, calendar_provider, calendar_synced_at')
        .eq('user_id', user.id)
        .single();
      
      if (broker?.nylas_grant_id) {
        calendarSynced.value = true;
        calendarProvider.value = broker.calendar_provider || 'Unknown';
        lastSynced.value = new Date(broker.calendar_synced_at).toLocaleDateString();
      }
    });
    
    // Start Nylas OAuth flow
    const syncCalendar = async () => {
      loading.value = true;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        
        // Get broker_id
        const { data: broker } = await supabase
          .from('brokers')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (!broker) throw new Error('Broker not found');
        
        // Call your backend to generate Nylas auth URL
        const response = await fetch('/api/nylas/auth-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ broker_id: broker.id })
        });
        
        const { auth_url } = await response.json();
        
        // Redirect to Nylas OAuth
        window.location.href = auth_url;
        
      } catch (error) {
        console.error('Sync error:', error);
        alert('Failed to sync calendar. Please try again.');
        loading.value = false;
      }
    };
    
    const resyncCalendar = syncCalendar;
    
    return {
      loading,
      calendarSynced,
      calendarProvider,
      lastSynced,
      syncCalendar,
      resyncCalendar
    };
  }
};
</script>

<style scoped>
.calendar-sync {
  max-width: 500px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.btn-primary {
  background: #2563eb;
  color: white;
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  margin: 1rem 0;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6b7280;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.help-text {
  color: #6b7280;
  font-size: 0.9rem;
  margin-top: 1rem;
}

.text-muted {
  color: #9ca3af;
  font-size: 0.9rem;
}

.sync-complete {
  padding: 2rem;
  background: #f0fdf4;
  border-radius: 8px;
  border: 2px solid #86efac;
}
</style>
```

### **API Endpoint: Generate Nylas Auth URL**

```javascript
// Supabase Edge Function or Express endpoint
// /api/nylas/auth-url

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { broker_id } = await req.json();
  
  const nylasAuthUrl = `https://api.nylas.com/v3/connect/auth?` + 
    `client_id=${Deno.env.get('NYLAS_CLIENT_ID')}&` +
    `redirect_uri=${encodeURIComponent(Deno.env.get('NYLAS_REDIRECT_URI'))}&` +
    `response_type=code&` +
    `state=${broker_id}&` +  // Pass broker_id as state
    `access_type=offline`;    // Get refresh token
  
  return new Response(JSON.stringify({ auth_url: nylasAuthUrl }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### **API Endpoint: Handle OAuth Callback**

```javascript
// /api/nylas/callback

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const broker_id = url.searchParams.get('state');
  
  if (!code || !broker_id) {
    return new Response('Missing code or state', { status: 400 });
  }
  
  // Exchange code for grant
  const response = await fetch('https://api.nylas.com/v3/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('NYLAS_API_KEY')}`
    },
    body: JSON.stringify({
      client_id: Deno.env.get('NYLAS_CLIENT_ID'),
      client_secret: Deno.env.get('NYLAS_CLIENT_SECRET'),
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: Deno.env.get('NYLAS_REDIRECT_URI')
    })
  });
  
  const { grant_id, provider } = await response.json();
  
  // Save to Supabase
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  );
  
  await supabase
    .from('brokers')
    .update({
      nylas_grant_id: grant_id,
      calendar_provider: provider,
      calendar_synced_at: new Date().toISOString()
    })
    .eq('id', broker_id);
  
  // Redirect back to portal
  return Response.redirect('https://portal.equityconnect.com/dashboard?calendar_synced=true');
});
```

---

## n8n Workflow - Simplified

### **Workflow 1: Check Availability**

```
📅 Webhook: /broker-availability
  ↓
Get Broker Info (Supabase)
  ↓
Call Nylas API (HTTP Request):
  GET https://api.nylas.com/v3/grants/{nylas_grant_id}/events
  Query: start_time, end_time
  ↓
Calculate Free Slots (Code)
  ↓
Respond with JSON
```

**No more Switch node!** Just one HTTP request to Nylas.

### **Workflow 2: Book Appointment**

```
📝 Webhook: /broker-book-appointment
  ↓
Get Broker Info (Supabase)
  ↓
Call Nylas API (HTTP Request):
  POST https://api.nylas.com/v3/grants/{nylas_grant_id}/events
  Body: {
    title: "Reverse Mortgage Consultation - {lead_name}",
    when: { start_time, end_time },
    participants: [
      { email: broker_email },
      { email: lead_email }  ← Auto-sends invite!
    ]
  }
  ↓
Log to Supabase
  ↓
Respond Success
```

**Nylas automatically sends calendar invite to lead!**

---

## Implementation Steps

### **Phase 1: Nylas Setup (15 minutes)**

1. ✅ Sign up for Nylas (already done!)
2. Create application in Nylas dashboard
3. Copy Client ID, Secret, API Key
4. Add to `.env`

### **Phase 2: Database Migration (5 minutes)**

```bash
# Run migration
psql -h your-supabase-host -d postgres -f database/migrations/20251020_nylas_calendar.sql
```

### **Phase 3: Create API Endpoints (30 minutes)**

Create 2 Supabase Edge Functions:
1. `/api/nylas/auth-url` - Generate OAuth URL
2. `/api/nylas/callback` - Handle OAuth callback

### **Phase 4: Vue Portal Component (20 minutes)**

1. Add `CalendarSync.vue` to your Vue app
2. Add route: `/broker/calendar`
3. Test OAuth flow

### **Phase 5: n8n Workflow (20 minutes)**

1. Import updated workflow
2. Update Nylas credentials
3. Test availability check
4. Test booking

### **Phase 6: Test End-to-End (15 minutes)**

1. Broker syncs calendar in portal
2. Verify `nylas_grant_id` saved in database
3. Test Barbara calling tools
4. Verify calendar invite sent to lead

**Total: ~2 hours**

---

## Broker Onboarding Flow

### **Option 1: Email Trigger (Simpler)**

```
You send email to broker:
  
  Subject: Setup Your Calendar for Live Booking
  
  Hi Walter,
  
  To enable live appointment booking, please sync your calendar:
  
  👉 https://portal.equityconnect.com/broker/calendar
  
  This takes 30 seconds and works with Google, Outlook, or iCloud.
  
  Thanks!
  
Broker clicks link → Vue portal → "Sync Calendar" → OAuth → Done!
```

### **Option 2: In-Portal (Self-Service)**

```
Broker logs into portal
  ↓
Dashboard shows: ⚠️ Calendar Not Synced
  ↓
Click "Sync Calendar" button
  ↓
OAuth flow → Done!
```

**Recommendation:** Option 1 (email) for MVP, then add Option 2 later.

---

## Cost Comparison

| Solution | Setup | Monthly Cost | Notes |
|----------|-------|--------------|-------|
| **Nylas** | Easy | FREE (up to 5 accounts)<br>$9/account after | Clean API |
| Multi-Provider OAuth | Complex | FREE | But you manage tokens |
| Cal.com Cloud | Easy | $15/user | Expensive at scale |
| Cal.com Self-Hosted | Medium | FREE | But you maintain it |

**For 10 brokers:**
- Nylas: First 5 free, then $45/month (5 × $9)
- Cal.com: $150/month

**Nylas is cheaper AND simpler!**

---

## Security & Compliance

### **What Nylas Stores**
- ✅ OAuth tokens (encrypted)
- ✅ Calendar events (cached temporarily)
- ✅ Provider info

### **What YOU Store**
- ✅ `nylas_grant_id` (just an ID, not sensitive)
- ✅ `calendar_provider` (google/microsoft/icloud)
- ✅ `calendar_synced_at` (timestamp)

**You NEVER touch OAuth tokens!** Nylas handles everything.

---

## Barbara's Tools Update

### **Tool: check_broker_availability**

```javascript
{
  name: "check_broker_availability",
  description: "Check broker's real calendar availability",
  parameters: {
    broker_id: { type: "string", required: true },
    preferred_day: { type: "string", enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "any"] },
    preferred_time: { type: "string", enum: ["morning", "afternoon", "any"] }
  },
  handler: async ({ broker_id, preferred_day, preferred_time }) => {
    const response = await fetch('https://n8n.instaroute.com/webhook/broker-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broker_id, preferred_day, preferred_time })
    });
    return await response.json();
  }
}
```

### **Tool: book_appointment**

```javascript
{
  name: "book_appointment",
  description: "Book appointment on broker's calendar (sends invite to lead)",
  parameters: {
    broker_id: { type: "string", required: true },
    lead_id: { type: "string", required: true },
    lead_name: { type: "string", required: true },
    lead_email: { type: "string", required: true },
    lead_phone: { type: "string", required: true },
    datetime: { type: "string", required: true, description: "ISO 8601 datetime" }
  },
  handler: async (params) => {
    const response = await fetch('https://n8n.instaroute.com/webhook/broker-book-appointment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await response.json();
  }
}
```

**Key difference:** `book_appointment` now includes `lead_email` so Nylas can send calendar invite!

---

## Migration from Old System

### **If You Already Have Cal.com/Multi-Provider Setup**

```sql
-- Step 1: Add new Nylas column
ALTER TABLE brokers ADD COLUMN nylas_grant_id VARCHAR(200);

-- Step 2: For each broker, sync via Nylas
-- (They'll need to re-authenticate)

-- Step 3: Once all migrated, drop old columns
ALTER TABLE brokers
DROP COLUMN calendar_credential_name,
DROP COLUMN google_calendar_id,
DROP COLUMN outlook_calendar_id,
DROP COLUMN ghl_location_id,
DROP COLUMN icloud_calendar_url;
```

---

## Quick Start (MVP in 2 Hours)

### **Step 1: Nylas Setup (15 min)**
1. Go to https://dashboard.nylas.com
2. Create application
3. Copy credentials to `.env`

### **Step 2: Database (5 min)**
```bash
psql -f database/migrations/20251020_nylas_calendar.sql
```

### **Step 3: Create API Endpoints (30 min)**
- Create Supabase Edge Functions for OAuth flow
- Test OAuth with your own calendar first

### **Step 4: Add Vue Component (20 min)**
- Add `CalendarSync.vue` to portal
- Test broker can sync calendar

### **Step 5: Update n8n Workflow (20 min)**
- Import new simplified workflow
- Test availability & booking

### **Step 6: Test with Barbara (15 min)**
- Call Barbara
- Ask to book with a broker
- Verify invite sent

**Total: 2 hours** ✅

---

## Files to Create

1. ✅ `docs/BROKER_CALENDAR_ONBOARDING_NYLAS.md` - This guide
2. ⏳ `database/migrations/20251020_nylas_calendar.sql` - Database update
3. ⏳ `workflows/broker-calendar-nylas.json` - Simplified n8n workflow
4. ⏳ `portal/src/components/CalendarSync.vue` - Vue component
5. ⏳ `supabase/functions/nylas-auth-url/index.ts` - OAuth URL generator
6. ⏳ `supabase/functions/nylas-callback/index.ts` - OAuth callback handler

---

## Next Steps

**Want me to:**
1. Create the database migration?
2. Create the n8n workflow JSON?
3. Create the Supabase Edge Functions?
4. Update the bridge tools.js with Nylas integration?

Just say which ones you want and I'll create them! 🚀

