-- Inverse migration: Remove TTS parameter columns from agent_voice_config table

ALTER TABLE agent_voice_config
DROP COLUMN IF EXISTS ai_volume,
DROP COLUMN IF EXISTS eleven_labs_stability,
DROP COLUMN IF EXISTS eleven_labs_similarity;

