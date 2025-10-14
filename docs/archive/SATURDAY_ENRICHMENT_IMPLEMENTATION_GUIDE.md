# Saturday Enrichment - Implementation Guide

**Status:** Workflows created, ready for n8n import  
**Date:** October 11, 2025

---

## ✅ What's Been Created

Two new enrichment workflows are ready in the `workflows/` directory:

1. **`propertyradar-persons-enrichment.json`** (11 nodes)
   - Processes `enrich_propertyradar` events
   - Gets owner names + emails from PropertyRadar `/persons` API
   - Target: 70% email coverage

2. **`pdl-fallback-enrichment.json`** (9 nodes)
   - Processes `enrich_pdl` events  
   - Gets emails for leads PropertyRadar missed
   - Target: 18% additional coverage = 88% total

---

## 🚀 Next Steps (Your Action Required)

### Step 1: Import Workflows into n8n

1. Go to your n8n instance: https://n8n.instaroute.com
2. Click **Workflows** in left sidebar
3. Click **Import from File** (top right)
4. Import `workflows/propertyradar-persons-enrichment.json`
5. Repeat for `workflows/pdl-fallback-enrichment.json`

---

### Step 2: Configure Credentials

Both workflows need these credentials configured:

#### PropertyRadar Persons Enrichment Workflow:
- **Supabase credential** (already configured)
  - ID: `pvE2B3BDrLhctd5B`
  - Name: "SupaBase Equity Connect"
  - ✅ Should auto-connect

- **PropertyRadar API** (should already exist)
  - Find the node: "Call PropertyRadar Persons API"
  - Click on the node
  - In credentials dropdown, select your existing PropertyRadar API credential
  - If none exists, create:
    - Type: HTTP Header Auth
    - Name: "PropertyRadar API"
    - Header Name: `Authorization`
    - Header Value: `Bearer YOUR_PROPERTYRADAR_API_KEY`

#### PDL Fallback Enrichment Workflow:
- **Supabase credential** (already configured)
  - ID: `pvE2B3BDrLhctd5B`
  - ✅ Should auto-connect

- **People Data Labs API** (needs to be created)
  - Find the node: "Call PDL Person API"
  - Click on the node
  - Create new credential:
    - Type: HTTP Header Auth
    - Name: "People Data Labs API"
    - Header Name: `X-Api-Key`
    - Header Value: `YOUR_PDL_API_KEY`

---

### Step 3: Test with Small Batch

**Test PropertyRadar Enrichment First:**

1. Open the "PropertyRadar Persons Enrichment" workflow
2. Click **"Test workflow"** button (top right)
3. Click **"Execute Workflow"**
4. Watch the execution:
   - Should fetch 50 pending events
   - Process each lead one by one
   - Update database with names + emails
   - Queue PDL events for leads without emails

5. Check the results in Supabase:
   ```sql
   SELECT 
     id, 
     first_name, 
     last_name, 
     primary_email, 
     enriched_by,
     enriched_at
   FROM leads 
   WHERE enriched_at > NOW() - INTERVAL '10 minutes'
   ORDER BY enriched_at DESC
   LIMIT 10;
   ```

6. Verify PDL queue was created:
   ```sql
   SELECT COUNT(*) as pdl_queued
   FROM pipeline_events 
   WHERE event_type = 'enrich_pdl' 
   AND status = 'pending';
   ```

**Test PDL Enrichment Second:**

1. Open the "PDL Fallback Enrichment" workflow
2. Click **"Test workflow"** → **"Execute Workflow"**
3. Watch the execution process PDL events
4. Check that emails were added:
   ```sql
   SELECT 
     id,
     first_name,
     last_name,
     primary_email,
     enriched_by
   FROM leads 
   WHERE enriched_by = 'pdl'
   ORDER BY enriched_at DESC
   LIMIT 5;
   ```

---

### Step 4: Activate Both Workflows

Once testing passes:

1. In PropertyRadar Persons Enrichment workflow:
   - Click **"Active"** toggle (top right)
   - Should turn blue/green

2. In PDL Fallback Enrichment workflow:
   - Click **"Active"** toggle
   - Should turn blue/green

Both will now run automatically every 5 minutes.

---

### Step 5: Monitor Progress

**Watch the enrichment happen:**

1. Check n8n **Executions** tab every 10 minutes
2. Should see both workflows running every 5 minutes
3. PropertyRadar runs first (processes 50 leads per run)
4. PDL runs on leads PropertyRadar missed (processes 25 per run)

**Monitor with SQL queries:**

```sql
-- Overall enrichment status
SELECT 
  enriched_by,
  COUNT(*) as total,
  COUNT(primary_email) as with_email,
  ROUND(COUNT(primary_email) * 100.0 / COUNT(*), 1) as email_pct
FROM leads
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY enriched_by;

-- Pipeline events status
SELECT 
  event_type,
  status,
  COUNT(*) as count
FROM pipeline_events
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY event_type, status
ORDER BY event_type, status;

-- Expected output after completion:
-- propertyradar_persons: ~175 leads with emails (70%)
-- pdl: ~45 leads with emails (18%)
-- Total: ~220 leads with emails (88%)
```

**Expected Timeline:**
- 250 leads ÷ 50 per run = 5 PropertyRadar runs = 25 minutes
- ~75 leads need PDL ÷ 25 per run = 3 PDL runs = 15 minutes
- **Total time: ~40 minutes for all 250 leads**

---

### Step 6: Verify Final Results

Once all events are marked "complete":

```sql
-- Final coverage report
SELECT 
  COUNT(*) as total_leads,
  COUNT(primary_email) as leads_with_email,
  COUNT(primary_phone) as leads_with_phone,
  ROUND(COUNT(primary_email) * 100.0 / COUNT(*), 1) as email_coverage_pct,
  ROUND(COUNT(primary_phone) * 100.0 / COUNT(*), 1) as phone_coverage_pct
FROM leads
WHERE created_at > NOW() - INTERVAL '1 day';
```

**Success Criteria:**
- ✅ 250 total leads
- ✅ 220+ with primary_email (88%+)
- ✅ 230+ with primary_phone (92%+)
- ✅ All pipeline_events marked "complete"

---

## 🔧 Troubleshooting

### PropertyRadar API Errors

**Error: "401 Unauthorized"**
- Check PropertyRadar API credential
- Verify API key is valid
- Test manually: `curl -H "Authorization: Bearer YOUR_KEY" https://api.propertyradar.com/v1/properties/{radar_id}/persons`

**Error: "404 Not Found"**
- Means radar_id doesn't exist in PropertyRadar
- This is OK - workflow continues with `continueOnFail: true`
- Lead will be queued for PDL enrichment

**Error: Empty Persons array**
- PropertyRadar has property but no contact data
- Lead will be queued for PDL enrichment
- This is expected for ~30% of properties

### PDL API Errors

**Error: "401 Unauthorized"**
- Check PDL API credential  
- Header should be `X-Api-Key` (not Authorization)
- Verify you have PDL credits remaining

**Error: "404 Not Found"**
- PDL couldn't find person match
- This is OK with `continueOnFail: true`
- Lead will be marked complete but no email added

**Error: Rate limit**
- PDL has rate limits (default: 100/min)
- Workflow processes 25 every 5 minutes = safe
- If hit limit, wait 5 minutes and retry

### Database Errors

**Error: Column doesn't exist**
- Run this to add missing columns:
  ```sql
  ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS radar_person_data jsonb,
  ADD COLUMN IF NOT EXISTS pdl_data jsonb;
  ```

**Error: Foreign key constraint**
- Shouldn't happen - all leads exist before enrichment
- If occurs, check pipeline_events.lead_id matches leads.id

---

## 📊 Cost Tracking

**PropertyRadar:**
- First 2,500 contact lookups/month: FREE
- Usage today: 250 lookups
- Cost: $0 (under free tier)

**People Data Labs:**
- Cost per enrichment: $0.05-$0.10
- Expected usage: ~75 lookups
- Cost: $3.75-$7.50

**Total Saturday cost: $3.75-$7.50**

Check your PDL account after completion to verify actual usage.

---

## ✅ Checklist

Before Sunday's campaign setup, confirm:

- [ ] Both workflows imported successfully
- [ ] All credentials configured correctly
- [ ] Test executions completed without errors
- [ ] Both workflows activated
- [ ] 250 leads processed through PropertyRadar enrichment
- [ ] 220+ leads have verified emails (88% coverage)
- [ ] All pipeline_events marked "complete"
- [ ] Ready to feed leads to Instantly campaign

---

## 🎯 What's Next (Sunday)

Once enrichment is complete:

1. **Verify Campaign Feeder Workflow**
   - Check it fetches leads with `primary_email IS NOT NULL`
   - Test with 10 enriched leads

2. **Configure Instantly Campaign**
   - Create 3-email sequence
   - Add custom fields (property_address, equity, etc.)
   - Set daily limits

3. **Launch on Monday**
   - Start sending 50 leads/day
   - Monitor open rates, reply rates
   - Build consent form for replies

---

**You're on track! 🚀 The hard part (pulling + enriching) is done.**

