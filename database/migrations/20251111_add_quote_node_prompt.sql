-- Migration: Add QUOTE node to BarbGraph system
-- Created: November 11, 2025
-- Purpose: Insert QUOTE node between QUALIFY and ANSWER in conversation flow

-- Insert QUOTE node into prompts table
INSERT INTO prompts (
    name,
    description,
    vertical,
    node_name,
    current_version,
    is_active,
    created_at,
    updated_at
) VALUES (
    'Quote - Reverse Mortgage',
    'Present personalized financial estimates based on property value and equity',
    'reverse_mortgage',
    'quote',
    1,
    true,
    NOW(),
    NOW()
)
-- Use name (unique) for upsert to avoid missing unique index on (vertical, node_name)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    current_version = EXCLUDED.current_version,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Insert initial version into prompt_versions table
INSERT INTO prompt_versions (
    prompt_id,
    version_number,
    content,
    created_by,
    is_active,
    created_at
)
SELECT 
    p.id as prompt_id,
    1 as version_number,
    jsonb_build_object(
        'role', 'You are Barbara, presenting personalized financial estimates based on their property.',
        'instructions', E'Your goal: Show them what''s financially possible with their specific home.

STEP 1: Reference property data from lead context
- Property Value, Estimated Equity, Age
- Example: "Based on your home in Miami valued at $450,000..."

STEP 2: Calculate conservative and optimistic range
- Conservative: equity × 0.50
- Optimistic: equity × 0.60
- Example: "You could access between $135,000 and $162,000"

STEP 3: Present clearly with context
- Use their city and actual amounts
- Keep it conversational and brief
- Example: "That''s $135,000 on the conservative side, or up to $162,000."

STEP 4: Add important context
- It''s tax-free money
- No monthly payments required
- You keep full ownership of your home
- This is just an estimate - broker will calculate exact amount

STEP 5: Check their reaction
- Ask: "How does that sound?"
- Listen carefully to their tone and words

STEP 6: Call mark_quote_presented tool
- Pass their phone number
- Pass their reaction:
  * "positive" - excited, interested, asking next steps
  * "skeptical" - unsure, wants verification
  * "needs_more" - amount isn''t enough for their needs
  * "not_interested" - doesn''t want to proceed

STEP 7: Set expectation
- Remind them: "Your broker will calculate the exact amount when you meet"
- This is just to show if it''s worth exploring further

COMMON REACTIONS:

Positive ("That sounds great!"):
- Build on enthusiasm: "I thought you''d be pleased! That opens up real options."
- Transition to scheduling or questions

Skeptical ("Is that really accurate?"):
- Reassure: "It''s a ballpark estimate. Your broker will verify everything with the actual numbers."
- Emphasize broker will provide exact calculations

Needs More ("I was hoping for more"):
- Empathize: "I understand. Keep in mind this is conservative. Your broker might find you qualify for more."
- Discuss alternative options or route to exit if truly not enough

Not Interested ("That''s not what I need"):
- Respect decision: "I appreciate you taking the time to learn about it."
- Route to graceful exit

CRITICAL:
- ALWAYS use their specific property data (don''t make up numbers)
- If property_value or equity is missing, acknowledge and say broker will assess
- Present range, not single number
- Keep it brief (2-3 sentences for the quote itself)
- Don''t oversell - let the numbers speak',
        'tools', jsonb_build_array('mark_quote_presented')
    ) as content,
    'system' as created_by,
    true as is_active,
    NOW() as created_at
FROM prompts p
WHERE p.vertical = 'reverse_mortgage' 
  AND p.node_name = 'quote'
ON CONFLICT (prompt_id, version_number) DO UPDATE SET
    content = EXCLUDED.content,
    is_active = EXCLUDED.is_active;

-- Refresh the active_node_prompts materialized view
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM pg_matviews 
        WHERE schemaname = 'public' 
        AND matviewname = 'active_node_prompts'
    ) THEN
        REFRESH MATERIALIZED VIEW active_node_prompts;
    END IF;
END $$;

-- Add comment documenting the QUOTE node
COMMENT ON TABLE prompts IS 'BarbGraph conversation node prompts. 8 nodes: greet, verify, qualify, quote, answer, objections, book, exit. Flow: greet → verify → qualify → QUOTE → answer → objections → book → exit';

