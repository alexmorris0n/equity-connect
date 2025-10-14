# SQL Reference for AI Daily Lead Acquisition

**All SQL queries the AI agent needs to execute via Supabase MCP `execute_sql` tool.**

---

## ✅ **PHASE 1: PULL & ENRICH LOOP**

### 1. Count Today's Enriched Leads

```sql
SELECT COUNT(*) as count 
FROM leads 
WHERE assigned_broker_id = '{broker_id}'
  AND DATE(created_at AT TIME ZONE 'America/Los_Angeles') = CURRENT_DATE
  AND (primary_email IS NOT NULL OR primary_phone IS NOT NULL);
```

**Returns**: `{ count: 42 }`

---

### 2. Filter New RadarIDs (Deduplication)

```sql
SELECT radar_id 
FROM unnest(ARRAY['P6ABBF32', 'P7CDDE43', 'P8EEFF54']::text[]) AS radar_id
WHERE NOT EXISTS (
  SELECT 1 FROM leads WHERE leads.radar_id = radar_id
);
```

**Returns**: Array of RadarIDs that don't exist in database

---

### 3. Insert Lead (Complete with All Fields)

```sql
INSERT INTO leads (
  -- Dedup keys
  radar_id,
  apn,
  county_fips,
  addr_hash,
  
  -- Property info
  property_address,
  property_city,
  property_state,
  property_zip,
  property_value,
  estimated_equity,
  
  -- Contact info
  first_name,
  last_name,
  primary_email,
  primary_phone,
  email_verified,
  phone_verified,
  
  -- Enrichment metadata
  enriched_by,
  enriched_at,
  quality_score,
  enrichment_quality,
  
  -- Raw data storage
  radar_property_data,
  batchdata_property_data,
  best_property_data,
  
  -- Assignment
  assigned_broker_id,
  
  -- Status
  status,
  source,
  
  -- Timestamps
  created_at,
  updated_at
)
VALUES (
  '{radar_id}',
  '{apn}',
  '{county_fips}',
  '{addr_hash}',
  
  '{property_address}',
  '{property_city}',
  '{property_state}',
  '{property_zip}',
  {property_value},
  {estimated_equity},
  
  '{first_name}',
  '{last_name}',
  '{primary_email}',
  '{primary_phone}',
  {email_verified},
  {phone_verified},
  
  '{enriched_by}',
  NOW(),
  {quality_score},
  '{enrichment_quality}',
  
  '{radar_property_data_json}'::jsonb,
  '{batchdata_property_data_json}'::jsonb,
  '{best_property_data_json}'::jsonb,
  
  '{broker_id}',
  
  'enriched',
  'propertyradar',
  
  NOW(),
  NOW()
)
RETURNING id;
```

**Returns**: `{ id: 'lead-uuid-here' }`

---

### 4. Update Broker Offset

```sql
UPDATE brokers 
SET propertyradar_offset = propertyradar_offset + {increment}
WHERE id = '{broker_id}'
RETURNING propertyradar_offset;
```

**Example**: If increment = 30, offset goes from 2400 → 2430

---

### 5. Log Pipeline Event (Optional but Recommended)

```sql
INSERT INTO pipeline_events (
  event_type,
  lead_id,
  broker_id,
  event_data,
  status,
  created_at
)
VALUES (
  'propertyradar_pull',
  '{lead_id}',
  '{broker_id}',
  '{"radar_id": "{radar_id}", "iteration": {iteration}, "enriched_by": "{enriched_by}"}'::jsonb,
  'success',
  NOW()
);
```

---

## ✅ **PHASE 2: CAMPAIGN UPLOAD**

### 6. Get Campaign IDs

```sql
SELECT archetype, instantly_campaign_id, campaign_name
FROM campaigns 
WHERE active = true
ORDER BY sequence_order;
```

**Returns**:
```
[
  { archetype: 'no_more_payments', instantly_campaign_id: 'xxx', campaign_name: 'No More Payments' },
  { archetype: 'cash_unlocked', instantly_campaign_id: 'yyy', campaign_name: 'Cash Unlocked' },
  { archetype: 'high_equity_special', instantly_campaign_id: 'zzz', campaign_name: 'High Equity Special' }
]
```

---

### 7. Get Today's Campaign-Ready Leads

```sql
SELECT 
  id,
  first_name,
  last_name,
  primary_email,
  property_address,
  property_city,
  property_state,
  property_zip,
  property_value,
  estimated_equity,
  assigned_broker_id
FROM leads
WHERE assigned_broker_id = '{broker_id}'
  AND DATE(created_at AT TIME ZONE 'America/Los_Angeles') = CURRENT_DATE
  AND primary_email IS NOT NULL
  AND campaign_status IS NULL
ORDER BY quality_score DESC;
```

**Returns**: Array of leads ready for campaign assignment

---

### 8. Get Broker Info for Merge Fields

```sql
SELECT 
  id,
  contact_name,
  nmls_number,
  company_name
FROM brokers
WHERE id = '{broker_id}';
```

**Returns**: `{ contact_name: 'John Smith', nmls_number: '12345', company_name: 'ABC Mortgage' }`

---

### 9. Update Lead with Campaign Assignment

```sql
UPDATE leads 
SET 
  campaign_status = 'active',
  campaign_archetype = '{archetype}',
  instantly_campaign_id = '{campaign_id}',
  added_to_campaign_at = NOW(),
  campaign_history = campaign_history || 
    '[{"archetype": "{archetype}", "campaign_id": "{campaign_id}", "added_at": "{timestamp}"}]'::jsonb
WHERE id = '{lead_id}';
```

**Use after** uploading to Instantly

---

### 10. Bulk Update Leads with Campaign (Efficient Version)

```sql
UPDATE leads 
SET 
  campaign_status = 'active',
  campaign_archetype = CASE
    WHEN (estimated_equity::numeric / NULLIF(property_value::numeric, 0) * 100) >= 80 THEN 'high_equity_special'
    WHEN (estimated_equity::numeric / NULLIF(property_value::numeric, 0) * 100) >= 50 THEN 'cash_unlocked'
    ELSE 'no_more_payments'
  END,
  added_to_campaign_at = NOW()
WHERE assigned_broker_id = '{broker_id}'
  AND DATE(created_at AT TIME ZONE 'America/Los_Angeles') = CURRENT_DATE
  AND primary_email IS NOT NULL
  AND campaign_status IS NULL
RETURNING id, campaign_archetype;
```

**Batch assigns all leads at once!**

---

## ✅ **HELPER QUERIES**

### Check Broker's Today Progress

```sql
SELECT 
  COUNT(*) as total_today,
  COUNT(*) FILTER (WHERE primary_email IS NOT NULL OR primary_phone IS NOT NULL) as enriched,
  COUNT(*) FILTER (WHERE campaign_status = 'active') as uploaded_to_campaign,
  ROUND(AVG(quality_score), 2) as avg_quality
FROM leads
WHERE assigned_broker_id = '{broker_id}'
  AND DATE(created_at AT TIME ZONE 'America/Los_Angeles') = CURRENT_DATE;
```

---

### Get Enrichment Stats

```sql
SELECT 
  enriched_by,
  COUNT(*) as count,
  ROUND(AVG(quality_score), 2) as avg_quality,
  COUNT(*) FILTER (WHERE primary_email IS NOT NULL) as has_email,
  COUNT(*) FILTER (WHERE primary_phone IS NOT NULL) as has_phone
FROM leads
WHERE assigned_broker_id = '{broker_id}'
  AND DATE(created_at AT TIME ZONE 'America/Los_Angeles') = CURRENT_DATE
GROUP BY enriched_by;
```

**Shows**: PropertyRadar vs BatchData vs Merged stats

---

### Check for Duplicates Before Insert

```sql
SELECT COUNT(*) as dupe_count
FROM leads
WHERE radar_id = '{radar_id}'
   OR apn = '{apn}'
   OR addr_hash = '{addr_hash}';
```

**If count > 0**: Skip this property (already exists)

---

## ✅ **CAMPAIGN ARCHETYPE ASSIGNMENT LOGIC**

### In SQL (Efficient)

```sql
-- Calculate archetype directly in SQL
SELECT 
  id,
  first_name,
  primary_email,
  property_value,
  estimated_equity,
  CASE
    WHEN (estimated_equity::numeric / NULLIF(property_value::numeric, 0) * 100) >= 80 
      THEN 'high_equity_special'
    WHEN (estimated_equity::numeric / NULLIF(property_value::numeric, 0) * 100) >= 50 
      THEN 'cash_unlocked'
    ELSE 'no_more_payments'
  END as archetype,
  ROUND(estimated_equity::numeric * 0.50) as equity_50_percent,
  ROUND(estimated_equity::numeric * 0.60) as equity_60_percent
FROM leads
WHERE assigned_broker_id = '{broker_id}'
  AND DATE(created_at AT TIME ZONE 'America/Los_Angeles') = CURRENT_DATE
  AND primary_email IS NOT NULL
  AND campaign_status IS NULL;
```

**Returns leads with archetype and merge fields calculated!**

---

## ✅ **DATA VALIDATION QUERIES**

### Check Lead Quality Distribution

```sql
SELECT 
  CASE
    WHEN quality_score >= 80 THEN 'Excellent (80+)'
    WHEN quality_score >= 60 THEN 'Good (60-79)'
    WHEN quality_score >= 40 THEN 'Fair (40-59)'
    ELSE 'Poor (<40)'
  END as quality_tier,
  COUNT(*) as count
FROM leads
WHERE assigned_broker_id = '{broker_id}'
  AND DATE(created_at AT TIME ZONE 'America/Los_Angeles') = CURRENT_DATE
GROUP BY quality_tier
ORDER BY MIN(quality_score) DESC;
```

---

### Find Leads Needing Retry Enrichment

```sql
SELECT id, radar_id, property_address
FROM leads
WHERE assigned_broker_id = '{broker_id}'
  AND DATE(created_at AT TIME ZONE 'America/Los_Angeles') = CURRENT_DATE
  AND quality_score < 40
  AND enriched_by = 'propertyradar'
LIMIT 50;
```

**AI can retry these with BatchData**

---

## 🎯 **COMPLETE WORKFLOW SQL SEQUENCE**

### **Iteration Loop** (repeat until target):

```sql
-- 1. Count enriched
SELECT COUNT(*) FROM leads 
WHERE assigned_broker_id = '{broker_id}'
AND DATE(created_at AT TIME ZONE 'America/Los_Angeles') = CURRENT_DATE
AND (primary_email IS NOT NULL OR primary_phone IS NOT NULL);

-- 2. Filter RadarIDs (pass array from PropertyRadar API)
SELECT radar_id FROM unnest(ARRAY[...]::text[]) AS radar_id
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE leads.radar_id = radar_id);

-- 3. Insert each lead (after enrichment)
INSERT INTO leads (...) VALUES (...) RETURNING id;

-- 4. Update offset
UPDATE brokers SET propertyradar_offset = propertyradar_offset + {batch_size}
WHERE id = '{broker_id}';
```

### **Campaign Upload** (after target reached):

```sql
-- 1. Get campaign IDs
SELECT archetype, instantly_campaign_id FROM campaigns WHERE active = true;

-- 2. Get broker info
SELECT contact_name, nmls_number FROM brokers WHERE id = '{broker_id}';

-- 3. Get leads with calculated archetypes
SELECT id, first_name, primary_email, property_value, estimated_equity,
  CASE
    WHEN (estimated_equity/property_value*100) >= 80 THEN 'high_equity_special'
    WHEN (estimated_equity/property_value*100) >= 50 THEN 'cash_unlocked'
    ELSE 'no_more_payments'
  END as archetype,
  ROUND(estimated_equity * 0.50) as equity_50,
  ROUND(estimated_equity * 0.60) as equity_60
FROM leads
WHERE assigned_broker_id = '{broker_id}'
AND DATE(created_at AT TIME ZONE 'America/Los_Angeles') = CURRENT_DATE
AND primary_email IS NOT NULL AND campaign_status IS NULL;

-- 4. Update after Instantly upload (bulk)
UPDATE leads 
SET campaign_status = 'active',
    campaign_archetype = CASE
      WHEN (estimated_equity/property_value*100) >= 80 THEN 'high_equity_special'
      WHEN (estimated_equity/property_value*100) >= 50 THEN 'cash_unlocked'
      ELSE 'no_more_payments'
    END,
    added_to_campaign_at = NOW()
WHERE assigned_broker_id = '{broker_id}'
AND DATE(created_at AT TIME ZONE 'America/Los_Angeles') = CURRENT_DATE
AND primary_email IS NOT NULL AND campaign_status IS NULL;
```

---

## ✅ **ALL SQLs CONFIRMED**

The workflow has all necessary SQL queries! ✅

**Missing from prompt** (I'll add these):
- ❌ Complete INSERT with all field values
- ❌ Bulk campaign update SQL
- ❌ Log interaction SQL (optional)

Let me add these to the prompt...

