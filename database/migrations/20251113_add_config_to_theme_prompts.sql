-- Add config JSONB column to theme_prompts table for storing voice/model/telephony/safety settings
-- This allows each vertical to have its own configuration alongside the theme content

ALTER TABLE theme_prompts 
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';

-- Add comment explaining the config structure
COMMENT ON COLUMN theme_prompts.config IS 'JSONB object storing vertical-specific settings: models (llm/stt/tts), vad, eos_timeout_ms, record_call, telephony (auto_answer, ring_delay_ms), safety (blocked_phrases, max_tool_depth)';

-- Create index on config for faster queries (optional, but helpful for filtering)
CREATE INDEX IF NOT EXISTS idx_theme_prompts_config ON theme_prompts USING GIN (config);







