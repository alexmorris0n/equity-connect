# 🏗️ Database Architecture - Equity Connect

## ✅ Current Status: Production Ready

### **Last Updated**: November 6, 2025
### **Project**: mxnqfwuhvurajrgoefyg (Supabase)
### **Note**: This document covers the BatchData + Waterfall Skip-Trace architecture. For complete schema reference, see `DATABASE_SCHEMA_REFERENCE.md`

---

## 📊 New Tables Created

### 1. **`lead_source_events`** - Stop-When-Known Tracking
Tracks every API pull to enable idempotent pagination.

**Columns:**
- `id` - BIGSERIAL PRIMARY KEY
- `source` - TEXT (e.g., 'batchdata', 'propstream')
- `pull_params` - JSONB (normalized query parameters)
- `page_number` - INTEGER
- `seen_vendor_ids` - TEXT[] (array of vendor IDs seen on this page)
- `first_id` - TEXT (first vendor ID on page for quick detection)
- `last_id` - TEXT (last vendor ID on page)
- `created_at` - TIMESTAMPTZ

**Purpose**: When pulling a new page, check if any `vendor_ids` have been seen before. If yes, **stop** (we've caught up).

**Indexes:**
- `idx_source_events_source_page` - (source, page_number)
- `idx_source_events_created` - (created_at DESC)
- `idx_source_events_vendor_ids` - GIN index on seen_vendor_ids array

---

### 2. **`source_bookmarks`** - Pagination State
Maintains cursor/bookmark for each unique query signature.

**Columns:**
- `id` - BIGSERIAL PRIMARY KEY
- `source` - TEXT
- `query_sig` - TEXT (SHA-256 of normalized params)
- `last_page_fetched` - INTEGER
- `last_seen_vendor_id` - TEXT
- `updated_at` - TIMESTAMPTZ
- UNIQUE (source, query_sig)

**Purpose**: Track "where we left off" for each unique query so we can resume idempotently.

**Query Signature** = SHA-256 of:
```json
{
  "zip_codes": ["90028", "90038"],
  "filters": {"owner_occupied": true, "property_type": "single_family"},
  "sort": "created_desc"
}
```

**Indexes:**
- `idx_bookmarks_source` - (source)
- `idx_bookmarks_updated` - (updated_at DESC)

---

### 3. **`dlq`** - Dead Letter Queue
Stores failed operations for retry.

**Columns:**
- `id` - BIGSERIAL PRIMARY KEY
- `stage` - TEXT ('pull', 'enrich', 'verify', 'campaign')
- `payload` - JSONB (the data that failed)
- `error` - TEXT (error message)
- `retry_after` - TIMESTAMPTZ
- `created_at` - TIMESTAMPTZ
- `attempts` - INTEGER

**Purpose**: Capture failures with exponential backoff. Periodic drain job retries items.

**Indexes:**
- `idx_dlq_stage` - (stage)
- `idx_dlq_retry` - (retry_after) WHERE retry_after IS NOT NULL
- `idx_dlq_attempts` - (attempts)

---

## 🔄 Enhanced `leads` Table

### **New Columns Added:**

#### Source & Vendor Tracking
- `source` - TEXT (default 'PropStream') - 'batchdata', 'propstream', 'manual'
- `vendor_record_id` - TEXT - Vendor's unique ID for this lead
- `vendor_list_id` - TEXT - Batch/list context

#### Address Normalization
- `address_line1` - TEXT
- `address_line2` - TEXT
- `addr_hash` - TEXT - SHA-256 hash for deduplication
- `owner_company` - TEXT

#### Contact Points (JSONB Arrays)
- `phones` - JSONB[] - Array of phone objects
- `emails` - JSONB[] - Array of email objects

**Phone/Email Object Structure:**
```json
{
  "phone": "+15551234567",  // or "email": "john@example.com"
  "source": "melissa",
  "score": 85,
  "verified": true,
  "type": "mobile",  // for phones: mobile, landline, voip
  "added_at": "2025-10-08T..."
}
```

#### Quality & Timing
- `quality_score` - NUMERIC (0-100)
- `first_seen_at` - TIMESTAMPTZ
- `last_seen_at` - TIMESTAMPTZ

### **New Enum Values for `lead_status`:**
- `enriched` - Has some data but < 60 quality score
- `contactable` - Quality score >= 60, ready for campaigns
- `do_not_contact` - Quality score < 40

---

## 🔐 Unique Indexes for Deduplication

These prevent duplicate leads from entering the system:

1. **`ux_leads_addr`** - ON (addr_hash) WHERE addr_hash IS NOT NULL
2. **`ux_leads_mak`** - ON (mak) WHERE mak IS NOT NULL
3. **`ux_leads_apn`** - ON (apn) WHERE apn IS NOT NULL
4. **`ux_leads_vendor`** - ON (source, vendor_record_id) WHERE vendor_record_id IS NOT NULL

**Conflict Resolution**: `ON CONFLICT DO UPDATE SET last_seen_at = NOW()`

Any of these indexes can trip = it's a duplicate = update instead of insert.

---

## 🛠️ Helper Functions

### **1. `normalize_zip(zip TEXT)`**
Returns 5-digit ZIP code from ZIP+4 format.

```sql
SELECT normalize_zip('90028-1234');
-- Returns: '90028'
```

### **2. `compute_addr_hash(line1, city, state, zip)`**
Computes SHA-256 hash of normalized address for deduplication.

```sql
SELECT compute_addr_hash('123 Main St', 'Los Angeles', 'CA', '90028');
-- Returns: 'a3f5d8...'
```

### **3. `merge_contact_point(lead_id, kind, value, source, score, verified)`**
Safely adds phone or email to leads.phones/emails JSONB array with deduplication.

```sql
-- Add phone
SELECT merge_contact_point(
  'lead-uuid',
  'phone',
  '+15551234567',
  'melissa',
  85,
  true
);

-- Add email
SELECT merge_contact_point(
  'lead-uuid',
  'email',
  'john@example.com',
  'batchdata',
  75,
  false
);
```

### **4. `compute_quality_score(lead_id)`**
Calculates quality score (0-100) based on:
- +40 pts: Verified email
- +30 pts: Verified mobile/voip phone
- +10 pts: MAK + APN present
- +10 pts: Owner occupied = true
- +10 pts: Demographics fit (age >= 62, value >= $100k, equity > 0)

```sql
SELECT compute_quality_score('lead-uuid');
-- Returns: 75
```

### **5. `update_lead_status_from_score(lead_id)`**
Automatically sets lead status based on quality score:
- Score >= 60: `contactable`
- Score 40-59: `enriched`
- Score < 40: `do_not_contact`

```sql
SELECT update_lead_status_from_score('lead-uuid');
-- Returns: 'contactable'
-- AND updates leads.quality_score and leads.status
```

### **6. `has_vendor_ids_been_seen(source, query_sig, vendor_ids[])`**
Checks if any vendor IDs have been seen before (for stop-when-known logic).

```sql
SELECT has_vendor_ids_been_seen(
  'batchdata',
  'query-sig-hash',
  ARRAY['vendor-123', 'vendor-124']
);
-- Returns: true/false
```

### **7. `upsert_lead(...)`**
The main function for inserting/updating leads with automatic deduplication.

```sql
SELECT upsert_lead(
  p_source := 'batchdata',
  p_vendor_record_id := 'batch-123',
  p_vendor_list_id := 'hollywood-pull-1',
  p_address_line1 := '123 Sunset Blvd',
  p_address_line2 := NULL,
  p_city := 'Los Angeles',
  p_state := 'CA',
  p_postal_code := '90028',
  p_apn := '5544-003-021',
  p_owner_first_name := 'John',
  p_owner_last_name := 'Smith',
  p_owner_full_name := 'John Smith',
  p_owner_company := NULL,
  p_property_value := 850000,
  p_estimated_equity := 425000,
  p_age := 68
);
-- Returns: lead_id (UUID)
```

---

## 🎯 Triggers

### **`trg_leads_addr_hash`**
Automatically computes `addr_hash` on INSERT/UPDATE when NULL.

Runs `compute_addr_hash()` before row is written.

---

## 📊 Views

### **1. `vw_lead_quality_summary`**
Summary of lead quality distribution by status and source.

```sql
SELECT * FROM vw_lead_quality_summary;
```

**Columns:**
- `status`
- `source`
- `count`
- `avg_quality_score`
- `contactable_count` (score >= 60)
- `enriched_count` (score 40-59)
- `low_quality_count` (score < 40)

### **2. `vw_campaign_ready_leads`**
Leads ready to be added to campaigns, ordered by quality.

```sql
SELECT * FROM vw_campaign_ready_leads LIMIT 250;
```

**Columns:**
- `id`, `first_name`, `last_name`
- `property_city`, `property_state`
- `quality_score`
- `phones`, `emails`
- `assigned_persona`
- `microsite_url`
- `first_seen_at`

**Filters:**
- `status = 'contactable'`
- `added_to_campaign_at IS NULL`
- `quality_score >= 60`

---

## 🔄 Idempotent Pull Flow

### **How "Stop-When-Known" Works:**

```
1. Build query_sig = SHA-256({zip, filters, sort})
2. Get bookmark: SELECT last_page_fetched FROM source_bookmarks WHERE query_sig = ...
3. Fetch page = bookmark + 1 from BatchData API
4. Check: has_vendor_ids_been_seen(source, query_sig, vendor_ids[])
   - IF TRUE → STOP (we've seen these IDs before, caught up)
   - IF FALSE → Continue
5. Upsert each record: upsert_lead(...)
   - addr_hash conflict → update last_seen_at
   - MAK conflict → update last_seen_at
   - APN conflict → update last_seen_at
   - vendor_record_id conflict → update last_seen_at
6. Record: INSERT INTO lead_source_events (source, query_sig, page_number, seen_vendor_ids)
7. Advance: UPDATE source_bookmarks SET last_page_fetched = page
8. Repeat from step 3 until stop condition or no more results
```

---

## 📈 Quality Scoring System

### **Thresholds:**

| Score Range | Status | Action |
|------------|--------|--------|
| 0-39 | `do_not_contact` | Do not add to campaigns |
| 40-59 | `enriched` | Hold for second pass enrichment |
| 60-100 | `contactable` | Ready for campaigns! |

### **Scoring Breakdown:**

```
Base: 0 points

+ Verified Email (40 pts)
  - Email exists in emails JSONB
  - verified = true

+ Verified Mobile Phone (30 pts)
  - Phone exists in phones JSONB
  - verified = true
  - type = 'mobile' or 'voip'

+ MAK + APN Present (10 pts)
  - Both mak and apn fields NOT NULL

+ Owner Occupied (10 pts)
  - owner_occupied = true

+ Demographics Fit (10 pts)
  - age >= 62
  - property_value >= $100,000
  - estimated_equity > 0

Total: 0-100 points
```

---

## 🌊 Waterfall Skip-Trace Strategy

### **Stage 1: Melissa (Address + Person Enrichment)**
- Normalize address → get MAK
- Verify owner name
- Append any low-cost phones/emails
- **Cost**: ~$0.05 per record

### **Stage 2: BatchData Skip-Trace (Fill Gaps)**
- Only for leads that don't meet "contactable" threshold after Stage 1
- Call BatchData skip-trace API
- Merge phones/emails with deduplication
- **Cost**: ~$0.15 per record

### **Stage 3: Verify**
- Email: SMTP verification or Instantly
- Phone: HLR lookup or SignalWire
- Mark `verified = true` in JSONB
- **Cost**: ~$0.01 per contact point

### **Stage 4: Score & Route**
- `compute_quality_score(lead_id)`
- `update_lead_status_from_score(lead_id)`
- If `contactable` → queue for campaigns
- If `enriched` → hold for manual review or second pass
- If `do_not_contact` → suppress

---

## 💰 Cost Controls

### **1. Stop-When-Known**
- Detects duplicate pages immediately
- Stops API pull as soon as known IDs appear
- **Saves**: Prevents re-pulling same data

### **2. Deduplication Indexes**
- 4 unique indexes catch duplicates instantly
- ON CONFLICT → just update timestamp
- **Saves**: No re-enrichment, no re-skip-trace

### **3. Waterfall Gating**
- Stage 2 (expensive) only runs if Stage 1 fails to hit threshold
- **Saves**: ~$0.15 per lead that Stage 1 resolves

### **4. Quality Thresholds**
- Don't add uncontactable leads to campaigns
- Avoid wasted email sends to unverified addresses
- **Saves**: Campaign costs + bounce penalties

### **5. Daily Caps**
- Limit Stage 2 calls per day (e.g., 1,000)
- Smooth spend over time
- **Saves**: Budget control

---

## 📋 Next Steps

✅ **Phase 1 Complete**: Database schema
🔜 **Phase 2 Next**: n8n Workflows
   - BatchData pull worker
   - Enrichment pipeline (Melissa → BatchData → Verify)
   - Campaign feeder

---

## 🔗 Quick Reference

### **Key Functions to Use:**
```sql
-- Upsert a lead
SELECT upsert_lead(...);

-- Add phone/email
SELECT merge_contact_point(lead_id, 'phone', '+15551234567', 'melissa', 85, true);

-- Calculate quality
SELECT compute_quality_score(lead_id);

-- Update status from score
SELECT update_lead_status_from_score(lead_id);

-- Check if seen before
SELECT has_vendor_ids_been_seen('batchdata', 'query-sig', ARRAY['id1', 'id2']);
```

### **Key Views to Query:**
```sql
-- Lead quality summary
SELECT * FROM vw_lead_quality_summary;

-- Campaign-ready leads
SELECT * FROM vw_campaign_ready_leads LIMIT 250;
```

---

## ✅ Migration Status

- ✅ **Tables Created**: 3 new + 1 enhanced (plus many more since initial migration)
- ✅ **Indexes Created**: 15+ total
- ✅ **Functions Created**: 7+ helper functions
- ✅ **Triggers Created**: Multiple auto-compute triggers
- ✅ **Views Created**: 2 monitoring views
- ✅ **Enum Values Added**: Extended lead_status and campaign_status enums

**Database**: mxnqfwuhvurajrgoefyg (Supabase)
**Original Migration**: `batchdata_waterfall_architecture_v2` (October 8, 2025)
**Status**: ✅ **PRODUCTION** with ongoing enhancements

---

## 📝 Related Documentation

- **Complete Schema Reference**: See `DATABASE_SCHEMA_REFERENCE.md` for all tables, columns, and types
- **Prompt Management**: Schema includes `prompts`, `prompt_versions`, `broker_prompt_assignments` tables
- **Calendar Integration**: Nylas OAuth integration fields in `brokers` table
- **Campaign Tracking**: `campaigns`, `email_events`, `campaign_history` JSONB tracking
- **Phone Pool**: `signalwire_phone_numbers` for appointment tracking

---

🚀 **System is production-ready and actively handling leads!**

