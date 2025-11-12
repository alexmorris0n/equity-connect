-- =====================================================
-- UPDATE NODE NAME CHECK CONSTRAINT TO INCLUDE 'quote'
-- =====================================================
-- Purpose: Allow 'quote' as a valid node_name in prompts
-- Created: 2025-11-11
-- =====================================================

-- Drop old constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_type = 'CHECK'
      AND table_name = 'prompts'
      AND constraint_name = 'prompts_node_name_check'
  ) THEN
    ALTER TABLE prompts DROP CONSTRAINT prompts_node_name_check;
  END IF;
END $$;

-- Add updated constraint including 'quote'
ALTER TABLE prompts 
ADD CONSTRAINT prompts_node_name_check 
CHECK (node_name IN ('greet', 'verify', 'qualify', 'quote', 'answer', 'objections', 'book', 'exit'));

-- Helpful comment
COMMENT ON CONSTRAINT prompts_node_name_check ON prompts IS 'Allowed nodes: greet, verify, qualify, quote, answer, objections, book, exit';



