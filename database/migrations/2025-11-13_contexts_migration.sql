-- ============================================================================
-- BARBGRAPH → SIGNALWIRE CONTEXTS MIGRATION
-- Date: 2025-11-13
-- Purpose: Add contexts support to prompts system, update 8 nodes with variables
-- ============================================================================

-- ============================================================================
-- Section 1: Create contexts_config table
-- ============================================================================

CREATE TABLE IF NOT EXISTS contexts_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vertical TEXT NOT NULL,
    context_name TEXT NOT NULL,
    isolated BOOLEAN DEFAULT false,
    enter_fillers JSONB DEFAULT '[]',
    exit_fillers JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vertical, context_name)
);

-- ============================================================================
-- Section 2: Alter prompts table (add step columns)
-- ============================================================================

ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS step_name TEXT DEFAULT 'main',
ADD COLUMN IF NOT EXISTS step_order INTEGER DEFAULT 1;

UPDATE prompts SET step_name = 'main', step_order = 1
WHERE step_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_prompts_vertical_node_step 
ON prompts(vertical, node_name, step_order);

-- ============================================================================
-- Section 3: Add step_criteria to all existing prompt_versions
-- ============================================================================

UPDATE prompt_versions 
SET content = jsonb_set(
    content, 
    '{step_criteria}', 
    '"User has responded appropriately to this step."'
)
WHERE content->>'step_criteria' IS NULL;

-- ============================================================================
-- Section 4: Add valid_contexts to each of the 8 nodes (routing logic)
-- ============================================================================

-- GREET → ["verify", "exit"]
UPDATE prompt_versions pv 
SET content = jsonb_set(content, '{valid_contexts}', '["verify", "exit"]'::jsonb)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'greet' 
  AND pv.is_active = true
  AND content->>'valid_contexts' IS NULL;

-- VERIFY → ["qualify", "exit"]
UPDATE prompt_versions pv 
SET content = jsonb_set(content, '{valid_contexts}', '["qualify", "exit"]'::jsonb)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'verify' 
  AND pv.is_active = true
  AND content->>'valid_contexts' IS NULL;

-- QUALIFY → ["quote", "exit"]
UPDATE prompt_versions pv 
SET content = jsonb_set(content, '{valid_contexts}', '["quote", "exit"]'::jsonb)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'qualify' 
  AND pv.is_active = true
  AND content->>'valid_contexts' IS NULL;

-- QUOTE → ["answer", "book", "exit"]
UPDATE prompt_versions pv 
SET content = jsonb_set(content, '{valid_contexts}', '["answer", "book", "exit"]'::jsonb)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'quote' 
  AND pv.is_active = true
  AND content->>'valid_contexts' IS NULL;

-- ANSWER → ["objections", "book", "exit"]
UPDATE prompt_versions pv 
SET content = jsonb_set(content, '{valid_contexts}', '["objections", "book", "exit"]'::jsonb)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'answer' 
  AND pv.is_active = true
  AND content->>'valid_contexts' IS NULL;

-- OBJECTIONS → ["answer", "book", "exit"]
UPDATE prompt_versions pv 
SET content = jsonb_set(content, '{valid_contexts}', '["answer", "book", "exit"]'::jsonb)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'objections' 
  AND pv.is_active = true
  AND content->>'valid_contexts' IS NULL;

-- BOOK → ["exit"]
UPDATE prompt_versions pv 
SET content = jsonb_set(content, '{valid_contexts}', '["exit"]'::jsonb)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'book' 
  AND pv.is_active = true
  AND content->>'valid_contexts' IS NULL;

-- EXIT → ["greet"] (for wrong person re-greet scenario)
UPDATE prompt_versions pv 
SET content = jsonb_set(content, '{valid_contexts}', '["greet"]'::jsonb)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'exit' 
  AND pv.is_active = true
  AND content->>'valid_contexts' IS NULL;

-- ============================================================================
-- Section 5: Update all 8 node prompts with variable syntax
-- ============================================================================

-- GREET: {lead.first_name}, {property.city}, {property.state}
UPDATE prompt_versions pv 
SET content = jsonb_set(
    content, 
    '{instructions}',
    '"Warmly greet {lead.first_name} from {property.city}, {property.state}. Introduce yourself as Barbara from Equity Connect. Build rapport and confirm you''re speaking with the right person."'
)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'greet' 
  AND pv.is_active = true
  AND content->>'instructions' NOT LIKE '%{lead.%';

-- VERIFY: {lead.first_name}, mark_wrong_person tool
UPDATE prompt_versions pv 
SET content = jsonb_set(
    content, 
    '{instructions}',
    '"Confirm you''re speaking with {lead.first_name}. If wrong person, call mark_wrong_person tool and ask if {lead.first_name} is available. If right person, proceed to gather basic information."'
)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'verify' 
  AND pv.is_active = true
  AND content->>'instructions' NOT LIKE '%{lead.%';

-- QUALIFY: {lead.first_name}, {property.equity_formatted}, {status.qualified}
UPDATE prompt_versions pv 
SET content = jsonb_set(
    content, 
    '{instructions}',
    '"Ask {lead.first_name} natural qualification questions: age (62+), home ownership, and approximate equity. Current equity estimate: {property.equity_formatted}. If already qualified ({status.qualified} = true), skip to next step."'
)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'qualify' 
  AND pv.is_active = true
  AND content->>'instructions' NOT LIKE '%{lead.%';

-- QUOTE: {property.equity_formatted}, mark_quote_presented
UPDATE prompt_versions pv 
SET content = jsonb_set(
    content, 
    '{instructions}',
    '"Present financial quote to {lead.first_name}. Property equity: {property.equity_formatted}. Explain they can access approximately 50-60% (multiply {property.equity_formatted} by 0.5 to 0.6). Gauge their reaction and call mark_quote_presented tool with their reaction (positive, skeptical, needs_more, or not_interested)."'
)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'quote' 
  AND pv.is_active = true
  AND content->>'instructions' NOT LIKE '%{property.%';

-- ANSWER: {lead.first_name}, {property.city}, {status.broker_name}, {status.broker_company}
UPDATE prompt_versions pv 
SET content = jsonb_set(
    content, 
    '{instructions}',
    '"Answer {lead.first_name}''s questions about reverse mortgages. Use search_knowledge tool when needed. Property: {property.city}, {property.state}, {property.equity_formatted} equity. Assigned broker: {status.broker_name} at {status.broker_company}. If they express concerns, transition to objections context. If ready to book, call mark_ready_to_book tool."'
)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'answer' 
  AND pv.is_active = true
  AND content->>'instructions' NOT LIKE '%{lead.%';

-- OBJECTIONS: {lead.first_name}, mark_objection_handled
UPDATE prompt_versions pv 
SET content = jsonb_set(
    content, 
    '{instructions}',
    '"Address {lead.first_name}''s concerns empathetically. Use search_knowledge for factual answers. Common objections: scams, losing home, heirs inheritance. Once resolved, call mark_objection_handled and return to answering questions or booking."'
)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'objections' 
  AND pv.is_active = true
  AND content->>'instructions' NOT LIKE '%{lead.%';

-- BOOK: {lead.first_name}, {status.broker_name}, mark_appointment_booked
UPDATE prompt_versions pv 
SET content = jsonb_set(
    content, 
    '{instructions}',
    '"Schedule appointment between {lead.first_name} and {status.broker_name}. Use check_broker_availability to find times, then book_appointment to confirm. After booking, call mark_appointment_booked and transition to exit."'
)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'book' 
  AND pv.is_active = true
  AND content->>'instructions' NOT LIKE '%{lead.%';

-- EXIT: {lead.first_name}, transition to greet
UPDATE prompt_versions pv 
SET content = jsonb_set(
    content, 
    '{instructions}',
    '"Thank {lead.first_name} for their time. If appointment booked, confirm details. If wrong person scenario and right person available, re-greet by transitioning back to greet context. Otherwise, end call professionally."'
)
FROM prompts p 
WHERE pv.prompt_id = p.id 
  AND p.node_name = 'exit' 
  AND pv.is_active = true
  AND content->>'instructions' NOT LIKE '%{lead.%';

