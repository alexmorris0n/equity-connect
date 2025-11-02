-- Migration: Create calculator_tokens table
-- Purpose: Store unique tokens for personalized calculator links
-- Created: 2025-11-02

CREATE TABLE IF NOT EXISTS calculator_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  used_at TIMESTAMPTZ,
  phone_submitted TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast token lookup
CREATE INDEX idx_calculator_tokens_token ON calculator_tokens(token);

-- Index for lead association
CREATE INDEX idx_calculator_tokens_lead_id ON calculator_tokens(lead_id);

-- Index for cleanup queries (find expired tokens)
CREATE INDEX idx_calculator_tokens_expires_at ON calculator_tokens(expires_at);

-- Comments for documentation
COMMENT ON TABLE calculator_tokens IS 'Stores unique tokens for personalized calculator links sent to leads';
COMMENT ON COLUMN calculator_tokens.token IS 'Unique token string (e.g., abc123) used in URL';
COMMENT ON COLUMN calculator_tokens.lead_id IS 'Reference to the lead this token belongs to';
COMMENT ON COLUMN calculator_tokens.expires_at IS 'When this token expires (default 30 days)';
COMMENT ON COLUMN calculator_tokens.used_at IS 'Timestamp when the calculator was first accessed';
COMMENT ON COLUMN calculator_tokens.phone_submitted IS 'Phone number submitted through the calculator';
COMMENT ON COLUMN calculator_tokens.metadata IS 'Additional data like IP address, user agent, etc.';

