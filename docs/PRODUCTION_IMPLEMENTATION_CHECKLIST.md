# Production Implementation Checklist

**Project:** Equity Connect  
**Version:** 2025-10-07  
**Status:** Ready for Implementation

---

## 📋 Implementation Overview

This checklist guides you through implementing the production plan. Follow sections in order.

---

## ✅ Phase 1: Database Setup (CRITICAL)

### 1.1 Run Migration Script

**File:** `config/supabase-production-migration.sql`

**Steps:**
1. Back up your current Supabase database
2. Open Supabase SQL Editor
3. Copy contents of `supabase-production-migration.sql`
4. Execute the migration
5. Verify no errors in output

**What it does:**
- ✅ Adds missing columns to `leads` table
- ✅ Creates new tables (consent_tokens, verification_code_map, pipeline_dlq, etc.)
- ✅ Sets up RLS policies
- ✅ Creates performance indexes
- ✅ Adds triggers and functions
- ✅ Enables pgcrypto extension

**Verification:**
```sql
-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
  AND column_name IN ('email_verified', 'phone_verified', 'campaign_status', 'vapi_call_id');

-- Check new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('consent_tokens', 'verification_code_map', 'pipeline_dlq', 'leads_staging');

-- Check materialized view exists
SELECT matviewname FROM pg_matviews WHERE matviewname = 'mv_contactable_leads';
```

### 1.2 Set Up Environment Variables

Add to your n8n environment or Supabase secrets:

```bash
# HMAC Security
HMAC_SECRET_KEY=<generate-strong-random-key>

# Consent Form
CONSENT_FORM_URL=https://form.equityconnect.com
FORM_LINK_SECRET=<generate-strong-random-key>

# Encryption (for future use)
ENCRYPTION_KEY=<generate-from-kms-or-vault>
```

**Generate strong keys:**
```bash
# Generate HMAC key (64 characters)
openssl rand -hex 32

# Generate Form secret (64 characters)
openssl rand -hex 32
```

---

## ✅ Phase 2: Workflow Updates

### 2.1 Update PropStream Workflow

**File:** `workflows/propstream-supabase-workflow.json`

**Changes needed:**

1. **Add lead scoring** when creating leads
2. **Use upsert_lead function** instead of direct insert
3. **Add pipeline_events tracking** for observability
4. **Use campaign_status enum** instead of status text

**Key changes:**
- Replace direct Supabase insert with function call to `upsert_lead()`
- Add dedupe keys (MAK, APN, addr_hash)
- Track verification codes from skip-trace
- Log to pipeline_events table

### 2.2 Create Secured Upload Workflow

**Reference:** `docs/HMAC_VERIFICATION_GUIDE.md`

**New workflow needed:**
1. Webhook (raw body mode)
2. HMAC Verification function
3. Replay guard check
4. CSV parser
5. Staging table insert
6. Dedupe and upsert
7. Success response

**Implementation:**
- Follow complete example in HMAC_VERIFICATION_GUIDE.md
- Test with sample CSV before production
- Monitor DLQ for failed uploads

---

## ✅ Phase 3: Cron Jobs Setup

### 3.1 Refresh Contactable Leads MV

**Schedule:** Every day at 05:30 America/Los_Angeles

**SQL to run:**
```sql
SELECT refresh_contactable_leads();
```

**Setup in Supabase:**
- Use pg_cron extension (enable if not already)
- Or use external cron service (GitHub Actions, n8n scheduler)

**Verification:**
```sql
-- Check MV was refreshed
SELECT * FROM pg_stat_user_tables 
WHERE relname = 'mv_contactable_leads';
```

### 3.2 Campaign Feeder (250/day Mon-Fri)

**Schedule:** Every weekday at 06:00 PT

**Query:**
```sql
-- Select top 250 leads ready for campaign
SELECT * FROM mv_contactable_leads
WHERE campaign_status = 'queued'
  AND added_to_campaign_at IS NULL
ORDER BY lead_score DESC
LIMIT 250;
```

**Workflow:**
1. Get 250 leads from MV
2. Update campaign_status to 'active'
3. Import to Instantly
4. Log to pipeline_events

---

## ✅ Phase 4: Security Hardening

### 4.1 Implement HMAC Verification

**All external uploads must:**
- Include X-Signature header (HMAC-SHA256)
- Include X-Signature-Timestamp (RFC3339)
- Include X-Content-SHA256 (file hash)

**Client implementation:**
- Node.js example in HMAC_VERIFICATION_GUIDE.md
- Python example in HMAC_VERIFICATION_GUIDE.md

### 4.2 Enable Replay Protection

**Automatic with migration:**
- `ingest_replay_guard` table tracks content hashes
- Rejects duplicate uploads within 7 days
- Clean old entries with `cleanup_old_replay_guards()`

### 4.3 Set Up Row Level Security

**Already configured in migration:**
- Brokers can only see their assigned leads
- Service role has unrestricted access
- Pipeline writers have limited write access

**Test RLS:**
```sql
-- As broker user
SET ROLE authenticated;
SET request.jwt.claims.sub TO '<broker-uuid>';

-- Should only see assigned leads
SELECT COUNT(*) FROM leads; -- Should match assigned count
```

---

## ✅ Phase 5: Data Migration

### 5.1 Backfill Campaign Status

**For existing leads:**
```sql
-- Update leads based on current status
UPDATE leads 
SET campaign_status = CASE
  WHEN status = 'new' THEN 'new'::campaign_status
  WHEN status = 'contacted' THEN 'active'::campaign_status
  WHEN status = 'replied' THEN 'replied'::campaign_status
  WHEN status = 'qualified' THEN 'active'::campaign_status
  WHEN status IN ('appointment_set', 'showed', 'application', 'funded') THEN 'converted'::campaign_status
  WHEN status = 'closed_lost' THEN 'do_not_contact'::campaign_status
  ELSE 'new'::campaign_status
END
WHERE campaign_status IS NULL;
```

### 5.2 Initialize Verification Flags

**For leads with contact info:**
```sql
-- Mark as phone verified if phone exists
UPDATE leads 
SET phone_verified = TRUE
WHERE phone IS NOT NULL 
  AND phone != ''
  AND phone_verified = FALSE;

-- Mark as email verified if email exists
UPDATE leads 
SET email_verified = TRUE
WHERE email IS NOT NULL 
  AND email != ''
  AND email_verified = FALSE;
```

---

## ✅ Phase 6: Testing

### 6.1 Test HMAC Upload

**Use test script:**
```bash
# From docs/HMAC_VERIFICATION_GUIDE.md
node test-hmac-upload.js
```

**Expected:**
- ✅ Valid signature accepted
- ❌ Invalid signature rejected
- ❌ Old timestamp rejected
- ❌ Duplicate upload rejected

### 6.2 Test Campaign Feeder

**Manual test:**
```sql
-- Mark some leads as queued
UPDATE leads 
SET campaign_status = 'queued'
WHERE id IN (SELECT id FROM leads LIMIT 10);

-- Run feeder query
SELECT * FROM mv_contactable_leads
WHERE campaign_status = 'queued'
ORDER BY lead_score DESC
LIMIT 250;
```

### 6.3 Test RLS Policies

**As different users:**
1. Broker should only see their leads
2. Service role should see all
3. Anonymous should see nothing

---

## ✅ Phase 7: Observability

### 7.1 Set Up Metrics Collection

**Track in pipeline_events:**
- upload_received
- dedupe_success
- lead_verified
- campaign_added
- email_replied
- appointment_booked

**Query funnel:**
```sql
SELECT 
  event_type,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration_ms
FROM pipeline_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY count DESC;
```

### 7.2 Create Dashboard

**Metrics to display:**
1. Daily uploads
2. Verification rate (email/phone)
3. Campaign status distribution
4. Reply rate
5. Appointment booking rate
6. DLQ queue depth

---

## ✅ Phase 8: Monitoring & Alerts

### 8.1 Set Up Alerts

**Critical alerts:**
- HMAC verification failure rate > 5%
- DLQ depth > 100
- MV refresh failed
- Campaign feeder failed

**Warning alerts:**
- Verification rate < 80%
- Reply rate < 5%
- Duplicate upload rate > 10%

### 8.2 Log Aggregation

**Collect logs from:**
- n8n workflows
- Supabase functions
- Webhook endpoints

---

## ✅ Phase 9: Documentation

### 9.1 Update Team Documentation

**Files created:**
- ✅ `docs/PRODUCTION_PLAN.md` - Complete production plan
- ✅ `docs/PRODUCTION_PLAN_GAP_ANALYSIS.md` - What was missing
- ✅ `docs/HMAC_VERIFICATION_GUIDE.md` - Security implementation
- ✅ `config/supabase-production-migration.sql` - Database migration
- ✅ `docs/PRODUCTION_IMPLEMENTATION_CHECKLIST.md` - This file

### 9.2 Create Runbooks

**Needed runbooks:**
1. How to handle DLQ items
2. How to manually refresh MV
3. How to investigate failed uploads
4. How to rotate HMAC keys

---

## ✅ Phase 10: Go Live

### 10.1 Pre-Launch Checklist

- [ ] Database migration completed successfully
- [ ] All environment variables set
- [ ] HMAC verification tested and working
- [ ] Replay protection tested
- [ ] RLS policies verified
- [ ] Cron jobs scheduled (MV refresh, campaign feeder)
- [ ] Monitoring and alerts configured
- [ ] Team trained on new workflows
- [ ] Rollback plan documented

### 10.2 Launch Steps

1. **Enable new workflows** (disable old ones)
2. **Monitor DLQ** for first 24 hours
3. **Verify MV refresh** runs at 05:30 PT
4. **Verify campaign feeder** runs at 06:00 PT weekdays
5. **Check metrics dashboard** hourly for first day

### 10.3 Post-Launch

**First 24 hours:**
- Monitor error rates
- Check DLQ depth
- Verify data flow
- Respond to alerts

**First week:**
- Review metrics daily
- Optimize slow queries
- Tune alert thresholds
- Document any issues

**First month:**
- Analyze funnel metrics
- Identify bottlenecks
- Plan optimizations
- Collect team feedback

---

## 🚨 Rollback Plan

**If critical issues arise:**

### Database Rollback
1. Restore from backup taken before migration
2. Revert to old workflows
3. Investigate issues offline

### Partial Rollback
1. Keep new database schema (it's backward compatible)
2. Disable HMAC verification temporarily
3. Use old workflows with new schema
4. Fix issues and re-enable security

---

## 📞 Support Contacts

**Database Issues:**
- Supabase Support: support@supabase.io
- Database Admin: [Your DBA contact]

**Workflow Issues:**
- n8n Community: community.n8n.io
- DevOps: [Your DevOps contact]

**Security Issues:**
- Security Team: [Your security contact]
- On-call rotation: [Your oncall schedule]

---

## 📈 Success Metrics

**After 1 week, you should see:**
- ✅ Zero HMAC verification failures (or < 1%)
- ✅ DLQ depth < 10 items
- ✅ 250 leads added to campaigns daily (Mon-Fri)
- ✅ 80%+ email/phone verification rate
- ✅ MV refresh completing in < 5 seconds

**After 1 month:**
- ✅ Improved reply rates (baseline vs current)
- ✅ Faster lead processing (measure duration_ms)
- ✅ No duplicate uploads
- ✅ Clean audit trail in pipeline_events

---

## ✨ Next Steps After Production

1. **Encryption:** Implement pgcrypto for PII fields
2. **Advanced Analytics:** Build comprehensive dashboards
3. **ML Scoring:** Enhance lead scoring with ML models
4. **A/B Testing:** Test different personas and sequences
5. **Multi-Channel:** Add SMS and voice campaigns

---

**Implementation Status:** ⏳ Pending  
**Last Updated:** 2025-10-07  
**Next Review:** After Phase 1 completion

