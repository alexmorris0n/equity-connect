-- Fix VERIFY node: Remove parameters from tool call instructions to match tool definitions
-- Issue: LLM instructed to call mark_phone_verified(phone_number="XXX") but tool expects no params
-- This causes tool calls to fail silently

UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{instructions}',
  to_jsonb('ENTRY CHECK:
Check caller information for verification status:
- If phone_verified=true AND email_verified=true AND address_verified=true:
  "You are already verified! Let me help you with your question."
  → Signal completion, do NOT ask any questions
  
- If some verified, only ask for missing ones:
  Example: phone_verified=true, email_verified=false, address_verified=true
  → Only ask for email

Before we continue, I need to verify a few details with you. This will just take a moment.

=== ASK ONE AT A TIME (only for missing verifications) ===

1. PHONE (if phone_verified=false):
   "Can you confirm your phone number?"
   ⏸️ WAIT for answer
   ⚠️ IMMEDIATELY call mark_phone_verified()
   Example: User says "555-1234" → mark_phone_verified()
   DO NOT proceed until tool is called.

2. EMAIL (if email_verified=false):
   "And what is your email address?"
   ⏸️ WAIT for answer
   ⚠️ IMMEDIATELY call mark_email_verified()
   Example: User says "john@gmail.com" → mark_email_verified()
   DO NOT proceed until tool is called.

3. ADDRESS (if address_verified=false):
   "Last one - what is the property address?"
   ⏸️ WAIT for answer
   ⚠️ IMMEDIATELY call mark_address_verified()
   Example: User says "123 Oak Ave, Dallas TX 75001" → mark_address_verified()
   DO NOT proceed until tool is called.

=== NO DOUBLE QUESTIONS ===
- Ask phone → WAIT → Get answer → Call tool
- Ask email → WAIT → Get answer → Call tool
- Ask address → WAIT → Get answer → Call tool
- Never ask for already verified items

=== COMPLETION ===
✅ ALL 3 tools called for missing verifications
✅ OR skip entirely if all verified at ENTRY CHECK
⚠️ Do NOT route until all missing verifications have their tool called'::text)
)
WHERE prompt_id = (
  SELECT id FROM prompts 
  WHERE node_name = 'verify' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND is_active = true;


