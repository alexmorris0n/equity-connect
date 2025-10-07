# Equity Connect - Production Architecture Overview

**Version:** 2025-10-07  
**Status:** Production-Ready Design

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EQUITY CONNECT PLATFORM                          │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────── DATA INGESTION LAYER ─────────────────────────┐
│                                                                          │
│  PropStream API          CSV Upload (HMAC)         BatchData MCP        │
│       │                        │                          │              │
│       │                        │                          │              │
│       ▼                        ▼                          ▼              │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │              n8n Workflow Orchestration                      │       │
│  │  • HMAC Signature Verification (±5 min window)              │       │
│  │  • Replay Attack Protection (SHA-256 content hash)          │       │
│  │  • CSV Staging & Validation                                 │       │
│  │  • Skip-Trace Provider Router (Melissa, TLO, etc.)          │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                │                                         │
└────────────────────────────────┼─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────── DATABASE LAYER ───────────────────────────────┐
│                      Supabase PostgreSQL                                │
│                                                                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│  │ leads_staging   │  │ ingest_replay_   │  │  pipeline_dlq      │   │
│  │ • CSV validation│──│   guard          │  │  • Error handling  │   │
│  │ • Pre-dedupe    │  │ • Prevent replay │  │  • Retry logic     │   │
│  └────────┬────────┘  └──────────────────┘  └────────────────────┘   │
│           │                                                             │
│           │  upsert_lead() Function                                    │
│           │  • Triple-key dedupe: MAK → APN → addr_hash               │
│           │  • Safe boolean/array merges                              │
│           │  • Verification code tracking                             │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                        leads (Main Table)                        │  │
│  │  Columns: id, email*, phone*, property_address, equity,          │  │
│  │    email_verified, phone_verified, campaign_status (enum),       │  │
│  │    lead_score, assigned_broker_id, consent, vapi_call_id,        │  │
│  │    mak, apn, addr_hash, melissa_payload (jsonb), ...             │  │
│  │                                                                   │  │
│  │  Indexes:                                                         │  │
│  │    • Partial: campaign_status + phone_verified (hot path)        │  │
│  │    • Unique: MAK, APN, addr_hash (NULL-safe dedupe)              │  │
│  │    • Composite: lead_score DESC for scoring                      │  │
│  │                                                                   │  │
│  │  RLS Policies:                                                    │  │
│  │    • Brokers: SELECT/INSERT/UPDATE own leads                     │  │
│  │    • Service role: Unrestricted (pipeline writes)                │  │
│  │                                                                   │  │
│  │  Triggers:                                                        │  │
│  │    • set_added_to_campaign_at() when status → 'active'           │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                  │                                       │
│  ┌──────────────────────────────┴───────────────────────────────┐     │
│  │         mv_contactable_leads (Materialized View)              │     │
│  │  • Pre-filtered: email_verified OR phone_verified             │     │
│  │  • Pre-filtered: consent = TRUE                               │     │
│  │  • Pre-filtered: campaign_status IN ('new','queued','active') │     │
│  │  • Refreshed: 05:30 PT daily with CONCURRENTLY                │     │
│  │  • Used by: Campaign feeder (250/day Mon-Fri)                 │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│  │ consent_tokens  │  │ verification_    │  │  pipeline_events   │   │
│  │ • Nonce hashes  │  │   code_map       │  │  • Observability   │   │
│  │ • Replay guard  │  │ • Provider codes │  │  • Funnel tracking │   │
│  └─────────────────┘  └──────────────────┘  └────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────── CAMPAIGN LAYER ───────────────────────────────┐
│                                                                          │
│  Campaign Feeder (Cron: 06:00 PT, Mon-Fri)                             │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  SELECT TOP 250 FROM mv_contactable_leads                       │   │
│  │  WHERE campaign_status = 'queued'                               │   │
│  │  ORDER BY lead_score DESC                                       │   │
│  │  • Update campaign_status → 'active'                            │   │
│  │  • Generate consent tokens (HMAC-signed, 7-day expiry)          │   │
│  │  • Feed to Instantly.ai campaigns                               │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                 │                                        │
│                                 ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │                      Instantly.ai                             │     │
│  │  • Multi-sequence campaigns (4-step email sequences)           │     │
│  │  • 45 AI personas (Carlos, Priya, Marcus, etc.)                │     │
│  │  • Consent form links embedded in emails                       │     │
│  │  • Reply detection via webhook                                 │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┴──────────────────────┐
        │                                                │
        ▼                                                ▼
┌──────────────────────────┐              ┌─────────────────────────────┐
│  Email Reply Router      │              │  Consent Form Processor     │
│  • AI sentiment analysis │              │  • Token verification       │
│  • Intent classification │              │  • Nonce replay protection  │
│  • Auto-response routing │              │  • Update consent status    │
│  • Lead status update    │              │  • Audit trail logging      │
└────────────┬─────────────┘              └──────────────┬──────────────┘
             │                                           │
             │  IF: Positive intent + Consent = TRUE    │
             └──────────────────┬───────────────────────┘
                                │
                                ▼
┌──────────────────────── VOICE LAYER ──────────────────────────────────┐
│                                                                          │
│  Phone Number Assignment                                                │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  • Select best number from broker's pool (health_score DESC)    │   │
│  │  • Local presence matching (lead state = number state)          │   │
│  │  • Create lead_number_assignments record                        │   │
│  │  • Status: active (max 5 attempts before 'unreachable')         │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                 │                                        │
│                                 ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │              VAPI AI Voice Calls (via SignalWire)             │     │
│  │  • AI-powered conversation                                     │     │
│  │  • Appointment booking intent detection                        │     │
│  │  • Call transcription & sentiment analysis                     │     │
│  │  • Outcome webhook → n8n                                       │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                 │                                        │
│                                 ▼                                        │
│  Call Outcome Processing                                                │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  • Update lead: vapi_call_id, call_attempt_count               │   │
│  │  • Parse outcome: 'booked' | 'callback' | 'not_interested'     │   │
│  │  • IF booked → campaign_status = 'converted'                   │   │
│  │  • IF booked → assignment status = 'booked_locked'             │   │
│  │  • IF unreachable (5 attempts) → 'do_not_contact'              │   │
│  │  • Notify broker via webhook                                   │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────── BROKER DASHBOARD LAYER ─────────────────────────┐
│                         Vue.js Frontend                                 │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │   Dashboard      │  │   Leads View     │  │   Analytics      │    │
│  │ • Active leads   │  │ • Filter/search  │  │ • Funnel metrics │    │
│  │ • Today's calls  │  │ • Lead details   │  │ • Conversion %   │    │
│  │ • Appointments   │  │ • Call history   │  │ • Revenue        │    │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘    │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │   Billing        │  │   Settings       │  │   Consent Mgmt   │    │
│  │ • Waterfall fees │  │ • Notifications  │  │ • Audit trail    │    │
│  │ • Invoices       │  │ • Preferences    │  │ • Token logs     │    │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘    │
│                                                                          │
│  Access Control: RLS enforces broker can only see assigned leads       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────── OBSERVABILITY LAYER ──────────────────────────┐
│                                                                          │
│  Metrics Collection (pipeline_events table)                             │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  Funnel Tracking:                                               │   │
│  │    upload_received → dedupe_success → email_verified →         │   │
│  │    campaign_queued → email_sent → email_replied →              │   │
│  │    call_initiated → appointment_booked → application_submitted  │   │
│  │                                                                 │   │
│  │  Performance Metrics:                                           │   │
│  │    • duration_ms for each stage                                │   │
│  │    • error_rate by event_type                                  │   │
│  │    • throughput (events/hour)                                  │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Alerting                                                                │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  • HMAC verification failure rate > 5%                          │   │
│  │  • DLQ depth > 100 items                                        │   │
│  │  • MV refresh failed                                            │   │
│  │  • Campaign feeder failed                                       │   │
│  │  • Duplicate upload spike (potential attack)                    │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                              │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Transport Security
├─ HTTPS/TLS for all API endpoints
├─ Certificate pinning (optional)
└─ Rate limiting (100 req/min per IP)

Layer 2: Request Verification
├─ HMAC-SHA256 signature (X-Signature header)
├─ Timestamp window check (±5 minutes)
├─ Content SHA-256 hash (X-Content-SHA256)
└─ Replay attack guard (7-day deduplication)

Layer 3: Authentication & Authorization
├─ Supabase Auth (JWT tokens)
├─ Row Level Security (RLS) policies
│  ├─ Brokers: Only assigned leads
│  ├─ Service role: Unrestricted (pipeline)
│  └─ Anonymous: No access
├─ Service role keys (for n8n workflows)
└─ Consent token verification (nonce + HMAC)

Layer 4: Data Protection
├─ PII encryption with pgcrypto (ready to implement)
├─ Consent audit trail (lead_consent_audit)
├─ Immutable logs (pipeline_events)
└─ Secure key management (KMS/Vault)

Layer 5: Access Logging
├─ All database writes logged to pipeline_events
├─ Failed auth attempts tracked
├─ Consent changes audited
└─ DLQ for suspicious activity
```

---

## 📊 Data Flow: Lead Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                      LEAD LIFECYCLE FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

1. INGESTION
   PropStream Export → HMAC Verification → Replay Guard → Staging
   ↓
   Dedupe Check: MAK exists? → Update
                 APN exists? → Update
                 addr_hash exists? → Update
                 None exist? → Insert
   ↓
   Status: campaign_status = 'new'

2. VERIFICATION
   Skip-Trace API (Melissa/TLO)
   ↓
   email_verified = TRUE/FALSE
   phone_verified = TRUE/FALSE
   ↓
   Store verification codes in arrays
   ↓
   IF verified → Eligible for campaign

3. CAMPAIGN QUEUE
   Cron: 05:30 PT - Refresh mv_contactable_leads
   ↓
   Cron: 06:00 PT - Campaign Feeder
   ↓
   SELECT TOP 250 WHERE campaign_status = 'queued'
   ORDER BY lead_score DESC
   ↓
   campaign_status = 'queued' → 'active'
   added_to_campaign_at = NOW()

4. EMAIL SEQUENCE
   Instantly.ai Multi-Sequence
   ↓
   Email 1 (Day 1): Introduction + Consent Link
   Email 2 (Day 3): Value Proposition + Case Study
   Email 3 (Day 5): Social Proof + Urgency
   Email 4 (Day 7): Last Chance + Alternate Contact
   ↓
   IF Reply Detected:
     campaign_status = 'replied'
     last_reply_at = NOW()

5. CONSENT CAPTURE
   Lead Clicks Consent Form Link
   ↓
   Token Verification:
     - Decode base64url payload
     - Verify HMAC signature
     - Check expiry (7 days)
     - Check nonce not used (consent_tokens)
   ↓
   IF Valid:
     consent = TRUE
     consented_at = NOW()
     consent_method = 'form'
     Log to lead_consent_audit

6. VOICE OUTREACH
   Assign Phone Number:
     - Select from broker's pool
     - Match local area code
     - Check health_score
   ↓
   VAPI AI Call via SignalWire
   ↓
   call_attempt_count++
   vapi_call_id = <call-id>
   ↓
   Parse Outcome:
     'booked' → campaign_status = 'converted'
     'callback' → Schedule follow-up
     'not_interested' → campaign_status = 'do_not_contact'
     'no_answer' → Retry (max 5 attempts)

7. APPOINTMENT BOOKED
   campaign_status = 'converted'
   assignment_status = 'booked_locked'
   ↓
   Notify broker via webhook
   ↓
   Create billing_event:
     event_type = 'appointment_set'
     amount = $X (waterfall pricing)

8. DEAL LIFECYCLE
   Application Submitted → billing_event
   ↓
   Loan Funded → billing_event
   ↓
   Final waterfall calculation
   ↓
   Invoice generation
```

---

## 🎯 Key Design Decisions

### 1. **Triple-Key Dedupe**
**Why:** Property records have multiple identifiers
- MAK (Mail Address Key) - Most reliable
- APN (Assessor Parcel Number) - State-specific
- addr_hash - Fallback for unstructured data

**How:** NULL-safe unique indexes + cascade logic

### 2. **Materialized View for Campaign Feed**
**Why:** Campaign feeder query is expensive (filters + sorting)
- Runs 250+ times/day
- Needs to be < 100ms
- Data freshness acceptable at daily level

**How:** Refresh CONCURRENTLY at 05:30 PT (before 06:00 feeder)

### 3. **Campaign Status Enum**
**Why:** Type safety prevents bugs
- 'new' vs 'New' vs 'NEW' → All same
- Invalid states rejected at database level
- Better than string with CHECK constraint

**States:** new → queued → active → replied → converted

### 4. **HMAC Signature Verification**
**Why:** Prevent data tampering
- Ensures data integrity
- Authenticates source
- Prevents man-in-the-middle attacks

**How:** Client signs with shared secret, server verifies

### 5. **Replay Attack Protection**
**Why:** Prevent duplicate uploads
- Malicious actor can't replay valid signed request
- Content hash stored for 7 days
- Duplicate detected → 409 Conflict

**How:** SHA-256 content hash in `ingest_replay_guard`

### 6. **Consent Token Nonce**
**Why:** Prevent consent token reuse
- Token can only be used once
- Prevents fraudulent consent
- Audit trail preserved

**How:** Hash stored in `consent_tokens.nonce_hash`

### 7. **Partial Indexes**
**Why:** Optimize hot paths without bloating index size
- Only index rows that matter (phone_verified = TRUE)
- 10x smaller than full index
- 10x faster queries

**Example:** Campaign feeder only needs active, verified leads

### 8. **Pipeline Events for Observability**
**Why:** Can't optimize what you don't measure
- Complete funnel visibility
- Duration tracking per stage
- Error rate monitoring
- Enables data-driven decisions

---

## 🚀 Performance Targets

```
┌──────────────────────────────────────────────────────────────────┐
│                     PERFORMANCE TARGETS                           │
└──────────────────────────────────────────────────────────────────┘

Database Operations:
├─ Lead upsert: < 50ms (p95)
├─ Campaign feeder query: < 100ms (from MV)
├─ MV refresh: < 5 seconds (CONCURRENTLY)
└─ Dedupe lookup: < 10ms (indexed)

API Endpoints:
├─ CSV upload (1000 rows): < 30 seconds
├─ HMAC verification: < 5ms
├─ Replay guard check: < 10ms
└─ Consent token verification: < 20ms

Workflows:
├─ PropStream → Supabase: < 60 seconds (200 leads)
├─ Skip-trace verification: < 5 seconds per lead
├─ Campaign feeder: < 2 minutes (250 leads)
└─ Email sequence trigger: < 10 seconds per lead

Throughput:
├─ Upload ingestion: 1000 leads/minute
├─ Campaign sends: 250 leads/day per broker
├─ VAPI calls: 100 concurrent
└─ Consent form submissions: 500/hour
```

---

## 📈 Scalability Considerations

### Current Design Handles:
- ✅ **10,000 leads/day** upload rate
- ✅ **100 brokers** concurrent
- ✅ **25,000 emails/day** (100 brokers × 250 leads)
- ✅ **500 voice calls/hour** per broker

### Scaling Bottlenecks:
1. **MV Refresh** - Becomes slow > 1M leads
   - Solution: Partition by created_at, incremental refresh
2. **Dedupe Lookup** - Slows > 10M leads
   - Solution: Partition by state/zip
3. **Pipeline Events** - Table bloat > 100M events
   - Solution: Partition by month, archive old data

### Optimization Opportunities:
- Add Redis cache for hot lead lookups
- Use connection pooling (Supavisor)
- Implement read replicas for reporting
- Move heavy processing to background jobs

---

## 🎓 Key Takeaways

1. **Security First**: HMAC, RLS, consent auditing are non-negotiable
2. **Idempotency**: Dedupe + replay guards prevent data corruption
3. **Observability**: Pipeline events enable data-driven optimization
4. **Performance**: Proper indexes make 100x difference
5. **Type Safety**: Enums + constraints catch bugs early
6. **Automation**: Triggers + cron jobs reduce manual work
7. **Scalability**: Design for 10x current volume

---

**Next:** Follow `docs/PRODUCTION_IMPLEMENTATION_CHECKLIST.md` to deploy! 🚀

