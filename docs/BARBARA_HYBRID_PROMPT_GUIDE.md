# Barbara Hybrid Prompt Architecture

## Overview

We've implemented a **single hybrid prompt** that handles both inbound and outbound calls, following OpenAI's Realtime API best practices. This eliminates prompt drift, reduces maintenance, and ensures consistent behavior.

## Key Benefits

### 1. **Single Source of Truth**
- ✅ ONE prompt file: `prompts/BarbaraRealtimePrompt`
- ✅ No drift between inbound/outbound versions
- ✅ Fix once, applies everywhere
- ✅ Easier testing and iteration

### 2. **OpenAI Realtime Best Practices**
Following [OpenAI's Realtime Prompting Guide](https://cookbook.openai.com/examples/realtime_prompting_guide):

- ✅ **Clear sections** with headers (Role, Personality, Context, Tools, etc.)
- ✅ **Bullet points** over paragraphs
- ✅ **Sample phrases** for the model to follow
- ✅ **Speed instructions** (natural pace without sounding rushed)
- ✅ **Variety rules** (avoid robotic repetition)
- ✅ **Reference pronunciations** (numbers to words)
- ✅ **Conversation flow as state machine** (Introduction → Permission → Qualification → Equity → Questions → Booking)
- ✅ **Safety & escalation** with clear triggers

### 3. **Conditional Logic**
The prompt uses `{{callContext}}` to determine flow:

```
# CALL TYPE DETECTION

**Call Type**: {{callContext}}

## IF OUTBOUND (you called them):
- WAIT FOR PICKUP: Listen for "Hello?" before speaking
- START: "Hi, is this {{leadFirstName}}?"

## IF INBOUND (they called you):
- They already know they're calling
- START IMMEDIATELY: "Hi! Thanks for calling..."
```

### 4. **Full Personalization**
27 variables injected for natural conversations:
- Lead name, city, address
- Property value, equity calculations (in words!)
- Broker name, company, NMLS
- Persona name (who sent the email)

## Architecture Flow

### Outbound Calls (n8n → Barbara MCP → Bridge)

```
n8n Workflow
  ↓
  Extracts 27 variables from lead record
  ↓
Barbara MCP
  ↓
  Builds customized prompt:
  - Replaces {{leadFirstName}} → "Testy"
  - Replaces {{propertyCity}} → "Inglewood"
  - Replaces {{callContext}} → "outbound"
  - Converts numbers to words
  ↓
Bridge
  ↓
  Stores customized prompt in pendingCalls
  ↓
AudioBridge
  ↓
  Uses custom instructions from n8n
  ↓
OpenAI Realtime
  ↓
  Barbara speaks with full personalization
```

### Inbound Calls (Direct → Bridge)

```
SignalWire Call
  ↓
Bridge
  ↓
  No custom instructions provided
  ↓
AudioBridge
  ↓
  Uses hybrid prompt with callContext="inbound"
  ↓
OpenAI Realtime
  ↓
  Barbara asks for name and qualifies lead
  ↓
  Uses tools to look up lead context
```

## Prompt Structure

Following OpenAI best practices, the prompt is organized into clear sections:

```
# ROLE & OBJECTIVE
Who Barbara is and what success means

# PERSONALITY & TONE
Voice, brevity, pacing, variety

# CALL TYPE DETECTION
Conditional logic for inbound vs outbound

# REFERENCE PRONUNCIATIONS
Number-to-words conversion rules

# CONTEXT
27 variables injected here

# INSTRUCTIONS
Core rules and do-nots

# CONVERSATION FLOW
State machine with 6 states:
1. Introduction & Build Rapport
2. Ask Permission
3. Qualification
4. Calculate & Present Equity
5. Handle Questions
6. Book Appointment

# OBJECTION HANDLING
Common objections with responses

# SPECIAL SITUATIONS
No response, voicemail, unclear audio

# SAFETY & ESCALATION
When and how to escalate

# TOOLS
search_knowledge, escalate_to_human, book_appointment
```

## Number-to-Words Conversion

**Critical for natural speech!** Barbara NEVER says digits.

Examples:
- `1500000` → "one point five million"
- `750000` → "seven hundred fifty thousand"
- `62` → "sixty-two"
- `50%` → "fifty percent"

The Barbara MCP automatically converts all numeric values before injecting them.

## Conversation Flow (State Machine)

Based on OpenAI's recommendation, we use a state machine approach:

```
State 1: Introduction & Build Rapport
  ↓
  Exit: Know their motivation
  ↓
State 2: Ask Permission
  ↓
  Exit: They agree to questions
  ↓
State 3: Qualification
  ↓
  Exit: All questions answered
  ↓
State 4: Calculate & Present Equity
  ↓
  Exit: Equity presented
  ↓
State 5: Handle Questions
  ↓
  Exit: No more questions
  ↓
State 6: Book Appointment
  ↓
  Exit: Appointment booked
```

Each state has:
- **Goal**: What to accomplish
- **Instructions**: How to accomplish it
- **Sample Phrases**: Examples for the model to follow
- **Exit Condition**: When to transition
- **Next State**: Where to go next

## Variable Mapping

### From n8n to Barbara MCP

| n8n Variable | Prompt Placeholder | Example |
|--------------|-------------------|---------|
| `lead_record.first_name` | `{{leadFirstName}}` | "Testy" |
| `lead_record.property_city` | `{{propertyCity}}` | "Inglewood" |
| `lead_record.property_value` | `{{propertyValueWords}}` | "one point two million" |
| `lead_record.estimated_equity` | `{{estimatedEquityWords}}` | "one million" |
| `persona_sender_name` | `{{personaSenderName}}` | "Carlos Rodriguez" |
| (extracted) | `{{personaFirstName}}` | "Carlos" |
| `lead_record.broker_contact_name` | `{{brokerFullName}}` | "Walter Richards" |
| (extracted) | `{{brokerFirstName}}` | "Walter" |
| `'outbound'` | `{{callContext}}` | "outbound" |

### Handlebars-Style Conditionals

The prompt uses conditional logic:

```
{{#if propertyCity}}
"Oh, {{propertyCity}} is a wonderful area!"
{{/if}}

{{#if personaFirstName}}
"{{personaFirstName}} let me know you reached out."
{{else}}
"One of our advisors let me know you reached out."
{{/if}}
```

Barbara MCP processes these before sending to the bridge.

## Bypassing Bridge Lookup

For outbound calls, we already have all lead data from n8n. Instead of having the bridge look it up again:

**Before:**
```javascript
// Bridge looked up lead from database
const leadContext = await executeTool('get_lead_context', { phone });
```

**After:**
```javascript
// Use provided context OR fallback to lookup
if (lead_context && lead_context.broker) {
  // Use provided context (more efficient)
  leadRecord = lead_context;
} else {
  // Fallback: Look up from database (inbound calls)
  const leadContext = await executeTool('get_lead_context', { phone });
  leadRecord = leadContext;
}
```

This saves a database query and is faster!

## Example Call Flow

### Outbound Call to Testy McTesterson

**n8n extracts:**
```json
{
  "lead_first_name": "Testy",
  "property_city": "Inglewood",
  "property_value": "1200000",
  "estimated_equity": "1000000",
  "persona_sender_name": "Carlos Rodriguez",
  "broker_full_name": "Walter Richards",
  "call_context": "outbound"
}
```

**Barbara MCP builds prompt:**
```
Call Type: outbound

Lead Information:
- Lead Name: Testy McTesterson
- City: Inglewood, CA

Property Details:
- Estimated Value: one point two million
- Estimated Equity: one million
  - 50% Access: five hundred thousand
  - 60% Access: six hundred thousand

Advisor Information:
- Advisor: Walter Richards
- Company: My Reverse Options

Campaign Context:
- Email Persona: Carlos Rodriguez (use first name: Carlos)
```

**Barbara speaks:**
```
[waits for "Hello?"]

Testy: Hello?

Barbara: Hi, is this Testy?

Testy: Yes.

Barbara: Great! Carlos let me know you reached out about learning 
more about reverse mortgages. I'm here to help connect you with 
Walter Richards. How's your day going?

Testy: Good, thanks.

Barbara: Oh, Inglewood is a wonderful area! How long have you been there?

[continues with natural, personalized conversation...]
```

## Testing

### Test Outbound Call

```bash
# Call Barbara MCP
curl -X POST https://barbara-mcp.northflank.app/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_outbound_call",
      "arguments": {
        "to_phone": "+16505300051",
        "lead_id": "test-lead-123",
        "lead_first_name": "Testy",
        "property_city": "Inglewood",
        "property_value": "1200000",
        "estimated_equity": "1000000",
        "persona_sender_name": "Carlos Rodriguez",
        "broker_full_name": "Walter Richards",
        "broker_company": "My Reverse Options",
        "call_context": "outbound"
      }
    }
  }'
```

Expected logs:
```
📝 Built customized prompt (length: ~7500 chars)
✅ Call created successfully
📞 Call ID: xxx
```

### Test Inbound Call

```bash
# Just call the SignalWire number
# Bridge uses hybrid prompt with callContext="inbound"
```

Expected behavior:
```
Barbara: Hi! Thanks for calling. Who do I have the pleasure of speaking with?

[Barbara qualifies lead using tools]
```

## Maintenance

### To Update Barbara's Behavior

1. Edit `prompts/BarbaraRealtimePrompt`
2. Test with both inbound and outbound calls
3. Deploy (Barbara MCP and Bridge both read from same file)

### Common Updates

**Change greeting:**
```diff
- "Hi, is this {{leadFirstName}}?"
+ "Hey {{leadFirstName}}, this is Barbara!"
```

**Add new objection:**
```markdown
## "I'm worried about fees"
Use search_knowledge("costs fees origination") then explain:
"Most costs are rolled into the loan, so there's no upfront payment required."
```

**Adjust qualification questions:**
```diff
- "What would you like to use the money for?"
+ "How are you hoping to use your home equity?"
```

Changes apply to **both inbound and outbound** automatically!

## Files Modified

- ✅ `prompts/BarbaraRealtimePrompt` - New hybrid prompt
- ✅ `barbara-mcp/index.js` - Uses hybrid prompt with variable injection
- ✅ `bridge/audio-bridge.js` - Uses hybrid prompt for inbound, custom for outbound
- ✅ `bridge/server.js` - Accepts `lead_context` to bypass lookup

## Benefits Summary

| Before | After |
|--------|-------|
| 2 separate prompts | 1 hybrid prompt |
| Manual sync required | Single source of truth |
| Potential drift | No drift possible |
| 2x testing needed | Test once |
| Bridge always looks up lead | Lookup only when needed |
| Generic inbound flow | Personalized for both |

## Next Steps

1. Update n8n workflow to use Barbara MCP (see `BARBARA_OUTBOUND_INTEGRATION.md`)
2. Test with sample lead
3. Monitor calls for quality
4. Iterate on prompt based on real conversations

## Resources

- [OpenAI Realtime Prompting Guide](https://cookbook.openai.com/examples/realtime_prompting_guide)
- Hybrid Prompt: `prompts/BarbaraRealtimePrompt`
- Integration Guide: `docs/BARBARA_OUTBOUND_INTEGRATION.md`

