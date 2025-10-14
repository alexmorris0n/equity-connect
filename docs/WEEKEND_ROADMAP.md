# Weekend Roadmap - Email Campaign Launch

**Goal:** Get 250 leads/day into cold email campaigns by Tuesday

---

## ✅ FRIDAY (COMPLETE)

**PropertyRadar Pull Workflow**
- ✅ Pulls 250 properties daily
- ✅ Triple deduplication 
- ✅ Queues 250 enrichment events
- ✅ Auto-advances through 52k property list
- ✅ TESTED & WORKING

**Database:**
- ✅ 250 leads in database
- ✅ 250 enrichment events queued
- ✅ Offset tracking working

---

## ✅ SATURDAY COMPLETE: Enrichment + Backfill System

### 1. Unified Enrichment Waterfall (PropertyRadar → BatchData)

**File:** `workflows/unified-enrichment-waterfall.json` (20 nodes)
**Status:** ✅ Deployed and running in n8n

**Purpose:** Enrich leads with owner names, emails, and phones using smart 2-tier waterfall with quality scoring

**API Flow:**
```
Every 5 min trigger
  ↓
Get 50 pending pipeline_events (event_type='enrich_propertyradar')
  ↓
Split into batches (1 at a time)
  ↓
Get lead details (radar_id, address)
  ↓
Call PropertyRadar /persons API
  ↓
Parse + Score Response:
  • Extract: NameFull, Emails[], Phones[]
  • Score emails (personal domain = 40, business = 20)
  • Score phones (mobile = 15, non-DNC = 10, reachable = 5)
  • Calculate quality_score (0-100)
  ↓
Update lead (PropertyRadar data + radar_property_data jsonb)
  ↓
IF quality_score < 70?
  ├─ NO (High Quality) → Mark complete ✓
  └─ YES (Low Quality) → Call BatchData Skip Trace API
                           ↓
                         Parse + Score BatchData Results
                           ↓
                         Merge Best of Both Sources
                           • Compare email scores
                           • Compare phone scores
                           • Pick best from either source
                           • Rank all alternatives
                           ↓
                         Update lead (merged + best_property_data jsonb)
                           ↓
                         Mark complete ✓
```

**Actual Results:**
- PropertyRadar high quality (skip BatchData): ~50% of leads
- PropertyRadar + BatchData merge: ~50% of leads
- **Total with emails: 206/250 (82.4%)** ✅
- **Total with phones: 243/250 (97.2%)** ✅

**Cost:** ~$8.75/batch (BatchData lookups × $0.07)

**Processing Time:** Continuous (every 5 min, processes 50 leads/run)

### 2. Automated Backfill System

**Files:** 
- `workflows/propertyradar-backfill-checker.json` (Q2H)
- `workflows/propertyradar-eod-backfill.json` (EOD)
- `supabase-backfill-functions.sql`

**Status:** ✅ Deployed to n8n, ready to activate

**Purpose:** Ensure every broker hits daily enrichment target (250 complete enrichments)

**How It Works:**
- Monitors enrichment success throughout day
- Calculates shortfall per broker (target - successful - pending)
- Automatically triggers pull worker webhook for exact shortfall
- Q2H runs 7x daily (8am-8pm), threshold: shortfall > 10
- EOD runs at 10pm, pulls ANY shortfall (final guarantee)

**Key Innovation:** Tracks pending enrichments to prevent over-pulling
- Formula: `true_shortfall = capacity - (successful + pending)`
- Prevents waste when enrichment still in progress

**Result:** Brokers hit 250 enriched leads/day automatically

---

## 📅 SUNDAY/MONDAY: Campaign Setup

### ✅ Task 1: Campaign System Architecture (COMPLETE)

**File:** `workflows/campaign-feeder-daily-CLEAN.json`

**Database Tables:**
- ✅ `campaigns` table: Stores 3 archetypes with Instantly campaign IDs
- ✅ `leads.campaign_history` JSONB: Tracks all campaign attempts per lead
- ✅ `leads.campaign_archetype`: Current campaign assignment
- ✅ `add_to_campaign_history()` function: Atomic updates

**3 Campaign Archetypes:**
1. ✅ "No More Payments" (has mortgage) - sequence_order: 1
2. ✅ "Cash Unlocked" (debt-free homeowners) - sequence_order: 2
3. ✅ "High Equity Special" ($500k+ equity) - sequence_order: 3

**Smart Campaign Rotation:**
- ✅ Round 1: Data-driven assignment (equity amount + mortgage status)
- ✅ Round 2-3: Auto-rotates to untried archetypes if no response
- ✅ Auto-skips leads after 3 attempts (all angles exhausted)
- ✅ History tracks: archetype, campaign_id, added_at, result

**Workflow Features:**
- ✅ Fetches from `vw_campaign_ready_leads` (per-broker capacity limits)
- ✅ Checks campaign history before assignment
- ✅ Gets campaign config from database (no hardcoded IDs)
- ✅ Updates history atomically via RPC function
- ✅ Tracks interactions per lead
- ✅ Single loop (no nested loops - view handles broker limits)

**Next:** Add Instantly campaign IDs to `campaigns` table, test with real leads

---

### Task 2: Set Up Instantly Campaigns (3 Total)

**⚠️ DESIGN DECISION:** We use **financial situation archetypes**, NOT ethnic personas.

**Why no ethnic personas for email campaigns:**
- ❌ AI models refuse to assign based on ethnicity (compliance concerns)
- ❌ Potential discrimination/fair housing issues
- ❌ Not scalable (requires demographic data we don't have)
- ✅ Financial archetypes work with ANY demographics
- ✅ Based on objective data (equity amount, mortgage status)
- ✅ Legally defensible (financial need, not protected class)

**Note:** Ethnic personas MAY still be used for:
- Microsite templates (future phase)
- Voice profiles for VAPI (cultural accent matching)
- NOT for campaign assignment/email targeting

**Create 3 campaigns in Instantly.ai:**

1. **"No More Payments"** - For homeowners with mortgages
2. **"Cash Unlocked"** - For debt-free homeowners  
3. **"High Equity Special"** - For $500k+ equity properties

**Custom fields for ALL campaigns:**
   - `property_address`
   - `property_city`
   - `property_value` (format: "$650,000")
   - `estimated_equity` (format: "$300,000")
   - `broker_name`
   - `broker_nmls` (format: "NMLS #123456")

3. **Create 4-email sequences (customize per archetype):**

**Campaign 1: "No More Payments" - Email 1 (Day 0):**
```
Subject: Eliminate Your Mortgage Payment - {{property_address}}

Hi {{firstName}},

Still making monthly mortgage payments on {{property_address}}?

With a reverse mortgage, you could:
• ELIMINATE your monthly mortgage payment completely
• Access {{estimated_equity}} in tax-free cash
• Stay in your home for life

You've earned it. Let your home work for YOU.

Reply "YES" for a free analysis.

Best,
{{broker_name}}
{{broker_nmls}}
```

**Campaign 2: "Cash Unlocked" - Email 1 (Day 0):**
```
Subject: Your {{property_address}} Equity - {{estimated_equity}} Available

Hi {{firstName}},

You paid off your home at {{property_address}} - congratulations!

Now unlock that {{estimated_equity}} in equity WITHOUT:
• Selling your home
• Monthly payments
• Losing ownership

Live the retirement you deserve.

Reply "YES" to learn more.

Best,
{{broker_name}}
{{broker_nmls}}
```

**Campaign 3: "High Equity Special" - Email 1 (Day 0):**
```
Subject: Premium Options for Your {{property_address}}

Hi {{firstName}},

Your {{property_address}} has {{estimated_equity}} in available equity.

For high-value homeowners like you, reverse mortgages offer:
• Tax-free access to your equity
• No monthly payments
• Premium service and white-glove support

Let's discuss your options.

Reply "YES" for a confidential analysis.

Best,
{{broker_name}}
{{broker_nmls}}
```

**Emails 2-4:** (Customize angle per campaign but follow same structure)
- Day 3: Education
- Day 7: Social proof  
- Day 14: Soft close

4. **Campaign settings:**
   - Sequence: 4 emails over 14 days (Day 0, 3, 7, 14)
   - Daily limit: 50-100
   - Send time: 8am-5pm
   - Stop on reply: YES
   - Instantly handles: Unsubscribe, physical address, CAN-SPAM
   - Expected sends: 5,500 leads × 4 emails = 22,000 sends/month

---

## 📅 MONDAY: Reply Handler (Consent for Calls)

### Build Instantly Reply Webhook Handler

**Purpose:** When lead replies "YES", send TCPA consent form (for phone calls)

**Flow:**
```
Instantly detects reply
  ↓
Webhook → n8n
  ↓
Check reply for positive intent ("yes", "interested", "call me")
  ↓
If positive:
  - Generate consent token
  - Send email with consent form link
  - Form asks: "May we call you about reverse mortgage options?"
  ↓
Lead submits form
  ↓
Update lead: consent=true, consented_at=now()
  ↓
Lead is now callable (VAPI/broker)
```

---

## 🎯 Key Clarifications

### Cold Email (CAN-SPAM)
- ✅ Send without consent
- ✅ Must include unsubscribe (Instantly handles)
- ✅ Must include physical address (Instantly adds)
- ✅ Must have accurate subject line
- ❌ NO consent form needed
- ❌ NO DNC check needed (that's for calls)

### Phone Calls (TCPA)
- ❌ Cannot call without consent
- ✅ Must get written/electronic consent first
- ✅ Must check DNC registry before calling
- ✅ Consent form required ("May we call you?")
- ✅ Must honor call time restrictions (8am-9pm)

### The Workflow:
```
Cold Email (no consent) 
  → Lead Replies 
    → Consent Form Sent (for calls)
      → Lead Submits
        → NOW can call
```

---

## 📊 Success Metrics

**✅ Achieved This Weekend:**
- ✅ 250+ leads pulled from PropertyRadar
- ✅ 206+ leads enriched with emails (82.4% coverage)
- ✅ 243+ leads with verified phones (97.2% coverage)
- ✅ Quality scoring and merge logic working in production
- ✅ Automated backfill system deployed (ensures daily targets met)
- ✅ Timezone-aware counting (America/Los_Angeles)
- ✅ Per-broker attribution for billing
- ✅ Real-time dashboard for monitoring
- ⏳ Campaign feeder ready to test
- ⏳ Instantly campaign ready to configure

**By End of Monday:**
- ✅ Reply handler detecting "YES" responses
- ✅ Consent forms going to interested leads
- ✅ TCPA consent recorded for phone calls
- ✅ Callable leads ready for VAPI/broker outreach

**By End of Tuesday:**
- ✅ 50 leads/day flowing into Instantly
- ✅ 25%+ open rates
- ✅ 3-5% reply rates
- ✅ First consents collected
- ✅ First VAPI calls scheduled

---

## 🚀 What You're Building

**Full Lead Lifecycle:**
```
PropertyRadar Pull (250/day) ✅
  ↓
Unified Enrichment (PropertyRadar → BatchData waterfall) ✅
  ↓
Cold Email Campaign (Instantly - 4 emails over 14 days)
  ↓
Reply Detection (n8n watches for "YES")
  ↓
Consent Form (TCPA for phone calls)
  ↓
Consent Recorded (database)
  ↓
Phone Outreach (VAPI AI + Broker calls)
  ↓
Appointment Booked (Cal.com)
  ↓
Deal Closed
```

**You've built the first THREE steps! ✅ Next = Campaign setup (step 4).**

---

## 📚 Documentation Created

- `docs/SESSION_SATURDAY_OCT_11_BACKFILL_COMPLETE.md` - Complete session summary
- `BACKFILL_SYSTEM_SETUP.md` - Setup and testing guide
- `PENDING_CHECK_UPDATE.md` - Technical deep-dive on timing fix
- `supabase-backfill-functions.sql` - All SQL with comments

---

**Saturday session complete! Ready for email campaigns! 💪**

