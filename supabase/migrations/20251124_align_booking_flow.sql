-- Align booking-first flow (without pushing in GREET)
-- Updates:
-- - QUOTE: add mark_ready_to_book to tools; append booking invite to instructions; clarify step_criteria
-- - ANSWER: append post-answer booking invite when quoted and not booked

-- QUOTE: ensure tools include mark_ready_to_book
WITH rows AS (
  SELECT pv.id, pv.content
  FROM public.prompts p
  JOIN public.prompt_versions pv ON pv.prompt_id = p.id
  WHERE p.node_name = 'quote' AND p.is_active = true AND pv.is_active = true
)
UPDATE public.prompt_versions pv
SET content = jsonb_set(
  pv.content,
  '{tools}',
  COALESCE(
    CASE
      WHEN (pv.content->'tools') IS NULL THEN to_jsonb(ARRAY['calculate_reverse_mortgage','mark_quote_presented','mark_qualification_result','update_lead_info','mark_ready_to_book'])
      WHEN (pv.content->'tools') ? 'mark_ready_to_book' THEN (pv.content->'tools')
      ELSE (pv.content->'tools') || to_jsonb('mark_ready_to_book')
    END,
    to_jsonb(ARRAY['calculate_reverse_mortgage','mark_quote_presented','mark_qualification_result','update_lead_info','mark_ready_to_book'])
  ),
  true
)
WHERE pv.id IN (SELECT id FROM rows);

-- QUOTE: append booking invite to instructions and tighten step_criteria
WITH rows AS (
  SELECT pv.id,
         pv.content->>'instructions' AS instr,
         COALESCE(pv.content->>'step_criteria','') AS crit
  FROM public.prompts p
  JOIN public.prompt_versions pv ON pv.prompt_id = p.id
  WHERE p.node_name = 'quote' AND p.is_active = true AND pv.is_active = true
), upd AS (
  SELECT
    id,
    instr ||
E'\n\n=== BOOKING INVITE (Default) ===\nAfter presenting the estimate:\n- If they indicate it looks good or they are satisfied, gently invite: \"Would you like me to check availability now?\"\n- If YES: call mark_ready_to_book(ready_to_book=true) and route to BOOK\n- If they have questions: route to ANSWER\n- If they raise concerns: route to OBJECTIONS\n- If not interested: route to GOODBYE\n' AS new_instr,
E'After presenting the equity estimate and capturing their reaction:\n- If accepted/neutral and not booked → Invite booking. On acceptance, call mark_ready_to_book(true) → BOOK\n- If questions → ANSWER; if objections → OBJECTIONS; if not interested or disqualified → GOODBYE\n' AS new_crit
  FROM rows
)
UPDATE public.prompt_versions pv
SET content = jsonb_set(
      jsonb_set(pv.content, '{instructions}', to_jsonb(u.new_instr), true),
      '{step_criteria}', to_jsonb(u.new_crit), true
    )
FROM upd u
WHERE pv.id = u.id;

-- ANSWER: append post-answer booking invite when quote exists and not booked
WITH rows AS (
  SELECT pv.id, pv.content->>'instructions' AS instr
  FROM public.prompts p
  JOIN public.prompt_versions pv ON pv.prompt_id = p.id
  WHERE p.node_name = 'answer' AND p.is_active = true AND pv.is_active = true
), upd AS (
  SELECT
    id,
    instr ||
E'\n\n=== BOOKING INVITE (After Q&A) ===\nIf quote_presented=true and appointment_booked=false and they confirm understanding:\n- Invite: \"Would you like me to check availability?\"\n- If YES: call mark_ready_to_book(ready_to_book=true) → BOOK\n- If they ask amounts instead: route to QUOTE (CRITICAL RULE)\n' AS new_instr
  FROM rows
)
UPDATE public.prompt_versions pv
SET content = jsonb_set(pv.content, '{instructions}', to_jsonb(u.new_instr), true)
FROM upd u
WHERE pv.id = u.id;



