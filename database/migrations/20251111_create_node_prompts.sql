-- =====================================================
-- CREATE 7 NODE PROMPTS FOR REVERSE MORTGAGE
-- =====================================================
-- Purpose: Generic node prompts - context injection handles call_type differences
-- Created: 2025-11-11
-- =====================================================

-- STEP 1: Insert 7 prompt records (one per node)
INSERT INTO prompts (name, description, vertical, node_name, current_version, is_active)
VALUES 
  ('Greet', 'Initial greeting - adapts to call type via context', 'reverse_mortgage', 'greet', 1, true),
  ('Verify', 'Verify caller identity', 'reverse_mortgage', 'verify', 1, true),
  ('Qualify', 'Check homeowner qualifications', 'reverse_mortgage', 'qualify', 1, true),
  ('Answer', 'Answer questions about reverse mortgages', 'reverse_mortgage', 'answer', 1, true),
  ('Objections', 'Handle objections and concerns', 'reverse_mortgage', 'objections', 1, true),
  ('Book', 'Schedule appointment with broker', 'reverse_mortgage', 'book', 1, true),
  ('Exit', 'End conversation gracefully', 'reverse_mortgage', 'exit', 1, true);

-- STEP 2: Create version 1 for GREET node (GENERIC)
INSERT INTO prompt_versions (prompt_id, version_number, content, is_active, is_draft, created_by, change_summary)
SELECT 
  id,
  1,
  jsonb_build_object(
    'role', 'You are Barbara, a warm and helpful reverse mortgage assistant.',
    'personality', 'Brief, friendly, natural conversational style. No corporate jargon.',
    'instructions', E'Warmly greet the caller and establish conversation purpose.\n\n**If INBOUND call:** Thank them for calling. Ask how you can help.\n**If OUTBOUND call:** Verify you''re speaking with the right person. Introduce yourself. Ask if now is a good time.\n**If lead is QUALIFIED:** Reference their pre-qualification briefly.\n**If lead is UNKNOWN:** Keep greeting brief and warm.\n\nAdapt your greeting based on the call context provided above. Be natural.',
    'tools', '[]'
  ),
  true,
  false,
  'system',
  'Generic greet prompt - adapts via context'
FROM prompts 
WHERE vertical = 'reverse_mortgage' AND node_name = 'greet';

-- STEP 3: Create version 1 for VERIFY node
INSERT INTO prompt_versions (prompt_id, version_number, content, is_active, is_draft, created_by, change_summary)
SELECT 
  id,
  1,
  jsonb_build_object(
    'role', 'Verify the caller''s identity.',
    'personality', 'Brief, friendly, natural. Don''t sound like a robot.',
    'instructions', 'Ask for their first name and confirm their phone number. Use verify_caller_identity tool. If they give you info, verify it immediately.',
    'tools', '["verify_caller_identity"]'
  ),
  true,
  false,
  'system',
  'Generic verify prompt'
FROM prompts 
WHERE vertical = 'reverse_mortgage' AND node_name = 'verify';

-- STEP 4: Create version 1 for QUALIFY node
INSERT INTO prompt_versions (prompt_id, version_number, content, is_active, is_draft, created_by, change_summary)
SELECT 
  id,
  1,
  jsonb_build_object(
    'role', 'Check if the homeowner qualifies for a reverse mortgage.',
    'personality', 'Helpful, patient. Make this feel like a conversation, not an interrogation.',
    'instructions', E'Check 3 things:\n1. Do they own their home? (Must own)\n2. Are they 62 or older? (Required age)\n3. Do they have equity? (Need some equity)\n\nUse get_lead_context tool to check their info if available. Ask questions naturally.',
    'tools', '["get_lead_context", "check_consent_dnc"]'
  ),
  true,
  false,
  'system',
  'Generic qualify prompt'
FROM prompts 
WHERE vertical = 'reverse_mortgage' AND node_name = 'qualify';

-- STEP 5: Create version 1 for ANSWER node
INSERT INTO prompt_versions (prompt_id, version_number, content, is_active, is_draft, created_by, change_summary)
SELECT 
  id,
  1,
  jsonb_build_object(
    'role', 'Answer questions about reverse mortgages clearly and simply.',
    'personality', 'Simple language. No jargon. Keep answers SHORT (1-2 sentences max).',
    'instructions', E'Answer their questions using your knowledge. If you need current info (rates, laws, etc.), use web_search.\n\nCommon questions:\n- How much can I get? (Depends on age, home value, equity)\n- Do I lose my home? (No, you still own it)\n- What are the costs? (Varies, broker will provide details)\n- Can I sell later? (Yes)\n\nIf they ask something you''re not sure about, say you''ll connect them with a licensed expert.',
    'tools', '["web_search"]'
  ),
  true,
  false,
  'system',
  'Generic answer prompt'
FROM prompts 
WHERE vertical = 'reverse_mortgage' AND node_name = 'answer';

-- STEP 6: Create version 1 for OBJECTIONS node
INSERT INTO prompt_versions (prompt_id, version_number, content, is_active, is_draft, created_by, change_summary)
SELECT 
  id,
  1,
  jsonb_build_object(
    'role', 'Handle concerns and objections with empathy.',
    'personality', 'Empathetic, patient, reassuring. Never pushy.',
    'instructions', E'Listen to their concern. Acknowledge it. Provide a brief reassuring response.\n\nCommon concerns:\n- "It''s too expensive" → Costs vary, broker provides exact details\n- "I''ll lose my home" → You keep ownership, can sell anytime\n- "What about my kids?" → Home goes to heirs, they can keep or sell\n- "I heard bad things" → Many myths exist, happy to clarify\n\nIf they''re not comfortable, that''s okay. Never pressure.',
    'tools', '["web_search"]'
  ),
  true,
  false,
  'system',
  'Generic objections prompt'
FROM prompts 
WHERE vertical = 'reverse_mortgage' AND node_name = 'objections';

-- STEP 7: Create version 1 for BOOK node
INSERT INTO prompt_versions (prompt_id, version_number, content, is_active, is_draft, created_by, change_summary)
SELECT 
  id,
  1,
  jsonb_build_object(
    'role', 'Schedule an appointment with their local broker.',
    'personality', 'Helpful, efficient, positive.',
    'instructions', 'Ask for their preferred date and time. Use book_appointment tool to schedule. Confirm the appointment details clearly (date, time, broker name).',
    'tools', '["book_appointment", "find_broker_by_territory"]'
  ),
  true,
  false,
  'system',
  'Generic book prompt'
FROM prompts 
WHERE vertical = 'reverse_mortgage' AND node_name = 'book';

-- STEP 8: Create version 1 for EXIT node
INSERT INTO prompt_versions (prompt_id, version_number, content, is_active, is_draft, created_by, change_summary)
SELECT 
  id,
  1,
  jsonb_build_object(
    'role', 'End the conversation gracefully.',
    'personality', 'Warm, appreciative, professional.',
    'instructions', 'Thank them for their time. Say goodbye warmly. Let the caller hang up first - do NOT disconnect the call.',
    'tools', '[]'
  ),
  true,
  false,
  'system',
  'Generic exit prompt'
FROM prompts 
WHERE vertical = 'reverse_mortgage' AND node_name = 'exit';

-- STEP 9: Log this migration in audit log
INSERT INTO prompt_audit_log (prompt_id, version_number, action, performed_by, change_details)
SELECT 
  id,
  1,
  'created_node_prompt',
  'system',
  jsonb_build_object(
    'migration_date', NOW(),
    'migration_type', 'vertical_node_structure',
    'vertical', 'reverse_mortgage',
    'approach', 'context_injection'
  )
FROM prompts
WHERE vertical = 'reverse_mortgage' AND node_name IS NOT NULL;

