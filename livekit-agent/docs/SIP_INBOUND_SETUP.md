# LiveKit SIP Inbound Setup Guide

**Status:** 📋 Configuration Required

> Self‑hosting SIP? Use the companion guide: `SIP_SELF_HOSTED_SETUP.md`.  
> This document covers the same flow using LiveKit Cloud; the API endpoints and SWML are identical either way.

This guide explains how to configure SignalWire phone numbers to route inbound calls to LiveKit SIP, which will then trigger the agent.

---

## 🎯 What This Enables

- **Inbound AI calls** - Leads call your SignalWire numbers, LiveKit agent answers
- **Dynamic prompt loading** - Different prompts based on caller (qualified/unqualified/unknown)
- **Lead context injection** - Agent knows who's calling and their property details
- **Provider flexibility** - Per-number STT/TTS/LLM configuration from database

---

## 📋 Architecture

```
Lead dials +14244851544
  ↓ (PSTN)
SignalWire Phone Number
  ↓ (SWML routes to LiveKit SIP)
LiveKit SIP Bridge
  ↓ (Creates room with SIP participant)
LiveKit Room (name: sip-{call-id})
  ↓ (Dispatch rule triggers agent)
Python Agent (agent.py)
  ↓ (Loads config from Supabase)
Dynamic Prompt + Lead Context + Providers
  ↓ (Uses Tools)
Supabase Tools (calendar, knowledge base, etc.)
```

---

## 🔧 Setup Steps

### Step 1: Configure LiveKit SIP Domain

1. Go to **LiveKit Cloud Dashboard** → **Settings** → **SIP**
2. Enable SIP Bridge if not already enabled
3. Note your **SIP Domain** (e.g., `sip-abc123.livekit.cloud`)
4. Configure **SIP Username** and **Password** (if required)

### Step 2: Configure SignalWire Phone Number

1. Go to **SignalWire Dashboard** → **Phone Numbers**
2. Click on your number (e.g., `+14244851544`)
3. Under **"Voice & Fax"** → **"Accept Incoming Calls"**:
   - Set to: **"Use LaML Bin"** or **"Use LaML URL"**
   - Configure webhook URL: `https://your-api-server.com/api/swml-inbound?to={To}&from={From}`

**Alternative: Use SWML Bin**

Create a SWML Bin with this script:

```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      {
        "connect": {
          "to": "sip:{{call.to}}@YOUR_LIVEKIT_SIP_DOMAIN;transport=tcp",
          "from": "sip:{{call.from}}@YOUR_LIVEKIT_SIP_DOMAIN;transport=tcp"
        }
      }
    ]
  }
}
```

Replace `YOUR_LIVEKIT_SIP_DOMAIN` with your actual LiveKit SIP domain.

### Step 3: Configure LiveKit SIP Dispatch Rule

1. Go to **LiveKit Cloud Dashboard** → **Settings** → **SIP** → **Dispatch Rules**
2. Create a new dispatch rule:

**Rule Configuration:**
- **Name:** `equity-connect-agent`
- **Pattern:** `sip-*` (matches all SIP rooms)
- **Agent Type:** `python`
- **Entrypoint:** `agent.py:entrypoint`
- **Pre-warm:** `agent.py:prewarm`

**Environment Variables:**
- `LIVEKIT_URL=wss://your-project.livekit.cloud`
- `LIVEKIT_API_KEY=your-api-key`
- `LIVEKIT_API_SECRET=your-api-secret`
- `SUPABASE_URL=your-supabase-url`
- `SUPABASE_SERVICE_KEY=your-service-key`
- (Add all other required env vars)

### Step 4: Update Database

Ensure the phone number is in your database:

```sql
INSERT INTO signalwire_phone_numbers (
  number,
  name,
  status,
  stt_provider,
  tts_provider,
  llm_provider,
  stt_model,
  tts_voice,
  llm_model
) VALUES (
  '+14244851544',
  'MyReverseOptions1',
  'active',
  'deepgram',
  'elevenlabs',
  'openai',
  'nova-2',
  'shimmer',
  'gpt-5'
);
```

### Step 5: Test Inbound Call

1. Dial the SignalWire number from your phone: `+14244851544`
2. Agent should answer with personalized greeting
3. Check LiveKit logs for agent activity
4. Check Supabase `interactions` table for call record

---

## 🔍 How It Works

### Call Flow:

1. **SignalWire receives call:**
   - Lead dials `+14244851544`
   - SignalWire triggers SWML script/webhook

2. **SWML routes to LiveKit SIP:**
   - SWML script connects to `sip:+14244851544@livekit-sip-domain;transport=tcp`
   - SignalWire sends SIP INVITE to LiveKit SIP bridge

3. **LiveKit SIP Bridge:**
   - Creates a room with name like `sip-{call-id}`
   - Adds SIP participant with metadata:
     - `sip_to`: `+14244851544` (called number)
     - `sip_from`: `+16505300051` (caller number)

4. **Dispatch Rule triggers agent:**
   - LiveKit matches room name pattern `sip-*`
   - Starts Python agent with `agent.py:entrypoint`
   - Agent connects to room

5. **Agent processes call:**
   - Extracts `sip_to` and `sip_from` from room metadata
   - Looks up phone config from Supabase using `sip_to`
   - Determines call type (inbound-qualified/unqualified/unknown)
   - Loads prompt and injects variables
   - Initializes providers (STT/TTS/LLM) from config
   - Auto-greets caller
   - Handles conversation with tools

---

## 📞 SWML Script Endpoint

The API server provides `/api/swml-inbound` endpoint that returns SWML script:

**Request:**
```
GET /api/swml-inbound?to=+14244851544&from=+16505300051
```

**Response:**
```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      {
        "connect": {
          "to": "sip:+14244851544@your-livekit-sip-domain;transport=tcp",
          "from": "sip:+16505300051@your-livekit-sip-domain;transport=tcp"
        }
      }
    ]
  }
}
```

---

## 🔐 Required Environment Variables

```bash
# LiveKit
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
LIVEKIT_SIP_DOMAIN=sip-abc123.livekit.cloud
LIVEKIT_SIP_USERNAME=optional-username
LIVEKIT_SIP_PASSWORD=optional-password

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Providers (configured per number in database)
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
OPENAI_API_KEY=...
# ... other provider keys

# API Server
API_SERVER_PORT=8080
API_SERVER_HOST=0.0.0.0
API_BASE_URL=https://your-api-server.com
```

---

## 🔍 Troubleshooting

### Call Not Answered by Agent

**Check:**
1. SignalWire number routing configured correctly
2. SWML script/webhook URL is accessible
3. LiveKit SIP domain is correct
4. Dispatch rule is configured and active
5. Agent is running and connected to LiveKit

**Test SWML endpoint:**
```bash
curl "https://your-api-server.com/api/swml-inbound?to=+14244851544&from=+16505300051"
```

**Check LiveKit logs:**
- Go to LiveKit Cloud Dashboard → Logs
- Look for room creation and agent connection

### Agent Doesn't Know Caller

**Cause:** Phone number not in database or metadata not extracted

**Fix:**
1. Check phone number exists: `SELECT * FROM signalwire_phone_numbers WHERE number = '+14244851544'`
2. Check agent logs for SIP metadata extraction
3. Verify room metadata contains `sip_to` and `sip_from`

### Wrong Provider Used

**Cause:** Phone config not loaded or fallback triggered

**Check:**
```sql
SELECT stt_provider, tts_provider, llm_provider 
FROM signalwire_phone_numbers 
WHERE number = '+14244851544';
```

**Check agent logs for provider initialization messages**

---

## ✅ Success Criteria

A working inbound setup will:

1. ✅ Call is answered by LiveKit agent
2. ✅ Agent greets caller by name (if in database)
3. ✅ Correct prompt used based on qualified status
4. ✅ Providers initialized from database config
5. ✅ Tools work (calendar, knowledge base, etc.)
6. ✅ Call logged to `interactions` table
7. ✅ Transcript saved with full conversation
8. ✅ Cost tracked per provider usage

---

**Last Updated:** December 2024  
**Status:** 📋 Configuration Required

