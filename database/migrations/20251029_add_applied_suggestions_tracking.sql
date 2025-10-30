-- =====================================================
-- ADD APPLIED SUGGESTIONS TRACKING
-- =====================================================
-- Purpose: Track which AI improvement suggestions have been applied to each version
-- Created: 2025-10-29
-- =====================================================

-- Add applied_suggestions column to prompt_versions
ALTER TABLE prompt_versions 
ADD COLUMN IF NOT EXISTS applied_suggestions JSONB DEFAULT '[]'::jsonb;

-- Add index for querying applied suggestions
CREATE INDEX IF NOT EXISTS idx_prompt_versions_applied_suggestions 
ON prompt_versions USING GIN (applied_suggestions);

-- Comment
COMMENT ON COLUMN prompt_versions.applied_suggestions IS 'Array of section keys where AI suggestions have been applied (e.g., ["role", "personality", "instructions"])';

