# Solutions for Call Flow Issues - SignalWire AI Agent

## Issue 1: ❌ Barbara Didn't Confirm Caller Identity

### Problem
Barbara never asked "Am I speaking with Testy?" before providing property information. This is a critical privacy/security issue.

### SignalWire Solution

**Use SWAIG Reserved Function: `start_hook`**

The `start_hook` reserved function triggers when the call is answered, allowing you to inject caller information immediately.

#### Implementation Strategy

**Option A: Add Identity Verification to GREET Node**

```yaml
# In prompts.content.instructions for GREET node
instructions: |
  You are Barbara, greeting and confirming caller identity.
  
  CRITICAL: ALWAYS confirm caller identity FIRST before providing ANY information.
  
  === IDENTITY VERIFICATION FLOW ===
  1. Greet warmly: "Hi, this is Barbara with Equity Connect."
  2. Ask for confirmation: "Am I speaking with ${caller_first_name}?"
  3. WAIT for response
  4. If YES: "Great! How are you today?"
  5. If NO or UNCERTAIN: 
     - "May I ask who I'm speaking with?"
     - Use verify_caller_identity tool to update lead record
  
  DO NOT proceed with property discussion until identity is confirmed.
```

**Option B: Use SWAIG `start_hook` Function**

```yaml
SWAIG:
  functions:
    - function: start_hook
      description: Triggered when call is answered. Loads caller information.
      web_hook_url: https://your-backend.com/webhooks/start-call
      parameters:
        type: object
        properties:
          phone_number:
            type: string
            description: Caller's phone number
```

**Backend Response:**
```json
{
  "response": "Caller information loaded: Testy Mctesterson, 123 Main St, Inglewood CA",
  "action": [
    {
      "set_global_data": {
        "caller_first_name": "Testy",
        "caller_last_name": "Mctesterson",
        "identity_confirmed": false
      }
    }
  ]
}
```

**Then in GREET prompt:**
```yaml
text: |
  You are Barbara. The caller's name is ${caller_first_name} ${caller_last_name}.
  
  FIRST ACTION: Confirm you're speaking with ${caller_first_name}.
  Say: "Hi, this is Barbara with Equity Connect. Am I speaking with ${caller_first_name}?"
  
  Wait for their response. Do not continue until identity is confirmed.
```

#### Recommended Approach

**Update `prompt_versions` table for GREET node:**

```json
{
  "instructions": "You are Barbara, greeting callers warmly.\n\nCRITICAL FIRST STEP: Confirm caller identity\n\n1. Greet: \"Hi, this is Barbara with Equity Connect.\"\n2. Confirm: \"Am I speaking with {{caller_first_name}}?\"\n3. WAIT for response (do not continue talking)\n4. If YES: \"Wonderful! How are you doing today?\"\n5. If NO: \"I apologize for the confusion. May I ask who I'm speaking with?\"\n\nDO NOT provide property information until identity is confirmed.\nDO NOT mention tools or contexts to the user."
}
```

---

## Issue 2: ⚠️ "Does that help? What else comes to mind?" - No Pause

### Problem
Barbara asks two questions in one breath without waiting for the caller to respond to the first question.

### SignalWire Solution

**Use `end_of_speech_timeout` + Prompt Engineering**

SignalWire's `end_of_speech_timeout` (default: 700ms) controls how long the AI waits for silence before considering the user finished speaking. This is the key parameter for conversation pacing.

#### Implementation Strategy

**Step 1: Increase `end_of_speech_timeout` in `agent_params`**

Current: `2000ms`
Recommended: `2500-3000ms` for senior callers

```sql
UPDATE agent_params
SET end_of_speech_timeout = 2500
WHERE vertical = 'reverse_mortgage' AND is_active = true;
```

**Step 2: Split Double-Question into Conversational Checkpoints**

Current ANSWER node instructions:
```
4. Answer conversationally in 2-3 sentences MAX, using simple language
5. Check: "Does that help? What else comes to mind?"
```

**Fixed ANSWER node instructions:**
```yaml
instructions: |
  === ANSWER PROCESS ===
  1. If user already asked a question: Answer it immediately
  2. Answer conversationally in 2-3 sentences MAX
  3. PAUSE and ask: "Does that help?"
  4. WAIT for their response
  5. Based on response:
     - If they say YES/UNDERSTOOD: "What else comes to mind?"
     - If they say NO/UNCLEAR: Clarify the answer
     - If they ask another question: Answer it directly
  
  CRITICAL: Ask ONE question at a time. Wait for response before continuing.
```

**Step 3: Use SignalWire's `wait_for_user` Parameter**

For specific contexts where you MUST wait (like after asking a question):

```yaml
# In contexts configuration for ANSWER node
contexts:
  answer:
    isolated: false
    steps:
      - name: answer_question
        text: |
          Answer the user's question briefly and clearly.
          Then ask: "Does that help?"
          
          STOP SPEAKING. Wait for the user to respond.
```

#### Alternative: Use SWAIG Action to Inject Pause

```yaml
SWAIG:
  functions:
    - function: answer_question
      description: Answer a question and confirm understanding
      web_hook_url: https://your-backend.com/webhooks/answer
      parameters:
        type: object
        properties:
          question:
            type: string
          answer:
            type: string
```

**Backend Response:**
```json
{
  "response": "Here's the answer: [ANSWER TEXT]. Does that help?",
  "action": [
    {
      "user_input": ""  # Forces AI to wait for user input
    }
  ]
}
```

#### Recommended Database Update

```sql
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{instructions}',
  '"You are Barbara, answering questions about reverse mortgages.\n\n=== ANSWER PROCESS ===\n1. If user already asked a question: Answer it immediately using search_knowledge if needed\n2. Answer conversationally in 2-3 sentences MAX, using simple language\n3. Ask: \"Does that help?\"\n4. STOP and WAIT for their response\n5. Once they respond:\n   - If YES/GOOD: \"Great! What else comes to mind?\"\n   - If NO/UNCLEAR: Clarify without repeating the full answer\n   - If new question: Answer it directly\n\nCRITICAL: One question at a time. Wait for response before continuing."'::jsonb
)
WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'answer' AND vertical = 'reverse_mortgage')
  AND is_active = true;
```

---

## Issue 3: ❌ Incorrect Routing to QUOTE for Fee Question

### Problem
"What kind of fees are associated with this?" triggered QUOTE routing instead of staying in ANSWER.

### SignalWire Solution

**Refine Context Routing Logic with Better Examples**

The ANSWER node has aggressive calculation detection. We need to distinguish between:
- **Information questions** (stay in ANSWER)
- **Calculation questions** (route to QUOTE)

#### Implementation Strategy

**Update ANSWER Node with Explicit Non-Calculation Examples**

```yaml
instructions: |
  === DETECTING CALCULATION QUESTIONS (CRITICAL) ===
  
  CALCULATION QUESTIONS → Route to QUOTE immediately:
  - "How much can I get?"
  - "What's the loan amount?"
  - "Can you calculate my reverse mortgage?"
  - "What would my numbers be?"
  - "How much equity can I access?"
  - "What's my borrowing limit?"
  - "Calculate my estimate"
  
  INFORMATION QUESTIONS → Stay in ANSWER (do NOT route):
  - "What kind of fees are there?" ✓ Stay in ANSWER
  - "What fees should I expect?" ✓ Stay in ANSWER
  - "Tell me about the costs" ✓ Stay in ANSWER
  - "Are there closing costs?" ✓ Stay in ANSWER
  - "What are the requirements?" ✓ Stay in ANSWER
  - "How does the process work?" ✓ Stay in ANSWER
  - "What happens when I die?" ✓ Stay in ANSWER
  
  KEY DISTINCTION:
  - Asking "what kind/type" = INFORMATION (stay)
  - Asking "how much/calculate/my amount" = CALCULATION (route)
  
  When you detect a calculation question:
  1. Say: "Let me calculate that for you..."
  2. Call route_conversation with target="quote" immediately
  3. DO NOT try to answer calculation questions yourself
```

#### Add Routing Confidence Check

**Option: Use SWAIG Function to Validate Routing Decision**

```yaml
SWAIG:
  functions:
    - function: should_route_to_quote
      description: Determines if question requires calculation or just information
      parameters:
        type: object
        properties:
          user_question:
            type: string
            description: The user's exact question
      web_hook_url: https://your-backend.com/webhooks/route-decision
```

**Backend Logic:**
```python
calculation_keywords = ["how much", "calculate", "my amount", "my estimate", "borrowing limit"]
information_keywords = ["what kind", "what type", "tell me about", "explain", "how does", "what happens"]

if any(kw in user_question.lower() for kw in calculation_keywords):
    if not any(kw in user_question.lower() for kw in information_keywords):
        return {"route_to_quote": True}
return {"route_to_quote": False}
```

#### Recommended Database Update

```sql
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{instructions}',
  '"=== DETECTING CALCULATION QUESTIONS (CRITICAL) ===\nIf caller asks about SPECIFIC AMOUNTS or CALCULATIONS, you MUST route to QUOTE immediately.\n\nCalculation question triggers:\n- \"How much can I get?\"\n- \"What'\''s the loan amount?\"\n- \"Can you calculate my reverse mortgage?\"\n- \"What would my numbers be?\"\n- \"How much equity can I access?\"\n\nINFORMATION questions (STAY in ANSWER):\n- \"What kind of fees are there?\"\n- \"What fees should I expect?\"\n- \"Tell me about the costs\"\n- \"What are the requirements?\"\n- \"How does it work?\"\n\nKEY: \"What kind\" = INFORMATION (stay). \"How much\" = CALCULATION (route)."'::jsonb
)
WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'answer' AND vertical = 'reverse_mortgage')
  AND is_active = true;
```

---

## Issue 4: ⚠️ Barbara Routed to QUOTE Too Quickly

### Problem
Barbara is overeager to route to QUOTE context, possibly misinterpreting questions.

### SignalWire Solution

**Use Context Routing with Confirmation Step**

SignalWire's `contexts` feature allows controlled routing between conversation modes. Add a confirmation step before routing.

#### Implementation Strategy

**Option A: Add Confirmation Before Routing**

```yaml
# In ANSWER node
instructions: |
  === DETECTING READINESS FOR CALCULATION ===
  If caller asks about loan amounts:
  1. Confirm intent: "Would you like me to calculate your specific quote based on your property information?"
  2. Wait for YES/NO response
  3. If YES: Route to QUOTE
  4. If NO: "No problem. What else can I help you understand?"
```

**Option B: Use `valid_contexts` to Restrict Routing**

In SignalWire contexts, you can specify which contexts are valid transitions:

```yaml
contexts:
  answer:
    isolated: false
    steps:
      - name: answer_general_questions
        text: "Answer questions using knowledge base. Only route to QUOTE if explicitly asked to calculate."
        valid_contexts:
          - quote  # Only allow routing to quote
          - objections
          - book
```

**Option C: Use Attention Timeout Wisely**

Current: `attention_timeout: 8000ms` (8 seconds)

This might be causing Barbara to rush. Consider:
- Increasing to `10000ms` (10 seconds) for senior callers
- Using `attention_timeout_prompt` more gently

```sql
UPDATE agent_params
SET 
  attention_timeout = 10000,
  attention_timeout_prompt = 'The caller may be thinking. Wait patiently. If still silent after 3 seconds, gently say: "I''m here whenever you''re ready."'
WHERE vertical = 'reverse_mortgage' AND is_active = true;
```

#### Use SignalWire's `transparent_barge` Parameter

Current setting: `transparent_barge: false`

This means the AI will respond when interrupted. Consider setting to `true`:

```sql
UPDATE agent_params
SET transparent_barge = true
WHERE vertical = 'reverse_mortgage' AND is_active = true;
```

**Effect:** When enabled, the AI won't respond to user input when they speak over Barbara, allowing callers more control over pacing.

#### Recommended Implementation

**1. Add confirmation prompt:**
```sql
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{instructions}',
  -- Add confirmation step before routing
)
WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'answer')
  AND is_active = true;
```

**2. Adjust timing parameters:**
```sql
UPDATE agent_params
SET 
  end_of_speech_timeout = 2500,  -- Give seniors more time
  attention_timeout = 10000,      -- Wait longer before prompting
  transparent_barge = true        -- Allow caller control
WHERE vertical = 'reverse_mortgage' AND is_active = true;
```

---

## Summary: Complete Fix Checklist

### Database Changes Required

1. **GREET Node** - Add identity confirmation
   ```sql
   UPDATE prompt_versions SET content = ...
   WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'greet')
   ```

2. **ANSWER Node** - Fix double-question and routing
   ```sql
   UPDATE prompt_versions SET content = ...
   WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'answer')
   ```

3. **Agent Parameters** - Adjust timing
   ```sql
   UPDATE agent_params SET
     end_of_speech_timeout = 2500,
     attention_timeout = 10000,
     transparent_barge = true
   WHERE vertical = 'reverse_mortgage'
   ```

### Testing Checklist

- [ ] Identity confirmed before property discussion
- [ ] Single questions asked with pauses for responses
- [ ] Fee questions stay in ANSWER context
- [ ] Calculation questions route to QUOTE correctly
- [ ] No premature routing to QUOTE
- [ ] Natural conversation pacing for senior callers

---

## SignalWire-Specific Features Used

1. **`start_hook` Reserved Function** - Load caller data on call start
2. **`end_of_speech_timeout`** - Control how long AI waits for speech
3. **`attention_timeout`** - Control how long before prompting unresponsive caller
4. **`transparent_barge`** - Allow caller to interrupt without AI responding
5. **`contexts.valid_contexts`** - Restrict which contexts can be transitioned to
6. **`wait_for_user` Parameter** - Force AI to wait for user input
7. **Variable Expansion** - `${caller_first_name}` in prompts
8. **SWAIG Actions** - `set_global_data`, `user_input` for flow control

---

## Next Steps

1. Review and approve these solutions
2. Update database records with new prompts and parameters
3. Test with similar scenario (Testy Mctesterson call)
4. Monitor `debug_webhook_url` for real-time conversation flow
5. Iterate based on results

