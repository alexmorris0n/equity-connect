-- Fix LiveKit Inference Models
-- This migration adds missing models, removes incorrect models, and ensures all formats match LiveKit Inference docs
-- Only includes models available through LiveKit Inference (not plugins)

-- ============================================================================
-- STEP 1: Add Missing LLM Models
-- ============================================================================

-- Add missing OpenAI LLM models
INSERT INTO livekit_available_llm_models (provider, model_name, model_id_full, display_name, is_available, notes)
VALUES
  ('openai', 'gpt-4.1', 'openai/gpt-4.1', 'GPT-4.1', true, 'LiveKit Inference'),
  ('openai', 'gpt-4.1-mini', 'openai/gpt-4.1-mini', 'GPT-4.1 mini', true, 'LiveKit Inference'),
  ('openai', 'gpt-4.1-nano', 'openai/gpt-4.1-nano', 'GPT-4.1 nano', true, 'LiveKit Inference')
ON CONFLICT (model_id_full) DO UPDATE SET
  provider = EXCLUDED.provider,
  model_name = EXCLUDED.model_name,
  display_name = EXCLUDED.display_name,
  is_available = EXCLUDED.is_available,
  notes = EXCLUDED.notes;

-- Add missing Google Gemini LLM models
INSERT INTO livekit_available_llm_models (provider, model_name, model_id_full, display_name, is_available, notes)
VALUES
  ('google', 'gemini-2.5-pro', 'google/gemini-2.5-pro', 'Gemini 2.5 Pro', true, 'LiveKit Inference'),
  ('google', 'gemini-2.5-flash', 'google/gemini-2.5-flash', 'Gemini 2.5 Flash', true, 'LiveKit Inference'),
  ('google', 'gemini-2.5-flash-lite', 'google/gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite', true, 'LiveKit Inference'),
  ('google', 'gemini-2.0-flash', 'google/gemini-2.0-flash', 'Gemini 2.0 Flash', true, 'LiveKit Inference'),
  ('google', 'gemini-2.0-flash-lite', 'google/gemini-2.0-flash-lite', 'Gemini 2.0 Flash Lite', true, 'LiveKit Inference')
ON CONFLICT (model_id_full) DO UPDATE SET
  provider = EXCLUDED.provider,
  model_name = EXCLUDED.model_name,
  display_name = EXCLUDED.display_name,
  is_available = EXCLUDED.is_available,
  notes = EXCLUDED.notes;

-- ============================================================================
-- STEP 2: Remove Incorrect LLM Models
-- ============================================================================

-- Remove openai/gpt-4o-micro (not in LiveKit Inference docs)
DELETE FROM livekit_available_llm_models 
WHERE model_id_full = 'openai/gpt-4o-micro';

-- ============================================================================
-- STEP 3: Remove Incorrect STT Models (Plugin-only, not Inference)
-- ============================================================================

-- Remove Google STT models (plugin-only, not in LiveKit Inference)
DELETE FROM livekit_available_stt_models 
WHERE model_id_full IN ('google/latest_long', 'google/latest_short');

-- Remove OpenAI STT models (plugin-only, not in LiveKit Inference)
DELETE FROM livekit_available_stt_models 
WHERE model_id_full IN ('openai/gpt-4o-transcribe', 'openai/whisper-1');

-- ============================================================================
-- STEP 4: Remove Incorrect TTS Models (Plugin-only, not Inference)
-- ============================================================================

-- Remove Amazon Polly voices (plugin-only, not in LiveKit Inference)
DELETE FROM livekit_available_voices 
WHERE provider = 'amazon';

-- Remove Azure voices (plugin-only, not in LiveKit Inference)
DELETE FROM livekit_available_voices 
WHERE provider = 'azure';

-- Remove Google Cloud voices (plugin-only, not in LiveKit Inference)
DELETE FROM livekit_available_voices 
WHERE provider IN ('google', 'gcloud');

-- Remove OpenAI TTS voices (plugin-only, not in LiveKit Inference)
DELETE FROM livekit_available_voices 
WHERE provider = 'openai';

-- ============================================================================
-- STEP 5: Add Missing TTS Models (LiveKit Inference only)
-- ============================================================================

-- Add missing Cartesia TTS models
-- Note: We already have sonic-3, need to add sonic-2, sonic-turbo, sonic
-- These are model IDs, not individual voices - voices are selected by voice_id
-- The model_id_full format is: cartesia/sonic-2:voice_id
-- We'll add a few sample voices for each model to show they're available

-- Cartesia sonic-2 voices (sample - users can use any voice_id from Cartesia)
INSERT INTO livekit_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, model, is_available, is_custom, notes)
VALUES
  ('cartesia', 'Blake', 'a167e0f3-df7e-4d52-a9c3-f949145efdab', 'cartesia/sonic-2:a167e0f3-df7e-4d52-a9c3-f949145efdab', 'Blake (Sonic-2)', 'sonic-2', true, false, 'LiveKit Inference - Cartesia Sonic-2')
ON CONFLICT (voice_id_full) DO UPDATE SET
  model = EXCLUDED.model,
  is_available = EXCLUDED.is_available,
  notes = EXCLUDED.notes;

-- Cartesia sonic-turbo voices (sample)
INSERT INTO livekit_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, model, is_available, is_custom, notes)
VALUES
  ('cartesia', 'Blake', 'a167e0f3-df7e-4d52-a9c3-f949145efdab', 'cartesia/sonic-turbo:a167e0f3-df7e-4d52-a9c3-f949145efdab', 'Blake (Sonic-Turbo)', 'sonic-turbo', true, false, 'LiveKit Inference - Cartesia Sonic-Turbo')
ON CONFLICT (voice_id_full) DO UPDATE SET
  model = EXCLUDED.model,
  is_available = EXCLUDED.is_available,
  notes = EXCLUDED.notes;

-- Cartesia sonic voices (sample)
INSERT INTO livekit_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, model, is_available, is_custom, notes)
VALUES
  ('cartesia', 'Blake', 'a167e0f3-df7e-4d52-a9c3-f949145efdab', 'cartesia/sonic:a167e0f3-df7e-4d52-a9c3-f949145efdab', 'Blake (Sonic)', 'sonic', true, false, 'LiveKit Inference - Cartesia Sonic')
ON CONFLICT (voice_id_full) DO UPDATE SET
  model = EXCLUDED.model,
  is_available = EXCLUDED.is_available,
  notes = EXCLUDED.notes;

-- Add missing ElevenLabs TTS models
-- eleven_flash_v2 (sample voice)
INSERT INTO livekit_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, model, is_available, is_custom, notes)
VALUES
  ('elevenlabs', 'Alice', 'Xb7hH8MSUJpSbSDYk0k2', 'elevenlabs/eleven_flash_v2:Xb7hH8MSUJpSbSDYk0k2', 'Alice (Flash v2)', 'eleven_flash_v2', true, false, 'LiveKit Inference - ElevenLabs Flash v2')
ON CONFLICT (voice_id_full) DO UPDATE SET
  model = EXCLUDED.model,
  is_available = EXCLUDED.is_available,
  notes = EXCLUDED.notes;

-- eleven_turbo_v2 (sample voice)
INSERT INTO livekit_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, model, is_available, is_custom, notes)
VALUES
  ('elevenlabs', 'Alice', 'Xb7hH8MSUJpSbSDYk0k2', 'elevenlabs/eleven_turbo_v2:Xb7hH8MSUJpSbSDYk0k2', 'Alice (Turbo v2)', 'eleven_turbo_v2', true, false, 'LiveKit Inference - ElevenLabs Turbo v2')
ON CONFLICT (voice_id_full) DO UPDATE SET
  model = EXCLUDED.model,
  is_available = EXCLUDED.is_available,
  notes = EXCLUDED.notes;

-- Add missing Inworld TTS model
-- inworld-tts-1-max (sample voices)
INSERT INTO livekit_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, model, is_available, is_custom, notes)
VALUES
  ('inworld', 'Ashley', 'Ashley', 'inworld/inworld-tts-1-max:Ashley', 'Ashley (Max)', 'inworld-tts-1-max', true, false, 'LiveKit Inference - Inworld TTS-1 Max'),
  ('inworld', 'Diego', 'Diego', 'inworld/inworld-tts-1-max:Diego', 'Diego (Max)', 'inworld-tts-1-max', true, false, 'LiveKit Inference - Inworld TTS-1 Max'),
  ('inworld', 'Edward', 'Edward', 'inworld/inworld-tts-1-max:Edward', 'Edward (Max)', 'inworld-tts-1-max', true, false, 'LiveKit Inference - Inworld TTS-1 Max'),
  ('inworld', 'Olivia', 'Olivia', 'inworld/inworld-tts-1-max:Olivia', 'Olivia (Max)', 'inworld-tts-1-max', true, false, 'LiveKit Inference - Inworld TTS-1 Max')
ON CONFLICT (voice_id_full) DO UPDATE SET
  model = EXCLUDED.model,
  is_available = EXCLUDED.is_available,
  notes = EXCLUDED.notes;

-- Fix existing Rime mist_v2 format drift (should be mistv2 per docs)
UPDATE livekit_available_voices
SET model = 'mistv2',
    voice_id_full = REPLACE(voice_id_full, 'mist_v2', 'mistv2')
WHERE provider = 'rime' AND model = 'mist_v2';

-- Add missing Rime TTS models
-- rime/mistv2 (sample voices)
INSERT INTO livekit_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, model, is_available, is_custom, notes)
VALUES
  ('rime', 'Astra', 'astra', 'rime/mistv2:astra', 'Astra (Mist v2)', 'mistv2', true, false, 'LiveKit Inference - Rime Mist v2'),
  ('rime', 'Celeste', 'celeste', 'rime/mistv2:celeste', 'Celeste (Mist v2)', 'mistv2', true, false, 'LiveKit Inference - Rime Mist v2'),
  ('rime', 'Luna', 'luna', 'rime/mistv2:luna', 'Luna (Mist v2)', 'mistv2', true, false, 'LiveKit Inference - Rime Mist v2'),
  ('rime', 'Ursa', 'ursa', 'rime/mistv2:ursa', 'Ursa (Mist v2)', 'mistv2', true, false, 'LiveKit Inference - Rime Mist v2')
ON CONFLICT (voice_id_full) DO UPDATE SET
  model = EXCLUDED.model,
  is_available = EXCLUDED.is_available,
  notes = EXCLUDED.notes;

-- rime/mist (sample voices)
INSERT INTO livekit_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, model, is_available, is_custom, notes)
VALUES
  ('rime', 'Astra', 'astra', 'rime/mist:astra', 'Astra (Mist)', 'mist', true, false, 'LiveKit Inference - Rime Mist'),
  ('rime', 'Celeste', 'celeste', 'rime/mist:celeste', 'Celeste (Mist)', 'mist', true, false, 'LiveKit Inference - Rime Mist'),
  ('rime', 'Luna', 'luna', 'rime/mist:luna', 'Luna (Mist)', 'mist', true, false, 'LiveKit Inference - Rime Mist'),
  ('rime', 'Ursa', 'ursa', 'rime/mist:ursa', 'Ursa (Mist)', 'mist', true, false, 'LiveKit Inference - Rime Mist')
ON CONFLICT (voice_id_full) DO UPDATE SET
  model = EXCLUDED.model,
  is_available = EXCLUDED.is_available,
  notes = EXCLUDED.notes;

-- ============================================================================
-- VERIFICATION: Check results
-- ============================================================================

DO $$
DECLARE
  llm_count INTEGER;
  stt_count INTEGER;
  tts_count INTEGER;
  incorrect_llm INTEGER;
  incorrect_stt INTEGER;
  incorrect_tts INTEGER;
BEGIN
  -- Count total models
  SELECT COUNT(*) INTO llm_count FROM livekit_available_llm_models;
  SELECT COUNT(*) INTO stt_count FROM livekit_available_stt_models;
  SELECT COUNT(*) INTO tts_count FROM livekit_available_voices;
  
  -- Check for incorrect models that should have been removed
  SELECT COUNT(*) INTO incorrect_llm FROM livekit_available_llm_models WHERE model_id_full = 'openai/gpt-4o-micro';
  SELECT COUNT(*) INTO incorrect_stt FROM livekit_available_stt_models WHERE model_id_full IN ('google/latest_long', 'google/latest_short', 'openai/gpt-4o-transcribe', 'openai/whisper-1');
  SELECT COUNT(*) INTO incorrect_tts FROM livekit_available_voices WHERE provider IN ('amazon', 'azure', 'google', 'gcloud', 'openai');
  
  IF incorrect_llm > 0 OR incorrect_stt > 0 OR incorrect_tts > 0 THEN
    RAISE WARNING 'Still have incorrect models: LLM=%, STT=%, TTS=%', incorrect_llm, incorrect_stt, incorrect_tts;
  END IF;
  
  RAISE NOTICE 'Migration complete: LLM=%, STT=%, TTS=%', llm_count, stt_count, tts_count;
END $$;

