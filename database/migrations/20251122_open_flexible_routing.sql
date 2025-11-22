-- Open up valid_contexts for all nodes to allow flexible routing
-- Issue: Nodes had restrictive routing (e.g., answer couldn't route to qualify)
-- Solution: Allow nodes to route to most other nodes based on conversation flow

-- Philosophy: Each node is a specialist. If user's needs change mid-conversation,
-- we should route them to the right specialist, not force linear flow.

-- GREET → Can route anywhere (receptionist sends you to right specialist)
UPDATE prompt_versions pv
SET content = jsonb_set(
  content, 
  '{valid_contexts}', 
  '["answer", "quote", "verify", "qualify", "objections", "book", "exit"]'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.node_name = 'greet'
  AND p.vertical = 'reverse_mortgage'
  AND pv.is_active = true;

-- VERIFY → Can route to any next step after verification
UPDATE prompt_versions pv
SET content = jsonb_set(
  content, 
  '{valid_contexts}', 
  '["answer", "quote", "qualify", "objections", "book", "exit"]'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.node_name = 'verify'
  AND p.vertical = 'reverse_mortgage'
  AND pv.is_active = true;

-- QUALIFY → After qualification, can go to any specialist
UPDATE prompt_versions pv
SET content = jsonb_set(
  content, 
  '{valid_contexts}', 
  '["answer", "quote", "objections", "book", "exit"]'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.node_name = 'qualify'
  AND p.vertical = 'reverse_mortgage'
  AND pv.is_active = true;

-- ANSWER → Q&A specialist can route to other specialists
UPDATE prompt_versions pv
SET content = jsonb_set(
  content, 
  '{valid_contexts}', 
  '["quote", "qualify", "objections", "book", "exit"]'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.node_name = 'answer'
  AND p.vertical = 'reverse_mortgage'
  AND pv.is_active = true;

-- QUOTE → After quote, can address concerns, answer questions, or book
UPDATE prompt_versions pv
SET content = jsonb_set(
  content, 
  '{valid_contexts}', 
  '["answer", "qualify", "objections", "book", "exit"]'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.node_name = 'quote'
  AND p.vertical = 'reverse_mortgage'
  AND pv.is_active = true;

-- OBJECTIONS → After addressing concerns, can go anywhere
UPDATE prompt_versions pv
SET content = jsonb_set(
  content, 
  '{valid_contexts}', 
  '["answer", "quote", "qualify", "book", "exit"]'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.node_name = 'objections'
  AND p.vertical = 'reverse_mortgage'
  AND pv.is_active = true;

-- BOOK → After booking attempt, can answer questions or exit
UPDATE prompt_versions pv
SET content = jsonb_set(
  content, 
  '{valid_contexts}', 
  '["answer", "objections", "exit"]'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.node_name = 'book'
  AND p.vertical = 'reverse_mortgage'
  AND pv.is_active = true;

-- EXIT → Terminal node (stays in exit or ends call)
UPDATE prompt_versions pv
SET content = jsonb_set(
  content, 
  '{valid_contexts}', 
  '["exit"]'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.node_name = 'exit'
  AND p.vertical = 'reverse_mortgage'
  AND pv.is_active = true;

-- GOODBYE → Also terminal (if it exists separately from exit)
UPDATE prompt_versions pv
SET content = jsonb_set(
  content, 
  '{valid_contexts}', 
  '["exit"]'::jsonb
)
FROM prompts p
WHERE pv.prompt_id = p.id
  AND p.node_name = 'goodbye'
  AND p.vertical = 'reverse_mortgage'
  AND pv.is_active = true;

