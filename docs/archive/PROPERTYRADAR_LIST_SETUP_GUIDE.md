# PropertyRadar List-Based Pull Setup Guide

## Overview
This workflow uses **PropertyRadar Dynamic Lists** instead of per-ZIP API calls. This approach:
- ✅ **Eliminates duplicates** using RadarID + APN + address hash
- ✅ **Reduces API calls** from 31+ per broker to 1
- ✅ **Pulls only new properties** from monitored lists
- ✅ **No loops or bookmarks** - simple linear flow

---

## One-Time Setup

### 1. Database Migration

Run the migration to add dedup columns and upsert function:

```bash
psql -h your-supabase-db.supabase.co -U postgres -d postgres < config/propertyradar-list-dedup-migration.sql
```

Or via Supabase SQL Editor:
```sql
-- Copy/paste contents of config/propertyradar-list-dedup-migration.sql
```

This adds:
- `radar_id`, `apn`, `county_fips`, `addr_hash` columns to `leads` table
- Unique indexes for deduplication hierarchy
- `propertyradar_list_id` column to `brokers` table
- Updated `upsert_lead_from_radar()` function

---

### 2. Create PropertyRadar Dynamic List (Per Broker)

For **each broker**, create a dynamic list in PropertyRadar with their criteria:

#### Via PropertyRadar UI:
1. Log in to [PropertyRadar](https://app.propertyradar.com)
2. Go to **Lists** → **Create Dynamic List**
3. Name: `RM_{broker_id}` (e.g., `RM_6a3c5ed5-664a-4e13-b019-99fe8db74174`)
4. Add Criteria:

**Location:**
- ZipFive: `90016, 90018, 90019, ...` (all broker ZIPs)

**Owner Details:**
- Age: `>= 62`
- Owner Occupied / Primary Residence: `Yes` (isSameMailingOrExempt)

**Property:**
- Property Type: `SFR, DPX, TPX, FPX, CND`

**Value & Equity:**
- AVM: `$400,000 - $3,000,000`
- Available Equity: `>= $150,000`
- Equity Percent: `>= 40%`
- CLTV: `<= 60%`

5. Save and copy the **List ID** (format: `L12345ABC`)

#### Via PropertyRadar API:
```bash
curl -X POST https://api.propertyradar.com/v1/lists \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "RM_6a3c5ed5-664a-4e13-b019-99fe8db74174",
    "type": "dynamic",
    "Criteria": [
      {"name": "ZipFive", "value": ["90016", "90018", "90019"]},
      {"name": "Age", "value": [[62, null]]},
      {"name": "AvailableEquity", "value": [[150000, null]]},
      {"name": "EquityPercent", "value": [[40, null]]},
      {"name": "isSameMailingOrExempt", "value": [1]},
      {"name": "PropertyType", "value": [{"name": "PType", "value": ["SFR", "DPX", "TPX", "FPX", "CND"]}]},
      {"name": "AVM", "value": [[400000, 3000000]]},
      {"name": "CLTV", "value": [[null, 60]]}
    ]
  }'
```

Save the returned `id` (e.g., `L7A8B9C0`).

---

### 3. Update Broker Record in Supabase

Add the List ID to the broker:

```sql
UPDATE brokers 
SET propertyradar_list_id = 'L7A8B9C0'
WHERE id = '6a3c5ed5-664a-4e13-b019-99fe8db74174';
```

Or via Supabase Table Editor:
- Open `brokers` table
- Find the broker row
- Set `propertyradar_list_id` to the List ID

---

### 4. Import Workflow to n8n

1. Copy contents of `workflows/propertyradar-list-pull-worker.json`
2. In n8n: **Workflows** → **Import from File** (or clipboard)
3. Reassign credentials:
   - **Supabase nodes**: Select "SupaBase Equity Connect"
   - **HTTP Request nodes with PropertyRadar**: Select "PropertyRadar" Bearer token
4. **Save** the workflow
5. **Test** manually (click "Execute Workflow")

---

## How It Works

### Workflow Flow (8 Nodes):

```
Daily Trigger (6am)
  ↓
Initialize Session (create session_id)
  ↓
Fetch Active Brokers (get brokers with status='active')
  ↓ [n8n processes each broker in parallel]
Prepare Broker State (extract list_id, daily_capacity)
  ↓
Get RadarIDs from List (GET /v1/lists/{id}/items?Limit=250)
  ↓
Extract RadarIDs (parse response)
  ↓
Preview Purchase (POST /v1/properties?Purchase=0)
  ↓
Check Preview (verify count/cost)
  ↓
Purchase Properties (POST /v1/properties?Purchase=1)
  ↓
Parse & Hash Results (compute radar_id, apn, county_fips, addr_hash)
  ↓
Upsert Lead to Supabase (ON CONFLICT DO NOTHING)
  ↓
Final Summary (log completion)
```

### Deduplication Hierarchy:

1. **RadarID** (primary) - PropertyRadar's unique ID
2. **APN + County FIPS** (secondary) - assessor parcel number
3. **Address Hash** (tertiary) - normalized address string hash

If any key matches, the lead is considered a duplicate and skipped.

---

## Configuration

### Adjust Daily Lead Capacity

Per broker, in Supabase `brokers` table:
```sql
UPDATE brokers 
SET daily_lead_capacity = 500
WHERE id = 'broker-uuid';
```

Workflow will automatically pull `daily_lead_capacity` leads per broker per day.

---

## Testing

### Manual Test:
1. Open workflow in n8n
2. Click **"Execute Workflow"**
3. Watch each node execute
4. Check console logs:
   - Session ID
   - Broker name + List ID
   - RadarIDs count
   - Preview cost
   - Purchase count
   - Leads upserted

### Verify in Supabase:
```sql
-- Check inserted leads
SELECT 
  radar_id, 
  apn, 
  property_address, 
  property_city, 
  property_zip,
  assigned_broker_id,
  created_at
FROM leads
WHERE source = 'propertyradar'
ORDER BY created_at DESC
LIMIT 10;
```

### Test Deduplication:
Run workflow twice - second run should skip all leads (ON CONFLICT DO NOTHING).

---

## Monitoring

### Check Workflow Executions:
- n8n → **Executions** tab
- Filter by workflow name
- Click execution to see node outputs

### Check PropertyRadar Costs:
- Preview call shows cost estimate
- Purchase call shows actual cost
- Each lead costs ~$0.50-$1.00 (check PropertyRadar pricing)

### Check Lead Stats:
```sql
-- Leads per broker
SELECT 
  b.company_name,
  COUNT(l.id) as lead_count,
  COUNT(l.id) FILTER (WHERE l.created_at::date = CURRENT_DATE) as today_count
FROM brokers b
LEFT JOIN leads l ON l.assigned_broker_id = b.id
WHERE b.status = 'active'
GROUP BY b.id, b.company_name;
```

---

## Troubleshooting

### "Broker missing propertyradar_list_id"
- Create dynamic list in PropertyRadar
- Update `brokers.propertyradar_list_id` in Supabase

### "Preview returned 0 properties"
- Check list has items: `GET /v1/lists/{id}/items`
- Verify list criteria in PropertyRadar UI
- Check if list is monitored/active

### "Function upsert_lead_from_radar does not exist"
- Run migration: `config/propertyradar-list-dedup-migration.sql`
- Verify in Supabase SQL Editor

### "Duplicate key violation"
- This is expected! Means dedup is working
- Lead already exists with that RadarID/APN/address
- ON CONFLICT DO NOTHING will skip silently

### High API costs
- Verify `Purchase=0` preview runs first
- Check `daily_lead_capacity` isn't set too high
- Review list criteria - might be too broad

---

## Cost Estimates

**PropertyRadar API:**
- List items call (GET): ~$0.00 (just IDs)
- Preview (Purchase=0): ~$0.00 (no charge)
- Purchase (Purchase=1): ~$0.50-$1.00 per property

**Daily cost per broker:**
- 250 leads × $0.75 avg = **~$187.50/day**
- 30 days = **~$5,625/month per broker**

**Compare to old approach:**
- 31 ZIPs × multiple pages × repurchases = **2-3x higher cost**

---

## Next Steps

1. ✅ Run migration
2. ✅ Create PropertyRadar lists (one per broker)
3. ✅ Update broker records with list_id
4. ✅ Import workflow to n8n
5. ✅ Test manually
6. ✅ Enable daily trigger (6am)
7. 📊 Monitor costs and lead quality

---

## Support

- PropertyRadar API Docs: https://developers.propertyradar.com/
- n8n Docs: https://docs.n8n.io/
- Supabase Docs: https://supabase.com/docs

