# ElevenLabs Agent - Deployment Guide

## Pre-Deployment Checklist

Before deploying, ensure you have:
- ✅ Fly.io CLI installed (`fly auth login`)
- ✅ Supabase credentials (URL + Service Key)
- ✅ ElevenLabs API key (sk_152cd06cf72cd26e681ec2f8b8d79b58c8f535aa0d6aeeec)
- ✅ Nylas API key + Grant ID
- ✅ SignalWire account with SIP capabilities

---

## Step 1: Install Dependencies Locally

```bash
cd elevenlabs-webhook
npm install
```

---

## Step 2: Test Locally (Optional but Recommended)

Create `.env` file:

```bash
SUPABASE_URL=https://mxnqfwuhvurajrgoefyg.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
ELEVENLABS_API_KEY=sk_152cd06cf72cd26e681ec2f8b8d79b58c8f535aa0d6aeeec
NYLAS_API_KEY=your-key
NYLAS_GRANT_ID=your-grant
WEBHOOK_SECRET=test-secret
WEBHOOK_BASE_URL=http://localhost:3001
PORT=3001
```

**Test personalization webhook:**
```bash
# Terminal 1
npm start

# Terminal 2
curl -X POST http://localhost:3001/personalize \
  -H "Content-Type: application/json" \
  -d '{
    "caller_id": "+14155551234",
    "agent_id": "test",
    "called_number": "+14244851544",
    "call_sid": "test-123"
  }'
```

Should return prompt loaded from your Supabase!

**Test tools:**
```bash
# Terminal 1
PORT=3000 node tools.js

# Terminal 2
curl -X POST http://localhost:3000/tools/lookup_lead \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+14155551234"}'
```

---

## Step 3: Deploy to Fly.io

```bash
cd elevenlabs-webhook

# Create Fly app (if first time)
fly launch --name barbara-elevenlabs-webhook --no-deploy

# Set all secrets
fly secrets set SUPABASE_URL="https://mxnqfwuhvurajrgoefyg.supabase.co"
fly secrets set SUPABASE_SERVICE_KEY="your-service-key-from-supabase"
fly secrets set ELEVENLABS_API_KEY="sk_152cd06cf72cd26e681ec2f8b8d79b58c8f535aa0d6aeeec"
fly secrets set NYLAS_API_KEY="your-nylas-key"
fly secrets set NYLAS_GRANT_ID="your-nylas-grant"
fly secrets set WEBHOOK_SECRET="$(openssl rand -hex 32)"

# Deploy
fly deploy

# Check status
fly status

# Get URL
fly info
# Example output: https://barbara-elevenlabs-webhook.fly.dev
```

**Save this URL!** You'll need it for the agent creation.

---

## Step 4: Create Barbara Agent

Update `.env` with production URL:

```bash
WEBHOOK_BASE_URL=https://barbara-elevenlabs-webhook.fly.dev
```

**Run agent creation:**

```bash
node create-agent.js
```

**Output:**
```
✅ AGENT CREATED SUCCESSFULLY!
Agent ID: ag_xxxxxxxxxxxxxxxx

📋 SAVE THIS AGENT ID!
```

**IMPORTANT: Save the agent_id!**

---

## Step 5: Configure SIP Trunk

### In ElevenLabs Dashboard:

1. Go to: https://elevenlabs.io/app/agents/phone-numbers
2. Click: "Import from SIP Trunk"
3. Enter SignalWire SIP details:
   - **SIP Domain:** your-space.dapp.signalwire.com
   - **Username:** (from SignalWire)
   - **Password:** (from SignalWire)
4. Assign imported number to "Barbara - Equity Connect" agent

### In SignalWire Dashboard:

1. Go to: SIP → Endpoints
2. Create SIP endpoint pointing to ElevenLabs
   - **Destination SIP URI:** (get from ElevenLabs)
3. Go to: Phone Numbers
4. Select test number
5. Point to SIP endpoint

**Reference:** SignalWire + ElevenLabs SIP trunk setup docs

---

## Step 6: Test Call!

1. **Call your SignalWire test number**
2. **Expected flow:**
   - SignalWire routes via SIP to ElevenLabs
   - ElevenLabs calls your webhook: `/personalize`
   - Webhook loads prompt from Supabase
   - Barbara greets you with personalized info
   - You can ask questions (calls `/tools/search_knowledge`)
   - You can book appointment (calls `/tools/check_availability` + `/tools/book_appointment`)

3. **Monitor logs:**
```bash
fly logs
```

Look for:
- ✅ "Call starting: ..." (webhook received call)
- ✅ "Loaded prompt for: inbound-qualified" (prompt loaded)
- ✅ "Personalization complete" (webhook responded)
- ✅ "Lead found: ..." (tool calls working)

---

## Step 7: Monitor in ElevenLabs Dashboard

Go to: https://elevenlabs.io/app/agents/conversations

You'll see:
- ✅ Live call status
- ✅ Full transcript
- ✅ Tool calls made
- ✅ Conversation analytics

**Your PromptManagement.vue portal stays unchanged!**

---

## Troubleshooting

### Webhook not called
- Check webhook URL in agent config
- Verify Authorization header matches WEBHOOK_SECRET
- Test webhook directly: `curl https://your-webhook.fly.dev/health`

### Prompts not loading
- Check Supabase connection: `fly ssh console` then test query
- Verify `prompts` table has active prompts
- Check logs: `fly logs --app barbara-elevenlabs-webhook`

### Tools failing
- Test tools directly: `curl https://your-webhook.fly.dev/tools/lookup_lead ...`
- Check Nylas API key is valid
- Verify Supabase queries work

### Voice quality issues
- Try different voice_id (rachel, adam, etc.)
- Adjust stability/similarity_boost in create-agent.js
- Check turn_timeout settings

---

## Cost Monitoring

At your scale (105,000 min/month):
- Expected cost: ~$8,400/month for ElevenLabs
- Monitor in: https://elevenlabs.io/app/usage

---

## Updating the Agent

If you need to change voice, tools, or settings:

**Option A: Update via Dashboard**
- Go to agent settings in ElevenLabs
- Make changes in UI

**Option B: Update via API**
```bash
# Update agent configuration
curl -X PATCH "https://api.elevenlabs.io/v1/convai/agents/{agent_id}" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{...new config...}'
```

**Prompts update automatically!** When you edit in PromptManagement.vue, next call loads the new prompt.

---

## Next Steps After Testing

1. ✅ Test call quality (compare to Barbara V3)
2. ✅ A/B test (one number ElevenLabs, one number Barbara V3)
3. ✅ Monitor conversion rates
4. ✅ Get Walter's feedback
5. ✅ Decide: Keep ElevenLabs or go back to V3

**You can run both in parallel!** Just route different numbers to different systems.

