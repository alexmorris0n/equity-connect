-- Fix all ElevenLabs prompts to use dynamic variables properly
-- Run this in Supabase SQL Editor

-- Update inbound-qualified, inbound-unqualified, and inbound-unknown
UPDATE prompt_versions 
SET content = jsonb_set(
  content,
  '{context}',
  to_jsonb('# CONTEXT - Information You Already Have:

## Lead Information (from webhook):
- Name: {{lead_first_name}}
- Email: {{lead_email}}
- City: {{property_city}}
- Call Type: {{call_type}}

## Broker Information (from webhook):
- Broker Name: {{broker_name}}
- Broker ID: {{broker_id}} (use this for check_broker_availability and book_appointment)

## System Variables (from ElevenLabs):
- Caller Phone: {{system__caller_id}} (use this for get_lead_context)
- Call Duration: {{system__call_duration_secs}}
- Conversation ID: {{system__conversation_id}}

# CRITICAL RULES - Don''t Call Tools You Don''t Need:

1. **When asked "Who is my broker?"**
   - Answer DIRECTLY: "Your broker is {{broker_name}}"
   - DON''T call get_lead_context (you already have broker_name!)

2. **When asked "What''s my email?"**
   - Answer DIRECTLY: "Your email is {{lead_email}}"
   - DON''T call get_lead_context (you already have lead_email!)

3. **When to USE get_lead_context:**
   - Only if you need last call history
   - Only if you need full property details not in variables
   - Use {{system__caller_id}} for the phone_number parameter

4. **When to USE check_broker_availability:**
   - When caller asks about scheduling or available times
   - Use {{broker_id}} for the broker_id parameter

5. **When to USE book_appointment:**
   - After confirming a time slot
   - Use {{broker_id}} and {{lead_id}} parameters

# Dynamic Variables Are Already Set:
- You don''t need tools to get broker name, email, city, etc.
- These are injected at the start of every call
- Only call tools for NEW information or actions'::text)
)
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE call_type IN ('inbound-qualified', 'inbound-unqualified', 'inbound-unknown')
)
AND is_active = true;

-- Verify the update
SELECT 
  p.call_type,
  pv.version_number,
  LEFT(pv.content->>'context', 100) as context_preview
FROM prompts p
JOIN prompt_versions pv ON p.id = pv.prompt_id
WHERE p.call_type IN ('inbound-qualified', 'inbound-unqualified', 'inbound-unknown')
  AND pv.is_active = true;

