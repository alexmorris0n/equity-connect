-- Reply Analytics Table for Email Performance Tracking
-- Created: October 16, 2025
-- Purpose: Track reply handler performance, costs, and conversation quality

CREATE TABLE IF NOT EXISTS reply_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID REFERENCES interactions(id),
  lead_id UUID REFERENCES leads(id),
  
  -- Reply Classification
  intent VARCHAR(50) NOT NULL,           -- PHONE_PROVIDED, QUESTION, INTEREST, UNSUBSCRIBE
  reply_number INTEGER DEFAULT 1,        -- 1st, 2nd, 3rd reply in conversation
  campaign_id VARCHAR(100),              -- From Instantly webhook
  
  -- AI Performance Metrics
  ai_model_used VARCHAR(50) DEFAULT 'gemini-flash-2.5',
  token_count_input INTEGER,
  token_count_output INTEGER,
  token_count_total INTEGER,
  ai_steps INTEGER,                      -- Number of AI agent steps
  cost_usd DECIMAL(10,6),                -- Cost in USD
  response_time_seconds INTEGER,
  
  -- Content Analysis
  email_length_chars INTEGER,
  reply_text_snippet TEXT,               -- First 200 chars of reply
  kb_articles_used JSONB,                -- Which KB articles were referenced
  tools_called JSONB,                    -- Which tools the AI used
  
  -- Outcome Tracking
  lead_replied_back BOOLEAN DEFAULT FALSE,
  time_to_next_reply INTERVAL,
  conversation_ended BOOLEAN DEFAULT FALSE,
  end_reason VARCHAR(50),                -- "phone_provided", "unsubscribe", "ghost", etc.
  
  -- Barbara Call Tracking (if applicable)
  vapi_call_id VARCHAR(100),
  vapi_phone_number_id VARCHAR(100),
  call_triggered BOOLEAN DEFAULT FALSE,
  call_completed BOOLEAN,
  call_duration_seconds INTEGER,
  call_outcome VARCHAR(50),              -- "booked", "callback", "not_interested", etc.
  
  -- Error Tracking
  had_errors BOOLEAN DEFAULT FALSE,
  error_details TEXT,
  
  -- Metadata
  metadata JSONB,                        -- Additional flexible data
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_reply_analytics_lead_id ON reply_analytics(lead_id);
CREATE INDEX IF NOT EXISTS idx_reply_analytics_intent ON reply_analytics(intent);
CREATE INDEX IF NOT EXISTS idx_reply_analytics_created_at ON reply_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_reply_analytics_campaign_id ON reply_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reply_analytics_vapi_call_id ON reply_analytics(vapi_call_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reply_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reply_analytics_updated_at
  BEFORE UPDATE ON reply_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_reply_analytics_updated_at();

-- Helpful views for common queries

-- Daily summary view
CREATE OR REPLACE VIEW reply_analytics_daily_summary AS
SELECT 
  DATE(created_at) as date,
  intent,
  COUNT(*) as reply_count,
  AVG(token_count_total) as avg_tokens,
  SUM(cost_usd) as total_cost_usd,
  AVG(cost_usd) as avg_cost_usd,
  AVG(ai_steps) as avg_steps,
  AVG(response_time_seconds) as avg_response_time,
  COUNT(CASE WHEN call_triggered THEN 1 END) as calls_triggered,
  COUNT(CASE WHEN call_completed THEN 1 END) as calls_completed,
  COUNT(CASE WHEN had_errors THEN 1 END) as error_count
FROM reply_analytics
GROUP BY DATE(created_at), intent
ORDER BY date DESC, intent;

-- Lead conversation summary
CREATE OR REPLACE VIEW reply_analytics_conversation_summary AS
SELECT 
  lead_id,
  COUNT(*) as total_replies,
  MAX(reply_number) as conversation_depth,
  ARRAY_AGG(intent ORDER BY created_at) as intent_sequence,
  SUM(cost_usd) as total_conversation_cost,
  MAX(CASE WHEN call_triggered THEN 1 ELSE 0 END)::boolean as call_was_triggered,
  MAX(created_at) as last_reply_at
FROM reply_analytics
GROUP BY lead_id;

-- Cost tracking view
CREATE OR REPLACE VIEW reply_analytics_cost_summary AS
SELECT 
  DATE_TRUNC('day', created_at) as day,
  DATE_TRUNC('week', created_at) as week,
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as reply_count,
  SUM(token_count_total) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  AVG(cost_usd) as avg_cost_per_reply,
  MIN(cost_usd) as min_cost,
  MAX(cost_usd) as max_cost
FROM reply_analytics
GROUP BY 
  DATE_TRUNC('day', created_at),
  DATE_TRUNC('week', created_at),
  DATE_TRUNC('month', created_at)
ORDER BY day DESC;

COMMENT ON TABLE reply_analytics IS 'Tracks email reply handler performance, AI costs, and conversation outcomes for portal analytics';
COMMENT ON VIEW reply_analytics_daily_summary IS 'Daily rollup of reply metrics by intent';
COMMENT ON VIEW reply_analytics_conversation_summary IS 'Per-lead conversation metrics and outcomes';
COMMENT ON VIEW reply_analytics_cost_summary IS 'Cost tracking aggregated by day/week/month';

