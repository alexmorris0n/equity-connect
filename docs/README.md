# Equity Connect Documentation

**Last Updated:** October 20, 2025

---

## 📖 Start Here

**New to the project?** Read these in order:

1. **[MASTER_PRODUCTION_PLAN.md](MASTER_PRODUCTION_PLAN.md)** - Complete system overview
2. **[WEEKEND_ROADMAP.md](WEEKEND_ROADMAP.md)** - Current implementation tasks (Sat/Sun/Mon)
3. **[COMPLIANCE_SIMPLE_GUIDE.md](COMPLIANCE_SIMPLE_GUIDE.md)** - Email vs phone call rules

---

## 📁 Documentation by Category

### 🚀 Current Implementation (Active Development)

**PropertyRadar Workflows:**
- [PROPERTYRADAR_PULL_WORKFLOW_FINAL.md](PROPERTYRADAR_PULL_WORKFLOW_FINAL.md) - Daily lead pull (17 nodes, WORKING)
- [PROPERTYRADAR_LIST_CREATION_GUIDE.md](PROPERTYRADAR_LIST_CREATION_GUIDE.md) - How to create dynamic lists
- [PROPERTYRADAR_INTEGRATION.md](PROPERTYRADAR_INTEGRATION.md) - API reference

**Compliance & Legal:**
- [COMPLIANCE_SIMPLE_GUIDE.md](COMPLIANCE_SIMPLE_GUIDE.md) - Email vs calls cheat sheet
- [COMPLIANCE_FRAMEWORK.md](COMPLIANCE_FRAMEWORK.md) - Full compliance details
- [CONSENT_MANAGEMENT_GUIDE.md](CONSENT_MANAGEMENT_GUIDE.md) - TCPA consent for phone calls

**Voice System (SignalWire + OpenAI Realtime):**
- [../bridge/README.md](../bridge/README.md) - ⭐ **Production voice bridge (OpenAI Realtime + SignalWire)**
- [../barbara-mcp/README.md](../barbara-mcp/README.md) - Barbara MCP server for n8n
- [SIGNALWIRE_PHONE_POOL_GUIDE.md](SIGNALWIRE_PHONE_POOL_GUIDE.md) - Phone number pool management
- [SIGNALWIRE_INTEGRATION_GUIDE.md](SIGNALWIRE_INTEGRATION_GUIDE.md) - SignalWire PSTN setup

**Campaign Setup:**
- [INSTANTLY_CONSENT_INTEGRATION.md](INSTANTLY_CONSENT_INTEGRATION.md) - Cold email campaign guide

---

### 🏗️ System Architecture

- [MASTER_PRODUCTION_PLAN.md](MASTER_PRODUCTION_PLAN.md) - **START HERE** - Complete system
- [ARCHITECTURE_VISUAL_GUIDE.md](ARCHITECTURE_VISUAL_GUIDE.md) - Visual diagrams
- [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) - Database schema details
- [BROKER_SELF_SERVICE_ARCHITECTURE.md](BROKER_SELF_SERVICE_ARCHITECTURE.md) - Vercel UI design

---

### 🔧 Integration Guides

**Voice & Appointments:**
- [../bridge/README.md](../bridge/README.md) - Voice bridge deployment (OpenAI Realtime)
- [../barbara-mcp/README.md](../barbara-mcp/README.md) - Barbara MCP for n8n integration
- [SIGNALWIRE_INTEGRATION_GUIDE.md](SIGNALWIRE_INTEGRATION_GUIDE.md) - SignalWire phone setup

**Data & Enrichment:**
- [DATA_SOURCING_WATERFALL_STRATEGY.md](DATA_SOURCING_WATERFALL_STRATEGY.md) - Enrichment waterfall strategy
- [MULTI_PROVIDER_SKIP_TRACE_GUIDE.md](MULTI_PROVIDER_SKIP_TRACE_GUIDE.md) - Skip-trace provider routing

**Admin & UI:**
- [VERCEL_BROKER_SETUP_INTEGRATION.md](VERCEL_BROKER_SETUP_INTEGRATION.md) - Vercel UI integration
- [BROKER_ACQUISITION_GUIDE.md](BROKER_ACQUISITION_GUIDE.md) - Broker onboarding
- [PROPERTYRADAR_BROKER_DASHBOARD.md](PROPERTYRADAR_BROKER_DASHBOARD.md) - Dashboard specs

---

### 📋 Operations & Deployment

- [PRODUCTION_IMPLEMENTATION_CHECKLIST.md](PRODUCTION_IMPLEMENTATION_CHECKLIST.md) - Deployment steps
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Infrastructure deployment
- [DEPLOYMENT_INFRASTRUCTURE.md](DEPLOYMENT_INFRASTRUCTURE.md) - Platform details
- [TESTING_QA_FRAMEWORK.md](TESTING_QA_FRAMEWORK.md) - Testing strategy

---

### 💰 Business & Pricing

- [PRICING_STRUCTURE.md](PRICING_STRUCTURE.md) - Broker pricing models
- [BROKER_PRICING_PROPOSAL.md](BROKER_PRICING_PROPOSAL.md) - Pricing proposal templates
- [WATERFALL_REVENUE_IMPLEMENTATION.md](WATERFALL_REVENUE_IMPLEMENTATION.md) - Revenue model
- [BATCHDATA_COST_ANALYSIS.md](BATCHDATA_COST_ANALYSIS.md) - Data sourcing cost comparison

---

### 📦 Technical Reference

**Database:**
- [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) - Schema, indexes, RLS
- [SUPABASE_IMPLEMENTATION_GUIDE.md](SUPABASE_IMPLEMENTATION_GUIDE.md) - Supabase setup
- [N8N_TABLES_SETUP_GUIDE.md](N8N_TABLES_SETUP_GUIDE.md) - Pipeline tables

**Workflows:**
- [N8N_WORKFLOW_SETUP.md](N8N_WORKFLOW_SETUP.md) - n8n configuration
- [HMAC_VERIFICATION_GUIDE.md](HMAC_VERIFICATION_GUIDE.md) - Secure upload implementation

**Communications:**
- [PHONE_NUMBER_MANAGEMENT_GUIDE.md](PHONE_NUMBER_MANAGEMENT_GUIDE.md) - SignalWire pool management
- [ZAPMAIL_MAILBOX_CONFIGURATION.md](ZAPMAIL_MAILBOX_CONFIGURATION.md) - Email mailbox setup

---

### 📚 Archive (Historical Reference Only)

**Old Implementations:**
- [archive/BATCHDATA_MCP_INTEGRATION.md](archive/BATCHDATA_MCP_INTEGRATION.md) - BatchData approach (replaced)
- [archive/ATTOM_API_MIGRATION.md](archive/ATTOM_API_MIGRATION.md) - ATTOM approach (not used)
- [archive/PHASE_1_COMPLETE.md](archive/PHASE_1_COMPLETE.md) - Old phase completion
- [archive/PHASE_2_COMPLETE.md](archive/PHASE_2_COMPLETE.md) - Old phase completion

**Old Summaries:**
- [archive/PROPERTYRADAR_LIST_SETUP_GUIDE.md](archive/PROPERTYRADAR_LIST_SETUP_GUIDE.md)
- [archive/PROPERTYRADAR_LIST_WORKFLOW_SUMMARY.md](archive/PROPERTYRADAR_LIST_WORKFLOW_SUMMARY.md)
- [archive/COMPLETE_IMPLEMENTATION_SUMMARY.md](archive/COMPLETE_IMPLEMENTATION_SUMMARY.md)

---

## 🎯 Common Tasks

### I Want To...

**Understand the whole system:**
→ Read [MASTER_PRODUCTION_PLAN.md](MASTER_PRODUCTION_PLAN.md)

**Build this weekend's features:**
→ Read [WEEKEND_ROADMAP.md](WEEKEND_ROADMAP.md)

**Understand compliance (email vs calls):**
→ Read [COMPLIANCE_SIMPLE_GUIDE.md](COMPLIANCE_SIMPLE_GUIDE.md)

**Debug the PropertyRadar pull workflow:**
→ Read [PROPERTYRADAR_PULL_WORKFLOW_FINAL.md](PROPERTYRADAR_PULL_WORKFLOW_FINAL.md)

**Set up Instantly campaigns:**
→ Read [INSTANTLY_CONSENT_INTEGRATION.md](INSTANTLY_CONSENT_INTEGRATION.md)

**Build voice calling:**
→ Read [../bridge/README.md](../bridge/README.md)

**Deploy to production:**
→ Read [PRODUCTION_IMPLEMENTATION_CHECKLIST.md](PRODUCTION_IMPLEMENTATION_CHECKLIST.md)

---

## 🗑️ Cleanup History

**October 20, 2025:**
- ✅ Replaced VAPI with custom OpenAI Realtime bridge (92% cost reduction)
- ✅ Archived all VAPI configs and documentation to `config/archived/` and `docs/archived/`
- ✅ Moved historical summaries and completed task docs to `docs/archived/`
- ✅ Updated documentation to reflect bridge system

**October 11, 2025:**
- Archived 15 redundant/outdated docs to `archive/`
- Deleted 9 obsolete interim docs
- Created `MASTER_PRODUCTION_PLAN.md` as single source of truth
- Fixed compliance misunderstandings in Instantly and Consent guides
- Consolidated PropertyRadar documentation

**See:** [archived/README.md](archived/README.md) for full archive list

---

**Keep documentation up to date as you build!**

