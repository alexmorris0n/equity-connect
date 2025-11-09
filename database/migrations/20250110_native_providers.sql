-- ============================================================================
-- Native LiveKit Providers Migration
-- ============================================================================
-- Migrates from EdenAI wrapper to native LiveKit plugins
-- Updates CHECK constraints and default templates
-- ============================================================================

-- Drop old CHECK constraints
ALTER TABLE ai_templates
DROP CONSTRAINT IF EXISTS ai_templates_stt_provider_check,
DROP CONSTRAINT IF EXISTS ai_templates_tts_provider_check,
DROP CONSTRAINT IF EXISTS ai_templates_llm_provider_check;

-- Add new CHECK constraints for native providers
ALTER TABLE ai_templates
ADD CONSTRAINT ai_templates_stt_provider_check 
  CHECK (stt_provider IN ('deepgram', 'openai', 'google', 'assemblyai', 'openai_realtime')),
ADD CONSTRAINT ai_templates_tts_provider_check
  CHECK (tts_provider IN ('elevenlabs', 'openai', 'google', 'speechify', 'openai_realtime')),
ADD CONSTRAINT ai_templates_llm_provider_check
  CHECK (llm_provider IN ('openrouter', 'openai', 'openai_realtime'));

-- Update existing templates from eden_ai to native providers
-- Budget Friendly: Deepgram STT + PlayHT TTS (but PlayHT not available natively, use Speechify)
UPDATE ai_templates
SET 
  stt_provider = 'deepgram',
  stt_model = 'nova-2',
  tts_provider = 'speechify',
  tts_model = 'default',
  description = 'Cost-optimized using native LiveKit providers. Good quality at 70% lower cost. Uses Deepgram for STT, Speechify for TTS, and Llama 3.1 for LLM.'
WHERE name = 'Budget Friendly' AND is_system_default = TRUE;

-- Spanish Language: Deepgram STT + ElevenLabs TTS
UPDATE ai_templates
SET 
  stt_provider = 'deepgram',
  stt_model = 'nova-2',
  tts_provider = 'elevenlabs',
  tts_model = 'eleven_multilingual_v2',
  description = 'Optimized for Spanish-speaking leads with multilingual voices. Uses Deepgram for STT, ElevenLabs multilingual for TTS, and Claude 3.5 Sonnet for LLM.'
WHERE name = 'Spanish Language' AND is_system_default = TRUE;

-- Add new default template: Deepgram + ElevenLabs (Optimal Quality)
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
)
VALUES (
  'Premium (Deepgram + ElevenLabs)', 
  'Best-in-class streaming STT with natural neural TTS. Uses Deepgram Nova-2 for STT, ElevenLabs Turbo for TTS, and GPT-4o for LLM. Optimal balance of quality and latency.',
  TRUE, 
  TRUE, 
  NULL,
  'deepgram', 
  'nova-2',
  'elevenlabs', 
  'eleven_turbo_v2_5', 
  '21m00Tcm4TlvDq8ikWAM',  -- Default ElevenLabs voice
  'openrouter', 
  'openai/gpt-4o',
  0.8,
  4096,
  0.5,
  300,
  200,  -- Faster turn detection (200ms instead of 500ms)
  0.28
)
ON CONFLICT (broker_id, name) DO NOTHING;

-- Comment update
COMMENT ON COLUMN ai_templates.stt_provider IS 'Native LiveKit STT providers: deepgram, openai, google, assemblyai, openai_realtime';
COMMENT ON COLUMN ai_templates.tts_provider IS 'Native LiveKit TTS providers: elevenlabs, openai, google, speechify, openai_realtime';
COMMENT ON COLUMN ai_templates.llm_provider IS 'LLM providers: openrouter (aggregator), openai, openai_realtime (bundled voice)';

