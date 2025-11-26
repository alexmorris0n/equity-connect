-- Simplify QUOTE node: Just mark quote_presented, no reaction tracking
-- Keep it simple - we just need to know if quote was presented (for ENTRY CHECK)

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

3. ⚠️ IMMEDIATELY call mark_quote_presented()
   DO NOT route until tool is called.

4. Route based on their response:
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



