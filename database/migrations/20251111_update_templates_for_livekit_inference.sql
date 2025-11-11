-- ============================================================================
-- Update AI Templates for LiveKit Inference
-- ============================================================================
-- Migrates existing templates from old provider names (eden_ai, openai_realtime)
-- to LiveKit Inference native provider names (deepgram, elevenlabs, openai, etc.)
--
-- References:
-- - https://livekit.io/pricing/inference
-- - https://docs.livekit.io/agents/models/
-- ============================================================================

-- Update system preset templates to use LiveKit Inference providers
UPDATE ai_templates
SET 
  stt_provider = 'deepgram',
  stt_model = 'nova-2',
  stt_language = 'en-US'
WHERE name = 'OpenAI Realtime (Best Quality)' 
  AND is_system_default = TRUE
  AND stt_provider = 'openai_realtime';

UPDATE ai_templates
SET 
  tts_provider = 'elevenlabs',
  tts_model = 'eleven_turbo_v2_5',
  tts_voice_id = '6aDn1KB0hjpdcocrUkmq' -- Tiffany voice
WHERE name = 'OpenAI Realtime (Best Quality)' 
  AND is_system_default = TRUE
  AND tts_provider = 'openai_realtime';

UPDATE ai_templates
SET 
  llm_provider = 'openai',
  llm_model = 'gpt-4o',
  llm_temperature = 0.8,
  estimated_cost_per_minute = 1.06 -- Updated cost: Nova-2 + ElevenLabs + GPT-4o
WHERE name = 'OpenAI Realtime (Best Quality)' 
  AND is_system_default = TRUE
  AND llm_provider = 'openai_realtime';

-- Update "Budget Friendly" preset
UPDATE ai_templates
SET 
  stt_provider = 'assemblyai',
  stt_model = 'universal-streaming',
  stt_language = 'en-US',
  tts_provider = 'cartesia',
  tts_model = 'sonic-2',
  tts_voice_id = 'default', -- Cartesia default voice
  llm_provider = 'deepseek',
  llm_model = 'deepseek-v3',
  llm_temperature = 0.7,
  estimated_cost_per_minute = 0.08 -- Updated cost: AssemblyAI + Cartesia + DeepSeek
WHERE name = 'Budget Friendly' 
  AND is_system_default = TRUE;

-- Update "Spanish Language" preset
UPDATE ai_templates
SET 
  stt_provider = 'deepgram',
  stt_model = 'nova-2',
  stt_language = 'es', -- Spanish
  tts_provider = 'elevenlabs',
  tts_model = 'eleven_multilingual_v2',
  tts_voice_id = '21m00Tcm4TlvDq8ikWAM', -- ElevenLabs Rachel voice
  llm_provider = 'anthropic',
  llm_model = 'claude-3-5-sonnet-20241022',
  llm_temperature = 0.8,
  estimated_cost_per_minute = 1.55 -- Updated cost: Nova-2 + ElevenLabs Multi + Claude Sonnet
WHERE name = 'Spanish Language' 
  AND is_system_default = TRUE;

-- Rename preset for clarity
UPDATE ai_templates
SET 
  name = 'Premium (ElevenLabs + GPT-4o)',
  description = 'Best quality configuration using LiveKit Inference. Deepgram Nova-2 for STT, ElevenLabs Turbo for natural TTS (Tiffany voice), and GPT-4o for intelligent responses. Recommended for high-value leads.'
WHERE name = 'OpenAI Realtime (Best Quality)' 
  AND is_system_default = TRUE;

UPDATE ai_templates
SET 
  description = 'Most cost-effective configuration using LiveKit Inference. AssemblyAI for accurate STT, Cartesia for fast TTS, and DeepSeek V3 for powerful yet affordable LLM. Perfect for high-volume calling.'
WHERE name = 'Budget Friendly' 
  AND is_system_default = TRUE;

UPDATE ai_templates
SET 
  description = 'Optimized for Spanish-speaking leads. Deepgram Nova-2 with Spanish language support, ElevenLabs multilingual voices, and Claude 3.5 Sonnet for nuanced conversation. Excellent for Hispanic markets.'
WHERE name = 'Spanish Language' 
  AND is_system_default = TRUE;

-- Add new "Ultra-Fast" preset for low-latency use cases
INSERT INTO ai_templates (
  name, 
  description, 
  is_system_default, 
  is_preset, 
  broker_id, 
  stt_provider, 
  stt_model,
  stt_language,
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
) VALUES (
  'Ultra-Fast (Gemini Flash)', 
  'Lowest latency configuration using LiveKit Inference. Deepgram Nova-3 for fastest STT, ElevenLabs Turbo for instant TTS, and Gemini 2.0 Flash for ultra-fast responses. Best for real-time conversations.',
  TRUE, 
  TRUE, 
  NULL,
  'deepgram', 
  'nova-3',
  'en-US',
  'elevenlabs', 
  'eleven_turbo_v2_5', 
  '6aDn1KB0hjpdcocrUkmq', -- Tiffany voice
  'google', 
  'gemini-2.0-flash',
  0.7,
  4096,
  0.5,
  300,
  500,
  0.15 -- Nova-3 + ElevenLabs + Gemini Flash
) ON CONFLICT DO NOTHING;

-- Update any broker-owned templates that were using old provider names
-- (Non-breaking update: only update if they're using old provider values)

-- Update eden_ai → native providers
UPDATE ai_templates
SET stt_provider = 'deepgram'
WHERE stt_provider = 'eden_ai' 
  AND broker_id IS NOT NULL;

UPDATE ai_templates
SET tts_provider = 'elevenlabs'
WHERE tts_provider = 'eden_ai' 
  AND broker_id IS NOT NULL;

UPDATE ai_templates
SET llm_provider = 'openai'
WHERE llm_provider = 'openrouter' 
  AND llm_model LIKE 'openai/%'
  AND broker_id IS NOT NULL;

UPDATE ai_templates
SET llm_provider = 'anthropic'
WHERE llm_provider = 'openrouter' 
  AND llm_model LIKE 'anthropic/%'
  AND broker_id IS NOT NULL;

UPDATE ai_templates
SET llm_provider = 'google'
WHERE llm_provider = 'openrouter' 
  AND llm_model LIKE 'google/%'
  AND broker_id IS NOT NULL;

-- Clean up model names (remove provider prefix if present)
UPDATE ai_templates
SET llm_model = REPLACE(llm_model, 'openai/', '')
WHERE llm_provider = 'openai'
  AND llm_model LIKE 'openai/%';

UPDATE ai_templates
SET llm_model = REPLACE(llm_model, 'anthropic/', '')
WHERE llm_provider = 'anthropic'
  AND llm_model LIKE 'anthropic/%';

UPDATE ai_templates
SET llm_model = REPLACE(llm_model, 'google/', '')
WHERE llm_provider = 'google'
  AND llm_model LIKE 'google/%';

-- Update model names to match LiveKit Inference naming
UPDATE ai_templates
SET stt_model = 'nova-2'
WHERE stt_model = 'deepgram-nova-2';

UPDATE ai_templates
SET stt_model = 'nova-3'
WHERE stt_model = 'deepgram-nova-3';

UPDATE ai_templates
SET stt_model = 'universal-streaming'
WHERE stt_model = 'assemblyai-best' OR stt_model = 'assemblyai/universal-streaming';

UPDATE ai_templates
SET tts_model = 'eleven_turbo_v2_5'
WHERE tts_model = 'elevenlabs-turbo-v2.5' OR tts_model = 'elevenlabs-turbo-v2_5';

UPDATE ai_templates
SET tts_model = 'eleven_multilingual_v2'
WHERE tts_model = 'elevenlabs-multilingual-v2';

UPDATE ai_templates
SET tts_model = 'eleven_flash_v2_5'
WHERE tts_model = 'elevenlabs-flash-v2.5';

-- Comments for documentation
COMMENT ON TABLE ai_templates IS 'AI configuration templates for LiveKit voice agents using LiveKit Inference. All providers are now native LiveKit Inference integrations.';
COMMENT ON COLUMN ai_templates.stt_provider IS 'Speech-to-Text provider: deepgram, assemblyai, cartesia, openai (all via LiveKit Inference)';
COMMENT ON COLUMN ai_templates.tts_provider IS 'Text-to-Speech provider: elevenlabs, cartesia, inworld, rime, openai, google (all via LiveKit Inference)';
COMMENT ON COLUMN ai_templates.llm_provider IS 'LLM provider: openai, anthropic, google, deepseek, qwen, kimi (all via LiveKit Inference)';

-- Refresh materialized view to reflect changes
REFRESH MATERIALIZED VIEW ai_template_usage;

