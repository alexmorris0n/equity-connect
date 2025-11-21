-- Fix Realtime Model Format
-- Realtime models are plugins, not inference models, so model_id_full should be just the model name
-- (not prefixed with provider like inference models use)

-- ============================================================================
-- STEP 1: Fix OpenAI Realtime model format
-- ============================================================================

-- Update model_id_full to remove provider prefix
-- OpenAI Realtime: model_id_full should be just the model name (e.g., "gpt-realtime" or "gpt-4o-realtime-preview")
UPDATE livekit_available_realtime_models
SET model_id_full = REPLACE(model_id_full, 'openai-realtime/', '')
WHERE provider = 'openai-realtime' AND model_id_full LIKE 'openai-realtime/%';

-- Keep existing model names, just ensure model_id_full matches model_name (no provider prefix)
UPDATE livekit_available_realtime_models
SET model_id_full = model_name
WHERE provider = 'openai-realtime' AND model_id_full != model_name;

-- ============================================================================
-- STEP 2: Fix Google Realtime (Gemini Live) model format
-- ============================================================================

-- Update model_id_full to remove provider prefix
-- Gemini Live: model_id_full should be just the model name (e.g., "gemini-2.0-flash-exp")
UPDATE livekit_available_realtime_models
SET model_id_full = REPLACE(model_id_full, 'google-realtime/', '')
WHERE provider = 'google-realtime' AND model_id_full LIKE 'google-realtime/%';

-- Keep existing model names, just ensure model_id_full matches model_name (no provider prefix)
UPDATE livekit_available_realtime_models
SET model_id_full = model_name
WHERE provider = 'google-realtime' AND model_id_full != model_name;

-- ============================================================================
-- STEP 3: Add missing Gemini 2.5 model if needed
-- ============================================================================

-- Add gemini-2.5-flash-native-audio-preview-09-2025 if it doesn't exist
INSERT INTO livekit_available_realtime_models (provider, model_name, model_id_full, display_name, is_available, notes, requires_api_key)
VALUES
  ('google-realtime', 'gemini-2.5-flash-native-audio-preview-09-2025', 'gemini-2.5-flash-native-audio-preview-09-2025', 'Gemini 2.5 Flash Native Audio Preview', true, 'Realtime Plugin - Requires Google API key. Supports thinking mode.', true)
ON CONFLICT (model_id_full) DO UPDATE SET
  provider = EXCLUDED.provider,
  model_name = EXCLUDED.model_name,
  display_name = EXCLUDED.display_name,
  is_available = EXCLUDED.is_available,
  notes = EXCLUDED.notes;

-- ============================================================================
-- VERIFICATION: Check results
-- ============================================================================

DO $$
DECLARE
  openai_format INTEGER;
  google_format INTEGER;
BEGIN
  -- Check for incorrect formats (should have no provider prefix)
  SELECT COUNT(*) INTO openai_format 
  FROM livekit_available_realtime_models 
  WHERE provider = 'openai-realtime' AND model_id_full LIKE 'openai-realtime/%';
  
  SELECT COUNT(*) INTO google_format 
  FROM livekit_available_realtime_models 
  WHERE provider = 'google-realtime' AND model_id_full LIKE 'google-realtime/%';
  
  IF openai_format > 0 OR google_format > 0 THEN
    RAISE WARNING 'Still have incorrect formats: OpenAI=%, Google=%', openai_format, google_format;
  END IF;
  
  RAISE NOTICE 'Realtime model format fix complete';
END $$;

