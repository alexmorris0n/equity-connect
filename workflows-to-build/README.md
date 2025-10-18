# Workflows To Build - Test & Utility Workflows

This folder contains **test and utility workflows** for the Equity Connect platform. Most planned workflows were replaced by the agentic MCP architecture (see `/workflows/` for production workflows).

---

## 📁 Current Contents

### `test-instantly-mcp.json`
- **Purpose:** Test the Instantly MCP server integration
- **Type:** Testing utility
- **Use:** Verify Instantly MCP is working before deploying reply handler
- **Status:** Available for testing

---

## 🎯 What Happened to the Other Workflows?

### ✅ Replaced by Agentic Architecture

Most workflows planned for this folder were **replaced by AI agents with MCP tools**:

1. **AI Voice Call Workflow** → Replaced by:
   - Barbara VAPI assistant (configured)
   - Reply handler MCP integration (triggers calls with 28 variables)
   - SignalWire phone pool (atomic assignment)

2. **Call Outcome Processing** → Will be replaced by:
   - VAPI webhook → AI agent (when needed)
   - Agentic decision-making (not deterministic nodes)

3. **Consent Processing** → Replaced by:
   - Reply handler detects phone numbers
   - Auto-stores consent when phone provided
   - No standalone form needed

4. **Broker Acquisition** → Premature
   - Will build custom broker portal when scaling to 100 brokers
   - Not needed for current single-broker operation

5. **Rework Funnel** → Premature
   - Build re-engagement campaigns later if needed
   - Will use agentic approach (not deterministic)

---

## 🚀 Production Workflows

Active workflows are in `/workflows/`:

### **Core Production Workflows:**
1. ✅ `AI_Daily_Lead_Pull.json` - AI orchestrates entire acquisition pipeline (13 nodes, replaces 5 workflows)
2. ✅ `instantly-reply-handler-ALL-MCP.json` - AI handles email replies, triggers calls (4 MCP servers)
3. ✅ `error-handler-dlq-retry.json` - DLQ retry handler
4. ✅ `propertyradar-broker-setup-webhook.json` - Helper for list creation
5. ✅ `propertyradar-create-list-helper.json` - PropertyRadar list management

### **Utility Workflows:**
6. ✅ `kb-vector-upload-utility.json` - One-time KB upload to vector store (moved from this folder)

---

## 📚 Documentation

- **Production Status:** [MASTER_PRODUCTION_PLAN.md](../MASTER_PRODUCTION_PLAN.md)
- **Vector Store Testing:** [docs/VECTOR_STORE_TESTING.md](../docs/VECTOR_STORE_TESTING.md)
- **Workflow Details:** [workflows/README.md](../workflows/README.md)

---

## 💡 Architecture Philosophy

**Why We Replaced Workflows with AI Agents:**

### Before (Deterministic):
- 135+ nodes for lead acquisition
- Hardcoded logic in every node
- Needed workflow edits for any rule change
- Complex error handling
- Brittle integrations

### After (Agentic MCP):
- 13 nodes for lead acquisition
- AI makes decisions dynamically
- Rules live in prompts (easy to change)
- Self-healing error recovery
- AI orchestrates external tools via MCP

**Result:** 90% fewer nodes, 2-3 minute completion vs all-day, self-adapting system.

---

## 🔮 Future Workflows

When we need new functionality, we'll build it **agentic-first**:

### Example: VAPI Call Outcome Handler (when needed)
Instead of 50+ deterministic nodes, we'll build:
- Webhook trigger (1 node)
- AI Agent with MCP tools (1 node)
- Error handler (1 node)

The AI will:
- Analyze call sentiment
- Extract appointment details
- Update database
- Decide next actions
- Route to appropriate workflow

**Total:** ~3 nodes vs 50+ in old approach

---

## 📋 Migration Notes

If you find old workflow files in git history:
- They're not obsolete, they're **replaced by better architecture**
- Don't try to "fix" them - the agentic versions are superior
- Check [MASTER_PRODUCTION_PLAN.md](../MASTER_PRODUCTION_PLAN.md) for current implementation

---

**Last Updated:** October 17, 2025  
**Architecture:** Agentic MCP (Model Context Protocol)  
**Status:** Test utilities only - production workflows in `/workflows/`
