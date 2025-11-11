-- =====================================================
-- ADD VERTICAL + NODE_NAME TO PROMPTS
-- =====================================================
-- Purpose: Support node-based conversation routing with context injection
-- Created: 2025-11-11
-- =====================================================

-- Add vertical column (business vertical: reverse_mortgage, solar, hvac)
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS vertical VARCHAR(50) DEFAULT 'reverse_mortgage';

-- Add node_name column (conversation phase)
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS node_name VARCHAR(50);

-- Add check constraint for valid nodes
ALTER TABLE prompts 
ADD CONSTRAINT prompts_node_name_check 
CHECK (node_name IN ('greet', 'verify', 'qualify', 'answer', 'objections', 'book', 'exit'));

-- Add check constraint for valid verticals
ALTER TABLE prompts 
ADD CONSTRAINT prompts_vertical_check 
CHECK (vertical IN ('reverse_mortgage', 'solar', 'hvac'));

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_prompts_vertical ON prompts(vertical);
CREATE INDEX IF NOT EXISTS idx_prompts_node_name ON prompts(node_name);
CREATE INDEX IF NOT EXISTS idx_prompts_vertical_node 
ON prompts(vertical, node_name) 
WHERE is_active = true;

-- Update unique constraint: one active prompt per (vertical, node_name) pair
CREATE UNIQUE INDEX idx_prompts_vertical_node_unique 
ON prompts(vertical, node_name) 
WHERE is_active = true AND vertical IS NOT NULL AND node_name IS NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN prompts.vertical IS 'Business vertical: reverse_mortgage, solar, hvac';
COMMENT ON COLUMN prompts.node_name IS 'Conversation node: greet, verify, qualify, answer, objections, book, exit';

-- =====================================================
-- CREATE HELPER VIEW FOR ACTIVE NODE PROMPTS
-- =====================================================

-- Create view for easy queries of active node prompts
CREATE OR REPLACE VIEW active_node_prompts AS
SELECT 
  p.id,
  p.name,
  p.vertical,
  p.node_name,
  p.current_version,
  pv.content,
  pv.variables,
  pv.version_number
FROM prompts p
JOIN prompt_versions pv ON p.id = pv.prompt_id
WHERE p.is_active = true 
  AND pv.is_active = true
  AND pv.is_draft = false
  AND p.node_name IS NOT NULL
  AND p.vertical IS NOT NULL;

COMMENT ON VIEW active_node_prompts IS 'Active node prompts - Python backend queries this';

-- =====================================================
-- CREATE QUERY FUNCTION FOR BACKEND
-- =====================================================

-- Function to get prompt content for (vertical, node_name)
CREATE OR REPLACE FUNCTION get_node_prompt(
  p_vertical VARCHAR(50),
  p_node_name VARCHAR(50)
) RETURNS TABLE (
  prompt_id UUID,
  prompt_name VARCHAR(255),
  version_number INTEGER,
  content JSONB,
  variables TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    pv.version_number,
    pv.content,
    pv.variables
  FROM prompts p
  JOIN prompt_versions pv ON p.id = pv.prompt_id
  WHERE p.vertical = p_vertical
    AND p.node_name = p_node_name
    AND p.is_active = true
    AND pv.is_active = true
    AND pv.is_draft = false
  ORDER BY pv.version_number DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_node_prompt IS 'Get active prompt for (vertical, node) - Python backend uses this';

