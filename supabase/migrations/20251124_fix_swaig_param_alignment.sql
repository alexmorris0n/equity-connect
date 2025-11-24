-- Align SWAIG function parameter usage in prompt content with execution layer
-- Changes:
-- 1) BOOK: remove set_manual_booking_required from tools; fix instructions params
-- 2) VERIFY: remove find_broker_by_territory from tools

-- 1a) BOOK: remove set_manual_booking_required from tools array
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
  (
    SELECT COALESCE(
      jsonb_agg(elem) FILTER (WHERE elem <> to_jsonb('set_manual_booking_required')),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(pv.content->'tools') AS elem
  )
)
WHERE pv.id IN (SELECT id FROM rows);

-- 1b) BOOK: replace preferred_day -> preferred_date and book_appointment(datetime...) -> book_appointment(preferred_time...)
WITH rows AS (
  SELECT pv.id, pv.content, pv.content->>'instructions' AS instr
  FROM public.prompts p
  JOIN public.prompt_versions pv ON pv.prompt_id = p.id
  WHERE p.node_name = 'book' AND p.is_active = true AND pv.is_active = true
), repl AS (
  SELECT
    id,
    replace(
      replace(
        replace(instr, 'preferred_day', 'preferred_date'),
        'book_appointment(datetime', 'book_appointment(preferred_time'
      ),
      'broker_id=Y, ', ''
    ) AS new_instr
  FROM rows
)
UPDATE public.prompt_versions pv
SET content = jsonb_set(pv.content, '{instructions}', to_jsonb(r.new_instr), true)
FROM repl r
WHERE pv.id = r.id;

-- 2) VERIFY: remove find_broker_by_territory from tools array
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
  (
    SELECT COALESCE(
      jsonb_agg(elem) FILTER (WHERE elem <> to_jsonb('find_broker_by_territory')),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(pv.content->'tools') AS elem
  )
)
WHERE pv.id IN (SELECT id FROM rows);



