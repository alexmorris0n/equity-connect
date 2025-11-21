-- Create table for SignalWire STT providers and models
CREATE TABLE IF NOT EXISTS signalwire_available_stt_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,  -- deepgram, openai, assemblyai, google, cartesia
  model_name TEXT NOT NULL,  -- nova-2, whisper-1, universal-streaming, etc.
  model_id_full TEXT NOT NULL UNIQUE,  -- deepgram.nova-2, openai.whisper-1, etc.
  display_name TEXT NOT NULL,  -- Nova-2, Whisper-1, etc.
  language_codes TEXT[],  -- ['en-US', 'es-MX', 'es-ES']
  quality_tier TEXT,  -- standard, premium, ultra
  latency_ms INTEGER,  -- typical latency
  streaming BOOLEAN DEFAULT true,  -- supports streaming
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE signalwire_available_stt_models IS 'Reference table of STT models available on SignalWire platform. Updated manually based on SignalWire documentation.';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sw_stt_provider ON signalwire_available_stt_models(provider);
CREATE INDEX IF NOT EXISTS idx_sw_stt_available ON signalwire_available_stt_models(is_available);
CREATE INDEX IF NOT EXISTS idx_sw_stt_full_id ON signalwire_available_stt_models(model_id_full);

-- Populate with English and Spanish STT models
INSERT INTO signalwire_available_stt_models (provider, model_name, model_id_full, display_name, language_codes, quality_tier, latency_ms, streaming, notes)
VALUES
  -- Deepgram models
  ('deepgram', 'nova-2', 'deepgram.nova-2', 'Nova-2', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES'], 'premium', 150, true, 'Best-in-class streaming STT, fast and accurate'),
  ('deepgram', 'nova-3', 'deepgram.nova-3', 'Nova-3', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES'], 'premium', 150, true, 'Latest Deepgram model, improved accuracy'),
  
  -- OpenAI models
  ('openai', 'whisper-1', 'openai.whisper-1', 'Whisper-1', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES'], 'premium', 300, false, 'High accuracy, supports many languages'),
  ('openai', 'gpt-4o-transcribe', 'openai.gpt-4o-transcribe', 'GPT-4o Transcribe', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES'], 'ultra', 250, true, 'GPT-4o powered transcription'),
  
  -- AssemblyAI models
  ('assemblyai', 'universal-streaming', 'assemblyai.universal-streaming', 'Universal Streaming', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES'], 'premium', 200, true, 'Industry-leading streaming STT for diverse languages'),
  
  -- Google Cloud models
  ('google', 'latest_long', 'google.latest_long', 'Latest Long', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES'], 'premium', 250, false, 'Best for long-form audio'),
  ('google', 'latest_short', 'google.latest_short', 'Latest Short', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES'], 'premium', 200, false, 'Optimized for short utterances'),
  
  -- Cartesia models (if available)
  ('cartesia', 'ink-whisper', 'cartesia.ink-whisper', 'Ink Whisper', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES'], 'premium', 150, true, 'Fast, accurate transcription')
ON CONFLICT (model_id_full) DO NOTHING;









