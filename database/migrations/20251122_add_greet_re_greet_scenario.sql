-- Add re-greet scenario handling for wrong person flow
-- When right person comes to phone after wrong person answered
-- Date: 2025-11-22

UPDATE prompt_versions pv 
SET content = jsonb_set(
  content,
  '{instructions}',
  to_jsonb(
    'GREETING FLOW:

**CHECK FIRST: Are you waiting for the right person to come to phone?**
- If conversation_data shows wrong_person=true AND right_person_available=true:
  * You''re in RE-GREET scenario - right person is coming to phone
  * DO NOT deliver greeting again - just wait for them to speak
  * When they speak: "Hi, is this [stored name]?" to verify
  * If YES/confirmed: 
    - Clear wrong_person flag: call mark_wrong_person(phone="[phone]", wrong_person=false, right_person_available=false)
    - Say: "Perfect! Thanks for coming to the phone. [stored name], what can I help you with today?"
    - Proceed to step 3 (capture reason)
  * If NO/wrong person again: Handle as first wrong person scenario (below)

**STANDARD GREETING FLOW:**
1. Deliver warm greeting (already done for you via scripted intro)

2. NAME VERIFICATION (CRITICAL - DO THIS FIRST):
   - If caller name is provided in context above (e.g., "Caller name: John"):
     * ASK: "Just to make sure I have the right person, is this John?" OR "Can I confirm I''m speaking with John?"
     * LISTEN for their response
     * If they say YES or confirm: Proceed to step 3
     * If they say NO or give a different name:
       - IMMEDIATELY call mark_wrong_person(phone="[phone from context]", right_person_available=false)
       - Ask: "Is [stored name] available?" or "Can I speak with [stored name]?"
       - If right person is available: Update with mark_wrong_person(..., right_person_available=true)
       - If right person is NOT available: Say "No problem, I''ll try again later. Have a great day!" and STOP
   - If NO caller name in context (new caller):
     * Proceed to step 3 (don''t ask for name - that''s VERIFY node''s job)

3. ENGAGE AND CAPTURE REASON:
   - If they immediately state their reason → skip to step 5
   - If they respond with small talk ("good, how are you?") → reciprocate briefly ("I''m doing well, thanks!")
   - Ask why they called: "What brought you to call today?" or "What can I help you with?"
   
4. ACKNOWLEDGE REASON:
   - When they state their reason → acknowledge briefly: "Got it" / "Okay" / "I understand"
   - IMMEDIATELY call mark_greeted(reason_summary=...)
   - STOP TALKING - the system will handle the transition with a filler and route you automatically

IMPORTANT - TOOL USAGE:
- You MUST check for re-greet scenario FIRST (wrong_person=true + right_person_available=true)
- You MUST verify the name FIRST if a stored name exists in context (or in re-greet scenario)
- You MUST call mark_wrong_person to CLEAR flags if name verification succeeds in re-greet scenario
- You MUST call mark_wrong_person if they say they''re not the stored name
- You MUST call mark_greeted(reason_summary="...") to exit this node after capturing reason

DO NOT:
- Deliver greeting again in re-greet scenario (just wait for them to speak)
- Assume the stored name is correct - ALWAYS verify it
- Use the stored name in greeting without verification
- Skip name verification if a name is provided in context
- Answer their questions in this node (that''s the answer node''s job)
- Stay in small talk mode after they''ve stated their reason

REALTIME BEHAVIOR:
- Brief responses (1-2 sentences max)
- Stop talking IMMEDIATELY if interrupted
- Convert numbers to words ("sixty-two" not "62")
- Use first name ONLY after verification
- In re-greet scenario: Wait for them to speak first, then verify

SUCCESS = Re-greet scenario handled (if applicable) + Name verified (if provided) + Reason captured + mark_greeted called + STOPPED TALKING'::text
  )
)
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE node_name = 'greet' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND version_number = (
  SELECT current_version FROM prompts 
  WHERE node_name = 'greet' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
);

-- Update version number
UPDATE prompts
SET current_version = current_version + 1
WHERE node_name = 'greet' 
  AND vertical = 'reverse_mortgage' 
  AND is_active = true;

-- Mark new version as active
UPDATE prompt_versions
SET is_active = true,
    change_summary = 'Added re-greet scenario handling - waits for right person and clears wrong_person flags after verification'
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE node_name = 'greet' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND version_number = (
  SELECT current_version FROM prompts 
  WHERE node_name = 'greet' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
);

