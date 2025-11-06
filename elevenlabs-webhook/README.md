# ElevenLabs Agent Platform - Barbara Webhook

Personalization webhook and tool endpoints for Barbara on ElevenLabs Agent Platform.

## What This Does

1. **Personalization Webhook** (`personalize.js`):
   - Called by ElevenLabs on every call
   - Loads dynamic prompts from your Supabase `prompts` table
   - Injects 28 variables (lead name, property, broker info)
   - **Your PromptManagement.vue portal remains the source of truth!**

2. **Tool Endpoints** (`tools.js`):
   - Wraps your existing business logic as HTTP endpoints
   - 5 tools: lookup_lead, search_knowledge, check_availability, book_appointment, update_lead
   - ElevenLabs agent calls these during conversations

3. **Agent Creation** (`create-agent.js`):
   - One-time script to create Barbara agent via API
   - Configures voice, tools, webhook

## Quick Start

### 1. Install Dependencies

```bash
cd elevenlabs-webhook
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
# Supabase (same as Barbara V3)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# ElevenLabs
ELEVENLABS_API_KEY=sk_152cd06cf72cd26e681ec2f8b8d79b58c8f535aa0d6aeeec

# Nylas (same as Barbara V3)
NYLAS_API_KEY=your-nylas-key
NYLAS_GRANT_ID=your-grant-id

# Webhook Security
WEBHOOK_SECRET=random-secret-for-auth

# Deployment
WEBHOOK_BASE_URL=https://your-webhook.fly.dev  # Update after deploying

# Server
PORT=3001  # For personalize.js
```

### 3. Test Locally

```bash
# Terminal 1: Start personalization webhook
npm start

# Terminal 2: Start tools endpoint
PORT=3000 node tools.js

# Test personalization
curl -X POST http://localhost:3001/personalize \
  -H "Content-Type: application/json" \
  -d '{"caller_id": "+14155551234", "agent_id": "test", "called_number": "+14244851544", "call_sid": "test-123"}'

# Test lead lookup
curl -X POST http://localhost:3000/tools/lookup_lead \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+14155551234"}'
```

### 4. Deploy to Fly.io

```bash
# Create Fly app
fly launch --name barbara-elevenlabs-webhook

# Set secrets
fly secrets set SUPABASE_URL=https://...
fly secrets set SUPABASE_SERVICE_KEY=...
fly secrets set ELEVENLABS_API_KEY=sk_...
fly secrets set NYLAS_API_KEY=...
fly secrets set NYLAS_GRANT_ID=...
fly secrets set WEBHOOK_SECRET=random-secret-here

# Deploy
fly deploy

# Get URL
fly status
# Example: https://barbara-elevenlabs-webhook.fly.dev
```

### 5. Create Barbara Agent

Update `.env` with production webhook URL, then:

```bash
node create-agent.js
```

**Save the `agent_id` returned!**

### 6. Configure SIP Trunk

**In ElevenLabs Dashboard:**
1. Go to: Phone Numbers → Import from SIP Trunk
2. Enter SignalWire SIP details
3. Assign to Barbara agent

**In SignalWire Dashboard:**
1. Configure SIP endpoint to ElevenLabs
2. Route test number to SIP trunk

### 7. Test!

Call your SignalWire number → Should route to ElevenLabs → Webhook loads Supabase prompts → Barbara speaks!

## How Your Portal Works

**PromptManagement.vue (Unchanged!):**
1. User edits prompt in portal
2. Portal saves to Supabase `prompts` table
3. On next call:
   - ElevenLabs calls `/personalize` webhook
   - Webhook reads Supabase
   - Returns updated prompt
   - ElevenLabs uses new prompt!

**Zero changes to your portal needed!**

## Architecture

```
Phone Call → SignalWire PSTN/SIP
                ↓
          ElevenLabs Agent Platform
                ↓ (webhook call)
          personalize.js (loads Supabase prompts)
                ↓ (tool calls during conversation)
          tools.js (HTTP endpoints)
                ↓
          Your existing logic (Supabase, Nylas, Vertex AI)
```

## Files

- `personalize.js` - Personalization webhook (port 3001)
- `tools.js` - Tool HTTP endpoints (port 3000)
- `create-agent.js` - Agent creation script (run once)
- `package.json` - Dependencies
- `Dockerfile` - For Fly.io deployment
- `fly.toml` - Fly.io configuration

## Cost

At 105,000 minutes/month (your scale):
- **ElevenLabs Agent:** $0.08/min = $8,400/month = $100,800/year
- **SignalWire PSTN:** $0.01/min = $1,050/month = $12,600/year
- **Total:** ~$113,400/year

**vs Barbara V3:** $64,260/year
**Difference:** +$49,140/year for best-in-class voice quality

## Troubleshooting

**Webhook not being called:**
- Check webhook URL in agent config
- Check Authorization header matches WEBHOOK_SECRET
- View logs: `fly logs`

**Prompts not loading:**
- Verify Supabase connection
- Check `prompts` table has active prompts for call_type
- Test directly: `curl http://localhost:3001/personalize -X POST -H "Content-Type: application/json" -d '{"caller_id": "..."}'`

**Tools not working:**
- Check tool endpoints are accessible
- Verify ElevenLabs can reach your Fly.io URL
- Test directly: `curl https://your-webhook.fly.dev/tools/lookup_lead ...`

