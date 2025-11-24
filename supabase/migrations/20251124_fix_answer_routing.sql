-- Migration: Fix ANSWER node to prevent premature QUOTE routing
-- Issue: Barbara routes to QUOTE after 1 question, even when not requested
-- Root Cause: AI interprets "done answering" as "ready for quote"

-- Update step_criteria to be explicit about when to route to QUOTE
UPDATE prompt_versions
SET content = jsonb_set(
    content,
    '{step_criteria}',
    to_jsonb('Question answered. ONLY route to QUOTE if user EXPLICITLY asks for calculations/estimate/quote. Otherwise, ask "Do you have any other questions?" before routing. Route: explicit calculation request -> QUOTE, booking intent -> BOOK, concerns -> OBJECTIONS, no more questions -> GOODBYE.'::text),
    true
)
WHERE prompt_id = (
    SELECT id FROM prompts 
    WHERE node_name = 'answer' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND is_active = true;

-- Add explicit "after answering" instructions
UPDATE prompt_versions
SET content = jsonb_set(
    content,
    '{instructions}',
    to_jsonb(
        REPLACE(
            content->>'instructions',
            '=== COMPLETION ===',
            E'=== AFTER ANSWERING ===\nAfter you answer their question and they confirm understanding:\n\n1. Ask: "Do you have any other questions about reverse mortgages?"\n2. ⏸️ WAIT for their response\n3. THEN route based on their answer:\n   - More questions -> stay in ANSWER\n   - "No" or "I''m good" -> route to GOODBYE\n   - Calculation request ("How much?", "What''s available?") -> route to QUOTE\n   - Booking request ("Let''s schedule", "I''m ready") -> route to BOOK\n\n⚠️ DO NOT proactively offer calculations unless they ask!\n⚠️ DO NOT assume "done answering" means "ready for quote"\n\n=== COMPLETION ==='
        )
    ),
    true
)
WHERE prompt_id = (
    SELECT id FROM prompts 
    WHERE node_name = 'answer' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND is_active = true;


