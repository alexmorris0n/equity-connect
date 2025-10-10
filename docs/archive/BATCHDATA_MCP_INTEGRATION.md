# BatchData MCP Integration Guide

**Status:** ✅ PRODUCTION DEPLOYED  
**Date:** October 10, 2025  
**Deployment:** Northflank (same project as n8n)

---

## Overview

The BatchData MCP (Model Context Protocol) server is deployed and integrated with n8n to provide AI-powered real estate data access through LangChain agents.

---

## Deployment Details

### Server Endpoints

| Endpoint Type | URL |
|---|---|
| **Base URL** | `https://p01--batchdata-mcp-server--p95wlpxnp2z2.code.run` |
| **SSE Endpoint** (n8n) | `https://p01--batchdata-mcp-server--p95wlpxnp2z2.code.run/sse` |

### Hosting

- **Platform:** Northflank
- **Project:** Same as n8n instance
- **Region:** US (prod)
- **Status:** Active

---

## n8n Workflow Integration

### Workflow URL
`https://n8n.instaroute.com/workflow/HnPhfA6KCq5VjTCy`

### Workflow: BatchData Pull Worker

The workflow (`batchdata-pull-worker.json`) implements the complete BatchData ingestion pipeline using AI agents.

#### Key Components

1. **Cron Trigger**
   - Runs hourly to fetch new property data
   
2. **Define Market Params (Code Node)**
   - Sets market criteria (zip codes, filters, owner-occupied, age, equity)
   - Generates query signature for bookmark tracking
   
3. **Get Bookmark (HTTP Request)**
   - Retrieves last processed page from Supabase
   
4. **BatchData AI Agent (LangChain Agent Node)**
   - **Type:** `@n8n/n8n-nodes-langchain.agent`
   - **Purpose:** Intelligent BatchData query execution
   - **Prompt:** Structured request with market criteria
   - **Connected to:**
     - OpenRouter Chat Model (Gemini 2.5 Flash Lite)
     - MCP Client (BatchData SSE endpoint)

5. **MCP Client Node**
   - **Type:** `@n8n/n8n-nodes-langchain.mcpClientTool`
   - **Endpoint:** `https://p01--batchdata-mcp-server--p95wlpxnp2z2.code.run/sse`
   - **Purpose:** Provides BatchData MCP tools to the AI agent
   - **Connection Type:** Server-Sent Events (SSE)

6. **Processing Pipeline**
   - Extract Vendor IDs
   - Check Stop-When-Known (deduplication)
   - Compute Address Hash
   - Upsert Lead to Supabase
   - Queue for Enrichment
   - Record Source Event
   - Advance Bookmark

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     n8n Workflow                            │
│                                                             │
│  ┌─────────────┐      ┌──────────────────┐                │
│  │ Cron        │─────▶│ Define Market    │                │
│  │ Trigger     │      │ Params           │                │
│  └─────────────┘      └──────────────────┘                │
│                              │                              │
│                              ▼                              │
│                       ┌──────────────────┐                │
│                       │ Get Bookmark     │                │
│                       │ (Supabase)       │                │
│                       └──────────────────┘                │
│                              │                              │
│                              ▼                              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │         BatchData AI Agent (LangChain)              │ │
│  │                                                      │ │
│  │  ┌─────────────────────┐  ┌────────────────────┐  │ │
│  │  │ OpenRouter Model    │  │ MCP Client         │  │ │
│  │  │ (Gemini 2.5)        │  │ (BatchData SSE)    │  │ │
│  │  └─────────────────────┘  └────────────────────┘  │ │
│  └──────────────────────────────────────────────────────┘ │
│                              │                              │
│                              ▼                              │
│                    ┌───────────────────────┐               │
│                    │ Extract Vendor IDs    │               │
│                    │ & Process Records     │               │
│                    └───────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌─────────────────────────────┐
                │      Supabase Database      │
                │   - leads                   │
                │   - pipeline_events         │
                │   - source_bookmarks        │
                └─────────────────────────────┘
```

---

## How It Works

### 1. AI Agent Query Construction

The LangChain agent receives a structured prompt:

```
Fetch properties from BatchData for market: hollywood

Search criteria:
- Zip codes: 90028, 90038, 90046
- Owner occupied: true
- Property type: Single Family
- Age minimum: 62
- Equity minimum: $100,000
- Page: [current_page]
- Per page: 100

Use the BatchData MCP tools to search properties and return the results 
with MAK (Master Address Key) for deduplication.
```

### 2. MCP Tool Execution

The MCP Client exposes BatchData tools to the AI agent:
- Property search by criteria
- Pagination handling
- MAK/APN extraction
- Data formatting

### 3. Data Processing

Results flow through:
- **Deduplication:** Stop-when-known check (have we seen these vendor IDs before?)
- **Address Hashing:** SHA-256 hash for MAK/APN/address components
- **Upsert:** Merge into `leads` table
- **Enrichment Queue:** Add to `pipeline_events` for waterfall enrichment
- **Bookmark Update:** Track progress for incremental pulls

---

## Configuration

### Environment Variables (n8n)

```bash
# BatchData MCP
BATCHDATA_MCP_URL=https://p01--batchdata-mcp-server--p95wlpxnp2z2.code.run
BATCHDATA_MCP_SSE=https://p01--batchdata-mcp-server--p95wlpxnp2z2.code.run/sse

# OpenRouter (for AI model)
OPENROUTER_API_KEY=<your-key>

# Supabase
SUPABASE_URL=<your-supabase-url>
SUPABASE_KEY=<your-service-role-key>
```

### n8n Credentials Required

1. **OpenRouter API** - For Gemini 2.5 Flash Lite model
2. **Supabase API** - For database access
3. **MCP Client** - SSE endpoint (no auth required if internal)

---

## Market Parameters

Current configuration (Hollywood market example):

```javascript
{
  market: 'hollywood',
  zip_codes: ['90028', '90038', '90046'],
  filters: {
    owner_occupied: true,
    property_type: 'single_family',
    age_min: 62,
    equity_min: 100000
  },
  page_size: 100
}
```

To add new markets, duplicate the "Define Market Params" node and adjust criteria.

---

## Deduplication Strategy

Three-tier deduplication (from PRODUCTION_PLAN.md):

1. **MAK (Master Address Key)** - BatchData's unique property ID
2. **APN (Assessor Parcel Number)** - County identifier
3. **addr_hash** - SHA-256 hash of normalized address

```sql
-- Unique constraints
CREATE UNIQUE INDEX leads_mak_uniq ON leads (mak) WHERE mak IS NOT NULL;
CREATE UNIQUE INDEX leads_apn_uniq ON leads (apn) WHERE apn IS NOT NULL;
CREATE UNIQUE INDEX leads_addr_hash_uniq ON leads (addr_hash);
```

---

## Stop-When-Known Logic

Prevents redundant API calls by checking if vendor IDs have been seen before:

```javascript
// Check if vendor IDs exist in database
const vendorIds = records.map(r => r.id);
const seen = await supabase.rpc('has_vendor_ids_been_seen', { 
  vendor_ids: vendorIds 
});

if (seen) {
  console.log('Stop-when-known triggered: IDs already seen');
  return { status: 'stopped', reason: 'caught_up' };
}
```

---

## Monitoring & Logging

### Success Metrics

- Records fetched per run
- Deduplication hit rate
- Stop-when-known trigger rate
- Processing time per batch

### Error Handling

- Invalid MCP responses → Log to DLQ
- Network timeouts → Retry with exponential backoff
- Bookmark failures → Alert and pause workflow

### Logs Location

- **n8n Execution Logs:** https://n8n.instaroute.com/workflow/HnPhfA6KCq5VjTCy/executions
- **Northflank Logs:** BatchData MCP server container logs

---

## Testing

### Manual Test

1. Open n8n workflow: https://n8n.instaroute.com/workflow/HnPhfA6KCq5VjTCy
2. Click "Execute Workflow" (top right)
3. Watch execution flow through nodes
4. Verify records appear in Supabase `leads` table

### MCP Health Check

```bash
curl https://p01--batchdata-mcp-server--p95wlpxnp2z2.code.run/health
# Expected: 200 OK with status JSON
```

### SSE Connection Test

```bash
curl -N -H "Accept: text/event-stream" \
  https://p01--batchdata-mcp-server--p95wlpxnp2z2.code.run/sse
# Expected: SSE stream with MCP protocol messages
```

---

## Troubleshooting

### Issue: AI Agent Timeout

**Cause:** BatchData API slow response or large result set  
**Fix:** 
- Reduce `page_size` in market params (e.g., 50 instead of 100)
- Increase n8n workflow timeout setting
- Check Northflank MCP server logs for errors

### Issue: MCP Connection Refused

**Cause:** Northflank deployment down or SSE endpoint misconfigured  
**Fix:**
- Check Northflank service status
- Verify SSE endpoint URL in MCP Client node
- Test base URL health endpoint

### Issue: Duplicate Records Despite Deduplication

**Cause:** Missing MAK/APN/addr_hash in BatchData response  
**Fix:**
- Check "Compute Addr Hash" node logic
- Verify BatchData MCP returns MAK field
- Review Supabase unique constraint violations

### Issue: Stop-When-Known Not Triggering

**Cause:** `has_vendor_ids_been_seen` function not matching IDs  
**Fix:**
- Verify vendor ID format consistency
- Check `lead_source_events` table has records
- Review bookmark query signature generation

---

## Production Checklist

- [x] BatchData MCP deployed to Northflank
- [x] SSE endpoint accessible from n8n
- [x] n8n workflow created and tested
- [x] OpenRouter credentials configured
- [x] Supabase functions deployed (`has_vendor_ids_been_seen`, `upsert_lead`)
- [x] Deduplication constraints applied
- [x] Bookmark tracking implemented
- [ ] Production market parameters finalized (currently Hollywood test market)
- [ ] Alerting configured for workflow failures
- [ ] Rate limits tested (BatchData API + OpenRouter)
- [ ] Monitoring dashboard created

---

## Next Steps

1. **Add More Markets:** Expand beyond Hollywood test market
2. **Scale Testing:** Verify hourly cron doesn't overwhelm BatchData API
3. **Cost Monitoring:** Track OpenRouter API usage (Gemini 2.5 Flash Lite)
4. **Enrichment Pipeline:** Connect to waterfall enrichment workflow
5. **Persona Assignment:** Integrate with AI persona classification

---

## Related Documentation

- [PRODUCTION_PLAN.md](./PRODUCTION_PLAN.md) - Overall system architecture
- [BATCHDATA_FIRST_WATERFALL.md](./BATCHDATA_FIRST_WATERFALL.md) - Data flow strategy
- [N8N_WORKFLOW_SETUP.md](./N8N_WORKFLOW_SETUP.md) - General n8n configuration
- [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) - Supabase schema

---

## Support

- **n8n Instance:** https://n8n.instaroute.com
- **Workflow:** https://n8n.instaroute.com/workflow/HnPhfA6KCq5VjTCy
- **MCP Server:** https://p01--batchdata-mcp-server--p95wlpxnp2z2.code.run
- **Northflank Console:** https://app.northflank.com

