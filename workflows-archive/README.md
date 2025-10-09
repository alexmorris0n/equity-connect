# Archived Workflows

This folder contains workflows that have been **replaced** by the BatchData-First architecture implemented in October 2025.

## ⚠️ Important: These Are REPLACED Workflows Only

This archive only contains workflows that we **replaced with better versions**, not workflows we plan to use in the future.

## Archived (Replaced) Workflows

### Data Ingestion & Enrichment - REPLACED
- **`propstream-supabase-workflow.json`** ❌ REPLACED
  - **Replaced by:** `batchdata-pull-worker.json` (BatchData MCP integration)
  - **Reason:** Migrated from PropStream to BatchData for better MAK deduplication and MCP support
  - **Status:** Do not use - superseded

- **`batchdata-dedup-workflow.json`** ❌ REPLACED
  - **Replaced by:** Idempotent logic in `batchdata-pull-worker.json`
  - **Reason:** Deduplication now handled inline with stop-when-known pagination
  - **Status:** Do not use - superseded

- **`skip-trace-router-workflow.json`** ❌ REPLACED
  - **Replaced by:** `enrichment-pipeline-waterfall.json`
  - **Reason:** New BatchData→Melissa waterfall architecture with MCP
  - **Status:** Do not use - superseded

### Error Handling - REPLACED
- **`error-handling-monitoring.json`** ❌ REPLACED
  - **Replaced by:** `error-handler-dlq-retry.json` (v2)
  - **Reason:** Improved DLQ retry logic with stage detection
  - **Status:** Do not use - superseded

### Call Tracking - REPLACED
- **`callrail-verification-workflow.json`** ❌ REPLACED
  - **Replaced by:** SignalWire integration (call pool management)
  - **Reason:** SignalWire is more cost-effective and integrates better with n8n/Supabase
  - **Status:** Do not use - migrated to SignalWire

---

## Current Active Workflows (Production)

Located in `/workflows/`:

### Core Pipeline (Active Now)
1. **`batchdata-pull-worker.json`** ✅ - Hourly property pull from BatchData with MCP
2. **`enrichment-pipeline-waterfall.json`** ✅ - BatchData→Melissa waterfall skip-trace (every 5 min)
3. **`campaign-feeder-daily.json`** ✅ - Daily campaign feed to Instantly with AI persona assignment
4. **`error-handler-dlq-retry.json`** ✅ - DLQ retry handler (every 5 min)

### Future Workflows (Not Yet Implemented)
5. **`ai-voice-call-workflow.json`** 🔜 - AI voice calling (Phase 3)
6. **`broker-acquisition-workflow.json`** 🔜 - Broker onboarding (Phase 4)
7. **`call-outcome-processing-workflow.json`** 🔜 - Call results processing (Phase 3)
8. **`callrail-verification-workflow.json`** 🔜 - CallRail integration (Phase 3)
9. **`consent-processing-workflow.json`** 🔜 - Consent management (Phase 2)
10. **`consent-token-generation-workflow.json`** 🔜 - Consent tokens (Phase 2)
11. **`rework-funnel-workflow.json`** 🔜 - Funnel management (Phase 4)

---

## Restoration

If you need to restore any archived workflow for reference:

```bash
# Copy from archive back to workflows folder
cp workflows-archive/[workflow-name].json workflows/

# Import to n8n via MCP or manual upload (if testing old approach)
```

## Notes

- **Only replaced workflows are archived here**
- Future-use workflows remain in `/workflows/` 
- Do not delete this folder without team review
- Last archived: 2025-10-09
- Architecture change: PropStream + Melissa-First → BatchData MCP + BatchData-First Waterfall

---

## Summary

**Archived (4):** Old implementations we replaced  
**Active (4):** Current production workflows  
**Future (7):** Workflows we'll implement in later phases
