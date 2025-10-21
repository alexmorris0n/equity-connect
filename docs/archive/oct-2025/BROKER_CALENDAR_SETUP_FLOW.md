# Broker Calendar Setup - When You Need Client Secret

## Current Setup (No Client Secret Needed)

**What you're doing now:**
1. You manually add broker grant_id to database
2. Barbara uses that grant_id to check availability and book appointments
3. **Works perfectly for testing and early production!**

```sql
-- Manual setup (what you do now)
UPDATE brokers 
SET nylas_grant_id = 'c18c3f0f-2cb2-4b39-bc87-3a72ee4f10aa',
    email = 'alex@instaroute.com'
WHERE id = '6a3c5ed5-664a-4e13-b019-99fe8db74174';
```

## Future Setup (Needs Client Secret)

**When you build the Vue portal for brokers to self-service:**

### The Vue Page Flow

**1. Broker Portal - Calendar Setup Page**
```vue
<!-- CalendarSync.vue -->
<template>
  <div>
    <h2>Connect Your Calendar</h2>
    <button @click="connectCalendar">
      Connect Google Calendar
    </button>
  </div>
</template>
```

**2. Broker Clicks "Connect Calendar"**
- Vue app calls Supabase Edge Function: `nylas-auth-url`
- **Edge Function uses Client ID + Client Secret** to generate OAuth URL
- Broker is redirected to Google/Microsoft login

**3. Broker Logs Into Google**
- Google asks: "Allow Equity Connect to access your calendar?"
- Broker clicks "Allow"

**4. Google Redirects Back**
- Calls Supabase Edge Function: `nylas-callback`
- **Edge Function uses Client Secret** to exchange auth code for grant_id
- Grant_id is automatically saved to database

**5. Calendar is Connected**
- Broker sees: "✅ Calendar Connected!"
- Barbara can now use their real calendar for availability

## What Needs Client Secret

### Supabase Edge Functions

**nylas-auth-url function:**
```typescript
// Needs: NYLAS_CLIENT_ID + NYLAS_CLIENT_SECRET
const authUrl = `https://api.nylas.com/v3/connect/auth?
  client_id=${NYLAS_CLIENT_ID}&
  redirect_uri=${NYLAS_REDIRECT_URI}&
  response_type=code
`;
```

**nylas-callback function:**
```typescript
// Needs: NYLAS_CLIENT_SECRET to exchange code
const response = await fetch('https://api.nylas.com/v3/connect/token', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${btoa(NYLAS_CLIENT_ID + ':' + NYLAS_CLIENT_SECRET)}`
  },
  body: JSON.stringify({
    code: authCode,
    grant_type: 'authorization_code'
  })
});

// Response contains grant_id
const { grant_id } = await response.json();

// Save to database
await supabase
  .from('brokers')
  .update({ nylas_grant_id: grant_id })
  .eq('id', brokerId);
```

## Two Deployment Options

### Option 1: Manual Setup (What You Have Now)
**No client secret needed!**

**Pros:**
- ✅ Works immediately
- ✅ No Nylas upgrade needed
- ✅ Full functionality for Barbara
- ✅ Good for testing and early customers

**Cons:**
- ❌ You manually add grant_ids
- ❌ Brokers can't self-service
- ❌ No broker portal calendar page

**When to use:** Now through early production

### Option 2: Self-Service Portal (Needs Client Secret)
**Requires production Nylas account!**

**Pros:**
- ✅ Brokers connect their own calendars
- ✅ Fully automated onboarding
- ✅ Professional broker portal
- ✅ Scalable for many brokers

**Cons:**
- ❌ Requires Nylas production upgrade
- ❌ Needs Supabase Edge Functions deployed
- ❌ More complex setup

**When to use:** When you have 5+ brokers or want self-service

## Files You Already Have Ready

**Already created and ready to deploy (when you have client secret):**

1. ✅ `supabase/functions/nylas-auth-url/index.ts`
2. ✅ `supabase/functions/nylas-callback/index.ts`
3. ✅ `portal/src/components/CalendarSync.vue`
4. ✅ Database migration (brokers table ready)

**All you need is:**
1. Upgrade to production Nylas
2. Get client secret
3. Deploy Supabase functions
4. Add CalendarSync.vue to portal

## Recommendation

### For Now (Manual Setup)
```bash
# When you add a new broker:
UPDATE brokers 
SET nylas_grant_id = '[their_grant_id]',
    email = '[their_email]'
WHERE id = '[broker_id]';
```

### Later (Self-Service)
When you're ready to scale or want brokers to self-onboard:
1. Upgrade to production Nylas ($$$)
2. Get client secret
3. Deploy Edge Functions
4. Enable CalendarSync.vue in portal
5. Brokers connect their own calendars

## Bottom Line

**Yes, you need the client secret when you build the Vue page for broker self-service calendar connection.**

**But you DON'T need it for Barbara to book appointments - that works with just the API key + grant_id!**

**Current setup is perfect for prototyping and early production.** ✅
