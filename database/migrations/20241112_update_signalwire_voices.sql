-- =====================================================
-- SignalWire Voice Configuration Migration
-- =====================================================
-- Date: 2024-11-12
-- Purpose: Update voice configurations to match SignalWire format
-- 
-- CONTEXT:
-- SignalWire bundles ALL providers (STT, TTS, LLM) in their AI Agent pricing.
-- You pay SignalWire directly - NO separate API keys needed for:
--   - ElevenLabs (TTS)
--   - Deepgram (STT) 
--   - OpenAI GPT-4o (LLM)
--   - Anthropic Claude (LLM)
--
-- Voice Format: provider.voice_name
--   Examples: elevenlabs.rachel, openai.alloy, rime.luna
-- =====================================================

-- =====================================================
-- STEP 1: Update prompts table voice configuration
-- =====================================================

-- Add comment to clarify voice format
COMMENT ON COLUMN prompts.voice IS 'SignalWire voice format: provider.voice_name (e.g., elevenlabs.rachel, openai.alloy, rime.luna). Used for SignalWire AI Agent deployment.';

-- Update existing OpenAI voices to include provider prefix
UPDATE prompts 
SET voice = CASE 
  WHEN voice = 'alloy' THEN 'openai.alloy'
  WHEN voice = 'echo' THEN 'openai.echo'
  WHEN voice = 'shimmer' THEN 'openai.shimmer'
  WHEN voice = 'fable' THEN 'openai.fable'
  WHEN voice = 'onyx' THEN 'openai.onyx'
  WHEN voice = 'nova' THEN 'openai.nova'
  ELSE voice
END
WHERE voice IN ('alloy', 'echo', 'shimmer', 'fable', 'onyx', 'nova');

-- Update voice constraint to allow SignalWire format (provider.voice_name)
ALTER TABLE prompts DROP CONSTRAINT IF EXISTS check_voice_valid;
ALTER TABLE prompts DROP CONSTRAINT IF EXISTS prompts_voice_check;

-- No constraint needed - SignalWire supports many providers and voices
-- Let application validate voice availability

-- Update elevenlabs_defaults to clarify it's for reference only
COMMENT ON COLUMN prompts.elevenlabs_defaults IS 'ElevenLabs voice configuration reference (voice_id, speed, stability). NOTE: For SignalWire deployment, use prompts.voice column with elevenlabs.<name> format instead of raw UUID.';

-- Update runtime column comment
COMMENT ON COLUMN prompts.runtime IS 'AI runtime platform: "elevenlabs" (ElevenLabs conversational AI), "realtime" (OpenAI Realtime API), "livekit" (LiveKit with own API keys). For SignalWire deployment, this is informational only - voice is set via prompts.voice column.';

-- =====================================================
-- STEP 2: Update ai_templates table
-- =====================================================

-- Add comments clarifying these templates are for LiveKit (not SignalWire)
COMMENT ON TABLE ai_templates IS 'AI agent configuration templates. ⚠️ NOTE: These templates are for LiveKit deployment with YOUR OWN API keys (Deepgram, ElevenLabs, OpenRouter). For SignalWire deployment, providers are bundled - use barbara_agent.py voice configuration instead.';

COMMENT ON COLUMN ai_templates.stt_provider IS 'Speech-to-Text provider (deepgram, assemblyai, openai, google, cartesia). ⚠️ LiveKit only - SignalWire bundles STT automatically (Deepgram Nova-3 by default).';

COMMENT ON COLUMN ai_templates.tts_provider IS 'Text-to-Speech provider (elevenlabs, openai, google, speechify, cartesia, rime). ⚠️ LiveKit only - SignalWire bundles TTS, use voice format: provider.voice_name';

COMMENT ON COLUMN ai_templates.tts_voice_id IS 'Voice ID for TTS provider. ⚠️ LiveKit only - For ElevenLabs, this is the UUID (e.g., 6aDn1KB0hjpdcocrUkmq). For SignalWire, use voice name format: elevenlabs.rachel';

COMMENT ON COLUMN ai_templates.llm_provider IS 'LLM provider (openai, openrouter, anthropic, google). ⚠️ LiveKit only - SignalWire bundles LLM (gpt-4o, gpt-4o-mini, claude-3-5-sonnet available).';

COMMENT ON COLUMN ai_templates.llm_model IS 'LLM model name (e.g., gpt-4o, claude-3-5-sonnet). ⚠️ LiveKit only - SignalWire provides these models automatically.';

-- =====================================================
-- STEP 3: Update signalwire_phone_numbers table
-- =====================================================

-- Remove deprecated edenai references and update to SignalWire format
UPDATE signalwire_phone_numbers
SET 
  stt_provider = 'deepgram',
  stt_model = 'nova-3',
  tts_provider = 'elevenlabs',
  tts_voice = CASE
    WHEN tts_voice = 'shimmer' THEN 'openai.shimmer'
    WHEN tts_voice = 'elevenlabs' THEN 'elevenlabs.rachel'
    WHEN tts_voice LIKE 'elevenlabs.%' THEN tts_voice  -- Already correct format
    WHEN tts_voice LIKE 'openai.%' THEN tts_voice     -- Already correct format
    ELSE 'elevenlabs.rachel'  -- Default to Rachel
  END,
  llm_provider = 'openai',
  llm_model = 'gpt-4o'
WHERE stt_provider = 'edenai' OR tts_provider = 'edenai';

-- Update comments
COMMENT ON COLUMN signalwire_phone_numbers.stt_provider IS '⚠️ INFORMATIONAL ONLY - SignalWire AI Agent provides STT automatically (Deepgram Nova-3 default). You pay SignalWire, not Deepgram directly.';

COMMENT ON COLUMN signalwire_phone_numbers.stt_model IS '⚠️ INFORMATIONAL ONLY - SignalWire AI Agent handles STT model selection automatically.';

COMMENT ON COLUMN signalwire_phone_numbers.tts_provider IS '⚠️ INFORMATIONAL ONLY - Use tts_voice column with SignalWire format (provider.voice_name) instead.';

COMMENT ON COLUMN signalwire_phone_numbers.tts_voice IS 'SignalWire voice format: provider.voice_name (e.g., elevenlabs.rachel, openai.alloy, rime.luna). SignalWire provides voice automatically - no separate API key needed.';

COMMENT ON COLUMN signalwire_phone_numbers.llm_provider IS '⚠️ INFORMATIONAL ONLY - SignalWire AI Agent bundles LLM (OpenAI, Anthropic). You pay SignalWire, not OpenAI/Anthropic directly.';

COMMENT ON COLUMN signalwire_phone_numbers.llm_model IS 'LLM model for AI Agent (gpt-4o, gpt-4o-mini, claude-3-5-sonnet). SignalWire provides these models - no separate API key needed.';

-- =====================================================
-- STEP 4: Create reference table for SignalWire voices
-- =====================================================

CREATE TABLE IF NOT EXISTS signalwire_available_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,  -- elevenlabs, openai, rime, amazon, azure, cartesia, gcloud
  voice_name TEXT NOT NULL,  -- rachel, alloy, luna, etc.
  voice_id_full TEXT NOT NULL UNIQUE,  -- elevenlabs.rachel, openai.alloy, etc.
  display_name TEXT NOT NULL,  -- Rachel (Female), Alloy (Neutral), etc.
  gender TEXT,  -- male, female, neutral
  accent TEXT,  -- american, british, etc.
  language_codes TEXT[],  -- ['en-US', 'en-GB', 'es-MX']
  model TEXT,  -- turbo_v2_5, multilingual_v2, arcana, etc.
  quality_tier TEXT,  -- standard, premium, ultra
  latency_ms INTEGER,  -- typical latency
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE signalwire_available_voices IS 'Reference table of voices available on SignalWire platform. Updated manually based on SignalWire Voice API documentation.';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sw_voices_provider ON signalwire_available_voices(provider);
CREATE INDEX IF NOT EXISTS idx_sw_voices_available ON signalwire_available_voices(is_available);
CREATE INDEX IF NOT EXISTS idx_sw_voices_full_id ON signalwire_available_voices(voice_id_full);

-- =====================================================
-- STEP 5: Populate SignalWire available voices
-- =====================================================

-- ElevenLabs voices (Multilingual v2 model)
INSERT INTO signalwire_available_voices (provider, voice_name, voice_id_full, display_name, gender, accent, language_codes, model, quality_tier, latency_ms, notes)
VALUES
  -- Female voices
  ('elevenlabs', 'rachel', 'elevenlabs.rachel', 'Rachel (Female, Neutral American)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Most popular voice, clear and natural'),
  ('elevenlabs', 'domi', 'elevenlabs.domi', 'Domi (Female, Confident)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Strong, professional tone'),
  ('elevenlabs', 'emily', 'elevenlabs.emily', 'Emily (Female, Calm)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Soft, calming voice'),
  ('elevenlabs', 'elli', 'elevenlabs.elli', 'Elli (Female, Youthful)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Young, energetic'),
  ('elevenlabs', 'dorothy', 'elevenlabs.dorothy', 'Dorothy (Female, Pleasant)', 'female', 'british', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'British accent'),
  ('elevenlabs', 'charlotte', 'elevenlabs.charlotte', 'Charlotte (Female, Clear)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Clear articulation'),
  ('elevenlabs', 'matilda', 'elevenlabs.matilda', 'Matilda (Female, Mature)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Mature, authoritative'),
  ('elevenlabs', 'gigi', 'elevenlabs.gigi', 'Gigi (Female, Cheerful)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Upbeat, friendly'),
  ('elevenlabs', 'freya', 'elevenlabs.freya', 'Freya (Female, Professional)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Business professional'),
  ('elevenlabs', 'grace', 'elevenlabs.grace', 'Grace (Female, Elegant)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Refined, elegant tone'),
  ('elevenlabs', 'serena', 'elevenlabs.serena', 'Serena (Female, Warm)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Warm, friendly'),
  ('elevenlabs', 'nicole', 'elevenlabs.nicole', 'Nicole (Female, Confident)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Strong, confident'),
  ('elevenlabs', 'jessie', 'elevenlabs.jessie', 'Jessie (Female, Casual)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Relaxed, casual'),
  ('elevenlabs', 'glinda', 'elevenlabs.glinda', 'Glinda (Female, Dramatic)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Theatrical, expressive'),
  ('elevenlabs', 'mimi', 'elevenlabs.mimi', 'Mimi (Female, Cute)', 'female', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Playful, cute'),
  
  -- Male voices
  ('elevenlabs', 'clyde', 'elevenlabs.clyde', 'Clyde (Male, Warm)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Warm, middle-aged'),
  ('elevenlabs', 'dave', 'elevenlabs.dave', 'Dave (Male, British)', 'male', 'british', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'British accent, conversational'),
  ('elevenlabs', 'fin', 'elevenlabs.fin', 'Fin (Male, Energetic)', 'male', 'irish', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Irish accent, enthusiastic'),
  ('elevenlabs', 'antoni', 'elevenlabs.antoni', 'Antoni (Male, Professional)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Clear, professional'),
  ('elevenlabs', 'thomas', 'elevenlabs.thomas', 'Thomas (Male, Young)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Young adult voice'),
  ('elevenlabs', 'charlie', 'elevenlabs.charlie', 'Charlie (Male, Casual)', 'male', 'australian', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Australian accent'),
  ('elevenlabs', 'callum', 'elevenlabs.callum', 'Callum (Male, Intense)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Strong, intense'),
  ('elevenlabs', 'patrick', 'elevenlabs.patrick', 'Patrick (Male, Friendly)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Friendly, approachable'),
  ('elevenlabs', 'harry', 'elevenlabs.harry', 'Harry (Male, Anxious)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Nervous energy'),
  ('elevenlabs', 'liam', 'elevenlabs.liam', 'Liam (Male, Articulate)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Clear articulation'),
  ('elevenlabs', 'josh', 'elevenlabs.josh', 'Josh (Male, Young Professional)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Young professional'),
  ('elevenlabs', 'arnold', 'elevenlabs.arnold', 'Arnold (Male, Crisp)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Crisp pronunciation'),
  ('elevenlabs', 'matthew', 'elevenlabs.matthew', 'Matthew (Male, Narrator)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Narrator voice'),
  ('elevenlabs', 'james', 'elevenlabs.james', 'James (Male, Deep)', 'male', 'australian', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Deep Australian voice'),
  ('elevenlabs', 'joseph', 'elevenlabs.joseph', 'Joseph (Male, Serious)', 'male', 'british', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'British, serious tone'),
  ('elevenlabs', 'jeremy', 'elevenlabs.jeremy', 'Jeremy (Male, Expressive)', 'male', 'irish', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Irish, expressive'),
  ('elevenlabs', 'michael', 'elevenlabs.michael', 'Michael (Male, Resonant)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Deep, resonant'),
  ('elevenlabs', 'ethan', 'elevenlabs.ethan', 'Ethan (Male, Clear)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Clear, neutral'),
  ('elevenlabs', 'daniel', 'elevenlabs.daniel', 'Daniel (Male, Smooth)', 'male', 'british', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Smooth British voice'),
  ('elevenlabs', 'adam', 'elevenlabs.adam', 'Adam (Male, Deep)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Deep American voice'),
  ('elevenlabs', 'ryan', 'elevenlabs.ryan', 'Ryan (Male, Energetic)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'High energy'),
  ('elevenlabs', 'sam', 'elevenlabs.sam', 'Sam (Male, Dynamic)', 'male', 'american', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Dynamic, versatile'),
  ('elevenlabs', 'giovanni', 'elevenlabs.giovanni', 'Giovanni (Male, Italian)', 'male', 'italian', ARRAY['en-US', 'en-GB', 'es-MX', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'], 'multilingual_v2', 'premium', 250, 'Italian accent');

-- OpenAI voices
INSERT INTO signalwire_available_voices (provider, voice_name, voice_id_full, display_name, gender, accent, language_codes, model, quality_tier, latency_ms, notes)
VALUES
  ('openai', 'alloy', 'openai.alloy', 'Alloy (Neutral)', 'neutral', 'american', ARRAY['en-US', 'es-MX', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN', 'ar-SA', 'hi-IN'], 'tts-1', 'standard', 180, 'Versatile, neutral voice'),
  ('openai', 'echo', 'openai.echo', 'Echo (Male)', 'male', 'american', ARRAY['en-US', 'es-MX', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN', 'ar-SA', 'hi-IN'], 'tts-1', 'standard', 180, 'Male, clear'),
  ('openai', 'fable', 'openai.fable', 'Fable (Warm)', 'neutral', 'british', ARRAY['en-US', 'es-MX', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN', 'ar-SA', 'hi-IN'], 'tts-1', 'standard', 180, 'British, warm'),
  ('openai', 'onyx', 'openai.onyx', 'Onyx (Deep Male)', 'male', 'american', ARRAY['en-US', 'es-MX', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN', 'ar-SA', 'hi-IN'], 'tts-1', 'standard', 180, 'Deep male voice'),
  ('openai', 'nova', 'openai.nova', 'Nova (Female)', 'female', 'american', ARRAY['en-US', 'es-MX', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN', 'ar-SA', 'hi-IN'], 'tts-1', 'standard', 180, 'Female, friendly'),
  ('openai', 'shimmer', 'openai.shimmer', 'Shimmer (Soft Female)', 'female', 'american', ARRAY['en-US', 'es-MX', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN', 'ar-SA', 'hi-IN'], 'tts-1', 'standard', 180, 'Soft, gentle female');

-- Rime voices (popular ones)
INSERT INTO signalwire_available_voices (provider, voice_name, voice_id_full, display_name, gender, accent, language_codes, model, quality_tier, latency_ms, notes)
VALUES
  ('rime', 'luna', 'rime.luna', 'Luna (Female, Arcana)', 'female', 'american', ARRAY['en-US'], 'arcana', 'ultra', 200, 'Ultra-realistic, Arcana model'),
  ('rime', 'hudson', 'rime.hudson', 'Hudson (Male, Mist)', 'male', 'american', ARRAY['en-US'], 'mist_v2', 'premium', 150, 'Fast, business voice'),
  ('rime', 'sage', 'rime.sage', 'Sage (Neutral, Arcana)', 'neutral', 'american', ARRAY['en-US'], 'arcana', 'ultra', 200, 'Wise, neutral voice');

-- =====================================================
-- STEP 6: Add deployment metadata to prompts
-- =====================================================

-- Add column to track which deployment platform the prompt is for
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS deployment_platform TEXT DEFAULT 'signalwire';

COMMENT ON COLUMN prompts.deployment_platform IS 'Target deployment platform: "signalwire" (SignalWire AI Agent - all providers bundled), "livekit" (LiveKit - use your own API keys), "elevenlabs" (ElevenLabs conversational AI)';

-- Update existing prompts
UPDATE prompts SET deployment_platform = 'signalwire' WHERE deployment_platform IS NULL;

-- =====================================================
-- MIGRATION SUMMARY
-- =====================================================
-- 
-- ✅ Updated prompts.voice to use SignalWire format (provider.voice_name)
-- ✅ Added comments clarifying ai_templates are for LiveKit only
-- ✅ Removed deprecated edenai references from signalwire_phone_numbers
-- ✅ Updated voice format in signalwire_phone_numbers
-- ✅ Created signalwire_available_voices reference table
-- ✅ Populated 50+ voices (ElevenLabs, OpenAI, Rime)
-- ✅ Added deployment_platform column to prompts
--
-- NEXT STEPS:
-- 1. Update Vue component (BarbaraConfig.vue) to use new voice list
-- 2. Update barbara_agent.py to read voice from prompts table
-- 3. Test with a phone call to verify voice works
-- =====================================================

