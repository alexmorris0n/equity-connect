-- ============================================================================
-- Draft/Publish Workflow Hotfix
-- Fixes two critical bugs in the draft/publish workflow functions
-- ============================================================================

-- Fix Bug 1: Correct documentation for get_current_draft_version()
-- Returns NULL (not 0) when no draft exists
DROP FUNCTION IF EXISTS get_current_draft_version(TEXT);
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

COMMENT ON FUNCTION get_current_draft_version IS 'Returns the version number of the current draft, or NULL if no draft exists';

-- Fix Bug 2: Add vertical constraint to publish_draft_version()
-- Critical fix: prevents cross-vertical data corruption
DROP FUNCTION IF EXISTS publish_draft_version(TEXT, INTEGER, BOOLEAN);
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

COMMENT ON FUNCTION publish_draft_version IS 'Publishes a draft version and optionally makes it active. Fixed to prevent cross-vertical data corruption.';

