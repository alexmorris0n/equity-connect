# Broker Calendar Onboarding - Multi-Provider OAuth

## Overview

Each broker uses different calendar systems:
- **Google Calendar** (most common)
- **Outlook/Microsoft 365** (enterprise brokers)
- **GoHighLevel (GHL)** (if they use GHL CRM)
- **iCloud Calendar** (some Mac users)

**Solution:** Build ONE onboarding flow that handles all providers.

---

## Architecture

### **Unified Canvas in n8n**

**One workflow with 4 branches:**
```
📅 Check Availability Webhook
  ↓
Get Broker Info (with calendar_provider column)
  ↓
Switch by calendar_provider:
  ├─> "google" → Google Calendar node
  ├─> "outlook" → Outlook Calendar node
  ├─> "ghl" → GoHighLevel HTTP Request
  └─> "icloud" or null → Fallback slots
  ↓
Format slots (unified)
  ↓
Return to Barbara
```

**Benefits:**
- ✅ Manage all calendar logic in ONE place
- ✅ Easy to add new providers
- ✅ See all broker calendars on one canvas
- ✅ Unified monitoring

---

## OAuth Handshake - How to Get Broker Consent

### **Option 1: Broker Portal (Recommended)**

**Build a simple portal where brokers connect their calendar:**

```
https://portal.equityconnect.com/broker/calendar-setup
  ↓
Broker logs in (Supabase Auth)
  ↓
"Connect Your Calendar" page:
  - [Connect Google Calendar] button
  - [Connect Outlook Calendar] button
  - [Connect GoHighLevel] button
  - [Use Standard Hours] button (fallback)
  ↓
Broker clicks "Connect Google Calendar"
  ↓
OAuth popup:
  - Sign in to Google
  - Grant calendar permissions
  - Redirect back to portal
  ↓
Portal saves to Supabase:
  - calendar_provider: 'google'
  - google_calendar_id: 'primary'
  - tokens stored in n8n credential (via API)
```

**Tech Stack:**
- Simple HTML page with OAuth buttons
- Supabase Auth for broker login
- OAuth libraries (Google, Microsoft)
- Store credentials in Supabase + n8n

### **Option 2: Manual Setup (Faster MVP)**

**You set up calendars for brokers:**

**For each broker:**

1. **Ask broker:** "Which calendar do you use?"
2. **Broker says:** "Google Calendar - walter@myreverseoptions.com"
3. **You do ONE-TIME setup in n8n:**
   - Go to n8n Credentials
   - Add "Google Calendar OAuth2 API"
   - Name it: "Walter Richards - Google Calendar"
   - Click "Connect" and sign in as walter@myreverseoptions.com
   - Grant permissions
   - Save
4. **Update Supabase:**
   ```sql
   UPDATE brokers 
   SET calendar_provider = 'google',
       google_calendar_id = 'primary',
       calendar_credential_name = 'Walter Richards - Google Calendar'
   WHERE id = 'broker-456';
   ```

**Repeat for each broker (5-10 minutes each)**

---

## Database Schema

```sql
-- Add calendar columns to brokers table
ALTER TABLE brokers
ADD COLUMN IF NOT EXISTS calendar_provider VARCHAR(20),  -- 'google' | 'outlook' | 'ghl' | 'icloud' | 'none'
ADD COLUMN IF NOT EXISTS calendar_credential_name VARCHAR(200),  -- Name of n8n credential
ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(200),  -- Usually 'primary'
ADD COLUMN IF NOT EXISTS outlook_calendar_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS ghl_location_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS icloud_calendar_url VARCHAR(500),  -- CalDAV URL if needed
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Los_Angeles';

-- Example data
UPDATE brokers 
SET calendar_provider = 'google',
    calendar_credential_name = 'Walter Richards - Google Calendar',
    google_calendar_id = 'primary',
    timezone = 'America/Los_Angeles'
WHERE company_name = 'My Reverse Options';
```

---

## Provider-Specific Setup

### **Google Calendar**

**n8n Setup:**
1. Go to **Credentials** → **Add Credential**
2. Search: **"Google Calendar OAuth2 API"**
3. Click **"Connect my account"**
4. Sign in as broker (or have them do it via screen share)
5. Grant permissions: Read/Write calendar access
6. Save as: **"[Broker Name] - Google Calendar"**

**OAuth Scopes Needed:**
- `https://www.googleapis.com/auth/calendar.readonly` (check availability)
- `https://www.googleapis.com/auth/calendar.events` (create/modify events)

**Token Refresh:** n8n handles automatically ✅

### **Outlook/Microsoft 365**

**n8n Setup:**
1. Go to **Credentials** → **Add Credential**
2. Search: **"Microsoft Outlook OAuth2 API"**
3. Click **"Connect my account"**
4. Sign in as broker
5. Grant permissions: Calendar.ReadWrite
6. Save as: **"[Broker Name] - Outlook"**

**OAuth Scopes Needed:**
- `Calendars.ReadWrite` (read and create events)

**Token Refresh:** n8n handles automatically ✅

### **GoHighLevel (GHL)**

**n8n Setup:**
1. Go to **Credentials** → **Add Credential**
2. Search: **"GoHighLevel OAuth2 API"**
3. Enter broker's GHL API credentials
4. Get their Location ID from GHL dashboard
5. Save

**API Endpoint:**
- `GET /calendars/{locationId}/free-slots`
- `POST /calendars/{locationId}/events`

**Token Refresh:** n8n handles via OAuth2 ✅

### **iCloud Calendar**

**Problem:** No native OAuth for iCloud calendars

**Solutions:**

**Option A: App-Specific Password (Manual)**
```
1. Broker goes to appleid.apple.com
2. Generates app-specific password
3. You use CalDAV protocol with HTTP Request node
4. Endpoint: https://caldav.icloud.com/
```

**Option B: Fallback to Standard Hours**
```
Just use generic slots for iCloud brokers:
- Tuesday/Thursday
- 9 AM, 10 AM, 2 PM, 3 PM
- Broker confirms via email
```

**Recommendation:** Use **Option B** (fallback) - iCloud OAuth is too complex

---

## Broker Onboarding Flow

### **Step 1: Identify Calendar Provider**

**During broker signup:**
```
"Which calendar system do you use?"
  [ ] Google Calendar
  [ ] Outlook/Microsoft 365
  [ ] GoHighLevel
  [ ] iCloud
  [ ] None (I'll manage my own schedule)
```

### **Step 2: Connect Calendar (Per Provider)**

**Google/Outlook:**
```
"Connect Your Calendar" button
  ↓
OAuth popup
  ↓
Sign in + grant permissions
  ↓
Save credential in n8n (via their API or manual)
  ↓
Update Supabase with provider info
```

**GoHighLevel:**
```
"Enter Your GHL Location ID"
  ↓
Broker provides ID from GHL dashboard
  ↓
You set up GHL OAuth credential in n8n
  ↓
Update Supabase
```

**iCloud/None:**
```
"Set Your Standard Availability"
  ↓
Broker chooses: Tuesday/Thursday, 9-5
  ↓
Save to broker_availability table
  ↓
Use fallback slots
```

### **Step 3: Test Connection**

**In n8n:**
```
Test workflow with broker_id
  ↓
Should return their real availability
  ↓
If fails: Use fallback slots
```

---

## Multi-Provider Workflow (n8n Canvas)

### **Visual Layout**

```
┌─────────────────────────────────────────────────────┐
│              BROKER CALENDAR MANAGEMENT              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  📅 Check Availability (webhook)                    │
│         ↓                                            │
│  Get Broker Info (Supabase)                         │
│         ↓                                            │
│  Switch by calendar_provider:                       │
│         ├─> Google Calendar Node                    │
│         ├─> Outlook Calendar Node                   │
│         ├─> GoHighLevel HTTP Request                │
│         └─> Fallback Slots (Code)                   │
│         ↓                                            │
│  Format Slots (Code - unified)                      │
│         ↓                                            │
│  Respond to Barbara                                 │
│                                                      │
│  ───────────────────────────────────────            │
│                                                      │
│  📝 Book Appointment (webhook)                      │
│         ↓                                            │
│  Get Broker Info                                    │
│         ↓                                            │
│  Switch by calendar_provider:                       │
│         ├─> Google Calendar: Create Event           │
│         ├─> Outlook Calendar: Create Event          │
│         ├─> GoHighLevel: Create Appointment         │
│         └─> Supabase: Log appointment (no calendar) │
│         ↓                                            │
│  Log to Supabase                                    │
│         ↓                                            │
│  Respond Success                                    │
│                                                      │
│  ───────────────────────────────────────            │
│                                                      │
│  ❌ Cancel/Modify Appointment (webhook)             │
│         ↓                                            │
│  [Similar routing by provider]                      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ All calendar logic in ONE place
- ✅ Easy to see which brokers use which provider
- ✅ Add new provider = add new branch
- ✅ Unified monitoring

---

## OAuth Setup: Step-by-Step

### **For Google Calendar Brokers**

**Option A: Broker Does It (Self-Service Portal)**

Create a simple page:
```html
<!-- portal.equityconnect.com/calendar-setup -->
<button onclick="connectGoogle()">
  Connect Google Calendar
</button>

<script>
  function connectGoogle() {
    // n8n has an API to create OAuth credentials
    // OR redirect to Google OAuth directly
    const oauth_url = `https://accounts.google.com/o/oauth2/v2/auth?
      client_id=YOUR_CLIENT_ID&
      redirect_uri=https://portal.equityconnect.com/oauth/google/callback&
      response_type=code&
      scope=https://www.googleapis.com/auth/calendar&
      access_type=offline&
      state=${broker_id}`;
    
    window.location = oauth_url;
  }
</script>
```

**After redirect:**
```javascript
// portal.equityconnect.com/oauth/google/callback
const code = params.get('code');
const broker_id = params.get('state');

// Exchange code for tokens
const tokens = await getGoogleTokens(code);

// Save to Supabase
await supabase.from('broker_calendar_tokens').insert({
  broker_id,
  provider: 'google',
  access_token: tokens.access_token,
  refresh_token: tokens.refresh_token,
  expires_at: new Date(Date.now() + tokens.expires_in * 1000)
});

// Create n8n credential via API (or store tokens for use)
```

**Option B: You Do It Manually (Faster MVP)**

**For each broker:**
1. Email broker: "We're setting up live booking. Please share your Google Calendar email."
2. In n8n: Add credential for their calendar
3. Update Supabase with provider info

**Time:** 5 minutes per broker

---

## Simplified MVP Approach (Recommended)

### **Phase 1: Start with Google Only**

**Reasoning:**
- 80% of brokers probably use Google
- n8n has perfect Google Calendar support
- OAuth is seamless

**Setup:**
```sql
-- Set all brokers to Google by default
UPDATE brokers 
SET calendar_provider = 'google',
    google_calendar_id = 'primary';
```

**You manually connect their calendars in n8n** (5 min each)

### **Phase 2: Add Outlook (If Needed)**

If broker uses Outlook:
```sql
UPDATE brokers 
SET calendar_provider = 'outlook',
    outlook_calendar_id = 'primary'
WHERE id = 'broker-xyz';
```

Connect their Outlook in n8n credentials.

### **Phase 3: Fallback for Others**

GHL/iCloud brokers:
```sql
UPDATE brokers 
SET calendar_provider = 'none';
```

They get standard hours (fallback slots).

---

## Token Storage Strategy

### **Option A: n8n Credentials (Recommended)**

**How it works:**
- Create one n8n credential per broker
- n8n stores and refreshes tokens automatically
- Your workflow just references the credential name

**Pros:**
- ✅ n8n handles OAuth refresh
- ✅ Tokens encrypted by n8n
- ✅ No token management code needed

**Cons:**
- ⚠️ Manual setup per broker (but only once)

### **Option B: Supabase + Token Refresh Function**

**How it works:**
- Store tokens in Supabase (encrypted)
- Build token refresh logic
- Pass tokens to calendar APIs

**Pros:**
- ✅ Centralized token storage
- ✅ Can build self-service portal

**Cons:**
- ❌ You write OAuth refresh code
- ❌ More complex
- ❌ Security risk if not encrypted properly

**Recommendation:** Use **Option A (n8n credentials)** - simpler and n8n handles refresh!

---

## Implementation: Manual OAuth Setup (MVP)

### **For Each Google Calendar Broker**

**1. Get Broker's Calendar Email**
```
Email: "Hi Walter, to enable live booking, we need to connect 
       your Google Calendar. What email do you use for your 
       calendar? (We'll send you a secure connection link)"
       
Walter: "walter@myreverseoptions.com"
```

**2. Connect in n8n**
```
n8n → Credentials → Add Credential
  ↓
Search: "Google Calendar OAuth2 API"
  ↓
Click: "Connect my account"
  ↓
Sign in: walter@myreverseoptions.com
  ↓
Grant: Calendar read/write access
  ↓
Save as: "Walter Richards - Google Calendar"
```

**3. Update Database**
```sql
UPDATE brokers 
SET calendar_provider = 'google',
    calendar_credential_name = 'Walter Richards - Google Calendar',
    google_calendar_id = 'primary',
    timezone = 'America/Los_Angeles'
WHERE id = 'broker-456';
```

**4. Test**
```bash
curl -X POST https://n8n.instaroute.com/webhook/broker-availability \
  -d '{"broker_id": "broker-456"}'
```

Expected: Returns broker's real available times

**Time per broker:** 5 minutes

---

## Workflow Updates Needed

### **Update Switch Node**

```javascript
// In "Route by Calendar Provider" node
// Add cases for each provider:

Output 0: calendar_provider === 'google'
Output 1: calendar_provider === 'outlook'
Output 2: calendar_provider === 'ghl'
Output 3: calendar_provider === 'icloud' OR NULL (fallback)
```

### **Update Broker Info Query**

```sql
SELECT 
  b.id,
  b.contact_name,
  b.calendar_provider,
  b.google_calendar_id,
  b.outlook_calendar_id,
  b.ghl_location_id,
  b.calendar_credential_name,
  b.timezone
FROM brokers b
WHERE b.id = '{{ $json.body.broker_id }}'
LIMIT 1
```

### **Dynamic Credential Selection**

**In Google Calendar node:**
```
Credential: {{ $('Get Broker Info').item.json.calendar_credential_name }}
```

n8n will use the correct credential for each broker!

---

## Migration Script

```sql
-- Add calendar columns
ALTER TABLE brokers
ADD COLUMN IF NOT EXISTS calendar_provider VARCHAR(20) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS calendar_credential_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS outlook_calendar_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS ghl_location_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS icloud_calendar_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Los_Angeles',
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"monday": ["09:00-17:00"], "tuesday": ["09:00-17:00"], "wednesday": ["09:00-17:00"], "thursday": ["09:00-17:00"], "friday": ["09:00-17:00"]}'::jsonb;

-- Set default for existing brokers (will update manually)
UPDATE brokers 
SET calendar_provider = 'none'
WHERE calendar_provider IS NULL;

COMMENT ON COLUMN brokers.calendar_provider IS 'google | outlook | ghl | icloud | none';
COMMENT ON COLUMN brokers.business_hours IS 'Fallback hours if no calendar connected';
```

---

## Quick Start (10 Brokers in 1 Hour)

### **Batch Setup Process**

**Preparation (10 minutes):**
1. Email all brokers: "What calendar do you use? Google, Outlook, or other?"
2. Collect responses

**Setup (5 min per broker):**
1. Open n8n credentials
2. Add Google Calendar OAuth for broker
3. Sign in as them (or have them screen share)
4. Update Supabase with their info
5. Test with their broker_id

**Total time:** 10 min prep + (10 brokers × 5 min) = 60 minutes

---

## Self-Service Portal (Future)

### **If You Want Brokers to Connect Themselves**

**Build simple portal:**

```
https://portal.equityconnect.com/calendar

┌─────────────────────────────────────────┐
│  Connect Your Calendar                   │
├─────────────────────────────────────────┤
│                                          │
│  To enable live appointment booking,     │
│  connect your calendar below:            │
│                                          │
│  [🔵 Connect Google Calendar]            │
│  [🔵 Connect Outlook Calendar]           │
│  [📅 Use Standard Hours (No Calendar)]   │
│                                          │
│  Current Status: ❌ Not Connected        │
│                                          │
└─────────────────────────────────────────┘
```

**Tech:**
- Simple React/Vue page
- Supabase Auth for broker login
- OAuth libraries (Google, Microsoft SDK)
- On success: Create n8n credential via API

**Effort:** 2-3 days development

---

## Recommendation

### **For MVP (Launch This Week):**

**Manual Setup:**
1. Pick your top 3 brokers
2. Manually connect their Google Calendars in n8n (15 minutes total)
3. Update their broker records
4. Test with Barbara
5. Others use fallback slots

**Effort:** 30 minutes  
**Risk:** 🟢 LOW  
**Gets you live!**

### **After MVP Proven:**

**Self-Service Portal:**
1. Build broker portal
2. OAuth buttons for Google/Outlook
3. Brokers connect themselves
4. Scales to 100+ brokers

**Effort:** 1-2 weeks  
**Benefit:** Self-service onboarding

---

## Files Created

- ✅ `workflows/broker-calendar-unified.json` - One canvas for all providers
- ✅ `docs/BROKER_CALENDAR_ONBOARDING.md` - This guide

---

## Quick Answer

**Q: Should workflows be on one canvas?**  
**A:** YES! Easier to manage, monitor, and debug.

**Q: How to get OAuth from brokers?**  
**A:** 
- **MVP:** You manually connect in n8n (5 min/broker)
- **Scale:** Build self-service portal (brokers connect themselves)

**Q: What about different providers?**  
**A:**
- Google/Outlook: n8n native nodes (easy)
- GHL: n8n HTTP Request node (medium)
- iCloud: Use fallback slots (complex OAuth not worth it)

**Want me to commit all this and create the database migration?** 🚀

