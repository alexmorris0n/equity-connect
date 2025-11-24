-- Fix ALL valid_contexts arrays (Nov 24, 2025)
-- CRITICAL: valid_contexts is a HARD CONSTRAINT in SignalWire
-- If a route is not in valid_contexts, the AI CANNOT make that transition

-- 1. GREET: Add "goodbye" for wrong person scenarios
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{valid_contexts}',
  '["verify", "qualify", "answer", "quote", "objections", "book", "goodbye"]'::jsonb
)
WHERE id = '592b56ed-2a24-4c94-8d4e-07d14df0ed9b';

-- 2. VERIFY: Add "goodbye" for disqualification/exit scenarios
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{valid_contexts}',
  '["qualify", "answer", "quote", "objections", "goodbye"]'::jsonb
)
WHERE id = '84f96bd7-33e4-4b77-8b4c-c97cb14f9e24';

-- 3. QUALIFY: Add "answer" and "goodbye" for questions during qualification and disqualification
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{valid_contexts}',
  '["quote", "answer", "objections", "goodbye"]'::jsonb
)
WHERE id = 'a5d5ad46-2d16-4d8d-a698-fbc5c4b32ee2';

-- 4. ANSWER: Add "goodbye" for natural conversation endings
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{valid_contexts}',
  '["quote", "qualify", "objections", "book", "goodbye"]'::jsonb
)
WHERE id = '1ddcb437-b1d2-45a0-9ea1-83cc3e14a40c';

-- 5. QUOTE: Add "qualify" and "goodbye" for re-qualification and disqualification scenarios
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{valid_contexts}',
  '["answer", "qualify", "objections", "book", "goodbye"]'::jsonb
)
WHERE id = '4a0a7972-5b8a-4e1f-bcc7-d8a0b2f9c3e1';

-- 6. OBJECTIONS: Add "qualify" and "goodbye" for Scenario 6 (objection during qualify) and disinterest
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{valid_contexts}',
  '["answer", "qualify", "book", "goodbye"]'::jsonb
)
WHERE id = 'd9b3c5e8-4f7a-4b2c-9d1e-8a6f5c4b3a2d';

-- 7. BOOK: Add "goodbye" for booking complete/declined scenarios
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{valid_contexts}',
  '["answer", "objections", "goodbye"]'::jsonb
)
WHERE id = 'f8e7d6c5-4b3a-4c2b-9d1e-8a6f5c4b3a2d';

-- 8. GOODBYE: Already correct with ["answer", "greet"] - no change needed
-- (Handoff tool handles routing back to GREET)

