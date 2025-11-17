-- Fix exit context instructions to use route_to_context instead of get_lead_context for routing
-- Issue: Instructions tell LLM to call get_lead_context for routing, but route_to_context is the correct tool

UPDATE prompt_versions pv
SET content = jsonb_set(
    content,
    '{instructions}',
    (
        SELECT REPLACE(
            REPLACE(
                content->>'instructions',
                '## CRITICAL: Handling get_lead_context Tool Calls
**When get_lead_context tool completes:**
- The tool provides lead data for context
- **BUT if the user asked a question that triggered this tool:**
  - **YOU MUST immediately acknowledge their question**
  - **YOU MUST route to the ANSWER context RIGHT NOW**
  - Do NOT just say "got it" and wait - route immediately to answer their question

**Pattern:**
1. User asks question → get_lead_context called → tool completes
2. You acknowledge: "I can help with that."
3. **Route to ANSWER context immediately** to use search_knowledge tool

**DO NOT** remain in exit context after get_lead_context completes with a pending question.',
                '## CRITICAL: Handling Questions - Use route_to_context Tool
**When the caller asks ANY question:**
- **IMMEDIATELY call the route_to_context tool** with target_context="answer" and reason="user_asked_question"
- Do NOT call get_lead_context for routing - that tool is only for loading lead data (and is already loaded at call start)
- Do NOT try to answer questions in this context - route to ANSWER context immediately

**Pattern:**
1. User asks question
2. **Call route_to_context(target_context="answer", reason="user_asked_question")** immediately
3. The tool will switch you to the ANSWER context where you can use search_knowledge

**DO NOT** remain in exit context when a question is asked - always route immediately using route_to_context.'
            ),
            '## Questions Handling
**CRITICAL: If the caller asks ANY question:**
- Acknowledge briefly: "I can help with that." or "Let me answer that for you."
- **Route to the ANSWER context immediately** (use the answer context to handle the question with search_knowledge tool)
- Do NOT try to answer questions in this context - you don't have the knowledge search tool here

**After answering in the ANSWER context, you can route back here if appropriate.**',
            '## Questions Handling
**CRITICAL: If the caller asks ANY question:**
- **IMMEDIATELY call the route_to_context tool** with target_context="answer" and reason="user_asked_question"
- The route_to_context tool will programmatically switch you to the ANSWER context
- Once in ANSWER context, use the search_knowledge tool to find the answer
- After answering, you can route back here if appropriate using route_to_context(target_context="exit")'
        )
    )::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.vertical = 'reverse_mortgage'
  AND p.node_name = 'exit'
  AND pv.is_active = true;

