# Equity Connect

**AI-Powered Lead Generation Platform for Reverse Mortgage Brokers**

Equity Connect uses AI agents to autonomously pull qualified property leads, enrich them with contact data, and manage compliant multi-channel outreach campaigns. Built with Model Context Protocol (MCP) architecture, replacing 135+ deterministic workflow nodes with 13 intelligent nodes.

## 🎯 What It Does

- **Daily Lead Acquisition:** AI orchestrates PropertyRadar → enrichment → database → campaign upload
- **Intelligent Reply Handling:** AI responds to email replies, searches knowledge base, triggers phone calls
- **Voice Outreach:** Barbara AI assistant handles consultative sales calls with seniors
- **Phone Pool Management:** Dynamic SignalWire number assignment with race-condition protection
- **Multi-Broker Support:** Scales to 100+ brokers with per-broker territories and capacity

## 🛠 Tech Stack

- **AI:** Gemini 2.5 Flash via OpenRouter (orchestration)
- **Workflows:** n8n (self-hosted)
- **Database:** Supabase (PostgreSQL + pgvector)
- **Data:** PropertyRadar API (property + contact enrichment)
- **Email:** Instantly.ai (cold outreach)
- **Voice:** VAPI.ai + SignalWire (AI phone calls)
- **MCP Servers:** Supabase, Instantly, VAPI (AI tool integration)

## 📊 Current Status

**Production Ready ✅** (October 2025)

- ✅ AI Daily Lead Pull (6am PT Mon-Fri)
- ✅ Instantly Reply Handler (email + phone detection)
- ✅ Barbara Voice Assistant (VAPI + SignalWire)
- ✅ SignalWire Phone Pool (5 numbers, atomic assignment)
- ✅ Vector Knowledge Base (80 chunks, compliance-approved)
- 🚧 Broker Portal (planned - custom build, not GoHighLevel)

**See [MASTER_PRODUCTION_PLAN.md](MASTER_PRODUCTION_PLAN.md) for complete details.**

## 💰 Economics

**Per Broker (100 leads/day):**
- Monthly cost: $133 (PropertyRadar + enrichment)
- Monthly revenue: $6,160 (0.8 shows/day × $350)
- Monthly profit: **$6,027** (97.8% margin)

**At 100 Brokers:**
- Monthly profit: **$602,700**
- Annual profit: **$7.2M**

## 🗂 Repository Structure

```
equity-connect/
├── MASTER_PRODUCTION_PLAN.md          # 📘 Single source of truth
├── README.MD                          # This file - project overview
├── prompts/                           # AI prompts for all workflows
│   ├── BarbaraVapiPrompt             # VAPI assistant system prompt
│   ├── DailyLeadPullPrompt           # Daily lead acquisition
│   └── InstalyReplyPrompt            # Email reply handler
├── workflows/                         # n8n workflow JSON files
│   ├── 01_AI_Daily_Lead_Puller.json
│   ├── 02_AI_Instantly_Reply_Handler.json
│   └── AI_Work_Week_Activate_Deactivate.json
├── database/                          # Supabase migrations & functions
│   ├── migrations/                    # SQL migration files
│   ├── functions/                     # PostgreSQL functions
│   └── schema/                        # Schema documentation
├── config/                            # API configs & environment templates
├── docs/                              # Technical documentation
└── scripts/                           # Helper scripts & utilities
```

## 🚀 Quick Start

### For New Team Members

1. **Read the plan:** Start with [MASTER_PRODUCTION_PLAN.md](MASTER_PRODUCTION_PLAN.md)
2. **Understand the workflows:** Review `/workflows/README.md`
3. **Set up environment:**
   ```bash
   cp config/environment-template.txt .env
   # Fill in your API keys
   ```
4. **Deploy database:**
   ```bash
   # Run migrations in database/migrations/ via Supabase dashboard
   ```
5. **Import workflows:** Load JSON files from `/workflows/` into n8n

### For Brokers

Contact us to get onboarded. We'll create:
- PropertyRadar dynamic list (your ZIP code territories)
- Instantly email inboxes (matching your market demographics)
- SignalWire phone numbers (local presence)
- Custom campaign archetypes (3 data-driven angles)

## 📚 Documentation

- **[MASTER_PRODUCTION_PLAN.md](MASTER_PRODUCTION_PLAN.md)** - Complete system overview & status
- **[docs/](docs/)** - Technical guides (database, compliance, integrations)
- **[workflows/README.md](workflows/README.md)** - Workflow documentation

## 🔐 Compliance

- **Email (CAN-SPAM):** Unsubscribe links, physical address (Instantly handles)
- **Phone (TCPA):** Consent required before calling, DNC registry checks
- **AI Disclosure:** Barbara identifies as "scheduling assistant" (compliant)
- **No Lead Profiling:** 3 campaign archetypes based on property/financial data only

## 📞 Key Features

### AI Daily Lead Acquisition
- Replaces 5 manual workflows with 1 AI-orchestrated flow
- 90% fewer nodes (13 vs 135)
- Completes in 2-3 minutes (vs all-day)
- Self-healing error recovery
- Real-time cost tracking

### Reply Handler
- Instant 200 OK response (no Instantly timeouts)
- Searches 80-chunk knowledge base for accurate answers
- Detects phone numbers, triggers Barbara calls
- Atomic phone assignment from SignalWire pool

### Barbara Voice Assistant
- GPT-4o powered, ElevenLabs voice
- 28 variables for full personalization
- Consultative selling (emotion first, numbers second)
- KB-powered (never hallucinates fees/rules)
- Handles objections, schedules appointments

## 💡 Key Innovation: MCP Architecture

**Before:** 135 deterministic n8n nodes with hardcoded logic
**After:** 13 nodes + AI agent that orchestrates external tools

The AI can:
- Query databases dynamically
- Make decisions based on data
- Search knowledge bases
- Send emails with context
- Trigger phone calls with full lead history

This means the system is **self-adapting** - no workflow edits needed when rules change.

## 🤝 Contributing

This is a production system. Changes require:
1. Testing in n8n development environment
2. Database migrations via proper SQL files
3. Documentation updates in MASTER_PRODUCTION_PLAN.md
4. No ethnic profiling or demographic-based lead segmentation

## 📊 Monitoring

See [MASTER_PRODUCTION_PLAN.md - Monitoring & Observability](MASTER_PRODUCTION_PLAN.md#-monitoring--observability) for:
- Key metrics to track
- Success criteria
- Performance targets
- Cost per lead benchmarks

---

**Status:** Production Ready ✅  
**Last Updated:** October 17, 2025  
**Current Phase:** Phone Pool System Complete - scales to 100+ brokers

For questions or onboarding, see [MASTER_PRODUCTION_PLAN.md](MASTER_PRODUCTION_PLAN.md) for complete details.
