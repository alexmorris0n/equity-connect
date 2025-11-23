# Wrong Person Handoff Implementation

## Summary

Both LiveKit and SignalWire now use **Option B**: Route to GOODBYE, then back to GREET.

## Flow

```
GREET → mark_wrong_person(right_person_available=true) → GOODBYE (waiting)
GOODBYE → detects right person → route_to_greet → GREET (restart)
```

## What Was Fixed

### SignalWire ✅ Already Correct
**File:** `swaig-agent/services/routing.py` (lines 59-66)

```python
# Check if wrong person answered
if conversation_data.get("wrong_person"):
    if conversation_data.get("right_person_available"):
        logger.info("🔄 Wrong person, but right person available → GOODBYE (waiting)")
        return "goodbye"
    else:
        logger.info("🚪 Wrong person, not available → GOODBYE")
        return "goodbye"
```

Routes to GOODBYE (not back to GREET), which is correct.

### LiveKit ✅ Already Correct (GREET → GOODBYE)
**File:** `livekit-agent/agents/greet.py` (lines 220-228)

```python
if right_person_available:
    # Wait for handoff (handled in goodbye)
    return BarbaraGoodbyeAgent(
        caller_phone=self.caller_phone,
        lead_data=self.lead_data,
        vertical=self.vertical,
        reason="waiting_for_correct_person",
        chat_ctx=self.chat_ctx
    )
```

### LiveKit ❌ Missing: GOODBYE → GREET routing

**File:** `livekit-agent/agents/goodbye.py`

**Problem:** GOODBYE has `route_to_answer` but no `route_to_greet` for handoff scenarios.

**Solution:** Add `route_to_greet` tool to GOODBYE agent.

## Implementation

### Step 1: Add route_to_greet to LiveKit GOODBYE

Add this tool to `livekit-agent/agents/goodbye.py`:

```python
@function_tool()
async def route_to_greet(self, context: RunContext):
    """
    Route back to greet agent when the correct person comes on line.
    
    Call when:
    - Wrong person handoff complete
    - Correct person is now speaking
    - Need to restart greeting for the right person
    
    Example:
    - Wife answered → waiting → "I'm here!" (husband) → Call this tool
    """
    logger.info("Routing to greet - correct person now on line")
    
    # Clear wrong_person flag
    from services.conversation_state import update_conversation_state
    update_conversation_state(
        self.caller_phone,
        {
            "conversation_data": {
                "wrong_person": False,
                "handoff_complete": True
            }
        }
    )
    
    from .greet import BarbaraGreetAgent
    
    return BarbaraGreetAgent(
        caller_phone=self.caller_phone,
        lead_data=self.lead_data,
        vertical=self.vertical,
        chat_ctx=self.chat_ctx
    )
```

### Step 2: Update GOODBYE database prompt

Add handoff detection instructions to the GOODBYE prompt in the database:

```sql
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{instructions}',
  -- Add this section to existing GOODBYE instructions:
  to_jsonb((content->>'instructions')::text || E'\n\n' ||
  '=== HANDOFF DETECTION (WRONG PERSON SCENARIO) ===' || E'\n' ||
  'If you are waiting for the correct person to come on line:' || E'\n' ||
  '- Listen for trigger phrases: "I''m here", "This is [name]", "He''s on", "She''s here"' || E'\n' ||
  '- When you detect the new person: Call route_to_greet() to restart greeting' || E'\n' ||
  '- Say: "Hi! Is this [correct person name]?"' || E'\n' ||
  '- After confirmation, the system will restart at GREET for them')
)
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE node_name = 'goodbye' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND version_number = (
  SELECT current_version FROM prompts 
  WHERE node_name = 'goodbye' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
);

-- Add route_to_greet to goodbye tools
UPDATE prompt_versions
SET content = jsonb_set(
  content,
  '{tools}',
  COALESCE(
    CASE 
      WHEN content->>'tools' IS NULL THEN '[]'::jsonb
      WHEN content->>'tools'::text LIKE '%route_to_greet%' THEN content->'tools'
      ELSE (content->'tools' || '["route_to_greet"]'::jsonb)::jsonb
    END,
    '["route_to_answer", "route_to_greet"]'::jsonb
  )
)
WHERE prompt_id IN (
  SELECT id FROM prompts 
  WHERE node_name = 'goodbye' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND version_number = (
  SELECT current_version FROM prompts 
  WHERE node_name = 'goodbye' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
);
```

## Testing

### Test Scenario 1: Right Person Available
1. Call comes in for John
2. Mary answers: "Let me get him"
3. Agent: "No problem, I'll wait!"
4. John comes on: "I'm here"
5. Agent detects, calls `route_to_greet()`
6. Agent: "Hi! Is this John?"
7. John: "Yes"
8. Continue with conversation

### Test Scenario 2: Right Person Not Available
1. Call comes in for John
2. Mary answers: "He's not home"
3. Agent: "I understand. I'll have someone call back at a better time. Thank you!"
4. Call ends

## Status

- ✅ SignalWire: Routes to GOODBYE (correct)
- ✅ LiveKit GREET: Routes to GOODBYE (correct)
- ❌ LiveKit GOODBYE: Missing `route_to_greet` tool (needs implementation)
- ❌ Database: GOODBYE prompt missing handoff detection instructions

## Next Steps

1. Add `route_to_greet` tool to `livekit-agent/agents/goodbye.py`
2. Update GOODBYE database prompt with handoff detection instructions
3. Test both scenarios
4. Verify SignalWire also uses the updated database prompt

## Workaround vs. Full Solution

**Workaround (Manual Trigger):**
- Requires correct person to say trigger phrase
- Agent detects phrase and routes back to GREET
- Simple to implement, works reliably

**Full Solution (Automatic):**
- Requires speaker identification/diarization
- Detects new voice automatically
- Complex to implement, not available in current architecture

**Recommendation:** Implement workaround (manual trigger) for now.

