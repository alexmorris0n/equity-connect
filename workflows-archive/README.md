# Archived Workflows

This folder contains deprecated workflows that have been replaced by the BatchData-First architecture implemented in October 2025.

## Deprecated Workflows

### Data Ingestion & Enrichment
- **`propstream-supabase-workflow.json`** - Old PropStream integration
  - **Replaced by:** `batchdata-pull-worker.json` (BatchData MCP integration)
  - **Reason:** Migrated from PropStream to BatchData for better MAK deduplication and MCP support

- **`batchdata-dedup-workflow.json`** - Legacy BatchData deduplication
  - **Replaced by:** Idempotent logic in `batchdata-pull-worker.json`
  - **Reason:** Deduplication now handled inline with stop-when-known pagination

- **`skip-trace-router-workflow.json`** - Old skip-trace routing logic
  - **Replaced by:** `enrichment-pipeline-waterfall.json`
  - **Reason:** New BatchData→Melissa waterfall architecture with MCP

### Error Handling
- **`error-handling-monitoring.json`** - Original error handler
  - **Replaced by:** `error-handler-dlq-retry.json` (v2)
  - **Reason:** Improved DLQ retry logic with stage detection

### Legacy Features (Not Part of Current Architecture)
- **`ai-voice-call-workflow.json`** - AI voice calling system
- **`broker-acquisition-workflow.json`** - Broker onboarding
- **`call-outcome-processing-workflow.json`** - Call results processing
- **`callrail-verification-workflow.json`** - CallRail integration
- **`consent-processing-workflow.json`** - Consent management
- **`consent-token-generation-workflow.json`** - Consent token generation
- **`rework-funnel-workflow.json`** - Legacy funnel management

## Current Active Workflows (as of 2025-10-09)

Located in `/workflows/`:

1. **`batchdata-pull-worker.json`** - Hourly property pull from BatchData with MCP integration
2. **`enrichment-pipeline-waterfall.json`** - BatchData→Melissa waterfall skip-trace (every 5 min)
3. **`campaign-feeder-daily.json`** - Daily campaign feed to Instantly with AI persona assignment
4. **`error-handler-dlq-retry.json`** - DLQ retry handler (every 5 min)

## Restoration

If you need to restore any of these workflows:

```bash
# Copy from archive back to workflows folder
cp workflows-archive/[workflow-name].json workflows/

# Import to n8n via MCP or manual upload
```

## Notes

- All archived workflows are preserved for reference and potential future use
- Do not delete this folder without team review
- Last archived: 2025-10-09
- Architecture change: PropStream + Melissa-First → BatchData MCP + BatchData-First Waterfall

