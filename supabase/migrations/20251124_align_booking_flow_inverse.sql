-- Inverse of 20251124_align_booking_flow.sql
-- Removes QUOTE booking invite and mark_ready_to_book addition; removes ANSWER booking invite

-- QUOTE: remove mark_ready_to_book from tools
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
  (
    SELECT COALESCE(
      jsonb_agg(elem) FILTER (WHERE elem <> to_jsonb('mark_ready_to_book'::text)),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(pv.content->'tools') AS elem
  )
)
WHERE pv.id IN (SELECT id FROM rows);

-- QUOTE: remove appended booking invite and revert step_criteria to previous style (best-effort)
WITH rows AS (
  SELECT pv.id, pv.content->>'instructions' AS instr, pv.content->>'step_criteria' AS crit
  FROM public.prompts p
  JOIN public.prompt_versions pv ON pv.prompt_id = p.id
  WHERE p.node_name = 'quote' AND p.is_active = true AND pv.is_active = true
), upd AS (
  SELECT
    id,
    replace(instr,
E'\n\n=== BOOKING INVITE (Default) ===
After presenting the estimate:
- If they indicate it looks good or they are satisfied, gently invite: "Would you like me to check availability now?"
- If YES: call mark_ready_to_book(ready_to_book=true) and route to BOOK
- If they have questions: route to ANSWER
- If they raise concerns: route to OBJECTIONS
- If not interested: route to GOODBYE
', '') AS new_instr,
    replace(crit,
E'After presenting the equity estimate and capturing their reaction:
- If accepted/neutral and not booked → Invite booking. On acceptance, call mark_ready_to_book(true) → BOOK
- If questions → ANSWER; if objections → OBJECTIONS; if not interested or disqualified → GOODBYE
', 'After presenting the equity estimate and capturing their reaction: Continue in quote context if questions. Route: questions → ANSWER, ready to book → BOOK, objections → OBJECTIONS, not interested/disqualified → GOODBYE.') AS new_crit
  FROM rows
)
UPDATE public.prompt_versions pv
SET content = jsonb_set(
      jsonb_set(pv.content, '{instructions}', to_jsonb(u.new_instr), true),
      '{step_criteria}', to_jsonb(u.new_crit), true
    )
FROM upd u
WHERE pv.id = u.id;

-- ANSWER: remove appended booking invite
WITH rows AS (
  SELECT pv.id, pv.content->>'instructions' AS instr
  FROM public.prompts p
  JOIN public.prompt_versions pv ON pv.prompt_id = p.id
  WHERE p.node_name = 'answer' AND p.is_active = true AND pv.is_active = true
), upd AS (
  SELECT
    id,
    replace(instr,
E'\n\n=== BOOKING INVITE (After Q&A) ===
If quote_presented=true and appointment_booked=false and they confirm understanding:
- Invite: "Would you like me to check availability?"
- If YES: call mark_ready_to_book(ready_to_book=true) → BOOK
- If they ask amounts instead: route to QUOTE (CRITICAL RULE)
', '') AS new_instr
  FROM rows
)
UPDATE public.prompt_versions pv
SET content = jsonb_set(pv.content, '{instructions}', to_jsonb(u.new_instr), true)
FROM upd u
WHERE pv.id = u.id;



