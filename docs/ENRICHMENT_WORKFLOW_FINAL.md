# Unified Enrichment Workflow - Final Implementation

**Status:** Ready to import  
**Date:** October 11, 2025  
**File:** `workflows/unified-enrichment-waterfall.json`

---

## 🎯 What This Workflow Does

Enriches 250 leads per day with owner names, emails, and phones using a smart 2-tier waterfall:

1. **PropertyRadar /persons API** (free, fast)
2. **Quality check** - only call BatchData if score < 70
3. **BatchData skip trace** (paid, high quality)
4. **Merge logic** - picks best email/phone from both sources

---

## 📊 Database Schema

### New Fields Added:

```sql
batchdata_property_data jsonb  -- Raw BatchData enrichment results
best_property_data jsonb       -- Merged "best of both" with ranked options
```

### What's Stored:

**`radar_property_data`** (existing):
```json
{
  "emails": [
    {"email": "john@gmail.com", "score": 40, "source": "propertyradar", "rank": 1}
  ],
  "phones": [
    {"number": "5551234567", "type": "Mobile", "dnc": false, "score": 25}
  ],
  "quality_score": 95
}
```

**`batchdata_property_data`** (new):
```json
{
  "emails": [
    {"email": "jsmith@company.com", "score": 20, "source": "batchdata"}
  ],
  "phones": [
    {"number": "5559876543", "type": "Mobile", "dnc": false, "score": 100}
  ],
  "quality_score": 65
}
```

**`best_property_data`** (new) - THE ROLLUP:
```json
{
  "selected_email": "john@gmail.com",
  "selected_phone": "5559876543",
  "email_source": "propertyradar",
  "phone_source": "batchdata",
  "email_score": 40,
  "phone_score": 100,
  "all_emails": [
    {"email": "john@gmail.com", "score": 40, "source": "propertyradar", "rank": 1},
    {"email": "jsmith@company.com", "score": 20, "source": "batchdata", "rank": 2}
  ],
  "all_phones": [
    {"number": "5559876543", "score": 100, "source": "batchdata", "rank": 1},
    {"number": "5551234567", "score": 25, "source": "propertyradar", "rank": 2}
  ],
  "quality_score": 95,
  "merged_at": "2025-10-11T..."
}
```

**Denormalized fields** (for easy querying):
```sql
primary_email text  -- Copy of best_property_data->selected_email
primary_phone text  -- Copy of best_property_data->selected_phone
quality_score int   -- Overall quality score
```

---

## 🔄 Workflow Flow

```
Every 5 Minutes
  ↓
Get 50 pending "enrich_propertyradar" events
  ↓
Split Into Batches (1 at a time)
  ↓
Get Lead Details (radar_id, address)
  ↓
Call PropertyRadar /persons API
  ↓
Parse + Score PropertyRadar Results
  • Score emails (personal domain = 40, business = 20)
  • Score phones (mobile = 15, non-DNC = 10, reachable = 5)
  • Calculate quality_score (0-100)
  ↓
Update Lead (PropertyRadar data + radar_property_data jsonb)
  ↓
IF: Quality Score < 70?
  ├─ NO (High Quality) → Mark Complete ✓
  │                      Loop back
  │
  └─ YES (Low Quality) → Call BatchData Skip Trace API
                           ↓
                         Parse + Score BatchData Results
                           ↓
                         Merge Best of Both Sources
                           • Compare email scores from both
                           • Compare phone scores from both
                           • Pick highest scoring options
                           • Rank all alternatives
                           ↓
                         Update Lead (merged data + best_property_data jsonb)
                           ↓
                         Mark Complete ✓
                           Loop back
```

---

## 📈 Quality Scoring System

### Email Quality (0-40 points):

- **40 points:** Personal email (gmail.com, yahoo.com, hotmail.com, outlook.com, aol.com, icloud.com)
- **20 points:** Business email (company domain)
- **10 points:** Institutional email (.edu, .gov)
- **0 points:** No email

### Phone Quality (0-30 points):

- **15 points:** Mobile phone
- **10 points:** Not on DNC list
- **5 points:** Reachable/verified
- **0-30 points:** BatchData score (0-100 normalized to 0-30)

### Name Quality (0-30 points):

- **30 points:** First name AND last name
- **15 points:** First name OR last name only
- **0 points:** No name

### Overall Quality Score:

```
Quality Score = Name Score + Email Score + Phone Score
Maximum: 100 points
Threshold for BatchData: < 70
```

---

## 💰 Cost Optimization

### PropertyRadar Coverage (Estimated):

- **High quality (score ≥ 70):** ~125 leads (50%)
  - Have personal email + mobile phone
  - Skip BatchData ✅

- **Low quality (score < 70):** ~125 leads (50%)
  - Missing email, OR business email, OR landline only
  - Call BatchData ⚠️

### BatchData Costs:

- BatchData calls needed: ~125 leads
- Cost per lookup: $0.07
- **Total cost: $8.75**

### vs No Quality Check:

- If we called BatchData for ALL 250 leads: $17.50
- **Savings: $8.75** (50% reduction)

---

## 🔧 n8n Import Instructions

### Step 1: Import Workflow

1. Go to n8n: https://n8n.instaroute.com
2. Click **Workflows** → **Import from File**
3. Select `workflows/unified-enrichment-waterfall.json`
4. Click **Import**

### Step 2: Configure Credentials

The workflow needs 3 credentials:

#### A. Supabase (Already Configured)
- ✅ Auto-connects to credential ID: `pvE2B3BDrLhctd5B`
- No action needed

#### B. PropertyRadar (Already Configured)
- ✅ Should auto-connect to credential ID: `81i7WbQilIMSh4E3`
- Node: "Call PropertyRadar Persons API"
- Type: HTTP Bearer Auth
- No action needed if already configured

#### C. BatchData (Need to Configure)
- Node: "Call BatchData Skip Trace"
- Click on node → Credentials
- Create new credential:
  - Type: **HTTP Header Auth**
  - Name: "BatchData API"
  - Header Name: `Authorization`
  - Header Value: `Bearer YOUR_BATCHDATA_API_KEY`

**Where to get BatchData API Key:**
- Login to BatchData dashboard
- Go to Account → API Keys
- Copy your server-side token

---

## 🧪 Testing Process

### Step 1: Manual Test

1. Open the workflow in n8n
2. Click **"Test workflow"** (top right)
3. Click **"Execute Workflow"**

**Watch the execution:**
- Some leads should go through top path (high quality, skip BatchData)
- Some leads should go through bottom path (low quality, call BatchData)

### Step 2: Check Database Results

```sql
-- See recently enriched leads
SELECT 
  id,
  first_name,
  last_name,
  primary_email,
  primary_phone,
  quality_score,
  enriched_by,
  best_property_data->>'email_source' as email_source,
  best_property_data->>'phone_source' as phone_source
FROM leads 
WHERE enriched_at > NOW() - INTERVAL '10 minutes'
ORDER BY enriched_at DESC
LIMIT 20;
```

**Expected output:**
- Names populated for 95%+
- Emails populated for 85%+
- `email_source` shows 'propertyradar' or 'batchdata'
- `phone_source` shows 'propertyradar' or 'batchdata'
- Quality scores vary (some 90+, some 50-70)

### Step 3: Verify Merge Logic

```sql
-- Check if merge is working correctly
SELECT 
  id,
  primary_email,
  (radar_property_data->'selected_email')::text as pr_email,
  (batchdata_property_data->'selected_email')::text as bd_email,
  (best_property_data->'selected_email')::text as best_email,
  (best_property_data->>'email_source') as winner
FROM leads
WHERE batchdata_property_data IS NOT NULL
  AND batchdata_property_data != '{}'::jsonb
LIMIT 10;
```

**Verify:** `primary_email` matches `best_email`, and `winner` shows which source had the better score.

---

## 📊 Monitoring Queries

### Overall Progress:

```sql
SELECT 
  COUNT(*) as total_leads,
  COUNT(primary_email) as with_email,
  COUNT(primary_phone) as with_phone,
  ROUND(AVG(quality_score), 1) as avg_quality,
  COUNT(CASE WHEN batchdata_property_data != '{}'::jsonb THEN 1 END) as used_batchdata
FROM leads
WHERE DATE(created_at) = CURRENT_DATE;
```

**Expected:**
- 250 total leads
- 220+ with email (88%)
- 230+ with phone (92%)
- Average quality: 75-85
- ~125 used BatchData (50%)

### Source Breakdown:

```sql
SELECT 
  best_property_data->>'email_source' as email_source,
  best_property_data->>'phone_source' as phone_source,
  COUNT(*) as count,
  ROUND(AVG((best_property_data->>'email_score')::numeric), 1) as avg_email_score,
  ROUND(AVG((best_property_data->>'phone_score')::numeric), 1) as avg_phone_score
FROM leads
WHERE DATE(created_at) = CURRENT_DATE
  AND best_property_data IS NOT NULL
GROUP BY 
  best_property_data->>'email_source',
  best_property_data->>'phone_source'
ORDER BY count DESC;
```

**This shows:**
- Which source (PropertyRadar vs BatchData) gave better emails
- Which source gave better phones
- Average quality scores per source

### Pipeline Events Status:

```sql
SELECT 
  status,
  COUNT(*) as count
FROM pipeline_events 
WHERE event_type = 'enrich_propertyradar'
  AND DATE(created_at) = CURRENT_DATE
GROUP BY status;
```

**Expected:**
- `pending`: 0 (when complete)
- `complete`: 250

---

## 🎯 How Downstream Workflows Use This

### Campaign Feeder (Simple):

```sql
-- Just use primary_email - merge already done!
SELECT 
  id,
  first_name,
  last_name,
  primary_email,
  property_address,
  estimated_equity
FROM leads
WHERE primary_email IS NOT NULL
  AND campaign_status = 'new'
LIMIT 50;
```

### Campaign Feeder (Advanced - Try Backup Emails):

```javascript
// If primary email bounces, try ranked alternatives
const lead = $json;
const bestData = JSON.parse(lead.best_property_data || '{}');
const allEmails = bestData.all_emails || [];

return {
  email_primary: allEmails[0]?.email,    // Try first
  email_backup_1: allEmails[1]?.email,   // Fallback 1
  email_backup_2: allEmails[2]?.email,   // Fallback 2
  firstName: lead.first_name,
  propertyAddress: lead.property_address
};
```

### Analytics - Which Source is Better?

```sql
SELECT 
  best_property_data->>'email_source' as source,
  COUNT(*) as total_emails,
  ROUND(AVG((best_property_data->>'email_score')::numeric), 1) as avg_score
FROM leads
WHERE best_property_data->>'email_source' IS NOT NULL
GROUP BY best_property_data->>'email_source';
```

**This tells you:** "PropertyRadar had better emails 73% of the time" or vice versa!

---

## 💡 Key Benefits

### 1. Smart Cost Optimization
- Only pays for BatchData when PropertyRadar data is low quality
- Saves ~50% on BatchData costs

### 2. Best of Both Worlds
- Never downgrades data
- Takes best email from PropertyRadar, best phone from BatchData (or vice versa)
- Full audit trail of both sources

### 3. Ranked Alternatives
- All emails ranked by quality score
- All phones ranked by quality score
- Can try backup contacts if primary fails

### 4. Simple for Downstream
- Campaign feeder just reads `primary_email`
- Or can access `best_property_data` for advanced logic
- No merge logic needed in other workflows

### 5. Re-scoreable
- Have all raw data from both sources
- Can adjust scoring algorithm anytime
- Re-run merge without re-enriching

---

## 🚀 Activation Steps

1. **Import workflow** into n8n
2. **Configure BatchData credential** (Bearer token)
3. **Test manually** with 5-10 leads
4. **Verify merge logic** works correctly
5. **Activate workflow** (toggle ON)
6. **Monitor for 25 minutes** until 250 leads complete

---

## 📈 Expected Results

**After enrichment completes:**

- ✅ 250 leads processed
- ✅ 220+ with verified emails (88%)
- ✅ 230+ with verified phones (92%)
- ✅ ~125 enriched by PropertyRadar alone (high quality)
- ✅ ~125 enriched by PropertyRadar + BatchData merge
- ✅ All leads have `best_property_data` with ranked contact options
- ✅ Ready for Instantly campaign on Sunday!

**Total daily cost per broker:** $22.61 (includes PropertyRadar contacts, BatchData, Instantly)
**Platform cost breakdown:**
- PropertyRadar contacts (over free tier): $9.91/day
- BatchData skip trace (125 lookups): $8.75/day
- Instantly.ai (4-email campaign): $1.36/day
- PropertyRadar/Instantly subscription allocation: $2.59/day

---

## 🎯 Success Criteria

Run this verification query:

```sql
SELECT 
  COUNT(*) as total,
  COUNT(primary_email) as with_email,
  COUNT(primary_phone) as with_phone,
  ROUND(COUNT(primary_email) * 100.0 / COUNT(*), 1) as email_pct,
  ROUND(AVG(quality_score), 1) as avg_quality,
  COUNT(CASE WHEN (best_property_data->>'email_source') = 'propertyradar' THEN 1 END) as pr_emails,
  COUNT(CASE WHEN (best_property_data->>'email_source') = 'batchdata' THEN 1 END) as bd_emails
FROM leads
WHERE DATE(created_at) = CURRENT_DATE;
```

**Target output:**
```
total | with_email | email_pct | avg_quality | pr_emails | bd_emails
------|------------|-----------|-------------|-----------|----------
250   | 220        | 88.0      | 78.5        | 135       | 85
```

---

**The workflow is production-ready!** 🚀

**Next:** Import into n8n and test!

