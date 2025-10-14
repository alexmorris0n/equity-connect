# AI Daily Lead Acquisition Workflow

**File**: `ai-daily-lead-acquisition.json`  
**Replaces**: 5 separate workflows  
**Architecture**: One AI agent orchestrates everything

---

## 🎯 **What This Replaces**

| Old System (5 Workflows) | New AI System (1 Workflow) |
|-------------------------|---------------------------|
| PropertyRadar Pull Worker | ✅ Phase 1: Pull loop |
| Enrichment Waterfall | ✅ Phase 1: Inline enrichment |
| Q2H Backfill Checker | ❌ Not needed (loop ensures target) |
| EOD Backfill | ❌ Not needed (loop ensures target) |
| Campaign Feeder | ✅ Phase 2: Campaign upload |

---

## 🔧 **How It Works**

### **Daily at 6am**:
```
1. Fetch active brokers from Supabase
2. For each broker (loop):
   │
   └─ 🤖 AI Controller runs:
       │
       ├─ PHASE 1: PULL & ENRICH (loop until target)
       │   1. Count enriched so far
       │   2. Pull batch from PropertyRadar
       │   3. Filter duplicates
       │   4. Buy properties
       │   5. Enrich with /persons (PropertyRadar)
       │   6. Fallback to BatchData if quality < 70
       │   7. Merge best email/phone from both
       │   8. Insert to Supabase
       │   9. Update offset
       │   10. Loop if < target, else Phase 2
       │
       └─ PHASE 2: CAMPAIGN UPLOAD
           1. Get all enriched leads from today
           2. Assign archetype (high_equity/cash_unlocked/no_payment)
           3. Upload to Instantly (3 campaigns)
           4. Update leads: campaign_status='active'
           5. Done!
```

---

## 🎯 **Dynamic Capacity**

Each broker has their own `daily_lead_capacity` in Supabase:
- Broker A: 50 leads/day
- Broker B: 250 leads/day
- Broker C: 500 leads/day

**AI adapts**:
- Small quotas (≤100): Pull 20 per batch
- Medium quotas (100-300): Pull 30 per batch
- Large quotas (>300): Pull 50 per batch
- Batch size auto-adjusts based on enrichment rate

---

## 🛠️ **Tools the AI Uses**

### **💾 Supabase MCP** (29 tools):
- `execute_sql` - All database operations
- Count enriched, filter dupes, insert leads, update offset, get campaigns

### **🏘️ PropertyRadar API** (HTTP Request Tool):
- GET `/lists/{id}/items` - Pull RadarIDs
- POST `/properties` - Buy property data
- GET `/properties/{id}/persons` - Enrich contacts

### **📊 BatchData API** (HTTP Request Tool):
- POST `/api/v1/property/skip-trace` - Fallback enrichment

### **📧 Instantly API** (HTTP Request Tool):
- POST `/api/v1/lead/add` - Upload to campaigns

---

## 🎯 **Enrichment Strategy**

For each property:
1. **Try PropertyRadar /persons first** ($0.75)
   - Extract emails/phones
   - Score quality (0-100)
   
2. **If quality < 70** → **Fallback to BatchData** ($0.75)
   - Get additional contacts
   
3. **Merge best** from both sources
   - Highest-scored email
   - Highest-scored phone
   - Combined quality score

4. **Only count as "enriched"** if email OR phone exists

---

## 📊 **Safety Limits**

- **Max pulls**: 2x daily capacity (prevents runaway)
- **Max iterations**: 30
- **Max runtime**: 60 minutes
- **Min enrichment rate**: 50% (stops if quality tanks)

**Example**: Broker with 250 capacity
- Will pull max 500 properties
- Stops if enrichment rate drops below 50%
- Guarantees no runaway costs

---

## ✅ **Success Criteria**

- ✅ Enriched count >= daily_capacity (within 5%)
- ✅ All enriched leads uploaded to Instantly
- ✅ Broker offset updated correctly
- ✅ Campaign archetypes assigned
- ✅ Complete in < 60 minutes

---

## 🎨 **Workflow Nodes** (10 total):

1. **Daily Trigger (6am PT)** - Schedule trigger
2. **Fetch Active Brokers** - Supabase query
3. **Loop Over Brokers** - Process each broker
4. **Prepare Broker Context** - Extract broker config
5. **🤖 AI Controller** - The orchestrator (does everything!)
6. **Claude Sonnet 4.5** - LLM for AI agent
7. **💾 Supabase MCP** - Database operations
8. **🏘️ PropertyRadar API** - Property data
9. **📊 BatchData API** - Enrichment fallback
10. **📧 Instantly API** - Campaign upload
11. **📊 Parse Results** - Logging
12. **Loop back** - Next broker

---

## 💰 **Cost Efficiency**

**Built-in optimization**:
- Stops immediately when target reached
- Skips duplicate properties (saves $0.75 each)
- Only uses BatchData when needed (not every property)
- Dynamic batch sizing reduces API calls

**Example** (250 capacity, 82% enrichment rate):
- Pull: ~305 properties ($228.75)
- Enrich PR: 305 properties ($228.75)
- Enrich BD fallback: ~55 properties ($41.25)
- **Total**: ~$499/broker/day

vs old system with backfills: ~$550-600/day

---

## 🚀 **Why This is Revolutionary**

### **Old System**:
- 5 separate workflows
- Hardcoded logic
- Backfills needed
- Manual capacity checking
- Brittle error handling

### **New AI System**:
- 1 workflow
- AI decides everything
- Self-correcting loop
- Dynamic capacity
- Intelligent error recovery

**One AI agent replaces 500+ lines of deterministic code!**

---

## 📋 **Setup Requirements**

### **Configure MCP Endpoints**:
- Supabase MCP (need endpoint URL)
- Or keep as HTTP Request Tools for PropertyRadar/BatchData/Instantly

### **Credentials Needed**:
- ✅ Supabase (you have)
- ✅ PropertyRadar (you have)
- ✅ OpenRouter (you have)
- ⏳ BatchData API key
- ✅ Instantly (you have)

### **Database Setup**:
- ✅ Brokers table with `daily_lead_capacity`, `propertyradar_list_id`, `propertyradar_offset`
- ✅ Leads table ready
- ✅ Campaigns table with archetype mappings

---

## 🎓 **Next Steps**

1. Import `ai-daily-lead-acquisition.json`
2. Configure Supabase MCP endpoint (or it will use SQL via tools)
3. Test with one broker first
4. Monitor AI decisions in logs
5. Adjust prompt if needed
6. Deploy to production!

---

**This is enterprise-grade agentic AI architecture!** 🏆

