-- Add voice and VAD settings to prompts table
-- These settings control how the AI sounds and responds to speech

-- Add voice selection column
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS voice VARCHAR(50) DEFAULT 'shimmer';

-- Add VAD (Voice Activity Detection) settings
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS vad_threshold NUMERIC(3,2) DEFAULT 0.5;

ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS vad_prefix_padding_ms INTEGER DEFAULT 300;

ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS vad_silence_duration_ms INTEGER DEFAULT 500;

-- Add constraints for valid values
ALTER TABLE prompts 
ADD CONSTRAINT check_voice_valid 
CHECK (voice IN ('alloy', 'echo', 'shimmer', 'ash', 'ballad', 'coral', 'sage', 'verse', 'cedar', 'marin'));

ALTER TABLE prompts 
ADD CONSTRAINT check_vad_threshold_range 
CHECK (vad_threshold >= 0.0 AND vad_threshold <= 1.0);

ALTER TABLE prompts 
ADD CONSTRAINT check_vad_prefix_padding_range 
CHECK (vad_prefix_padding_ms >= 100 AND vad_prefix_padding_ms <= 1000);

ALTER TABLE prompts 
ADD CONSTRAINT check_vad_silence_duration_range 
CHECK (vad_silence_duration_ms >= 200 AND vad_silence_duration_ms <= 2000);

-- Add comments for documentation
COMMENT ON COLUMN prompts.voice IS 'OpenAI Realtime API voice: alloy, echo, shimmer, ash, ballad, coral, sage, verse, cedar, marin';
COMMENT ON COLUMN prompts.vad_threshold IS 'Voice Activity Detection threshold (0.0-1.0). Lower = more sensitive to speech.';
COMMENT ON COLUMN prompts.vad_prefix_padding_ms IS 'Milliseconds of audio to capture BEFORE speech starts (100-1000ms)';
COMMENT ON COLUMN prompts.vad_silence_duration_ms IS 'Milliseconds of silence before considering speech finished (200-2000ms)';

-- Set default values for existing prompts
UPDATE prompts 
SET 
  voice = 'shimmer',
  vad_threshold = 0.5,
  vad_prefix_padding_ms = 300,
  vad_silence_duration_ms = 500
WHERE voice IS NULL;

