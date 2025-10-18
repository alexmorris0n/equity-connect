-- =====================================================
-- EQUITY CONNECT - PRODUCTION DATABASE MIGRATION
-- =====================================================
-- Version: 2025-10-07
-- Purpose: Align database with production plan requirements
-- Run order: Execute sections in order as written
-- =====================================================

-- =====================================================
-- SECTION 1: EXTENSIONS
-- =====================================================

-- Enable pgcrypto for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- SECTION 2: ENUMS & CUSTOM TYPES
-- =====================================================

-- Campaign status enum for integrity
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status') THEN
    CREATE TYPE campaign_status AS ENUM (
      'new',
      'queued',
      'active',
      'replied',
      'paused',
      'unsubscribed',
      'bounced',
      'do_not_contact',
      'converted'
    );
  END IF;
END $$;

-- =====================================================
-- SECTION 3: ALTER LEADS TABLE - ADD MISSING COLUMNS
-- =====================================================

-- Email & Phone Verification
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verification_codes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS phone_verification_codes TEXT[] DEFAULT '{}';

-- Campaign Management
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS campaign_status campaign_status DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS added_to_campaign_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_sequence_step INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ;

-- VAPI Integration
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS vapi_call_id TEXT,
  ADD COLUMN IF NOT EXISTS call_attempt_count INT DEFAULT 0;

-- Skip-trace payload storage
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS melissa_payload JSONB DEFAULT '{}'::JSONB;

-- Dedupe keys (for triple-key dedupe: MAK → APN → addr_hash)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS mak TEXT,
  ADD COLUMN IF NOT EXISTS apn TEXT,
  ADD COLUMN IF NOT EXISTS addr_hash TEXT;

-- =====================================================
-- SECTION 4: ADD CONSTRAINTS
-- =====================================================

-- Consent requires timestamp
ALTER TABLE leads
  ADD CONSTRAINT IF NOT EXISTS consent_requires_timestamp
  CHECK (consent = FALSE OR consented_at IS NOT NULL);

-- Lead score must be 0-100
ALTER TABLE leads
  ADD CONSTRAINT IF NOT EXISTS lead_score_range 
  CHECK (lead_score BETWEEN 0 AND 100);

-- =====================================================
-- SECTION 5: CREATE NEW TABLES
-- =====================================================

-- Consent tokens for nonce replay protection
CREATE TABLE IF NOT EXISTS consent_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  nonce_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- Verification code mapping (versionable)
CREATE TABLE IF NOT EXISTS verification_code_map (
  provider TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'phone')),
  code TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (provider, channel, code)
);

-- Pipeline DLQ (Dead Letter Queue)
CREATE TABLE IF NOT EXISTS pipeline_dlq (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  payload JSONB NOT NULL,
  reason TEXT,
  retry_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Leads staging table for CSV validation
CREATE TABLE IF NOT EXISTS leads_staging (
  id BIGSERIAL PRIMARY KEY,
  mak TEXT,
  apn TEXT,
  addr_hash TEXT,
  email TEXT,
  phone TEXT,
  raw JSONB,
  loaded_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

-- Ingest replay guard (prevent duplicate payloads)
CREATE TABLE IF NOT EXISTS ingest_replay_guard (
  content_sha256 TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  request_headers JSONB,
  source TEXT
);

-- Pipeline events for observability
CREATE TABLE IF NOT EXISTS pipeline_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL,
  event_data JSONB DEFAULT '{}'::JSONB,
  duration_ms INT,
  status TEXT, -- 'success', 'failure', 'retry'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Materialized view for contactable leads (to be refreshed via cron)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_contactable_leads AS
SELECT 
  l.id,
  l.email,
  l.phone,
  l.email_verified,
  l.phone_verified,
  l.campaign_status,
  l.lead_score,
  l.assigned_broker_id,
  l.consent,
  l.added_to_campaign_at
FROM leads l
WHERE 
  (l.email_verified = TRUE OR l.phone_verified = TRUE)
  AND l.consent = TRUE
  AND l.campaign_status IN ('new', 'queued', 'active')
  AND l.assigned_broker_id IS NOT NULL;

-- Create index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS mv_contactable_leads_id_idx ON mv_contactable_leads(id);

-- =====================================================
-- SECTION 6: CREATE INDEXES
-- =====================================================

-- Triple-key dedupe indexes (NULL-safe)
CREATE UNIQUE INDEX IF NOT EXISTS leads_mak_unique_idx 
  ON leads(mak) WHERE mak IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS leads_apn_unique_idx 
  ON leads(apn) WHERE apn IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS leads_addr_hash_unique_idx 
  ON leads(addr_hash) WHERE addr_hash IS NOT NULL;

-- Partial/covering indexes for hot paths
CREATE INDEX IF NOT EXISTS leads_feed_hot_idx
  ON leads (added_to_campaign_at, lead_score DESC)
  WHERE campaign_status IN ('queued', 'active') AND phone_verified = TRUE;

CREATE INDEX IF NOT EXISTS leads_replied_lookup_idx
  ON leads (last_reply_at DESC)
  WHERE campaign_status = 'replied';

CREATE INDEX IF NOT EXISTS leads_active_phone_idx
  ON leads (campaign_status, added_to_campaign_at, phone_verified, lead_score DESC);

CREATE INDEX IF NOT EXISTS leads_last_reply_idx
  ON leads (campaign_status, last_reply_at, phone_verified, vapi_call_id, lead_score DESC);

-- Indexes for verification lookups
CREATE INDEX IF NOT EXISTS leads_email_verified_idx 
  ON leads(email_verified) WHERE email_verified = TRUE;

CREATE INDEX IF NOT EXISTS leads_phone_verified_idx 
  ON leads(phone_verified) WHERE phone_verified = TRUE;

-- Campaign status index
CREATE INDEX IF NOT EXISTS leads_campaign_status_idx 
  ON leads(campaign_status, added_to_campaign_at);

-- New table indexes
CREATE INDEX IF NOT EXISTS consent_tokens_lead_id_idx ON consent_tokens(lead_id);
CREATE INDEX IF NOT EXISTS consent_tokens_nonce_hash_idx ON consent_tokens(nonce_hash);
CREATE INDEX IF NOT EXISTS consent_tokens_created_at_idx ON consent_tokens(created_at);

CREATE INDEX IF NOT EXISTS pipeline_dlq_source_idx ON pipeline_dlq(source);
CREATE INDEX IF NOT EXISTS pipeline_dlq_created_at_idx ON pipeline_dlq(created_at);
CREATE INDEX IF NOT EXISTS pipeline_dlq_retry_after_idx ON pipeline_dlq(retry_after) WHERE retry_after IS NOT NULL;

CREATE INDEX IF NOT EXISTS pipeline_events_lead_id_idx ON pipeline_events(lead_id);
CREATE INDEX IF NOT EXISTS pipeline_events_event_type_idx ON pipeline_events(event_type);
CREATE INDEX IF NOT EXISTS pipeline_events_created_at_idx ON pipeline_events(created_at);

CREATE INDEX IF NOT EXISTS leads_staging_processed_idx ON leads_staging(processed) WHERE processed = FALSE;

-- =====================================================
-- SECTION 7: FUNCTIONS & TRIGGERS
-- =====================================================

-- Function: Automatically stamp added_to_campaign_at when campaign_status becomes 'active'
CREATE OR REPLACE FUNCTION set_added_to_campaign_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' 
     AND NEW.campaign_status = 'active' 
     AND (OLD.campaign_status IS DISTINCT FROM 'active') THEN
    NEW.added_to_campaign_at := COALESCE(NEW.added_to_campaign_at, NOW());
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: Apply the function on leads table
DROP TRIGGER IF EXISTS trg_set_added_to_campaign_at ON leads;
CREATE TRIGGER trg_set_added_to_campaign_at
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION set_added_to_campaign_at();

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger: Apply to verification_code_map
DROP TRIGGER IF EXISTS trg_verification_code_map_updated_at ON verification_code_map;
CREATE TRIGGER trg_verification_code_map_updated_at
BEFORE UPDATE ON verification_code_map
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SECTION 8: ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE consent_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_dlq ENABLE ROW LEVEL SECURITY;

-- ============ LEADS TABLE POLICIES ============

-- Broker can INSERT only leads assigned to self
DROP POLICY IF EXISTS broker_leads_insert ON leads;
CREATE POLICY broker_leads_insert ON leads
  FOR INSERT
  WITH CHECK (assigned_broker_id = auth.uid());

-- Broker can UPDATE only leads assigned to self (keep existing, add if missing)
DROP POLICY IF EXISTS broker_leads_modify ON leads;
CREATE POLICY broker_leads_modify ON leads
  FOR UPDATE 
  USING (assigned_broker_id = auth.uid())
  WITH CHECK (assigned_broker_id = auth.uid());

-- Broker can SELECT only leads assigned to self
DROP POLICY IF EXISTS broker_leads_select ON leads;
CREATE POLICY broker_leads_select ON leads
  FOR SELECT
  USING (assigned_broker_id = auth.uid());

-- Pipeline service role: unrestricted write while RLS stays ON
DROP POLICY IF EXISTS pipeline_leads_write ON leads;
CREATE POLICY pipeline_leads_write ON leads
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============ CONSENT_TOKENS POLICIES ============

-- Brokers can only see consent tokens for their leads
DROP POLICY IF EXISTS broker_consent_tokens_select ON consent_tokens;
CREATE POLICY broker_consent_tokens_select ON consent_tokens
  FOR SELECT
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE assigned_broker_id = auth.uid()
    )
  );

-- Service role unrestricted
DROP POLICY IF EXISTS service_consent_tokens_all ON consent_tokens;
CREATE POLICY service_consent_tokens_all ON consent_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============ PIPELINE_EVENTS POLICIES ============

-- Brokers can see events for their leads
DROP POLICY IF EXISTS broker_pipeline_events_select ON pipeline_events;
CREATE POLICY broker_pipeline_events_select ON pipeline_events
  FOR SELECT
  USING (broker_id = auth.uid());

-- Service role unrestricted
DROP POLICY IF EXISTS service_pipeline_events_all ON pipeline_events;
CREATE POLICY service_pipeline_events_all ON pipeline_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============ PIPELINE_DLQ POLICIES ============

-- Only service role can access DLQ
DROP POLICY IF EXISTS service_pipeline_dlq_all ON pipeline_dlq;
CREATE POLICY service_pipeline_dlq_all ON pipeline_dlq
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- SECTION 9: DATABASE ROLES
-- =====================================================

-- Create pipeline_writer role if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pipeline_writer') THEN
    CREATE ROLE pipeline_writer;
  END IF;
END $$;

-- Grant necessary permissions
GRANT INSERT, UPDATE, SELECT ON leads TO pipeline_writer;
GRANT INSERT, SELECT ON pipeline_events TO pipeline_writer;
GRANT INSERT, SELECT ON pipeline_dlq TO pipeline_writer;
GRANT INSERT, SELECT ON leads_staging TO pipeline_writer;
GRANT INSERT, UPDATE, SELECT ON consent_tokens TO pipeline_writer;
GRANT SELECT ON verification_code_map TO pipeline_writer;
GRANT INSERT ON ingest_replay_guard TO pipeline_writer;

-- =====================================================
-- SECTION 10: HELPER FUNCTIONS FOR ENCRYPTION
-- =====================================================

-- Function to encrypt email (requires pgcrypto)
-- Usage: SELECT encrypt_email('test@example.com', 'your-encryption-key');
CREATE OR REPLACE FUNCTION encrypt_email(email TEXT, encryption_key TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(email, encryption_key), 'base64');
END;
$$;

-- Function to decrypt email
CREATE OR REPLACE FUNCTION decrypt_email(encrypted_email TEXT, encryption_key TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_email, 'base64'), encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL; -- Return NULL if decryption fails
END;
$$;

-- Function to hash email for lookups (SHA-256)
CREATE OR REPLACE FUNCTION hash_email(email TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN encode(digest(LOWER(TRIM(email)), 'sha256'), 'hex');
END;
$$;

-- =====================================================
-- SECTION 11: CRON JOB HELPERS (ADVISORY LOCKS)
-- =====================================================

-- Function to safely run cron jobs with advisory locks
-- Usage in cron: SELECT run_with_lock(12345, 'refresh_mv');
CREATE OR REPLACE FUNCTION run_with_lock(lock_key BIGINT, job_name TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  got_lock BOOLEAN;
BEGIN
  -- Try to acquire advisory lock
  SELECT pg_try_advisory_lock(lock_key) INTO got_lock;
  
  IF NOT got_lock THEN
    RAISE NOTICE 'Job % already running, skipping execution', job_name;
    RETURN FALSE;
  END IF;
  
  RAISE NOTICE 'Job % acquired lock, executing', job_name;
  RETURN TRUE;
END;
$$;

-- =====================================================
-- SECTION 12: MATERIALIZED VIEW REFRESH FUNCTION
-- =====================================================

-- Function to refresh mv_contactable_leads with lock
CREATE OR REPLACE FUNCTION refresh_contactable_leads()
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  got_lock BOOLEAN;
BEGIN
  -- Try to get advisory lock (using key 999001)
  SELECT run_with_lock(999001, 'refresh_contactable_leads') INTO got_lock;
  
  IF got_lock THEN
    -- Set timezone
    SET TIME ZONE 'America/Los_Angeles';
    
    -- Refresh materialized view concurrently
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_contactable_leads;
    
    -- Release lock
    PERFORM pg_advisory_unlock(999001);
    
    RAISE NOTICE 'Materialized view refreshed successfully';
  END IF;
END;
$$;

-- =====================================================
-- SECTION 13: UPSERT HELPER FUNCTION WITH SAFE MERGES
-- =====================================================

-- Function to safely upsert lead with boolean/array merges
CREATE OR REPLACE FUNCTION upsert_lead(
  p_mak TEXT,
  p_apn TEXT,
  p_addr_hash TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_skip_payload JSONB DEFAULT '{}'::JSONB,
  p_email_verified BOOLEAN DEFAULT NULL,
  p_phone_verified BOOLEAN DEFAULT NULL,
  p_email_codes TEXT[] DEFAULT '{}'::TEXT[],
  p_phone_codes TEXT[] DEFAULT '{}'::TEXT[]
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_lead_id UUID;
  v_existing_id UUID;
BEGIN
  -- Try to find existing lead by dedupe keys
  SELECT id INTO v_existing_id
  FROM leads
  WHERE (mak = p_mak AND p_mak IS NOT NULL)
     OR (apn = p_apn AND p_apn IS NOT NULL)
     OR (addr_hash = p_addr_hash AND p_addr_hash IS NOT NULL)
  LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    -- Update existing lead with safe merges
    UPDATE leads SET
      melissa_payload = COALESCE(melissa_payload, '{}'::JSONB) || p_skip_payload,
      email_verified = COALESCE(email_verified, FALSE) OR COALESCE(p_email_verified, FALSE),
      phone_verified = COALESCE(phone_verified, FALSE) OR COALESCE(p_phone_verified, FALSE),
      email_verification_codes = COALESCE(email_verification_codes, '{}'::TEXT[]) || p_email_codes,
      phone_verification_codes = COALESCE(phone_verification_codes, '{}'::TEXT[]) || p_phone_codes,
      email = COALESCE(email, p_email),
      phone = COALESCE(phone, p_phone),
      updated_at = NOW()
    WHERE id = v_existing_id;
    
    RETURN v_existing_id;
  ELSE
    -- Insert new lead
    INSERT INTO leads (
      mak, apn, addr_hash, email, phone,
      email_verified, phone_verified,
      email_verification_codes, phone_verification_codes,
      melissa_payload, status, campaign_status
    ) VALUES (
      p_mak, p_apn, p_addr_hash, p_email, p_phone,
      COALESCE(p_email_verified, FALSE),
      COALESCE(p_phone_verified, FALSE),
      p_email_codes, p_phone_codes,
      p_skip_payload, 'new', 'new'
    )
    RETURNING id INTO v_lead_id;
    
    RETURN v_lead_id;
  END IF;
END;
$$;

-- =====================================================
-- SECTION 14: CLEANUP FUNCTIONS
-- =====================================================

-- Function to clean old replay guard entries (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_replay_guards()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM ingest_replay_guard
  WHERE received_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Function to clean old consent tokens (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_consent_tokens()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM consent_tokens
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND used_at IS NOT NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Set up cron job to refresh mv_contactable_leads at 05:30 PT';
  RAISE NOTICE '2. Set up cron job for campaign feeder at 06:00 PT';
  RAISE NOTICE '3. Configure KMS/Vault for encryption keys';
  RAISE NOTICE '4. Update n8n workflows with HMAC verification';
  RAISE NOTICE '5. Test end-to-end with staging data';
  RAISE NOTICE '========================================';
END $$;

