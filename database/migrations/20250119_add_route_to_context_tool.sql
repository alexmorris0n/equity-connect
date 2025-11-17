-- Add route_to_context tool to all contexts
-- This enables programmatic context switching when automatic routing via valid_contexts is insufficient

UPDATE prompt_versions pv
SET content = jsonb_set(
    content,
    '{tools}',
    (
        SELECT jsonb_agg(DISTINCT tool)
        FROM (
            SELECT jsonb_array_elements_text(content->'tools') as tool
            UNION
            SELECT 'route_to_context'::text
        ) t
    ),
    true
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND pv.is_active = true
  AND p.vertical = 'reverse_mortgage'
  AND NOT (content->'tools' @> '"route_to_context"'::jsonb); -- Only add if not already present

