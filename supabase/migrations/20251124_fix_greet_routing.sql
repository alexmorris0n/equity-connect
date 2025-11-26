-- Migration: Fix GREET node to enforce VERIFY routing when not verified
-- Issue: SignalWire AI is routing to ANSWER directly, skipping VERIFY
-- Root Cause: step_criteria is too vague about WHEN to route to VERIFY

-- Update GREET node step_criteria to be explicit about verification requirement
UPDATE prompt_versions
SET content = jsonb_set(
    content,
    '{step_criteria}',
    to_jsonb('Identity confirmed. IF verified=false in caller info MUST route to VERIFY (do not route to ANSWER/QUOTE/QUALIFY). IF verified=true: calculations → QUOTE, booking → BOOK, wrong_person → GOODBYE, qualified=false → QUALIFY, else → ANSWER'),
    true
)
WHERE prompt_id = (
    SELECT id FROM prompts 
    WHERE node_name = 'greet' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND is_active = true;

-- Also update the instructions to be more explicit about routing logic
UPDATE prompt_versions
SET content = jsonb_set(
    content,
    '{instructions}',
    to_jsonb(content->>'instructions' || E'\n\n=== ROUTING AFTER GREETING ===\n⚠️ CRITICAL: Check caller information before routing:\n- IF phone_verified=false OR email_verified=false OR address_verified=false:\n  → MUST route to VERIFY (do not skip verification)\n- IF all verified=true AND qualified=false:\n  → Route to QUALIFY\n- IF all verified=true AND qualified=true:\n  → Route to QUOTE (if quote_presented=false) or ANSWER\n\nDO NOT route to ANSWER or QUOTE if verification is incomplete.'),
    true
)
WHERE prompt_id = (
    SELECT id FROM prompts 
    WHERE node_name = 'greet' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND is_active = true;



