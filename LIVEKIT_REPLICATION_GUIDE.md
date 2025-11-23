# LiveKit Replication Guide - Phase 3 Fixes

## Overview
This guide shows exactly how to replicate the 2 fixes from SignalWire to LiveKit.

---

## ✅ Fix #1: Late Disqualification in QUOTE

### What It Does:
Allows QUOTE agent to disqualify leads when they reveal disqualifying info (e.g., "actually it's a rental property")

### SignalWire Changes → LiveKit Equivalent

#### 1. Routing Logic
**SignalWire:** `swaig-agent/services/routing.py` - `route_after_quote()`
**LiveKit:** `livekit-agent/agents/quote.py` - Update the routing method or `on_enter()` check

**SignalWire Code:**
```python
async def route_after_quote(state: Dict[str, Any]) -> str:
    conversation_data = state.get('conversation_data', {})
    qualified = state.get('qualified')
    
    # Check for late disqualification FIRST
    if qualified == False:
        logger.info("🚫 Late disqualification discovered in quote → GOODBYE")
        return "goodbye"
    
    # ... rest of routing
```

**LiveKit Equivalent Location:**
`livekit-agent/agents/quote.py`

**LiveKit Implementation:**
```python
# In BarbaraQuoteTask class, add to routing logic:

# After quote is presented, check for late disqualification
state = await cs_get_state(self.caller_phone)
qualified = state.get('qualified')

if qualified == False:
    logger.info("🚫 Late disqualification discovered → GOODBYE")
    return BarbaraGoodbyeAgent(
        room=self.room,
        caller_phone=self.caller_phone,
        vertical=self.vertical,
        components=self.components
    )
```

---

#### 2. Add Tool to QUOTE
**SignalWire:** Added `mark_qualification_result` to QUOTE tools in database
**LiveKit:** Add the tool to `BarbaraQuoteTask` class

**SignalWire Database:**
```json
"tools": [
  "calculate_reverse_mortgage",
  "mark_quote_presented",
  "mark_qualification_result",  // <-- ADDED THIS
  "update_lead_info",
  "route_conversation"
]
```

**LiveKit Equivalent:**
Add this tool to `livekit-agent/agents/quote.py`:

```python
from livekit.agents import function_tool
from services.conversation_state import update_conversation_state

# Add this as a method in BarbaraQuoteTask class:

@function_tool
async def mark_qualification_result(self, qualified: bool, reason: str) -> str:
    """
    Mark qualification status - used for late disqualification
    
    Args:
        qualified: Whether the caller qualifies (typically false for late disq)
        reason: Disqualification reason (age_below_62, non_primary_residence, 
                not_homeowner, insufficient_equity)
    """
    phone = self.caller_phone.replace('+1', '').replace('+', '')
    
    # Update qualified status in conversation_state
    await update_conversation_state(phone, {
        'qualified': qualified,
        'conversation_data': {
            'disqualified': not qualified,
            'disqualification_reason': reason if not qualified else None
        }
    })
    
    # Also update leads table
    supabase.table('leads').update({
        'qualified': qualified
    }).eq('primary_phone_e164', f'+{phone}').execute()
    
    logger.info(f"[QUOTE] Marked qualified={qualified}, reason={reason} for {phone}")
    
    return f"Qualification status updated: {'qualified' if qualified else 'disqualified'}"
```

---

#### 3. Update QUOTE Prompt
**SignalWire:** Updated database prompt with disqualification detection section
**LiveKit:** Update database prompt for QUOTE node

**What to Add:**
Add this section to the QUOTE prompt in the database:

```
=== DETECTING LATE DISQUALIFICATION (CRITICAL) ===
While collecting information or presenting the quote, the user may reveal disqualifying information that wasn't caught in QUALIFY.

Late disqualification triggers:
- "Actually, it's a rental property" → Non-primary residence
- "I rent it out to tenants" → Investment property, not primary residence
- "I'm only 58" or "I'm 60" → Under age 62 requirement
- "I don't own it, I'm renting" → Not a homeowner
- "The bank owns it, I'm underwater" → No equity

When you detect late disqualification:
1. Stop the quote process immediately
2. Call mark_qualification_result with qualified=false and reason for disqualification
3. Be empathetic: "I understand. Unfortunately, reverse mortgages require [requirement]. I wish I had better news."
4. The system will automatically route to GOODBYE

Disqualification reasons:
- "age_below_62" - Must be 62 or older
- "non_primary_residence" - Must be primary residence, not rental/investment
- "not_homeowner" - Must own the property
- "insufficient_equity" - Must have meaningful equity
```

**How to Apply:**
```sql
UPDATE prompt_versions 
SET content = jsonb_set(
    content,
    '{instructions}',
    -- Add the section above to existing instructions
)
WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'quote' AND vertical = 'reverse_mortgage')
  AND version_number = (current version number);
```

---

## ✅ Fix #2: Skip to QUOTE from GREET

### What It Does:
Allows unqualified leads who ask "how much?" immediately to skip to QUOTE without verification first

### SignalWire Changes → LiveKit Equivalent

#### 1. Routing Logic
**SignalWire:** `swaig-agent/services/routing.py` - `route_after_greet()`
**LiveKit:** `livekit-agent/agents/greet.py` - Update routing in the `Agent` class

**SignalWire Code:**
```python
async def route_after_greet(state: Dict[str, Any]) -> str:
    conversation_data = state.get('conversation_data', {})
    qualified = state.get('qualified')
    
    # EXCEPTION 1: Objections first
    if conversation_data.get("has_objection"):
        return "objections"
    
    # EXCEPTION 2: Check for immediate calculation questions
    if conversation_data.get("asked_about_amount"):
        logger.info("💰 EXCEPTION: Calculation question during greet → QUOTE")
        return "quote"
    
    # ... rest of routing (verify/qualify checks)
```

**LiveKit Equivalent Location:**
`livekit-agent/agents/greet.py` - Inside `BarbaraGreetAgent` class

**LiveKit Implementation:**
```python
# In BarbaraGreetAgent class, update the routing method:

async def _route_after_greet(self) -> Agent:
    """Route to next agent based on conversation state"""
    
    state = await cs_get_state(self.caller_phone)
    conversation_data = state.get('conversation_data', {})
    qualified = state.get('qualified')
    
    # EXCEPTION 1: Objections can skip verify/qualify
    if conversation_data.get("has_objection"):
        logger.info("⚠️ EXCEPTION: Objection raised during greet → OBJECTIONS")
        return BarbaraObjectionsTask(
            room=self.room,
            caller_phone=self.caller_phone,
            vertical=self.vertical,
            components=self.components
        )
    
    # EXCEPTION 2: Immediate calculation questions can skip verify/qualify
    if conversation_data.get("asked_about_amount"):
        logger.info("💰 EXCEPTION: Calculation question during greet → QUOTE")
        return BarbaraQuoteTask(
            room=self.room,
            caller_phone=self.caller_phone,
            vertical=self.vertical,
            components=self.components
        )
    
    # Check verified status
    if conversation_data.get("verified"):
        if qualified:
            if not conversation_data.get("quote_presented"):
                return BarbaraQuoteTask(...)
            else:
                return BarbaraAnswerAgent(...)
        else:
            return BarbaraQualifyTask(...)
    
    # Default: verify
    return BarbaraVerifyTask(...)
```

---

#### 2. Add Tool to GREET (if not already there)
**SignalWire:** Added `route_conversation` tool (but LiveKit uses Python routing, not tools)
**LiveKit:** No tool needed - routing is done in Python code

**NOTE:** LiveKit doesn't need a tool for this because routing happens in Python. The agent can detect the flag and route directly.

---

#### 3. Detect Calculation Questions in GREET
**SignalWire:** LLM sets `asked_about_amount` flag via `route_conversation` tool
**LiveKit:** LLM needs a way to signal calculation question detected

**Option A: Use existing `route_to_quote` tool if it exists**

Check if `livekit-agent/agents/greet.py` has a `route_to_quote` function tool. If not, add:

```python
# In BarbaraGreetAgent class:

@function_tool
async def route_to_quote(self) -> str:
    """
    Signal that user asked a calculation question and should route to QUOTE
    Use this when caller asks: "How much can I get?", "What's the loan amount?", etc.
    """
    phone = self.caller_phone.replace('+1', '').replace('+', '')
    
    # Set flag in conversation_data
    await update_conversation_state(phone, {
        'conversation_data': {
            'asked_about_amount': True
        }
    })
    
    logger.info(f"[GREET] Calculation question detected for {phone} → Will route to QUOTE")
    
    return "I'll calculate that for you..."
```

**Option B: Detect in real-time via transcript analysis (more complex)**

If LiveKit has real-time transcript analysis, you could detect calculation keywords without a tool. But Option A is simpler.

---

#### 4. Update GREET Prompt
**SignalWire:** Updated database prompt with calculation detection section
**LiveKit:** Update database prompt for GREET node

**What to Add:**
Add this section to the GREET prompt in the database:

```
=== DETECTING CALCULATION QUESTIONS (EXCEPTION) ===
If the caller immediately asks about loan amounts or calculations during greeting, you can route them to QUOTE before verification/qualification.

Calculation question triggers:
- "How much can I get?"
- "What's the loan amount?"
- "How much money is available?"
- "Can you calculate my reverse mortgage?"
- "What would my numbers be?"

When you detect an immediate calculation question:
1. Say: "Let me get those numbers for you..."
2. Call route_to_quote() immediately
3. The system will route to QUOTE to calculate (will qualify after if needed)

This is an EXCEPTION - normally we verify first, but if they just want numbers, we can provide that immediately.
```

**How to Apply:**
```sql
UPDATE prompt_versions 
SET content = jsonb_set(
    content,
    '{instructions}',
    -- Append the section above to existing instructions
)
WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'greet' AND vertical = 'reverse_mortgage')
  AND version_number = (current version number);
```

---

## 📋 Summary Checklist for LiveKit

### Fix #1: Late Disqualification in QUOTE
- [ ] Add routing check for `qualified=False` in `quote.py`
- [ ] Add `mark_qualification_result()` tool to `BarbaraQuoteTask`
- [ ] Update QUOTE database prompt with disqualification detection section
- [ ] Test: User says "actually it's a rental" during quote → Routes to GOODBYE

### Fix #2: Skip to QUOTE from GREET  
- [ ] Update `_route_after_greet()` to check `asked_about_amount` flag
- [ ] Add `route_to_quote()` tool to `BarbaraGreetAgent` (if not exists)
- [ ] Update GREET database prompt with calculation detection section
- [ ] Test: User asks "how much?" immediately → Routes to QUOTE (skips VERIFY)

---

## 🔍 Key Differences: SignalWire vs LiveKit

| Aspect | SignalWire | LiveKit |
|--------|-----------|---------|
| **Routing** | Centralized in `routing.py` | Distributed across agent classes |
| **Tools** | Uses `route_conversation` tool | Uses Python `return AgentClass()` |
| **State** | `conversation_data` and top-level fields | Same structure |
| **Prompts** | Database-driven | Database-driven (same) |

---

## 📂 Files to Modify in LiveKit

1. **`livekit-agent/agents/quote.py`**
   - Add `mark_qualification_result()` tool
   - Add routing check for `qualified=False`

2. **`livekit-agent/agents/greet.py`**
   - Update `_route_after_greet()` method
   - Add `route_to_quote()` tool (if not exists)

3. **Database (via SQL or Supabase UI)**
   - Update GREET prompt: Add calculation detection section
   - Update QUOTE prompt: Add late disqualification section

---

## ⚠️ Important Notes

1. **LiveKit routing is Python-based** - No `route_conversation` tool needed. Just return the correct Agent class.

2. **Tool registration** - Make sure any new tools are registered with the session. LiveKit auto-detects `@function_tool` decorators.

3. **State management** - LiveKit uses the same `conversation_state` table as SignalWire, so state updates are compatible.

4. **Testing** - Test both scenarios after implementation:
   - Late disqualification: User reveals rental during QUOTE
   - Skip to quote: User asks "how much?" during GREET

---

**Ready to implement? Start with Fix #1 (Late Disqualification) - it's simpler and has clear boundaries.**


