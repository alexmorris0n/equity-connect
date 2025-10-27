-- Fix prompt variables to only use available ones
-- Remove references to variables that don't exist yet in the bridge

-- For now, we'll use generic placeholders that can be filled in later
-- The bridge's injectVariables function will replace unknown variables with empty strings

-- Update Broker Connect Appointment prompt - simplify variable usage
UPDATE prompt_versions pv
SET content = jsonb_set(
  content,
  '{context}',
  '"Variables available:\n\nBROKER: {{brokerFirstName}}, {{brokerLastName}}, {{brokerFullName}}, {{brokerPhone}}, {{brokerCompany}}\nLEAD: {{leadFirstName}}, {{leadLastName}}, {{leadPhone}}, {{leadEmail}}\n\nNote: Appointment details (time, status) will be provided by the broker during the call.\nThis is a broker-facing call to facilitate appointment connection."'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.call_type = 'broker-connect-appointment'
  AND pv.version_number = 1;

-- Update Broker Schedule Check prompt - simplify variable usage  
UPDATE prompt_versions pv
SET content = jsonb_set(
  content,
  '{context}',
  '"Variables available:\n\nBROKER: {{brokerFirstName}}, {{brokerLastName}}, {{brokerFullName}}, {{brokerPhone}}, {{brokerCompany}}\n\nNote: Schedule details (dates, appointments) will be retrieved dynamically from the database.\nThis is a broker-facing call, not lead-facing."'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.call_type = 'broker-schedule-check'
  AND pv.version_number = 1;

-- Update Transfer/Handoff prompt - simplify variable usage
UPDATE prompt_versions pv
SET content = jsonb_set(
  content,
  '{context}',
  '"Variables available:\n\nLEAD: {{leadFirstName}}, {{leadLastName}}, {{leadEmail}}, {{leadPhone}}\nPROPERTY: {{propertyAddress}}, {{propertyCity}}, {{propertyState}}, {{propertyValue}}, {{mortgageBalance}}, {{estimatedEquity}}\nBROKER: {{brokerFirstName}}, {{brokerFullName}}, {{brokerCompany}}\n\nNote: Transfer context (reason, from who, notes) should be communicated verbally during the transfer.\nIf empty/\"unknown\", gently collect."'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.call_type = 'transfer'
  AND pv.version_number = 1;

-- Update Scheduled Callback prompt - simplify variable usage
UPDATE prompt_versions pv
SET content = jsonb_set(
  content,
  '{context}',
  '"Variables available:\n\nLEAD: {{leadFirstName}}, {{leadLastName}}, {{leadEmail}}, {{leadPhone}}\nPROPERTY: {{propertyAddress}}, {{propertyCity}}, {{propertyState}}, {{propertyValue}}, {{mortgageBalance}}, {{estimatedEquity}}\nBROKER: {{brokerFirstName}}, {{brokerFullName}}, {{brokerCompany}}\n\nNote: Callback details (reason, scheduled time, prior context) should be in the call context or system notes.\nUse available information to understand what was discussed before."'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.call_type = 'callback'
  AND pv.version_number = 1;

-- Update Emergency Fallback prompt - simplify variable usage
UPDATE prompt_versions pv
SET content = jsonb_set(
  content,
  '{context}',
  '"Variables available (may be incomplete or missing):\n\nLEAD: {{leadFirstName}}, {{leadLastName}}, {{leadEmail}}, {{leadPhone}}\nPROPERTY: {{propertyCity}}, {{propertyState}}\nBROKER: {{brokerFirstName}}, {{brokerCompany}}\n\nNote: In fallback mode, many variables may be unknown. Ask clarifying questions to gather necessary information."'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.call_type = 'fallback'
  AND pv.version_number = 1;

