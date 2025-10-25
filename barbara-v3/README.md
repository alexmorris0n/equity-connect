# Barbara V3 - Voice AI Assistant

**Production-ready voice AI assistant for reverse mortgage lead engagement.**

Built with SignalWire cXML streaming + OpenAI Realtime API + OpenAI Agents SDK.

---

## **Architecture**

```
SignalWire Call
    ↓ (cXML Webhook)
Barbara V3 Server (Fly.io)
    ↓ (WebSocket Stream)
SignalWire ↔ OpenAI WebRTC
    ↓ (Tool Calls)
Business Tools (13 total)
    ↓ (Database/APIs)
Supabase, Nylas, Vertex AI, SignalWire MFA
```

---

## **Tech Stack**

- **Runtime:** Node.js 20 + TypeScript
- **Framework:** Fastify + WebSocket
- **AI:** OpenAI Realtime API (gpt-4o-realtime-preview)
- **Telephony:** SignalWire Compatibility API (cXML)
- **Transport:** `@openai/agents` + SignalWire Transport Layer
- **Audio:** g711_ulaw (8kHz) or pcm16 (24kHz)
- **Database:** Supabase (PostgreSQL + pgvector)
- **Calendar:** Nylas API v3
- **Embeddings:** Google Vertex AI (text-embedding-005)
- **MFA:** SignalWire native MFA API

---

## **Business Tools (11 total)**

### **Lead Management:**
1. `get_lead_context` - Query lead by phone
2. `check_consent_dnc` - Verify calling permissions
3. `update_lead_info` - Update lead data

### **Broker Assignment:**
4. `find_broker_by_territory` - Assign broker by ZIP/city
5. `check_broker_availability` - Real Nylas calendar check

### **Appointments:**
6. `book_appointment` - Create calendar event + billing
7. `assign_tracking_number` - Link SignalWire number
8. `send_appointment_confirmation` - Send MFA code (NEW!)
9. `verify_appointment_confirmation` - Verify MFA code (NEW!)

### **Data & Knowledge:**
10. `save_interaction` - Log call details
11. `search_knowledge` - Vector search via Vertex AI

### **Demo Tools:**
- `get_time` - Current time
- `get_weather` - Weather info

---

## **Deployment**

### **Automatic (Git-based):**
```bash
git add .
git commit -m "Update Barbara"
git push origin main
```
→ GitHub Actions automatically deploys to Fly.io

### **Manual (CLI):**
```bash
cd barbara-v3
fly deploy --remote-only --no-cache --build-arg CACHEBUST=$(date +%s)
```

---

## **Environment Variables**

All secrets are configured on Fly.io (not in code):

```bash
# View secrets
fly secrets list --app barbara-v3-voice

# Set a secret
fly secrets set KEY=value --app barbara-v3-voice
```

**Required:**
- `OPENAI_API_KEY` - OpenAI Realtime API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `SIGNALWIRE_PROJECT_ID` - SignalWire project ID
- `SIGNALWIRE_API_TOKEN` - SignalWire API token
- `SIGNALWIRE_SPACE` - SignalWire space name
- `NYLAS_API_KEY` - Nylas API key
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` - Google service account JSON
- `GOOGLE_PROJECT_ID` - Google Cloud project ID

**Optional:**
- `LOG_LEVEL` - `debug` | `info` | `error` (default: `info`)
- `AUDIO_FORMAT` - `g711_ulaw` | `pcm16` (default: `g711_ulaw`)
- `OPENAI_REALTIME_MODEL` - Model name (default: `gpt-4o-realtime-preview`)

---

## **Monitoring**

### **Logs:**
```bash
fly logs --app barbara-v3-voice
```

### **Status:**
```bash
fly status --app barbara-v3-voice
```

### **Metrics:**
https://fly.io/apps/barbara-v3-voice/monitoring

---

## **Local Development**

```bash
# Install dependencies
npm install

# Copy environment template
cp env.example .env
# Edit .env with your keys

# Build TypeScript
npm run build

# Start server
npm start

# Development mode (auto-rebuild)
npm run dev
```

---

## **Endpoints**

- **Health Check:** `GET /health`
- **SignalWire Webhook:** `POST /webhook` (returns cXML)
- **Audio Stream:** `WebSocket /stream` (SignalWire → OpenAI)

---

## **Related Projects**

- **Portal:** `../portal/` - Vue.js admin panel for configuring Barbara
- **MCP Servers:** `../barbara-mcp/`, `../propertyradar-mcp/`, `../swarmtrace-mcp/`
- **Database:** `../database/` - Supabase schema & migrations
- **Prompts:** `../prompts/` - Shared prompt templates
- **Workflows:** `../workflows/` - N8N automation workflows

---

## **Version History**

- **v3.0.1** (Oct 25, 2025) - Added 11 business tools + MFA + Git-based deployment
- **v3.0.0** (Oct 25, 2025) - Initial release (cXML + OpenAI Agents SDK)

---

## **Architecture Notes**

### **Why cXML instead of Relay SDK v4?**

Barbara V3 uses SignalWire's **Compatibility API (cXML)** instead of Relay SDK v4 because:

1. ✅ **Proven architecture** - Based on SignalWire's official `cXML-realtime-agent-stream` reference
2. ✅ **WebSocket streaming** - Direct audio pipe to OpenAI (no SDK abstraction layer)
3. ✅ **OpenAI Agents SDK** - Official `@openai/agents` package with `TwilioRealtimeTransportLayer`
4. ✅ **Simpler debugging** - Fewer layers = easier to troubleshoot

### **Audio Flow:**

```
Caller → SignalWire → WebSocket (g711_ulaw) → Barbara → 
  WebRTC (pcm16) → OpenAI Realtime → Response → 
  WebRTC → Barbara → WebSocket → SignalWire → Caller
```

---

## **Support**

For issues or questions, see:
- Main project README: `../README.MD`
- Master production plan: `../MASTER_PRODUCTION_PLAN.md`
- Deployment guides: `../docs/`


# Test deployment 10/25/2025 15:46:09
