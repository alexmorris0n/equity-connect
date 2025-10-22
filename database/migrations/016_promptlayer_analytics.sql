-- PromptLayer Analytics Tables
-- Store request history, analytics, and settings for the PromptLayer portal integration

-- Portal settings table (if not exists)
CREATE TABLE IF NOT EXISTS portal_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PromptLayer request history
-- Stores detailed logs of all AI requests tracked through PromptLayer
CREATE TABLE IF NOT EXISTS promptlayer_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id VARCHAR(255) UNIQUE NOT NULL, -- PromptLayer request ID
  prompt_name VARCHAR(255),
  prompt_version INTEGER,
  
  -- Request details
  model VARCHAR(100),
  input JSONB,
  output TEXT,
  
  -- Performance metrics
  latency_ms INTEGER,
  total_tokens INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  estimated_cost DECIMAL(10, 6),
  
  -- Status and metadata
  status VARCHAR(50) DEFAULT 'success', -- success, error, timeout
  error_message TEXT,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  
  -- Call context (Barbara-specific)
  call_id VARCHAR(255),
  caller_number VARCHAR(50),
  caller_name VARCHAR(255),
  broker_id UUID REFERENCES brokers(id),
  phase VARCHAR(50), -- greeting, qualification, equity_presentation, etc.
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_promptlayer_requests_prompt (prompt_name),
  INDEX idx_promptlayer_requests_created (created_at DESC),
  INDEX idx_promptlayer_requests_call (call_id),
  INDEX idx_promptlayer_requests_status (status),
  INDEX idx_promptlayer_requests_tags (tags)
);

-- PromptLayer analytics aggregations
-- Pre-computed analytics for faster dashboard queries
CREATE TABLE IF NOT EXISTS promptlayer_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Time period
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  granularity VARCHAR(20) NOT NULL, -- hour, day, week, month
  
  -- Aggregated metrics
  prompt_name VARCHAR(255),
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  avg_latency_ms INTEGER,
  total_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10, 4) DEFAULT 0,
  
  -- Success rate
  success_rate DECIMAL(5, 2),
  
  -- Call outcomes (Barbara-specific)
  bookings_scheduled INTEGER DEFAULT 0,
  callbacks_requested INTEGER DEFAULT 0,
  disqualified INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(period_start, granularity, prompt_name)
);

-- PromptLayer scores
-- Store manual or automated quality scores for requests
CREATE TABLE IF NOT EXISTS promptlayer_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id VARCHAR(255) NOT NULL REFERENCES promptlayer_requests(request_id),
  
  score_name VARCHAR(100) NOT NULL, -- quality, accuracy, helpfulness, etc.
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  
  -- Who scored it
  scored_by VARCHAR(255), -- user_id or 'auto'
  scoring_method VARCHAR(50), -- manual, automated, ml_model
  
  -- Additional context
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  INDEX idx_promptlayer_scores_request (request_id),
  INDEX idx_promptlayer_scores_name (score_name)
);

-- Function to aggregate analytics hourly
CREATE OR REPLACE FUNCTION aggregate_promptlayer_analytics_hourly()
RETURNS void AS $$
DECLARE
  hour_start TIMESTAMP WITH TIME ZONE;
  hour_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the last complete hour
  hour_start := date_trunc('hour', NOW() - INTERVAL '1 hour');
  hour_end := hour_start + INTERVAL '1 hour';
  
  -- Aggregate by prompt name
  INSERT INTO promptlayer_analytics (
    period_start,
    period_end,
    granularity,
    prompt_name,
    total_requests,
    successful_requests,
    failed_requests,
    avg_latency_ms,
    total_tokens,
    total_cost,
    success_rate,
    bookings_scheduled,
    callbacks_requested,
    disqualified
  )
  SELECT
    hour_start,
    hour_end,
    'hour',
    prompt_name,
    COUNT(*) as total_requests,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests,
    SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as failed_requests,
    AVG(latency_ms)::INTEGER as avg_latency_ms,
    SUM(total_tokens) as total_tokens,
    SUM(estimated_cost) as total_cost,
    ROUND((SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 2) as success_rate,
    SUM(CASE WHEN metadata->>'booking_result' = 'scheduled' THEN 1 ELSE 0 END) as bookings_scheduled,
    SUM(CASE WHEN metadata->>'booking_result' = 'callback' THEN 1 ELSE 0 END) as callbacks_requested,
    SUM(CASE WHEN metadata->>'disqualified' = 'true' THEN 1 ELSE 0 END) as disqualified
  FROM promptlayer_requests
  WHERE created_at >= hour_start AND created_at < hour_end
  GROUP BY prompt_name
  ON CONFLICT (period_start, granularity, prompt_name)
  DO UPDATE SET
    total_requests = EXCLUDED.total_requests,
    successful_requests = EXCLUDED.successful_requests,
    failed_requests = EXCLUDED.failed_requests,
    avg_latency_ms = EXCLUDED.avg_latency_ms,
    total_tokens = EXCLUDED.total_tokens,
    total_cost = EXCLUDED.total_cost,
    success_rate = EXCLUDED.success_rate,
    bookings_scheduled = EXCLUDED.bookings_scheduled,
    callbacks_requested = EXCLUDED.callbacks_requested,
    disqualified = EXCLUDED.disqualified;
    
END;
$$ LANGUAGE plpgsql;

-- View for easy analytics queries
CREATE OR REPLACE VIEW promptlayer_performance AS
SELECT
  prompt_name,
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as requests,
  AVG(latency_ms)::INTEGER as avg_latency,
  SUM(total_tokens) as tokens,
  SUM(estimated_cost) as cost,
  ROUND((SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 2) as success_rate
FROM promptlayer_requests
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY prompt_name, DATE_TRUNC('day', created_at)
ORDER BY date DESC, requests DESC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON promptlayer_requests TO authenticated;
GRANT SELECT ON promptlayer_analytics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON promptlayer_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE ON portal_settings TO authenticated;
GRANT SELECT ON promptlayer_performance TO authenticated;

-- Add comments
COMMENT ON TABLE promptlayer_requests IS 'Stores all AI requests tracked through PromptLayer for Barbara calls';
COMMENT ON TABLE promptlayer_analytics IS 'Pre-aggregated analytics for faster dashboard queries';
COMMENT ON TABLE promptlayer_scores IS 'Manual and automated quality scores for requests';
COMMENT ON VIEW promptlayer_performance IS 'Daily performance metrics by prompt for the last 30 days';

