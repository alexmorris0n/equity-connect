-- ============================================================================
-- ADD TTS PARAMETERS TO VOICE CONFIG
-- Date: 2025-01-12
-- Purpose: Add SignalWire TTS parameter columns for voice configuration
-- ============================================================================

-- Add TTS parameter columns to agent_voice_config table
ALTER TABLE agent_voice_config
ADD COLUMN IF NOT EXISTS ai_volume INTEGER DEFAULT 0 CHECK (ai_volume >= -50 AND ai_volume <= 50),
ADD COLUMN IF NOT EXISTS eleven_labs_stability NUMERIC DEFAULT 0.5 CHECK (eleven_labs_stability >= 0.0 AND eleven_labs_stability <= 1.0),
ADD COLUMN IF NOT EXISTS eleven_labs_similarity NUMERIC DEFAULT 0.75 CHECK (eleven_labs_similarity >= 0.0 AND eleven_labs_similarity <= 1.0);

-- Add comments explaining the parameters
COMMENT ON COLUMN agent_voice_config.ai_volume IS 'SignalWire AI-level volume control (-50 to 50). Applies to all TTS providers. Default: 0';
COMMENT ON COLUMN agent_voice_config.eleven_labs_stability IS 'ElevenLabs voice stability (0.0-1.0). Lower = more variation, Higher = more consistent. Only applies to ElevenLabs provider. Default: 0.5';
COMMENT ON COLUMN agent_voice_config.eleven_labs_similarity IS 'ElevenLabs voice similarity boost (0.0-1.0). Higher = closer to original voice. Only applies to ElevenLabs provider. Default: 0.75';

-- Update existing rows with default values
UPDATE agent_voice_config
SET 
  ai_volume = COALESCE(ai_volume, 0),
  eleven_labs_stability = COALESCE(eleven_labs_stability, 0.5),
  eleven_labs_similarity = COALESCE(eleven_labs_similarity, 0.75)
WHERE ai_volume IS NULL OR eleven_labs_stability IS NULL OR eleven_labs_similarity IS NULL;


