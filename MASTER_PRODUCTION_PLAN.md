# Equity Connect - Master Production Plan

**Last Updated:** November 12, 2025  
**Status:** 🚧 Migration In Progress - SignalWire Agent SDK + Fly.io + BarbGraph Event-Based State Machine  
**Current Phase:** SignalWire SDK Integration + Fly.io Deployment + BarbGraph Migration Complete

---

## 🎯 System Overview

**Barbara LLC (Wyoming)** - Registered October 30, 2025

Equity Connect is an AI-powered lead generation and nurturing platform for reverse mortgage brokers. The system uses AI agents to autonomously pull qualified property leads, enrich them with contact data, and manage compliant multi-channel outreach campaigns.

**Production Domains:**
- **barbarapro.com** - Broker recruitment landing page (B2B)
- **app.barbarapro.com** - Admin portal and broker interface
- **Vercel Development:** https://equity-connect.vercel.app

**Key Innovation:** BarbGraph event-based state machine provides structured, adaptive conversations with 8 conversation nodes and dynamic routing based on real-time state.

**Tech Stack:**
- **AI Voice:** SignalWire Agent SDK + Fly.io Agent Worker
- **Voice Infrastructure:** SignalWire SIP + SignalWire AI Gateway (SWAIG)
- **AI Providers (Native SignalWire Integration):**
  - **LLM:** OpenAI (GPT-4o, GPT-4o-mini) - SignalWire SDK supports OpenAI by default. Other providers require custom integration.
  - **STT:** Deepgram (Nova-2/Nova-3), OpenAI (Whisper-1, GPT-4o Transcribe), AssemblyAI (Universal Streaming), Google Cloud (Latest Long/Short), Cartesia (Ink Whisper)
  - **TTS:** ElevenLabs (Tiffany voice), OpenAI TTS, Amazon Polly, Rime, Google Cloud TTS, Microsoft Azure, Cartesia, Speechify
  - **Multi-Provider Flexibility:** Mix-and-match with own API keys (no aggregator)
  - **Database-Driven Model Selection:** STT and LLM models loaded dynamically from `signalwire_available_stt_models` and `signalwire_available_llm_models` tables
- **AI Orchestration:** Gemini 2.5 Flash via OpenRouter (n8n workflows)
- **Telephony:** SignalWire SIP trunk + SignalWire Voice API
- **Recording Storage:** Supabase Storage (via SignalWire webhook)
- **Orchestration:** n8n (self-hosted on Northflank)
- **Database:** Supabase (PostgreSQL + pgvector)
- **Data Sources:** PropertyRadar API (property data + contact enrichment)
- **Outreach:** Instantly.ai (email), SignalWire voice agents
- **Integration:** MCP servers (Supabase, Instantly, Barbara, SwarmTrace)
- **Deployment:** Fly.io (agent worker) + SignalWire Cloud (managed telephony)

---

## 🏗️ Deployment Architecture (Monorepo)

```
equity-connect/ (Git Monorepo)
├── equity_connect/               → Fly.io Agent Worker (MIGRATION IN PROGRESS)
│   ├── app.py                    → Main entrypoint (SignalWire SDK)
│   ├── agent/
│   │   └── barbara_agent.py     → BarbGraph event-based routing (SignalWire AgentBase)
│   ├── Dockerfile                → Fly.io deployment
│   ├── fly.toml                  → Fly.io configuration (LAX primary region)
│   ├── workflows/                → BarbGraph routing logic
│   │   ├── node_completion.py   → Node completion checkers (8 nodes)
│   │   └── routers.py            → DB-driven routing functions (8 routers)
│   ├── services/                 → Business logic
│   │   ├── supabase.py          → Database client + utilities
│   │   ├── conversation_state.py → Multi-call persistence
│   │   └── prompt_loader.py     → Theme + node prompt loading
│   └── tools/                    → Agent function tools (21 tools)
│       ├── lead.py              → Lead lookup, DNC checks, consent
│       ├── knowledge.py         → Vector search
│       ├── calendar.py          → Nylas integration
│       ├── conversation_flags.py → State flag tools (7 tools)
│       ├── interaction.py       → Interaction logging
│       └── registry.py          → SignalWire SWAIG tool registration
├── livekit-agent/                → DEPRECATED (Legacy LiveKit system)
│   └── [files archived for reference]
├── deploy/                       → Deployment configs (DEPRECATED)
├── barbara-mcp/                  → Northflank (MCP server for n8n)
│   └── index.js                  → Outbound calls via SignalWire Voice API
├── portal/                       → Vue.js admin (Vercel)
│   └── src/views/admin/         → PromptManagement, LeadManagement, etc.
├── propertyradar-mcp/            → Docker/Local (property lookups)
├── swarmtrace-mcp/               → Docker/Local (analytics)
├── database/                     → Shared Supabase schema
├── workflows/                    → N8N workflow definitions
└── config/                       → API configurations
```

**Why Monorepo:**
- ✅ Portal needs to reference agent tool definitions
- ✅ MCPs share prompt templates and database schema
- ✅ Single source of truth for all configurations
- ✅ Simplified deployment (1 Northflank container)

**Deployment Triggers:**
- `equity_connect/**` changes → Deploy agent worker to Fly.io via GitHub Actions
- `portal/**` changes → Deploy to Vercel
- `workflows/**` changes → Update n8n workflows
- `database/**` changes → Run Supabase migrations

---

## 📊 Current Production Status

### 🤝 Broker Network

**Broker #1: Walter Richards** - California (ACTIVE)
- **Status:** Live in production
- **Territory:** California (primary focus)
- **Current Offset:** 750+ (PropertyRadar list)
- **Daily Capacity:** 100 leads/day configured
- **Campaigns:** All 3 archetypes active (No More Payments, Cash Unlocked, High Equity)
- **Phone Number:** MyReverseOptions1 (+14244851544)
- **Status:** Actively pulling leads, email campaigns running

**Broker #2: Dan Thomas** - Bay Area, California (COMPLETE)
- **Status:** ✅ **PRODUCTION READY - Fully Integrated**
- **Territory:** Bay Area (San Francisco, Oakland, San Jose metro areas)
- **Purpose:** Validates multi-broker scaling
- **Phone Number:** MyReverseOptions2 for West Coast
- **Status:** Both brokers running simultaneously, territory isolation working

---

## 🎙️ SignalWire Agent SDK Migration ⭐ **IN PROGRESS (NOV 12, 2025)**

**Status:** 🚧 **MIGRATION IN PROGRESS - Core Integration Complete, Testing Phase**

### Why SignalWire Over LiveKit

**Cost Efficiency:**
- ✅ No infrastructure management overhead
- ✅ Native multi-provider AI (mix Deepgram STT + ElevenLabs TTS + OpenAI LLM)
- ✅ Bring your own API keys (transparent pricing, no markup)
- ✅ No aggregator layer (EdenAI not needed)

**Developer Experience:**
- ✅ Official SDK with native plugins for all major providers
- ✅ SWAIG (SignalWire AI Gateway) for function calling
- ✅ Built-in SIP integration
- ✅ Simpler event model vs LiveKit

**Regional Performance:**
- ✅ Fly.io LAX deployment for CA customers (primary region)
- ✅ Future expansion to IAD for East Coast customers
- ✅ Auto-scaling for traffic spikes
- ✅ Edge deployment for lower latency

### Migration Architecture

**From:**
```
SignalWire SIP → LiveKit Cloud SIP Bridge → LiveKit Dispatch → Northflank Agent Worker (LiveKit SDK)
```

**To:**
```
SignalWire SIP → SignalWire Agent SDK → Fly.io Agent Worker (SignalWire SDK)
```

### Migration Status

**✅ Phase 1: Project Setup (COMPLETE)**
- ✅ Forked SignalWire Agent SDK (github.com/alexmorris0n/barbara)
- ✅ Created `equity_connect/` directory structure
- ✅ Identified SignalWire event hooks (`on_function_call`, `on_speech_committed`)
- ✅ Mapped LiveKit AgentSession → SignalWire Agent concepts

**✅ Phase 2: Core Migration (COMPLETE)**
- ✅ Converted `EquityConnectAgent` → `BarbaraAgent` (inherits from `AgentBase`)
- ✅ Integrated BarbGraph routing (all 8 routers unchanged, pure Python)
- ✅ Ported all 21 tools (converted `@function_tool` → `agent.define_tool()`)
- ✅ Preserved state management (conversation_state table logic unchanged)
- ✅ Fixed 3 theme duplication bugs in prompt loading

**✅ Phase 3: SignalWire-Specific Integration (COMPLETE)**
- ✅ Tool registration via SWAIG (`tools/registry.py`)
- ✅ Multi-provider AI configuration ready (STT/LLM/TTS templates)
- ✅ Event-based routing via `on_speech_committed` and `on_function_call`
- ✅ Conversation history preservation across node transitions

**✅ Phase 4: Fly.io Deployment (IN PROGRESS)**
- ✅ Created Dockerfile with correct Python module structure
- ✅ Configured fly.toml (LAX primary region, 2 CPUs, 1GB RAM)
- ✅ Set up GitHub Actions deployment workflow
- ✅ Deployed to Fly.io (`barbara-agent.fly.dev`)
- ⏳ Testing: SIP integration, tool calls, BarbGraph routing

### Critical Requirements (100% Preserved)

**✅ Database Schema - UNCHANGED**
- ✅ All field names identical (`primary_phone`, `primary_phone_e164`, `conversation_data`)
- ✅ All RLS policies unchanged
- ✅ All indexes unchanged
- ✅ Verified against live Supabase schema via MCP

**✅ Tools - Business Logic UNCHANGED**
- ✅ All 21 tools: function signatures, parameters, return types identical
- ✅ Only decorator changed: `@function_tool` → `agent.define_tool()` registration
- ✅ Lead Management (5), Calendar (4), Knowledge (1), Interaction (4), Flags (7)

**✅ BarbGraph Routing - UNCHANGED**
- ✅ All 8 router functions (pure Python, no changes)
- ✅ All 8 completion checkers (pure Python, no changes)
- ✅ Router decision logic based on conversation_data JSONB flags
- ✅ Dynamic routing conditions (wrong_person, ready_to_book, etc.)

**✅ Prompt System - UNCHANGED**
- ✅ Theme prompts from `theme_prompts` table
- ✅ Node prompts from `prompt_versions` table
- ✅ Context injection logic (call_type, lead_context, phone_number)
- ✅ Prompt combination order: Theme → Context → Node

### Bug Fixes During Migration

**Bug 1:** Theme duplication in `_load_initial_prompt()` - **FIXED**
**Bug 2:** Theme duplication in `_route_to_node()` - **FIXED**
**Bug 3:** Theme duplication in `build_instructions_for_node()` - **FIXED**
**Bug 4:** Dockerfile CMD path incorrect - **FIXED**

### Files Created/Modified

**New Files:**
- `equity_connect/app.py` - SignalWire entry point
- `equity_connect/agent/barbara_agent.py` - SignalWire AgentBase integration
- `equity_connect/tools/registry.py` - SWAIG tool registration
- `equity_connect/Dockerfile` - Fly.io container
- `equity_connect/fly.toml` - Fly.io configuration
- `equity_connect/requirements.txt` - SignalWire SDK dependencies
- `.github/workflows/deploy.yml` - GitHub Actions deployment

**Modified Files:**
- `equity_connect/services/prompt_loader.py` - Added `build_instructions_for_node()`
- All tool files (removed `@function_tool` decorators, kept business logic)

### Testing Checklist

**Before Production:**
- [ ] 10 test calls through full 8-node flow
- [ ] Verify database queries use correct field names
- [ ] Confirm tool schemas match LiveKit exactly
- [ ] Test multi-call scenarios (call back same number)
- [ ] Verify theme + node prompts loading correctly
- [ ] Test spouse handoff (wrong_person → re-greet)
- [ ] Test QUOTE node routing
- [ ] Validate SIP integration end-to-end

### Success Metrics (Compare to LiveKit Baseline)

- [ ] Routing latency <100ms
- [ ] Tool call success rate >99%
- [ ] Conversation history preserved 100%
- [ ] Multi-call persistence working
- [ ] Zero schema drift
- [ ] All 21 tools functional with identical output

**Status:** ✅ **CORE MIGRATION COMPLETE - Testing Phase (November 12, 2025)**

### ✅ Phase 5: Voice Configuration & Pricing System (COMPLETE - NOV 12, 2025)
- ✅ Created comprehensive voice pricing transparency system
- ✅ Integrated into `BarbaraConfig.vue` TTS tab (new configurator)
- ✅ 7 TTS providers supported with pricing tiers:
  - **Standard Tier** ($0.008/1k chars): OpenAI, Amazon Polly, Microsoft Azure, Google Cloud, Cartesia
  - **Mid Tier** ($0.12/1k chars): Rime
  - **Premium Tier** ($0.297/1k chars): ElevenLabs
- ✅ Real-time cost estimation and provider comparison
- ✅ 400+ voices catalogued with gender filtering
- ✅ Manual voice ID override for custom voices
- ✅ Components: VoiceSelector, VoiceCostCalculator, VoicePricingComparison

**Key Files:**
- `portal/src/components/VoiceSelector.vue` - Voice picker with pricing badges
- `portal/src/components/VoiceCostCalculator.vue` - Interactive cost estimator
- `portal/src/components/VoicePricingComparison.vue` - Provider comparison table
- `portal/src/constants/voices.ts` - Voice data with pricing metadata
- `portal/src/components/BarbaraConfig.vue` - Updated TTS tab with pricing components

**Status:** ✅ **VOICE PRICING SYSTEM COMPLETE (November 12, 2025)**

---

## 🎙️ LiveKit Cloud Voice System (DEPRECATED) ⚠️

**Status:** ⚠️ **DEPRECATED - Being Replaced by SignalWire Agent SDK**

This section preserved for reference during migration. The LiveKit system was production-ready but is being replaced by SignalWire for better cost control and simpler architecture.

<details>
<summary>Click to view LiveKit architecture (reference only)</summary>

### Architecture Overview

**LiveKit Cloud (Managed Services):**
- SIP Bridge - Accepts inbound calls from SignalWire
- Core Server - Room management, WebRTC, dispatch rules
- Dispatch Rules - Routes calls to agent workers with metadata
- Global Edge Network - Low latency worldwide
- No infrastructure management needed

**Northflank Agent Worker:**
- Container: `deploy/agent/Dockerfile`
- Code: `livekit-agent/agent.py`
- Connects to LiveKit Cloud via WebSocket
- Loads AI templates from Supabase `ai_templates` table
- Executes BarbGraph event-based routing (8 nodes)
- Tools: 21 tools (lead lookup, calendar booking, knowledge search, state flags)

### AI Provider Architecture (LiveKit Inference)

**Unified Billing:** Single invoice from LiveKit for all AI services

**STT Providers:**
- Deepgram (Nova-2/Nova-3) - Best-in-class streaming STT
- AssemblyAI - Industry-leading streaming STT
- Cartesia - Fast, accurate transcription
- OpenAI Whisper - High accuracy

**TTS Providers:**
- ElevenLabs (Tiffany voice) - Most natural neural TTS, custom voices
- Cartesia - Fast API responses
- Inworld - Robust neural voices
- Rime - Fast API responses, good for agent-style
- OpenAI - Built-in TTS
- Google - Scalable, multilingual

**LLM Providers:**
- OpenAI (GPT-4o) - Powerful all-rounder
- Anthropic (Claude) - Excellent reasoning
- Google (Gemini) - Fast, cost-effective
- DeepSeek - Cost-efficient
- Qwen - Multilingual support
- Kimi - Long context

**String Format Examples:**
- STT: `"deepgram/nova-2:en"` or `"assemblyai/universal-streaming:en"`
- TTS: `"elevenlabs/eleven_turbo_v2_5:6aDn1KB0hjpdcocrUkmq"` (Tiffany voice)
- LLM: `"openai/gpt-4o"` or `"anthropic/claude-3-5-sonnet-20241022"`

### Template System (`ai_templates` table)

Each AI template in Supabase defines complete voice pipeline:
- STT Configuration: Provider, model, language
- TTS Configuration: Provider, model, voice_id (custom voices via `model:voice_id` format)
- LLM Configuration: Provider, model, temperature, max_tokens
- VAD Settings: silence_duration_ms, vad_threshold, prefix_padding_ms
- Turn Detection: EnglishModel with built-in EOU (End of Utterance) for semantic turn detection
- Interruption Settings: allow_interruptions, min_duration, resume_false_interruption
- Endpointing: min/max delays for turn-taking (0.1s min, 3.0s max recommended)

### Call Flow

```
SignalWire SIP Trunk
    ↓
LiveKit Cloud SIP Bridge
    ↓
LiveKit Dispatch Rule (with metadata)
    ├─ template_id: UUID of AI template
    ├─ call_type: inbound-qualified/unqualified/unknown
    ├─ phone_number: Caller's phone (FROM header)
    └─ lead_id: Supabase lead UUID (if known)
    ↓
Northflank Agent Worker picks up job
    ├─ Loads template from Supabase
    ├─ Initializes STT via LiveKit Inference (e.g., "deepgram/nova-2:en")
    ├─ Initializes TTS via LiveKit Inference (e.g., "elevenlabs/eleven_turbo_v2_5:6aDn1KB0hjpdcocrUkmq")
    ├─ Initializes LLM via LiveKit Inference (e.g., "openai/gpt-4o")
    ├─ Configures turn detection (EnglishModel with EOU)
    ├─ Queries lead by phone number (primary_phone, primary_phone_e164)
    ├─ Loads theme prompt from theme_prompts table
    ├─ Loads node prompt from prompt_versions table
    ├─ Combines: Theme → Call Context → Node Prompt
    └─ Starts AgentSession with BarbGraph routing
    ↓
BarbGraph Event-Based Conversation Flow
    ├─ User speaks → STT transcribes → LLM processes → TTS synthesizes → Agent responds
    ├─ 21 tools available: lead lookup, knowledge search, calendar booking, state flags
    ├─ agent_speech_committed event fires after each turn
    ├─ Routing check: is_node_complete(current_node, state)?
    ├─ Dynamic routing: route_after_*(state) decides next node
    ├─ Node transitions: load_node(next_node) updates instructions
    └─ Conversation history preserved across all node transitions
    ↓
Call ends, metadata saved to interactions table
```

### Benefits

**LiveKit Cloud:**
- ✅ Zero Infrastructure Management - No servers, no ops, no DevOps
- ✅ Global Edge Network - Low latency worldwide automatically
- ✅ Free Tier - No base costs, only pay for AI providers via LiveKit Inference
- ✅ Auto-Scaling - Handles traffic spikes automatically
- ✅ Built-in Redundancy - High availability out of the box
- ✅ 60% Cost Reduction - vs self-hosted infrastructure

**LiveKit Inference:**
- ✅ Unified Billing - Single invoice for all AI services (STT + LLM + TTS)
- ✅ Lower Latency - Models co-located on LiveKit's edge network
- ✅ Custom Voice Support - ElevenLabs custom voices via string format (Tiffany voice working)
- ✅ Flexible Provider Selection - Easy switching between DeepSeek, Claude, Gemini, etc.
- ✅ Official Pricing Transparency - Clear per-minute costs from LiveKit pricing page
- ✅ Simplified Configuration - String-based model descriptors (no plugin imports)
- ✅ Tool/Function Calling Support - All providers support tools through unified interface

**Template Configuration Example:**

```json
{
  "name": "Premium (ElevenLabs + GPT-4o)",
  "stt_provider": "deepgram",
  "stt_model": "nova-2",
  "stt_language": "en-US",
  "tts_provider": "elevenlabs",
  "tts_model": "eleven_turbo_v2_5",
  "tts_voice_id": "6aDn1KB0hjpdcocrUkmq",
  "llm_provider": "openai",
  "llm_model": "gpt-4o",
  "llm_temperature": 0.8,
  "llm_max_tokens": 4096,
  "vad_threshold": 0.5,
  "vad_prefix_padding_ms": 300,
  "vad_silence_duration_ms": 500,
  "min_endpointing_delay": 0.1,
  "max_endpointing_delay": 3.0,
  "allow_interruptions": true,
  "min_interruption_duration": 0.5,
  "estimated_cost_per_minute": 1.06
}
```

**Status:** ✅ **LIVEKIT INFERENCE MIGRATION COMPLETE (Nov 11, 2025)**
- ✅ Agent worker deployed to Northflank with LiveKit Inference integration
- ✅ LiveKit Cloud dispatch rules configured
- ✅ Template system migrated to LiveKit Inference string format
- ✅ All AI providers now billed through unified LiveKit invoice
- ✅ Custom ElevenLabs voice (Tiffany) working via string format
- ✅ Turn detection with EnglishModel EOU for semantic understanding
- ✅ Supabase schema updated with new providers (DeepSeek, Qwen, Kimi, Cartesia, Inworld, Rime)
- ✅ Vue portal updated with accurate LiveKit Inference pricing
- ✅ 4 system presets created: Premium, Budget, Spanish, Ultra-Fast
- ✅ Database migration applied to update existing templates

</details>

---

## 🎯 BarbGraph - Event-Based State Machine Architecture ⭐ **PRODUCTION READY (NOV 11, 2025)**

**Status:** ✅ **IMPLEMENTATION COMPLETE - All 3 Plans Integrated + 6 Critical Bugs Fixed + QUOTE Node Added + Theme System Active**

### Overview

BarbGraph is an event-based state machine that orchestrates multi-stage conversations for voice AI agents. It provides structured, adaptive dialogue management with 8 conversation nodes and dynamic routing based on real-time database state.

**Why "BarbGraph"?**
- Event-driven architecture (simpler than LangGraph)
- AgentSession conversation history is AUTOMATICALLY preserved across node switches
- Manual routing is simpler, more debuggable, and production-proven
- Database-driven state management (no complex state machines)

### Architecture: 3-Layer System

```
┌─────────────────────────────────────────────────────────────┐
│                     LAYER 1: FRONTEND                        │
│  Vue Portal - Node-Based Prompt Editor (PromptManagement.vue)│
│  • Vertical selector (reverse_mortgage, solar, hvac)        │
│  • 8-node tab navigation (greet, verify, qualify, quote,    │
│    answer, objections, book, exit)                          │
│  • JSONB content editor (role, instructions, tools)         │
│  • Save/Load via Supabase RPC                               │
└─────────────────────────────────────────────────────────────┘
                              ▼ saves to
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 2: DATABASE                         │
│  Supabase PostgreSQL                                         │
│  • theme_prompts table (universal personality per vertical) │
│  • prompts table (vertical, node_name, current_version)     │
│  • prompt_versions table (content JSONB, version_number)    │
│  • conversation_state table (conversation_data JSONB)        │
│  • active_node_prompts view (latest active prompts)         │
│  • get_node_prompt() RPC (query with fallback)              │
└─────────────────────────────────────────────────────────────┘
                              ▼ loads from
┌─────────────────────────────────────────────────────────────┐
│                     LAYER 3: BACKEND                         │
│  LiveKit Agent Worker (Northflank)                           │
│  • EquityConnectAgent class (custom Agent subclass)         │
│  • Event-based routing (agent_speech_committed hook)        │
│  • Prompt loader (Theme + Node + Context injection)        │
│  • State flag tools (mark_ready_to_book, etc.)              │
│  • Node completion checkers (is_node_complete)              │
│  • Dynamic routers (route_after_greet, etc.)                │
└─────────────────────────────────────────────────────────────┘
```

### 8-Node Conversation Flow

```
greet → verify → qualify → QUOTE → answer → objections → book → exit
```

**Node Descriptions:**
1. **Greet** - Warm introduction, set tone, build rapport
2. **Verify** - Confirm identity, gather basic info
3. **Qualify** - Ask qualification questions naturally (age, home ownership, equity)
4. **Quote** - Present personalized financial estimates (equity × 0.50 to 0.60)
5. **Answer** - Respond to questions, address concerns, provide information
6. **Objections** - Handle objections, reframe concerns, build trust
7. **Book** - Secure appointment commitment, schedule with broker
8. **Exit** - Graceful conclusion or handoff (can re-greet if spouse available)

### Theme Prompt System (Two-Layer Architecture)

**Purpose:** Eliminate personality duplication across 8 nodes

**Architecture:**
- **Theme Layer (Universal):** Defines Barbara's core personality for the entire vertical
- **Node Layer (Specific):** Defines actions and goals for each conversation stage

**Injection Order:**
```
Theme (from theme_prompts table)
  ↓
Call Context (injected by agent)
  ↓
Node Prompt (from prompt_versions table)
  ↓
Final Combined Prompt
```

**Benefits:**
- ✅ No duplication (personality defined once, not 8 times)
- ✅ Easy maintenance (update personality in one place)
- ✅ Consistency (all nodes use same core personality)
- ✅ Flexibility (different verticals can have different personalities)

**Database Schema:**
```sql
CREATE TABLE theme_prompts (
    id UUID PRIMARY KEY,
    vertical TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### Dynamic Routing

**Key Principle:** Routing is DYNAMIC, not fixed. The router examines actual DB state to decide where to go next.

**Example Scenarios:**
- Senior says "my spouse handles this" → greet (re-greet spouse)
- Senior asks question mid-qualify → answer (skip ahead)
- Objection comes up during answer → objections
- Ready to book anytime → book
- Wrong person → exit

**All 8 nodes are ALWAYS available. The router decides based on conversation_data flags.**

### State Management

**Database Schema:**
```sql
CREATE TABLE conversation_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number TEXT NOT NULL UNIQUE,
    lead_id UUID REFERENCES leads(id),
    qualified BOOLEAN,
    conversation_data JSONB DEFAULT '{}',
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**conversation_data JSONB Fields:**
```json
{
  "greeted": true,
  "verified": true,
  "qualified": true,
  "quote_presented": true,
  "quote_reaction": "positive",
  "questions_answered": false,
  "ready_to_book": false,
  "has_objections": false,
  "objection_handled": false,
  "appointment_booked": false,
  "appointment_id": null,
  "wrong_person": false,
  "right_person_available": false,
  "node_before_objection": "answer"
}
```

### 21 Tools Verified

**Lead Management Tools (5):**
- `get_lead_context` - Query lead by phone
- `verify_caller_identity` - Verify identity, create lead if new
- `check_consent_dnc` - Verify calling permissions
- `update_lead_info` - Update lead data
- `find_broker_by_territory` - Assign broker by ZIP/city

**Calendar Tools (4):**
- `check_broker_availability` - Nylas calendar free/busy
- `book_appointment` - Create Nylas event + billing
- `reschedule_appointment` - Reschedule existing appointment
- `cancel_appointment` - Cancel appointment

**Knowledge Tool (1):**
- `search_knowledge` - Vector search via Vertex AI

**Interaction Tools (4):**
- `save_interaction` - Log call with metadata
- `assign_tracking_number` - Link SignalWire number
- `send_appointment_confirmation` - Send confirmation
- `verify_appointment_confirmation` - Verify confirmation code

**Conversation Flow Flag Tools (7):**
- `mark_ready_to_book` - Caller wants to book
- `mark_has_objection` - Caller has concerns
- `mark_objection_handled` - Objection resolved
- `mark_questions_answered` - All questions answered
- `mark_quote_presented` - Quote presented with reaction
- `mark_wrong_person` - Wrong person answered
- `clear_conversation_flags` - Reset routing flags

### System Verification Results

**✅ All 21 Tools Verified:**
- Every tool referenced in prompts EXISTS in code
- All tools EXPORTED in `tools/__init__.py`
- All tools DECORATED with `@function_tool`
- NO MISSING TOOLS
- NO ORPHANED REFERENCES

**✅ Field Names Correct:**
- Database uses: `primary_phone` and `primary_phone_e164` ✓
- Code uses: `primary_phone` consistently ✓
- Tools query with: `primary_phone.ilike` and `primary_phone_e164.eq` ✓

**✅ SIP Trunk Minimal Data:**
- Only phone number required from SIP ✓
- Agent enriches everything else (template, lead, broker, theme, node)
- No external dependencies beyond phone number + template_id

**✅ LiveKit Function Calling:**
- `@function_tool` decorator auto-generates schemas ✓
- AgentSession sends schemas to LLM ✓
- LLM calls tools by name with JSON params ✓
- AgentSession executes Python functions ✓
- Results returned to LLM for conversation ✓

**Status:** ✅ **PRODUCTION READY - All Systems Verified (November 11, 2025)**

### Implementation Complete

**Plan 1: Backend Agent (Python/LiveKit)** - ✅ **COMPLETE**
- ✅ Created node completion checker (`workflows/node_completion.py`) - 8 nodes
- ✅ Created prompt loader with theme + database integration (`services/prompt_loader.py`)
- ✅ Created 7 state flag setter tools (`tools/conversation_flags.py`)
- ✅ Updated existing tools to set state flags (lead.py, calendar.py)
- ✅ Extended Agent class with event-based routing logic (agent.py)
- ✅ Hooked event-based routing via `agent_speech_committed` event
- ✅ Updated tool exports (__init__.py) - 21 tools total
- ✅ Added vertical + call_type + lead_context support for multi-vertical routing
- ✅ Added QUOTE node routing and tools

**Plan 2: Database Schema Migration (Supabase)** - ✅ **COMPLETE**
- ✅ Created `theme_prompts` table for universal personality
- ✅ Added `vertical` and `node_name` columns to `prompts` table
- ✅ Created `active_node_prompts` view for efficient queries
- ✅ Created `get_node_prompt()` RPC function for agent runtime
- ✅ Updated RLS policies and indexes
- ✅ Seeded reverse_mortgage theme (695 chars)
- ✅ Stripped personality from all 8 node prompts (moved to theme)
- ✅ Added QUOTE node to prompts and prompt_versions

**Plan 3: Vue Portal UI (PromptManagement.vue)** - ✅ **COMPLETE**
- ✅ Added vertical selector dropdown (reverse_mortgage, solar, hvac)
- ✅ Added 8-node tab navigation with visual indicators
- ✅ Integrated prompt editor with JSONB content structure
- ✅ Smart save button (switches between node save and legacy save)
- ✅ Database load/save integration via `active_node_prompts` view

**Critical Bug Fixes (6 Total):**
1. ✅ Fixed `update_conversation_state()` nested structure (9 calls across 3 files)
2. ✅ Fixed silent fallthrough on empty database content
3. ✅ Fixed missing `await` in `load_node()` greeting
4. ✅ Fixed missing `await` in `check_and_route()` goodbye
5. ✅ Fixed instructions not persisting on node transitions (**MOST CRITICAL**)
6. ✅ Fixed hardcoded "END" bypassing re-greeting logic

### Key Features

✅ **Event-Based Routing** - Agent speech completion triggers routing checks  
✅ **Database-Driven Prompts** - Vue Portal edits → Supabase → Agent runtime (instant updates)  
✅ **Multi-Vertical Support** - reverse_mortgage, solar, hvac (via vertical parameter)  
✅ **Theme System** - Universal personality per vertical, no duplication  
✅ **Context Injection** - Same prompt adapts to inbound/outbound, qualified/unqualified  
✅ **7 State Flag Tools** - LLM signals routing intent (ready_to_book, objections, etc.)  
✅ **Dynamic Routing** - All 8 nodes always available, router decides based on conversation  
✅ **Conversation History Preserved** - Full context maintained across all node transitions  
✅ **Re-Greeting Logic** - Handles spouse handoff scenarios dynamically  
✅ **QUOTE Node** - Presents financial estimates before Q&A phase  

### Files Modified

**Backend:**
- `livekit-agent/agent.py` - Event-based routing + bug fixes
- `livekit-agent/services/prompt_loader.py` - Theme + node loading + context injection
- `livekit-agent/workflows/routers.py` - 8 router functions (added route_after_quote)
- `livekit-agent/workflows/node_completion.py` - 8 completion checkers (added quote)
- `livekit-agent/tools/conversation_flags.py` - 7 state flag tools (added mark_quote_presented)
- `livekit-agent/tools/lead.py` - State update fixes
- `livekit-agent/tools/calendar.py` - State update fixes
- `livekit-agent/tools/__init__.py` - Tool registrations (21 tools)

**Frontend:**
- `portal/src/views/admin/PromptManagement.vue` - Vertical selector + 8-node tabs + database integration

**Database:**
- `theme_prompts` table - Universal personality per vertical
- `prompts` table - 8 nodes per vertical
- `prompt_versions` table - Versioned content (personality removed, moved to theme)
- `conversation_state` table - Routing flags in conversation_data JSONB

**Documentation:**
- `BARBGRAPH_COMPREHENSIVE_GUIDE.md` - Complete system guide
- `BARBGRAPH_CURRENT_PROMPTS.md` - All 8 node prompts documented
- `BARBGRAPH_SYSTEM_VERIFICATION.md` - System verification results
- `THEME_AND_QUOTE_IMPLEMENTATION_COMPLETE.md` - Implementation summary

**Status:** ✅ **PRODUCTION READY - All Plans Integrated, All Bugs Fixed, QUOTE Node Added, Theme System Active (November 11, 2025)**

---

## 📊 Lead Acquisition & Enrichment

### AI Daily Lead Acquisition (`workflows/AI_Daily_Lead_Pull.json`)

**Status:** ✅ **PRODUCTION READY**

- **REPLACES 5 WORKFLOWS:** Pull Worker, Enrichment Waterfall, Campaign Feeder, Q2H Backfill, EOD Backfill
- **AI Agent (Gemini 2.5 Flash)** orchestrates entire lead generation pipeline
- **13 nodes** (vs 135 in old system) - 90% reduction
- **Completes in 2-3 minutes** (vs all-day with old system)
- **Tools:** Supabase MCP, PropertyRadar HTTP, SwarmTrace MCP, Instantly HTTP, Calculator
- **Features:**
  - Autonomous pull + enrich + insert + upload loop
  - Surplus tracking (adjusts next day's pull based on over/under delivery)
  - Batch operations (multi-row INSERT, bulk Instantly upload)
  - Dynamic capacity per broker
  - Self-healing error recovery
  - Real-time token usage tracking via Get Execution node
  - Enhanced Slack notifications with actual cost metrics
- **Cost:** ~$0.0008/run in AI costs (Gemini), ~$15/day total (mostly PropertyRadar)
- **Status:** ✅ Production-ready, scheduled 6am PT Mon-Fri
- **Current offset:** 750+ (Walter Richards)

### Vector Store Knowledge Base

**Status:** ✅ **PRODUCTION READY**

- **Content:** Reverse mortgage knowledge (eligibility, psychology, objections, fees, compliance)
- **Source Files:** `docs/REVERSE_MORTGAGE_VECTOR_DATABASE/` (5 section files)
- **Broker-agnostic:** ({{broker_name}}, {{broker_nmls}} placeholders)
- **Compliance-approved language**
- **Schema:** `vector_embeddings` table with HNSW index
- **Integration:** Barbara searches KB during calls via `search_knowledge` tool (20s timeout)
- **Model:** text-embedding-3-small (3x faster than ada-002, cheaper, similar quality)
- **Used By:**
  - n8n email reply handler (instant accurate responses)
  - Barbara voice calls (prevents hallucinations on factual questions)

---

## 🎯 Portal & Admin Interface

### Vue.js Prompt Management Portal

**Status:** ✅ **PRODUCTION READY**

**Core Features:**
- ✅ **8-Node Tabs** - Greet, Verify, Qualify, Quote, Answer, Objections, Book, Exit
- ✅ **Vertical Selector** - reverse_mortgage, solar, hvac
- ✅ **Theme Editor** - Universal personality per vertical
- ✅ **Node Editor** - JSONB content (role, instructions, tools)
- ✅ **Smart Save Button** - Creates new version, deactivates old
- ✅ **Live Reload** - Agent picks up changes immediately on next call
- ✅ **Version Control** - Rollback to previous versions
- ✅ **Database Integration** - Loads/saves via Supabase RPC

### BarbGraph Vertical Manager (Verticals.vue)

**Status:** ✅ **PRODUCTION READY (November 13, 2025)**

**Core Features:**
- ✅ **Vertical-Level Versioning** - All nodes share a single version number per vertical
- ✅ **Global Settings Tabs** - Theme, Models & Voice, Telephony, Safety
- ✅ **Dynamic Model Selection** - STT, LLM, and TTS models loaded from database
- ✅ **Database-Driven Voice Catalog** - 400+ voices from `signalwire_available_voices` table
- ✅ **STT Model Catalog** - Models from `signalwire_available_stt_models` table (English/Spanish)
- ✅ **LLM Model Catalog** - OpenAI models from `signalwire_available_llm_models` table
- ✅ **Multi-Select Tools Dropdown** - Searchable tool selector with baseline flow flags filtered
- ✅ **Responsive Layout** - Desktop (horizontal node cards), mobile (vertical stack)
- ✅ **Version History Bar** - Left sidebar (desktop) or top bar (mobile)
- ✅ **Real-Time Preview** - Combined prompt preview (Theme + Context + Node)

**Database Tables:**
- `signalwire_available_voices` - TTS voice catalog (7 providers, 400+ voices, English/Spanish)
- `signalwire_available_stt_models` - STT model catalog (5 providers, English/Spanish models)
- `signalwire_available_llm_models` - LLM model catalog (OpenAI only - SignalWire default)
- `theme_prompts` - Global vertical configuration (theme content + config JSONB)

### Lead Management Portal

**Status:** ✅ **PRODUCTION READY**

**Core Features:**
- ✅ **Lead List Page** - Advanced filtering, sorting, search
- ✅ **Lead Detail Page** - Timeline view with interaction history
- ✅ **Call Transcript Modal** - Full conversation history
- ✅ **Automated Call Evaluation Scores** - AI-powered quality analysis
- ✅ **Google Maps Integration** - Property location display
- ✅ **Responsive Design** - Mobile and desktop optimized

### System Metrics Dashboard

**Status:** ✅ **PRODUCTION READY**

**Core Features:**
- ✅ **Infrastructure Monitoring** - Fly.io, Northflank, OpenAI, Gemini, SignalWire
- ✅ **Service Health Cards** - Real-time status for all platforms
- ✅ **6-Ring Health Visualization** - Concentric ring design
- ✅ **Auto-Refresh** - Every 2 minutes (120s)
- ✅ **Dark Mode Support** - Full theme integration

---

## 📞 Telephony & Voice

### SignalWire Phone Number Pool

**Status:** ✅ **ACTIVE**

**5 SignalWire Numbers:**
- **MyReverseOptions1** (+14244851544) - CA territory (Walter's primary)
- **MyReverseOptions2** (+14245502888) - OR, WA territories
- **MyReverseOptions3** (+14245502229) - TX, AZ territories  
- **MyReverseOptions4** (+14245502223) - FL, GA territories
- **MyReverseOptions5** (+14246724222) - NY, NJ, IL, IN territories

**Database Integration:** `signalwire_phone_numbers` table with territory-based routing

### LiveKit Cloud SIP Integration

**Status:** ✅ **PRODUCTION READY**

**Call Flow:**
1. SignalWire receives call
2. SWML routes to LiveKit SIP (sip:xxx@4dyilq13lp1.sip.livekit.cloud)
3. LiveKit dispatch rule triggers
4. Passes metadata: `template_id`, `call_type`, `phone_number`
5. Northflank agent worker picks up job
6. Agent loads template, theme, node prompt
7. BarbGraph routing begins (8-node flow)
8. Call ends, metadata saved to interactions table

**Minimal SIP Data Required:**
- Only phone number needed from SIP trunk
- Agent enriches: template, lead, broker, theme, node
- All data from Supabase (no external dependencies)

---

## 💰 Economics

### Cost Per Lead (Moonshot: 100 Brokers × 100 Leads/Day)

**PropertyRadar Economics:**
- **Territory size:** 45,000-50,000 properties per broker
- **Quarterly refresh:** ~15% new properties (6,750-7,500)
- **Annual refresh:** ~60% new properties (27,000-30,000)
- **Daily capacity:** 100 leads × 22 work days/month × 12 months = 26,400/year
- **Territory longevity:** Auto-refreshing dynamic lists (no burnout)

**Cost Structure:**
- PropertyRadar subscription: $599/month (50k exports, 50k imports, 2.5k free contacts)
- PropertyRadar exports (100 leads/day): $0.01/record = $1.00/day
- PropertyRadar contacts (100 leads/day): $0.04/contact = $4.00/day
- SwarmTrace skip trace (~18/day fallback): $0.0125/lead = $0.23/day
- Instantly.ai (4-email campaign): ~$0.01/email = $0.40/day
- **Total daily cost per broker:** $5.63/day (100 leads)
- **Monthly cost per broker:** $124/month

### Broker Revenue (Performance-Based)
- **Appointment showed:** $300-$350 per show
- **That's it.** Simple, clean pricing.

### Daily Economics (Moonshot: 100 Brokers × 100 Leads/Day)

**Costs (22 working days/month):**
- PropertyRadar subscription allocation: $0.27/day
- PropertyRadar exports: $1.00/day
- PropertyRadar contacts: $4.00/day
- SwarmTrace skip trace (~18/day): $0.23/day
- Instantly.ai (4-email campaign): $0.40/day
- **Total cost: $5.90/day per broker** (100 leads)

**Revenue (At Target Performance):**
- 0.8 appointment shows/day × $350 = **$280/day**
- **Gross profit: $274.10/day per broker**
- **Margin: 97.9%**

**Monthly (Per Broker):**
- Revenue: $280 × 22 = **$6,160/month**
- Costs: $5.90 × 22 = **$130/month**
- **Profit: $6,030/month per broker**

**At 100 Brokers Scale (Moonshot):**
- Monthly revenue: **$616,000**
- Monthly costs: **$13,000**
- **Monthly profit: $603,000**
- **Annual profit: $7.24M**

---

## 🚀 Next Steps

### Immediate Priorities

1. **Test BarbGraph 8-Node Flow**
   - [ ] Test node transitions (greet→verify→qualify→quote→answer→objections→book→exit)
   - [ ] Test state flag tools (mark_ready_to_book, mark_has_objection, mark_quote_presented, etc.)
   - [ ] Test spouse handoff scenario (wrong_person → right_person_available → re-greet)
   - [ ] Test QUOTE node routing based on reaction (positive/skeptical/needs_more/not_interested)

2. **Monitor Production Metrics**
   - [ ] Monitor AI provider costs and latency via LiveKit dashboard
   - [ ] Track node completion rates (% who reach each stage)
   - [ ] Monitor conversation quality (transcript analysis)
   - [ ] A/B test different provider combinations (DeepSeek vs Claude, Cartesia vs ElevenLabs)

3. **Portal Enhancements**
   - [ ] Add theme editor UI to Vue Portal
   - [ ] Add analytics dashboard for node performance
   - [ ] Add A/B testing interface for prompt versions
   - [ ] Add call replay functionality (if audio available)

### Future Enhancements

1. **Multi-Vertical Expansion**
   - [ ] Add solar vertical prompts
   - [ ] Add HVAC vertical prompts
   - [ ] Test vertical switching logic

2. **Advanced Features**
   - [ ] ML model predicts best next node based on conversation history
   - [ ] Sentiment analysis influences routing (frustrated → objections)
   - [ ] Multi-language support (same node structure, different language prompts)
   - [ ] Visual flow editor (drag-and-drop node creation)

3. **Analytics & Optimization**
   - [ ] Conversion funnel by node (% who reach each stage)
   - [ ] Average time spent per node
   - [ ] Most common exit points
   - [ ] Performance comparison across prompt versions

---

## 📚 Documentation

### Core Documentation
- **`BARBGRAPH_COMPREHENSIVE_GUIDE.md`** - Complete system guide (non-technical + technical)
- **`BARBGRAPH_CURRENT_PROMPTS.md`** - All 8 node prompts documented
- **`BARBGRAPH_SYSTEM_VERIFICATION.md`** - System verification results (21 tools, field names, data flow)
- **`THEME_AND_QUOTE_IMPLEMENTATION_COMPLETE.md`** - Theme system + QUOTE node implementation
- **`MASTER_PRODUCTION_PLAN.md`** - This file (complete system overview)

### Architecture Documentation
- **`CURRENT_ARCHITECTURE.md`** - Complete architecture overview
- **`livekit-agent/agent.py`** - Main agent with BarbGraph routing
- **`livekit-agent/services/prompt_loader.py`** - Theme + node loading
- **`livekit-agent/workflows/routers.py`** - 8 dynamic routing functions
- **`livekit-agent/workflows/node_completion.py`** - 8 completion checkers

### Database Documentation
- **`database/migrations/20251111_add_theme_prompts.sql`** - Theme table creation
- **`database/migrations/20251111_add_quote_node_prompt.sql`** - QUOTE node creation
- **`database/migrations/20251111_strip_personality_from_nodes.sql`** - Personality removal
- **`database/migrations/20251111_add_livekit_inference_providers.sql`** - LiveKit Inference providers
- **`database/migrations/20251111_update_templates_for_livekit_inference.sql`** - Template migration

---

## ✅ Production Readiness Checklist

### Infrastructure
- [x] LiveKit Cloud SIP Bridge configured
- [x] LiveKit Cloud dispatch rules configured
- [x] Northflank agent worker deployed
- [x] SignalWire SIP trunk connected
- [x] Supabase database migrations applied

### BarbGraph System
- [x] 8 nodes implemented (greet, verify, qualify, quote, answer, objections, book, exit)
- [x] Theme prompt system active
- [x] 21 tools verified and exported
- [x] Event-based routing implemented
- [x] Database schema complete
- [x] Vue Portal UI complete
- [x] 6 critical bugs fixed

### AI Providers
- [x] LiveKit Inference integration complete
- [x] All providers supported (STT, TTS, LLM)
- [x] Custom ElevenLabs voice (Tiffany) working
- [x] Template system migrated to LiveKit Inference format
- [x] Vue portal pricing updated

### Verification
- [x] All 21 tools verified (no missing tools)
- [x] Field names consistent (primary_phone used everywhere)
- [x] SIP data flow verified (minimal dependencies)
- [x] Function calling verified (LiveKit @function_tool working)
- [x] Theme system verified (695 chars, active)
- [x] QUOTE node verified (prompt created, routing implemented)

**Status:** ✅ **PRODUCTION READY - All Systems Verified and Operational (November 11, 2025)**

---

**This is your single source of truth for the production system.** 🎯
