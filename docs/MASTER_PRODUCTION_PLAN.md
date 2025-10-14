# Equity Connect - Master Production Plan

**Last Updated:** October 12, 2025  
**Status:** Active Development  
**Current Phase:** Enrichment + Backfill System Complete, Campaign Setup Next

---

## 🎯 System Overview

Equity Connect is an automated lead generation and nurturing platform for reverse mortgage brokers. The system pulls qualified property leads, enriches them with contact data, and manages compliant multi-channel outreach campaigns.

---

## 📊 Current Production Status

### ✅ COMPLETE (As of Oct 11, 2025)

**1. PropertyRadar Pull Workflow** (`workflows/propertyradar-list-pull-worker.json`)
- Pulls leads from PropertyRadar dynamic lists (configurable daily_capacity per broker)
- Triple-layer deduplication (radar_id → apn → addr_hash)
- Auto-advancing pagination through 49k+ property list
- Cost protection: ~$150-200/day saved via pre-purchase dedup
- Multi-broker support (daily schedule loops all, webhook processes one)
- Webhook trigger for backfill requests (accepts override_count parameter)
- Handles all-duplicates gracefully (updates offset without purchasing)
- Queue enrichment events per lead
- **Status:** Production-ready, active in n8n (ID: CTJmLVrXOJ4kqRRx)
- **Current offset:** 434 (properly advancing)

**2. PropertyRadar List Management**
- Helper workflow to create broker-specific dynamic lists
- Webhook for Vercel UI integration (broker self-service)
- Update workflow for ZIP code changes
- **Status:** Working, used to create List ID 1104668

**3. Database Schema**
- Leads table with enrichment tracking fields (using `primary_email`/`primary_phone`)
- Pipeline events queue for async processing
- Broker configuration (list_id, offset, daily_capacity)
- Deduplication functions and indexes
- Backfill support functions (successful/pending enrichment counts)
- Attribution dashboard view (vw_broker_daily_attribution)
- **Campaign system tables** (NEW - Oct 12):
  - `campaigns` table: Archetype config with Instantly IDs
  - `leads.campaign_history` JSONB: Tracks all campaign attempts
  - `leads.campaign_archetype`: Current campaign assignment
  - `add_to_campaign_history()` function: Atomic history updates
- **Status:** Production schema deployed
- **Cleanup:** Removed legacy `email`/`phone` columns, fixed dependent views

**4. Unified Enrichment Waterfall** (`workflows/unified-enrichment-waterfall.json`)
- PropertyRadar /persons API enrichment (first tier)
- BatchData skip trace fallback (quality score < 70)
- Smart quality scoring (0-100 scale, weighted by data quality)
- Best-of-both merge logic (selects highest quality contact from either source)
- Processes 50 leads per run (every 5 minutes)
- Actual success rate: 82-84% email, 97% phone coverage
- **Status:** Production-ready, active in n8n (ID: nKfhu1tV6XwQVJYb)

**5. Automated Backfill System** (NEW - Oct 11/12)
- Q2H Backfill Checker: Runs 7x daily (8am-8pm, every 2 hours)
- EOD Safety Check: Runs at 10pm for final sweep
- Timezone-aware enrichment counting (America/Los_Angeles)
- Pending enrichment tracking (prevents over-pulling during active enrichment)
- Webhook-based architecture (backfill → webhook → pull worker)
- Per-broker shortfall calculation and attribution
- Dashboard with real-time visibility
- **Status:** Deployed to n8n, ready to activate
- **Cost savings:** $1,000-2,000/month (only pulls exact shortfall)

---

### 🔄 IN PROGRESS (Next Steps)

**6. Cold Email Campaign System** (Sunday/Monday)
- **Multi-Angle Campaign Rotation:** 3 archetypes with automatic retry for non-responders
- **Campaign Config Table:** Database-driven campaign management (`campaigns` table)
- **Campaign History Tracking:** JSONB array tracks all attempts per lead
- **Smart Assignment Logic:** 
  - Round 1: Data-driven (mortgage status, equity level)
  - Round 2-3: Automatic rotation through untried angles
  - Auto-skip after 3 attempts
- **3 Campaign Archetypes:**
  1. "No More Payments" (has mortgage) - eliminate payment angle
  2. "Cash Unlocked" (paid off) - access equity angle  
  3. "High Equity Special" ($500k+) - premium positioning
- **Per-Broker Capacity:** View respects each broker's `daily_lead_capacity`
- **Workflow:** `campaign-feeder-daily-CLEAN.json`
- **Status:** Database ready, workflow built, needs Instantly campaign IDs

**7. Reply Handler + TCPA Consent** (Monday/Tuesday)
- Instantly webhook for reply detection
- Consent form workflow (for phone calls only)
- Database consent recording
- **Status:** Planned

---

## 📘 Campaign System Quick Reference

### How Campaign Rotation Works

**Round 1 (First Contact):**
- Lead gets data-driven archetype assignment
- High equity ($500k+) → "High Equity Special"
- Debt-free (isFreeAndClear=1) → "Cash Unlocked"
- Has mortgage → "No More Payments"

**Round 2 (14 days later, no reply):**
- Workflow checks `campaign_history`
- Assigns first untried archetype from sequence
- Example: Tried "No More Payments" → Try "Cash Unlocked"

**Round 3 (28 days later, still no reply):**
- Assigns second untried archetype
- Example: Tried both above → Try "High Equity Special"

**Exhausted (42 days, no reply):**
- Lead tried all 3 angles
- Workflow skips lead (returns empty array)
- Can manually reset `campaign_history` to retry

### Managing Campaign IDs

**To add Instantly campaign IDs:**
```sql
UPDATE campaigns 
SET instantly_campaign_id = 'your-instantly-uuid-here' 
WHERE archetype = 'no_more_payments';

UPDATE campaigns 
SET instantly_campaign_id = 'another-uuid' 
WHERE archetype = 'cash_unlocked';

UPDATE campaigns 
SET instantly_campaign_id = 'third-uuid' 
WHERE archetype = 'high_equity_special';
```

**To check campaign history for a lead:**
```sql
SELECT first_name, last_name, campaign_history 
FROM leads 
WHERE id = 'lead-uuid';
```

**To reset a lead's campaign history (retry all 3):**
```sql
UPDATE leads 
SET campaign_history = '[]', 
    campaign_archetype = NULL,
    added_to_campaign_at = NULL
WHERE id = 'lead-uuid';
```

**To see campaign distribution:**
```sql
SELECT 
  campaign_archetype,
  COUNT(*) as lead_count
FROM leads
WHERE campaign_archetype IS NOT NULL
GROUP BY campaign_archetype;
```

---

### 📅 FUTURE PHASES

**8. Phone Outreach** (Week 2)
- VAPI AI voice calls (with consent)
- SignalWire phone pool management
- DNC registry integration
- Call outcome tracking

**9. Appointment Booking** (Week 2)
- Cal.com integration
- Broker calendar sync
- Appointment confirmation workflows

**10. Vercel Admin UI** (Week 3)
- Broker onboarding interface
- Territory management
- Lead dashboard
- Campaign analytics

**11. Microsite Generation** (Week 3)
- Campaign-specific landing pages (optional, future phase)
- Reverse mortgage calculator
- Form submissions → Supabase

---

## 🏗️ System Architecture

### Data Flow
```
PropertyRadar Pull Worker (daily 6am)
  ↓ Pulls 250 leads per broker
Supabase Database + Pipeline Events Queue
  ↓
Unified Enrichment Workflow (every 5 min)
  ├─ PropertyRadar /persons API
  └─ BatchData skip trace (if quality < 70)
  ↓ Merge best of both sources
206+ enriched (82% success rate)
  ↓
Backfill System (throughout day)
  ├─ Q2H Checker (8am-8pm, every 2h)
  └─ EOD Safety Check (10pm)
  ↓ Monitors shortfall, auto-pulls more if needed
250 complete enrichments guaranteed ✅
  ↓
Campaign Feeder (Instantly.ai, daily 8am)
  ↓ (4-email sequence over 14 days)
Reply Handler (n8n webhook from Instantly)
  ↓ (positive replies only)
Consent Form (TCPA for phone calls)
  ↓ (consent recorded)
Phone Outreach (VAPI AI + Broker calls)
  ↓
Appointment (Cal.com)
  ↓
Deal Closed
```

---

## 📁 Database Schema (Supabase PostgreSQL)

### Core Tables

**`brokers`**
- Broker profiles (company, contact, NMLS)
- Configuration: `daily_lead_capacity`, `propertyradar_list_id`, `propertyradar_offset`
- Performance tracking: conversion_rate, show_rate, revenue

**`leads`**
- Property information (address, value, equity)
- Owner data (first_name, last_name, age)
- Contact info (primary_email, primary_phone, email_verified, phone_verified)
- Dedup keys (radar_id, apn, county_fips, addr_hash)
- Campaign tracking (campaign_status, added_to_campaign_at, current_sequence_step)
- Consent (consent, consented_at, consent_method)
- Enrichment data (radar_property_data, enrichment_data jsonb fields)

**`pipeline_events`**
- Async processing queue
- Event types: enrich_propertyradar, enrich_pdl, enrich_melissa
- Status tracking: pending, processing, complete, failed
- Lead and broker associations

**`broker_territories`**
- ZIP code assignments per broker
- Market names and active status

**Supporting Tables:**
- `consent_tokens` - TCPA consent nonce replay protection
- `pipeline_dlq` - Dead letter queue for failed events
- `interactions` - Call/email/appointment history
- `billing_events` - Performance-based billing tracking

---

## 🔧 n8n Workflows

### Data Acquisition
1. **PropertyRadar List Pull Worker** (Daily 6am)
   - File: `workflows/propertyradar-list-pull-worker.json`
   - Pulls 250 properties per broker
   - 17 nodes, ~40 second runtime

2. **PropertyRadar List Creator** (One-time per broker)
   - File: `workflows/propertyradar-create-list-helper.json`
   - Creates dynamic lists in PropertyRadar
   - Updates broker record with list_id

3. **Broker Setup Webhook** (Vercel UI trigger)
   - File: `workflows/propertyradar-broker-setup-webhook.json`
   - Auto-creates PropertyRadar lists when broker added in UI

### Enrichment ✅
4. **Unified Enrichment Waterfall** (Every 5 min) ✅
   - File: `workflows/unified-enrichment-waterfall.json`
   - PropertyRadar `/persons` API for names, emails, phones
   - Quality scoring system (0-100 scale)
   - BatchData skip trace fallback (only if quality < 70)
   - Best-of-both merge logic
   - Target: 88% email coverage, 92% phone coverage
   - **Status:** Production-ready, 14 nodes

### Campaign Management
7. **Campaign Feeder** (Daily 8am)
   - File: `workflows/campaign-feeder-daily.json`
   - Sends enriched leads to Instantly
   - 250/day per broker

8. **Reply Handler** (Building Monday)
   - Instantly webhook trigger
   - Detects positive replies
   - Triggers consent form for calling

9. **Error Handler & DLQ Retry** (Existing)
   - File: `workflows/error-handler-dlq-retry.json`
   - Retries failed pipeline events

---

## 🔐 Compliance Rules

### Cold Email (CAN-SPAM)
**No consent required.**

Requirements:
- Unsubscribe link (Instantly auto-adds)
- Physical address (Instantly auto-adds)
- Accurate subject line
- Honor unsubscribes within 10 days

**Tools:** Instantly.ai handles all compliance

---

### Phone Calls (TCPA)
**Consent required before calling.**

Flow:
1. Lead replies to cold email
2. Send consent form: "May we call you?"
3. Lead submits form
4. Record consent with timestamp
5. Check DNC registry
6. Now can call (8am-9pm local time only)

**Tools:** n8n reply handler + consent form + DNC API

---

## 💰 Economics

### Cost Per Lead (At 50-Broker Scale)
- PropertyRadar subscription: $599/month (50k exports, 50k imports, 2.5k free contacts)
- PropertyRadar exports (over 50k): $0.01/record
- PropertyRadar contacts (over 2.5k): $0.04/contact
- BatchData skip trace (only if quality < 70): $0.07/lookup
- Instantly.ai (4-email campaign): ~$0.01/email = $0.04/lead
- **Total per lead at scale:** ~$0.09/lead
- **Daily cost per broker:** $22.61/day (250 leads)

### Broker Revenue (Performance-Based)
- Qualified lead (email verified): $10
- Appointment set: $50
- Appointment showed: $100
- Application submitted: $250
- Deal funded: $1,500-$3,000

### Daily Economics (Per Broker at 50-Broker Scale)

**Costs (22 working days/month):**
- PropertyRadar subscription allocation: $0.54/day
- PropertyRadar exports (over free tier): $2.05/day
- PropertyRadar contacts (over free tier): $9.91/day
- BatchData skip trace (~125/day): $8.75/day
- Instantly.ai (4-email campaign): $1.36/day
- **Total cost: $22.61/day per broker**

**Revenue (At Target Performance):**
- 2 appointment shows/day × $350 = **$700/day**
- **Gross profit: $677.39/day per broker**
- **Margin: 96.8%**

**Monthly (Per Broker):**
- Revenue: $700 × 22 = **$15,400/month**
- Costs: $22.61 × 22 = **$497/month**
- **Profit: $14,903/month per broker**

**At 50 Brokers Scale:**
- Monthly revenue: **$770,000**
- Monthly costs: **$24,871**
- **Monthly profit: $745,129**

---

## 🗓️ Weekend Implementation Roadmap

### Saturday: Enrichment Workflow ✅
- [x] Built unified PropertyRadar → BatchData waterfall
- [x] Added quality scoring system (0-100 scale)
- [x] Implemented best-of-both merge logic
- [x] Updated database schema (batchdata_property_data, best_property_data)
- [ ] Import into n8n, configure BatchData credential
- [ ] Test with sample leads
- [ ] Activate and monitor 250 lead enrichment
- [ ] Verify 88%+ email coverage

### Sunday: Campaign Setup
- [ ] Configure Instantly campaign
- [ ] Write 3-email sequence
- [ ] Test campaign feeder with 10 leads
- [ ] Verify Instantly custom fields populate correctly (property_address, estimated_equity, etc.)

### Monday: Reply Handling
- [ ] Build Instantly reply webhook
- [ ] Detect "YES" / positive intent
- [ ] Send TCPA consent form
- [ ] Record consent in database

### Tuesday: Production Launch
- [ ] Activate daily workflows
- [ ] Monitor first 50 leads through full cycle
- [ ] Track metrics (open rate, reply rate, consent rate)
- [ ] Fix any issues

---

## 📚 Documentation Structure

### Core Docs (Keep - Updated)
- **`docs/MASTER_PRODUCTION_PLAN.md`** ← THIS FILE (complete system overview)
- **`docs/WEEKEND_ROADMAP.md`** - Sat/Sun/Mon tasks
- **`docs/ENRICHMENT_WORKFLOW_FINAL.md`** - Unified enrichment with quality scoring
- **`docs/ECONOMICS_FULL_SCALE.md`** - Complete economics at 1-50 broker scale
- **`docs/COMPLIANCE_SIMPLE_GUIDE.md`** - Email vs call rules
- **`docs/PROPERTYRADAR_PULL_WORKFLOW_FINAL.md`** - PropertyRadar pull workflow details

### Reference Docs (Keep - Conceptually Accurate)
- `docs/DATABASE_ARCHITECTURE.md` - Database schema details
- `docs/COMPLIANCE_FRAMEWORK.md` - Full compliance requirements
- `docs/BROKER_SELF_SERVICE_ARCHITECTURE.md` - Vercel UI design

### Integration Guides (Keep)
- `docs/INSTANTLY_CONSENT_INTEGRATION.md` - Cold email setup (CORRECTED)
- `docs/CONSENT_MANAGEMENT_GUIDE.md` - TCPA consent for calls (CORRECTED)
- `docs/VAPI_AI_VOICE_INTEGRATION.md` - Voice call setup
- `docs/CALCOM_INTEGRATION.md` - Appointment booking

### Historical/Archive (Move to archive/)
- Old "COMPLETE" summaries (PHASE_1, PHASE_2, SESSION_COMPLETE)
- Old implementation summaries
- Gap analysis docs
- Interim workflow update docs

---

## 🚀 Quick Start (For New Team Members)

### Understand the System (30 min)
1. Read `docs/MASTER_PRODUCTION_PLAN.md` (this file)
2. Read `docs/WEEKEND_ROADMAP.md` (current tasks)
3. Review `docs/PROPERTYRADAR_PULL_WORKFLOW_FINAL.md` (working implementation)

### Set Up Local Environment (1 hour)
1. Clone repository
2. Import n8n workflows from `workflows/` directory
3. Configure Supabase credentials
4. Run database migrations from `config/`
5. Test PropertyRadar pull workflow

### Build Next Component (Per roadmap)
1. Check `docs/WEEKEND_ROADMAP.md` for current priority
2. Follow implementation guide for that component
3. Test with sample data
4. Deploy to production

---

## 🔍 Monitoring & Observability

### Key Metrics to Track

**Lead Acquisition:**
- Properties pulled daily (target: 250/broker)
- Deduplication rate (target: <5% duplicates)
- PropertyRadar list exhaustion date
- Cost per property (~$0.75)

**Enrichment:**
- Email coverage rate (target: 85%+)
- PropertyRadar contact hit rate (target: 70%)
- PDL hit rate on remainder (target: 60%)
- Cost per enriched lead (~$0.80)

**Campaign Performance:**
- Email open rate (target: 25%+)
- Reply rate (target: 3-5%)
- Consent form submission rate (target: 40% of replies)
- Unsubscribe rate (keep below 0.5%)

**Conversion Funnel:**
- Qualified leads (email verified): Target 85% of pulled
- Replies received: Target 3% of sent
- Consents obtained: Target 40% of replies
- Appointments set: Target 20% of consents
- Shows: Target 60% of appointments
- Applications: Target 40% of shows
- Funded deals: Target 50% of applications

---

## 🛠️ Tech Stack

**Infrastructure:**
- Database: Supabase (PostgreSQL)
- Automation: n8n (self-hosted on Northflank)
- Email: Instantly.ai (cold email platform)
- Voice: VAPI (AI voice calls)
- Booking: Cal.com (appointment scheduling)
- Admin UI: Vercel (Next.js - future)

**APIs & Services:**
- PropertyRadar: Property data + owner contacts
- People Data Labs (PDL): Email enrichment fallback
- Melissa Data: Address validation (future)
- SignalWire: Phone number pools (future)
- OpenAI: AI reply detection + voice scripts

**Development:**
- Version Control: Git
- Documentation: Markdown
- Configuration: JSON workflows + SQL migrations

---

## 📞 Support & Resources

**PropertyRadar:**
- Dashboard: https://app.propertyradar.com
- API Docs: https://developers.propertyradar.com
- List ID: 1104668 (My Reverse Options - 52,823 properties)

**n8n:**
- Instance: https://n8n.instaroute.com
- Current Workflows: CTJmLVrXOJ4kqRRx (pull), 9I53ItoKTuhJ6jl4 (list creator)

**Supabase:**
- Project: mxnqfwuhvurajrgoefyg
- Dashboard: https://supabase.com/dashboard

**Instantly.ai:**
- Campaign ID: (TBD - configure Sunday)

---

## 🎯 Success Criteria

**By End of Week 1 (Oct 13):**
- ✅ 250 properties pulled from PropertyRadar
- ✅ 220+ leads enriched with emails
- ✅ 50+ leads sent to Instantly campaign
- ✅ First replies detected
- ✅ First consents collected

**By End of Month 1 (Nov 10) - Single Broker:**
- 5,500 total leads (250/day × 22 days)
- 4,840 enriched with emails (88% coverage)
- 22,000 email sends (4-email campaign)
- 1,375 email opens (25% open rate)
- 275 replies (20% of opens)
- 110 consents for calling (40% of replies)
- 44 appointments booked (2/day average)
- $15,400 revenue ($350/show × 44)
- $497 platform costs
- **$14,903 profit per broker**

---

**This is your single source of truth for the production system.** 🎯

