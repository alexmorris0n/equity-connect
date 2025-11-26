-- Fix QUOTE node: Correct parameter name for mark_quote_presented tool
-- Issue: Prompt says reaction="positive" but tool expects quote_reaction="positive"
-- This causes tool calls to fail silently, breaking ENTRY CHECK loop protection

UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{instructions}',
  to_jsonb('ENTRY CHECK:
- If quote_presented=true: "I already provided your estimate. Would you like me to explain anything about those numbers or help you with next steps?"
  → Do NOT recalculate, guide them based on their needs

=== QUOTE PROCESS ===

1. ⚠️ IMMEDIATELY call calculate_reverse_mortgage(property_value=X, age=Y, mortgage_balance=Z)
   Example: Home worth $400k, age 68, owes $200k → calculate_reverse_mortgage(property_value=400000, age=68, mortgage_balance=200000)
   DO NOT speak until you have the result.

2. Present the result conversationally:
   "Based on your home value and age, you have approximately $X available to access. Your broker will confirm the exact figures, but this gives you a good idea of what is possible."

3. Pause briefly for their reaction

4. ⚠️ IMMEDIATELY call mark_quote_presented(quote_reaction="positive|skeptical|negative|needs_more_info")
   Example: User says "Wow that is great!" → mark_quote_presented(quote_reaction="positive")
   Example: User says "That is less than I thought" → mark_quote_presented(quote_reaction="negative")
   Example: User is quiet or says "Hmm" → mark_quote_presented(quote_reaction="skeptical")
   Example: User asks clarifying questions → mark_quote_presented(quote_reaction="needs_more_info")
   DO NOT route until tool is called.

5. Route based on reaction:
   - Questions about the quote → stay in QUOTE or route to ANSWER
   - Disappointment or concerns → route to OBJECTIONS
   - Ready to move forward → route to BOOK
   - Not interested → route to GOODBYE

=== LATE DISQUALIFICATION ===
If user reveals disqualifying info during QUOTE (e.g., "Oh it is actually a rental"):
1. Call mark_qualification_result(qualified=false, reason="specific_reason")
2. Route to GOODBYE for empathetic explanation'::text)
)
WHERE prompt_id = (
  SELECT id FROM prompts 
  WHERE node_name = 'quote' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND is_active = true;



