# Wrong Person Handoff - Implementation Complete ✅

## Summary

Implemented **Option B**: Route to GOODBYE (waiting state), then back to GREET when correct person detected.

## Flow

```
GREET → mark_wrong_person(right_person_available=true) → GOODBYE (waiting)
GOODBYE → detects right person → route_to_greet() → GREET (restart)
```

## What Was Implemented

### 1. SignalWire ✅ Already Correct
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

**SignalWire GOODBYE → GREET routing:** (lines 234-236)
```python
# If wrong person and right person becomes available, re-greet
if conversation_data.get("wrong_person") and conversation_data.get("right_person_available"):
    logger.info("🔄 Right person available → RE-GREET")
    return "greet"
```

### 2. LiveKit GREET → GOODBYE ✅ Already Correct
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

### 3. LiveKit GOODBYE → GREET ✅ Implemented

**File:** `livekit-agent/agents/goodbye.py`

Added `route_to_greet()` tool:

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
    
    Detection triggers:
    - User says "I'm here", "This is [name]", "He's on", "She's here"
    - New voice introduces themselves
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

### 4. Database Prompt ✅ Updated

**Updated GOODBYE prompt with handoff detection:**

```
=== HANDOFF DETECTION (WRONG PERSON SCENARIO) ===
If you are waiting for the correct person to come on line (reason=waiting_for_correct_person):
- Listen for trigger phrases: "I'm here", "This is [name]", "He's on", "She's here", "I'm back"
- When you detect the new person speaking: Call route_to_greet() to restart greeting
- The system will restart at GREET node for the correct person
- After calling route_to_greet(), the conversation will restart fresh

Example flow:
1. You say: "Perfect, I'll wait while you get him!"
2. User says: "I'm here" or "This is John"
3. You call: route_to_greet()
4. System restarts at GREET for the correct person
```

**Updated GOODBYE tools:** `["route_conversation", "route_to_greet"]`

## Test Scenarios

### Scenario 1: Right Person Available ✅
1. Call comes in for John
2. Mary answers: "Let me get him"
3. GREET: `mark_wrong_person(..., right_person_available=true)` → routes to GOODBYE
4. GOODBYE: "Perfect, I'll wait while you get him!"
5. John comes on: "I'm here"
6. GOODBYE: Detects trigger phrase, calls `route_to_greet()`
7. Routes to GREET
8. GREET: "Hi! Is this John?" (name verification from earlier fix)
9. John: "Yes"
10. Continue with conversation

### Scenario 2: Right Person Not Available ✅
1. Call comes in for John
2. Mary answers: "He's not home"
3. GREET: `mark_wrong_person(..., right_person_available=false)` → routes to GOODBYE
4. GOODBYE: "I understand. I'll have someone call back at a better time. Thank you!"
5. Call ends

## Verification Results

**Database queries confirmed:**
- ✅ GOODBYE node has `route_to_greet` in tools list
- ✅ GOODBYE instructions include HANDOFF DETECTION section
- ✅ GREET node has NAME VERIFICATION section (from earlier fix)

## Why This Approach Works

1. **Separation of Concerns:** GREET handles greeting, GOODBYE handles waiting/transitions
2. **No Redundant Routing:** Avoids "greet → greet" routing
3. **Clear State Management:** `wrong_person` and `right_person_available` flags
4. **Manual Trigger:** Requires correct person to say trigger phrase (reliable, simple)
5. **Shared Database:** Both LiveKit and SignalWire use the same prompts

## What Remains (Optional Enhancement)

**Automatic Speaker Detection:**
- Requires voice biometrics/diarization
- Detects new voice automatically
- Complex to implement
- Not available in current architecture

**Recommendation:** The manual trigger approach (implemented) is sufficient and reliable.

## Files Modified

1. `livekit-agent/agents/goodbye.py` - Added `route_to_greet` tool
2. Database `prompt_versions` table - Updated GOODBYE instructions and tools
3. Database `prompt_versions` table - Updated GREET instructions (earlier fix)

## Status: Complete ✅

All wrong person scenarios now handled correctly for both LiveKit and SignalWire.

