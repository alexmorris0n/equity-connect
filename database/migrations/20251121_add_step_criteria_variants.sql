-- Migration: Add step_criteria variants for platform-specific optimization
-- Date: 2024-11-21
-- 
-- This migration adds three new fields to prompt_versions.content:
-- 1. step_criteria_source: Human-readable description (displayed in Vue)
-- 2. step_criteria_sw: SignalWire-optimized natural language (auto-generated)
-- 3. step_criteria_lk: LiveKit boolean expression (auto-generated)
--
-- The existing step_criteria field is preserved for backward compatibility.

-- Step 1: Copy existing step_criteria to step_criteria_source
-- This preserves the current human-readable version
UPDATE prompt_versions
SET content = jsonb_set(
    content,
    '{step_criteria_source}',
    content->'step_criteria'
)
WHERE content ? 'step_criteria'
AND content->>'step_criteria' IS NOT NULL
AND content->>'step_criteria' != '';

-- Step 2: Initialize step_criteria_sw as empty string (will be populated by conversion script)
UPDATE prompt_versions
SET content = jsonb_set(
    content,
    '{step_criteria_sw}',
    '""'::jsonb
)
WHERE content ? 'step_criteria';

-- Step 3: Initialize step_criteria_lk as empty string (will be populated by conversion script)
UPDATE prompt_versions
SET content = jsonb_set(
    content,
    '{step_criteria_lk}',
    '""'::jsonb
)
WHERE content ? 'step_criteria';

-- Verify the migration
-- This query shows before/after for each node
SELECT 
    p.node_name,
    pv.content->>'step_criteria' as original,
    pv.content->>'step_criteria_source' as source,
    pv.content->>'step_criteria_sw' as signalwire,
    pv.content->>'step_criteria_lk' as livekit
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

