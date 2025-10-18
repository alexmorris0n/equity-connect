# Equity Connect - n8n Workflows

This folder contains the production n8n workflows for the Equity Connect platform. File names match exactly with n8n workflow names for easy identification.

---

## 🎯 Active Production Workflows

### **Core AI Workflows** (Tags: AI, Main, Equity Connect)

#### `01_AI_Daily_Lead_Puller.json`
- **n8n ID:** `4KYUnVgwQiJhoWYz`
- **Status:** ✅ Active
- **Schedule:** Mon-Fri 6:00 AM PT
- **Purpose:** AI orchestrates entire lead acquisition pipeline
- **Replaces:** 5 old workflows (Pull Worker, Enrichment, Campaign Feeder, Q2H Backfill, EOD Backfill)
- **Features:**
  - 13 nodes (vs 135 in old system) - 90% reduction
  - Autonomous pull + enrich + insert + upload loop
  - Surplus tracking (adjusts next day's pull)
  - Self-healing error recovery
  - Real-time cost tracking
- **Tools:** Supabase MCP, PropertyRadar HTTP, BatchData HTTP, Instantly HTTP, Calculator

#### `02_AI_Instantly_Reply_Handler.json`
- **n8n ID:** `MOtbYjaDYIF4IJwY`
- **Status:** ✅ Active
- **Trigger:** Instantly webhook (email replies)
- **Purpose:** AI handles email replies and triggers phone calls
- **Features:**
  - ALL-MCP architecture (4 MCP servers)
  - Context-aware responses (searches 80-chunk KB)
  - Phone number detection → triggers Barbara calls
  - Atomic SignalWire phone assignment (race-condition safe)
  - Stores 28 variables for personalization
- **Tools:** Supabase MCP, Vector Store MCP, Instantly MCP, VAPI MCP

---

### **Helper Workflows** (Tags: Helper, Equity Connect)

#### `PropertyRadar_Create_Dynamic_List.json`
- **n8n ID:** `9I53ItoKTuhJ6jl4`
- **Status:** Inactive (one-time use)
- **Purpose:** Creates PropertyRadar dynamic lists for new brokers
- **Use:** Run manually when onboarding new broker
- **Creates:** ZIP-based dynamic lists (45k-50k properties per broker)

#### `Vector_Upload_GitHub.json`
- **n8n ID:** `kuDxW8kPndFKXZHP`
- **Status:** Inactive (one-time use)
- **Purpose:** Upload knowledge base chunks to Supabase pgvector
- **Use:** Run once to populate vector_embeddings table
- **Uploads:** 80 searchable chunks (reverse mortgage knowledge)

#### `AI_Work_Week_Activate_Deactivate.json`
- **n8n ID:** `7qu2xXfad7VieVJT`
- **Status:** ✅ Active
- **Schedule:** 
  - Activate: Monday 5:30 AM PT
  - Deactivate: Friday 10:30 PM PT
- **Purpose:** Auto-activates/deactivates AI Daily Lead Puller for work week only
- **Controls:** Workflow `4KYUnVgwQiJhoWYz` (01_AI_Daily_Lead_Puller)

#### `error-handler-dlq-retry.json`
- **n8n ID:** TBD (check if still active)
- **Status:** Check n8n
- **Purpose:** DLQ (Dead Letter Queue) retry handler
- **Use:** Retries failed pipeline events

---

## 📁 Supporting Files

### **AI Prompts** (`/prompts/` - root folder)
- `DailyLeadPullPrompt` - Prompt for AI Daily Lead Puller
- `InstalyReplyPrompt` - Prompt for AI Reply Handler
- `BarbaraVapiPrompt` - System prompt for Barbara VAPI assistant

### **Documentation**
- `AI_ACQUISITION_SQL_REFERENCE.md` - SQL queries used by AI workflows
- `FINAL_WORKFLOW_SUMMARY.md` - Workflow completion summary
- `SESSION_OCT_14_AI_WORKFLOW_COMPLETE.md` - Implementation notes

---

## 🏗️ Architecture: Agentic MCP

**Old System (Deterministic):**
- 135+ nodes per workflow
- Hardcoded logic in every node
- Workflow edits needed for rule changes
- Complex error handling

**New System (Agentic MCP):**
- 13-16 nodes per workflow
- AI makes decisions dynamically
- Rules live in prompts (easy updates)
- Self-healing error recovery
- AI orchestrates external tools via MCP

**Result:** 90% fewer nodes, self-adapting system, 2-3 minute completion

---

## 📊 n8n Integration

### **Tags Used:**
- `Equity Connect` - All production workflows
- `AI` - AI agent workflows (not deterministic)
- `Main` - Primary production workflows
- `Helper` - Utility/one-time workflows

### **Importing Workflows:**
1. Open n8n instance: https://n8n.instaroute.com
2. Go to Workflows
3. Click "Import from File"
4. Select JSON file from this folder
5. Configure credentials if needed
6. Tag with "Equity Connect"

### **Exporting from n8n:**
When you update a workflow in n8n:
```bash
# Use n8n MCP tool to export
# Then save to this folder with exact n8n name
```

---

## 🔄 Workflow Naming Convention

**Local files MUST match n8n workflow names exactly:**
- Use underscores for spaces: `AI_Daily_Lead_Puller`
- Use numbers for ordering: `01_`, `02_`
- Match capitalization exactly

**Format:** `##_Name_With_Underscores.json`

---

## 📈 Current Status

### **Production Workflows:**
- ✅ 01 AI Daily Lead Puller (Active - Mon-Fri 6am)
- ✅ 02 AI Instantly Reply Handler (Active - webhook)
- ✅ AI Work Week Controller (Active - scheduling)

### **Helper Workflows:**
- 📦 PropertyRadar List Creator (Inactive - one-time)
- 📦 Vector Upload GitHub (Inactive - one-time)
- ❓ Error Handler DLQ (Check status)

### **Archived/Replaced:**
All old deterministic workflows archived in n8n:
- PropertyRadar Pull Worker (Idempotent)
- Unified Enrichment (Every 5min)
- Campaign Feeder (Parallel Batch)
- Backfill Checker (Every 2 Hours)
- EOD Backfill (Daily 10pm)

**All replaced by:** `01_AI_Daily_Lead_Puller.json` ✅

---

## 🎯 Key Metrics

**AI Daily Lead Puller:**
- Runtime: 2-3 minutes (vs all-day old system)
- Cost: ~$0.0008/run (Gemini AI)
- Nodes: 13 (vs 135 in old system)
- Success rate: 99%+

**Reply Handler:**
- Response time: <200ms (Instantly timeout-safe)
- KB search: 80 chunks in <1s
- Phone assignment: Atomic (race-condition safe)
- Success rate: 99%+

---

## 📚 Documentation

- **System Overview:** [MASTER_PRODUCTION_PLAN.md](../MASTER_PRODUCTION_PLAN.md)
- **Data Strategy:** [docs/DATA_SOURCING_STRATEGY.md](../docs/DATA_SOURCING_STRATEGY.md)
- **Vector Store Testing:** [docs/VECTOR_STORE_TESTING.md](../docs/VECTOR_STORE_TESTING.md)

---

**Last Synced with n8n:** October 17, 2025  
**n8n Instance:** https://n8n.instaroute.com  
**Active Workflows:** 3 production + 1 scheduler
