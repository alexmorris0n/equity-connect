# Production Plan Gap Analysis
**Generated:** 2025-10-07  
**Comparing:** Current schema vs Production Plan requirements

---

## Missing Database Columns in `leads` Table

### Campaign & Verification Fields
- ❌ `email_verified` (boolean, default false)
- ❌ `phone_verified` (boolean, default false)
- ❌ `added_to_campaign_at` (timestamptz)
- ❌ `current_sequence_step` (int, default 0)
- ❌ `last_reply_at` (timestamptz)
- ❌ `vapi_call_id` (text)
- ❌ `call_attempt_count` (int, default 0)
- ❌ `email_verification_codes` (text[])
- ❌ `phone_verification_codes` (text[])
- ❌ `campaign_status` (enum: new, queued, active, replied, paused, etc.)
- ❌ `melissa_payload` (jsonb) - for skip-trace results

### Current Schema Has
- ✅ `consent` (boolean)
- ✅ `consented_at` (timestamptz)
- ✅ `consent_method` (text)
- ✅ `assigned_broker_id` (uuid)
- ✅ `lead_score` (integer)
- ✅ `status` (text enum)

---

## Missing Tables

### 1. `consent_tokens`
**Purpose:** Nonce replay protection for consent forms
```sql
- id (uuid, primary key)
- lead_id (uuid, fk to leads)
- nonce_hash (text, unique)
- created_at (timestamptz)
- used_at (timestamptz)
```

### 2. `verification_code_map`
**Purpose:** Version-able mapping of provider verification codes
```sql
- provider (text)
- channel (text: email|phone)
- code (text)
- is_verified (boolean)
- PRIMARY KEY (provider, channel, code)
```

### 3. `pipeline_dlq`
**Purpose:** Dead letter queue for failed pipeline operations
```sql
- id (bigserial, primary key)
- source (text)
- payload (jsonb)
- reason (text)
- retry_after (timestamptz)
- created_at (timestamptz)
```

### 4. `leads_staging`
**Purpose:** CSV staging before deduplication
```sql
- mak (text)
- apn (text)
- addr_hash (text)
- email (text)
- phone (text)
- raw (jsonb)
- loaded_at (timestamptz)
```

### 5. `ingest_replay_guard`
**Purpose:** Prevent replay attacks beyond HMAC
```sql
- content_sha256 (text, primary key)
- received_at (timestamptz)
```

### 6. `pipeline_events` (mentioned but not defined)
**Purpose:** Observability/metrics tracking
- Needs definition for funnel tracking: upload → dedupe → verified → fed → replied → booked

---

## Missing Indexes

### Partial/Covering Indexes for Hot Paths
```sql
-- Campaign feeder hot path
CREATE INDEX leads_feed_hot_idx 
  ON leads (added_to_campaign_at, lead_score DESC)
  WHERE campaign_status IN ('queued','active') AND phone_verified IS TRUE;

-- Replies lookup fast path
CREATE INDEX leads_replied_lookup_idx
  ON leads (last_reply_at DESC)
  WHERE campaign_status = 'replied';

-- Active phone verified leads
CREATE INDEX leads_active_phone_idx
  ON leads (campaign_status, added_to_campaign_at, phone_verified, lead_score DESC);

-- Last reply with VAPI
CREATE INDEX leads_last_reply_idx
  ON leads (campaign_status, last_reply_at, phone_verified, vapi_call_id, lead_score DESC);
```

---

## Missing RLS Policies

### Current State
- ✅ Broker can UPDATE only their assigned leads

### Needed
- ❌ Broker INSERT policy (only leads assigned to self)
- ❌ Service role unrestricted write policy for pipeline
- ❌ RLS on `pipeline_events`, `mv_contactable_leads`, DLQ tables

---

## Missing Database Features

### 1. Enums
- ❌ `campaign_status` enum type

### 2. Constraints
- ❌ `consent_requires_timestamp` CHECK (consent = false OR consented_at IS NOT NULL)
- ❌ `lead_score_range` CHECK (lead_score BETWEEN 0 AND 100)

### 3. Triggers
- ❌ `set_added_to_campaign_at()` function + trigger

### 4. Extensions
- ❌ `pgcrypto` extension (for encryption)

### 5. Roles
- ❌ `pipeline_writer` role for service access

---

## Missing Security Features

### HMAC Verification
- ❌ No HMAC verification in upload workflows
- ❌ No timestamp window checking (±5 minutes)
- ❌ No raw body verification before parsing

### Encryption
- ❌ No pgcrypto implementation
- ❌ No external key management (KMS/Vault)
- ❌ No encrypted columns for PII

---

## Missing Workflow Features

### 1. Idempotent Upload Flow
- ❌ SHA-256 content hashing
- ❌ HMAC signature verification
- ❌ Replay attack protection

### 2. Dedupe Logic
- ❌ Triple-key dedupe (MAK → APN → addr_hash)
- ❌ NULL-safe unique indexes

### 3. Campaign Pacing
- ❌ 250/day Mon-Fri limit enforcement
- ❌ Campaign feeder scheduled at 06:00 PT
- ❌ Advisory locks for cron jobs

### 4. MV Refresh
- ❌ `mv_contactable_leads` materialized view
- ❌ Scheduled refresh at 05:30 PT with CONCURRENTLY
- ❌ Timezone hardening (America/Los_Angeles)

---

## Missing Observability

### Metrics Collection
- ❌ No funnel tracking (upload → dedupe → verified → fed → replied → booked)
- ❌ No duration tracking
- ❌ No rate limit (429) tracking
- ❌ No 5xx error tracking

### Dashboards
- ❌ No metrics dashboards
- ❌ No pipeline health monitoring

---

## Implementation Priority

### Critical (Must Have for Production)
1. **Database Columns** - Add missing campaign/verification fields
2. **Security Tables** - consent_tokens, verification_code_map
3. **RLS Policies** - Complete INSERT + service role policies
4. **HMAC Verification** - Implement in upload workflows
5. **Enums & Constraints** - Data integrity

### High Priority
6. **Performance Indexes** - Partial indexes for hot paths
7. **DLQ Table** - Error handling and retry logic
8. **Triggers** - Automation for timestamp consistency
9. **Staging Table** - CSV validation before main ingest

### Medium Priority
10. **Encryption** - pgcrypto + KMS integration
11. **Observability** - Metrics collection and funnel tracking
12. **MV Refresh** - Materialized view for contactable leads
13. **Advisory Locks** - Cron job safety

---

## Next Steps
1. Create comprehensive migration SQL file
2. Implement HMAC verification in n8n workflows
3. Update existing workflows with new schema
4. Add monitoring and observability
5. Test end-to-end with production data patterns

