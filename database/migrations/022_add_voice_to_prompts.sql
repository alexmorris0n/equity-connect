-- =====================================================
-- ADD VOICE SELECTION TO PROMPTS
-- =====================================================
-- Purpose: Allow voice selection for each prompt
-- Created: 2025-10-27
-- =====================================================

-- Add voice column to prompts table
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS voice VARCHAR(50) DEFAULT 'alloy';

-- Add check constraint for valid voices
ALTER TABLE prompts 
ADD CONSTRAINT prompts_voice_check 
CHECK (voice IN ('alloy', 'echo', 'shimmer', 'ash', 'ballad', 'coral', 'sage', 'verse', 'cedar', 'marin'));

-- Create index for voice queries
CREATE INDEX IF NOT EXISTS idx_prompts_voice ON prompts(voice);

-- Update existing prompts to use default voice
UPDATE prompts SET voice = 'alloy' WHERE voice IS NULL;

COMMENT ON COLUMN prompts.voice IS 'OpenAI Realtime API voice: alloy, echo, shimmer, ash, ballad, coral, sage, verse, cedar, marin';

