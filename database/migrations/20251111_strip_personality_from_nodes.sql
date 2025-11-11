-- =====================================================
-- STRIP PERSONALITY FROM NODE PROMPTS
-- =====================================================
-- Purpose: Remove personality sections from node prompts to avoid duplication
-- Personality is now defined ONCE in theme_prompts, not in each node
-- Created: 2025-11-11
-- =====================================================

-- Remove personality sections from node prompts to avoid duplication with theme
-- Personality is now defined ONCE in theme_prompts, not in each node

DO $$
DECLARE
    node_record RECORD;
    updated_content JSONB;
BEGIN
    -- Loop through all active reverse_mortgage node prompts
    FOR node_record IN 
        SELECT p.id, p.node_name, pv.id as version_id, pv.content
        FROM prompts p
        JOIN prompt_versions pv ON p.id = pv.prompt_id AND p.current_version = pv.version_number
        WHERE p.vertical = 'reverse_mortgage' AND p.is_active = true AND pv.is_active = true
    LOOP
        -- Remove 'personality' key from JSONB content
        updated_content := node_record.content - 'personality';
        
        -- Update the prompt_version
        UPDATE prompt_versions
        SET content = updated_content,
            change_summary = 'Removed personality (now in theme_prompts)',
            updated_at = NOW()
        WHERE id = node_record.version_id;
        
        RAISE NOTICE 'Stripped personality from node: %', node_record.node_name;
    END LOOP;
END $$;

-- Refresh active_node_prompts view if it exists
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE schemaname = 'public' AND matviewname = 'active_node_prompts'
    ) THEN
        REFRESH MATERIALIZED VIEW active_node_prompts;
    END IF;
END $$;

