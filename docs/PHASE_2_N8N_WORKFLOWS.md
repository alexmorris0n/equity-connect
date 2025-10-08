# 🔄 Phase 2: n8n Workflows for BatchData + Waterfall Skip-Trace

## 📋 Overview

Now that the database is ready, we need to build the n8n workflows that orchestrate the entire lead generation pipeline.

---

## 🎯 Workflows to Build

### **1. BatchData Pull Worker** (Primary)
**Trigger**: Cron schedule (hourly, Mon-Fri 9am-5pm)
**Purpose**: Idempotently pull leads from BatchData API with stop-when-known logic

**Flow:**
```
1. Cron Trigger (every hour)
   ↓
2. Function: Build query_sig from parameters
   ↓
3. Supabase: Get bookmark (last_page_fetched)
   ↓
4. HTTP Request: BatchData API (page = bookmark + 1)
   ↓
5. Function: Check stop-when-known
   ├─ IF seen before → End (caught up)
   └─ IF new → Continue
   ↓
6. Split In Batches: For each record
   ├─ Function: Compute addr_hash
   ├─ Supabase RPC: upsert_lead()
   └─ Queue: Add to enrichment pipeline
   ↓
7. Supabase: Insert lead_source_events
   ↓
8. Supabase: Update source_bookmarks
   ↓
9. Loop to step 4 (next page) or End
```

**Parameters** (per market):
- `zip_codes`: ['90028', '90038', '90046']
- `filters`: {owner_occupied: true, property_type: 'single_family', age: '>= 62', equity: '> 100000'}
- `sort`: 'created_desc'

---

### **2. Enrichment Pipeline** (Waterfall)
**Trigger**: Pipeline event (stage='enrich')
**Purpose**: Run 3-stage waterfall enrichment

**Flow:**
```
1. Trigger: pipeline_events WHERE stage='enrich'
   ↓
2. Supabase: Get lead by ID
   ↓
3. STAGE 1 - Melissa Enrichment
   ├─ HTTP: Melissa Personator API
   ├─ Function: Extract MAK, phones, emails
   ├─ Supabase RPC: merge_contact_point() for each
   └─ Supabase: Update lead with MAK
   ↓
4. Function: compute_quality_score()
   ├─ IF score >= 60 → Skip to Stage 4 (verified as contactable)
   └─ IF score < 60 → Continue to Stage 2
   ↓
5. STAGE 2 - BatchData Skip-Trace (only if needed)
   ├─ HTTP: BatchData Skip-Trace API
   ├─ Function: Extract phones, emails
   └─ Supabase RPC: merge_contact_point() for each
   ↓
6. Function: compute_quality_score() again
   ↓
7. STAGE 3 - Verification
   ├─ For each email:
   │  ├─ HTTP: SMTP Verification or Instantly API
   │  └─ Supabase: Update verified=true if pass
   ├─ For each phone:
   │  ├─ HTTP: SignalWire Number Lookup
   │  └─ Supabase: Update verified=true + type if pass
   ↓
8. Function: compute_quality_score() final
   ↓
9. Supabase RPC: update_lead_status_from_score()
   ↓
10. IF status='contactable'
    └─ Queue: Add to campaign_feeder
```

---

### **3. Campaign Feeder** (Daily)
**Trigger**: Cron schedule (daily 8am)
**Purpose**: Move contactable leads to Instantly campaigns

**Flow:**
```
1. Cron Trigger (daily 8am)
   ↓
2. Supabase: Query vw_campaign_ready_leads LIMIT 250
   ↓
3. Split In Batches: For each lead
   ├─ Function: Build Instantly payload
   ├─ HTTP: Instantly Add Contact API
   ├─ Function: Generate microsite URL
   ├─ Supabase: Create microsite record
   ├─ Supabase: Update lead
   │  ├─ added_to_campaign_at = NOW()
   │  ├─ microsite_url = url
   │  └─ campaign_status = 'queued'
   └─ Supabase: Insert interaction record
   ↓
4. Function: Log completion (success count)
```

---

### **4. Error Handler** (Monitor)
**Trigger**: Cron schedule (every 5 min)
**Purpose**: Retry failed operations from DLQ

**Flow:**
```
1. Cron Trigger (every 5 min)
   ↓
2. Supabase: SELECT * FROM dlq WHERE retry_after <= NOW() AND attempts < 3
   ↓
3. Split In Batches: For each failed item
   ├─ Switch: Based on stage
   │  ├─ 'pull' → Retry BatchData pull
   │  ├─ 'enrich' → Retry enrichment
   │  ├─ 'verify' → Retry verification
   │  └─ 'campaign' → Retry campaign add
   ├─ On Success:
   │  └─ Supabase: DELETE FROM dlq WHERE id = ...
   └─ On Failure:
      └─ Supabase: UPDATE dlq SET attempts = attempts + 1, retry_after = NOW() + (attempts * 5 min)
```

---

## 🛠️ Required n8n Nodes

### **Core Nodes:**
- ✅ **Cron** - Schedule triggers
- ✅ **HTTP Request** - API calls (BatchData, Melissa, SignalWire, Instantly)
- ✅ **Supabase** - Database operations
- ✅ **Function** - JavaScript logic
- ✅ **Split In Batches** - Process arrays
- ✅ **IF** - Conditional branching
- ✅ **Switch** - Multi-way branching
- ✅ **Merge** - Combine data flows

### **Custom Functions:**
```javascript
// compute_addr_hash
function computeAddrHash(line1, city, state, zip) {
  const normalized = [
    line1?.toUpperCase().trim(),
    city?.toUpperCase().trim(),
    state?.toUpperCase().trim(),
    zip?.substring(0, 5)
  ].join('|');
  
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// build_query_sig
function buildQuerySig(params) {
  const normalized = JSON.stringify(params, Object.keys(params).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// stop_when_known
async function stopWhenKnown(source, querySig, vendorIds) {
  const { data } = await supabase.rpc('has_vendor_ids_been_seen', {
    p_source: source,
    p_query_sig: querySig,
    p_vendor_ids: vendorIds
  });
  return data; // true/false
}
```

---

## 📊 Workflow Parameters

### **BatchData Pull Worker:**
```json
{
  "market": "hollywood",
  "zip_codes": ["90028", "90038", "90046"],
  "filters": {
    "owner_occupied": true,
    "property_type": "single_family",
    "age_min": 62,
    "equity_min": 100000
  },
  "sort": "created_desc",
  "page_size": 100
}
```

### **Enrichment Pipeline:**
```json
{
  "melissa_api_key": "{{$env.MELISSA_API_KEY}}",
  "batchdata_api_key": "{{$env.BATCHDATA_API_KEY}}",
  "signalwire_project": "{{$env.SIGNALWIRE_PROJECT}}",
  "signalwire_token": "{{$env.SIGNALWIRE_TOKEN}}",
  "quality_threshold": 60,
  "skip_stage2_if_contactable": true
}
```

### **Campaign Feeder:**
```json
{
  "daily_cap": 250,
  "instantly_api_key": "{{$env.INSTANTLY_API_KEY}}",
  "instantly_campaign_id": "{{$env.INSTANTLY_CAMPAIGN_ID}}",
  "base_url": "https://equityconnect.com"
}
```

---

## 🔐 Environment Variables Needed

```env
# BatchData
BATCHDATA_API_KEY=your_key_here
BATCHDATA_BASE_URL=https://api.batchdata.io

# Melissa
MELISSA_API_KEY=your_key_here
MELISSA_BASE_URL=https://personator.melissadata.net

# SignalWire
SIGNALWIRE_PROJECT=your_project_id
SIGNALWIRE_TOKEN=your_token
SIGNALWIRE_SPACE=your_space.signalwire.com

# Instantly
INSTANTLY_API_KEY=your_key_here
INSTANTLY_API_BASE=https://api.instantly.ai

# Supabase
SUPABASE_URL=https://mxnqfwuhvurajrgoefyg.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Application
NEXT_PUBLIC_BASE_URL=https://equityconnect.com
```

---

## 📝 Implementation Order

1. ✅ **BatchData Pull Worker** - Start getting data
2. ✅ **Enrichment Pipeline** - Process the data
3. ✅ **Campaign Feeder** - Send to Instantly
4. ✅ **Error Handler** - Monitor and retry

---

## 🧪 Testing Strategy

### **1. Test BatchData Pull (Dry Run)**
- Use test API credentials
- Pull 1 page only
- Verify `lead_source_events` recorded
- Verify `source_bookmarks` updated
- Check for duplicates (should update, not insert)

### **2. Test Enrichment (Single Lead)**
- Pick one test lead
- Run through all 3 stages
- Verify phones/emails merged correctly
- Verify quality_score computed
- Verify status updated based on score

### **3. Test Campaign Feeder (1 Lead)**
- Query `vw_campaign_ready_leads LIMIT 1`
- Send to Instantly (test campaign)
- Verify microsite created
- Verify `added_to_campaign_at` set

### **4. Test Stop-When-Known**
- Pull same page twice
- Second pull should detect known IDs and stop
- Verify no duplicate inserts

---

## 🚀 Ready to Build?

Now that the database is ready, we can build these workflows in n8n.

**Next**: Build the BatchData Pull Worker workflow first?


