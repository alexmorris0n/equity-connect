# Production Plan - Database Schema & Architecture

**⚠️ NOTE:** This document describes database schema and architecture patterns. For complete current system status, see [MASTER_PRODUCTION_PLAN.md](MASTER_PRODUCTION_PLAN.md)

**Project:** Equity Connect  
**Version:** 2025-10-06 (Schema) + Oct 11 (Implementation Updates)  
**Owner:** Architecture

---

## Executive Summary
Database schema, RLS policies, encryption, and architectural patterns. This is the technical reference for the production database. For workflow implementation status, see MASTER_PRODUCTION_PLAN.md.

---

## What's Solid (kept)
- SHA-256 idempotent upload flow + HMAC verification
- Triple-key dedupe (MAK → APN → addr_hash) with NULL-safe unique indexes
- Provider-agnostic skip-trace router + DLQ + rate limits
- 250/day Mon–Fri campaign feeder with scoring
- VAPI + AI email reply router + consent tokenization
- RLS on `leads`; `pipeline_events`, `mv_contactable_leads`, DLQ tables

---

## High-Impact Fixes (implemented by schema below)
1) **Lead columns referenced elsewhere** (verified flags, campaign fields, consent, VAPI IDs, call attempts)  
2) **pgcrypto + encryption** with external key mgmt  
3) **Upsert boolean/array merges** (COALESCE + safe array casts)  
4) **CSV HMAC signature** rules (raw-body verification; multipart caveats)  
5) **RLS completeness**: update policy + service role for pipeline  
6) **Query indexes** for feeder & reply flows  
7) **MV refresh window** + timezone alignment  
8) **Consent tokens** (nonce replay protection)  
9) **Verification code mapping** (versioned)  
10) **Cron safety & observability** (advisory locks + funnel metrics)

---

## Architecture Overview

| Layer | Description |
|---|---|
| Database (Supabase/Postgres) | `leads`, `pipeline_events`, `mv_contactable_leads`, `consent_tokens`, `verification_code_map`, DLQ |
| API Layer | Secure upload (HMAC), dedupe by MAK→APN→addr_hash, idempotent ingest |
| Skip-Trace Router | Provider-agnostic, DLQ + rate limits |
| Campaign Engine | 250/day Mon–Fri, AI scoring, Instantly sequences |
| AI Reply Router | VAPI + AI parsing, consent tokenization |
| Access Control | RLS across key tables; broker-scoped updates |
| Monitoring | Metrics, advisory locks, funnel view |

---

## MCP Usage

### ✅ BatchData MCP - PRODUCTION DEPLOYED (Oct 10, 2025)
- **Status:** Active in production
- **Deployment:** Northflank (same project as n8n)
- **Base URL:** `https://p01--batchdata-mcp-server--p95wlpxnp2z2.code.run`
- **SSE Endpoint:** `https://p01--batchdata-mcp-server--p95wlpxnp2z2.code.run/sse`
- **Integration:** n8n workflow via LangChain AI Agent
- **Workflow:** https://n8n.instaroute.com/workflow/HnPhfA6KCq5VjTCy
- **AI Model:** OpenRouter (google/gemini-2.5-flash-lite)
- **Documentation:** [BATCHDATA_MCP_INTEGRATION.md](./BATCHDATA_MCP_INTEGRATION.md)

### Other MCP Tools
- **Available:** Cursor built-ins (fs/git/shell); optional postgres MCP
- **HTTP/Webhook for now:** Melissa, Instantly, VAPI, SignalWire (option: build thin MCP adapters later)

---

## Booking System

### ✅ Cal.com - DEPLOYED (Oct 10, 2025)
- **Status:** Deployed to Vercel - Configuration pending
- **Platform:** Vercel (self-hosted open-source)
- **Current URL:** `https://cal-dot-com.vercel.app/e`
- **Target URL:** `https://book.equityconnect.com` (pending domain setup)
- **GitHub Repository:** https://github.com/alexmorris0n/cal-dot-com
- **Local Path:** `C:\Users\alex\OneDrive\Desktop\Cursor\cal-dot-com`
- **Integration:** n8n via native Cal.com app (https://app.cal.com/apps/n8n)
- **Documentation:** [CALCOM_INTEGRATION.md](./CALCOM_INTEGRATION.md)

**Booking Flow:**
```
VAPI Call → Consent Signal → n8n → Cal.com Link → Lead Books → Webhook → Update Supabase → Notify Broker
```

**Pending Configuration:**
- Event types (equity-call, follow-up, doc-review)
- Webhook endpoints (n8n integration)
- Broker calendar connections
- Custom domain DNS

---

## Scheduling & Concurrency
- Refresh `mv_contactable_leads` **05:30 America/Los_Angeles** with `CONCURRENTLY`.
- Campaign feeder **06:00 PT** (weekdays only, 250/day).
- Wrap cron jobs with `pg_try_advisory_lock(<job_key>)`; skip if false.

---

## Observability
- Emit counts, durations, 429, 5xx; funnel: **upload → dedupe → verified → fed → replied → booked**.
- Store in `pipeline_events` and/or external collector; add simple dashboards.

---

## Launch Checklist
- [x] **BatchData MCP deployed and integrated** (Oct 10, 2025)
- [x] **n8n workflow operational** (batchdata-pull-worker)
- [x] **Cal.com deployed to Vercel** (Oct 10, 2025) - configuration pending
- [ ] Cal.com event types created (equity-call, follow-up, doc-review)
- [ ] Cal.com webhooks configured (n8n integration)
- [ ] Cal.com custom domain setup (book.equityconnect.com)
- [ ] Columns added (email/phone verified, campaign fields, consent, vapi ids)
- [ ] pgcrypto enabled + KMS/Vault wiring
- [ ] Upsert boolean/array merge fixed
- [ ] HMAC verification on true raw body (CSV upload)
- [ ] RLS: SELECT/INSERT/UPDATE + pipeline service role
- [ ] Extra indexes created
- [ ] `consent_tokens` + `verification_code_map`
- [ ] Mutex on scheduled jobs
- [ ] MV refresh + timezone confirmed

---

## Additional Corrections & Tightening (New)

### 1) Complete RLS (INSERT + UPDATE + service role)
```sql
-- Broker can INSERT only leads assigned to self
create policy if not exists broker_leads_insert on leads
  for insert
  with check (assigned_broker_id = auth.uid());

-- Broker UPDATE already defined; keep it.

-- Pipeline service role: unrestricted write while RLS stays ON
create policy if not exists pipeline_leads_write on leads
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
```

### 2) Status enums + guard rails
```sql
-- Campaign status as enum for integrity
do $$ begin
  if not exists (select 1 from pg_type where typname = 'campaign_status') then
    create type campaign_status as enum (
      'new','queued','active','replied','paused','unsubscribed','bounced','do_not_contact','converted'
    );
  end if;
end $$;

alter table leads
  add column if not exists campaign_status campaign_status default 'new';

-- CHECKs
alter table leads
  add constraint if not exists consent_requires_timestamp
  check (consent = false or consented_at is not null);

alter table leads
  add column if not exists lead_score int default 0,
  add constraint if not exists lead_score_range check (lead_score between 0 and 100);
```

### 3) Partial/covering indexes for hot paths
```sql
-- Only target rows actually used by feeder
create index if not exists leads_feed_hot_idx
  on leads (added_to_campaign_at, lead_score desc)
  where campaign_status in ('queued','active') and phone_verified is true;

-- Replies lookup fast path
create index if not exists leads_replied_lookup_idx
  on leads (last_reply_at desc)
  where campaign_status = 'replied';
```

### 4) Automations: keep timestamps consistent
```sql
-- When campaign_status flips to active, stamp added_to_campaign_at
create or replace function set_added_to_campaign_at()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and NEW.campaign_status = 'active' and (OLD.campaign_status is distinct from 'active') then
    NEW.added_to_campaign_at := coalesce(NEW.added_to_campaign_at, now());
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_set_added_to_campaign_at on leads;
create trigger trg_set_added_to_campaign_at
before update on leads
for each row execute function set_added_to_campaign_at();
```

### 5) Ingest replay protection (beyond HMAC)
```sql
-- Prevent accepting the exact same payload twice (optional but recommended)
create table if not exists ingest_replay_guard (
  content_sha256 text primary key,
  received_at timestamptz default now()
);
-- Upsert a hash of the raw body at the start of webhook; reject on conflict
```

### 6) HMAC headers: add timestamp & window
```text
Headers to include from client:
X-Signature: sha256=<hex>
X-Content-SHA256: <hex of file/body>
X-Signature-Timestamp: <RFC3339>
```
Server: parse `X-Signature-Timestamp` and **reject if outside ±5 minutes** to mitigate stolen signature replay.

### 7) CSV staging & validation
```sql
-- Use a staging table matching CSV columns, then merge
create table if not exists leads_staging (
  mak text, apn text, addr_hash text, email text, phone text, raw jsonb, loaded_at timestamptz default now()
);
-- COPY into staging, validate columns, then call upsert to main `leads` with dedupe keys
```

### 8) DLQ schema (explicit)
```sql
create table if not exists pipeline_dlq (
  id bigserial primary key,
  source text not null,
  payload jsonb not null,
  reason text,
  retry_after timestamptz,
  created_at timestamptz default now()
);
```

### 9) Broker FK & cascade rules
```sql
-- If you maintain a brokers table, enforce FK
alter table leads
  add constraint if not exists leads_broker_fk
  foreign key (assigned_broker_id) references brokers(id) on delete set null;
```

### 10) Timezone hardening in jobs
Ensure each scheduled session runs with:
```sql
set time zone 'America/Los_Angeles';
```
(Do this at job start so cron containers don't drift.)

---


# /config/supabase-schema.sql
```sql
-- Enable crypto (idempotent)
create extension if not exists pgcrypto;

-- Leads: ensure required columns exist
alter table leads
  add column if not exists email_verified boolean default false,
  add column if not exists phone_verified boolean default false,
  add column if not exists added_to_campaign_at timestamptz,
  add column if not exists current_sequence_step int default 0,
  add column if not exists last_reply_at timestamptz,
  add column if not exists assigned_broker_id uuid,
  add column if not exists consent boolean default false,
  add column if not exists consented_at timestamptz,
  add column if not exists consent_method text,
  add column if not exists vapi_call_id text,
  add column if not exists call_attempt_count int default 0;

-- Consent tokens (nonce replay protection)
create table if not exists consent_tokens (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  nonce_hash text unique not null,
  created_at timestamptz default now(),
  used_at timestamptz
);

-- Verification code mapping (versionable)
create table if not exists verification_code_map (
  provider text,
  channel text check (channel in ('email','phone')),
  code text,
  is_verified boolean,
  primary key (provider, channel, code)
);

-- RLS: broker can update only their assigned leads
-- (Assumes RLS is already enabled on table)
drop policy if exists broker_leads_modify on leads;
create policy broker_leads_modify on leads
  for update using (assigned_broker_id = auth.uid())
  with check (assigned_broker_id = auth.uid());

-- Service role for pipeline writers (optional if granted elsewhere)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pipeline_writer') THEN
    CREATE ROLE pipeline_writer;
  END IF;
END $$;

grant insert, update on leads to pipeline_writer;

-- Query performance indexes
create index if not exists leads_active_phone_idx
  on leads (campaign_status, added_to_campaign_at, phone_verified, lead_score desc);

create index if not exists leads_last_reply_idx
  on leads (campaign_status, last_reply_at, phone_verified, vapi_call_id, lead_score desc);

-- OPTIONAL: advisory lock helpers (for documentation)
-- SELECT pg_try_advisory_lock(12345) as got_lock;  -- release with pg_advisory_unlock(12345)
```

---

# /ops/n8n-hmac-verify.md

## Goal
Verify upload integrity against the **exact raw request bytes** before parsing.

### Option A: Send raw file (no multipart) and sign that
**Client (Node.js)**
```js
import crypto from 'node:crypto';
import fs from 'node:fs';

const key = process.env.HMAC_KEY;
const buf = fs.readFileSync('leads.csv');
const hmac = crypto.createHmac('sha256', key).update(buf).digest('hex');

await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'text/csv',
    'X-Signature': `sha256=${hmac}`,
    'X-Content-SHA256': crypto.createHash('sha256').update(buf).digest('hex'),
  },
  body: buf,
});
```

**n8n Webhook (raw body) → Function node**
```js
// In Webhook: set Response Mode = On Received, Binary Data = true, Raw Body = true
// In Function node (first node after Webhook):
const crypto = require('crypto');

const signature = $json.headers['x-signature'];
if (!signature || !signature.startsWith('sha256=')) {
  throw new Error('Missing or bad signature');
}

const expected = signature.slice('sha256='.length);
const key = $env.HMAC_KEY; // set in n8n credentials or env

// Access the raw buffer from the webhook
const raw = items[0].binary?.data?.data; // n8n stores as base64 in .data
if (!raw) throw new Error('No raw body');

const bodyBuf = Buffer.from(raw, 'base64');
const digest = crypto.createHmac('sha256', key).update(bodyBuf).digest('hex');

const ok = crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(expected));
if (!ok) throw new Error('HMAC mismatch');

return items; // pass through to CSV parse, etc.
```

### Option B: Multipart, but sign the **exact multipart bytes**
Buffer the `form-data` stream yourself, compute HMAC over the same bytes, and send that signature. Server verifies against raw body buffer (same as above).

### Important
- Do **not** sign `form.getBuffer()` if `fetch` streams; bytes differ.
- Verify before parsing; reject and log mismatches.

---

# /db/upsert-patch.sql (snippet)
```sql
-- In your upsert function, use this pattern for safe merges
update leads set
  melissa_payload = coalesce(melissa_payload,'{}'::jsonb) || coalesce(p->'skip_payload','{}'::jsonb),
  email_verified = coalesce(email_verified,false) or coalesce((p->>'email_verified')::boolean,false),
  phone_verified = coalesce(phone_verified,false) or coalesce((p->>'phone_verified')::boolean,false),
  email_verification_codes =
    coalesce(email_verification_codes,'{}'::text[]) ||
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'email_codes','[]'::jsonb)) as t(x)), '{}'),
  phone_verification_codes =
    coalesce(phone_verification_codes,'{}'::text[]) ||
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'phone_codes','[]'::jsonb)) as t(x)), '{}')
where id = v_id;
```

---

## Notes on Encryption
- Store symmetric key in KMS/Vault (not in Postgres). Inject via runtime secret.
- `email_encrypted = pgp_sym_encrypt(:email, :enc_key)`; hash with `digest(:email,'sha256')` for lookups.
- Wrap reads in a SECURE SQL function guarded by RLS and only callable by service roles.

---

## Ready-To-Ship Statement
Once `/config/supabase-schema.sql` is applied, HMAC verify is enforced, cron mutex is added, and BatchData is called via MCP, the system meets the production bar defined in this document.


