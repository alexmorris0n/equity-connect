-- ============================================================================
-- AGENT VOICE CONFIGURATION TABLE
-- Date: 2025-11-13
-- Purpose: Make TTS provider configurable per vertical and language
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_voice_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vertical TEXT NOT NULL DEFAULT 'reverse_mortgage',
    language_code TEXT NOT NULL,  -- en-US, es-US, es-MX
    tts_engine TEXT NOT NULL,  -- elevenlabs, openai, google, amazon, azure, cartesia, rime
    voice_name TEXT NOT NULL,  -- Provider-specific voice ID
    model TEXT,  -- Optional: for providers like Rime, Amazon
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vertical, language_code)
);

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_voice_config_vertical_lang 
ON agent_voice_config(vertical, language_code, is_active);

-- Insert default configurations (English and Spanish)
INSERT INTO agent_voice_config (vertical, language_code, tts_engine, voice_name, model) VALUES
('reverse_mortgage', 'en-US', 'elevenlabs', 'rachel', NULL),
('reverse_mortgage', 'es-US', 'elevenlabs', 'domi', NULL),
('reverse_mortgage', 'es-MX', 'elevenlabs', 'domi', NULL)
ON CONFLICT (vertical, language_code) DO NOTHING;

-- Add helpful comment
COMMENT ON TABLE agent_voice_config IS 'Configurable TTS provider settings per vertical and language';
COMMENT ON COLUMN agent_voice_config.tts_engine IS 'TTS provider: elevenlabs, openai, google, amazon, azure, cartesia, rime';
COMMENT ON COLUMN agent_voice_config.voice_name IS 'Provider-specific voice identifier (see SignalWire Voice API docs)';
COMMENT ON COLUMN agent_voice_config.model IS 'Optional model override (used for Rime Arcana, Amazon Neural/Generative, etc.)';

