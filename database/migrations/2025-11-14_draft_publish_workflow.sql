-- ============================================================================
-- Draft/Publish Workflow Migration
-- Adds support for draft editing and controlled version publishing
-- Note: is_draft and is_active already exist in vertical_snapshots
-- ============================================================================

-- Add is_draft to prompt_versions
-- Individual node edits are saved as drafts until the vertical is published
ALTER TABLE prompt_versions
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;

-- Add is_draft to theme_prompts
-- Theme edits are saved as drafts until the vertical is published
ALTER TABLE theme_prompts
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;

-- Update existing data: current active versions should not be drafts
UPDATE vertical_snapshots 
SET is_draft = false, is_active = true
WHERE version_number IN (
  SELECT MAX(version_number) 
  FROM vertical_snapshots 
  GROUP BY vertical
);

UPDATE prompt_versions
SET is_draft = false
WHERE is_active = true;

UPDATE theme_prompts
SET is_draft = false
WHERE is_active = true;

-- Create helper function to get current draft version
-- Returns NULL if no draft exists (not 0)
CREATE OR REPLACE FUNCTION get_current_draft_version(p_vertical TEXT)
RETURNS INTEGER AS $$
DECLARE
  draft_version INTEGER;
BEGIN
  SELECT version_number INTO draft_version
  FROM vertical_snapshots
  WHERE vertical = p_vertical AND is_draft = true
  LIMIT 1;
  
  RETURN draft_version; -- Returns NULL if no draft found
END;
$$ LANGUAGE plpgsql;

-- Create helper function to publish draft version
CREATE OR REPLACE FUNCTION publish_draft_version(
  p_vertical TEXT,
  p_draft_version INTEGER,
  p_make_active BOOLEAN DEFAULT true
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Mark the draft as published
  UPDATE vertical_snapshots
  SET is_draft = false,
      is_active = p_make_active,
      updated_at = NOW()
  WHERE vertical = p_vertical AND version_number = p_draft_version;
  
  -- Mark all prompt_versions for this draft as published (only for this vertical)
  UPDATE prompt_versions pv
  SET is_draft = false,
      is_active = p_make_active
  FROM prompts p
  WHERE p.id = pv.prompt_id
    AND p.vertical = p_vertical
    AND p_draft_version = ANY(pv.vertical_versions);
  
  -- Mark theme for this draft as published
  UPDATE theme_prompts
  SET is_draft = false,
      is_active = p_make_active,
      updated_at = NOW()
  WHERE vertical = p_vertical AND p_draft_version = ANY(vertical_versions);
  
  -- If making active, deactivate all other versions
  IF p_make_active THEN
    UPDATE vertical_snapshots
    SET is_active = false
    WHERE vertical = p_vertical AND version_number != p_draft_version;
    
    UPDATE prompt_versions pv
    SET is_active = false
    FROM prompts p
    WHERE p.id = pv.prompt_id 
      AND p.vertical = p_vertical
      AND NOT (p_draft_version = ANY(pv.vertical_versions));
    
    UPDATE theme_prompts
    SET is_active = false
    WHERE vertical = p_vertical AND NOT (p_draft_version = ANY(vertical_versions));
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to activate a specific version
CREATE OR REPLACE FUNCTION activate_version(
  p_vertical TEXT,
  p_version_number INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Deactivate all versions for this vertical
  UPDATE vertical_snapshots
  SET is_active = false
  WHERE vertical = p_vertical;
  
  UPDATE prompt_versions pv
  SET is_active = false
  FROM prompts p
  WHERE p.id = pv.prompt_id AND p.vertical = p_vertical;
  
  UPDATE theme_prompts
  SET is_active = false
  WHERE vertical = p_vertical;
  
  -- Activate the selected version
  UPDATE vertical_snapshots
  SET is_active = true,
      updated_at = NOW()
  WHERE vertical = p_vertical AND version_number = p_version_number;
  
  -- Activate all content tagged with this version
  UPDATE prompt_versions pv
  SET is_active = true
  FROM prompts p
  WHERE p.id = pv.prompt_id 
    AND p.vertical = p_vertical
    AND p_version_number = ANY(pv.vertical_versions);
  
  UPDATE theme_prompts
  SET is_active = true
  WHERE vertical = p_vertical AND p_version_number = ANY(vertical_versions);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to discard draft changes
CREATE OR REPLACE FUNCTION discard_draft_changes(p_vertical TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  draft_version INTEGER;
  active_version INTEGER;
BEGIN
  -- Get draft version
  SELECT version_number INTO draft_version
  FROM vertical_snapshots
  WHERE vertical = p_vertical AND is_draft = true
  LIMIT 1;
  
  IF draft_version IS NULL THEN
    RETURN false; -- No draft to discard
  END IF;
  
  -- Get currently active version
  SELECT version_number INTO active_version
  FROM vertical_snapshots
  WHERE vertical = p_vertical AND is_active = true
  LIMIT 1;
  
  -- Delete draft snapshot
  DELETE FROM vertical_snapshots
  WHERE vertical = p_vertical AND version_number = draft_version;
  
  -- Delete draft prompt_versions that ONLY belong to draft
  DELETE FROM prompt_versions pv
  USING prompts p
  WHERE p.id = pv.prompt_id
    AND p.vertical = p_vertical
    AND pv.vertical_versions = ARRAY[draft_version]::INTEGER[]
    AND pv.is_draft = true;
  
  -- Remove draft tag from prompt_versions that also belong to other versions
  UPDATE prompt_versions pv
  SET vertical_versions = array_remove(pv.vertical_versions, draft_version),
      is_draft = false
  FROM prompts p
  WHERE p.id = pv.prompt_id
    AND p.vertical = p_vertical
    AND draft_version = ANY(pv.vertical_versions)
    AND array_length(pv.vertical_versions, 1) > 1;
  
  -- Delete draft theme if it only belongs to draft
  DELETE FROM theme_prompts
  WHERE vertical = p_vertical
    AND vertical_versions = ARRAY[draft_version]::INTEGER[]
    AND is_draft = true;
  
  -- Remove draft tag from theme that also belongs to other versions
  UPDATE theme_prompts
  SET vertical_versions = array_remove(vertical_versions, draft_version),
      is_draft = false
  WHERE vertical = p_vertical
    AND draft_version = ANY(vertical_versions)
    AND array_length(vertical_versions, 1) > 1;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON COLUMN vertical_snapshots.is_draft IS 'True if this version is still being edited (unpublished)';
COMMENT ON COLUMN vertical_snapshots.is_active IS 'True if this is the active version used by the agent';
COMMENT ON COLUMN prompt_versions.is_draft IS 'True if this content is part of an unpublished draft';
COMMENT ON COLUMN theme_prompts.is_draft IS 'True if this content is part of an unpublished draft';
COMMENT ON FUNCTION get_current_draft_version IS 'Returns the version number of the current draft, or NULL if no draft exists';
COMMENT ON FUNCTION publish_draft_version IS 'Publishes a draft version and optionally makes it active';
COMMENT ON FUNCTION activate_version IS 'Activates a specific version (deactivates all others)';
COMMENT ON FUNCTION discard_draft_changes IS 'Discards all draft changes and removes draft version';

