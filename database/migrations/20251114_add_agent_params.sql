-- 20251114_add_agent_params.sql
-- Configurable SignalWire AI agent parameters stored per vertical/language.
-- Reference ranges pulled from SignalWire AI Params docs:
--   - attention_timeout: 5-15 seconds recommended for seniors (allowed 0-600000ms)
--   - end_of_speech_timeout: 500-2000ms (SignalWire default 700ms)
--   - acknowledge_interruptions: 0-10 interruptions to acknowledge (bool or integer)
--   - ai_volume/background_file_volume: -50 to 50
--   - eleven_labs_* sliders: 0.01 - 1.0

CREATE TABLE IF NOT EXISTS agent_params (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vertical TEXT NOT NULL,
    language TEXT DEFAULT 'en-US',

    -- Timing & delays (all values in milliseconds unless noted)
    attention_timeout INTEGER DEFAULT 8000,
    attention_timeout_prompt TEXT DEFAULT 'The caller may be thinking or didn''t hear the question. Gently ask if they need you to repeat anything or explain it differently. Stay warm and patient—don''t sound frustrated.',
    end_of_speech_timeout INTEGER DEFAULT 800,
    hard_stop_time TEXT DEFAULT '30m',
    hard_stop_prompt TEXT DEFAULT 'I want to make sure I''m respecting your time. We''ve covered a lot—would you like me to connect you with {broker.first_name} to continue, or would you prefer to think it over and call back?',
    first_word_timeout INTEGER DEFAULT 1000,

    -- Interruption handling
    acknowledge_interruptions INTEGER DEFAULT 3,
    interrupt_prompt TEXT DEFAULT 'The caller interrupted you, which likely means they have an important question or concern. Acknowledge their interruption warmly (''Oh, absolutely—''), directly address what they said, then naturally return to your point if needed. Never sound annoyed or frustrated.',
    transparent_barge BOOLEAN DEFAULT TRUE,
    enable_barge TEXT DEFAULT 'complete,partial',

    -- Voice & audio
    ai_volume INTEGER DEFAULT 0,
    background_file TEXT,
    background_file_volume INTEGER DEFAULT -40,
    background_file_loops INTEGER DEFAULT -1,
    eleven_labs_stability DECIMAL(3,2),
    eleven_labs_similarity DECIMAL(3,2),
    max_emotion INTEGER DEFAULT 30,

    -- Call behavior defaults
    wait_for_user_default BOOLEAN DEFAULT FALSE,
    local_tz_default TEXT DEFAULT 'America/Los_Angeles',
    static_greeting TEXT,
    static_greeting_no_barge BOOLEAN DEFAULT FALSE,

    -- Advanced settings
    energy_level INTEGER DEFAULT 52,
    inactivity_timeout INTEGER DEFAULT 600000,
    outbound_attention_timeout INTEGER DEFAULT 120000,

    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(vertical, language)
);

COMMENT ON TABLE agent_params IS 'Configuration parameters for AI agent behavior (timing, interruptions, voice settings).';

-- Seed defaults for reverse mortgage vertical
INSERT INTO agent_params (vertical, language)
VALUES ('reverse_mortgage', 'en-US')
ON CONFLICT (vertical, language) DO NOTHING;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_agent_params_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_params_updated_at
    BEFORE UPDATE ON agent_params
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_params_updated_at();

-- Index for active records per vertical/language
CREATE INDEX IF NOT EXISTS idx_agent_params_vertical_language
ON agent_params (vertical, language)
WHERE is_active = TRUE;

