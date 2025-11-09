-- ============================================================================
-- AI Templates System
-- ============================================================================
-- Creates AI configuration templates for LiveKit voice agents
-- Templates define STT/TTS/LLM provider configurations, VAD settings,
-- and all runtime parameters for voice AI calls.
--
-- System presets are read-only templates for common configurations
-- Brokers can clone and customize them or create their own templates
-- ============================================================================

-- AI Templates Table
CREATE TABLE IF NOT EXISTS ai_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- STT Configuration
  -- eden_ai is aggregator for: Deepgram, AssemblyAI, Google, Whisper, etc.
  -- openai_realtime is bundled (STT included in realtime model)
  stt_provider TEXT NOT NULL CHECK (stt_provider IN ('eden_ai', 'openai_realtime')),
  stt_model TEXT NOT NULL, -- e.g., 'deepgram-nova-2', 'assemblyai-best', 'google-latest'
  stt_language TEXT DEFAULT 'en-US',
  
  -- TTS Configuration  
  -- eden_ai is aggregator for: ElevenLabs, PlayHT, Google, Amazon Polly, etc.
  -- openai_realtime is bundled (TTS included in realtime model)
  tts_provider TEXT NOT NULL CHECK (tts_provider IN ('eden_ai', 'openai_realtime')),
  tts_model TEXT NOT NULL, -- e.g., 'elevenlabs-multilingual-v2', 'playht-2.0-turbo', 'google-neural2'
  tts_voice_id TEXT NOT NULL,
  tts_speed NUMERIC DEFAULT 1.0 CHECK (tts_speed BETWEEN 0.5 AND 2.0),
  tts_stability NUMERIC DEFAULT 0.5 CHECK (tts_stability BETWEEN 0 AND 1),
  
  -- LLM Configuration
  -- openrouter is aggregator for: OpenAI, Anthropic, Meta, Google, Mistral, etc.
  -- openai_realtime is direct (only GPT-4o-realtime, bypasses aggregators)
  llm_provider TEXT NOT NULL CHECK (llm_provider IN ('openrouter', 'openai_realtime')),
  llm_model TEXT NOT NULL, -- e.g., 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'gpt-4o-realtime-preview'
  llm_temperature NUMERIC DEFAULT 0.7 CHECK (llm_temperature BETWEEN 0 AND 2),
  llm_max_tokens INTEGER DEFAULT 4096 CHECK (llm_max_tokens > 0),
  llm_top_p NUMERIC DEFAULT 1.0 CHECK (llm_top_p BETWEEN 0 AND 1),
  llm_frequency_penalty NUMERIC DEFAULT 0.0 CHECK (llm_frequency_penalty BETWEEN -2 AND 2),
  llm_presence_penalty NUMERIC DEFAULT 0.0 CHECK (llm_presence_penalty BETWEEN -2 AND 2),
  
  -- VAD (Voice Activity Detection) Configuration
  vad_enabled BOOLEAN DEFAULT TRUE,
  vad_threshold NUMERIC DEFAULT 0.5 CHECK (vad_threshold BETWEEN 0 AND 1),
  vad_prefix_padding_ms INTEGER DEFAULT 300 CHECK (vad_prefix_padding_ms >= 0),
  vad_silence_duration_ms INTEGER DEFAULT 500 CHECK (vad_silence_duration_ms >= 0),
  
  -- Turn Detection (for realtime models)
  turn_detection_type TEXT DEFAULT 'server_vad' CHECK (turn_detection_type IN ('server_vad', 'none')),
  
  -- Audio Configuration
  audio_input_transcription BOOLEAN DEFAULT TRUE,
  audio_sample_rate INTEGER DEFAULT 24000 CHECK (audio_sample_rate IN (16000, 24000, 48000)),
  
  -- Cost tracking (estimated $/minute)
  estimated_cost_per_minute NUMERIC,
  
  -- System presets
  is_system_default BOOLEAN DEFAULT FALSE,
  is_preset BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT valid_broker_template CHECK (
    (is_system_default = TRUE AND broker_id IS NULL) OR
    (is_system_default = FALSE AND broker_id IS NOT NULL)
  ),
  CONSTRAINT unique_broker_template_name UNIQUE (broker_id, name)
);

-- Indexes for performance
CREATE INDEX idx_ai_templates_broker_id ON ai_templates(broker_id) WHERE broker_id IS NOT NULL;
CREATE INDEX idx_ai_templates_system_default ON ai_templates(is_system_default) WHERE is_system_default = TRUE;
CREATE INDEX idx_ai_templates_preset ON ai_templates(is_preset) WHERE is_preset = TRUE;

-- Updated_at trigger (assumes update_updated_at_column() function exists)
CREATE TRIGGER set_ai_templates_updated_at
  BEFORE UPDATE ON ai_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Usage count view (materialized for performance)
CREATE MATERIALIZED VIEW ai_template_usage AS
SELECT 
  t.id AS template_id,
  t.name,
  COUNT(p.id) AS phone_count,
  COUNT(DISTINCT p.broker_id) AS broker_count,
  MAX(p.updated_at) AS last_assignment_date
FROM ai_templates t
LEFT JOIN signalwire_phone_numbers p ON p.assigned_ai_template_id = t.id
GROUP BY t.id, t.name;

CREATE UNIQUE INDEX idx_ai_template_usage_template_id ON ai_template_usage(template_id);

-- Refresh function for usage stats
CREATE OR REPLACE FUNCTION refresh_ai_template_usage()
RETURNS trigger AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY ai_template_usage;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_template_usage_on_phone_change
  AFTER INSERT OR UPDATE OR DELETE ON signalwire_phone_numbers
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_ai_template_usage();

-- Update signalwire_phone_numbers table
ALTER TABLE signalwire_phone_numbers
ADD COLUMN IF NOT EXISTS assigned_ai_template_id UUID REFERENCES ai_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_phone_template ON signalwire_phone_numbers(assigned_ai_template_id) WHERE assigned_ai_template_id IS NOT NULL;

-- RLS Policies
ALTER TABLE ai_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins see all templates" ON ai_templates;
DROP POLICY IF EXISTS "Brokers see their own + system defaults" ON ai_templates;
DROP POLICY IF EXISTS "Brokers create their own templates" ON ai_templates;
DROP POLICY IF EXISTS "Brokers update their own templates" ON ai_templates;
DROP POLICY IF EXISTS "Brokers delete unused templates" ON ai_templates;

CREATE POLICY "Admins see all templates"
  ON ai_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'admin'
    )
  );

CREATE POLICY "Brokers see their own + system defaults"
  ON ai_templates FOR SELECT
  USING (
    broker_id = auth.uid() OR
    is_system_default = TRUE
  );

CREATE POLICY "Brokers create their own templates"
  ON ai_templates FOR INSERT
  WITH CHECK (broker_id = auth.uid() AND is_system_default = FALSE);

CREATE POLICY "Brokers update their own templates"
  ON ai_templates FOR UPDATE
  USING (broker_id = auth.uid() AND is_system_default = FALSE);

CREATE POLICY "Brokers delete unused templates"
  ON ai_templates FOR DELETE
  USING (
    broker_id = auth.uid() AND
    is_system_default = FALSE AND
    NOT EXISTS (
      SELECT 1 FROM signalwire_phone_numbers
      WHERE assigned_ai_template_id = ai_templates.id
    )
  );

-- Seed System Presets
INSERT INTO ai_templates (
  name, 
  description, 
  is_system_default, 
  is_preset, 
  broker_id, 
  stt_provider, 
  stt_model, 
  tts_provider, 
  tts_model, 
  tts_voice_id, 
  llm_provider, 
  llm_model, 
  llm_temperature,
  llm_max_tokens,
  vad_threshold,
  vad_prefix_padding_ms,
  vad_silence_duration_ms,
  estimated_cost_per_minute
) VALUES
(
  'OpenAI Realtime (Best Quality)', 
  'All-in-one OpenAI solution with GPT-4 Realtime API. Best quality, highest cost. Includes bundled STT, TTS, and LLM in a single low-latency model.',
  TRUE, 
  TRUE, 
  NULL,
  'openai_realtime', 
  'bundled',
  'openai_realtime', 
  'bundled', 
  'alloy',
  'openai_realtime', 
  'gpt-4o-realtime-preview',
  0.8,
  4096,
  0.5,
  300,
  500,
  0.45
),
(
  'Budget Friendly', 
  'Cost-optimized using Eden AI providers. Good quality at 70% lower cost. Uses Deepgram for STT, PlayHT for TTS, and Llama 3.1 for LLM.',
  TRUE, 
  TRUE, 
  NULL,
  'eden_ai', 
  'deepgram-nova-2',
  'eden_ai', 
  'playht-2.0-turbo', 
  's3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json',
  'openrouter', 
  'meta-llama/llama-3.1-70b-instruct',
  0.7,
  4096,
  0.5,
  300,
  500,
  0.12
),
(
  'Spanish Language', 
  'Optimized for Spanish-speaking leads with multilingual voices. Uses Deepgram for STT, ElevenLabs multilingual for TTS, and Claude 3.5 Sonnet for LLM.',
  TRUE, 
  TRUE, 
  NULL,
  'eden_ai', 
  'deepgram-nova-2',
  'eden_ai', 
  'elevenlabs-multilingual-v2', 
  '21m00Tcm4TlvDq8ikWAM',
  'openrouter', 
  'anthropic/claude-3.5-sonnet',
  0.8,
  4096,
  0.5,
  300,
  500,
  0.22
)
ON CONFLICT DO NOTHING;

-- Initial refresh of materialized view
REFRESH MATERIALIZED VIEW ai_template_usage;

-- Comments for documentation
COMMENT ON TABLE ai_templates IS 'AI configuration templates for LiveKit voice agents. Defines STT/TTS/LLM providers, VAD settings, and runtime parameters.';
COMMENT ON COLUMN ai_templates.stt_provider IS 'Speech-to-Text provider: eden_ai (aggregator) or openai_realtime (bundled)';
COMMENT ON COLUMN ai_templates.tts_provider IS 'Text-to-Speech provider: eden_ai (aggregator) or openai_realtime (bundled)';
COMMENT ON COLUMN ai_templates.llm_provider IS 'LLM provider: openrouter (aggregator) or openai_realtime (direct)';
COMMENT ON COLUMN ai_templates.vad_threshold IS 'Voice Activity Detection threshold (0-1). Higher = less sensitive to background noise.';
COMMENT ON COLUMN ai_templates.vad_prefix_padding_ms IS 'Milliseconds of audio to include before speech detection';
COMMENT ON COLUMN ai_templates.vad_silence_duration_ms IS 'Milliseconds of silence before considering speech ended';
COMMENT ON COLUMN ai_templates.estimated_cost_per_minute IS 'Estimated cost in USD per minute of call time';
COMMENT ON COLUMN ai_templates.is_system_default IS 'True for system-provided presets (read-only for brokers)';
COMMENT ON COLUMN ai_templates.is_preset IS 'True for templates shown in preset picker UI';

