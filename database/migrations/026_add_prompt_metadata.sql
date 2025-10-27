-- Add metadata columns to prompts table for AI helper context
-- This is NOT sent to OpenAI, just used by the portal's AI helper

ALTER TABLE prompts ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS goal TEXT;

-- Populate purpose and goal for each call type
UPDATE prompts SET 
  purpose = 'Handle returning leads who are already in the system with existing property data. They have likely been pre-qualified.',
  goal = 'Skip unnecessary re-qualification if all 4 items (age, residence, mortgage, value) are known. Provide equity snapshot and book appointment efficiently.'
WHERE call_type = 'inbound-qualified';

UPDATE prompts SET 
  purpose = 'Handle new leads calling in for the first time, or returning leads without sufficient qualifying data in the system.',
  goal = 'Greet warmly, learn why they called, verify contact info, complete 4-point qualification gate, answer questions, and book appointment.'
WHERE call_type = 'inbound-unqualified';

UPDATE prompts SET 
  purpose = 'Warm callback to someone who showed interest or requested a call. They are expecting this call.',
  goal = 'Reference prior conversation, acknowledge pre-qualification if complete, fill missing items only, and complete booking.'
WHERE call_type = 'outbound-warm';

UPDATE prompts SET 
  purpose = 'First contact outbound call to a new lead. This is cold outreach to someone who has not engaged yet.',
  goal = 'Build comfort and rapport, learn their equity needs, complete 4-point qualification, answer questions briefly, and book appointment.'
WHERE call_type = 'outbound-cold';

UPDATE prompts SET 
  purpose = 'Receive a warm transfer from another agent or system mid-conversation. The lead is already on the line.',
  goal = 'Seamlessly take over conversation, acknowledge transfer, pick up context from transfer notes, verify missing items, complete booking.'
WHERE call_type = 'transfer';

UPDATE prompts SET 
  purpose = 'Scheduled callback at a pre-agreed time. The lead requested this callback and is expecting it.',
  goal = 'Reference prior agreement, remind them why they scheduled this, pick up where conversation left off, complete booking or answer remaining questions.'
WHERE call_type = 'callback';

UPDATE prompts SET 
  purpose = 'Broker calling to check their daily appointments or schedule. This is broker-facing, not lead-facing.',
  goal = 'Verify broker identity, retrieve schedule for requested date, provide appointment details clearly, offer schedule management (reschedule/cancel).'
WHERE call_type = 'broker-schedule-check';

UPDATE prompts SET 
  purpose = 'Broker calling to connect with a lead for their scheduled appointment. This is broker-facing.',
  goal = 'Verify broker identity, confirm appointment details, connect broker to lead via 3-way call or provide lead contact info.'
WHERE call_type = 'broker-connect-appointment';

UPDATE prompts SET 
  purpose = 'Emergency fallback when no other prompt matches the call context or there is a system error in prompt selection.',
  goal = 'Determine call purpose, identify caller type (lead/broker/returning), gather basic info, provide helpful assistance, transfer to appropriate handler if needed.'
WHERE call_type = 'fallback';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_prompts_purpose ON prompts(call_type) WHERE purpose IS NOT NULL;

COMMENT ON COLUMN prompts.purpose IS 'High-level description of when/why this prompt is used. Used by portal AI helper for context, not sent to OpenAI.';
COMMENT ON COLUMN prompts.goal IS 'What success looks like for this call type. Used by portal AI helper for context, not sent to OpenAI.';

