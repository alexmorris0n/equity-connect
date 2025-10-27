-- =====================================================
-- ADD CALL TYPE TO PROMPTS
-- =====================================================
-- Purpose: Assign prompts to specific call types
-- Created: 2025-10-27
-- =====================================================

-- Add call_type column to prompts table
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS call_type VARCHAR(50);

-- Add check constraint for valid call types
ALTER TABLE prompts 
ADD CONSTRAINT prompts_call_type_check 
CHECK (call_type IN (
  'inbound-qualified', 
  'inbound-unqualified', 
  'outbound-warm', 
  'outbound-cold', 
  'transfer', 
  'callback', 
  'broker-schedule-check',
  'broker-connect-appointment',
  'fallback'
));

-- Create index for call type queries
CREATE INDEX IF NOT EXISTS idx_prompts_call_type ON prompts(call_type);

-- Add unique constraint: one active prompt per call_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_call_type_unique 
ON prompts(call_type) 
WHERE is_active = true AND call_type IS NOT NULL;

COMMENT ON COLUMN prompts.call_type IS 'Call scenario: inbound-qualified, inbound-unqualified, outbound-warm, outbound-cold, transfer, callback, broker-schedule-check, broker-connect-appointment, fallback';

-- Update existing prompts (if any exist)
-- You'll need to manually assign call types to existing prompts
-- Example:
-- UPDATE prompts SET call_type = 'inbound-qualified' WHERE name = 'Barbara - Main Assistant';

-- Call Type Descriptions:
-- inbound-qualified: Returning lead with property data calling in
-- inbound-unqualified: New lead calling in for first time
-- outbound-warm: Follow-up call to qualified lead
-- outbound-cold: First touch outbound call
-- transfer: Warm transfer from another agent
-- callback: Scheduled callback appointment
-- broker-schedule-check: Broker calling to check their daily appointments
-- broker-connect-appointment: Broker calling to connect for a scheduled appointment
-- fallback: Emergency fallback when no other prompt matches

