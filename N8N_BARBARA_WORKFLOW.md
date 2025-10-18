# n8n Barbara Voice Call Workflow

Complete n8n workflow for triggering Barbara voice calls with personalized prompts.

---

## Workflow Overview

```
[1. Webhook Trigger] 
    ↓
[2. Get Lead Data] (Supabase query)
    ↓
[3. Get Broker Data] (Supabase query)
    ↓
[4. Build Barbara Instructions] (Code node)
    ↓
[5. Start Voice Call] (HTTP Request to bridge)
    ↓
[6. Log Call Initiated] (Supabase insert)
```

---

## Node 1: Webhook Trigger

**Trigger:** Webhook  
**Path:** `/webhook/start-barbara-call`  
**Method:** POST  

**Expected payload:**
```json
{
  "lead_id": "uuid-here",
  "trigger_source": "email_reply"
}
```

---

## Node 2: Get Lead Data

**Node Type:** Supabase  
**Operation:** Get Rows  
**Table:** `leads`  

**Filter:**
```
id = {{$json.lead_id}}
```

**Fields to Return:**
- `id`
- `first_name`
- `last_name`
- `primary_phone`
- `property_address`
- `property_city`
- `property_state`
- `property_value`
- `estimated_equity`
- `age`
- `assigned_broker_id`
- `assigned_phone_number`

---

## Node 3: Get Broker Data

**Node Type:** Supabase  
**Operation:** Get Rows  
**Table:** `brokers`

**Filter:**
```
id = {{$node["Get Lead Data"].json.assigned_broker_id}}
```

**Fields to Return:**
- `id`
- `full_name` (or `contact_name`)
- `company_name`
- `nmls_number`

---

## Node 4: Build Barbara Instructions (CODE NODE)

**Node Type:** Code  
**Mode:** Run Once for All Items

```javascript
// Get data from previous nodes
const lead = $('Get Lead Data').item.json;
const broker = $('Get Broker Data').item.json;

// === HELPER FUNCTIONS ===

// Clean text (remove newlines, extra spaces)
const cleanText = (text) => {
  if (!text) return "";
  return String(text)
    .replace(/[\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Format currency for TTS (say words, not symbols)
const formatCurrency = (num) => {
  if (!num || isNaN(num)) return "an estimated amount";
  
  const amount = Math.round(num);
  if (amount >= 1000000) {
    const millions = (amount / 1000000).toFixed(1);
    return `${millions} million dollars`;
  } else if (amount >= 1000) {
    const thousands = Math.round(amount / 1000);
    return `${thousands} thousand dollars`;
  }
  return `${amount} dollars`;
};

// === EXTRACT & CLEAN DATA ===

const firstName = cleanText(lead.first_name) || "there";
const lastName = cleanText(lead.last_name) || "";
const propertyAddress = cleanText(lead.property_address) || "your property";
const propertyCity = cleanText(lead.property_city) || "your area";
const propertyState = cleanText(lead.property_state) || "";

const brokerName = cleanText(broker.contact_name || broker.full_name) || "your mortgage specialist";
const brokerCompany = cleanText(broker.company_name) || "our company";
const brokerNMLS = cleanText(broker.nmls_number) || "licensed";

const propertyValue = formatCurrency(lead.property_value);
const estimatedEquity = formatCurrency(lead.estimated_equity);

// === BUILD PROMPT ===

// STATIC PART (gets cached by OpenAI after first call)
const STATIC_PROMPT = `You are Barbara, a warm and empathetic reverse mortgage specialist.

CONVERSATION STYLE:
- Warm, grandmotherly tone
- Listen 70%, talk 30%
- Keep responses under 30 seconds
- Ask one question at a time
- Natural language, never robotic

CRITICAL TTS RULES:
- Say "four hundred thousand dollars" NOT "$400,000"
- Say "sixty two years old" NOT "62"
- Say "three and a half percent" NOT "3.5%"

CONVERSATION FLOW:
1. Verify: "Hi [name], is this a good time?"
2. Understand WHY: "What got you interested?"
3. Connect to goal: "Your equity could help with that..."
4. Brief explanation: "No monthly payments, keep your home..."
5. Offer consultation: "Let me have [broker] call you..."

OBJECTION HANDLING:
- "Scam?" → Licensed broker, NMLS verifiable
- "Lose home?" → You keep ownership, no payments
- "Kids' inheritance?" → Options to protect equity
- "Not sure..." → Just information, no obligation

IF NOT INTERESTED: Thank them, hang up gracefully

MAXIMUM: 5 minutes total

YOUR TOOLS:
- get_lead_context: Get lead info
- save_interaction: Log call outcome
- book_appointment: Schedule consultation
- update_lead_info: Update missing data
- check_consent_dnc: Verify permission`;

// DYNAMIC PART (changes per lead, appended to static)
const DYNAMIC_CONTEXT = `

=== CURRENT CALL CONTEXT ===

Lead:
- Name: ${firstName} ${lastName}
- Property: ${propertyAddress}, ${propertyCity}, ${propertyState}
- Home value: ${propertyValue}
- Available equity: ${estimatedEquity}
- Age: ${lead.age || "not specified"}

Broker:
- Name: ${brokerName}
- Company: ${brokerCompany}
- NMLS: ${brokerNMLS}

Opening: "Hi ${firstName}, this is Barbara from ${brokerCompany}. You reached out about your home in ${propertyCity}. Do you have a quick minute to chat?"

Remember: Focus on their WHY. Listen more than talk.`;

// COMBINE
const fullInstructions = STATIC_PROMPT + DYNAMIC_CONTEXT;

// === RETURN ===

return {
  instructions: fullInstructions,
  to: lead.primary_phone,
  from: lead.assigned_phone_number,
  lead_id: lead.id,
  broker_id: broker.id
};
```

---

## Node 5: Start Voice Call (HTTP REQUEST)

**Node Type:** HTTP Request  
**Method:** POST  
**URL:** `https://your-bridge.northflank.app/start-call`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body (JSON):**
```json
{
  "to": "{{$json.to}}",
  "from": "{{$json.from}}",
  "lead_id": "{{$json.lead_id}}",
  "broker_id": "{{$json.broker_id}}",
  "instructions": "{{$json.instructions}}"
}
```

**Response:**
```json
{
  "success": true,
  "callSid": "CA1234...",
  "callId": "uuid...",
  "to": "+1XXXXXXXXXX",
  "from": "+1YYYYYYYYYY",
  "status": "queued"
}
```

---

## Node 6: Log Call Initiated (SUPABASE)

**Node Type:** Supabase  
**Operation:** Insert Rows  
**Table:** `interactions`

**Data to Insert:**
```json
{
  "lead_id": "{{$node['Get Lead Data'].json.id}}",
  "broker_id": "{{$node['Get Broker Data'].json.id}}",
  "type": "ai_call",
  "direction": "outbound",
  "subject": "Barbara AI Call - Outbound",
  "content": "Call initiated via n8n workflow",
  "metadata": {
    "call_sid": "{{$json.callSid}}",
    "call_id": "{{$json.callId}}",
    "trigger_source": "{{$node['Webhook'].json.trigger_source}}"
  },
  "created_at": "={{$now}}"
}
```

---

## How It Works

### 1. n8n Builds Custom Prompt

Static part (cached by OpenAI):
- Barbara's personality
- Conversation rules
- TTS formatting rules
- Tool descriptions

Dynamic part (personalized):
- Lead name, address, property value
- Broker name, company, NMLS
- Custom opening line
- Context-specific guidance

### 2. Bridge Receives Call Request

```
POST /start-call
{
  "to": "+14155556565",
  "from": "+14155551234",
  "lead_id": "uuid-123",
  "broker_id": "uuid-456",
  "instructions": "You are Barbara... [FULL PROMPT]"
}
```

### 3. Bridge Stores Context

```javascript
pendingCalls.set(callId, {
  to, from, lead_id, broker_id,
  instructions: "You are Barbara..." // ← Custom prompt
});
```

### 4. SignalWire Dials Lead

Bridge → SignalWire REST API → Calls lead

### 5. Lead Answers

SignalWire → GET `/public/outbound-xml?callId=xyz`  
Returns: `<Connect><Stream url="wss://bridge/audiostream?callId=xyz" />`

### 6. WebSocket Connects

```javascript
// Bridge retrieves context
const context = pendingCalls.get(callId);

// Connects to OpenAI with custom instructions
openai.send({
  type: 'session.update',
  session: {
    instructions: context.instructions // ← n8n's custom prompt
  }
});
```

### 7. Barbara Talks

OpenAI uses the personalized prompt from n8n!

---

## Benefits of This Approach

### 1. OpenAI Prompt Caching
**Static part** gets cached after first call:
- 50% cost reduction on repeated static content
- Faster session initialization
- Same Barbara personality across all calls

**Dynamic part** changes per lead:
- Personalized greetings
- Lead-specific context
- Broker information

### 2. Easy Prompt Updates
Update Barbara's personality in n8n without redeploying bridge:
- Change conversation style
- Update objection handling
- Modify opening lines
- A/B test different approaches

### 3. Full Control from n8n
All call logic in one place:
- Lead qualification in n8n
- Prompt building in n8n
- Call triggering in n8n
- Post-call workflows in n8n

### 4. Bridge Stays Simple
Bridge just relays:
- No prompt logic
- No lead lookups (n8n does it)
- Just audio streaming + tools

---

## Testing the Workflow

### Manual Test (via Webhook)

```bash
curl -X POST https://your-n8n.northflank.app/webhook/start-barbara-call \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "your-test-lead-uuid",
    "trigger_source": "manual_test"
  }'
```

### Expected Flow

1. n8n receives webhook ✓
2. Fetches lead + broker data ✓
3. Builds custom prompt ✓
4. Calls bridge `/start-call` ✓
5. Your phone rings ✓
6. Barbara greets you with personalized prompt ✓
7. Can have conversation ✓
8. Call logged to Supabase ✓

---

## Troubleshooting

### Issue: Call placed but no audio

**Check:**
- Bridge logs show "Retrieved call context from n8n"
- Instructions were passed in `/start-call` request

**Fix:**
- Verify `instructions` field in HTTP Request node body
- Check bridge logs: `customInstructions: true`

### Issue: Barbara uses wrong prompt

**Check:**
- n8n Code node output has `instructions` field
- Instructions are being passed to HTTP Request node

**Fix:**
- Test Code node output (click "Execute Node")
- Verify `{{$json.instructions}}` resolves correctly

### Issue: Static/dynamic not caching

**Check:**
- Static part is identical across calls
- Only dynamic part changes

**Fix:**
- Don't include lead-specific data in static part
- Keep broker info in dynamic part (changes per territory)

---

## Example Output

### n8n Code Node Output:
```json
{
  "instructions": "You are Barbara, a warm... [1500 chars] ...CURRENT CALL CONTEXT... Name: John Smith...",
  "to": "+14155556565",
  "from": "+14155551234",
  "lead_id": "abc-123",
  "broker_id": "xyz-789"
}
```

### Bridge Receives:
```
POST /start-call
Body: { to, from, lead_id, broker_id, instructions: "You are Barbara..." }
```

### Bridge Stores:
```javascript
pendingCalls.set('uuid-abc', {
  to: '+14155556565',
  from: '+14155551234',
  lead_id: 'abc-123',
  broker_id: 'xyz-789',
  instructions: 'You are Barbara... [FULL PROMPT]'
});
```

### OpenAI Receives:
```json
{
  "type": "session.update",
  "session": {
    "instructions": "You are Barbara... Hi John Smith...",
    "voice": "alloy",
    "modalities": ["audio", "text"]
  }
}
```

---

## Advanced: A/B Testing Prompts

### Create Multiple Prompts

**Variant A: Warm & Friendly**
```javascript
const STATIC_PROMPT_A = `You are Barbara, warm and grandmotherly...`;
```

**Variant B: Professional & Direct**
```javascript
const STATIC_PROMPT_B = `You are Barbara, professional mortgage consultant...`;
```

### Randomly Assign
```javascript
const variant = Math.random() < 0.5 ? 'A' : 'B';
const STATIC_PROMPT = variant === 'A' ? STATIC_PROMPT_A : STATIC_PROMPT_B;

// Log variant for analysis
return {
  instructions: STATIC_PROMPT + DYNAMIC_CONTEXT,
  variant: variant, // Pass to logging
  // ...
};
```

### Track Results
```sql
-- Supabase query
SELECT 
  metadata->>'variant' as prompt_variant,
  outcome,
  COUNT(*) as count,
  AVG(duration_seconds) as avg_duration
FROM interactions
WHERE type = 'ai_call'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY metadata->>'variant', outcome;
```

---

## Next Steps

1. **Create this workflow in n8n**
2. **Test with your phone number first**
3. **Verify custom prompt is used**
4. **Check Supabase logging**
5. **Deploy to production**

---

**Everything is ready! The bridge supports custom instructions from n8n.** ✅

