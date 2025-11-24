-- Inverse of 20251124_fix_swaig_param_alignment.sql
-- Re-add removed tools and revert instruction replacements

-- 1a) BOOK: re-add set_manual_booking_required to tools (append; may duplicate if already present)
WITH rows AS (
  SELECT pv.id, pv.content
  FROM public.prompts p
  JOIN public.prompt_versions pv ON pv.prompt_id = p.id
  WHERE p.node_name = 'book' AND p.is_active = true AND pv.is_active = true
)
UPDATE public.prompt_versions pv
SET content = jsonb_set(
  pv.content,
  '{tools}',
  (pv.content->'tools') || to_jsonb('set_manual_booking_required')
)
WHERE pv.id IN (SELECT id FROM rows);

-- 1b) BOOK: revert preferred_date -> preferred_day and book_appointment(preferred_time...) -> book_appointment(datetime...)
WITH rows AS (
  SELECT pv.id, pv.content, pv.content->>'instructions' AS instr
  FROM public.prompts p
  JOIN public.prompt_versions pv ON pv.prompt_id = p.id
  WHERE p.node_name = 'book' AND p.is_active = true AND pv.is_active = true
), repl AS (
  SELECT
    id,
    replace(
      replace(instr, 'preferred_date', 'preferred_day'),
      'book_appointment(preferred_time', 'book_appointment(datetime'
    ) AS new_instr
  FROM rows
)
UPDATE public.prompt_versions pv
SET content = jsonb_set(pv.content, '{instructions}', to_jsonb(r.new_instr), true)
FROM repl r
WHERE pv.id = r.id;

-- 2) VERIFY: re-add find_broker_by_territory to tools (append; may duplicate if already present)
WITH rows AS (
  SELECT pv.id, pv.content
  FROM public.prompts p
  JOIN public.prompt_versions pv ON pv.prompt_id = p.id
  WHERE p.node_name = 'verify' AND p.is_active = true AND pv.is_active = true
)
UPDATE public.prompt_versions pv
SET content = jsonb_set(
  pv.content,
  '{tools}',
  (pv.content->'tools') || to_jsonb('find_broker_by_territory')
)
WHERE pv.id IN (SELECT id FROM rows);



