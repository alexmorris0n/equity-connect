-- Add TTS parameter columns to agent_voice_config table
-- These columns store ElevenLabs-specific and general TTS settings

ALTER TABLE agent_voice_config
ADD COLUMN IF NOT EXISTS ai_volume INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS eleven_labs_stability NUMERIC DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS eleven_labs_similarity NUMERIC DEFAULT 0.75;

-- Comments explaining each column
COMMENT ON COLUMN agent_voice_config.ai_volume IS 'SignalWire AI-level volume control. Range: -50 (quiet) to 50 (loud). Default: 0 (normal).';
COMMENT ON COLUMN agent_voice_config.eleven_labs_stability IS 'ElevenLabs voice consistency. Range: 0.0 (more variation) to 1.0 (more consistent). Default: 0.5 (balanced).';
COMMENT ON COLUMN agent_voice_config.eleven_labs_similarity IS 'ElevenLabs similarity boost. Range: 0.0 (low boost) to 1.0 (high boost). Default: 0.75.';

