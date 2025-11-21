-- ============================================================================
-- UPDATE STEP_CRITERIA EXPRESSIONS FOR ALL NODES
-- Date: 2025-11-20
-- Purpose: Replace placeholder step_criteria with executable expressions
--          that support turn counting, tool-based completion, and intent detection
-- ============================================================================

-- This migration updates all 8 nodes with proper step_criteria expressions
-- that can be evaluated by the step_criteria_evaluator.py module.
--
-- Expression format: Python-like expressions with operators (==, !=, >=, <=, AND, OR, NOT)
-- Field access: Direct field names from conversation_data JSONB
-- Examples: "greet_turn_count >= 2 OR greeted == True"
--
-- See: livekit-agent/workflows/STEP_CRITERIA_EXPRESSION_FORMAT.md for syntax reference

-- ============================================================================
-- GREET Node
-- ============================================================================
-- Complete when: 2+ turns have occurred OR greeted flag is set
-- Supports: Turn counting for rapport building (fixes immediate routing issue)
UPDATE prompt_versions 
SET content = jsonb_set(content, '{step_criteria}', 
  '"greet_turn_count >= 2 OR greeted == True"')
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE node_name = 'greet' AND vertical = 'reverse_mortgage' AND is_active = true
) 
AND is_active = true
AND current_version = (
  SELECT current_version FROM prompts 
  WHERE id = prompt_versions.prompt_id
);

-- ============================================================================
-- VERIFY Node
-- ============================================================================
-- Complete when: verified flag is True (set by verify_caller_identity tool)
UPDATE prompt_versions 
SET content = jsonb_set(content, '{step_criteria}', 
  '"verified == True"')
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE node_name = 'verify' AND vertical = 'reverse_mortgage' AND is_active = true
) 
AND is_active = true
AND current_version = (
  SELECT current_version FROM prompts 
  WHERE id = prompt_versions.prompt_id
);

-- ============================================================================
-- QUALIFY Node
-- ============================================================================
-- Complete when: qualified flag is set (True or False) OR objection detected
-- Supports: Early exit to OBJECTIONS node if objection raised during qualification
UPDATE prompt_versions 
SET content = jsonb_set(content, '{step_criteria}', 
  '"qualified != None OR has_objection == True"')
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE node_name = 'qualify' AND vertical = 'reverse_mortgage' AND is_active = true
) 
AND is_active = true
AND current_version = (
  SELECT current_version FROM prompts 
  WHERE id = prompt_versions.prompt_id
);

-- ============================================================================
-- QUOTE Node
-- ============================================================================
-- Complete when: quote_presented flag is True OR objection detected
-- Supports: Early exit to OBJECTIONS node if objection raised after quote
UPDATE prompt_versions 
SET content = jsonb_set(content, '{step_criteria}', 
  '"quote_presented == True OR has_objection == True"')
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE node_name = 'quote' AND vertical = 'reverse_mortgage' AND is_active = true
) 
AND is_active = true
AND current_version = (
  SELECT current_version FROM prompts 
  WHERE id = prompt_versions.prompt_id
);

-- ============================================================================
-- ANSWER Node
-- ============================================================================
-- Complete when: questions answered OR ready to book OR objections detected
-- Note: Calculation questions route immediately to QUOTE (handled in routing logic, not completion)
UPDATE prompt_versions 
SET content = jsonb_set(content, '{step_criteria}', 
  '"questions_answered == True OR ready_to_book == True OR has_objections == True"')
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE node_name = 'answer' AND vertical = 'reverse_mortgage' AND is_active = true
) 
AND is_active = true
AND current_version = (
  SELECT current_version FROM prompts 
  WHERE id = prompt_versions.prompt_id
);

-- ============================================================================
-- OBJECTIONS Node
-- ============================================================================
-- Complete when: objection_handled flag is True (set by mark_objection_handled tool)
UPDATE prompt_versions 
SET content = jsonb_set(content, '{step_criteria}', 
  '"objection_handled == True"')
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE node_name = 'objections' AND vertical = 'reverse_mortgage' AND is_active = true
) 
AND is_active = true
AND current_version = (
  SELECT current_version FROM prompts 
  WHERE id = prompt_versions.prompt_id
);

-- ============================================================================
-- BOOK Node
-- ============================================================================
-- Complete when: appointment_booked flag is True OR manual_booking_required flag is True
-- Supports: Fallback when booking tool fails (manual broker follow-up)
UPDATE prompt_versions 
SET content = jsonb_set(content, '{step_criteria}', 
  '"appointment_booked == True OR manual_booking_required == True"')
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE node_name = 'book' AND vertical = 'reverse_mortgage' AND is_active = true
) 
AND is_active = true
AND current_version = (
  SELECT current_version FROM prompts 
  WHERE id = prompt_versions.prompt_id
);

-- ============================================================================
-- GOODBYE Node
-- ============================================================================
-- Complete when: Always (no conditions - always ready to transition)
UPDATE prompt_versions 
SET content = jsonb_set(content, '{step_criteria}', 
  '"True"')
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE node_name = 'goodbye' AND vertical = 'reverse_mortgage' AND is_active = true
) 
AND is_active = true
AND current_version = (
  SELECT current_version FROM prompts 
  WHERE id = prompt_versions.prompt_id
);

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify all step_criteria were updated correctly:
-- 
-- SELECT 
--   p.node_name,
--   pv.content->>'step_criteria' as step_criteria
-- FROM prompts p
-- JOIN prompt_versions pv ON p.id = pv.prompt_id 
--   AND p.current_version = pv.version_number
-- WHERE p.vertical = 'reverse_mortgage' 
--   AND p.is_active = true 
--   AND pv.is_active = true
-- ORDER BY p.node_name;

