# Calendar Integration Guide - Live Booking System

## The Problem

**You need to prevent brokers from saying:**
- "I was busy, couldn't take the call"
- "Lead called at a bad time"  
- "I missed them, so I can't pay you"

**Solution:** Check broker's **real calendar** before booking = No excuses!

---

## Why NOT Cal.com (Avoiding $15/seat fees)

### **Cal.com Pricing**

**Self-Hosted:**
- ✅ FREE (unlimited)
- ✅ API access included
- ❌ You maintain it

**Cloud:**
- Free: 1 user only
- Teams: **$15/user/month** ← This is what you want to avoid
- For 10 brokers: $150/month
- For 100 brokers: $1,500/month

**Problem:** You'd need Teams plan for multiple brokers = expensive!

---

## The Better Solution: n8n as Calendar Gateway

**You already have n8n**, which has **native Google Calendar nodes** with OAuth built-in!

### **Architecture**

```
Barbara (OpenAI Realtime)
  ↓
"Check if Walter is available Tuesday at 10 AM"
  ↓
Bridge calls tool: check_broker_availability
  ↓
Bridge HTTP request → n8n Webhook
  ↓
n8n Workflow:
  1. Gets broker_id
  2. Looks up broker's Google Calendar ID
  3. Google Calendar node: Get Free/Busy ← Native n8n node!
  4. Calculates available slots
  5. Returns JSON
  ↓
Barbara: "Walter is available Tuesday at 10 AM or Thursday at 2 PM"
  ↓
Lead chooses Tuesday 10 AM
  ↓
Barbara calls: book_appointment
  ↓
Bridge HTTP request → n8n Webhook
  ↓
n8n Workflow:
  1. Google Calendar node: Create Event ← Native!
  2. Logs to Supabase
  3. Returns success
  ↓
Barbara: "You're all set! Walter will call you Tuesday at 10 AM."
  ↓
Barbara calls: assign_tracking_number (for billing protection)
```

---

## Benefits

✅ **FREE** - No Cal.com subscription fees  
✅ **n8n handles OAuth** - Google Calendar node manages tokens  
✅ **Real-time availability** - Checks actual calendar  
✅ **No double-bookings** - Books directly in Google Calendar  
✅ **Scales to 100+ brokers** - No per-seat fees  
✅ **Already have it** - Using tools you're paying for anyway  

---

## Setup Guide

### **Step 1: Connect Google Calendar to n8n**

**One-time setup per broker:**

1. In n8n, go to **Credentials**
2. Click **"Add Credential"**
3. Search for **"Google Calendar OAuth2 API"**
4. Click **"Connect my account"**
5. Sign in as the broker (or have them do it)
6. Grant calendar permissions
7. Save credential as: **"Google Calendar - Walter Richards"**

**Repeat for each broker.**

### **Step 2: Store Calendar IDs in Supabase**

```sql
-- Add column to brokers table
ALTER TABLE brokers 
ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS calendar_credential_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Los_Angeles';

-- Update for each broker
UPDATE brokers 
SET google_calendar_id = 'primary',  -- Usually 'primary' for main calendar
    calendar_credential_name = 'Google Calendar - Walter Richards',
    timezone = 'America/Los_Angeles'
WHERE id = 'broker-456';
```

### **Step 3: Import n8n Workflows**

**In n8n:**

1. Click **"Add workflow"** → **"Import from File"**
2. Upload: `workflows/broker-calendar-availability.json`
3. Update credentials in each node
4. Activate workflow
5. Copy webhook URL: `https://n8n.instaroute.com/webhook/broker-availability`

**Repeat for:**
- `workflows/broker-calendar-book-appointment.json`

### **Step 4: Configure Bridge Environment**

```bash
# In bridge .env
N8N_AVAILABILITY_WEBHOOK=https://n8n.instaroute.com/webhook/broker-availability
N8N_BOOKING_WEBHOOK=https://n8n.instaroute.com/webhook/broker-book-appointment
```

### **Step 5: Test End-to-End**

**Test availability check:**
```bash
curl -X POST https://n8n.instaroute.com/webhook/broker-availability \
  -H "Content-Type: application/json" \
  -d '{
    "broker_id": "broker-456",
    "preferred_day": "tuesday",
    "preferred_time": "morning"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "available_slots": [
    {
      "datetime": "2025-10-22T10:00:00Z",
      "display": "Tuesday Oct 22 at 10:00 AM",
      "day": "tuesday",
      "time": "10:00 AM"
    },
    {
      "datetime": "2025-10-22T11:00:00Z",
      "display": "Tuesday Oct 22 at 11:00 AM",
      "day": "tuesday",
      "time": "11:00 AM"
    }
  ]
}
```

---

## Barbara's Calendar Workflow

### **1. Lead Wants to Book**

```
Barbara: "Would you like to speak with Walter to go over your options?"
Lead: "Yes!"
Barbara: "Great! Let me check what's available..."

[Barbara calls: check_broker_availability({ broker_id: "broker-456" })]

Barbara: "Walter is available Tuesday at 10 AM or Thursday at 2 PM. 
         Which works better for you?"
Lead: "Tuesday at 10 AM"
```

### **2. Barbara Books Appointment**

```
[Barbara calls: book_appointment({
  lead_id: "abc-123",
  broker_id: "broker-456",
  scheduled_for: "2025-10-22T10:00:00Z",
  notes: "Lead interested in debt consolidation"
})]

n8n creates Google Calendar event:
  - Title: "Reverse Mortgage Consultation - Testy McTesterson"
  - Time: Tuesday Oct 22, 10:00 AM
  - Description: Lead phone, email, tracking number
  - Sends invite to broker

Barbara: "Perfect! You're all set for Tuesday at 10 AM. 
         Walter will call you then."
```

### **3. Barbara Assigns Tracking Number**

```
[Barbara calls: assign_tracking_number({
  lead_id: "abc-123",
  broker_id: "broker-456",
  signalwire_number: "+14244851544",
  appointment_datetime: "2025-10-22T10:00:00Z"
})]

Database assigns number for call tracking.

Barbara: "Would you like a text reminder?"
```

---

## Broker Can't Make Excuses

### **Excuse 1: "I was busy"**

**Broker:** "I had another meeting, couldn't take the call."

**EC Response:**  
"We checked your Google Calendar before booking. You were free at 10 AM on Tuesday. That's why Barbara scheduled it then."

**Proof:** Calendar showed availability → Appointment booked → Broker must honor it.

### **Excuse 2: "Lead never called"**

**Broker:** "Lead didn't call the number."

**EC Response:**  
"We have call logs showing lead called +1-424-485-1544 at 10:05 AM."

**Proof:** `billing_call_logs` shows lead_to_broker call.

### **Excuse 3: "It was a 2-minute call, not worth $50"**

**Broker:** "Lead hung up immediately, shouldn't count."

**EC Response:**  
"Call duration was 15 minutes. That's a full consultation."

**Proof:** `duration_seconds: 900` in billing logs.

---

## Cost Comparison

| Solution | Setup | Per Broker | 10 Brokers | 100 Brokers |
|----------|-------|------------|------------|-------------|
| **Cal.com Cloud** | Easy | $15/mo | $150/mo | $1,500/mo |
| **Cal.com Self-Hosted** | Medium | FREE | FREE | FREE |
| **n8n Gateway (Recommended)** | Easy | FREE | FREE | FREE |

**n8n Approach = $0 extra cost** (you already pay for n8n)

---

## n8n Workflow Details

### **Workflow 1: Check Availability**

**Input (from Barbara):**
```json
{
  "broker_id": "broker-456",
  "preferred_day": "tuesday",
  "preferred_time": "morning"
}
```

**Processing:**
1. Query Supabase for broker's `google_calendar_id`
2. Call Google Calendar API: Get events (next 14 days)
3. Calculate open slots (9 AM - 5 PM, excluding busy times)
4. Filter by preferred day/time
5. Return first 5 slots

**Output (to Barbara):**
```json
{
  "success": true,
  "available_slots": [
    { "datetime": "2025-10-22T10:00:00Z", "display": "Tuesday Oct 22 at 10:00 AM" },
    { "datetime": "2025-10-22T11:00:00Z", "display": "Tuesday Oct 22 at 11:00 AM" }
  ]
}
```

### **Workflow 2: Book Appointment**

**Input (from Barbara):**
```json
{
  "broker_id": "broker-456",
  "lead_id": "abc-123",
  "lead_name": "Testy McTesterson",
  "lead_phone": "+16505300051",
  "datetime": "2025-10-22T10:00:00Z",
  "tracking_number": "+14244851544"
}
```

**Processing:**
1. Get broker's calendar info
2. Create Google Calendar event:
   - Title: "Reverse Mortgage Consultation - Testy McTesterson"
   - Time: Oct 22, 10:00 AM (1 hour)
   - Description: Lead details + tracking number
3. Log to Supabase interactions table
4. Send calendar invite to broker

**Output (to Barbara):**
```json
{
  "success": true,
  "event_id": "google-event-12345",
  "message": "Appointment booked successfully"
}
```

---

## OAuth Token Management

### **n8n Handles It!**

**When you connect Google Calendar credential in n8n:**
- ✅ n8n stores access_token and refresh_token
- ✅ n8n automatically refreshes tokens when expired
- ✅ You never touch OAuth code
- ✅ Works forever once connected

**You just use the Google Calendar node:**
```
Google Calendar: Get Events
  - Calendar: {{ broker.google_calendar_id }}
  - Start: {{ date_start }}
  - End: {{ date_end }}
```

n8n handles all the OAuth complexity!

---

## Alternative: Supabase Edge Function (if you prefer)

If you don't want to use n8n webhooks, you could create Supabase Edge Functions:

```typescript
// supabase/functions/check-broker-availability/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { google } from 'https://esm.sh/googleapis@118.0.0';

serve(async (req) => {
  const { broker_id, preferred_day } = await req.json();
  
  // Get broker's OAuth tokens from database
  const { data: broker } = await supabase
    .from('brokers')
    .select('google_access_token, google_refresh_token')
    .eq('id', broker_id)
    .single();
  
  // Initialize Google Calendar client
  const calendar = google.calendar({
    version: 'v3',
    auth: oauth2Client
  });
  
  // Check availability...
  
  return new Response(JSON.stringify({ available_slots }));
});
```

**But this requires:**
- ❌ Manual OAuth token management
- ❌ Token refresh logic
- ❌ More code to maintain

**n8n is simpler!**

---

## Migration Path

### **Phase 1: MVP (Launch Now)**

Use **simple fallback slots** (already implemented in bridge):
- Barbara offers: "Tuesday or Thursday, morning or afternoon?"
- No real calendar checking
- Broker confirms via email

### **Phase 2: Real Calendar (After Testing)**

1. Connect Google Calendar credentials in n8n (one per broker)
2. Import the 2 workflows I created
3. Update broker records with `google_calendar_id`
4. Barbara now checks real availability!

### **Phase 3: Advanced Features (Optional)**

- Reschedule/cancel tools
- Multi-timezone support
- Buffer time between appointments
- Outlook integration (n8n has native node)

---

## Setup Checklist

- [ ] **Step 1:** Add `google_calendar_id` column to brokers table
- [ ] **Step 2:** Connect Google Calendar credential in n8n for each broker
- [ ] **Step 3:** Import workflows: `broker-calendar-availability.json` and `broker-calendar-book-appointment.json`
- [ ] **Step 4:** Update broker records with calendar IDs
- [ ] **Step 5:** Set environment variables in bridge
- [ ] **Step 6:** Test availability check
- [ ] **Step 7:** Test booking
- [ ] **Step 8:** Go live!

---

## Files Created

- ✅ `workflows/broker-calendar-availability.json` - Check calendar via n8n
- ✅ `workflows/broker-calendar-book-appointment.json` - Book via n8n
- ✅ `bridge/tools.js` - Updated to call n8n webhooks
- ✅ `env.template` - Added webhook URLs

---

## Cost Summary

| Approach | Monthly Cost | Notes |
|----------|--------------|-------|
| **n8n Gateway** | **$0** | You already pay for n8n |
| Cal.com Cloud | $150-$1,500 | $15/broker |
| Cal.com Self-Hosted | $0 | But you maintain it |
| Direct Google API | $0 | But complex OAuth code |

**Recommendation: n8n Gateway** = Free + Simple + Already have it!

---

**Next:** Want me to create the database migration for adding `google_calendar_id` to brokers table?

