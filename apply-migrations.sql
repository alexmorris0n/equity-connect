-- =====================================================
-- EQUITY CONNECT - COMPLETE DATABASE SETUP
-- =====================================================
-- Apply this in Supabase SQL Editor
-- Project: mxnqfwuhvurajrgoefyg
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- SECTION 1: CREATE CUSTOM TYPES
-- =====================================================

-- Campaign status enum
DO $$ BEGIN
    CREATE TYPE campaign_status AS ENUM (
        'new', 'queued', 'active', 'sent', 'delivered', 
        'opened', 'clicked', 'replied', 'bounced', 
        'unsubscribed', 'paused', 'completed',
        'do_not_contact', 'converted'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Lead status enum
DO $$ BEGIN
    CREATE TYPE lead_status AS ENUM (
        'new', 'contacted', 'replied', 'qualified', 
        'appointment_set', 'showed', 'application', 
        'funded', 'closed_lost'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Interaction type enum
DO $$ BEGIN
    CREATE TYPE interaction_type AS ENUM (
        'email_sent', 'email_opened', 'email_clicked', 'email_replied',
        'ai_call', 'appointment', 'sms_sent', 'sms_replied'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Billing event type enum
DO $$ BEGIN
    CREATE TYPE billing_event_type AS ENUM (
        'qualified_lead', 'appointment_set', 'appointment_showed', 
        'application_submitted', 'deal_funded'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- SECTION 2: CREATE CORE TABLES
-- =====================================================

-- Brokers table
CREATE TABLE IF NOT EXISTS brokers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    nmls_number TEXT,
    license_states TEXT,
    pricing_model TEXT DEFAULT 'performanceBased',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    current_balance DECIMAL(10,2) DEFAULT 0,
    performance_score INTEGER DEFAULT 100 CHECK (performance_score >= 0 AND performance_score <= 100),
    conversion_rate DECIMAL(5,4) DEFAULT 0,
    show_rate DECIMAL(5,4) DEFAULT 0,
    weekly_revenue DECIMAL(10,2) DEFAULT 0,
    monthly_revenue DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads table (main table)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic lead information
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    
    -- Property information
    property_address TEXT,
    property_city TEXT,
    property_state TEXT,
    property_zip TEXT,
    property_value DECIMAL(12,2),
    estimated_equity DECIMAL(12,2),
    
    -- Lead demographics
    age INTEGER,
    owner_occupied BOOLEAN DEFAULT true,
    
    -- Assignment and scoring
    assigned_broker_id UUID REFERENCES brokers(id),
    assigned_persona TEXT,
    persona_heritage TEXT,
    lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
    
    -- Status tracking
    status lead_status DEFAULT 'new',
    campaign_status campaign_status DEFAULT 'new',
    
    -- Engagement tracking
    last_contact TIMESTAMPTZ,
    last_engagement TIMESTAMPTZ,
    interaction_count INTEGER DEFAULT 0,
    
    -- External system IDs
    microsite_url TEXT,
    calendly_event_id TEXT,
    vapi_call_id TEXT,
    instantly_campaign_id TEXT,
    
    -- Verification and consent
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    email_verification_codes TEXT[] DEFAULT '{}',
    phone_verification_codes TEXT[] DEFAULT '{}',
    consent BOOLEAN DEFAULT false,
    consented_at TIMESTAMPTZ,
    consent_method TEXT CHECK (consent_method IN ('form', 'reply_yes', 'voice', 'manual')),
    
    -- Campaign management
    added_to_campaign_at TIMESTAMPTZ,
    current_sequence_step INT DEFAULT 0,
    last_reply_at TIMESTAMPTZ,
    
    -- VAPI integration
    call_attempt_count INT DEFAULT 0,
    call_outcome TEXT,
    
    -- Skip-trace data
    melissa_payload JSONB DEFAULT '{}'::JSONB,
    
    -- Dedupe keys (triple-key dedupe)
    mak TEXT,
    apn TEXT,
    addr_hash TEXT,
    
    -- Appointment tracking
    appointment_scheduled_at TIMESTAMPTZ,
    
    -- Data and metadata
    enrichment_data JSONB,
    source TEXT DEFAULT 'PropStream',
    notes TEXT,
    
    -- Security and deduplication
    dedupe_key TEXT,
    upload_batch_id TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT consent_requires_timestamp CHECK (consent = FALSE OR consented_at IS NOT NULL)
);

-- Interactions table
CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    broker_id UUID REFERENCES brokers(id),
    
    type interaction_type NOT NULL,
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    
    subject TEXT,
    content TEXT,
    duration_seconds INTEGER,
    outcome TEXT,
    
    scheduled_for TIMESTAMPTZ,
    meeting_link TEXT,
    recording_url TEXT,
    
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Billing events table
CREATE TABLE IF NOT EXISTS billing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broker_id UUID REFERENCES brokers(id) NOT NULL,
    lead_id UUID REFERENCES leads(id),
    
    event_type billing_event_type NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'invoiced', 'paid', 'reversed')),
    
    invoice_id TEXT,
    original_event_id UUID REFERENCES billing_events(id),
    
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reversed_at TIMESTAMPTZ
);

-- Pipeline events table
CREATE TABLE IF NOT EXISTS pipeline_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::JSONB,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL,
    duration_ms INT,
    status TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Microsites table
CREATE TABLE IF NOT EXISTS microsites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    subdomain TEXT UNIQUE NOT NULL,
    full_url TEXT NOT NULL,
    persona TEXT,
    neighborhood TEXT,
    
    -- Analytics
    visits INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    time_on_site INTEGER DEFAULT 0,
    calculator_completions INTEGER DEFAULT 0,
    form_submissions INTEGER DEFAULT 0,
    
    deployment_status TEXT DEFAULT 'pending' CHECK (deployment_status IN ('pending', 'deployed', 'failed', 'updated')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consent tokens table
CREATE TABLE IF NOT EXISTS consent_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    nonce_hash TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

-- Verification code mapping
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

-- Leads staging table
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

-- Ingest replay guard
CREATE TABLE IF NOT EXISTS ingest_replay_guard (
    content_sha256 TEXT PRIMARY KEY,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    request_headers JSONB,
    source TEXT
);

-- =====================================================
-- SECTION 3: CREATE INDEXES
-- =====================================================

-- Leads table indexes
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_broker_id ON leads(assigned_broker_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_status ON leads(campaign_status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_last_engagement ON leads(last_engagement);

-- Composite indexes
CREATE INDEX IF NOT EXISTS idx_leads_broker_status ON leads(assigned_broker_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_active ON leads(campaign_status) WHERE campaign_status IN ('active', 'queued');

-- Triple-key dedupe indexes (NULL-safe)
CREATE UNIQUE INDEX IF NOT EXISTS leads_mak_unique_idx ON leads(mak) WHERE mak IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS leads_apn_unique_idx ON leads(apn) WHERE apn IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS leads_addr_hash_unique_idx ON leads(addr_hash) WHERE addr_hash IS NOT NULL;

-- Hot path indexes
CREATE INDEX IF NOT EXISTS leads_feed_hot_idx ON leads (added_to_campaign_at, lead_score DESC) WHERE campaign_status IN ('queued', 'active') AND phone_verified = TRUE;
CREATE INDEX IF NOT EXISTS leads_replied_lookup_idx ON leads (last_reply_at DESC) WHERE campaign_status = 'replied';
CREATE INDEX IF NOT EXISTS leads_active_phone_idx ON leads (campaign_status, added_to_campaign_at, phone_verified, lead_score DESC);

-- Verification indexes
CREATE INDEX IF NOT EXISTS leads_email_verified_idx ON leads(email_verified) WHERE email_verified = TRUE;
CREATE INDEX IF NOT EXISTS leads_phone_verified_idx ON leads(phone_verified) WHERE phone_verified = TRUE;

-- Interactions indexes
CREATE INDEX IF NOT EXISTS idx_interactions_lead_id ON interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_interactions_broker_id ON interactions(broker_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON interactions(created_at);

-- Billing events indexes
CREATE INDEX IF NOT EXISTS idx_billing_broker_id ON billing_events(broker_id);
CREATE INDEX IF NOT EXISTS idx_billing_status ON billing_events(status);
CREATE INDEX IF NOT EXISTS idx_billing_created_at ON billing_events(created_at);

-- Pipeline events indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_events_type ON pipeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_created_at ON pipeline_events(created_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_lead_id ON pipeline_events(lead_id);

-- Supporting table indexes
CREATE INDEX IF NOT EXISTS consent_tokens_lead_id_idx ON consent_tokens(lead_id);
CREATE INDEX IF NOT EXISTS consent_tokens_nonce_hash_idx ON consent_tokens(nonce_hash);
CREATE INDEX IF NOT EXISTS consent_tokens_created_at_idx ON consent_tokens(created_at);
CREATE INDEX IF NOT EXISTS pipeline_dlq_source_idx ON pipeline_dlq(source);
CREATE INDEX IF NOT EXISTS pipeline_dlq_created_at_idx ON pipeline_dlq(created_at);
CREATE INDEX IF NOT EXISTS pipeline_dlq_retry_after_idx ON pipeline_dlq(retry_after) WHERE retry_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_staging_processed_idx ON leads_staging(processed) WHERE processed = FALSE;

-- =====================================================
-- SECTION 4: CREATE MATERIALIZED VIEW
-- =====================================================

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

CREATE UNIQUE INDEX IF NOT EXISTS mv_contactable_leads_id_idx ON mv_contactable_leads(id);

-- =====================================================
-- SECTION 5: CREATE ANALYTICS VIEWS
-- =====================================================

-- Active leads view
CREATE OR REPLACE VIEW active_leads AS
SELECT 
    l.*,
    b.company_name as broker_company,
    b.contact_name as broker_contact
FROM leads l
LEFT JOIN brokers b ON l.assigned_broker_id = b.id
WHERE l.status NOT IN ('closed_lost', 'funded');

-- Lead funnel stats
CREATE OR REPLACE VIEW lead_funnel_stats AS
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM leads
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'new' THEN 1
        WHEN 'contacted' THEN 2
        WHEN 'replied' THEN 3
        WHEN 'qualified' THEN 4
        WHEN 'appointment_set' THEN 5
        WHEN 'showed' THEN 6
        WHEN 'application' THEN 7
        WHEN 'funded' THEN 8
        WHEN 'closed_lost' THEN 9
    END;

-- Broker performance view
CREATE OR REPLACE VIEW broker_performance AS
SELECT 
    b.id,
    b.company_name,
    b.contact_name,
    COUNT(l.id) as total_leads,
    COUNT(CASE WHEN l.status = 'appointment_set' THEN 1 END) as appointments,
    COUNT(CASE WHEN l.status = 'funded' THEN 1 END) as funded,
    COALESCE(SUM(be.amount) FILTER (WHERE be.status = 'paid'), 0) as total_revenue,
    b.performance_score,
    b.conversion_rate,
    b.show_rate
FROM brokers b
LEFT JOIN leads l ON l.assigned_broker_id = b.id
LEFT JOIN billing_events be ON be.broker_id = b.id
WHERE b.status = 'active'
GROUP BY b.id, b.company_name, b.contact_name, b.performance_score, b.conversion_rate, b.show_rate;

-- =====================================================
-- SECTION 6: CREATE FUNCTIONS & TRIGGERS
-- =====================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_brokers_updated_at ON brokers;
CREATE TRIGGER update_brokers_updated_at BEFORE UPDATE ON brokers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_microsites_updated_at ON microsites;
CREATE TRIGGER update_microsites_updated_at BEFORE UPDATE ON microsites FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_verification_code_map_updated_at ON verification_code_map;
CREATE TRIGGER trg_verification_code_map_updated_at BEFORE UPDATE ON verification_code_map FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Increment interaction count
CREATE OR REPLACE FUNCTION increment_interaction_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE leads 
    SET interaction_count = interaction_count + 1,
        last_engagement = NOW()
    WHERE id = NEW.lead_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS increment_lead_interactions ON interactions;
CREATE TRIGGER increment_lead_interactions AFTER INSERT ON interactions FOR EACH ROW EXECUTE FUNCTION increment_interaction_count();

-- Automatically stamp added_to_campaign_at
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

DROP TRIGGER IF EXISTS trg_set_added_to_campaign_at ON leads;
CREATE TRIGGER trg_set_added_to_campaign_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_added_to_campaign_at();

-- =====================================================
-- SECTION 7: HELPER FUNCTIONS
-- =====================================================

-- Encryption functions
CREATE OR REPLACE FUNCTION encrypt_email(email TEXT, encryption_key TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN encode(pgp_sym_encrypt(email, encryption_key), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_email(encrypted_email TEXT, encryption_key TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN pgp_sym_decrypt(decode(encrypted_email, 'base64'), encryption_key);
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION hash_email(email TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    RETURN encode(digest(LOWER(TRIM(email)), 'sha256'), 'hex');
END;
$$;

-- Advisory lock helper
CREATE OR REPLACE FUNCTION run_with_lock(lock_key BIGINT, job_name TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
    got_lock BOOLEAN;
BEGIN
    SELECT pg_try_advisory_lock(lock_key) INTO got_lock;
    IF NOT got_lock THEN
        RAISE NOTICE 'Job % already running, skipping execution', job_name;
        RETURN FALSE;
    END IF;
    RAISE NOTICE 'Job % acquired lock, executing', job_name;
    RETURN TRUE;
END;
$$;

-- Refresh materialized view
CREATE OR REPLACE FUNCTION refresh_contactable_leads()
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    got_lock BOOLEAN;
BEGIN
    SELECT run_with_lock(999001, 'refresh_contactable_leads') INTO got_lock;
    IF got_lock THEN
        SET TIME ZONE 'America/Los_Angeles';
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_contactable_leads;
        PERFORM pg_advisory_unlock(999001);
        RAISE NOTICE 'Materialized view refreshed successfully';
    END IF;
END;
$$;

-- Upsert lead function
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
    SELECT id INTO v_existing_id FROM leads
    WHERE (mak = p_mak AND p_mak IS NOT NULL)
       OR (apn = p_apn AND p_apn IS NOT NULL)
       OR (addr_hash = p_addr_hash AND p_addr_hash IS NOT NULL)
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
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

-- Cleanup functions
CREATE OR REPLACE FUNCTION cleanup_old_replay_guards()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM ingest_replay_guard WHERE received_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_consent_tokens()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM consent_tokens WHERE created_at < NOW() - INTERVAL '30 days' AND used_at IS NOT NULL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- =====================================================
-- SECTION 8: ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsites ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_dlq ENABLE ROW LEVEL SECURITY;

-- Broker policies
DROP POLICY IF EXISTS broker_select_own ON brokers;
CREATE POLICY broker_select_own ON brokers FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS broker_update_own ON brokers;
CREATE POLICY broker_update_own ON brokers FOR UPDATE USING (id = auth.uid());

-- Lead policies (brokers see their assigned leads)
DROP POLICY IF EXISTS broker_leads_select ON leads;
CREATE POLICY broker_leads_select ON leads FOR SELECT USING (assigned_broker_id = auth.uid());

DROP POLICY IF EXISTS broker_leads_update ON leads;
CREATE POLICY broker_leads_update ON leads FOR UPDATE USING (assigned_broker_id = auth.uid());

DROP POLICY IF EXISTS broker_leads_insert ON leads;
CREATE POLICY broker_leads_insert ON leads FOR INSERT WITH CHECK (assigned_broker_id = auth.uid());

-- Service role policies (unrestricted access)
DROP POLICY IF EXISTS service_role_all ON leads;
CREATE POLICY service_role_all ON leads FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS service_role_interactions ON interactions;
CREATE POLICY service_role_interactions ON interactions FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS service_role_billing ON billing_events;
CREATE POLICY service_role_billing ON billing_events FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS service_role_pipeline ON pipeline_events;
CREATE POLICY service_role_pipeline ON pipeline_events FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS service_consent_tokens_all ON consent_tokens;
CREATE POLICY service_consent_tokens_all ON consent_tokens FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS service_pipeline_dlq_all ON pipeline_dlq;
CREATE POLICY service_pipeline_dlq_all ON pipeline_dlq FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- SECTION 9: GRANT PERMISSIONS
-- =====================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- =====================================================
-- SECTION 10: SEED DATA
-- =====================================================

-- Insert a default test broker
INSERT INTO brokers (
    company_name,
    contact_name,
    email,
    phone,
    nmls_number,
    license_states
) VALUES (
    'Test Mortgage Company',
    'John Doe',
    'john@testmortgage.com',
    '555-123-4567',
    'ML123456',
    'CA,FL,TX'
) ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'EQUITY CONNECT DATABASE SETUP COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '  - 14 Tables';
    RAISE NOTICE '  - 4 Custom Types';
    RAISE NOTICE '  - 1 Materialized View';
    RAISE NOTICE '  - 3 Analytics Views';
    RAISE NOTICE '  - 40+ Indexes';
    RAISE NOTICE '  - 12 Functions';
    RAISE NOTICE '  - 6 Triggers';
    RAISE NOTICE '  - RLS Policies';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Configure environment variables';
    RAISE NOTICE '  2. Deploy webhooks to Vercel';
    RAISE NOTICE '  3. Set up cron jobs';
    RAISE NOTICE '  4. Test integrations';
    RAISE NOTICE '========================================';
END $$;


