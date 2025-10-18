-- Multi-Provider Skip Trace Router Migration
-- Adds flexible skip-trace provider support with fallback and cost tracking
-- Supports: Melissa Data, TrueTrace, Spokeo, TLO, BeenVerified, PropStream
-- Created: 2025-10-07

-- ================================================
-- STEP 1: Create skip trace provider configuration table
-- ================================================

CREATE TABLE IF NOT EXISTS skip_trace_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL UNIQUE,
  api_endpoint TEXT NOT NULL,
  api_key_env_var TEXT NOT NULL,
  cost_per_record NUMERIC(10,4) DEFAULT 0,
  success_rate NUMERIC(5,2) DEFAULT 0,
  avg_response_time_ms INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 5,
  rate_limit_per_minute INT DEFAULT 60,
  rate_limit_per_day INT DEFAULT 10000,
  supports_phone BOOLEAN DEFAULT TRUE,
  supports_email BOOLEAN DEFAULT TRUE,
  supports_address BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE skip_trace_providers IS 'Configuration for multiple skip-trace service providers';
COMMENT ON COLUMN skip_trace_providers.priority IS 'Lower number = higher priority (1 is highest)';
COMMENT ON COLUMN skip_trace_providers.cost_per_record IS 'Cost in USD per successful trace';
COMMENT ON COLUMN skip_trace_providers.success_rate IS 'Historical success rate percentage (0-100)';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_skip_trace_providers_active ON skip_trace_providers(is_active, priority);

-- Insert default providers
INSERT INTO skip_trace_providers (provider_name, api_endpoint, api_key_env_var, cost_per_record, priority, rate_limit_per_minute, rate_limit_per_day) VALUES
  ('Melissa Data', 'https://personator.melissadata.net/v3/WEB/ContactVerify/doContactVerify', 'MELISSA_API_KEY', 0.085, 1, 120, 50000),
  ('TrueTrace', 'https://api.truetrace.com/v1/trace', 'TRUETRACE_API_KEY', 0.12, 2, 60, 10000),
  ('Spokeo', 'https://api.spokeo.com/v1/phone', 'SPOKEO_API_KEY', 0.15, 3, 30, 5000),
  ('TLO', 'https://api.tlo.com/v2/search', 'TLO_API_KEY', 0.25, 4, 20, 3000),
  ('BeenVerified', 'https://api.beenverified.com/v1/person', 'BEENVERIFIED_API_KEY', 0.18, 5, 40, 8000),
  ('PropStream', 'https://api.propstream.com/v1/skip-trace', 'PROPSTREAM_API_KEY', 0.09, 6, 100, 10000)
ON CONFLICT (provider_name) DO NOTHING;

-- ================================================
-- STEP 2: Enhance skip_trace_queue with provider routing
-- ================================================

ALTER TABLE skip_trace_queue
  ADD COLUMN IF NOT EXISTS primary_provider_id UUID REFERENCES skip_trace_providers(id),
  ADD COLUMN IF NOT EXISTS fallback_provider_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS current_provider_id UUID REFERENCES skip_trace_providers(id),
  ADD COLUMN IF NOT EXISTS provider_attempts JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 3;

COMMENT ON COLUMN skip_trace_queue.primary_provider_id IS 'First provider to try';
COMMENT ON COLUMN skip_trace_queue.fallback_provider_ids IS 'Array of fallback provider IDs to try if primary fails';
COMMENT ON COLUMN skip_trace_queue.provider_attempts IS 'JSON tracking attempts per provider: {provider_id: {attempts, last_attempt, error}}';
COMMENT ON COLUMN skip_trace_queue.total_cost IS 'Cumulative cost of all skip trace attempts';

-- ================================================
-- STEP 3: Create skip_trace_results table
-- ================================================

CREATE TABLE IF NOT EXISTS skip_trace_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  queue_id UUID REFERENCES skip_trace_queue(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES skip_trace_providers(id),
  provider_name TEXT NOT NULL,
  
  -- Input data
  input_first_name TEXT,
  input_last_name TEXT,
  input_address TEXT,
  input_city TEXT,
  input_state TEXT,
  input_zip TEXT,
  
  -- Results
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'no_match')),
  confidence_score NUMERIC(5,2),
  
  -- Contact info found
  phones JSONB DEFAULT '[]',
  emails JSONB DEFAULT '[]',
  addresses JSONB DEFAULT '[]',
  
  -- Provider-specific payloads
  melissa_payload JSONB,
  truetrace_payload JSONB,
  spokeo_payload JSONB,
  tlo_payload JSONB,
  beenverified_payload JSONB,
  propstream_payload JSONB,
  
  -- Metadata
  response_time_ms INT,
  cost NUMERIC(10,4),
  api_credits_used INT DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE skip_trace_results IS 'Stores results from all skip-trace provider attempts';
COMMENT ON COLUMN skip_trace_results.confidence_score IS 'Provider confidence score (0-100)';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_skip_trace_results_lead ON skip_trace_results(lead_id);
CREATE INDEX IF NOT EXISTS idx_skip_trace_results_queue ON skip_trace_results(queue_id);
CREATE INDEX IF NOT EXISTS idx_skip_trace_results_provider ON skip_trace_results(provider_id);
CREATE INDEX IF NOT EXISTS idx_skip_trace_results_status ON skip_trace_results(status);
CREATE INDEX IF NOT EXISTS idx_skip_trace_results_created ON skip_trace_results(created_at);

-- ================================================
-- STEP 4: Create provider selection function
-- ================================================

CREATE OR REPLACE FUNCTION select_skip_trace_provider(
  p_lead_id UUID,
  p_preferred_provider TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_provider_id UUID;
BEGIN
  -- If preferred provider specified and active, use it
  IF p_preferred_provider IS NOT NULL THEN
    SELECT id INTO v_provider_id
    FROM skip_trace_providers
    WHERE provider_name = p_preferred_provider
      AND is_active = TRUE
    LIMIT 1;
    
    IF v_provider_id IS NOT NULL THEN
      RETURN v_provider_id;
    END IF;
  END IF;
  
  -- Otherwise, select based on priority and success rate
  SELECT id INTO v_provider_id
  FROM skip_trace_providers
  WHERE is_active = TRUE
  ORDER BY priority ASC, success_rate DESC, cost_per_record ASC
  LIMIT 1;
  
  RETURN v_provider_id;
END;
$$;

COMMENT ON FUNCTION select_skip_trace_provider IS 'Selects best available skip-trace provider based on priority and performance';

-- ================================================
-- STEP 5: Create provider routing function
-- ================================================

CREATE OR REPLACE FUNCTION route_skip_trace_request(
  p_queue_id UUID,
  p_force_provider TEXT DEFAULT NULL
) RETURNS TABLE(
  provider_id UUID,
  provider_name TEXT,
  api_endpoint TEXT,
  priority INT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_queue_record RECORD;
  v_attempted_providers UUID[];
BEGIN
  -- Get queue record
  SELECT * INTO v_queue_record
  FROM skip_trace_queue
  WHERE id = p_queue_id;
  
  -- Extract already attempted providers from provider_attempts JSONB
  SELECT ARRAY_AGG((key::UUID)) INTO v_attempted_providers
  FROM jsonb_object_keys(COALESCE(v_queue_record.provider_attempts, '{}'::JSONB)) AS key;
  
  -- If forcing a specific provider
  IF p_force_provider IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, p.provider_name, p.api_endpoint, p.priority
    FROM skip_trace_providers p
    WHERE p.provider_name = p_force_provider
      AND p.is_active = TRUE
    LIMIT 1;
    RETURN;
  END IF;
  
  -- Try primary provider first if not attempted
  IF v_queue_record.primary_provider_id IS NOT NULL 
     AND NOT (v_queue_record.primary_provider_id = ANY(COALESCE(v_attempted_providers, ARRAY[]::UUID[]))) THEN
    RETURN QUERY
    SELECT p.id, p.provider_name, p.api_endpoint, p.priority
    FROM skip_trace_providers p
    WHERE p.id = v_queue_record.primary_provider_id
      AND p.is_active = TRUE;
    RETURN;
  END IF;
  
  -- Try fallback providers
  IF v_queue_record.fallback_provider_ids IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, p.provider_name, p.api_endpoint, p.priority
    FROM skip_trace_providers p
    WHERE p.id = ANY(v_queue_record.fallback_provider_ids)
      AND p.is_active = TRUE
      AND NOT (p.id = ANY(COALESCE(v_attempted_providers, ARRAY[]::UUID[])))
    ORDER BY p.priority ASC
    LIMIT 1;
    RETURN;
  END IF;
  
  -- Fall back to best available provider not yet attempted
  RETURN QUERY
  SELECT p.id, p.provider_name, p.api_endpoint, p.priority
  FROM skip_trace_providers p
  WHERE p.is_active = TRUE
    AND NOT (p.id = ANY(COALESCE(v_attempted_providers, ARRAY[]::UUID[])))
  ORDER BY p.priority ASC, p.success_rate DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION route_skip_trace_request IS 'Routes skip-trace request to next best provider considering previous attempts';

-- ================================================
-- STEP 6: Create function to record skip trace attempt
-- ================================================

CREATE OR REPLACE FUNCTION record_skip_trace_attempt(
  p_queue_id UUID,
  p_provider_id UUID,
  p_status TEXT,
  p_error TEXT DEFAULT NULL,
  p_cost NUMERIC DEFAULT 0
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_attempts JSONB;
BEGIN
  -- Get current attempts
  SELECT provider_attempts INTO v_attempts
  FROM skip_trace_queue
  WHERE id = p_queue_id;
  
  -- Initialize if null
  v_attempts := COALESCE(v_attempts, '{}'::JSONB);
  
  -- Update attempts for this provider
  v_attempts := jsonb_set(
    v_attempts,
    ARRAY[p_provider_id::TEXT],
    jsonb_build_object(
      'attempts', COALESCE((v_attempts->p_provider_id::TEXT->>'attempts')::INT, 0) + 1,
      'last_attempt', NOW(),
      'last_status', p_status,
      'last_error', p_error
    )
  );
  
  -- Update queue record
  UPDATE skip_trace_queue
  SET provider_attempts = v_attempts,
      current_provider_id = p_provider_id,
      total_cost = total_cost + p_cost,
      retry_count = retry_count + 1,
      status = CASE 
        WHEN p_status = 'success' THEN 'completed'
        WHEN retry_count + 1 >= max_retries THEN 'failed'
        ELSE 'pending'
      END,
      processed_at = CASE WHEN p_status = 'success' THEN NOW() ELSE NULL END,
      error_message = p_error
  WHERE id = p_queue_id;
END;
$$;

COMMENT ON FUNCTION record_skip_trace_attempt IS 'Records attempt and updates queue status';

-- ================================================
-- STEP 7: Create provider performance tracking view
-- ================================================

CREATE OR REPLACE VIEW skip_trace_provider_performance AS
SELECT 
  p.provider_name,
  p.is_active,
  p.priority,
  p.cost_per_record AS configured_cost,
  COUNT(r.id) AS total_attempts,
  COUNT(r.id) FILTER (WHERE r.status = 'success') AS successful_traces,
  COUNT(r.id) FILTER (WHERE r.status = 'partial') AS partial_traces,
  COUNT(r.id) FILTER (WHERE r.status IN ('failed', 'no_match')) AS failed_traces,
  ROUND(100.0 * COUNT(r.id) FILTER (WHERE r.status = 'success') / NULLIF(COUNT(r.id), 0), 2) AS actual_success_rate,
  ROUND(AVG(r.response_time_ms), 0) AS avg_response_time_ms,
  ROUND(AVG(r.cost), 4) AS avg_cost_per_trace,
  ROUND(SUM(r.cost), 2) AS total_cost,
  MAX(r.created_at) AS last_used_at
FROM skip_trace_providers p
LEFT JOIN skip_trace_results r ON p.id = r.provider_id
GROUP BY p.id, p.provider_name, p.is_active, p.priority, p.cost_per_record
ORDER BY actual_success_rate DESC NULLS LAST, avg_cost_per_trace ASC NULLS LAST;

COMMENT ON VIEW skip_trace_provider_performance IS 'Real-time performance metrics for each skip-trace provider';

-- ================================================
-- STEP 8: Create function to update provider stats
-- ================================================

CREATE OR REPLACE FUNCTION update_provider_stats()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE skip_trace_providers p
  SET 
    success_rate = perf.actual_success_rate,
    avg_response_time_ms = perf.avg_response_time_ms,
    updated_at = NOW()
  FROM (
    SELECT 
      provider_id,
      ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / NULLIF(COUNT(*), 0), 2) AS actual_success_rate,
      ROUND(AVG(response_time_ms), 0) AS avg_response_time_ms
    FROM skip_trace_results
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY provider_id
  ) perf
  WHERE p.id = perf.provider_id;
END;
$$;

COMMENT ON FUNCTION update_provider_stats IS 'Updates provider performance statistics based on recent results (run daily)';

-- ================================================
-- STEP 9: Create DLQ (Dead Letter Queue) for failed traces
-- ================================================

CREATE TABLE IF NOT EXISTS skip_trace_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_queue_id UUID,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  failed_providers JSONB NOT NULL,
  total_attempts INT NOT NULL,
  total_cost NUMERIC(10,4),
  last_error TEXT,
  requires_manual_review BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  resolution TEXT
);

COMMENT ON TABLE skip_trace_dlq IS 'Dead Letter Queue for skip-trace requests that failed all providers';

CREATE INDEX IF NOT EXISTS idx_skip_trace_dlq_lead ON skip_trace_dlq(lead_id);
CREATE INDEX IF NOT EXISTS idx_skip_trace_dlq_review ON skip_trace_dlq(requires_manual_review) WHERE requires_manual_review = TRUE;

-- ================================================
-- STEP 10: Create trigger to move failed traces to DLQ
-- ================================================

CREATE OR REPLACE FUNCTION move_failed_trace_to_dlq()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'failed' AND NEW.retry_count >= NEW.max_retries THEN
    INSERT INTO skip_trace_dlq (
      original_queue_id,
      lead_id,
      failed_providers,
      total_attempts,
      total_cost,
      last_error
    )
    VALUES (
      NEW.id,
      NEW.lead_id,
      NEW.provider_attempts,
      NEW.retry_count,
      NEW.total_cost,
      NEW.error_message
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_move_to_dlq
  AFTER UPDATE ON skip_trace_queue
  FOR EACH ROW
  WHEN (NEW.status = 'failed')
  EXECUTE FUNCTION move_failed_trace_to_dlq();

COMMENT ON TRIGGER trigger_move_to_dlq ON skip_trace_queue IS 'Automatically moves exhausted skip-trace requests to DLQ';

-- ================================================
-- STEP 11: Grant permissions
-- ================================================

GRANT SELECT ON skip_trace_providers TO authenticated;
GRANT SELECT ON skip_trace_provider_performance TO authenticated;
GRANT SELECT ON skip_trace_results TO authenticated;
GRANT SELECT ON skip_trace_dlq TO authenticated;

-- ================================================
-- VERIFICATION QUERIES
-- ================================================

-- View all active providers
-- SELECT * FROM skip_trace_providers WHERE is_active = TRUE ORDER BY priority;

-- Check provider performance
-- SELECT * FROM skip_trace_provider_performance;

-- Get next provider for a queue item
-- SELECT * FROM route_skip_trace_request('queue-id-here');

-- View DLQ items needing manual review
-- SELECT * FROM skip_trace_dlq WHERE requires_manual_review = TRUE ORDER BY created_at DESC;

-- Update provider stats (run daily)
-- SELECT update_provider_stats();

