# CALLER INFORMATION Injection - Complete Guide

## What Gets Injected to Barbara

When Barbara gets a call, the `get_lead_context` tool pulls rich data and injects it as CALLER INFORMATION.

---

## Complete Injection Structure

```javascript
CALLER INFORMATION:
{
  // Basic lead data
  lead_id: "abc-123-def-456",
  broker_id: "broker-uuid",
  first_name: "John",
  last_name: "Smith",
  primary_email: "john.smith@gmail.com",
  primary_phone: "+16505300051",
  
  // Property data
  property_city: "San Francisco",
  property_state: "CA",
  property_value: 1500000,
  mortgage_balance: 200000,
  estimated_equity: 1300000,
  age: 68,
  status: "contacted",
  
  // Broker data
  broker: {
    contact_name: "Walter Richards",
    company_name: "My Reverse Options",
    email: "walter@example.com",
    phone: "+16505300051",
    nmls_number: "12345"
  },
  
  // LAST CALL CONTEXT (NEW!)
  last_call: {
    money_purpose: "medical",
    specific_need: "Husband needs heart surgery - $75k",
    amount_needed: 75000,
    timeline: "urgent",
    objections: ["fees_concern", "spouse_approval"],
    questions_asked: ["Can I leave house to kids?", "What are monthly costs?"],
    key_details: ["Retiring in 6 months", "Wife name is Mary"],
    appointment_scheduled: false,
    last_outcome: "interested"
  },
  
  // Formatted context (for speaking)
  context: {
    leadName: "John",
    brokerFirstName: "Walter",
    propertyCity: "San Francisco",
    homeValueWords: "one point five million dollars",
    mortgageBalanceWords: "two hundred thousand dollars",
    equityWords: "one point three million dollars",
    potentialAccessRange: "six hundred fifty thousand to seven hundred eighty thousand dollars"
  }
}
```

---

## How Barbara Uses This

### First Call (No Last Call Context)
**CALLER INFORMATION:**
```javascript
last_call: {
  money_purpose: null,
  specific_need: null,
  objections: [],
  questions_asked: [],
  key_details: []
}
```

**Barbara says:**
- "Hi John! What got you interested in learning more about reverse mortgages?"
- (Asks all qualifying questions)

**Barbara logs:**
```javascript
save_interaction({
  metadata: {
    money_purpose: "medical",
    specific_need: "Husband needs surgery - $75k",
    objections: ["fees_concern"],
    // ... etc
  }
})
```

---

### Second Call (Has Last Call Context)
**CALLER INFORMATION:**
```javascript
last_call: {
  money_purpose: "medical",
  specific_need: "Husband needs heart surgery - $75k",
  amount_needed: 75000,
  timeline: "urgent",
  objections: ["fees_concern"],
  questions_asked: ["Can I leave house to kids?"],
  key_details: ["Wife name is Mary"],
  appointment_scheduled: false,
  last_outcome: "interested"
}
```

**Barbara says:**
- "Hi John! I know you mentioned your husband needs heart surgery last time. Is that still the situation?"
- "You said the fees were a concern. Let me be very specific about how they work..."
- "I know you wanted to talk to Mary about this. Were you able to discuss it?"

**Barbara SKIPS:**
- ✅ Asking what they need money for (already knows: medical)
- ✅ Asking how much they need (already knows: $75k)
- ✅ Re-explaining things they already asked about

---

## Prompt Instructions for Using This

### In "Build Rapport" Section:
```markdown
**Check LAST CALL CONTEXT:**
- **If purpose already known:** "I know you mentioned needing help with [specific_need from last call]. Is that still the situation?"
- **If purpose NOT known:** "What got you interested in learning more about reverse mortgages?"
```

### In "Gather Missing Information" Section:
```markdown
**CRITICAL - Check CALLER INFORMATION first:**
- Some questions may ALREADY be answered (from last_call)
- Check last_call.money_purpose, objections, etc.
- **SKIP questions you already have answers for**
```

### In "Objection Handling" Section:
```markdown
**CRITICAL:** If last_call.objections shows they already raised this objection, acknowledge: 
"I know you mentioned [objection] last time. Let me address that directly..."
```

---

## Implementation Flow

### Step 1: Call Starts
Barbara receives phone number from SignalWire

### Step 2: Get Lead Context
`get_lead_context({ phone: "+16505300051" })`

**Returns:**
- Lead data
- Broker data
- **Last call metadata** ← NEW!

### Step 3: Inject CALLER INFORMATION
System message sent to Barbara with all data

### Step 4: Barbara Personalizes
Barbara uses last_call data to:
- Skip redundant questions
- Reference previous objections
- Build on previous conversation
- Be contextually aware

### Step 5: Barbara Logs
At end of call, Barbara calls:
`save_interaction({ metadata: { ... } })`

### Step 6: Next Call Uses This
Next time John calls, Barbara gets his metadata and cycle repeats

---

## Complete Code Flow

```
Lead calls → audio-bridge.js
    ↓
get_lead_context({ phone })
    ↓
Query Supabase:
  - Get lead data
  - Get broker data
  - Get last interaction (with metadata) ← NEW!
    ↓
Return to Barbara:
  {
    lead_id,
    broker,
    last_call: { metadata from last interaction },
    context: { formatted values }
  }
    ↓
Barbara personalizes conversation
    ↓
Barbara logs call with save_interaction({ metadata })
    ↓
Saved to Supabase for next call
```

---

## What's Now Working

### ✅ Database
- `interactions.metadata` column exists (JSONB)
- Stores rich call context

### ✅ Save Function
- `saveInteraction()` updated to capture comprehensive metadata
- Saves: purpose, needs, objections, questions, details, appointments, verification, commitment

### ✅ Retrieval Function
- `get_lead_context()` updated to pull last interaction metadata
- Returns: last_call object with all previous context

### ✅ Prompt
- Instructions updated to use last_call fields
- Shows how to personalize based on previous calls
- Skip redundant questions

---

## Example Personalization

### Lead's First Call:
**Barbara:** "What got you interested in reverse mortgages?"  
**Lead:** "I need money for my husband's surgery."  
**Barbara logs:** `{ money_purpose: "medical", specific_need: "Husband needs surgery" }`

### Lead's Second Call:
**CALLER INFORMATION includes:**
```javascript
last_call: {
  money_purpose: "medical",
  specific_need: "Husband needs surgery"
}
```

**Barbara:** "Hi John! I know you mentioned your husband needs surgery. Is that still the situation?"

**Lead:** "Yes, and it's urgent now - we need $75k."

**Barbara logs:** `{ money_purpose: "medical", specific_need: "Husband needs surgery - $75k", amount_needed: 75000, timeline: "urgent" }`

### Lead's Third Call:
**CALLER INFORMATION includes:**
```javascript
last_call: {
  money_purpose: "medical",
  specific_need: "Husband needs surgery - $75k",
  amount_needed: 75000,
  timeline: "urgent",
  objections: ["fees_concern"]
}
```

**Barbara:** "Hi John! I know your husband's surgery is urgent and you need that $75k. I also know the fees were a concern last time. Let me walk you through exactly how they work..."

---

## Result

**Every call builds on the last one:**
- ✅ No redundant questions
- ✅ Contextually aware
- ✅ Addresses previous objections
- ✅ Feels like continuation, not new call
- ✅ Higher trust, better conversion

**Barbara remembers everything!** 🧠

---

## Files Updated

1. ✅ `bridge/tools.js` - `get_lead_context()` now pulls last call metadata
2. ✅ `bridge/tools.js` - `saveInteraction()` captures rich metadata
3. ✅ `prompts/old big buitifl promtp.md` - Shows available last_call fields

**Ready to commit and push!** 🚀
