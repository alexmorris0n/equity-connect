-- ============================================================================
-- Add Advanced LiveKit Fields to AI Templates
-- ============================================================================
-- Adds fields needed for the Vue portal's LiveKit configuration UI
-- Includes model_type, turn detector settings, interruption controls, etc.
-- ============================================================================

-- Add model_type column (pipeline, openai_realtime, gemini_live)
ALTER TABLE ai_templates
ADD COLUMN IF NOT EXISTS model_type TEXT DEFAULT 'pipeline' CHECK (model_type IN ('pipeline', 'openai_realtime', 'gemini_live'));

-- Add interruption control fields
ALTER TABLE ai_templates
ADD COLUMN IF NOT EXISTS allow_interruptions BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS min_interruption_duration NUMERIC DEFAULT 0.5 CHECK (min_interruption_duration >= 0),
ADD COLUMN IF NOT EXISTS preemptive_generation BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS resume_false_interruption BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS false_interruption_timeout NUMERIC DEFAULT 2.0 CHECK (false_interruption_timeout >= 0);

-- Add web search configuration
ALTER TABLE ai_templates
ADD COLUMN IF NOT EXISTS enable_web_search BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS web_search_max_results INTEGER DEFAULT 5 CHECK (web_search_max_results > 0 AND web_search_max_results <= 20);

-- Add turn detector configuration (LiveKit's turn detector, not VAD)
ALTER TABLE ai_templates
ADD COLUMN IF NOT EXISTS use_turn_detector BOOLEAN DEFAULT TRUE NOT NULL,
ADD COLUMN IF NOT EXISTS turn_detector_model TEXT DEFAULT 'fast' NOT NULL CHECK (turn_detector_model IN ('fast', 'accurate')),
ADD COLUMN IF NOT EXISTS turn_detector_threshold NUMERIC DEFAULT 0.25 CHECK (turn_detector_threshold BETWEEN 0 AND 1),
ADD COLUMN IF NOT EXISTS min_endpointing_delay NUMERIC DEFAULT 0.1 NOT NULL CHECK (min_endpointing_delay >= 0),
ADD COLUMN IF NOT EXISTS max_endpointing_delay NUMERIC DEFAULT 3.0 NOT NULL CHECK (max_endpointing_delay >= min_endpointing_delay);

-- Add realtime-specific fields (for OpenAI Realtime API)
ALTER TABLE ai_templates
ADD COLUMN IF NOT EXISTS realtime_model TEXT,
ADD COLUMN IF NOT EXISTS realtime_voice TEXT,
ADD COLUMN IF NOT EXISTS realtime_temperature NUMERIC CHECK (realtime_temperature BETWEEN 0 AND 2),
ADD COLUMN IF NOT EXISTS realtime_modalities TEXT,
ADD COLUMN IF NOT EXISTS realtime_turn_detection_type TEXT CHECK (realtime_turn_detection_type IN ('server_vad', 'semantic_vad', 'none')),
ADD COLUMN IF NOT EXISTS realtime_vad_threshold NUMERIC CHECK (realtime_vad_threshold BETWEEN 0 AND 1),
ADD COLUMN IF NOT EXISTS realtime_prefix_padding_ms INTEGER CHECK (realtime_prefix_padding_ms >= 0),
ADD COLUMN IF NOT EXISTS realtime_silence_duration_ms INTEGER CHECK (realtime_silence_duration_ms >= 0),
ADD COLUMN IF NOT EXISTS realtime_eagerness TEXT CHECK (realtime_eagerness IN ('auto', 'low', 'medium', 'high'));

-- Add Gemini Live-specific fields
ALTER TABLE ai_templates
ADD COLUMN IF NOT EXISTS gemini_model TEXT,
ADD COLUMN IF NOT EXISTS gemini_voice TEXT,
ADD COLUMN IF NOT EXISTS gemini_temperature NUMERIC CHECK (gemini_temperature BETWEEN 0 AND 2),
ADD COLUMN IF NOT EXISTS gemini_instructions TEXT,
ADD COLUMN IF NOT EXISTS gemini_modalities TEXT,
ADD COLUMN IF NOT EXISTS gemini_enable_affective_dialog BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS gemini_proactivity INTEGER DEFAULT 0 CHECK (gemini_proactivity BETWEEN 0 AND 100),
ADD COLUMN IF NOT EXISTS gemini_vertexai BOOLEAN DEFAULT FALSE;

-- Update existing templates to have model_type='pipeline' (default)
UPDATE ai_templates
SET model_type = 'pipeline'
WHERE model_type IS NULL;

-- Comments
COMMENT ON COLUMN ai_templates.model_type IS 'Agent architecture: pipeline (separate STT/LLM/TTS), openai_realtime (bundled), or gemini_live (bundled)';
COMMENT ON COLUMN ai_templates.use_turn_detector IS 'Enable LiveKit turn detector for intelligent end-of-turn detection';
COMMENT ON COLUMN ai_templates.turn_detector_model IS 'LiveKit turn detector model: fast (lower latency) or accurate (better detection)';
COMMENT ON COLUMN ai_templates.allow_interruptions IS 'Allow user to interrupt agent speech';
COMMENT ON COLUMN ai_templates.preemptive_generation IS 'Start generating response before user finishes (lower latency)';
COMMENT ON COLUMN ai_templates.enable_web_search IS 'Enable web search tool for real-time information lookup';


