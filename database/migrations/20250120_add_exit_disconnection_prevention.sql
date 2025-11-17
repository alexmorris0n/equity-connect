-- Add post-route_to_context and disconnection prevention sections to EXIT context
-- This migration adds explicit instructions for what to do after route_to_context completes
-- and what to do when the call is about to hang/disconnect

UPDATE prompt_versions pv
SET content = jsonb_set(
    content,
    '{instructions}',
    (
        content->>'instructions' || E'\n\n---\n\n## CRITICAL: After route_to_context Tool Completes\n**When route_to_context(target_context="answer") completes:**\n- The tool has programmatically switched you to the ANSWER context\n- **DO NOT** provide any additional response in this EXIT context\n- **DO NOT** continue talking - the new context will handle everything\n- The context switch is automatic - you are done in this step\n\n**When route_to_context(target_context="greet") completes:**\n- The tool has programmatically switched you to the GREET context\n- **DO NOT** provide any additional response in this EXIT context\n- The new context will handle the greeting and verification\n\n**Pattern:**\n1. User asks question → Call route_to_context(target_context="answer")\n2. Tool completes → Context switches automatically\n3. **STOP** - Do not continue in EXIT context, let ANSWER context take over\n\n---\n\n## CRITICAL: Call Disconnection Prevention\n**If you detect the call is about to disconnect or hang up (silence, no response, connection issues):**\n\n**DO NOT just let it hang - take immediate action:**\n\n1. **If user asked a question and call is disconnecting:**\n   - IMMEDIATELY call route_to_context(target_context="answer", reason="user_asked_question")\n   - The context switch will keep the call alive and route to answer handling\n\n2. **If tool just completed and call is disconnecting:**\n   - Provide immediate follow-up response (do not wait)\n   - If question was asked: Route to answer context immediately\n   - If scenario complete: Provide warm close and ask if anything else\n\n3. **If silence detected after your last statement:**\n   - Ask: "Is there anything else I can help you with?"\n   - Offer: "Feel free to call back if you have questions"\n   - Provide broker contact: "$broker_name at $broker_phone"\n\n4. **If connection seems unstable:**\n   - Say: "I want to make sure we got everything covered. Do you have any questions?"\n   - Route to answer context if questions exist\n   - Provide callback number if needed\n\n**NEVER let the call hang without:**\n- Routing to appropriate context (answer, greet, etc.)\n- Providing a clear next step\n- Offering callback/contact information\n- Asking if anything else is needed'
    )::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.vertical = 'reverse_mortgage'
  AND p.node_name = 'exit'
  AND pv.is_active = true
  AND content->>'instructions' NOT LIKE '%After route_to_context Tool Completes%';

