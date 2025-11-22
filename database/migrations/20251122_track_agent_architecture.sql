-- Track agent architecture version for analytics and debugging
-- This migration adds an optional field to track which architecture version
-- is being used (node-based vs agent-based)

-- Add architecture_version column to conversation_state table
ALTER TABLE conversation_state
ADD COLUMN IF NOT EXISTS architecture_version TEXT DEFAULT 'agent';

-- Add comment explaining the field
COMMENT ON COLUMN conversation_state.architecture_version IS 
'Agent architecture version: "node" (deprecated, custom routing) or "agent" (current, LiveKit native handoffs). Used for analytics and debugging.';

-- Update existing rows to 'agent' (current system)
UPDATE conversation_state
SET architecture_version = 'agent'
WHERE architecture_version IS NULL OR architecture_version = 'node';

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_conversation_state_architecture_version 
ON conversation_state(architecture_version);

