# SignalWire Dashboard Configuration Guide

**Status:** Ready to Configure  
**Agent URL:** `https://barbara-agent.fly.dev/agent`  
**Date:** November 12, 2025

---

## 🎯 **Quick Setup Checklist**

- [ ] **Step 1:** Verify Fly.io deployment is healthy
- [ ] **Step 2:** Configure SignalWire phone number for inbound calls
- [ ] **Step 3:** Test inbound call
- [ ] **Step 4:** Configure n8n for outbound calls
- [ ] **Step 5:** Test outbound call
- [ ] **Step 6:** Test full 8-node BarbGraph flow

---

## 📋 **Step 1: Verify Fly.io Deployment**

### **Check Deployment Status**

```bash
# Monitor GitHub Actions
# Go to: https://github.com/alexmorris0n/equity-connect/actions

# Or check Fly.io status directly
flyctl status -a barbara-agent
```

### **Test Health Endpoint**

```bash
curl https://barbara-agent.fly.dev/healthz
# Expected: 200 OK
```

### **Test Agent Endpoint**

```bash
curl https://barbara-agent.fly.dev/agent
# Expected: 200 OK (agent ready to receive calls)
```

### **View Logs**

```bash
flyctl logs -a barbara-agent
# Should see: "🚀 Starting Barbara agent on SignalWire SDK..."
```

---

## 📞 **Step 2: Configure SignalWire Phone Number (Inbound)**

### **Dashboard Navigation**

1. Go to: [SignalWire Dashboard](https://your-space.signalwire.com/phone_numbers)
2. Select **Phone Numbers** from left menu
3. Click on your phone number

### **Voice Settings Configuration**

**Configure these settings:**

| Setting | Value |
|---------|-------|
| **Accept Incoming** | Voice Calls |
| **Handle Calls Using** | SWML Script / Webhook (Answer → Connect) |
| **When a call comes in** | `https://barbara-agent.fly.dev/agent` |
| **HTTP Method** | POST |
| **Voice** | (Optional) Set fallback voice if needed |

### **Screenshot Locations**

Look for these sections in the dashboard:
- **"Voice & Fax"** tab
- **"Handle calls using"** dropdown → Select "SWML Script / Webhook"
- **"Request URL"** field → Enter agent URL
- **"HTTP POST"** → Ensure POST is selected (not GET)

### **Save Configuration**

Click **Save** at the bottom of the page.

#### ✅ Required SWML Script

When using a SWML Script/Webhook for PSTN calls, SignalWire still expects you to create the B‑leg that bridges the caller to Barbara. The minimal script is:

```yaml
---
version: 1.0.0
sections:
  main:
    - answer: {}
    - connect:
        endpoint:
          type: sip
          uri: "sip:barbara@barbara-agent.fly.dev"
          username: "barbara"
          password: "rained1MANU.endured5juices"
```

- `answer` picks up the inbound call so the caller stops ringing.
- `connect` creates the SIP leg to the Fly.io agent and keeps the session alive.

> Need to POST call metadata to Barbara?  
> Add a `request` step **before** `connect`:
> ```yaml
>     - request:
>         url: https://barbara-agent.fly.dev/agent
>         method: POST
>         headers:
>           Content-Type: application/json
>         body:
>           From: "%{call.from}"
>           To: "%{call.to}"
>           CallSid: "%{call.call_id}"
> ```
> SignalWire will execute `request`, then run `connect`, keeping both legs active.

---

## 🧪 **Step 3: Test Inbound Call**

### **Make Test Call**

1. Dial your SignalWire phone number from your mobile
2. Listen for 3-second ring delay (agent is loading context)
3. Agent should answer with greet node prompt
4. Verify agent responds to your voice

### **Expected Flow**

```
You dial → Ring 3 seconds → Agent answers → "Hi, this is Barbara..."
```

### **Monitor Logs During Call**

```bash
flyctl logs -a barbara-agent --follow
```

**Expected Log Output:**

```
📞 INBOUND call: From=+15551234567, To=+15559876543, CallSid=CA123...
👤 Found lead context: lead_id=abc-123 (if existing lead)
✅ Loaded BarbGraph prompt for node 'greet' with context for +15551234567
```

### **Troubleshooting Inbound Calls**

| Issue | Check |
|-------|-------|
| **No answer** | Verify agent URL in SignalWire dashboard |
| **Call drops immediately** | Check Fly.io logs for errors |
| **Agent doesn't respond** | Verify STT/LLM/TTS API keys in env vars |
| **No context loaded** | Check Supabase connection and phone number format |

---

## 🚀 **Step 4: Configure n8n for Outbound Calls**

### **Update barbara-mcp or n8n Workflow**

**Option A: barbara-mcp (MCP Server)**

Update `barbara-mcp/index.js`:

```javascript
// Outbound call using SignalWire Voice API
const callParams = {
  To: lead.primary_phone_e164,           // Lead's phone number
  From: process.env.SIGNALWIRE_PHONE_NUMBER, // Your SignalWire number
  Url: "https://barbara-agent.fly.dev/agent", // Agent URL
  Method: "POST",
  StatusCallback: "https://barbara-agent.fly.dev/status", // Optional
  StatusCallbackMethod: "POST"
};

const call = await signalwireClient.calls.create(callParams);
```

**Option B: n8n HTTP Request Node**

Configure n8n workflow:

```json
{
  "method": "POST",
  "url": "https://{{ SIGNALWIRE_SPACE }}.signalwire.com/api/laml/2010-04-01/Accounts/{{ SIGNALWIRE_PROJECT_ID }}/Calls",
  "authentication": "basicAuth",
  "body": {
    "To": "{{ $json.phone_number }}",
    "From": "{{ $env.SIGNALWIRE_PHONE_NUMBER }}",
    "Url": "https://barbara-agent.fly.dev/agent",
    "Method": "POST"
  }
}
```

### **Required Environment Variables**

Ensure these are set in n8n/barbara-mcp:

```bash
SIGNALWIRE_PROJECT_ID=your-project-id
SIGNALWIRE_API_TOKEN=your-api-token
SIGNALWIRE_SPACE_URL=your-space.signalwire.com
SIGNALWIRE_PHONE_NUMBER=+15559876543
```

---

## 🧪 **Step 5: Test Outbound Call**

### **Trigger Outbound Call**

**Via n8n:**
1. Go to your outbound calling workflow
2. Manually trigger with test lead data
3. Monitor execution logs

**Via barbara-mcp:**
```javascript
// Call the MCP tool
await mcp.tools.call({
  name: "trigger_outbound_call",
  arguments: {
    lead_id: "test-lead-123",
    phone_number: "+15551234567"
  }
});
```

### **Expected Flow**

```
n8n triggers → SignalWire calls lead → Ring delay → Agent speaks → Lead answers
```

### **Monitor Logs During Call**

```bash
flyctl logs -a barbara-agent --follow
```

**Expected Log Output:**

```
📞 OUTBOUND call: From=+15559876543, To=+15551234567, CallSid=CA123...
👤 Found lead context: lead_id=abc-123
✅ Loaded BarbGraph prompt for node 'greet' with context for +15551234567
```

### **Troubleshooting Outbound Calls**

| Issue | Check |
|-------|-------|
| **Call not placed** | Verify SignalWire API credentials in n8n |
| **Wrong number format** | Ensure phone is E.164 format (+15551234567) |
| **No agent response** | Check agent URL in call creation params |
| **Context not loaded** | Verify lead exists in Supabase |

---

## 🎨 **Step 6: Test Full BarbGraph Flow**

### **Test Scenario: Full 8-Node Flow**

Make a call and walk through the entire conversation:

**1. greet** → Agent introduces herself
- Say: "Hi, I'm interested in a reverse mortgage"
- Expected: Agent moves to verify node

**2. verify** → Identity verification
- Agent asks: "Can I get your first name?"
- Say: "John Doe"
- Expected: Agent verifies and moves to qualify

**3. qualify** → Qualification questions
- Agent asks: "Are you 62 or older?"
- Say: "Yes, I'm 65"
- Expected: Agent asks about property, continues qualification

**4. quote** → Present quote
- Agent presents quote based on qualification
- Say: "That sounds good"
- Expected: Agent moves to answer or book

**5. answer** → Answer questions
- Say: "How does the interest rate work?"
- Expected: Agent searches knowledge base, provides answer

**6. objections** → Handle objections
- Say: "I'm concerned about losing my home"
- Expected: Agent addresses objection, moves back to answer or book

**7. book** → Schedule appointment
- Say: "I'd like to schedule a consultation"
- Expected: Agent checks broker availability, books appointment

**8. exit** → End call
- Agent confirms appointment and ends call gracefully
- Expected: Call ends, database updated

### **Verify Database Updates**

After the call, check Supabase:

```sql
-- Check conversation state
SELECT * FROM conversation_state 
WHERE phone_number = '+15551234567';
-- Should show: current_node = 'exit', conversation_data flags set

-- Check lead record
SELECT * FROM leads 
WHERE primary_phone_e164 = '+15551234567';
-- Should show: updated lead info (age, property, etc.)

-- Check interaction log
SELECT * FROM interactions 
WHERE lead_id = 'your-lead-id' 
ORDER BY created_at DESC LIMIT 1;
-- Should show: call summary, outcome, metadata
```

### **Multi-Call Persistence Test**

**Test returning caller:**

1. **First call:**
   - Start at "greet"
   - Progress to "qualify"
   - Hang up mid-conversation

2. **Check database:**
   ```sql
   SELECT current_node FROM conversation_state 
   WHERE phone_number = '+15551234567';
   -- Should show: 'qualify'
   ```

3. **Second call (same number):**
   - Agent should resume at "qualify" (not "greet")
   - Agent should have context from first call
   - Say: "Hi, I called earlier"
   - Expected: Agent continues from where you left off

---

## 🔐 **Environment Variables Check**

### **Fly.io Secrets**

Verify these are set on Fly.io:

```bash
flyctl secrets list -a barbara-agent
```

**Required Secrets:**

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key

# SignalWire (for outbound calls from agent)
SIGNALWIRE_PROJECT_ID=your-project-id
SIGNALWIRE_API_TOKEN=your-api-token
SIGNALWIRE_SPACE_URL=your-space.signalwire.com

# AI Providers
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...

# Optional
LOG_LEVEL=INFO
```

### **Set Missing Secrets**

```bash
flyctl secrets set SUPABASE_URL=https://... -a barbara-agent
flyctl secrets set OPENAI_API_KEY=sk-... -a barbara-agent
# etc.
```

---

## 📊 **Success Criteria**

### **Inbound Call Success:**
- ✅ Call connects after 3-second ring
- ✅ Agent speaks greet prompt
- ✅ Agent responds to caller's voice
- ✅ Context loaded from database (if existing lead)
- ✅ BarbGraph routing works (greet → verify → qualify)

### **Outbound Call Success:**
- ✅ n8n/barbara-mcp triggers call successfully
- ✅ Lead's phone rings
- ✅ Agent speaks when lead answers
- ✅ Lead context loaded from database
- ✅ BarbGraph routing works

### **Multi-Call Persistence:**
- ✅ Returning caller resumes at last node
- ✅ Conversation data preserved across calls
- ✅ Lead context updated correctly

### **Database Integrity:**
- ✅ `conversation_state` updated after each node transition
- ✅ `leads` table updated with gathered info
- ✅ `interactions` table logged after call

---

## 🐛 **Common Issues & Solutions**

### **Issue: Call connects but agent doesn't speak**

**Likely Causes:**
1. Missing AI provider API keys
2. STT/LLM/TTS configuration error
3. Prompt loading failure

**Debug:**
```bash
flyctl logs -a barbara-agent --follow
# Look for errors related to API keys or prompt loading
```

**Fix:**
```bash
# Set missing API keys
flyctl secrets set OPENAI_API_KEY=sk-... -a barbara-agent
flyctl secrets set ELEVENLABS_API_KEY=... -a barbara-agent
```

---

### **Issue: Context not loading (agent doesn't know returning caller)**

**Likely Causes:**
1. Phone number format mismatch
2. Supabase connection error
3. No existing conversation_state record

**Debug:**
```sql
-- Check if phone number exists in DB
SELECT * FROM conversation_state 
WHERE phone_number LIKE '%5551234567%';

-- Check leads table
SELECT primary_phone, primary_phone_e164 FROM leads 
WHERE primary_phone LIKE '%5551234567%';
```

**Fix:**
- Ensure phone numbers are stored in E.164 format (+15551234567)
- Verify `get_conversation_state()` handles flexible phone matching

---

### **Issue: Routing not working (stuck on one node)**

**Likely Causes:**
1. Node completion checker not returning true
2. Router function not called
3. Conversation flags not set

**Debug:**
```bash
flyctl logs -a barbara-agent --follow
# Look for routing logs: "🧭 Router 'greet' returned: verify"
```

**Check database:**
```sql
SELECT conversation_data FROM conversation_state 
WHERE phone_number = '+15551234567';
-- Should show flags like: {"verified": true, "qualified": true}
```

---

## ✅ **Configuration Complete Checklist**

- [ ] Fly.io deployment healthy
- [ ] SignalWire phone number configured (inbound)
- [ ] Inbound call test successful
- [ ] n8n/barbara-mcp configured (outbound)
- [ ] Outbound call test successful
- [ ] Full 8-node BarbGraph flow tested
- [ ] Multi-call persistence verified
- [ ] Database updates confirmed
- [ ] All environment variables set

---

**Status:** Ready to go live! 🚀

**Next Steps:** Monitor first production calls, tune STT/VAD settings if needed, expand to East Coast region (IAD) when scaling.

