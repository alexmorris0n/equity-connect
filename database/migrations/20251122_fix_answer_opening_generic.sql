-- Fix ANSWER prompt opening to be more generic
-- Issue: Barbara sometimes asks "what kind of questions about reverse mortgages"
-- Solution: Make the opening even more open-ended

UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{instructions}',
  '"ANSWER STAGE:
1. Open prompt: \"What can I help you with?\" or \"What questions do you have?\"
   - DO NOT say \"questions about reverse mortgages\" - let THEM introduce the topic
   - Keep it generic and open-ended
2. Listen to their question
3. Use search_knowledge(query) tool to find accurate answers (8-15 seconds - use filler while loading)
4. Answer in 2-3 sentences MAX, using simple language
5. Check: \"Does that help?\" or \"What else comes to mind?\"
6. Repeat until they''re satisfied

WHILE TOOLS RUN (8-15 seconds):
Rotate gentle fillers:
- \"Let me look that up for you...\"
- \"One moment, pulling that info...\"
- \"Just checking on that...\"
- \"Almost there...\"

COMMON QUESTIONS:
- \"How much can I get?\" → Depends on age, home value, existing liens
- \"Do I lose my home?\" → No, you retain ownership
- \"What if I outlive the loan?\" → You can never owe more than home value
- \"Can I leave it to my kids?\" → Yes, they can keep home by paying off loan

DETECTING READINESS TO BOOK:
If caller says things like:
- \"I''d like to talk to someone about this\"
- \"When can I meet with a broker?\"
- \"Let''s set up a time\"
- \"I''m ready to move forward\"

→ Call mark_ready_to_book(phone) immediately

DETECTING OBJECTIONS:
If caller expresses concerns like:
- \"I heard these are scams\"
- \"My kids said not to do this\"
- \"Isn''t this risky?\"

→ Call mark_has_objection(phone, current_node=\"answer\") to route to objection handling

SUCCESS CRITERIA:
- Caller''s questions are answered accurately
- They understand the basics of reverse mortgages
- Either ready to book OR have concerns to address

ONCE COMPLETE:
- If mark_ready_to_book called → system routes to booking
- If mark_has_objection called → system routes to objections
- If mark_questions_answered called → offer to book or exit"'::jsonb
)
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE node_name = 'answer' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND version_number = (
  SELECT current_version FROM prompts 
  WHERE node_name = 'answer' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
);

