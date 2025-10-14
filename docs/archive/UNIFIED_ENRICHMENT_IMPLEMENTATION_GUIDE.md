# Unified Enrichment Workflow - Implementation Guide

**Status:** Workflow created, ready for n8n import  
**Date:** October 11, 2025  
**Workflow:** Single canvas with PropertyRadar → PDL waterfall

---

## ✅ What's Been Created

**File:** `workflows/unified-enrichment-waterfall.json` (14 nodes)

This single workflow handles the entire enrichment process:
- Gets 50 pending events every 5 minutes
- Calls PropertyRadar `/persons` API for each lead
- If PropertyRadar has email → Mark complete ✓
- If PropertyRadar has NO email → Immediately call PDL API
- Updates database and marks all events complete

**Key Advantage:** No waiting between PropertyRadar and PDL - instant fallback on same execution!

---

## 🔄 Workflow Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Every 5 Minutes Trigger                  │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│        Get 50 Pending "enrich_propertyradar" Events         │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              Split Into Batches (1 at a time)               │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│    Get Lead Details (radar_id, address, name, phone)        │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│         Call PropertyRadar /persons API (Purchase=1)         │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  Parse Response: NameFull, Emails[0], Phones[0]             │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│   Update Lead (first_name, last_name, email, phone)         │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
              ┌───────┴────────┐
              │  Has Email?    │
              └───────┬────────┘
                      │
        ┌─────────────┼─────────────┐
        │ YES (70%)   │   NO (30%)  │
        ↓             ↓             │
  ┌──────────┐  ┌──────────────────┴────────┐
  │  Mark    │  │ Call PDL Person API       │
  │ Complete │  │ (immediate fallback)      │
  └────┬─────┘  └──────────┬────────────────┘
       │                   ↓
       │         ┌─────────────────────────┐
       │         │ Parse PDL Response      │
       │         │ (emails[0].address)     │
       │         └──────────┬──────────────┘
       │                   ↓
       │         ┌─────────────────────────┐
       │         │ Update Lead (PDL email) │
       │         └──────────┬──────────────┘
       │                   ↓
       │         ┌─────────────────────────┐
       │         │   Mark Complete (PDL)   │
       │         └──────────┬──────────────┘
       │                   │
       └───────────────────┴────────────────►
                      │
              Loop back to next lead
```

---

## 📋 Node Breakdown

| # | Node Name | Type | Purpose |
|---|-----------|------|---------|
| 1 | Every 5 Minutes | Schedule Trigger | Runs workflow every 5 minutes |
| 2 | Get Pending Enrichment Events | Supabase Query | Fetches 50 pending events |
| 3 | Split Into Batches | Split In Batches | Processes 1 lead at a time |
| 4 | Get Lead Details | Supabase Query | Gets radar_id, address, name |
| 5 | Call PropertyRadar Persons API | HTTP Request | Gets owner contact data |
| 6 | Parse PropertyRadar Response | Code | Extracts name, email, phone |
| 7 | Update Lead (PropertyRadar Data) | Supabase Query | Saves to database |
| 8 | Has Email from PropertyRadar? | IF | Checks if email was found |
| 9 | Mark Complete (PropertyRadar Success) | Supabase Query | Completes event (70% path) |
| 10 | Call PDL Person API (Fallback) | HTTP Request | PDL enrichment (30% path) |
| 11 | Parse PDL Response | Code | Extracts email from PDL |
| 12 | Update Lead (PDL Data) | Supabase Query | Saves PDL email |
| 13 | Mark Complete (PDL Fallback) | Supabase Query | Completes event (30% path) |
| 14 | Loop Back to Next Lead | NoOp | Returns to Split node |

---

## 🚀 Import and Setup Instructions

### Step 1: Import Workflow into n8n

1. Go to your n8n instance: **https://n8n.instaroute.com**
2. Click **"Workflows"** in left sidebar
3. Click **"Import from File"** (top right)
4. Browse to `workflows/unified-enrichment-waterfall.json`
5. Click **"Import"**

The workflow should appear with all 14 nodes on the canvas.

---

### Step 2: Configure Credentials

The workflow needs 3 credentials:

#### A. Supabase (Already Configured)
- **Should auto-connect** to existing credential
- ID: `pvE2B3BDrLhctd5B`
- Name: "SupaBase Equity Connect"
- Used in: 5 nodes (all database operations)
- ✅ No action needed if already configured

#### B. PropertyRadar API
1. Click on node **"Call PropertyRadar Persons API"**
2. In the right panel, find **"Credential to connect with"**
3. Select your existing PropertyRadar credential
4. If none exists, create new:
   - Click **"Create New Credential"**
   - Type: **HTTP Header Auth**
   - Name: "PropertyRadar API"
   - Header Name: `Authorization`
   - Header Value: `Bearer YOUR_PROPERTYRADAR_API_KEY`
   - Click **"Save"**

#### C. People Data Labs (PDL) API
1. Click on node **"Call PDL Person API (Fallback)"**
2. In the right panel, find **"Credential to connect with"**
3. Create new credential:
   - Click **"Create New Credential"**
   - Type: **HTTP Header Auth**
   - Name: "People Data Labs API"
   - Header Name: `X-Api-Key`
   - Header Value: `YOUR_PDL_API_KEY`
   - Click **"Save"**

**Where to get PDL API Key:**
- Sign up at https://www.peopledatalabs.com/
- Go to Dashboard → API Keys
- Copy your API key

---

### Step 3: Test with Small Batch

**Before activating, test manually:**

1. In the workflow canvas, click **"Test workflow"** (top right)
2. Click **"Execute Workflow"**
3. Watch the execution flow:
   - Green lines = successful path
   - Red lines = error path (should be none)
   - Gray lines = path not taken

**What to look for:**
- Node "Get Pending Enrichment Events" should fetch events
- Node "Call PropertyRadar Persons API" should return 200 status
- Some leads should go through the top branch (has email)
- Some leads should go through the bottom branch (PDL fallback)
- All leads should reach "Mark Complete"

**Check the database:**

```sql
-- See recently enriched leads
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
LIMIT 20;
```

**Expected output:**
- Some rows with `enriched_by = 'propertyradar_persons'`
- Some rows with `enriched_by = 'pdl'`
- Names should be populated for 95%+
- Emails should be populated for 85%+

---

### Step 4: Verify Pipeline Events

Check that events are being marked complete:

```sql
SELECT 
  status,
  COUNT(*) as count
FROM pipeline_events 
WHERE event_type = 'enrich_propertyradar'
GROUP BY status;
```

**Expected output:**
```
status    | count
----------|-------
pending   | 200   (if you haven't run the full batch yet)
complete  | 50    (if you just tested with 50)
```

---

### Step 5: Activate Workflow

Once testing is successful:

1. In the workflow, toggle **"Active"** switch (top right)
2. Switch should turn blue/green
3. Workflow will now run automatically every 5 minutes

---

## 📊 Monitoring and Progress Tracking

### Real-Time Monitoring

**In n8n:**
1. Go to **"Executions"** tab
2. You should see new executions every 5 minutes
3. Click on any execution to see the flow
4. Green = success, Red = error

**Expected pattern:**
- Execution every 5 minutes
- ~50 leads processed per execution
- 5 executions = 250 leads = ~25 minutes total

---

### SQL Monitoring Queries

**Overall Progress:**
```sql
SELECT 
  COUNT(*) as total_leads,
  COUNT(CASE WHEN enriched_by IS NOT NULL THEN 1 END) as enriched,
  COUNT(CASE WHEN primary_email IS NOT NULL THEN 1 END) as with_email,
  ROUND(COUNT(CASE WHEN primary_email IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as email_pct
FROM leads
WHERE DATE(created_at) = CURRENT_DATE;
```

**Enrichment Breakdown:**
```sql
SELECT 
  enriched_by,
  COUNT(*) as total,
  COUNT(primary_email) as with_email,
  COUNT(primary_phone) as with_phone,
  ROUND(COUNT(primary_email) * 100.0 / COUNT(*), 1) as email_pct
FROM leads
WHERE DATE(created_at) = CURRENT_DATE
  AND enriched_by IS NOT NULL
GROUP BY enriched_by;
```

**Expected results:**
```
enriched_by              | total | with_email | email_pct
-------------------------|-------|------------|----------
propertyradar_persons    | 175   | 175        | 100.0
pdl                      | 65    | 45         | 69.2
```

**Pipeline Event Status:**
```sql
SELECT 
  event_type,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(completed_at) as newest_complete
FROM pipeline_events
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY event_type, status
ORDER BY event_type, status;
```

---

## ⏱️ Expected Timeline

**Processing Speed:**
- 50 leads per 5-minute cycle
- 250 leads ÷ 50 = 5 cycles
- 5 cycles × 5 minutes = **25 minutes total**

**Much faster than 2-workflow approach** (which required ~40 minutes due to waiting between PropertyRadar and PDL)

---

## 💰 Cost Tracking

**PropertyRadar:**
- First 2,500 contact lookups/month: **FREE**
- Today's usage: 250 lookups
- Cost: **$0** (under free tier)

**People Data Labs:**
- Cost per enrichment: $0.05-$0.10
- Expected usage: ~75 lookups (30% of 250)
- Cost: **$3.75-$7.50**

**Total Saturday cost: $3.75-$7.50**

Check your PDL dashboard after completion to verify actual usage.

---

## 🎯 Success Criteria

**By end of workflow execution:**

- ✅ 250 events processed
- ✅ 220+ leads with `primary_email` (88% coverage)
- ✅ 230+ leads with `primary_phone` (92% coverage)
- ✅ Names populated for 95%+ of leads
- ✅ All pipeline_events marked `status = 'complete'`
- ✅ Ready for Sunday's Instantly campaign setup

**Final verification query:**
```sql
SELECT 
  COUNT(*) as total_leads_today,
  COUNT(primary_email) as leads_with_email,
  COUNT(primary_phone) as leads_with_phone,
  ROUND(COUNT(primary_email) * 100.0 / COUNT(*), 1) as email_coverage_pct,
  ROUND(COUNT(primary_phone) * 100.0 / COUNT(*), 1) as phone_coverage_pct
FROM leads
WHERE DATE(created_at) = CURRENT_DATE;
```

**Expected output:**
```
total_leads_today | leads_with_email | email_coverage_pct
------------------|------------------|-------------------
250               | 220              | 88.0
```

---

## 🔧 Troubleshooting

### Common Issues and Fixes

**Issue: "No pending events found"**
- Check if PropertyRadar pull workflow created the events
- Run: `SELECT COUNT(*) FROM pipeline_events WHERE event_type = 'enrich_propertyradar' AND status = 'pending'`
- If 0, run PropertyRadar pull workflow first

**Issue: PropertyRadar API 401 Unauthorized**
- Check credential: Is Bearer token correct?
- Test manually: `curl -H "Authorization: Bearer YOUR_KEY" https://api.propertyradar.com/v1/properties/123/persons`

**Issue: PropertyRadar API 404 Not Found**
- This is OK! Some `radar_id` values won't exist
- Workflow has `continueOnFail: true`
- Lead will go through PDL fallback automatically

**Issue: PDL API 401 Unauthorized**
- Check header name is `X-Api-Key` (not `Authorization`)
- Verify PDL account has credits remaining
- Check: https://dashboard.peopledatalabs.com/

**Issue: PDL API rate limit**
- PDL default: 100 requests/minute
- Workflow processes 50 every 5 min = well under limit
- If hit limit: Wait 1 minute, workflow will retry

**Issue: Database column doesn't exist**
- Add missing columns:
```sql
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS primary_email text,
ADD COLUMN IF NOT EXISTS primary_phone text,
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enriched_by text,
ADD COLUMN IF NOT EXISTS enriched_at timestamptz,
ADD COLUMN IF NOT EXISTS radar_person_data jsonb,
ADD COLUMN IF NOT EXISTS pdl_data jsonb;
```

---

## 🎯 What's Next (After Enrichment)

Once you have 220+ leads with emails:

### 1. Backfill to 250 Qualified Leads (if needed)
- If email coverage is below target
- Trigger PropertyRadar pull again for more leads
- We'll build this logic separately

### 2. Sunday: Campaign Setup
- Configure Instantly.ai campaign
- Write 3-email sequence
- Test campaign feeder workflow
- Prepare for Monday launch

### 3. Monday: Launch Campaigns
- Start sending 50 leads/day to Instantly
- Monitor open rates, reply rates
- Build reply handler + consent form

---

## 📁 Files Created

**Workflows:**
1. ✅ `workflows/unified-enrichment-waterfall.json` (ACTIVE - use this one)
2. ⚠️ `workflows/propertyradar-persons-enrichment.json` (OLD - can delete)
3. ⚠️ `workflows/pdl-fallback-enrichment.json` (OLD - can delete)

**Documentation:**
1. `docs/UNIFIED_ENRICHMENT_IMPLEMENTATION_GUIDE.md` (this file)
2. `docs/SATURDAY_ENRICHMENT_IMPLEMENTATION_GUIDE.md` (OLD - for 2-workflow approach)

---

## ✅ Quick Checklist

Before moving to Sunday's tasks:

- [ ] Unified workflow imported into n8n
- [ ] All 3 credentials configured (Supabase, PropertyRadar, PDL)
- [ ] Manual test execution completed successfully
- [ ] Some leads went through PropertyRadar path
- [ ] Some leads went through PDL fallback path
- [ ] Database shows enriched leads with names and emails
- [ ] Workflow activated (toggle is ON)
- [ ] All 250 events processed (check executions tab)
- [ ] 220+ leads have verified emails (88%+ coverage)
- [ ] Ready for Instantly campaign setup

---

**Your enrichment workflow is production-ready! 🚀**

**Estimated time to complete:** 25 minutes once activated  
**Expected result:** 220+ leads with emails ready for cold outreach

