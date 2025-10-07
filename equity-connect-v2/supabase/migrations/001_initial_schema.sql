-- ================================================
-- EQUITY CONNECT V2 - INITIAL SCHEMA
-- Simplified schema optimized for Vercel + Supabase
-- ================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE campaign_status AS ENUM (
    'new', 'queued', 'active', 'sent', 'delivered', 
    'opened', 'clicked', 'replied', 'bounced', 
    'unsubscribed', 'paused', 'completed'
);

CREATE TYPE lead_status AS ENUM (
    'new', 'contacted', 'replied', 'qualified', 
    'appointment_set', 'showed', 'application', 
    'funded', 'closed_lost'
);

CREATE TYPE interaction_type AS ENUM (
    'email_sent', 'email_opened', 'email_clicked', 'email_replied',
    'ai_call', 'appointment', 'sms_sent', 'sms_replied'
);

CREATE TYPE billing_event_type AS ENUM (
    'qualified_lead', 'appointment_set', 'appointment_showed', 
    'application_submitted', 'deal_funded'
);

-- ================================================
-- CORE TABLES
-- ================================================

-- Brokers table
CREATE TABLE brokers (
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
CREATE TABLE leads (
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
    consent BOOLEAN DEFAULT false,
    consented_at TIMESTAMPTZ,
    consent_method TEXT CHECK (consent_method IN ('form', 'reply_yes', 'voice', 'manual')),
    
    -- Appointment tracking
    appointment_scheduled_at TIMESTAMPTZ,
    call_outcome TEXT,
    
    -- Data and metadata
    enrichment_data JSONB,
    source TEXT DEFAULT 'PropStream',
    notes TEXT,
    
    -- Security and deduplication
    dedupe_key TEXT,
    upload_batch_id TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interactions table
CREATE TABLE interactions (
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
CREATE TABLE billing_events (
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

-- Pipeline events (for analytics and monitoring)
CREATE TABLE pipeline_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    event_data JSONB,
    lead_id UUID REFERENCES leads(id),
    broker_id UUID REFERENCES brokers(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Microsites table
CREATE TABLE microsites (
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

-- ================================================
-- INDEXES FOR PERFORMANCE
-- ================================================

-- Leads table indexes
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_broker_id ON leads(assigned_broker_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_campaign_status ON leads(campaign_status);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_last_engagement ON leads(last_engagement);

-- Composite indexes for common queries
CREATE INDEX idx_leads_broker_status ON leads(assigned_broker_id, status);
CREATE INDEX idx_leads_status_created ON leads(status, created_at);
CREATE INDEX idx_leads_campaign_active ON leads(campaign_status) WHERE campaign_status IN ('active', 'queued');

-- Interactions table indexes
CREATE INDEX idx_interactions_lead_id ON interactions(lead_id);
CREATE INDEX idx_interactions_broker_id ON interactions(broker_id);
CREATE INDEX idx_interactions_type ON interactions(type);
CREATE INDEX idx_interactions_created_at ON interactions(created_at);

-- Billing events indexes
CREATE INDEX idx_billing_broker_id ON billing_events(broker_id);
CREATE INDEX idx_billing_status ON billing_events(status);
CREATE INDEX idx_billing_created_at ON billing_events(created_at);

-- Pipeline events indexes
CREATE INDEX idx_pipeline_events_type ON pipeline_events(event_type);
CREATE INDEX idx_pipeline_events_created_at ON pipeline_events(created_at);
CREATE INDEX idx_pipeline_events_lead_id ON pipeline_events(lead_id);

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

-- Enable RLS on all tables
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsites ENABLE ROW LEVEL SECURITY;

-- Broker policies (brokers can only see their own data)
CREATE POLICY broker_select_own ON brokers
    FOR SELECT USING (id = auth.uid());

CREATE POLICY broker_update_own ON brokers
    FOR UPDATE USING (id = auth.uid());

-- Lead policies (brokers can only see their assigned leads)
CREATE POLICY broker_leads_select ON leads
    FOR SELECT USING (assigned_broker_id = auth.uid());

CREATE POLICY broker_leads_update ON leads
    FOR UPDATE USING (assigned_broker_id = auth.uid());

-- Service role policy (for API functions)
CREATE POLICY service_role_all ON leads
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY service_role_interactions ON interactions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY service_role_billing ON billing_events
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY service_role_pipeline ON pipeline_events
    FOR ALL USING (auth.role() = 'service_role');

-- ================================================
-- TRIGGERS AND FUNCTIONS
-- ================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_brokers_updated_at
    BEFORE UPDATE ON brokers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_microsites_updated_at
    BEFORE UPDATE ON microsites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to increment interaction count
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

CREATE TRIGGER increment_lead_interactions
    AFTER INSERT ON interactions
    FOR EACH ROW EXECUTE FUNCTION increment_interaction_count();

-- ================================================
-- VIEWS FOR ANALYTICS
-- ================================================

-- Active leads view
CREATE VIEW active_leads AS
SELECT 
    l.*,
    b.company_name as broker_company,
    b.contact_name as broker_contact
FROM leads l
LEFT JOIN brokers b ON l.assigned_broker_id = b.id
WHERE l.status NOT IN ('closed_lost', 'funded');

-- Lead funnel stats
CREATE VIEW lead_funnel_stats AS
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
CREATE VIEW broker_performance AS
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

-- ================================================
-- SEED DATA
-- ================================================

-- Insert a default broker for testing
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

-- ================================================
-- FINAL SETUP
-- ================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Equity Connect v2 database schema initialized successfully!';
    RAISE NOTICE 'Tables created: brokers, leads, interactions, billing_events, pipeline_events, microsites';
    RAISE NOTICE 'RLS policies enabled for data security';
    RAISE NOTICE 'Views created for analytics: active_leads, lead_funnel_stats, broker_performance';
END $$;
