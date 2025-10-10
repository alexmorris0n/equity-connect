# Cal.com Integration Guide

**Status:** ✅ DEPLOYED - CONFIGURATION PENDING  
**Date:** October 10, 2025  
**Deployment:** Vercel

---

## Overview

Cal.com is the open-source scheduling infrastructure powering the Equity Connect booking system. When leads express interest via VAPI voice calls or email replies, they receive booking links to schedule consultations with assigned brokers.

---

## Deployment Details

### URLs

| Resource | URL |
|---|---|
| **Vercel Deployment** | `https://cal-dot-com.vercel.app/e` |
| **GitHub Repository** | https://github.com/alexmorris0n/cal-dot-com |
| **Local Development** | `C:\Users\alex\OneDrive\Desktop\Cursor\cal-dot-com` |

### Status

- ✅ Deployed to Vercel
- ⏳ Webhooks pending configuration
- ⏳ n8n integration pending setup
- ⏳ Event types need creation
- ⏳ Production domain pending

---

## Planned Integration: n8n

Cal.com provides a native n8n integration: https://app.cal.com/apps/n8n

### n8n Integration Features

- **Trigger:** New Booking Created
- **Trigger:** Booking Cancelled
- **Trigger:** Booking Rescheduled
- **Action:** Create Booking
- **Action:** Cancel Booking
- **Action:** Get Booking Details

### Integration Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Equity Connect Flow                       │
└──────────────────────────────────────────────────────────────┘

1. Lead Acquisition
   └─▶ BatchData MCP → Supabase leads table

2. Enrichment & Campaign
   └─▶ Skip-trace waterfall → Instantly campaign

3. Consent & Interest Signal
   ├─▶ Email reply detected (AI router)
   └─▶ VAPI voice call → "Yes, interested"

4. Cal.com Booking Flow (THIS INTEGRATION)
   ├─▶ n8n receives consent signal
   ├─▶ Generate consent token (nonce_hash)
   ├─▶ Lookup assigned broker's Cal.com event type
   ├─▶ Send booking link via SMS/Email
   │   Format: https://cal-dot-com.vercel.app/broker-name/equity-call?token=xyz
   └─▶ Lead books appointment

5. Booking Confirmation
   ├─▶ Cal.com webhook → n8n
   ├─▶ Update lead: campaign_status = 'booked'
   ├─▶ Record in interactions table
   ├─▶ Notify broker (Slack/Email)
   └─▶ Stop campaign sequences (Instantly API)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VAPI Voice Call                          │
│   "Would you like to discuss your home equity options?"        │
│                          Lead: "Yes"                            │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  n8n Consent Handler   │
                    │  - Generate token      │
                    │  - Update lead         │
                    │  - Get broker details  │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   Supabase Database    │
                    │   - consent = true     │
                    │   - consent_token_id   │
                    │   - assigned_broker_id │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  Cal.com Link Builder  │
                    │  (n8n Function Node)   │
                    └────────────┬───────────┘
                                 │
                    ┌────────────┴───────────┐
                    │                        │
                    ▼                        ▼
          ┌──────────────────┐    ┌──────────────────┐
          │  Send SMS        │    │  Send Email      │
          │  (SignalWire)    │    │  (Instantly)     │
          └──────────────────┘    └──────────────────┘
                    │                        │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  Lead Books on Cal.com │
                    │  - Selects time        │
                    │  - Confirms details    │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  Cal.com Webhook       │
                    │  → n8n Trigger Node    │
                    └────────────┬───────────┘
                                 │
                    ┌────────────┴───────────────┐
                    │                            │
                    ▼                            ▼
          ┌──────────────────┐        ┌─────────────────┐
          │  Update Supabase │        │  Notify Broker  │
          │  - status='booked'│       │  (Slack/Email)  │
          │  - booking_time   │        └─────────────────┘
          │  - cal_event_id   │
          └──────────────────┘
```

---

## Cal.com Event Types to Create

### 1. Equity Assessment Call (30 min)
**Slug:** `equity-call`  
**Duration:** 30 minutes  
**Buffer:** 15 min before/after  
**Purpose:** Initial consultation for reverse mortgage  
**Questions:**
- Property address
- Estimated home value
- Current mortgage balance
- Reason for interest (spend, pay bills, etc.)

### 2. Follow-up Consultation (15 min)
**Slug:** `follow-up`  
**Duration:** 15 minutes  
**Buffer:** 10 min before/after  
**Purpose:** Answer additional questions, move to application

### 3. Document Review (45 min)
**Slug:** `doc-review`  
**Duration:** 45 minutes  
**Buffer:** 15 min before/after  
**Purpose:** Review application, sign documents

---

## Broker Configuration

Each broker needs:

1. **Cal.com Account Created**
   - Username format: `firstname-lastname`
   - Example: `john-smith`

2. **Profile Setup**
   - Name
   - Bio (expertise in reverse mortgages)
   - Avatar photo
   - Timezone
   - Working hours

3. **Event Types Connected**
   - Link all 3 event types above
   - Set personal availability overrides
   - Configure reminder emails/SMS

4. **n8n Webhook URL**
   - Each event type needs webhook pointing to n8n
   - Format: `https://n8n.instaroute.com/webhook/calcom-booking`

---

## Webhook Configuration

### Cal.com → n8n Webhook Setup

**Webhook URL:** `https://n8n.instaroute.com/webhook/calcom-booking`

**Events to Subscribe:**
- `BOOKING_CREATED`
- `BOOKING_CANCELLED`
- `BOOKING_RESCHEDULED`

**Webhook Payload Example:**
```json
{
  "triggerEvent": "BOOKING_CREATED",
  "payload": {
    "id": 12345,
    "uid": "abc123xyz",
    "title": "Equity Assessment Call",
    "startTime": "2025-10-15T14:00:00Z",
    "endTime": "2025-10-15T14:30:00Z",
    "attendees": [
      {
        "email": "lead@example.com",
        "name": "Jane Doe",
        "timeZone": "America/Los_Angeles"
      }
    ],
    "organizer": {
      "email": "broker@equityconnect.com",
      "name": "John Smith",
      "timeZone": "America/Los_Angeles"
    },
    "responses": {
      "property_address": "123 Main St, Los Angeles, CA 90028",
      "estimated_value": "750000",
      "mortgage_balance": "200000"
    }
  }
}
```

---

## n8n Workflow: Cal.com Booking Handler

### Workflow Structure

```
1. Webhook Trigger (Cal.com)
   └─▶ Receives booking event

2. Parse Booking Data
   └─▶ Extract lead email, broker, time, responses

3. Lookup Lead in Supabase
   └─▶ Match by email or phone

4. Update Lead Record
   └─▶ campaign_status = 'booked'
   └─▶ booking_time = startTime
   └─▶ cal_event_id = uid
   └─▶ broker_id = organizer.id

5. Stop Campaign Sequences
   └─▶ Call Instantly API to pause/stop sequences

6. Record Interaction
   └─▶ Insert into interactions table
   └─▶ interaction_type = 'booking_confirmed'

7. Notify Broker
   ├─▶ Send Slack DM
   └─▶ Send Email with lead details

8. Send Lead Confirmation
   ├─▶ Email: "Your appointment is confirmed"
   └─▶ SMS: Reminder 24h before + 1h before
```

---

## Database Schema Changes

### Add to `leads` table:

```sql
-- Cal.com booking fields
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS booking_time timestamptz,
  ADD COLUMN IF NOT EXISTS cal_event_id text,
  ADD COLUMN IF NOT EXISTS cal_event_uid text UNIQUE,
  ADD COLUMN IF NOT EXISTS booking_responses jsonb,
  ADD COLUMN IF NOT EXISTS booking_cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_rescheduled_count int DEFAULT 0;

-- Index for lookup by Cal.com event
CREATE INDEX IF NOT EXISTS leads_cal_event_uid_idx 
  ON leads (cal_event_uid) 
  WHERE cal_event_uid IS NOT NULL;
```

### New `broker_calendars` table:

```sql
CREATE TABLE IF NOT EXISTS broker_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid REFERENCES brokers(id),
  calcom_username text NOT NULL,
  calcom_user_id int,
  event_type_slug text NOT NULL, -- 'equity-call', 'follow-up', etc.
  event_type_id int NOT NULL,
  booking_url text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (broker_id, event_type_slug)
);
```

---

## Link Generation Logic

### n8n Function Node: Build Cal.com Link

```javascript
// Get lead data
const lead = $json;
const brokerId = lead.assigned_broker_id;

// Lookup broker's Cal.com username
const broker = await $supabase
  .from('broker_calendars')
  .select('calcom_username, booking_url')
  .eq('broker_id', brokerId)
  .eq('event_type_slug', 'equity-call')
  .eq('is_active', true)
  .single();

if (!broker) {
  throw new Error(`No active Cal.com calendar for broker ${brokerId}`);
}

// Build booking URL with prefill
const baseUrl = broker.booking_url;
const params = new URLSearchParams({
  name: `${lead.first_name} ${lead.last_name}`,
  email: lead.email,
  phone: lead.phone,
  // Prefill custom questions
  property_address: lead.property_address,
  estimated_value: lead.estimated_value,
  mortgage_balance: lead.mortgage_balance || '0'
});

const bookingUrl = `${baseUrl}?${params.toString()}`;

return {
  lead_id: lead.id,
  broker_name: broker.calcom_username,
  booking_url: bookingUrl
};
```

---

## SMS/Email Templates

### SMS: Booking Link (160 chars)

```
Hi {{first_name}}! Thanks for your interest. Schedule your equity assessment here: {{booking_url}} - {{broker_name}}
```

### Email: Booking Link

**Subject:** Schedule Your Free Home Equity Assessment

```html
Hi {{first_name}},

Thank you for expressing interest in exploring your home equity options!

I'd love to chat with you about how a reverse mortgage could help you achieve your financial goals.

Please click below to schedule a convenient time for a 30-minute consultation:

[Schedule Your Call] → {{booking_url}}

During our call, we'll discuss:
✓ Your home's equity potential
✓ How reverse mortgages work
✓ Your specific financial situation
✓ Next steps (if it's a good fit)

Looking forward to speaking with you!

Best regards,
{{broker_name}}
Equity Connect
```

---

## Testing Checklist

### Manual Testing

- [ ] Create test event type in Cal.com
- [ ] Set up n8n webhook endpoint
- [ ] Configure Cal.com webhook to n8n
- [ ] Create test broker account
- [ ] Generate booking link via n8n
- [ ] Book appointment as test lead
- [ ] Verify webhook triggers n8n workflow
- [ ] Confirm Supabase lead updates
- [ ] Test cancellation flow
- [ ] Test rescheduling flow

### Integration Testing

- [ ] VAPI call → consent → booking link flow
- [ ] Email reply → consent → booking link flow
- [ ] Multiple brokers with different calendars
- [ ] Timezone handling (lead vs broker)
- [ ] Conflicting appointments (same time slot)
- [ ] No-show handling (webhook?)

---

## Production Setup Steps

### 1. Configure Custom Domain

**Current:** `https://cal-dot-com.vercel.app/e`  
**Target:** `https://book.equityconnect.com` or `https://cal.equityconnect.com`

Steps:
1. Add domain in Vercel project settings
2. Configure DNS CNAME to Vercel
3. Wait for SSL certificate provisioning
4. Update all booking URLs in n8n

### 2. Cal.com API Setup

Get API key for programmatic access:
1. Go to https://cal-dot-com.vercel.app/settings/developer/api-keys
2. Generate new API key
3. Add to n8n credentials
4. Store in Supabase `vault.secrets` (encrypted)

### 3. Create Production Event Types

For each broker:
1. Login to Cal.com
2. Go to Event Types
3. Create "Equity Assessment Call" (30 min)
4. Set availability hours
5. Add custom questions (property address, value, etc.)
6. Copy booking URL format

### 4. Configure n8n Workflows

Create workflows:
- `calcom-send-booking-link.json`
- `calcom-booking-created-webhook.json`
- `calcom-booking-cancelled-webhook.json`

### 5. Set Up Broker Accounts

For each broker:
```sql
INSERT INTO broker_calendars (broker_id, calcom_username, event_type_slug, event_type_id, booking_url)
VALUES (
  '{{broker_uuid}}',
  'john-smith',
  'equity-call',
  12345,
  'https://book.equityconnect.com/john-smith/equity-call'
);
```

---

## Related Systems

### BatchData MCP

- **Local Path:** `C:\Users\alex\OneDrive\Desktop\Cursor\batchdata-mcp-real-estate`
- **GitHub:** https://github.com/alexmorris0n/batchdata-mcp-real-estate
- **Purpose:** Lead acquisition (feeds into booking funnel)

### VAPI Integration

- **Voice calls** detect interest and trigger booking flow
- See [VAPI_AI_VOICE_INTEGRATION.md](./VAPI_AI_VOICE_INTEGRATION.md)

### Consent Management

- **Tokens** generated before sending booking links
- See [CONSENT_MANAGEMENT_GUIDE.md](./CONSENT_MANAGEMENT_GUIDE.md)

---

## Monitoring & Analytics

### Key Metrics

- **Booking conversion rate:** Consent signals → Actual bookings
- **No-show rate:** Booked → Attended
- **Time to book:** Consent → Booking time
- **Reschedule rate:** How often leads reschedule
- **Broker utilization:** Bookings per broker per week

### Queries

**Booking conversion rate:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE consent = true) as consented,
  COUNT(*) FILTER (WHERE booking_time IS NOT NULL) as booked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE booking_time IS NOT NULL) / 
        NULLIF(COUNT(*) FILTER (WHERE consent = true), 0), 2) as conversion_rate
FROM leads
WHERE consent = true
  AND consented_at >= NOW() - INTERVAL '30 days';
```

**Broker booking volume:**
```sql
SELECT 
  b.name as broker_name,
  COUNT(l.id) as total_bookings,
  COUNT(*) FILTER (WHERE l.booking_time > NOW()) as upcoming,
  COUNT(*) FILTER (WHERE l.booking_cancelled_at IS NOT NULL) as cancelled
FROM leads l
JOIN brokers b ON l.assigned_broker_id = b.id
WHERE l.booking_time IS NOT NULL
  AND l.booking_time >= NOW() - INTERVAL '30 days'
GROUP BY b.id, b.name
ORDER BY total_bookings DESC;
```

---

## Troubleshooting

### Issue: Webhook Not Triggering

**Cause:** Cal.com webhook URL incorrect or n8n workflow inactive  
**Fix:**
- Verify webhook URL in Cal.com settings
- Check n8n workflow is active
- Test with Cal.com webhook tester
- Check n8n webhook node for authentication requirements

### Issue: Duplicate Bookings

**Cause:** Lead books multiple times before first webhook processes  
**Fix:**
- Add unique constraint on `cal_event_uid`
- Check for existing booking before sending link
- Add cooldown period (e.g., can't book if booked within 24h)

### Issue: Wrong Broker Assigned

**Cause:** `assigned_broker_id` not set or incorrect  
**Fix:**
- Verify broker assignment happens during enrichment
- Check `broker_calendars` table has correct mappings
- Add validation in link generation logic

### Issue: Timezone Confusion

**Cause:** Lead timezone != Broker timezone  
**Fix:**
- Cal.com handles this automatically
- Store timezone in leads table during data collection
- Display all times in lead's timezone in communications

---

## Cost Considerations

### Cal.com Pricing (Self-Hosted on Vercel)

- **Hosting:** Free tier (likely sufficient for pilot)
- **Custom domain:** Free with Vercel
- **API calls:** No additional cost (self-hosted)

### Alternative: Cal.com Cloud

If self-hosting becomes complex:
- **Teams plan:** $15/user/month
- **Includes:** Webhooks, API, team features, branded links

---

## Security Considerations

### Consent Token Validation

When lead receives booking link with token:

```javascript
// In Cal.com custom page or n8n pre-booking validator
const token = req.query.token;

// Verify token hasn't been used
const tokenValid = await supabase
  .from('consent_tokens')
  .select('id, lead_id, used_at')
  .eq('nonce_hash', hashToken(token))
  .single();

if (!tokenValid || tokenValid.used_at) {
  return res.status(403).json({ error: 'Invalid or expired booking link' });
}

// Mark token as used after booking
await supabase
  .from('consent_tokens')
  .update({ used_at: new Date() })
  .eq('id', tokenValid.id);
```

### PII Protection

- **Don't expose** full lead details in booking URLs
- **Use tokens** instead of lead IDs
- **Enable HTTPS** only (enforce in Vercel)
- **Rate limit** booking endpoints to prevent abuse

---

## Next Steps

1. **Create production event types** (equity-call, follow-up, doc-review)
2. **Configure n8n webhook endpoint** (test with Cal.com)
3. **Build link generation workflow** (consent → booking URL)
4. **Set up first test broker** (create account, connect calendar)
5. **End-to-end test** (BatchData → VAPI → Consent → Cal.com booking)
6. **Configure custom domain** (book.equityconnect.com)
7. **Create monitoring dashboard** (booking metrics)

---

## Related Documentation

- [VAPI_AI_VOICE_INTEGRATION.md](./VAPI_AI_VOICE_INTEGRATION.md) - Voice call consent
- [CONSENT_MANAGEMENT_GUIDE.md](./CONSENT_MANAGEMENT_GUIDE.md) - Token generation
- [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) - Schema details
- [PRODUCTION_PLAN.md](./PRODUCTION_PLAN.md) - Overall system
- [BATCHDATA_MCP_INTEGRATION.md](./BATCHDATA_MCP_INTEGRATION.md) - Lead acquisition

---

## Support

- **Cal.com Deployment:** https://cal-dot-com.vercel.app/e
- **Cal.com GitHub:** https://github.com/alexmorris0n/cal-dot-com
- **n8n Integration:** https://app.cal.com/apps/n8n
- **Cal.com Docs:** https://cal.com/docs
- **Cal.com API:** https://cal.com/docs/api-reference

