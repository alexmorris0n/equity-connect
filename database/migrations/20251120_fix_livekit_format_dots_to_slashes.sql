-- Fix LiveKit Model Format: Convert Dots to Slashes
-- This migration converts all dot-format entries to slash format to match LiveKit Inference format
-- Preserves all models, handles duplicates, and maintains active status

-- ============================================================================
-- STEP 1: LLM MODELS - Handle duplicates and convert format
-- ============================================================================

-- First, transfer active status from dot versions to slash versions if both exist
UPDATE livekit_available_llm_models l1
SET is_active = TRUE
FROM livekit_available_llm_models l2
WHERE l1.provider = l2.provider 
  AND l1.model_name = l2.model_name
  AND l1.model_id_full LIKE '%/%'   -- slash version (correct)
  AND l2.model_id_full LIKE '%.%'   -- dot version (wrong)
  AND l2.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM livekit_available_llm_models l3 
    WHERE l3.is_active = TRUE 
    AND l3.id != l1.id
  );

-- Deactivate dot versions that have slash duplicates
UPDATE livekit_available_llm_models l1
SET is_active = FALSE
FROM livekit_available_llm_models l2
WHERE l1.provider = l2.provider 
  AND l1.model_name = l2.model_name
  AND l1.model_id_full LIKE '%.%'   -- dot version (wrong)
  AND l2.model_id_full LIKE '%/%'   -- slash version (correct)
  AND l1.is_active = TRUE;

-- Delete dot versions that have slash duplicates
DELETE FROM livekit_available_llm_models l1
USING livekit_available_llm_models l2
WHERE l1.provider = l2.provider 
  AND l1.model_name = l2.model_name
  AND l1.model_id_full LIKE '%.%'   -- dot version (wrong)
  AND l2.model_id_full LIKE '%/%';  -- slash version (correct)

-- Convert remaining dot-only entries to slash format
UPDATE livekit_available_llm_models
SET model_id_full = REPLACE(model_id_full, '.', '/')
WHERE model_id_full LIKE '%.%' AND model_id_full NOT LIKE '%/%';

-- ============================================================================
-- STEP 2: STT MODELS - Handle duplicates and convert format
-- ============================================================================

-- Transfer active status from dot versions to slash versions if both exist
UPDATE livekit_available_stt_models l1
SET is_active = TRUE
FROM livekit_available_stt_models l2
WHERE l1.provider = l2.provider 
  AND l1.model_name = l2.model_name
  AND l1.model_id_full LIKE '%/%'   -- slash version (correct)
  AND l2.model_id_full LIKE '%.%'   -- dot version (wrong)
  AND l2.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM livekit_available_stt_models l3 
    WHERE l3.is_active = TRUE 
    AND l3.id != l1.id
  );

-- Deactivate dot versions that have slash duplicates
UPDATE livekit_available_stt_models l1
SET is_active = FALSE
FROM livekit_available_stt_models l2
WHERE l1.provider = l2.provider 
  AND l1.model_name = l2.model_name
  AND l1.model_id_full LIKE '%.%'   -- dot version (wrong)
  AND l2.model_id_full LIKE '%/%'   -- slash version (correct)
  AND l1.is_active = TRUE;

-- Delete dot versions that have slash duplicates
DELETE FROM livekit_available_stt_models l1
USING livekit_available_stt_models l2
WHERE l1.provider = l2.provider 
  AND l1.model_name = l2.model_name
  AND l1.model_id_full LIKE '%.%'   -- dot version (wrong)
  AND l2.model_id_full LIKE '%/%';  -- slash version (correct)

-- Convert remaining dot-only entries to slash format
-- For STT, we also need to ensure language codes are included (e.g., deepgram/nova-3:en)
UPDATE livekit_available_stt_models
SET model_id_full = REPLACE(model_id_full, '.', '/')
WHERE model_id_full LIKE '%.%' AND model_id_full NOT LIKE '%/%';

-- If model_id_full doesn't have a language code, add default based on provider
-- Deepgram defaults to :multi or :en, AssemblyAI to :en, etc.
UPDATE livekit_available_stt_models
SET model_id_full = model_id_full || ':en'
WHERE model_id_full NOT LIKE '%:%'
  AND provider IN ('deepgram', 'assemblyai', 'cartesia');

UPDATE livekit_available_stt_models
SET model_id_full = model_id_full || ':multi'
WHERE model_id_full NOT LIKE '%:%'
  AND provider = 'deepgram'
  AND model_name LIKE '%nova%';

-- ============================================================================
-- STEP 3: TTS VOICES - Handle duplicates and convert format
-- ============================================================================

-- Transfer active status from dot versions to slash versions if both exist
UPDATE livekit_available_voices l1
SET is_active = TRUE
FROM livekit_available_voices l2
WHERE l1.provider = l2.provider 
  AND l1.voice_id = l2.voice_id
  AND l1.voice_id_full LIKE '%/%'   -- slash version (correct)
  AND l2.voice_id_full LIKE '%.%'   -- dot version (wrong)
  AND l2.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM livekit_available_voices l3 
    WHERE l3.is_active = TRUE 
    AND l3.id != l1.id
  );

-- Deactivate dot versions that have slash duplicates
UPDATE livekit_available_voices l1
SET is_active = FALSE
FROM livekit_available_voices l2
WHERE l1.provider = l2.provider 
  AND l1.voice_id = l2.voice_id
  AND l1.voice_id_full LIKE '%.%'   -- dot version (wrong)
  AND l2.voice_id_full LIKE '%/%'   -- slash version (correct)
  AND l1.is_active = TRUE;

-- Delete dot versions that would create duplicates when converted
-- First, compute what each dot entry would convert to, then delete if that already exists
WITH dot_entries AS (
  SELECT 
    id,
    provider,
    model,
    voice_id_full,
    voice_id,
    -- Compute what this would convert to
    CASE 
      WHEN provider = 'elevenlabs' AND model IS NOT NULL THEN
        provider || '/' || 
        CASE 
          WHEN model = 'multilingual_v2' THEN 'eleven_multilingual_v2'
          WHEN model = 'turbo_v2_5' THEN 'eleven_turbo_v2_5'
          WHEN model = 'turbo_v2' THEN 'eleven_turbo_v2'
          WHEN model = 'flash_v2_5' THEN 'eleven_flash_v2_5'
          WHEN model = 'flash_v2' THEN 'eleven_flash_v2'
          WHEN model LIKE 'eleven_%' THEN model
          ELSE 'eleven_' || model
        END || ':' || SUBSTRING(voice_id_full FROM LENGTH(provider) + 2)
      WHEN model IS NOT NULL THEN
        provider || '/' || model || ':' || SUBSTRING(voice_id_full FROM LENGTH(provider) + 2)
      ELSE
        provider || '/' || SUBSTRING(voice_id_full FROM LENGTH(provider) + 2)
    END as converted_format
  FROM livekit_available_voices
  WHERE voice_id_full LIKE '%.%' AND voice_id_full NOT LIKE '%/%'
)
DELETE FROM livekit_available_voices l1
USING dot_entries de
WHERE l1.id = de.id
  AND EXISTS (
    SELECT 1 FROM livekit_available_voices l2
    WHERE l2.voice_id_full = de.converted_format
      AND l2.voice_id_full LIKE '%/%'
  );

-- Convert remaining dot-only entries to slash format
-- TTS format is: provider/model:voice_id
-- First, fix voice_id if it contains the provider prefix (e.g., "elevenlabs.rachel" -> "rachel")
UPDATE livekit_available_voices
SET voice_id = REPLACE(voice_id, provider || '.', '')
WHERE voice_id LIKE provider || '.%';

-- Now convert voice_id_full: 
-- From docs: format is provider/model_id:voice_id
-- For ElevenLabs: model_id must include "eleven_" prefix (e.g., "eleven_multilingual_v2", not "multilingual_v2")
-- Extract the voice name from voice_id_full (after the dot) and use it with the model
UPDATE livekit_available_voices
SET voice_id_full = 
    CASE 
      -- ElevenLabs: model needs "eleven_" prefix
      WHEN voice_id_full LIKE provider || '.%' AND provider = 'elevenlabs' AND model IS NOT NULL THEN
        provider || '/' || 
        CASE 
          WHEN model = 'multilingual_v2' THEN 'eleven_multilingual_v2'
          WHEN model = 'turbo_v2_5' THEN 'eleven_turbo_v2_5'
          WHEN model = 'turbo_v2' THEN 'eleven_turbo_v2'
          WHEN model = 'flash_v2_5' THEN 'eleven_flash_v2_5'
          WHEN model = 'flash_v2' THEN 'eleven_flash_v2'
          WHEN model LIKE 'eleven_%' THEN model  -- Already has prefix
          ELSE 'eleven_' || model  -- Add prefix if missing
        END || 
        ':' || SUBSTRING(voice_id_full FROM LENGTH(provider) + 2)
      -- If voice_id_full starts with "provider." without model, use default model for elevenlabs
      WHEN voice_id_full LIKE provider || '.%' AND model IS NULL AND provider = 'elevenlabs' THEN
        provider || '/eleven_turbo_v2_5:' || SUBSTRING(voice_id_full FROM LENGTH(provider) + 2)
      -- For other providers, use model as-is (Cartesia, Rime, etc. don't need prefix)
      WHEN voice_id_full LIKE provider || '.%' AND model IS NOT NULL THEN
        provider || '/' || model || ':' || SUBSTRING(voice_id_full FROM LENGTH(provider) + 2)
      -- Otherwise, just replace first dot with slash
      ELSE REPLACE(voice_id_full, '.', '/')
    END
WHERE voice_id_full LIKE '%.%' AND voice_id_full NOT LIKE '%/%';

-- ============================================================================
-- VERIFICATION: Check results
-- ============================================================================

-- Count remaining dot-format entries (should be 0)
DO $$
DECLARE
  llm_dots INTEGER;
  stt_dots INTEGER;
  tts_dots INTEGER;
BEGIN
  SELECT COUNT(*) INTO llm_dots FROM livekit_available_llm_models WHERE model_id_full LIKE '%.%' AND model_id_full NOT LIKE '%/%';
  SELECT COUNT(*) INTO stt_dots FROM livekit_available_stt_models WHERE model_id_full LIKE '%.%' AND model_id_full NOT LIKE '%/%';
  SELECT COUNT(*) INTO tts_dots FROM livekit_available_voices WHERE voice_id_full LIKE '%.%' AND voice_id_full NOT LIKE '%/%';
  
  IF llm_dots > 0 OR stt_dots > 0 OR tts_dots > 0 THEN
    RAISE WARNING 'Still have dot-format entries: LLM=%, STT=%, TTS=%', llm_dots, stt_dots, tts_dots;
  END IF;
END $$;

