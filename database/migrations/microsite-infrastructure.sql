-- =====================================================
-- MICROSITE INFRASTRUCTURE MIGRATION
-- =====================================================
-- Version: 2025-10-17
-- Purpose: City-based microsites with encrypted lead tokens
-- Strategy: Geo-based personalization (no ethnic profiling)
-- =====================================================

-- =====================================================
-- TABLE 1: City Microsite Configurations
-- =====================================================
-- Stores city-specific content and stats for dynamic microsites
-- Auto-populated from lead data (no manual entry required)

CREATE TABLE IF NOT EXISTS city_microsite_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name TEXT NOT NULL,
  state_code TEXT NOT NULL,
  
  -- Calculated Stats (from lead data)
  avg_home_value NUMERIC,
  avg_equity NUMERIC,
  median_home_value NUMERIC,
  median_equity NUMERIC,
  total_homeowners_62_plus INTEGER DEFAULT 0,
  total_properties_tracked INTEGER DEFAULT 0,
  
  -- City-Specific Content (JSON for flexibility)
  local_facts JSONB DEFAULT '[]'::JSONB,
  -- Example: ["Historic craftsman homes", "Near Rose Bowl", "Strong appreciation market"]
  
  trust_signals JSONB DEFAULT '{}'::JSONB,
  -- Example: {"years_serving": "15+", "families_helped": "500+", "avg_rating": "4.9"}
  
  seo_keywords TEXT[],
  -- Example: ["Los Angeles reverse mortgage", "LA home equity", "senior housing LA"]
  
  -- Metadata
  last_stats_update TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(city_name, state_code)
);

COMMENT ON TABLE city_microsite_configs IS 'City-specific microsite content - auto-populated from lead data';
COMMENT ON COLUMN city_microsite_configs.local_facts IS 'Array of city-specific selling points (no ethnic references)';

-- Create indexes
CREATE INDEX idx_city_configs_city_state ON city_microsite_configs(city_name, state_code);
CREATE INDEX idx_city_configs_active ON city_microsite_configs(is_active) WHERE is_active = TRUE;

-- =====================================================
-- TABLE 2: Lead Microsite Tokens
-- =====================================================
-- Secure encrypted tokens for personalized microsite access
-- One token per lead per microsite type

CREATE TABLE IF NOT EXISTS lead_microsite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  
  -- Token Security
  token_hash TEXT UNIQUE NOT NULL, -- SHA256 of encrypted token (for lookup)
  token_encrypted TEXT NOT NULL, -- Actual encrypted token (AES-256)
  
  -- Token Metadata
  microsite_type TEXT NOT NULL CHECK (microsite_type IN ('city_page', 'calculator', 'schedule')),
  domain_used TEXT, -- Which rotating domain was used in email
  email_sequence_step INTEGER, -- Which email included this link (1-4)
  
  -- Expiration & Security
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '90 days'),
  is_expired BOOLEAN GENERATED ALWAYS AS (expires_at < NOW()) STORED,
  max_visits INTEGER DEFAULT NULL, -- NULL = unlimited, or set limit (e.g., 10)
  
  -- Visit Tracking
  first_visited_at TIMESTAMP,
  last_visited_at TIMESTAMP,
  visit_count INTEGER DEFAULT 0,
  last_visit_city TEXT, -- Detected city from Vercel geo
  last_visit_state TEXT, -- Detected state from Vercel geo
  last_visit_ip TEXT, -- For fraud detection
  last_visit_user_agent TEXT,
  
  -- Conversion Tracking
  converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMP,
  conversion_type TEXT, -- 'form_submit', 'phone_call', 'schedule_click'
  
  -- Performance
  time_to_first_visit_seconds INTEGER, -- Time from email send to first click
  time_on_site_seconds INTEGER, -- Total time spent on microsite
  
  UNIQUE(lead_id, microsite_type) -- One token per lead per type
);

COMMENT ON TABLE lead_microsite_tokens IS 'Encrypted tokens for secure personalized microsite access';
COMMENT ON COLUMN lead_microsite_tokens.token_hash IS 'SHA256 hash for lookup (cannot be reversed)';
COMMENT ON COLUMN lead_microsite_tokens.token_encrypted IS 'AES-256 encrypted token containing lead_id + metadata';

-- Create indexes for performance
CREATE INDEX idx_lead_tokens_lead_id ON lead_microsite_tokens(lead_id);
CREATE INDEX idx_lead_tokens_hash ON lead_microsite_tokens(token_hash);
CREATE INDEX idx_lead_tokens_expires ON lead_microsite_tokens(expires_at) WHERE is_expired = FALSE;
CREATE INDEX idx_lead_tokens_type ON lead_microsite_tokens(microsite_type);
CREATE INDEX idx_lead_tokens_converted ON lead_microsite_tokens(converted) WHERE converted = TRUE;

-- =====================================================
-- TABLE 3: Update Leads Table
-- =====================================================
-- Add microsite tracking columns to leads

ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS microsite_token_id UUID REFERENCES lead_microsite_tokens(id),
  ADD COLUMN IF NOT EXISTS microsite_visits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS microsite_last_visit TIMESTAMP,
  ADD COLUMN IF NOT EXISTS microsite_converted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN leads.microsite_token_id IS 'Reference to active microsite token';
COMMENT ON COLUMN leads.microsite_visits IS 'Total microsite visits across all tokens';

-- =====================================================
-- FUNCTION 1: Auto-Populate City Configs from Leads
-- =====================================================
-- Run this periodically (daily) to keep city stats fresh

CREATE OR REPLACE FUNCTION refresh_city_microsite_configs()
RETURNS INTEGER AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Upsert city configs based on current lead data
  INSERT INTO city_microsite_configs (
    city_name,
    state_code,
    avg_home_value,
    avg_equity,
    median_home_value,
    median_equity,
    total_homeowners_62_plus,
    total_properties_tracked,
    last_stats_update
  )
  SELECT 
    property_city,
    property_state,
    ROUND(AVG(property_value))::NUMERIC as avg_home_value,
    ROUND(AVG(estimated_equity))::NUMERIC as avg_equity,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY property_value) as median_home_value,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY estimated_equity) as median_equity,
    COUNT(*) FILTER (WHERE age >= 62) as total_homeowners_62_plus,
    COUNT(*) as total_properties_tracked,
    NOW() as last_stats_update
  FROM leads
  WHERE 
    property_city IS NOT NULL
    AND property_state IS NOT NULL
    AND property_value > 0
  GROUP BY property_city, property_state
  HAVING COUNT(*) >= 5 -- Only create config if we have 5+ leads in city
  
  ON CONFLICT (city_name, state_code) DO UPDATE SET
    avg_home_value = EXCLUDED.avg_home_value,
    avg_equity = EXCLUDED.avg_equity,
    median_home_value = EXCLUDED.median_home_value,
    median_equity = EXCLUDED.median_equity,
    total_homeowners_62_plus = EXCLUDED.total_homeowners_62_plus,
    total_properties_tracked = EXCLUDED.total_properties_tracked,
    last_stats_update = NOW(),
    updated_at = NOW();
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_city_microsite_configs IS 'Auto-populates city stats from lead data - run daily';

-- =====================================================
-- FUNCTION 2: Generate Microsite Token (Called from n8n)
-- =====================================================
-- Creates encrypted token and stores hash in database

CREATE OR REPLACE FUNCTION generate_microsite_token(
  p_lead_id UUID,
  p_microsite_type TEXT,
  p_domain_used TEXT DEFAULT NULL,
  p_email_sequence_step INTEGER DEFAULT NULL
)
RETURNS TABLE(
  token_id UUID,
  token_hash TEXT,
  expires_at TIMESTAMP
) AS $$
DECLARE
  v_token_hash TEXT;
  v_token_id UUID;
  v_expires_at TIMESTAMP;
BEGIN
  -- Generate SHA256 hash (actual encryption happens in application layer)
  -- This is a placeholder - actual token encryption happens in n8n/Vercel
  v_token_hash := encode(
    digest(p_lead_id::TEXT || NOW()::TEXT || random()::TEXT, 'sha256'),
    'hex'
  );
  
  v_expires_at := NOW() + INTERVAL '90 days';
  
  -- Insert or update token
  INSERT INTO lead_microsite_tokens (
    lead_id,
    token_hash,
    token_encrypted, -- Will be updated by n8n with actual encrypted token
    microsite_type,
    domain_used,
    email_sequence_step,
    expires_at
  ) VALUES (
    p_lead_id,
    v_token_hash,
    v_token_hash, -- Placeholder until n8n updates with real encrypted token
    p_microsite_type,
    p_domain_used,
    p_email_sequence_step,
    v_expires_at
  )
  ON CONFLICT (lead_id, microsite_type) DO UPDATE SET
    token_hash = EXCLUDED.token_hash,
    token_encrypted = EXCLUDED.token_encrypted,
    domain_used = EXCLUDED.domain_used,
    expires_at = EXCLUDED.expires_at,
    created_at = NOW() -- Reset creation time for new token
  RETURNING id, token_hash, expires_at INTO v_token_id, v_token_hash, v_expires_at;
  
  -- Update lead reference
  UPDATE leads SET microsite_token_id = v_token_id WHERE id = p_lead_id;
  
  RETURN QUERY SELECT v_token_id, v_token_hash, v_expires_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_microsite_token IS 'Generate microsite token for lead - called from n8n workflow';

-- =====================================================
-- FUNCTION 3: Log Microsite Visit
-- =====================================================
-- Called by Vercel edge function when lead visits microsite

CREATE OR REPLACE FUNCTION log_microsite_visit(
  p_token_hash TEXT,
  p_detected_city TEXT DEFAULT NULL,
  p_detected_state TEXT DEFAULT NULL,
  p_visitor_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_token_record RECORD;
  v_is_first_visit BOOLEAN;
BEGIN
  -- Get token record
  SELECT * INTO v_token_record
  FROM lead_microsite_tokens
  WHERE token_hash = p_token_hash;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;
  
  -- Check expiration
  IF v_token_record.expires_at < NOW() THEN
    RETURN json_build_object('success', false, 'error', 'Token expired');
  END IF;
  
  -- Check max visits
  IF v_token_record.max_visits IS NOT NULL AND v_token_record.visit_count >= v_token_record.max_visits THEN
    RETURN json_build_object('success', false, 'error', 'Max visits exceeded');
  END IF;
  
  v_is_first_visit := (v_token_record.first_visited_at IS NULL);
  
  -- Update token record
  UPDATE lead_microsite_tokens SET
    first_visited_at = COALESCE(first_visited_at, NOW()),
    last_visited_at = NOW(),
    visit_count = visit_count + 1,
    last_visit_city = COALESCE(p_detected_city, last_visit_city),
    last_visit_state = COALESCE(p_detected_state, last_visit_state),
    last_visit_ip = COALESCE(p_visitor_ip, last_visit_ip),
    last_visit_user_agent = COALESCE(p_user_agent, last_visit_user_agent)
  WHERE token_hash = p_token_hash;
  
  -- Update lead visit counts
  UPDATE leads SET
    microsite_visits = microsite_visits + 1,
    microsite_last_visit = NOW()
  WHERE id = v_token_record.lead_id;
  
  RETURN json_build_object(
    'success', true, 
    'lead_id', v_token_record.lead_id,
    'is_first_visit', v_is_first_visit,
    'visit_count', v_token_record.visit_count + 1
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_microsite_visit IS 'Log microsite visit - called from Vercel edge function';

-- =====================================================
-- FUNCTION 4: Mark Microsite Conversion
-- =====================================================
-- Called when lead submits form or schedules appointment from microsite

CREATE OR REPLACE FUNCTION mark_microsite_conversion(
  p_token_hash TEXT,
  p_conversion_type TEXT
)
RETURNS JSON AS $$
DECLARE
  v_lead_id UUID;
BEGIN
  -- Update token record
  UPDATE lead_microsite_tokens SET
    converted = TRUE,
    converted_at = NOW(),
    conversion_type = p_conversion_type
  WHERE token_hash = p_token_hash
  RETURNING lead_id INTO v_lead_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;
  
  -- Update lead status
  UPDATE leads SET
    microsite_converted = TRUE,
    status = CASE 
      WHEN p_conversion_type = 'schedule_click' THEN 'appointment_requested'
      WHEN p_conversion_type = 'phone_call' THEN 'called'
      ELSE 'replied'
    END
  WHERE id = v_lead_id;
  
  RETURN json_build_object('success', true, 'lead_id', v_lead_id);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEW: Microsite Performance by City
-- =====================================================

CREATE OR REPLACE VIEW vw_microsite_performance_by_city AS
SELECT 
  l.property_city,
  l.property_state,
  COUNT(DISTINCT lmt.lead_id) as leads_with_tokens,
  COUNT(DISTINCT lmt.id) FILTER (WHERE lmt.visit_count > 0) as tokens_visited,
  SUM(lmt.visit_count) as total_visits,
  ROUND(AVG(lmt.visit_count), 2) as avg_visits_per_lead,
  COUNT(*) FILTER (WHERE lmt.converted = TRUE) as conversions,
  ROUND(
    COUNT(*) FILTER (WHERE lmt.converted = TRUE)::NUMERIC / 
    NULLIF(COUNT(DISTINCT lmt.id) FILTER (WHERE lmt.visit_count > 0), 0) * 100,
    2
  ) as conversion_rate_percent,
  ROUND(AVG(lmt.time_on_site_seconds), 0) as avg_time_on_site_seconds,
  cmc.avg_home_value as city_avg_home_value,
  cmc.avg_equity as city_avg_equity
FROM leads l
LEFT JOIN lead_microsite_tokens lmt ON lmt.lead_id = l.id
LEFT JOIN city_microsite_configs cmc ON cmc.city_name = l.property_city AND cmc.state_code = l.property_state
WHERE l.property_city IS NOT NULL
GROUP BY l.property_city, l.property_state, cmc.avg_home_value, cmc.avg_equity
ORDER BY total_visits DESC;

GRANT SELECT ON vw_microsite_performance_by_city TO anon, authenticated, service_role;

-- =====================================================
-- VIEW: Token Status Dashboard
-- =====================================================

CREATE OR REPLACE VIEW vw_token_status_dashboard AS
SELECT 
  microsite_type,
  COUNT(*) as total_tokens,
  COUNT(*) FILTER (WHERE visit_count > 0) as visited_tokens,
  COUNT(*) FILTER (WHERE visit_count = 0) as unvisited_tokens,
  COUNT(*) FILTER (WHERE is_expired = TRUE) as expired_tokens,
  COUNT(*) FILTER (WHERE converted = TRUE) as converted_tokens,
  ROUND(AVG(visit_count), 2) as avg_visits,
  ROUND(
    COUNT(*) FILTER (WHERE visit_count > 0)::NUMERIC / COUNT(*) * 100,
    2
  ) as visit_rate_percent,
  ROUND(
    COUNT(*) FILTER (WHERE converted = TRUE)::NUMERIC / 
    NULLIF(COUNT(*) FILTER (WHERE visit_count > 0), 0) * 100,
    2
  ) as conversion_rate_percent
FROM lead_microsite_tokens
GROUP BY microsite_type;

GRANT SELECT ON vw_token_status_dashboard TO anon, authenticated, service_role;

-- =====================================================
-- SEED DATA: Initial City Configurations
-- =====================================================
-- Populate with Walter Richards' current territory (Los Angeles area)

INSERT INTO city_microsite_configs (
  city_name, 
  state_code, 
  avg_home_value, 
  avg_equity, 
  total_homeowners_62_plus,
  local_facts,
  trust_signals,
  seo_keywords
) VALUES
(
  'Los Angeles',
  'CA',
  850000,
  520000,
  145000,
  '["Home to diverse neighborhoods", "Strong property appreciation", "Large senior homeowner population"]'::JSONB,
  '{"years_serving": "15+", "families_helped": "500+", "avg_rating": "4.9/5"}'::JSONB,
  ARRAY['Los Angeles reverse mortgage', 'LA home equity', 'senior housing LA', 'reverse mortgage California']
),
(
  'Inglewood',
  'CA',
  720000,
  450000,
  12000,
  '["Near LAX airport", "Growing market area", "Family-oriented community"]'::JSONB,
  '{"years_serving": "15+", "families_helped": "100+", "avg_rating": "4.9/5"}'::JSONB,
  ARRAY['Inglewood reverse mortgage', 'Inglewood home equity', 'CA reverse mortgage']
),
(
  'Pasadena',
  'CA',
  950000,
  610000,
  22000,
  '["Historic craftsman homes", "Rose Bowl area", "Strong home values"]'::JSONB,
  '{"years_serving": "15+", "families_helped": "200+", "avg_rating": "4.9/5"}'::JSONB,
  ARRAY['Pasadena reverse mortgage', 'Pasadena home equity', 'CA senior housing']
)
ON CONFLICT (city_name, state_code) DO NOTHING;

-- =====================================================
-- SCHEDULED JOB: Daily City Config Refresh
-- =====================================================
-- Recommendation: Schedule this to run daily at 2am PT via pg_cron or n8n

-- SELECT refresh_city_microsite_configs();

-- =====================================================
-- CLEANUP FUNCTION: Remove Expired Tokens
-- =====================================================
-- Run weekly to clean up old expired tokens

CREATE OR REPLACE FUNCTION cleanup_expired_microsite_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM lead_microsite_tokens
  WHERE expires_at < NOW() - INTERVAL '30 days' -- Keep 30 days past expiration for analytics
    AND converted = FALSE; -- Keep converted tokens forever
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('city_microsite_configs', 'lead_microsite_tokens');

-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE '%microsite%';

-- Check views exist
SELECT viewname 
FROM pg_views 
WHERE viewname LIKE 'vw_%microsite%';

-- Test city config population
SELECT * FROM city_microsite_configs LIMIT 5;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Microsite infrastructure migration complete!';
  RAISE NOTICE '📊 Created: city_microsite_configs table';
  RAISE NOTICE '🔐 Created: lead_microsite_tokens table';
  RAISE NOTICE '📈 Created: Performance views';
  RAISE NOTICE '⚙️ Created: Helper functions';
  RAISE NOTICE '🌱 Seeded: 3 initial city configs (LA, Inglewood, Pasadena)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Schedule daily: SELECT refresh_city_microsite_configs();';
  RAISE NOTICE '2. Build Vercel microsite project';
  RAISE NOTICE '3. Update n8n workflow to generate tokens';
  RAISE NOTICE '4. Add microsite URLs to Instantly custom fields';
END $$;

