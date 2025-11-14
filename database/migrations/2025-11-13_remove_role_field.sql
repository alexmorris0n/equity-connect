-- ============================================================================
-- Remove unused 'role' field from prompt_versions content
-- ============================================================================
-- The 'role' field in prompt_versions.content is not used by contexts_builder
-- or barbara_agent. It's redundant with instructions and causes confusion.
-- We'll add tooltips in the Vue UI instead to explain node purposes.
-- ============================================================================

-- Remove 'role' from all prompt_versions content JSONB
UPDATE prompt_versions
SET content = content - 'role'
WHERE content ? 'role';

-- Verify removal
DO $$
DECLARE
    remaining_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_count
    FROM prompt_versions
    WHERE content ? 'role';
    
    IF remaining_count > 0 THEN
        RAISE NOTICE 'Warning: % prompt versions still have role field', remaining_count;
    ELSE
        RAISE NOTICE 'Success: All role fields removed from prompt_versions';
    END IF;
END $$;

