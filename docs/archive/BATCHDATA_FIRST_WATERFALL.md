# BatchData-First Waterfall Skip-Trace Architecture

## Overview

This system implements a **cost-optimized, BatchData-first waterfall enrichment** strategy using MCP (Model Context Protocol) integration with n8n workflows.

## Architecture Philosophy

**Key Decision:** BatchData MCP handles **both** property pulling AND first-hop skip-trace enrichment, with Melissa as a fallback for gaps only.

### Why BatchData First?

1. **Ecosystem Consistency** - Same vendor for property + contact data = consistent schemas, fewer transforms
2. **Cost Efficiency** - BatchData appends contact info during initial pull, Melissa only fills gaps
3. **MCP Native** - No HTTP nodes needed for BatchData operations, fully AI-powered
4. **MAK Deduplication** - Master Address Key tracking prevents repaying for same properties

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1: BatchData Pull + Skip-Trace (via MCP)            │
│  - Property search (zip codes, filters, pagination)         │
│  - Contact append (phones, emails, verification status)     │
│  - MAK tracking (master address key deduplication)          │
│  - Suppression table updates (md5 hashes)                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  GAP DETECTION: View mv_needs_melissa                       │
│  - Filters leads with no primary_phone AND no primary_email │
│  - Excludes leads tried by Melissa in last 14 days         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  STAGE 2: Melissa Fallback Enrichment (HTTP API)           │
│  - Personator/ContactVerify API                             │
│  - Only processes gaps from Stage 1                         │
│  - Merges into existing contact_points JSONB               │
│  - Updates last_melissa_try_at timestamp                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  FINAL SCORING & ROUTING                                    │
│  - compute_quality_score RPC (0-100)                        │
│  - Campaign eligibility (score >= 60)                       │
│  - Broker assignment via AI Agent + personas table          │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Columns on `leads` Table

```sql
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS primary_phone TEXT,
  ADD COLUMN IF NOT EXISTS primary_email TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enriched_by TEXT,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_melissa_try_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS batchdata_property_id TEXT;
```

### Suppression Table

```sql
CREATE TABLE suppression_contacts (
  hash TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT,
  contact_type TEXT CHECK (contact_type IN ('phone', 'email'))
);
```

**Purpose:** Prevent repaying for same contacts across campaigns/zips using MD5 hashes of normalized values.

### Gap Detection View

```sql
CREATE OR REPLACE VIEW mv_needs_melissa AS
SELECT 
  id, 
  first_name,
  last_name,
  address_line1, 
  property_city, 
  property_state, 
  property_zip, 
  apn
FROM leads
WHERE (COALESCE(primary_phone, '') = '' AND COALESCE(primary_email, '') = '')
  AND source = 'batchdata'
  AND (last_melissa_try_at IS NULL OR last_melissa_try_at < NOW() - INTERVAL '14 days');
```

---

## n8n Workflows

### 1. BatchData Pull Worker (Idempotent)

**File:** `workflows/batchdata-pull-worker.json`

**Trigger:** Cron (hourly)

**Flow:**
1. **Define Market Params** (Code) - Set zip codes, filters, page size
2. **Get Bookmark** (RPC) - Fetch last pagination state
3. **BatchData AI Agent** (MCP) - Intelligent property search
4. **Extract Vendor IDs** (Code) - Parse response
5. **Check Stop-When-Known** (RPC) - Detect if we've seen these IDs before
6. **IF Seen Before?** (IF) - Stop if caught up, else continue
7. **Split In Batches** (Loop) - Process records one by one
8. **Compute Addr Hash** (Code) - SHA256 for deduplication
9. **Upsert Lead** (RPC) - Insert/update lead record
10. **BatchData Skip Trace (Stage 1)** (AI Agent + MCP) - Enrich contacts
11. **Parse Skip Trace Results** (Code) - Extract best phone/email
12. **Update Lead Contacts** (Supabase) - Save primary_phone/email
13. **Prep Suppression Entries** (Code) - Create MD5 hashes
14. **Upsert Suppression** (Supabase) - Track contacts globally
15. **Queue for Enrichment** (Supabase) - Add to pipeline_events
16. **Loop Check** - Continue batching
17. **Record Source Event** (Supabase) - Log pull event
18. **Advance Bookmark** (Supabase) - Update pagination cursor
19. **Log Completion** (Code) - Output success message

**Key Features:**
- **Idempotent** - Stop-when-known pagination prevents reprocessing
- **MAK Tracking** - Master Address Key from BatchData prevents duplicates
- **MCP-Powered** - AI Agent with Groq + BatchData MCP Tool
- **Suppression** - Global contact deduplication via MD5 hashes

### 2. Enrichment Pipeline (BatchData → Melissa Waterfall)

**File:** `workflows/enrichment-pipeline-waterfall.json`

**Trigger:** Cron (every 5 minutes)

**Flow:**
1. **Every 5 Minutes** (Cron)
2. **Get Melissa Queue** (Supabase) - Query `mv_needs_melissa` view
3. **Split Leads** (Loop)
4. **Prep Melissa** (Code) - Format API request
5. **Melissa API (Stage 2 Fallback)** (HTTP) - Call Personator
6. **Parse Melissa** (Code) - Extract contacts
7. **Prep Merge Contacts** (Code) - Format for RPC
8. **Split Contacts** (Loop)
9. **Merge Contact** (RPC) - Upsert into JSONB arrays
10. **Compute Final Score** (RPC) - Calculate quality_score
11. **Update Melissa Timestamp** (Supabase) - Set last_melissa_try_at

**Key Features:**
- **Gap-Only Processing** - Only runs on leads without contacts from Stage 1
- **14-Day Cooldown** - Prevents hammering Melissa for same lead
- **Score-Based Routing** - Leads with score >= 60 go to campaigns

---

## Workflow Credentials

### Environment Variables

```bash
# BatchData MCP (configured in Cursor)
# Uses zellerhaus/batchdata-mcp-real-estate server

# Melissa
MELISSA_BASE_URL=https://personator.melissadata.net
MELISSA_API_KEY=your_melissa_key

# Supabase
SUPABASE_URL=https://mxnqfwuhvurajrgoefyg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Groq (for AI Agent)
GROQ_API_KEY=your_groq_key
```

### n8n Credentials

1. **Supabase API** (headerAuth)
   - Header Name: `apikey`
   - Header Value: `{{ $env.SUPABASE_SERVICE_ROLE_KEY }}`
   - Authorization: `Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}`

2. **Melissa API** (headerAuth)
   - Handled via query params in HTTP node

3. **BatchData MCP** (MCP Client Tool)
   - Server: `zellerhaus/batchdata-mcp-real-estate`
   - Connected via Cursor MCP configuration

4. **Groq Chat Model**
   - Model: `llama-3.3-70b-versatile`
   - Temperature: 0.1 (for consistency)

---

## Success Metrics

### Track These KPIs

1. **Match Rate by Stage**
   ```sql
   SELECT 
     enriched_by,
     COUNT(*) as total,
     SUM(CASE WHEN phone_verified THEN 1 ELSE 0 END) as phones,
     SUM(CASE WHEN email_verified THEN 1 ELSE 0 END) as emails
   FROM leads
   WHERE source = 'batchdata'
   GROUP BY enriched_by;
   ```

2. **Cost Per Contactable Lead**
   - BatchData: `total_pulls / contactable_count * cost_per_record`
   - Melissa: `melissa_calls / recovery_count * cost_per_call`

3. **Time to Contactable**
   ```sql
   SELECT AVG(enriched_at - created_at) as avg_time
   FROM leads
   WHERE phone_verified OR email_verified;
   ```

4. **Suppression Effectiveness**
   ```sql
   SELECT COUNT(*) as suppressed_contacts
   FROM suppression_contacts;
   ```

---

## Manual Connection Steps (n8n UI)

### BatchData Pull Worker

After importing/updating via MCP, manually wire these connections in the n8n UI:

1. **Groq Chat Model** → **BatchData AI Agent**
   - Port: `ai_languageModel`

2. **BatchData MCP Tool** → **BatchData AI Agent**
   - Port: `ai_tool`

3. **Groq Chat Model** → **BatchData Skip Trace (Stage 1)**
   - Port: `ai_languageModel`

4. **BatchData MCP Tool** → **BatchData Skip Trace (Stage 1)**
   - Port: `ai_tool`

5. **Upsert Lead** → **BatchData Skip Trace (Stage 1)**
   - Port: `main`

6. **Upsert Suppression** → **Queue for Enrichment**
   - Port: `main`

---

## Testing Checklist

- [ ] **Database migrations applied** (columns, tables, views)
- [ ] **MCP server connected** (check Cursor MCP settings)
- [ ] **Credentials configured** (Supabase, Melissa, Groq)
- [ ] **Manual connections wired** (AI Agent ports)
- [ ] **Test BatchData Pull Worker** (run manually, check logs)
- [ ] **Verify suppression table** (check hashes being created)
- [ ] **Test Melissa fallback** (ensure view query works)
- [ ] **Check quality scores** (RPC returns 0-100)
- [ ] **Monitor API costs** (BatchData + Melissa usage)

---

## Troubleshooting

### Issue: "Could not find property option" on import

**Fix:** Use MCP to create/update workflows instead of manual JSON import.

### Issue: AI Agent not calling MCP tools

**Fix:** Check Cursor MCP configuration at `~/.cursor/mcp.json` for BatchData server.

### Issue: Suppression table not populating

**Fix:** Check "Prep Suppression Entries" node returns valid MD5 hashes.

### Issue: Melissa always called even for enriched leads

**Fix:** Verify `mv_needs_melissa` view filters out leads with `primary_phone` OR `primary_email`.

---

## Next Steps

1. **Production Deployment**
   - Activate BatchData Pull Worker (hourly)
   - Activate Enrichment Pipeline (every 5 minutes)
   - Monitor costs and match rates

2. **Optimization**
   - Adjust page_size for BatchData pulls (100-250)
   - Tune Melissa cooldown period (14 days default)
   - Add rate limiting for API calls

3. **Monitoring**
   - Set up alerts for DLQ items
   - Track match rate by zip code
   - Monitor quality_score distribution
   - Alert on cost spikes

---

**Last Updated:** 2025-10-09  
**Architecture Version:** BatchData-First v1.0

