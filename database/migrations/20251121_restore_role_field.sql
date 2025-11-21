-- ============================================================================
-- RESTORE 'role' field to prompt_versions content
-- ============================================================================
-- Date: 2024-11-21
-- 
-- The 'role' field was previously removed thinking it was redundant with 
-- instructions, but the code still uses it via hardcoded fallback.
-- This means we have no database control over the AI's core identity.
--
-- This migration restores the 'role' field and populates it with appropriate
-- role descriptions for each node, replacing the hardcoded fallback with
-- database-driven content.
-- ============================================================================

-- Step 1: Add 'role' field to ALL active prompt_versions for reverse_mortgage
-- Using the EXACT hardcoded text currently in prompt_adapter.py (lines 114-118)
-- This ensures Vue displays what's actually being used right now

UPDATE prompt_versions
SET content = jsonb_set(
    content,
    '{role}',
    '"You are Barbara, a warm, professional voice assistant. You help seniors understand reverse mortgage options, verify their information, answer questions accurately, and schedule time with their assigned broker."'::jsonb
)
WHERE prompt_id IN (
    SELECT id FROM prompts 
    WHERE vertical = 'reverse_mortgage'
)
AND is_active = true
AND (content->>'role' IS NULL OR content->>'role' = '');

-- Step 2: Verify the updates
SELECT 
    p.node_name,
    pv.content->>'role' as role_description,
    LENGTH(pv.content->>'role') as role_length
FROM prompt_versions pv
JOIN prompts p ON p.id = pv.prompt_id
WHERE pv.is_active = true
AND p.vertical = 'reverse_mortgage'
ORDER BY
    CASE p.node_name
        WHEN 'greet' THEN 1
        WHEN 'verify' THEN 2
        WHEN 'qualify' THEN 3
        WHEN 'answer' THEN 4
        WHEN 'quote' THEN 5
        WHEN 'objections' THEN 6
        WHEN 'book' THEN 7
        WHEN 'goodbye' THEN 8
    END;

-- Expected output: 8 rows showing each node with its role description
-- All role_length values should be > 100 characters

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. This populates ALL nodes with the EXACT hardcoded text from prompt_adapter.py
-- 2. This is the generic fallback currently being used when role field is empty
-- 3. Users can now SEE this text in Vue and customize it per node
-- 4. After running this migration, Vue will display the current behavior
-- 5. Users can then edit to make each node's role more specific
-- ============================================================================

