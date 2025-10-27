-- =====================================================
-- CLEAN UP AND CREATE 9 FIXED PROMPTS
-- =====================================================
-- Purpose: Remove test prompts and create exactly 9 prompts (one per call type)
-- Created: 2025-10-27
-- =====================================================

-- Step 1: Delete all existing prompts and their versions (clean slate)
DELETE FROM prompt_versions;
DELETE FROM prompts;

-- Step 2: Create the 9 fixed prompts (one for each call type)
INSERT INTO prompts (name, category, voice, call_type, is_base_prompt, is_active)
VALUES 
  ('Inbound - Qualified', 'voice-assistant', 'alloy', 'inbound-qualified', true, true),
  ('Inbound - New Lead', 'voice-assistant', 'alloy', 'inbound-unqualified', true, true),
  ('Outbound - Warm Follow-up', 'voice-assistant', 'shimmer', 'outbound-warm', true, true),
  ('Outbound - Cold Call', 'voice-assistant', 'shimmer', 'outbound-cold', true, true),
  ('Transfer/Handoff', 'voice-assistant', 'alloy', 'transfer', true, true),
  ('Scheduled Callback', 'voice-assistant', 'alloy', 'callback', true, true),
  ('Broker Schedule Check', 'voice-assistant', 'echo', 'broker-schedule-check', true, true),
  ('Broker Connect Appointment', 'voice-assistant', 'echo', 'broker-connect-appointment', true, true),
  ('Emergency Fallback', 'voice-assistant', 'alloy', 'fallback', true, true);

-- Step 3: Create v1 draft for each prompt
DO $$
DECLARE
  prompt_record RECORD;
BEGIN
  FOR prompt_record IN 
    SELECT id, name, call_type FROM prompts WHERE call_type IS NOT NULL
  LOOP
    INSERT INTO prompt_versions (
      prompt_id, 
      version_number, 
      content, 
      variables, 
      change_summary, 
      is_active, 
      is_draft
    )
    VALUES (
      prompt_record.id,
      1,
      jsonb_build_object(
        'role', 'You are Barbara, a warm and professional voice assistant for reverse mortgage consultations.',
        'personality', '- Keep responses brief and conversational\n- Speak warmly and naturally\n- Ask clarifying questions',
        'context', '',
        'pronunciation', '',
        'tools', '',
        'instructions', '- Always be helpful and professional\n- Listen actively to caller needs',
        'conversation_flow', '',
        'output_format', '',
        'safety', '- Transfer to human if caller is distressed\n- Escalate complex questions'
      ),
      ARRAY[]::text[],
      'Initial version for ' || prompt_record.call_type,
      false,
      true
    );
  END LOOP;
END $$;

-- Step 4: Verify
SELECT 
  name, 
  category, 
  voice, 
  call_type, 
  is_active 
FROM prompts 
ORDER BY 
  CASE call_type
    WHEN 'inbound-qualified' THEN 1
    WHEN 'inbound-unqualified' THEN 2
    WHEN 'outbound-warm' THEN 3
    WHEN 'outbound-cold' THEN 4
    WHEN 'transfer' THEN 5
    WHEN 'callback' THEN 6
    WHEN 'broker-schedule-check' THEN 7
    WHEN 'broker-connect-appointment' THEN 8
    WHEN 'fallback' THEN 9
  END;

-- You should see exactly 9 prompts, each with a unique call_type

