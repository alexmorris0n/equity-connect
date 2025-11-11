# 🏗️ Current Architecture - LiveKit Cloud + Northflank

**Last Updated:** November 10, 2025  
**Status:** Active Production Architecture

---

## 📋 Overview

Equity Connect uses **LiveKit Cloud** for telephony infrastructure with a **Northflank-hosted agent worker** running the conversational AI.

---

## 🎯 Architecture Diagram

```
┌─────────────────┐
│  Phone Call     │
│  (PSTN)         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SignalWire     │  ← Phone number provider
│  SIP Trunk      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LiveKit Cloud  │  ← SIP ingestion, room creation, dispatch
│  - SIP Bridge   │
│  - Core         │
│  - Dispatch     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Northflank     │  ← Agent worker (livekit-agent/agent.py)
│  Agent Worker   │  ← Connects to LiveKit Cloud
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase       │  ← Database, templates, prompts, tools
│  - Postgres     │
│  - Storage      │
└─────────────────┘
```

---

## 🔧 Components

### 1. **LiveKit Cloud** (Managed Service)
- **SIP Bridge**: Accepts inbound calls from SignalWire
- **Core**: Room management, dispatch rules, WebRTC
- **Dispatch Rules**: Routes calls to agent workers
- **No self-hosting**: Fully managed by LiveKit

**Dashboard:** https://cloud.livekit.io

---

### 2. **Northflank Agent Worker** (Self-Hosted)
- **Location**: Northflank container
- **Code**: `livekit-agent/agent.py`
- **Dockerfile**: `deploy/agent/Dockerfile`
- **Purpose**: 
  - Connects to LiveKit Cloud
  - Loads STT/TTS/LLM configs from Supabase
  - Runs conversation graph (LangGraph)
  - Executes tools (appointments, KB search, etc.)

**Features:**
- Native LiveKit plugins (Deepgram STT, ElevenLabs TTS, OpenAI LLM)
- Template-driven configuration (Supabase `ai_templates`)
- Dynamic prompt loading (Supabase `prompts` + `prompt_versions`)
- Conversation state tracking (multi-call persistence)

---

### 3. **SignalWire** (Phone Provider)
- **Purpose**: PSTN phone numbers, SIP trunk to LiveKit Cloud
- **Flow**: 
  1. Call arrives at SignalWire number
  2. SignalWire SIP trunk forwards to LiveKit Cloud
  3. LiveKit dispatch rule creates room + triggers agent
  4. Agent worker joins room and handles conversation

**Configuration**: SignalWire numbers point SIP trunk to LiveKit Cloud SIP domain

---

### 4. **Supabase** (Database + Storage)
- **Postgres Tables**:
  - `leads` - Caller data
  - `ai_templates` - STT/TTS/LLM configs per scenario
  - `prompts` + `prompt_versions` - Conversation instructions
  - `conversation_state` - Multi-call persistence (NEW)
  - `appointments`, `calendar_availability`, etc.
  
- **Storage**:
  - Call recordings (if enabled)
  - Knowledge base embeddings
  
- **Edge Functions**:
  - System metrics collection
  - Webhook handlers

---

### 5. **Additional Services** (Separate from Agent)

#### **barbara-v3** (Fly.io)
- ElevenLabs conversational AI webhook handler
- Alternative to LiveKit agent (different use case)
- Location: `barbara-v3/`

#### **elevenlabs-webhook** (Fly.io)
- Webhook personalization for ElevenLabs
- Location: `elevenlabs-webhook/`

#### **portal** (Admin Dashboard)
- Vue.js admin interface
- Prompt management, template editor, analytics
- Location: `portal/`

---

## 🚀 Call Flow (Step-by-Step)

### Inbound Call:

1. **Caller dials SignalWire number** (e.g., +1-555-123-4567)
2. **SignalWire forwards via SIP** to LiveKit Cloud SIP bridge
3. **LiveKit Cloud dispatch rule**:
   - Creates room: `call-{caller_phone_number}`
   - Attaches metadata: `template_id`, `call_type`, `phone_number`, etc.
   - Triggers agent: `inbound-agent`
4. **Northflank worker receives job**:
   - Connects to room
   - Loads template from Supabase (`ai_templates`)
   - Loads prompt from Supabase (`prompts`)
   - Initializes STT (Deepgram), LLM (OpenAI), TTS (ElevenLabs)
5. **Agent starts conversation**:
   - LangGraph workflow (verify → qualify → answer → book → exit)
   - Tools: Supabase queries, calendar booking, knowledge base
   - Conversation state saved to `conversation_state` table
6. **Call ends**:
   - Agent marks call completed
   - Conversation state persisted for next call

---

## 📦 Deployment

### **Northflank Agent Worker**
```bash
# Build and deploy
docker build -f deploy/agent/Dockerfile -t equity-agent:latest .
# Push to Northflank registry (or use Northflank Git integration)
```

**Environment Variables** (set in Northflank):
```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
DEEPGRAM_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
OPENAI_API_KEY=your_key
OPENROUTER_API_KEY=your_key (optional)
GOOGLE_APPLICATION_CREDENTIALS_JSON={...} (optional)
```

---

## 🔍 Monitoring

### **LiveKit Cloud Dashboard**
- View active rooms
- Monitor agent connections
- Check SIP trunk status
- View dispatch rules

### **Northflank Logs**
```bash
# Check agent worker logs
# View in Northflank dashboard or CLI
```

### **Supabase**
- Query `conversation_state` for call history
- View agent tool usage logs
- Monitor system metrics

---

## 🛠️ Development

### **Local Testing** (Agent Worker)
```bash
cd livekit-agent
python agent.py start
```

The agent will:
1. Connect to LiveKit Cloud
2. Register as `inbound-agent` (or test agent name)
3. Wait for dispatch jobs
4. Handle test calls via SignalWire → LiveKit Cloud → local agent

---

## 📚 Key Differences from Old Architecture

| Feature | Old (Self-Hosted Fly.io) | New (LiveKit Cloud) |
|---------|-------------------------|---------------------|
| **SIP Bridge** | Fly.io container | LiveKit Cloud managed |
| **LiveKit Core** | Fly.io container | LiveKit Cloud managed |
| **Redis** | Fly.io container | Not needed (Cloud handles it) |
| **MinIO** | Fly.io container | Not needed (Supabase Storage) |
| **Agent Worker** | Fly.io container | Northflank container |
| **Dispatch Rules** | Manual livekit-cli | LiveKit Cloud dashboard |
| **Maintenance** | High (5 containers) | Low (1 container) |
| **Scaling** | Manual | Automatic (Cloud) |
| **Costs** | ~$40-60/month | ~$20-30/month |

---

## 🗂️ Folder Structure

```
equity-connect/
├── livekit-agent/           # Agent worker code
│   ├── agent.py             # Main entrypoint
│   ├── config.py            # Configuration
│   ├── services/            # Supabase services
│   ├── tools/               # Agent tools
│   ├── workflows/           # LangGraph conversation flow
│   └── providers/           # STT/TTS/LLM builders
├── deploy/
│   └── agent/
│       └── Dockerfile       # Northflank deployment
├── portal/                  # Admin dashboard (Vue.js)
├── barbara-v3/              # ElevenLabs webhook (Fly.io)
├── elevenlabs-webhook/      # Webhook handlers (Fly.io)
├── database/                # Supabase migrations
├── supabase/                # Supabase config
└── docs/                    # Documentation

DEPRECATED (archived):
├── bridge/                  # Old OpenAI Realtime bridge
└── self-hosted/             # Old Fly.io infrastructure
```

---

## 📞 Support

- **LiveKit Cloud**: https://docs.livekit.io/cloud
- **SignalWire**: https://developer.signalwire.com
- **Supabase**: https://supabase.com/docs

---

## ✅ Next Steps

1. **Configure LiveKit Cloud Dispatch Rules** with `template_id` metadata
2. **Test inbound calls** via SignalWire → LiveKit Cloud → Northflank
3. **Implement conversation state tracking** (LangGraph + `conversation_state` table)
4. **Add multi-call persistence** (caller recognition, state carryover)

---

**Architecture migrated to LiveKit Cloud on November 2025**

