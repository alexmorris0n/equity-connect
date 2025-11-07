# Migration to ElevenLabs SIP Trunk Outbound Calls

## Overview

The Barbara MCP server has been updated to use **ElevenLabs SIP Trunk API** for outbound calls instead of the old bridge system. This unifies your entire voice system on SignalWire → ElevenLabs.

---

## What Changed

### Before (Old Bridge System):
```
n8n → Barbara MCP → Old Bridge → ??? (unknown provider)
```

### After (ElevenLabs SIP Trunk):
```
n8n → Barbara MCP → ElevenLabs API → SignalWire SIP Trunk → Phone Call
```

---

## Benefits

✅ **Unified System**: Inbound AND outbound calls use the same platform (ElevenLabs)  
✅ **Same Voice Quality**: Best-in-class voice (same as working inbound calls)  
✅ **Dynamic Personalization**: Full support for dynamic variables (27+ variables!)  
✅ **Same Tools**: Calendar, knowledge base, lead updates  
✅ **Simpler Setup**: One telephony provider (SignalWire), one AI provider (ElevenLabs)  
✅ **Cost Efficient**: SignalWire cheaper than Twilio (~$300-500/mo vs $400-700/mo)

---

## Files Updated

### 1. `barbara-mcp/index.js`
- ✅ Added ElevenLabs environment variables (`ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_PHONE_NUMBER_ID`)
- ✅ Replaced old bridge API call with ElevenLabs SIP trunk outbound API
- ✅ Added 27+ dynamic variables for personalization (lead info, broker info, property data, etc.)
- ✅ Updated response format to use `conversation_id` and `sip_call_id`

### 2. `barbara-mcp/env.example`
- ✅ Created new example environment file with all required variables

### 3. `barbara-mcp/README.md`
- ✅ Updated documentation to reflect ElevenLabs integration
- ✅ Updated configuration instructions
- ✅ Updated deployment guides (Docker, Northflank)
- ✅ Updated API response examples

---

## Setup Instructions

### Step 1: Get Your ElevenLabs Credentials

You need these 3 values from your ElevenLabs dashboard:

1. **API Key**: Go to https://elevenlabs.io/app/settings/api-keys
   - Copy your API key (starts with `sk_...`)

2. **Agent ID**: Go to https://elevenlabs.io/app/conversational-ai
   - Click on your agent (the one you're using for inbound calls)
   - Copy the Agent ID from the URL (starts with `agent_...`)

3. **Phone Number ID** (Default Fallback): In your agent settings
   - Go to "Phone Numbers" tab
   - Find your default SignalWire number
   - Copy the Phone Number ID (starts with `pn_...`)

### Step 1.5: Set Up Phone Number Pool (For Multiple Numbers)

If you have multiple SignalWire numbers assigned to different brokers:

1. **Register Each Number in ElevenLabs**:
   - Go to https://elevenlabs.io/app/conversational-ai
   - Go to your agent → "Phone Numbers" tab
   - Add each SignalWire SIP trunk number
   - Copy the `phone_number_id` for each (starts with `pn_...`)

2. **Update Supabase** `signalwire_phone_numbers` table:
   ```sql
   UPDATE signalwire_phone_numbers 
   SET elevenlabs_phone_number_id = 'pn_abc123...'  -- Replace with actual ID from ElevenLabs
   WHERE number = '+14244851544';  -- Replace with actual SignalWire number
   ```

3. **Repeat for each number** in your pool

**How Number Selection Works**:
- If n8n passes `from_phone` parameter → Uses that specific number
- Else if `broker_id` is provided → Uses broker's assigned number pool
- Else → Uses default fallback number (`ELEVENLABS_PHONE_NUMBER_ID`)

### Step 2: Set Environment Variables

**For Local Development:**
Create a `.env` file in `barbara-mcp/` directory:

```bash
# ElevenLabs (for outbound calls)
ELEVENLABS_API_KEY=sk_your-actual-api-key-here
ELEVENLABS_AGENT_ID=your-actual-agent-id-here
ELEVENLABS_PHONE_NUMBER_ID=your-default-phone-number-id-here  # Fallback number

# Supabase (for phone number pool lookup)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Bridge (for tools)
BRIDGE_URL=https://bridge.northflank.app
BRIDGE_API_KEY=your-bridge-api-key-here

# Nylas (optional, for calendar tools)
NYLAS_API_KEY=your-nylas-api-key-here
NYLAS_API_URL=https://api.us.nylas.com
```

**For Production (Northflank/Docker):**
Add the same environment variables to your deployment platform.

### Step 3: Test Locally

```bash
cd barbara-mcp
npm install
npm start
```

You should see:
```
🚀 Barbara MCP Server v2.0 running on http://0.0.0.0:3000
📡 Bridge URL: https://bridge.northflank.app
🔧 MCP endpoint: http://0.0.0.0:3000/mcp
```

### Step 4: Test Outbound Call

Use curl to test:

**Test 1: Using specific number from pool**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_outbound_call",
      "arguments": {
        "to_phone": "+16505300051",
        "from_phone": "+14244851544",
        "lead_id": "test-lead-123",
        "broker_id": "broker-uuid-here",
        "lead_first_name": "John",
        "lead_last_name": "Doe",
        "lead_email": "john@example.com",
        "broker_full_name": "Walter Richards",
        "qualified": true
      }
    }
  }'
```

**Test 2: Using broker's assigned number (automatic selection)**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_outbound_call",
      "arguments": {
        "to_phone": "+16505300051",
        "lead_id": "test-lead-123",
        "broker_id": "broker-uuid-here",
        "lead_first_name": "John",
        "broker_full_name": "Walter Richards",
        "qualified": true
      }
    }
  }'
```

You should get a response with:
```json
{
  "success": true,
  "conversation_id": "conv_...",
  "sip_call_id": "...",
  "from_number": "+14244851544",
  "call_type": "Outbound Qualified"
}
```

---

## How Dynamic Variables Work

When you call `create_outbound_call`, the MCP server sends all lead/broker data to ElevenLabs as **dynamic variables**:

```javascript
{
  lead_first_name: "John",
  lead_email: "john@example.com",
  broker_full_name: "Walter Richards",
  property_value_formatted: "1.2M",
  estimated_equity_formatted: "500K",
  call_type: "outbound-qualified"
  // ... 27+ total variables
}
```

These get injected into your ElevenLabs agent's prompt using `{{variable_name}}` syntax.

**Example Prompt:**
```
You are Barbara, calling {{lead_first_name}}.
Their property is worth {{property_value_formatted}}.
Their broker is {{broker_full_name}}.
```

**At Runtime, Barbara Says:**
```
"Hi John! I'm Barbara from Equity Connect. I see your property is worth $1.2M.
Your broker Walter Richards asked me to reach out..."
```

---

## Next Steps

1. ✅ Set environment variables (see Step 2 above)
2. ✅ Test locally (see Step 3 above)
3. ⏭️ Update your ElevenLabs agent prompts to use dynamic variables
4. ⏭️ Deploy to production (Northflank or Docker)
5. ⏭️ Test n8n integration with `create_outbound_call` tool
6. ⏭️ Monitor logs and verify calls are working

---

## Troubleshooting

### Error: "ELEVENLABS_API_KEY environment variable is required"
- Make sure you've created a `.env` file with all required variables
- Or set environment variables in your deployment platform

### Error: "Failed to create outbound call"
- Check that your `ELEVENLABS_AGENT_ID` is correct
- Check that your `ELEVENLABS_PHONE_NUMBER_ID` matches your SignalWire number in ElevenLabs
- Verify your API key has the correct permissions

### Call doesn't personalize
- Check that your ElevenLabs agent prompt uses dynamic variables (`{{variable_name}}`)
- Verify the variables are being passed in the tool call
- Check ElevenLabs logs for the conversation to see what variables were received

---

## Cost Comparison

| Component | Provider | Cost/min | Monthly (50k min) |
|-----------|----------|----------|-------------------|
| Telephony | SignalWire | $0.0085 | ~$425 |
| AI Voice | ElevenLabs | ~$0.03 | ~$1,500 |
| **TOTAL** | | **~$0.04/min** | **~$1,925/mo** |

**Note**: This is MUCH cheaper than your previous Barbara V3 setup because:
- No PromptLayer costs
- No OpenAI Realtime API costs (ElevenLabs handles STT/TTS/LLM)
- SignalWire cheaper than Twilio

---

## Questions?

- Check the updated `README.md` for full documentation
- Review ElevenLabs docs: https://elevenlabs.io/docs/agents-platform/api-reference/sip-trunk/outbound-call
- Test with the health check: `curl http://localhost:3000/health`

---

**Migration Complete! 🎉**

You're now running a fully unified voice system:
- Inbound: SignalWire SIP → ElevenLabs ✅
- Outbound: Barbara MCP → ElevenLabs SIP → SignalWire ✅

