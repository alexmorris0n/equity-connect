# Data Sourcing & Skip-Trace Waterfall Strategy

## Executive Summary

**Three-tier enrichment waterfall for cost-optimized lead generation:**

1. **ATTOM API** → Property data + owner info ($0.10/property)
2. **PeopleDataLabs (PDL)** → Tier-1 contact enrichment ($0.05/lookup, 40-60% hit rate)
3. **Melissa Data** → Tier-2 verified contact append ($0.15/lookup, +20-30% lift)

**Total cost per fully enriched lead:** $0.20-$0.30 (vs $0.62+ with BatchData)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    ATTOM Property API                             │
│              (Base Property + Owner Data)                         │
│                   $0.10 per property                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Supabase        │
                    │  UPSERT by:      │
                    │  attom_property_id│
                    └────────┬─────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │   Needs Contact Enrichment?  │
              │   (email/phone missing)      │
              └───┬──────────────────────┬───┘
                  │ No (skip)            │ Yes
                  │                      ▼
                  │           ┌──────────────────────┐
                  │           │  PeopleDataLabs      │
                  │           │  Tier-1 Enrichment   │
                  │           │  $0.05 per lookup    │
                  │           └──────┬───────────────┘
                  │                  │
                  │                  ▼
                  │           ┌──────────────┐
                  │           │  Hit?        │
                  │           └───┬──────┬───┘
                  │               │ Yes  │ No
                  │               │      ▼
                  │               │  ┌────────────────┐
                  │               │  │  Melissa Data  │
                  │               │  │  Tier-2 Append │
                  │               │  │  $0.15/lookup  │
                  │               │  └────┬───────────┘
                  │               │       │
                  │               ▼       ▼
                  │           ┌────────────────┐
                  │           │  Supabase      │
                  │           │  Update        │
                  │           │  Contact Info  │
                  │           └────────────────┘
                  │                  │
                  ▼                  ▼
            ┌─────────────────────────────┐
            │  Campaign Feeder             │
            │  (Verified contacts only)    │
            │  Rate-limited per broker     │
            └─────────────────────────────┘
```

---

## 1. Supabase Schema (Complete)

### Core Tables

```sql
-- ==========================================
-- LEADS TABLE (Complete Schema)
-- ==========================================

-- Add all missing columns
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS attom_property_id TEXT,
  ADD COLUMN IF NOT EXISTS parcel_number TEXT,
  ADD COLUMN IF NOT EXISTS county_fips TEXT,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS addr_hash TEXT,
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS estimated_value NUMERIC,
  ADD COLUMN IF NOT EXISTS equity_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS skiptrace_tier INTEGER,
  ADD COLUMN IF NOT EXISTS skiptrace_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_meta JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS campaign_status TEXT,
  ADD COLUMN IF NOT EXISTS added_to_campaign_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_broker_id UUID REFERENCES brokers(id),
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Deduplication indexes (priority order)
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_attom_id
  ON leads (attom_property_id)
  WHERE attom_property_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_apn_county
  ON leads (parcel_number, county_fips)
  WHERE parcel_number IS NOT NULL AND county_fips IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_addr_hash
  ON leads (addr_hash)
  WHERE addr_hash IS NOT NULL;

-- Query performance indexes
CREATE INDEX IF NOT EXISTS idx_leads_needs_enrichment
  ON leads (skiptrace_tier)
  WHERE skiptrace_tier IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_verified_contact
  ON leads (email_verified, phone_verified)
  WHERE email_verified = true OR phone_verified = true;

CREATE INDEX IF NOT EXISTS idx_leads_campaign_ready
  ON leads (campaign_status, added_to_campaign_at, assigned_broker_id)
  WHERE campaign_status IS NULL 
    AND (email_verified = true OR phone_verified = true);

-- ==========================================
-- LEAD IDS TABLE (Cross-Provider Tracking)
-- ==========================================

CREATE TABLE IF NOT EXISTS lead_ids (
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_record_id TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (provider, provider_record_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_ids_lead_id ON lead_ids (lead_id);

COMMENT ON TABLE lead_ids IS 'Maps external provider IDs to internal lead_id for cross-provider deduplication';
```

---

## 2. Idempotent Upsert RPC

```sql
-- Already created in migration above
-- Usage from n8n:
-- POST /rest/v1/rpc/upsert_lead_from_attom
-- Body: { "p": { "attom_property_id": "...", "email": "...", ... } }
```

**Key Features:**
- ✅ Three-level conflict resolution (attom_id → apn+fips → addr_hash)
- ✅ Preserves existing contact data (never overwrites verified contacts)
- ✅ Upgrades skiptrace_tier (1 → 2) automatically
- ✅ Merges enrichment_meta JSONB
- ✅ Returns UUID for pipeline tracking

---

## 3. n8n Workflow (Complete)

### Full Node List

```
1.  Cron Trigger (Daily or 6-hourly)
2.  Fetch Broker Territories (Supabase)
3.  Define Market Params (Code)
4.  Get Bookmark (Supabase RPC)
5.  Select Current Zip (Code)
6.  ATTOM Property Lookup (HTTP) ← NEW
7.  Extract & Normalize ATTOM (Code) ← NEW
8.  Compute Addr Hash (Code)
9.  Upsert Lead (Supabase RPC) ← UPDATED
10. IF Needs Enrichment? (Conditional) ← NEW
11. PDL Person Enrich (HTTP) ← NEW
12. Parse PDL Response (Code) ← NEW
13. IF PDL Hit? (Conditional) ← NEW
14. Melissa Contact Append (HTTP) ← NEW
15. Parse Melissa Response (Code) ← NEW
16. Update Enrichment (Supabase RPC) ← NEW
17. Check Stop-When-Known (Supabase RPC)
18. Advance Bookmark (Code + Supabase)
19. Log Completion (Code)
```

---

## 4. Enrichment Node Configurations

### Node 10: IF Needs Enrichment?

**Type:** IF Conditional

**Condition:**
```javascript
{{ $json.email === null || $json.email === undefined || $json.email === '' }}
```

**Logic:**
- **TRUE:** Lead needs enrichment → route to PDL
- **FALSE:** Lead already has contact → skip to campaign queue

---

### Node 11: PDL Person Enrich (Tier-1)

**Type:** HTTP Request

**Configuration:**

```json
{
  "method": "POST",
  "url": "https://api.peopledatalabs.com/v5/person/enrich",
  "authentication": "headerAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "X-API-Key",
        "value": "{{ $env.PDL_API_KEY }}"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={\n  \"street_address\": \"={{ $json.address_line1 }}\",\n  \"locality\": \"={{ $json.city }}\",\n  \"region\": \"={{ $json.state }}\",\n  \"postal_code\": \"={{ $json.postal_code }}\",\n  \"name\": \"={{ $json.owner_name }}\",\n  \"min_likelihood\": 6\n}",
  "options": {
    "timeout": 30000
  }
}
```

**Cost:** ~$0.05 per lookup  
**Hit rate:** 40-60% (verified contact found)

---

### Node 12: Parse PDL Response

**Type:** Code (JavaScript)

**Full Code:**

```javascript
// Parse PeopleDataLabs response
const response = $input.first().json;
const leadData = $('Upsert Lead').first().json;

// Initialize result
let result = {
  lead_id: leadData.id,
  attom_property_id: leadData.attom_property_id,
  pdl_hit: false,
  email: null,
  phone: null,
  email_verified: false,
  phone_verified: false,
  skiptrace_tier: null,
  enrichment_meta: {}
};

// Check if PDL found a match
if (response.status === 200 && response.data) {
  const person = response.data;
  
  // Extract best email (prefer primary/current)
  if (person.emails && person.emails.length > 0) {
    const primaryEmail = person.emails.find(e => e.type === 'primary' || e.current === true);
    const bestEmail = primaryEmail || person.emails[0];
    
    result.email = bestEmail.address;
    result.email_verified = bestEmail.type === 'professional' || bestEmail.current === true;
  }
  
  // Extract best phone (prefer mobile/primary)
  if (person.phone_numbers && person.phone_numbers.length > 0) {
    const mobilePhone = person.phone_numbers.find(p => p.type === 'mobile' && p.current === true);
    const primaryPhone = person.phone_numbers.find(p => p.type === 'primary');
    const bestPhone = mobilePhone || primaryPhone || person.phone_numbers[0];
    
    if (bestPhone) {
      result.phone = bestPhone.number;
      result.phone_verified = bestPhone.current === true;
    }
  }
  
  // Check if we got usable contact info
  if (result.email || result.phone) {
    result.pdl_hit = true;
    result.skiptrace_tier = 1;
    result.enrichment_meta = {
      pdl_likelihood: person.likelihood || 0,
      pdl_match_type: person.match_type || 'unknown',
      pdl_location_match: person.locations?.[0]?.type === 'current'
    };
    
    console.log(`✅ PDL Hit: Email=${!!result.email}, Phone=${!!result.phone}`);
  } else {
    console.log(`⚠️ PDL returned person but no contact info`);
  }
} else {
  console.log(`❌ PDL Miss: No person found (status ${response.status})`);
}

return [{
  json: {
    ...leadData,
    ...result
  }
}];
```

---

### Node 13: IF PDL Hit?

**Type:** IF Conditional

**Condition:**
```javascript
{{ $json.pdl_hit === true }}
```

**Logic:**
- **TRUE:** PDL found contact → Update lead and skip Melissa
- **FALSE:** PDL missed → Route to Melissa (Tier-2)

---

### Node 14: Melissa Contact Append (Tier-2)

**Type:** HTTP Request

**Configuration:**

```json
{
  "method": "POST",
  "url": "https://personator.melissadata.net/v3/WEB/ContactAppend/doContactAppend",
  "authentication": "none",
  "sendQuery": true,
  "queryParameters": {
    "parameters": [
      {
        "name": "id",
        "value": "={{ $env.MELISSA_LICENSE_KEY }}"
      },
      {
        "name": "format",
        "value": "json"
      },
      {
        "name": "ff",
        "value": "{{ $json.owner_name }}"
      },
      {
        "name": "a1",
        "value": "={{ $json.address_line1 }}"
      },
      {
        "name": "city",
        "value": "={{ $json.city }}"
      },
      {
        "name": "state",
        "value": "={{ $json.state }}"
      },
      {
        "name": "postal",
        "value": "={{ $json.postal_code }}"
      },
      {
        "name": "cols",
        "value": "Email,Phone"
      }
    ]
  },
  "options": {
    "timeout": 45000
  }
}
```

**Cost:** ~$0.15 per append (email + phone together)  
**Hit rate:** +20-30% beyond PDL

**Notes:**
- Uses query parameters (GET-style) per Melissa API spec
- `ff` = Full Name
- `cols` = Request only Email and Phone to minimize cost
- Higher timeout (45s) for Melissa's slower response

---

### Node 15: Parse Melissa Response

**Type:** Code (JavaScript)

**Full Code:**

```javascript
// Parse Melissa Contact Append response
const response = $input.first().json;
const leadData = $json;

let result = {
  lead_id: leadData.id || leadData.lead_id,
  attom_property_id: leadData.attom_property_id,
  melissa_hit: false,
  email: leadData.email,  // Preserve PDL email if exists
  phone: leadData.phone,  // Preserve PDL phone if exists
  email_verified: leadData.email_verified || false,
  phone_verified: leadData.phone_verified || false,
  skiptrace_tier: leadData.skiptrace_tier || null,
  enrichment_meta: leadData.enrichment_meta || {}
};

// Check Melissa response
if (response.Records && response.Records.length > 0) {
  const record = response.Records[0];
  
  // Check result codes (Melissa uses codes like AS01, AE01, etc.)
  const resultCodes = record.Results || '';
  
  // Extract email if found and not already set
  if (!result.email && record.Email) {
    result.email = record.Email;
    
    // Melissa email verification codes:
    // AE01-AE13 = various verification levels
    const emailVerified = resultCodes.includes('AE0') && 
                         !resultCodes.includes('AE13');  // AE13 = invalid
    result.email_verified = emailVerified;
  }
  
  // Extract phone if found and not already set
  if (!result.phone && record.Phone) {
    result.phone = record.Phone;
    
    // Melissa phone verification codes:
    // AP01-AP13 = various verification levels
    const phoneVerified = resultCodes.includes('AP0') && 
                         !resultCodes.includes('AP13');  // AP13 = invalid
    result.phone_verified = phoneVerified;
  }
  
  // Check if Melissa provided new contact info
  if (result.email || result.phone) {
    result.melissa_hit = true;
    result.skiptrace_tier = 2;
    result.enrichment_meta.melissa_result_codes = resultCodes;
    result.enrichment_meta.melissa_match_score = record.AddressKey || 0;
    
    console.log(`✅ Melissa Hit: Email=${!!result.email}, Phone=${!!result.phone}`);
    console.log(`   Verification: Email=${result.email_verified}, Phone=${result.phone_verified}`);
  } else {
    console.log(`⚠️ Melissa returned record but no new contact info`);
  }
} else {
  console.log(`❌ Melissa Miss: No contact append available`);
  result.enrichment_meta.melissa_status = 'no_match';
}

// If still no contact after both tiers, mark for DLQ
if (!result.email && !result.phone) {
  result.enrichment_meta.dlq_reason = 'no_contact_after_both_tiers';
  console.log(`🚫 DLQ: No contact found after PDL + Melissa`);
}

return [{
  json: result
}];
```

---

### Node 16: Update Enrichment

**Type:** HTTP Request (Supabase RPC)

**Configuration:**

```json
{
  "method": "POST",
  "url": "https://mxnqfwuhvurajrgoefyg.supabase.co/rest/v1/rpc/upsert_lead_from_attom",
  "authentication": "predefinedCredentialType",
  "nodeCredentialType": "supabaseApi",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={\n  \"p\": {\n    \"attom_property_id\": \"={{ $json.attom_property_id }}\",\n    \"email\": \"={{ $json.email }}\",\n    \"phone\": \"={{ $json.phone }}\",\n    \"email_verified\": {{ $json.email_verified }},\n    \"phone_verified\": {{ $json.phone_verified }},\n    \"skiptrace_tier\": {{ $json.skiptrace_tier }},\n    \"enrichment_meta\": {{ JSON.stringify($json.enrichment_meta) }}\n  }\n}"
}
```

---

## 5. Cost Breakdown (Per Lead)

### Scenario 1: PDL Hit (60% of leads)

```
ATTOM:    $0.10
PDL:      $0.05
Melissa:  $0.00 (skipped)
─────────────────
Total:    $0.15 per lead
```

### Scenario 2: Melissa Hit (30% of leads)

```
ATTOM:    $0.10
PDL:      $0.05 (miss)
Melissa:  $0.15
─────────────────
Total:    $0.30 per lead
```

### Scenario 3: Both Miss (10% of leads)

```
ATTOM:    $0.10
PDL:      $0.05 (miss)
Melissa:  $0.15 (miss)
DLQ:      Manual review
─────────────────
Total:    $0.30 per lead (no contact found)
```

### Blended Average

```
60% × $0.15 = $0.09
30% × $0.30 = $0.09
10% × $0.30 = $0.03
─────────────────────
Average:      $0.21 per lead
```

**For 250 leads/day:**
- **$52.50/day**
- **$1,575/month**

**vs BatchData: $186,000/month**  
**Savings: $184,425/month (99.2% reduction)**

---

## 6. Broker Capacity Guardrails

### Campaign Feeder Query

```sql
-- Select leads ready for campaign, respecting broker capacity
WITH broker_capacity AS (
  SELECT 
    b.id,
    b.daily_lead_capacity,
    COUNT(l.id) FILTER (WHERE l.added_to_campaign_at >= CURRENT_DATE) as today_count
  FROM brokers b
  LEFT JOIN leads l ON l.assigned_broker_id = b.id
  GROUP BY b.id, b.daily_lead_capacity
),
ranked_leads AS (
  SELECT 
    l.*,
    ROW_NUMBER() OVER (
      PARTITION BY l.assigned_broker_id 
      ORDER BY l.equity_percent DESC, l.created_at ASC
    ) as rank
  FROM leads l
  INNER JOIN broker_capacity bc ON l.assigned_broker_id = bc.id
  WHERE l.campaign_status IS NULL
    AND (l.email_verified = true OR l.phone_verified = true)
    AND bc.today_count < bc.daily_lead_capacity
)
SELECT *
FROM ranked_leads
WHERE rank <= 5;  -- Max 5 per broker per run
```

**Features:**
- ✅ Respects `daily_lead_capacity` per broker
- ✅ Prioritizes highest equity leads
- ✅ Only selects verified contacts
- ✅ Rate-limits to prevent broker overwhelm
- ✅ FIFO within equity tiers

---

## 7. Rate Limits & Backoff

### ATTOM API
- **Rate limit:** Typically 10-20 req/sec (check your plan)
- **Backoff:** 429 → wait 1s, retry with exponential backoff
- **Batch size:** 50 properties per page
- **Strategy:** Single-zip processing to stay under limits

### PeopleDataLabs (PDL)
- **Rate limit:** Varies by plan (typically 100-1000 req/min)
- **Backoff:** 429 → wait 500ms, retry max 3 times
- **Batch size:** Process 1 at a time (no bulk endpoint)
- **Strategy:** n8n loop with 200ms delay between calls

### Melissa Data
- **Rate limit:** No hard limit, but high latency (500ms-2s per call)
- **Backoff:** 500/503 → wait 2s, retry max 2 times
- **Batch size:** 1 per call
- **Strategy:** n8n queue with concurrency limit = 3

---

## 8. KPIs to Track

### Data Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **PDL Hit Rate** | 40-60% | % of leads with email/phone after Tier-1 |
| **Melissa Lift** | +20-30% | Additional % with contact after Tier-2 |
| **Total Enrichment Rate** | 70-85% | % with verified contact after both tiers |
| **Email Bounce Rate** | <3% | % of emails that bounce after verification |
| **Phone Disconnect Rate** | <10% | % of phones that are disconnected |

### Cost Metrics

| Metric | Target | Formula |
|--------|--------|---------|
| **Cost Per Lead (raw)** | $0.10 | ATTOM only |
| **Cost Per Enriched Lead** | $0.21 | Blended average (ATTOM + PDL/Melissa) |
| **Cost Per Qualified Lead** | $0.30 | Only leads with verified contact |
| **Cost Per Booked Call** | $15-30 | Lead cost ÷ call booking rate |

### Operational Metrics

| Metric | Target | Monitoring |
|--------|--------|------------|
| **Daily Pull Volume** | 250 leads | Count of new attom_property_id per day |
| **Enrichment Latency** | <5 min | Time from ATTOM → enrichment complete |
| **Campaign Queue Depth** | <1000 | Leads with verified contact, not yet sent |
| **Broker Capacity Utilization** | 80-95% | daily_count ÷ daily_capacity |

---

## 9. Cutover Checklist

### Pre-Launch (Database)
- [x] Add enrichment columns to leads table
- [x] Create deduplication indexes (attom_id, apn+fips, addr_hash)
- [x] Create `upsert_lead_from_attom` RPC function
- [x] Add `zip_index` to source_bookmarks
- [x] Create `advance_zip_bookmark` function
- [ ] Add `daily_lead_capacity` column to brokers table
- [ ] Create campaign feeder query/function

### Pre-Launch (API Accounts)
- [ ] Sign up for ATTOM API trial
- [ ] Sign up for PeopleDataLabs account
- [ ] Sign up for Melissa Data account
- [ ] Get API keys for all three providers
- [ ] Test each API with 1-2 sample records
- [ ] Verify costs match expectations

### Pre-Launch (n8n Workflow)
- [ ] Disable BatchData nodes
- [ ] Add ATTOM Property Lookup node
- [ ] Add Extract & Normalize ATTOM node
- [ ] Add PDL Person Enrich node
- [ ] Add Parse PDL Response node
- [ ] Add Melissa Contact Append node
- [ ] Add Parse Melissa Response node
- [ ] Update Upsert Lead to use new RPC
- [ ] Add IF conditionals for enrichment routing
- [ ] Test with 1 property end-to-end

### Production Deployment
- [ ] Run canary batch (50 records)
- [ ] Verify deduplication works
- [ ] Check enrichment hit rates match targets
- [ ] Confirm costs are within budget
- [ ] Monitor for 24 hours
- [ ] Ramp to daily 250 with broker capacity caps
- [ ] Enable cron trigger for automated pulls

---

## 10. Security & Compliance

### API Key Management
- ✅ Store all API keys in n8n credentials vault
- ✅ Never hardcode keys in node configurations
- ✅ Use environment variables: `$env.ATTOM_API_KEY`, etc.
- ✅ Rotate keys quarterly

### Data Privacy
- ✅ Log only metadata (hit/miss, tier used)
- ✅ Never log full email/phone in plaintext logs
- ✅ Maintain opt-out list in Supabase
- ✅ Respect provider ToS for consumer data usage
- ✅ TCPA compliance for phone contact

### Audit Trail
```sql
-- Track enrichment attempts
CREATE TABLE IF NOT EXISTS enrichment_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  provider TEXT,  -- 'pdl' | 'melissa'
  tier INTEGER,
  hit BOOLEAN,
  cost NUMERIC(10,4),
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrichment_audit_lead ON enrichment_audit (lead_id);
CREATE INDEX idx_enrichment_audit_provider ON enrichment_audit (provider, tier, hit);
```

---

## 11. Operational Runbook

### Daily Monitoring Checklist

**Every Morning:**
1. Check ATTOM API usage dashboard (verify ~250 lookups)
2. Check PDL hit rate (should be 40-60%)
3. Check Melissa usage (should be 30-40% of PDL misses)
4. Review Supabase leads table count (new records added)
5. Check campaign queue depth (should be <1000)
6. Review any DLQ leads (no contact after both tiers)

### Weekly Review
1. Analyze enrichment costs vs targets
2. Review broker capacity utilization
3. Check email bounce rates from campaigns
4. Optimize zip code rotation based on hit rates
5. Adjust PDL `min_likelihood` threshold if needed

### Monthly Optimization
1. Review provider hit rates and adjust tier strategy
2. Negotiate volume discounts with ATTOM/PDL/Melissa
3. Analyze which zip codes have best enrichment rates
4. Optimize broker territory assignments
5. Review and clean DLQ leads

---

## 12. Cost Scenarios (250 Leads/Day)

### Conservative (Low Hit Rates)
```
ATTOM:    250 × $0.10 = $25.00
PDL (40%): 250 × $0.05 = $12.50
Melissa (40%): 150 × $0.15 = $22.50
────────────────────────────────
Total:                  $60.00/day
Monthly:                $1,800
```

### Realistic (Expected Hit Rates)
```
ATTOM:    250 × $0.10 = $25.00
PDL (60%): 250 × $0.05 = $12.50
Melissa (30%): 100 × $0.15 = $15.00
────────────────────────────────
Total:                  $52.50/day
Monthly:                $1,575
```

### Optimistic (High Hit Rates)
```
ATTOM:    250 × $0.10 = $25.00
PDL (70%): 250 × $0.05 = $12.50
Melissa (20%): 75 × $0.15 = $11.25
────────────────────────────────
Total:                  $48.75/day
Monthly:                $1,462
```

**Profit margin (at $10k/month broker revenue):**
- Conservative: $8,200/month
- Realistic: $8,425/month
- Optimistic: $8,538/month

**vs BatchData:** Would lose $176,000/month 🚫

---

## 13. Next Steps

### Immediate (Today)
1. Sign up for ATTOM API trial: https://api.developer.attomdata.com/
2. Sign up for PeopleDataLabs: https://www.peopledatalabs.com/
3. Sign up for Melissa Data: https://www.melissa.com/quickstart
4. Get API keys from all three providers

### This Week
1. Update n8n workflow with all enrichment nodes
2. Test with 10 properties end-to-end
3. Verify costs and hit rates
4. Deploy to production for Walter Richards

### This Month
1. Monitor daily operations
2. Optimize based on hit rates
3. Scale to multiple brokers
4. Negotiate volume discounts

---

## Resources

- **ATTOM API Docs:** https://api.developer.attomdata.com/docs
- **PeopleDataLabs Docs:** https://docs.peopledatalabs.com/docs/enrichment-api
- **Melissa Personator Docs:** https://www.melissa.com/developer/personator
- **Implementation Guide:** `docs/ATTOM_API_MIGRATION.md`
- **Cost Analysis:** `docs/BATCHDATA_COST_ANALYSIS.md`

---

**Status:** Database ready ✅ | Documentation complete ✅ | Waiting on API signups ⏳  
**Next:** Get ATTOM, PDL, and Melissa API keys to proceed with workflow implementation

