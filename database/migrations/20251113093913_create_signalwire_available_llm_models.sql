-- Create table for SignalWire LLM providers and models
CREATE TABLE IF NOT EXISTS signalwire_available_llm_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,  -- openai, anthropic, groq, google, etc.
  model_name TEXT NOT NULL,  -- gpt-4o, claude-3-5-sonnet, etc.
  model_id_full TEXT NOT NULL UNIQUE,  -- openai.gpt-4o, anthropic.claude-3-5-sonnet, etc.
  display_name TEXT NOT NULL,  -- GPT-4o, Claude 3.5 Sonnet, etc.
  context_window INTEGER,  -- token context window size
  quality_tier TEXT,  -- standard, premium, ultra
  latency_ms INTEGER,  -- typical latency
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE signalwire_available_llm_models IS 'Reference table of LLM models available on SignalWire platform. SignalWire SDK supports OpenAI models by default. Other providers require custom integration.';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sw_llm_provider ON signalwire_available_llm_models(provider);
CREATE INDEX IF NOT EXISTS idx_sw_llm_available ON signalwire_available_llm_models(is_available);
CREATE INDEX IF NOT EXISTS idx_sw_llm_full_id ON signalwire_available_llm_models(model_id_full);

-- Populate with known SignalWire LLM models (OpenAI only - default support)
INSERT INTO signalwire_available_llm_models (provider, model_name, model_id_full, display_name, context_window, quality_tier, latency_ms, notes)
VALUES
  -- OpenAI models (SignalWire SDK supports OpenAI by default)
  ('openai', 'gpt-4o', 'openai.gpt-4o', 'GPT-4o', 128000, 'premium', 200, 'Powerful all-rounder, currently used in agent'),
  ('openai', 'gpt-4o-mini', 'openai.gpt-4o-mini', 'GPT-4o Mini', 128000, 'standard', 150, 'Faster, more cost-effective version')
ON CONFLICT (model_id_full) DO NOTHING;









