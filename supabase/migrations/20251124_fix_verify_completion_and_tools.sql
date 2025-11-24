-- Add mark_verified to VERIFY tools and instruct to call it when done
-- Clarify phone step: if caller acknowledges or number known from caller ID, still call mark_phone_verified()

-- 1) Add mark_verified to VERIFY tools array
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
  CASE
    WHEN (pv.content->'tools') ? 'mark_verified' THEN (pv.content->'tools')
    ELSE (pv.content->'tools') || to_jsonb('mark_verified'::text)
  END,
  true
)
WHERE pv.id IN (SELECT id FROM rows);

-- 2) Update VERIFY instructions (append guidance and mark_verified step)
WITH rows AS (
  SELECT pv.id, pv.content->>'instructions' AS instr
  FROM public.prompts p
  JOIN public.prompt_versions pv ON pv.prompt_id = p.id
  WHERE p.node_name = 'verify' AND p.is_active = true AND pv.is_active = true
), upd AS (
  SELECT
    id,
    instr ||
E'\n\n=== CALLING TOOLS (CLARITY) ===\n- PHONE: If the caller verbally acknowledges or you already have the number from caller ID, call mark_phone_verified() (do not require them to read digits).\n- EMAIL/ADDRESS: After collecting/confirming, immediately call the corresponding tool.\n\n=== COMPLETION FLAG ===\n- When all required (missing) items are verified OR none were missing at entry, call mark_verified(verified=true) to signal completion.\n' AS new_instr
  FROM rows
)
UPDATE public.prompt_versions pv
SET content = jsonb_set(pv.content, '{instructions}', to_jsonb(u.new_instr), true)
FROM upd u
WHERE pv.id = u.id;


