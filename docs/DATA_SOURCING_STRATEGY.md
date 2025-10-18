# 🧭 Equity Connect — Data Sourcing & Enrichment Strategy

**⚠️ NOTE:** This document describes the technical enrichment STRATEGY. For current implementation status, see [MASTER_PRODUCTION_PLAN.md](../MASTER_PRODUCTION_PLAN.md)

## 🎯 Goal
Pull **net-new property records** from **PropertyRadar API**, enrich with contact data via **PropertyRadar Persons API**, and deliver only verified leads to broker campaigns.

**Current Status (Oct 17, 2025):** PropertyRadar pull workflow COMPLETE. Contact enrichment via PropertyRadar /persons API active. PDL/Clay references removed - we use 3 campaign archetypes only, no lead profiling.

---

## 🧩 Core Dedup Logic

### Three-Tier Deduplication Hierarchy
Every property lead is uniquely identified using this priority order:

| Priority | Key | Source | Use Case |
|----------|-----|---------|----------|
| **1** | `radar_id` | PropertyRadar API | Most stable, best data quality |
| **2** | `mak` | BatchData (legacy) | Backward compatibility |
| **3** | `attom_property_id` | ATTOM Data (legacy) | Backward compatibility |
| **4** | `parcel_number + county_fips` | County tax assessor | Stable across transfers |
| **5** | `addr_hash` | Normalized USPS address | Fallback for matching |

```sql
-- Five separate unique indexes (priority-based conflict resolution)
CREATE UNIQUE INDEX uq_leads_radar_id
  ON leads (radar_id)
  WHERE radar_id IS NOT NULL;

CREATE UNIQUE INDEX uq_leads_mak
  ON leads (mak)
  WHERE mak IS NOT NULL;

CREATE UNIQUE INDEX uq_leads_attom_id
  ON leads (attom_property_id)
  WHERE attom_property_id IS NOT NULL;

CREATE UNIQUE INDEX uq_leads_apn_county
  ON leads (parcel_number, county_fips)
  WHERE parcel_number IS NOT NULL AND county_fips IS NOT NULL;

CREATE UNIQUE INDEX uq_leads_addr_hash
  ON leads (addr_hash)
  WHERE addr_hash IS NOT NULL;
```

**Idempotent upserts** via `upsert_lead_from_radar(p JSONB)` RPC function.

---

## ⚙️ PropertyRadar Contact Enrichment Strategy

### PropertyRadar Property + Contact Data ($0.012/property + $0.04/contact)

**Purpose:** Get property details, owner info, AND contact data (email/phone)  
**API:** PropertyRadar Search API + /persons API  
**Cost:** 
- $0.012 per property lookup
- $0.04 per email append (FREE first 2,500/month)
- $0.04 per phone append (FREE first 2,500/month)
**Output:** Property address, owner name, age, equity, email, phone, owner-occupied status

**Key Advantages:**
- ✅ Pre-filters by age 62+, equity, owner-occupied
- ✅ Returns ONLY qualified leads (no wasted API calls)
- ✅ Includes contact data in same call
- ✅ Free contact append quota (2,500 emails + 2,500 phones/month)
- ✅ 70-85% contact coverage (no additional enrichment services needed)

**Contact Coverage:**
- Target: 70-85% of leads with verified email or phone
- Quality: PropertyRadar validates contact data against multiple sources
- Fallback: BatchData skip trace for remaining leads (future enhancement)

---

## 🔁 Workflow Strategy

### Single-Zip Processing with Pre-Filtering

**PropertyRadar advantages:**
- Query with built-in filters: age 62+, equity threshold, owner-occupied, SFR
- Returns ONLY qualified leads (vs ATTOM/BatchData which return all properties)
- Cost: ~50 qualified leads × $0.092 = $4.60 per pull
- vs ATTOM: 50 properties × $0.21 = $10.50 per pull
- vs BatchData: 32 zips = $6,200+ charged upfront

**Zip Rotation Logic:**
1. Fetch all broker territories (32 zips for Walter Richards)
2. Sort zips consistently
3. Use `zip_index` from bookmark to track current zip
4. Pull 50 properties from current zip
5. If <50 returned → advance to next zip, reset page to 0
6. Loop back to zip[0] when all zips processed

---

## 🧠 n8n Workflow (Complete)

### Node Flow

```
[Cron: Daily 4am]
  → [Fetch Broker Territories]
  → [Define Market Params]
  → [Get Bookmark] (returns last_page_fetched, zip_index)
  → [Select Current Zip]
  → [PropertyRadar Property Search] ($0.012 × 50 = $0.60)
      ↓ Pre-filtered: age 62+, equity, owner-occupied, SFR
      ↓ Returns: property + owner + contact data
      ↓
  → [Extract & Normalize PropertyRadar Data]
  → [Compute Addr Hash]
  → [Upsert Lead] (via upsert_lead_from_radar RPC)
      ↓
  → [IF Needs Enrichment?] (email/phone missing from PropertyRadar?)
      ├─ No → Skip to Campaign Queue (70% of leads)
      └─ Yes ↓ (30% of leads)
  → [PDL Person Enrich] ($0.05 per lookup)
  → [Parse PDL Response]
  → [IF PDL Hit?]
      ├─ Yes → Update lead, skip Melissa, → Campaign Queue
      └─ No ↓
  → [Melissa Contact Append] ($0.15 per lookup)
  → [Parse Melissa Response]
  → [Update Enrichment Data]
      ↓
  → [Check Stop-When-Known] (have we seen these IDs before?)
  → [Advance Bookmark] (page++ or zip_index++)
  → [Log Completion]
```

### Key Code Snippets

**1. Define Market Params (Single-Zip Selection):**

```javascript
// Select CURRENT zip based on bookmark zip_index
const territories = $input.all();
const broker = groupByBroker(territories)[0];
const zipIndex = 0;  // Will be fetched from bookmark in next node

return [{
  json: {
    broker_id: broker.id,
    all_zip_codes: broker.zip_codes.sort(),
    total_zips: broker.zip_codes.length,
    query_sig: simpleHash(broker.id + '|propertyradar')
  }
}];
```

**2. PropertyRadar Property Search:**

```http
POST https://api.propertyradar.com/v1/properties/search
Headers:
  Authorization: Bearer YOUR_PROPERTYRADAR_API_KEY
  Content-Type: application/json
Body:
{
  "filters": {
    "zip_codes": ["{{ current_zip }}"],
    "owner_age_min": 62,
    "equity_min": 100000,
    "owner_occupied": true,
    "property_type": "single_family"
  },
  "append": {
    "email": true,
    "phone": true
  },
  "page": {{ bookmark.last_page_fetched + 1 }},
  "per_page": 50
}
```

**3. PropertyRadar /persons API (contact enrichment):**

```http
POST https://api.propertyradar.com/v1/persons
Headers:
  Authorization: Bearer YOUR_PROPERTYRADAR_API_KEY
  Content-Type: application/json
Body:
{
  "address": "{{ property_address }}",
  "city": "{{ property_city }}",
  "state": "{{ property_state }}",
  "zip": "{{ property_zip }}",
  "name": "{{ first_name }} {{ last_name }}"
}
```

**Note:** PDL and Melissa enrichment removed. PropertyRadar /persons API provides 70-85% contact coverage, which is sufficient for our needs. We use 3 campaign archetypes only (no lead profiling or ethnic-based personas).

---

## 🧱 Supabase Functions

### upsert_lead_from_radar (Already Created ✅)

```sql
-- Idempotent upsert with PropertyRadar support
SELECT upsert_lead_from_radar(jsonb_build_object(
  'radar_id', 'RADAR123456',
  'radar_property_data', '{"source": "propertyradar"}'::jsonb,
  'radar_api_version', 'v1',
  'property_address', '123 Main St',
  'property_city', 'Los Angeles',
  'property_state', 'CA',
  'property_zip', '90016',
  'addr_hash', 'abc123...',
  'first_name', 'John',
  'last_name', 'Doe',
  'age', 65,
  'estimated_equity', 200000,
  'property_value', 500000,
  'owner_occupied', true,
  'email', 'john@example.com',
  'phone', '+13105551234',
  'email_verified', true,
  'phone_verified', true,
  'skiptrace_tier', 0,
  'enrichment_meta', '{"propertyradar_confidence": "high"}'::jsonb,
  'assigned_broker_id', 'broker-uuid',
  'source', 'propertyradar'
));
```

**Returns:** UUID of upserted lead

---

## 🎯 Broker Capacity Guardrails

### Add Capacity Column to Brokers

```sql
-- Add daily lead capacity to brokers table (already exists)
-- Default: 5 leads per day per broker
```

### Campaign Feeder Query

```sql
-- Select leads ready for campaign, respecting broker capacity
-- Prioritizes PropertyRadar leads (most recent, best data)
SELECT * FROM get_campaign_ready_leads();
```

**Features:**
- ✅ Respects `daily_lead_capacity` per broker
- ✅ Prioritizes PropertyRadar leads over legacy sources
- ✅ Prioritizes highest equity leads
- ✅ Only selects verified contacts (email OR phone)
- ✅ Rate-limits to prevent broker overwhelm
- ✅ FIFO within equity tiers
- ✅ Scales to multiple brokers automatically

### Mark Leads as Added to Campaign

```sql
-- Call this after adding leads to Instantly/SignalWire
UPDATE leads
SET 
  campaign_status = 'queued',
  added_to_campaign_at = NOW()
WHERE id = ANY(ARRAY[lead_ids_from_campaign_feeder]);
```

---

## 🧰 Ops Schedule

| Frequency | Task                                   |
| --------- | -------------------------------------- |
| Daily     | Pull 50–250 new records per broker ZIP |
| Weekly    | Re-crawl completed ZIPs                |
| Monthly   | Compare counts per ZIP for drift       |

---

## 💰 Cost Analysis

### PropertyRadar + Waterfall Strategy

**Scenario 1: PropertyRadar Hit (70-85% of leads)**
```
PropertyRadar: $0.012 (property)
Contact Data:  $0.04  (email/phone via /persons - FREE first 2,500)
─────────────────────────────────────
Total:         $0.052 per lead with contact
```

**Scenario 2: PropertyRadar Miss (15-30% of leads)**
```
PropertyRadar: $0.012 (property, no contact)
Skip Trace:    TBD (BatchData future enhancement)
─────────────────────────────────────
Total:         $0.012 per lead (property only)
```

**Note:** We accept 70-85% contact coverage from PropertyRadar only. Additional enrichment services (PDL, Melissa) removed - not needed for our 3-archetype campaign strategy.

### Blended Average Cost (PropertyRadar Only)

```
80% × $0.052 = $0.0416
20% × $0.012 = $0.0024  (property only, no contact)
─────────────────────────
Average:       $0.044 per lead (~4.4 cents!)
```

**For 250 leads/day:**
- **$11/day**
- **$330/month**
- **80% enrichment rate** (target: 70-85%)

### Comparison

| Provider | Cost/Lead | Monthly (250/day) | Enrichment Rate |
|----------|-----------|-------------------|-----------------|
| **PropertyRadar Only** | **$0.044** | **$330** | **70-85%** |
| PropertyRadar + PDL (old) | $0.098 | $735 | 98% |
| BatchData (deprecated) | $24.80 | $186,000 | 95% |

**Savings vs old PDL approach:** $405/month (55% reduction)  
**Savings vs BatchData:** $185,670/month (99.8% reduction)

---

## 🧩 Optional Improvements

* Add `last_seen_at` to `leads` for change detection ✅ (already exists)
* Materialized view `mv_new_leads_daily` for dashboarding
* Auto-enqueue new leads to skip-trace via trigger
* Store full raw PropertyRadar payload JSONB for auditing ✅ (radar_property_data)

---

## ✅ Benefits

* PropertyRadar-native (pre-filtered at source)
* Fully idempotent ingestion
* Zero duplicate skip-traces
* Scalable by ZIP or broker
* Self-healing with cursor state
* 55% cost savings vs old PDL approach
* 70-85% of leads enriched at source (PropertyRadar only)
* No ethnic profiling - 3 campaign archetypes only
* Simplified architecture - no PDL/Clay dependencies

---

**Status:** Production Ready ✅  
**Owner:** Data Automation  
**Updated:** 2025-10-17  
**Data Source:** PropertyRadar API only (PDL/Clay removed)
