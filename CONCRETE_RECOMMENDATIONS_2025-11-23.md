# Specific Recommendations for 4 Issues

## Issue 1: Identity Confirmation

### YES, it IS in the prompt! ✅

**GREET Node (line 9-13):**
```
2. Name Verification (if name in context):
   - Ask: "Just to confirm, is this [Name]?"
   - If YES → continue
   - If NO → Call mark_wrong_person(phone, right_person_available=false)
```

**VERIFY Node:**
```
role: "Verify the caller's identity by confirming their phone, email, and property address."
```

### The Problem
Looking at the conversation state:
- `verified: false` ❌
- `current_node: null` (call ended before verification completed)
- Testy is **already qualified** in database (all 4 flags = true)

### What Happened
1. Call started → GREET node should have asked "Is this Testy?"
2. **BUT conversation state shows `verified: false`** 
3. This means Barbara skipped or failed the verification step

### My Recommendation

**The prompt is correct, but it's not being executed properly.**

**Option 1: Make verification more explicit and unavoidable**
```yaml
# GREET node - Make it impossible to skip
1. Greet: "Hi! Equity Connect, this is Barbara. How are you today?"
2. IMMEDIATELY after response: "Just to confirm, am I speaking with {{first_name}} {{last_name}}?"
3. STOP and WAIT for YES/NO
4. If YES: Call mark_greeted() and continue
5. If NO: Handle wrong person flow
```

**Option 2: Add a verification gate**
```yaml
# Add to GREET node tools:
- verify_identity_before_continuing: MUST be called before mark_greeted
- This forces the AI to verify before proceeding
```

**Simplest fix:** Update GREET instruction line 9:
```yaml
CHANGE FROM:
"2. Name Verification (if name in context):"

CHANGE TO:
"2. Name Verification (REQUIRED - DO NOT SKIP):
   IMMEDIATELY after greeting, say: 'And just to confirm, am I speaking with [First Name] [Last Name]?'
   WAIT for their response."
```

---

## Issue 2: "Does that help? What else comes to mind?"

### My Specific Suggestion

**Current ANSWER Node (line 5):**
```
5. Check: "Does that help? What else comes to mind?"
```

**Change to:**
```
5. Ask: "Does that help?"
6. STOP TALKING and wait for their response
7. Based on their response:
   - If they say YES/GOOD/UNDERSTOOD: "Wonderful! What else comes to mind?"
   - If they say NO/UNCLEAR/WHAT: Re-explain more simply
   - If they ask a new question: Answer it directly (skip step 8)
8. If conversation continues naturally, no need to force "what else comes to mind"

CRITICAL: ONE question at a time. Wait 2-3 seconds after asking "Does that help?" before the AI considers speaking again.
```

**Also increase timing:**
```sql
UPDATE agent_params
SET 
  end_of_speech_timeout = 2500,  -- Give caller 2.5 seconds of silence (up from 2.0)
  attention_timeout = 10000       -- Wait 10 seconds before prompting (up from 8)
WHERE vertical = 'reverse_mortgage' AND is_active = true;
```

**Why this works:**
- Splits the double-question into TWO separate conversational turns
- Forces AI to wait for response
- Gives specific branching logic based on what they say
- Increases timeout so AI doesn't rush

---

## Issue 3: Fee Question Routing to QUOTE

### ??? Let me explain what happened

**The Transcript Shows:**
```
User: "What kind of fees are associated with this?"
[System routes to QUOTE context]
[System routes back to ANSWER context]
Assistant: "Reverse mortgages typically have some fees..."
```

**Why this is wrong:**
- "What kind of fees" = INFORMATION question (should stay in ANSWER)
- "How much will fees cost ME" = CALCULATION question (route to QUOTE)

**Current ANSWER Node Detection (lines 19-26):**
```
Calculation question triggers:
- "How much can I get?"
- "What's the loan amount?"
- "How much money is available?"
- "Can you calculate my reverse mortgage?"
- "What would my numbers be?"
- "How much equity can I access?"
```

**The problem:** No examples of what is NOT a calculation question

### My Specific Suggestion

**Add this section to ANSWER node BEFORE the calculation triggers:**
```yaml
=== INFORMATION vs CALCULATION ===

INFORMATION QUESTIONS (Stay in ANSWER - do NOT route):
✓ "What kind of fees are there?"
✓ "What types of costs should I expect?"
✓ "Tell me about the fees"
✓ "Are there closing costs?"
✓ "What are the requirements?"
✓ "How does the process work?"
✓ "What happens when I die?"

CALCULATION QUESTIONS (Route to QUOTE immediately):
→ "How much can I get?"
→ "What's MY loan amount?"
→ "Calculate MY reverse mortgage"
→ "What would MY numbers be?"

KEY DISTINCTION:
- "What kind/type" = General info (STAY)
- "How much/calculate/MY amount" = Specific calculation (ROUTE)
```

**Why this works:**
- Explicitly shows AI what NOT to route
- Uses the actual question from the transcript as an example
- Makes the distinction crystal clear: general info vs personal calculation

---

## Issue 4: Too Quick to Route

### My Specific Suggestion

**Add a confirmation step before routing:**

```yaml
# In ANSWER node, UPDATE the routing section:

When you detect a calculation question:
1. Confirm intent: "Would you like me to calculate your specific quote based on your property?"
2. WAIT for their response
3. If YES or "sure" or "yeah": 
   - Say: "Let me pull that up for you..."
   - Call route_conversation with target="quote"
4. If NO or "not yet" or "just curious":
   - Say: "No problem. I'm here when you're ready."
   - Stay in ANSWER

NEVER route to QUOTE without confirming they want a calculation.
```

**Plus adjust the agent params:**
```sql
UPDATE agent_params
SET 
  transparent_barge = true  -- Let caller interrupt without AI responding
WHERE vertical = 'reverse_mortgage' AND is_active = true;
```

**Why this works:**
- Prevents false positives from triggering routes
- Gives caller control ("Would you like me to calculate...")
- Makes it explicit that QUOTE is for calculations
- `transparent_barge = true` means if they start talking, AI stops and listens (not aggressive)

---

## TL;DR - Concrete Actions

### 1. GREET Node Fix
```sql
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{instructions}',
  '"2. Name Verification (REQUIRED - DO NOT SKIP):\n   IMMEDIATELY after greeting, say: ''And just to confirm, am I speaking with [First Name] [Last Name]?''\n   WAIT for their response."'::jsonb
)
WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'greet' AND vertical = 'reverse_mortgage')
  AND is_active = true;
```

### 2. ANSWER Node Fix (Double Question)
```sql
-- Split "Does that help? What else comes to mind?" into TWO turns
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{instructions}',
  -- Replace line 5 with lines 5-8 above
)
WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'answer')
  AND is_active = true;
```

### 3. ANSWER Node Fix (Fee Routing)
```sql
-- Add INFORMATION vs CALCULATION examples
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{instructions}',
  -- Add the explicit examples section above
)
WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'answer')
  AND is_active = true;
```

### 4. Agent Params Fix (Timing)
```sql
UPDATE agent_params
SET 
  end_of_speech_timeout = 2500,
  attention_timeout = 10000,
  transparent_barge = true
WHERE vertical = 'reverse_mortgage' AND is_active = true;
```

Want me to generate the exact SQL for these fixes?


