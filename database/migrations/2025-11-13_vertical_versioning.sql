-- ============================================================================
-- Vertical-Level Versioning System Migration
-- ============================================================================
-- This migration implements snapshot-based versioning where editing ANY node
-- or theme creates a new vertical version (v1 → v2). Unchanged content is
-- tagged to the new version via vertical_versions array (no duplication).
-- 
-- Example:
-- - Start: Vertical v1 (theme v1, greet v1, verify v1, ...)
-- - Edit greet node → creates Vertical v2
--   - greet gets new row (v2) with vertical_versions = [2]
--   - All other nodes get tagged: vertical_versions = [1, 2]
--   - Theme gets tagged: vertical_versions = [1, 2]
-- ============================================================================

-- ============================================================================
-- Section 1: Create vertical_snapshots table
-- ============================================================================
-- Tracks metadata for each vertical version (v1, v2, v3, etc.)
-- This is the "source of truth" for what constitutes a vertical version

CREATE TABLE IF NOT EXISTS vertical_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT false,
    is_draft BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}',
    
    -- Snapshot composition (which rows make up this version)
    theme_id UUID REFERENCES theme_prompts(id),
    node_versions JSONB DEFAULT '{}', -- Maps node_name → prompt_version.id
    
    -- Ensure one active version per vertical
    CONSTRAINT unique_active_version UNIQUE (vertical, is_active) 
        DEFERRABLE INITIALLY DEFERRED,
    
    -- Ensure unique version numbers per vertical
    CONSTRAINT unique_version_number UNIQUE (vertical, version_number)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_vertical_snapshots_vertical 
    ON vertical_snapshots(vertical);
CREATE INDEX IF NOT EXISTS idx_vertical_snapshots_active 
    ON vertical_snapshots(vertical, is_active) 
    WHERE is_active = true;

-- ============================================================================
-- Section 2: Add vertical_versions array to prompt_versions
-- ============================================================================
-- Tracks which vertical versions this node version belongs to
-- Example: [1, 2] means this node is used in vertical v1 and v2

ALTER TABLE prompt_versions 
ADD COLUMN IF NOT EXISTS vertical_versions INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- Index for fast lookups by vertical version
CREATE INDEX IF NOT EXISTS idx_prompt_versions_vertical_versions 
    ON prompt_versions USING GIN (vertical_versions);

-- ============================================================================
-- Section 3: Add vertical_versions array to theme_prompts
-- ============================================================================
-- Tracks which vertical versions this theme belongs to

ALTER TABLE theme_prompts 
ADD COLUMN IF NOT EXISTS vertical_versions INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- Index for fast lookups by vertical version
CREATE INDEX IF NOT EXISTS idx_theme_prompts_vertical_versions 
    ON theme_prompts USING GIN (vertical_versions);

-- ============================================================================
-- Section 4: Initialize existing data with vertical v1
-- ============================================================================
-- Tag all existing active content as belonging to vertical version 1

-- Initialize theme_prompts with version 1
UPDATE theme_prompts 
SET vertical_versions = ARRAY[1]
WHERE vertical_versions = ARRAY[]::INTEGER[] OR vertical_versions IS NULL;

-- Initialize prompt_versions with version 1 (only active versions)
UPDATE prompt_versions pv
SET vertical_versions = ARRAY[1]
FROM prompts p
WHERE pv.prompt_id = p.id 
  AND pv.is_active = true
  AND (pv.vertical_versions = ARRAY[]::INTEGER[] OR pv.vertical_versions IS NULL);

-- Create initial snapshot records for each vertical with active content
INSERT INTO vertical_snapshots (
    vertical, 
    version_number, 
    is_active, 
    theme_id, 
    node_versions,
    metadata
)
SELECT 
    tp.vertical,
    1 as version_number,
    true as is_active,
    tp.id as theme_id,
    (
        SELECT jsonb_object_agg(p.node_name, pv.id)
        FROM prompts p
        JOIN prompt_versions pv ON pv.prompt_id = p.id
        WHERE p.vertical = tp.vertical
          AND pv.is_active = true
          AND p.node_name IS NOT NULL
    ) as node_versions,
    jsonb_build_object(
        'migration_note', 'Initial snapshot created from existing data',
        'created_at', now()
    ) as metadata
FROM theme_prompts tp
WHERE tp.is_active = true
  AND NOT EXISTS (
      SELECT 1 FROM vertical_snapshots vs 
      WHERE vs.vertical = tp.vertical
  )
ON CONFLICT (vertical, version_number) DO NOTHING;

-- ============================================================================
-- Section 5: Add helpful comments
-- ============================================================================
COMMENT ON TABLE vertical_snapshots IS 
'Tracks metadata for each vertical version. Each version is a snapshot of theme + all 8 nodes.';

COMMENT ON COLUMN vertical_snapshots.version_number IS 
'Incremental version number (1, 2, 3...). Increments when ANY node or theme is edited.';

COMMENT ON COLUMN vertical_snapshots.node_versions IS 
'JSONB object mapping node_name to prompt_version.id. Example: {"greet": "uuid1", "verify": "uuid2"}';

COMMENT ON COLUMN prompt_versions.vertical_versions IS 
'Array of vertical version numbers this node version belongs to. Example: [1, 2, 3] means used in v1, v2, and v3.';

COMMENT ON COLUMN theme_prompts.vertical_versions IS 
'Array of vertical version numbers this theme belongs to. Example: [1, 2] means used in v1 and v2.';

-- ============================================================================
-- Section 6: Create helper function to get current vertical version
-- ============================================================================
CREATE OR REPLACE FUNCTION get_current_vertical_version(p_vertical TEXT)
RETURNS INTEGER AS $$
DECLARE
    current_version INTEGER;
BEGIN
    SELECT version_number INTO current_version
    FROM vertical_snapshots
    WHERE vertical = p_vertical
      AND is_active = true
    ORDER BY version_number DESC
    LIMIT 1;
    
    RETURN COALESCE(current_version, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_vertical_version IS 
'Returns the current active version number for a vertical. Returns 0 if none exists.';

-- ============================================================================
-- Section 7: Create helper function to get next vertical version
-- ============================================================================
CREATE OR REPLACE FUNCTION get_next_vertical_version(p_vertical TEXT)
RETURNS INTEGER AS $$
DECLARE
    max_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) INTO max_version
    FROM vertical_snapshots
    WHERE vertical = p_vertical;
    
    RETURN max_version + 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_vertical_version IS 
'Returns the next version number to use when creating a new vertical version.';

-- ============================================================================
-- Done!
-- ============================================================================

