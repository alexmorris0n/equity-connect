# Apply These Migrations

Run these in order in your Supabase SQL Editor:

## Step 1: Add Voice Column

```sql
-- Add voice column to prompts table
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS voice VARCHAR(50) DEFAULT 'alloy';

-- Add check constraint for valid voices
ALTER TABLE prompts 
ADD CONSTRAINT prompts_voice_check 
CHECK (voice IN ('alloy', 'echo', 'shimmer', 'ash', 'ballad', 'coral', 'sage', 'verse', 'cedar', 'marin'));

-- Create index for voice queries
CREATE INDEX IF NOT EXISTS idx_prompts_voice ON prompts(voice);

-- Update existing prompts to use default voice
UPDATE prompts SET voice = 'alloy' WHERE voice IS NULL;

COMMENT ON COLUMN prompts.voice IS 'OpenAI Realtime API voice: alloy, echo, shimmer, ash, ballad, coral, sage, verse, cedar, marin';
```

## Step 2: Add Call Type Column

```sql
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
```

## Step 3: Create the 9 Prompts (One for Each Call Type)

```sql
-- Insert 9 prompts (one for each call type)
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
  ('Emergency Fallback', 'voice-assistant', 'alloy', 'fallback', true, true)
ON CONFLICT (name) DO NOTHING;
```

## Step 4: Create Initial Draft Versions for Each Prompt

```sql
-- Create v1 draft for each prompt
DO $$
DECLARE
  prompt_record RECORD;
BEGIN
  FOR prompt_record IN SELECT id, name FROM prompts WHERE call_type IS NOT NULL
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
      'Initial version for ' || prompt_record.name,
      false,
      true
    )
    ON CONFLICT (prompt_id, version_number) DO NOTHING;
  END LOOP;
END $$;
```

## Verify

```sql
-- Check that prompts were created
SELECT name, category, voice, call_type, is_active 
FROM prompts 
WHERE call_type IS NOT NULL
ORDER BY call_type;

-- Check that versions were created
SELECT p.name, pv.version_number, pv.is_draft, pv.is_active
FROM prompts p
JOIN prompt_versions pv ON p.id = pv.prompt_id
WHERE p.call_type IS NOT NULL
ORDER BY p.name;
```

You should see 9 prompts, each with a v1 draft version!

