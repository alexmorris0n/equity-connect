# Equity Connect - Master Production Plan

**Last Updated:** October 31, 2025  
**Status:** Production Ready - Multi-Broker Scale Validated  
**Current Phase:** Campaign Optimization + Portal Deployment + Lead Management Enhancement + Broker RLS Setup
**Latest Updates:** 🎉 **SYSTEM METRICS DASHBOARD COMPLETE + LIGHT MODE THEMING FIXED** - Built comprehensive real-time monitoring system deployed as Supabase Edge Function. Monitors all critical infrastructure (Fly.io, Northflank) and AI service dependencies (OpenAI Realtime API, Google Gemini, SignalWire Voice/SMS). Removed monitoring load from barbara-v3 bridge for better performance. Added beautiful 6-ring health visualization to main dashboard showing "6/6 Operational" with color-coded status (green/yellow/red). Fixed all light mode theming issues across portal. Added dynamic logo switching and rate limit detection. Refresh intervals set to 2 minutes to avoid API throttling.

---

## 🎯 System Overview

**Barbara LLC (Wyoming)** - Registered October 30, 2025

Equity Connect is an AI-powered lead generation and nurturing platform for reverse mortgage brokers. The system uses AI agents to autonomously pull qualified property leads, enrich them with contact data, and manage compliant multi-channel outreach campaigns.

**Production Domains:**
- **barbarapro.com** - Marketing landing page
- **app.barbarapro.com** - Admin portal and broker interface
- **Vercel Development:** https://equity-connect.vercel.app

**Key Innovation:** Model Context Protocol (MCP) architecture enables one AI agent to orchestrate 4+ external services, replacing 135 deterministic workflow nodes with 13 intelligent nodes.

**Tech Stack:**
- **AI:** Gemini 2.5 Flash via OpenRouter (orchestration), OpenAI Realtime (voice)
- **Orchestration:** n8n (self-hosted on Northflank)
- **Database:** Supabase (PostgreSQL + pgvector)
- **Data Sources:** PropertyRadar API (property data + contact enrichment)
- **Outreach:** Instantly.ai (email), OpenAI Realtime + SignalWire (voice)
- **Integration:** MCP servers (Supabase, Instantly, Barbara, SwarmTrace); Direct Supabase client for voice bridge

---

## 🏗️ Deployment Architecture (Monorepo)

```
equity-connect/ (Git Monorepo)
├── .github/workflows/
│   └── deploy-barbara.yml        → Auto-deploy Barbara V3 on push
├── barbara-v3/                   → Fly.io (2 machines, HA)
│   ├── src/tools/business/       → 11 production tools
│   └── src/services/             → Supabase, Nylas, Vertex AI, MFA
├── portal/                       → Vue.js admin (Vercel/Netlify)
│   └── src/components/           → BarbaraConfig, LiveCallMonitor, etc.
├── barbara-mcp/                  → Docker/Local (extended integrations)
├── propertyradar-mcp/            → Docker/Local (property lookups)
├── swarmtrace-mcp/               → Docker/Local (analytics)
├── bridge/                       → Bridge V1 (legacy fallback)
├── database/                     → Shared Supabase schema
├── prompts/                      → Shared prompt templates
├── workflows/                    → N8N workflow definitions
└── config/                       → API configurations
```

**Why Monorepo:**
- ✅ Portal needs to reference Barbara's tool definitions
- ✅ MCPs share prompt templates and database schema
- ✅ Single source of truth for all configurations
- ✅ Path-based GitHub Actions = only deploy what changed
- ✅ All Barbara versions (v1, v2, v3) kept for reference

**Deployment Triggers:**
- `barbara-v3/**` changes → Deploy to Fly.io
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
- **Role:** Second broker, validates multi-broker scaling
- **Purpose:** 
  - ✅ Prove system works with multiple brokers simultaneously
  - ✅ Validate territory isolation and lead routing
  - ✅ Test Barbara AI with different broker branding
  - ✅ Confirm economics model across multiple territories

**Completed Setup:**
- ✅ Created Dan Thomas broker profile in Supabase
- ✅ Assigned Bay Area ZIP codes (separate from Walter's territory)
- ✅ Created PropertyRadar dynamic list for Bay Area (45,000-50,000 properties)
- ✅ Cloned Instantly campaigns (3 archetypes with Dan's branding)
- ✅ Set daily_lead_capacity (50/day, scaling to 100/day)
- ✅ Assigned SignalWire phone number (MyReverseOptions2 for West Coast)
- ✅ Tested parallel operation with Walter's existing campaigns

**Current Status:**
- ✅ Both brokers running simultaneously
- ✅ Territory isolation working correctly
- ✅ Phone number pool rotation validated
- ✅ Multi-broker economics confirmed
- ✅ Ready for 10+ broker scaling

---

### ✅ COMPLETE (As of Dec 19, 2024)

**0. Complete UI/UX Overhaul** ⭐ **DECEMBER 19, 2024**
- **Purpose:** Comprehensive admin interface modernization with complete UI/UX consistency
- **Architecture:** Vue 3 + Naive UI + Supabase + Responsive CSS Grid + Custom Styling
- **Status:** ✅ **PRODUCTION READY - Fully Integrated & Deployed**

**Core Features (LIVE):**
- ✅ **Redesigned Dashboard** (`/admin/dashboard`) - Complete UI overhaul with modern metrics
  - Compact square stat cards with responsive grid layout (auto-fit, minmax 150px, max-width 750px)
  - Centered metric values with floating badges (absolutely positioned)
  - Real-time data fetching from Supabase (brokers, leads, interactions)
  - Professional styling with Naive UI components
  - 25% size reduction for optimal visual density
- ✅ **Platform Health Metrics** - Individual square cards for key indicators
  - Data Freshness (TimeOutline icon) - Last lead captured timestamp
  - Lead Velocity (TrendingUpOutline icon) - New leads in 24h
  - Funded This Week (CashOutline icon) - Completed deals count
  - Responsive grid layout matching main stat cards
- ✅ **Pipeline Overview** - Visual progress bars for lead status breakdown
  - New, Contacted, Qualified, Appointments status tracking
  - Color-coded progress bars with percentages
  - Real-time data from leads table
- ✅ **Broker Performance Table** - Top-performing brokers with metrics
  - Lead count, conversion rate, appointments, status
  - Responsive table with Naive UI styling
  - Real-time broker data integration
- ✅ **Recent Activity Feed** - Latest system activity
  - Lead updates, broker changes, system events
  - Chronological timeline with relative timestamps
  - Activity metadata parsing and display

**Complete UI/UX Consistency Overhaul:**
- ✅ **Navigation Updates** - Standardized menu labels across entire application
  - "Lead Library" → "Leads" (simplified naming)
  - "Broker Workspace" → "Brokers" (clearer terminology)
  - "Prompt Management" → "Prompts" (concise labeling)
  - "Admin Console" → "BARBARA" (branded sidebar header, all caps)
- ✅ **Sidebar Branding** - Enhanced workspace identity
  - Increased workspace icon size by 20%
  - Consistent font styling matching menu items
  - Removed redundant breadcrumbs ("Barbara Platform" divider)
  - Added padding-left: 1.5rem to breadcrumbs
- ✅ **Header Simplification** - Streamlined admin interface
  - Removed "Quick Actions" and "Help" buttons
  - Cleaner, more focused header design
- ✅ **User Profile Management** - Complete Supabase integration with avatar support
  - Clickable sidebar profile leading to `/admin/profile`
  - Avatar upload with base64 storage in user_metadata
  - Profile picture support with initials fallback (derived from display_name, contact_name, or email)
  - Real-time updates via USER_UPDATED events and refreshSession()
  - Calendar integration for broker users (Nylas OAuth)
  - Simplified profile text to just "Administrator" with avatar circle
- ✅ **Broker Management** - Business card grid layout with responsive design
  - Individual broker cards with contact info, performance metrics (400px max-width)
  - Clickable cards navigating to `/admin/brokers/:id`
  - Responsive grid with proper alignment and constraints
  - Search functionality with expanding input field
  - Static-width "Add Broker" button (140px, flex-shrink: 0)
  - Mobile-responsive stacking on narrow screens
- ✅ **Broker Detail Pages** - Comprehensive broker profiles with calendar integration
  - Multi-tab interface (Basic Info, Business Settings, Contract, Performance, Integrations, Notes)
  - Calendar integration with Nylas OAuth flow
  - Edit/Save functionality with Supabase updates
  - Removed Cal.com fields, streamlined calendar connection
  - Connect/Disconnect/Sync calendar buttons with proper status display
- ✅ **Login Page Redesign** - Complete visual overhaul
  - Changed branding from "Equity Connect Portal" to "Barbara"
  - Doubled logo size (40px icon, 96px container)
  - Removed background shading behind logo
  - Centered logo and text horizontally
  - Removed subtitle text
  - Full-screen gradient background
  - Removed internal input field shading on focus
  - Centered login card with proper spacing
- ✅ **Custom Scrollbar Styling** - Naive UI consistency
  - Custom scrollbar styling matching Naive UI design
  - 8px height, light gray track, purple thumb with hover effects
  - Applied to AllLeads table wrapper

**Technical Implementation:**
- ✅ **Responsive Design** - CSS Grid and Flexbox layouts
  - Auto-fit grid columns with minmax constraints (150px minimum)
  - Mobile-responsive stacking on narrow screens
  - Consistent spacing and alignment
  - Max-width constraints for proper alignment (750px dashboard, 400px broker cards)
- ✅ **Data Integration** - Real-time Supabase queries
  - Efficient data fetching with computed properties
  - Error handling and loading states
  - Performance optimization with proper indexing
  - USER_UPDATED event handling for reactive updates
- ✅ **Styling Consistency** - Naive UI component library
  - Unified color scheme and typography
  - Consistent spacing and component sizing
  - Professional visual hierarchy
  - Custom CSS overrides with :deep() selectors
- ✅ **Authentication Integration** - Supabase auth with reactive updates
  - Avatar upload with base64 encoding
  - User metadata updates with refreshSession()
  - Real-time UI updates via auth state changes

**Key Accomplishments (DECEMBER 19):**
- ✅ Complete dashboard redesign with compact square stat cards
- ✅ Platform health metrics as individual cards
- ✅ Centered metric values with floating badges
- ✅ Complete navigation consistency across all pages
- ✅ User profile management with avatar upload and Supabase integration
- ✅ Broker management with business card layout and responsive design
- ✅ Comprehensive broker detail pages with calendar integration
- ✅ Login page complete redesign with centered branding
- ✅ Custom scrollbar styling matching Naive UI
- ✅ All changes committed and deployed to production

**Dark Mode UI Implementation (OCTOBER 31):**
- ✅ **Login Page Dark Mode** - Complete dark theme with glass morphism effect
  - Dark card background (rgba 17, 24, 39, 0.85) with backdrop blur
  - Dark logo variants (barbara-logo-dark.svg, barbara-logo-compact-dark.svg)
  - Light text for visibility on dark backgrounds
  - Maintains full-screen gradient background
- ✅ **User Profile Dark Mode** - Comprehensive dark styling
  - Dark profile cards with glass effect and light borders
  - All form labels and input text in white for readability
  - Dark input backgrounds with proper contrast
  - Password modal dark themed
  - Calendar integration cards styled for dark mode
- ✅ **Appointments Calendar Dark Mode** - Fixed background bleed issues
  - Removed white background showing through rounded corners
  - Dark scroller backgrounds (fc-scroller, fc-scroller-liquid-absolute)
  - Calendar grid elements properly styled for dark theme
  - Removed border-radius from problem areas to eliminate white gaps
- ✅ **Sidebar Logo Improvements** - Better branding visibility
  - Increased logo size: 160px → 180px (expanded), 72px → 80px (collapsed)
  - Dark logo variants for all sidebar states
  - Logo files organized in /logos directory
- ✅ **Theme System Verification** - Auto mode properly listens to OS
  - Uses window.matchMedia('prefers-color-scheme: dark')
  - Real-time listener for system theme changes
  - Proper integration with Supabase user preferences
- ✅ All dark mode changes committed and pushed to production

**Next Steps:**
- [ ] Add more detailed analytics and reporting
- [ ] Implement data export functionality
- [ ] Add real-time notifications and alerts
- [ ] Build advanced filtering and search capabilities
- [ ] Add performance benchmarking and comparisons

**1. AI Daily Lead Acquisition** (`workflows/AI_Daily_Lead_Pull.json`) ⭐ NEW
- **REPLACES 5 WORKFLOWS:** Pull Worker, Enrichment Waterfall, Campaign Feeder, Q2H Backfill, EOD Backfill
- AI Agent (Gemini 2.5 Flash) orchestrates entire lead generation pipeline
- 13 nodes (vs 135 in old system) - 90% reduction
- Completes in 2-3 minutes (vs all-day with old system)
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

**2. Instantly Reply Handler** (`workflows/instantly-reply-handler-ALL-MCP.json`) ⭐ UPDATED OCT 17
- **ALL-MCP Architecture:** Pure agentic with 4 MCP servers
- Responds 200 OK immediately (no Instantly timeouts)
- AI Agent orchestrates intelligent replies using:
  - Vector Store KB (80-chunk semantic search)
  - Supabase MCP (lead data + 28 variables)
  - Instantly MCP (reply via email)
  - Barbara MCP (trigger calls with full context, now via OpenAI Realtime bridge)
- **Features:**
  - Context-aware responses (searches KB for accurate answers)
  - Broker-agnostic language (dynamic {{broker_company}}, {{broker_full_name}})
  - **Sender identity from inbox** (determined by broker's email configuration)
  - **Atomic phone number assignment** from broker company pool (race-condition safe)
  - Triggers Barbara calls with 28 variables when phone provided
  - Stores persona_sender_name in database
- **Status:** ✅ Production Ready (QUESTION ✅, PHONE_PROVIDED with pool management ✅)

**3. Vector Store Knowledge Base** ⭐ PRODUCTION OCT 16, CLEANED OCT 22
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
- **Oct 22 Cleanup:** Deleted 5,779 rows of wrong content (system docs, .gitignore files)
- **n8n Upload Workflow:** `kuDxW8kPndFKXZHP` configured to load only reverse mortgage KB files
- **Status:** ✅ Cleaned, ready for proper KB upload from GitHub

**5. OpenAI Realtime Voice Bridge** ⭐ PRODUCTION (OCT 18-22) - **VAPI REPLACED**
- **Architecture:** Custom Node.js bridge connects SignalWire PSTN ↔ OpenAI Realtime API
- **Deployment:** Northflank (Docker container, WebSocket support) - **LIVE**
- **Repository:** `equity-connect/bridge/` (same repo, separate service)
- **Cost:** **$0.36 per 7-min call** (vs $1.33 with Vapi) - **74% savings**
- **Annual Savings:** **$173,880** at scale (180,000 calls/year)
- **Key Components:**
  - **Bridge Server** (`bridge/server.js`) - Fastify + WebSocket, health checks, `/api/active-calls` endpoint
  - **Audio Relay** (`bridge/audio-bridge.js`) - SignalWire ↔ OpenAI bidirectional streaming (2,562 lines)
  - **7 Supabase Tools** (`bridge/tools.js`) - Lead lookup, KB search, Nylas calendar, booking, logging with rich metadata
  - **Number Formatter** - Converts numbers to words (prevents TTS pitch issues)
  - **SignalWire Client** - REST API for outbound call placement
  - **PromptLayer Integration** (`bridge/promptlayer-integration.js`) - Call analytics, A/B testing, debugging
  - **Live Call Metrics** (`bridge/api/active-calls.js`) - Real-time sentiment, interest, buying signals
- **Features:**
  - ✅ **Inbound calls** - SignalWire number → LaML → WebSocket stream
  - ✅ **Outbound calls** - n8n → Bridge → SignalWire REST → Lead answers
  - ✅ **Custom prompts from n8n** - Different Barbara per use case
  - ✅ **Knowledge base search** - Vector similarity with 20s timeout (no more timeouts!)
  - ✅ **Nylas calendar integration** - Real availability checking, appointment booking (15s timeouts)
  - ✅ **Static prompt caching** - OpenAI caches repeated content (50% cost reduction)
  - ✅ **Production error handling** - Logging, health checks, session cleanup
  - ✅ **Deadlock prevention** - Watchdog timer auto-recovers Barbara if stuck (15s)
  - ✅ **Memory leak protection** - 30s timeout on pending audio promises
  - ✅ **Audio cutoff fix** - Awaits all audio chunks before marking response complete
  - ✅ **No token limits** (Oct 22) - Removed artificial 400 token cap that caused mid-sentence cutoffs
  - ✅ **VAD recovery disabled** (Oct 22) - Was clearing legitimate user speech after 10s of silence
  - ✅ **Performance tracking** (Oct 22) - Detailed timing logs for all external API calls
- **Tool Definitions & Timeouts:**
  1. `get_lead_context` (10s) - Query lead by phone (includes last call metadata for follow-ups)
  2. `search_knowledge` (20s) - Search reverse mortgage KB with text-embedding-3-small (faster than ada-002)
  3. `check_consent_dnc` (10s) - Verify calling permissions
  4. `update_lead_info` (10s) - Save collected data during call
  5. `check_broker_availability` (15s) - Nylas free/busy API with smart slot suggestions (business hours, 2hr notice, same-day priority)
  6. `book_appointment` (15s) - Nylas Events API (uses email as grant ID) + billing event
  7. `save_interaction` (10s) - Log full conversation transcript + rich metadata (money purpose, objections, commitment points, etc.)
- **Rich Metadata Capture:**
  - Money purpose, specific needs, amount needed, timeline
  - Objections raised, questions asked, key details
  - Appointment scheduled/datetime, email/phone verified
  - Commitment points completed, text reminder consent
  - Full conversation transcript stored
  - Tool calls made during conversation
- **Integration Points:**
  - **n8n workflows:** Build custom Barbara prompts per lead type
  - **SignalWire numbers:** Same 5-number pool (MyReverseOptions1-5)
  - **Supabase:** Direct client (not MCP - optimized for <100ms queries)
  - **Vector store:** 80-chunk KB for factual answers
  - **Nylas Calendar:** Real broker availability + appointment booking
  - **PromptLayer:** Call analytics, prompt A/B testing, debugging
- **Three Use Cases:**
  1. **Email Reply → Call** (Warm leads, rapport-building, 7-10 min)
  2. **Microsite Instant → Call** (HOT leads, 10-sec trigger, 40% close rate)
  3. **Inbound → Barbara Answers** (Active seekers, immediate help)
- **Audio Specs:**
  - Codec: L16@16000h (16-bit linear PCM @ 16kHz)
  - Streaming: Bidirectional, real-time mode
  - Latency: <300ms end-to-end
  - VAD Tuning: 0.80 threshold (optimized for phone lines + seniors)
- **Status:** ✅ **PRODUCTION - Vapi Fully Replaced**
- **Stability Fixes (Oct 21):**
  - Response queue deadlock prevention (force unlock in cleanup)
  - Memory leak protection (30s timeout on audio promises)
  - Watchdog timer (15s auto-recovery from stuck speaking flag)
  - Audio cutoff fix (await all chunks before response.audio.done)
- **Critical Fixes (Oct 22):**
  - **Nylas appointment booking** - Fixed grant ID (email instead of UUID), fixing all 404 errors
  - **Token limit removed** - Changed from 400 to 'inf' (was cutting Barbara off mid-sentence)
  - **VAD recovery disabled** - Was deleting legitimate user speech ("hello hello" attempts)
  - **Tool timeouts extended** - 20s for KB search, 15s for Nylas API calls (prevents timeouts)
  - **PromptLayer timestamps** - Fixed format (Unix seconds, not ISO strings)
  - **Performance tracking** - Added detailed timing logs to all tools for optimization
- **Documentation:**
  - `IMPLEMENTATION_SUMMARY.md` - Complete project overview
  - `VOICE_BRIDGE_DEPLOYMENT.md` - Deployment guide
  - `N8N_BARBARA_WORKFLOW.md` - n8n workflow setup
  - `MICROSITE_INSTANT_CALL_FLOW.md` - Hot lead instant calls
  - `BARBARA_APPOINTMENT_BOOKING_FIX.md` - Nylas grant ID and timeout fixes (Oct 22)
  - `KNOWLEDGE_BASE_TIMEOUT_FIX.md` - KB search optimization (Oct 22)
  - `bridge/README.md` - Technical details

**6. Barbara V3 - Production Voice AI** ⭐ **FULLY OPERATIONAL + CALL EVALUATION + DYNAMIC VOICE/VAD** (OCT 25-27, 2025)
- **Architecture:** SignalWire cXML + OpenAI Realtime API + OpenAI Agents SDK
- **Deployment:** Fly.io (2 machines for HA) + GitHub Actions (git-based auto-deploys)
- **Repository:** `barbara-v3/` - Standalone TypeScript service
- **Based On:** SignalWire's official `cXML-realtime-agent-stream` + `digital_employees` reference
- **Key Features:**
  - ✅ **TypeScript + ESM** - Type safety, modern imports
  - ✅ **Zod validation** - Schema validation for all tool parameters
  - ✅ **OpenAI Agents SDK** - Official `@openai/agents` package
  - ✅ **Git-based deployment** - Push to main = auto-deploy via GitHub Actions
  - ✅ **Clean logging** - `LOG_LEVEL=info` (no debug spam), readable call flows
  - ✅ **Caller ID injection** - SignalWire `<Parameter>` tags → Barbara's context
  - ✅ **Dynamic prompts from Supabase** - Real-time prompt loading with version tracking
  - ✅ **Full transcript capture** - Both user and Barbara sides of conversation
  - ✅ **Automated call evaluation** - GPT-5-mini scores every call on 6 metrics
  - ✅ **Prompt version tracking** - Links evaluations to specific prompt versions for A/B testing
  - ✅ **Dynamic Voice & VAD settings** - Per-prompt configuration from database
    - Voice: 10 OpenAI Realtime options (shimmer default)
    - VAD Threshold: 0.3-0.8 (0.5 default)
    - Prefix Padding: 100-1000ms (300ms default)
    - Silence Duration: 200-2000ms (500ms default)
- **Business Tools (11 total):**
  1. `get_lead_context` - Query lead by phone with last call context
  2. `check_consent_dnc` - Verify calling permissions
  3. `update_lead_info` - Update lead data, auto-calculate equity
  4. `find_broker_by_territory` - Assign broker by ZIP/city
  5. `check_broker_availability` - Nylas calendar real-time check
  6. `book_appointment` - Create Nylas event + billing + interaction log
  7. `assign_tracking_number` - Link SignalWire number for call tracking
  8. `save_interaction` - Log call with rich metadata
  9. `search_knowledge` - Vector search via Google Vertex AI
  10-11. *(Reserved for SMS confirmation tools when regulatory approval obtained)*
- **Demo Tools:**
  - `get_time` - Current time in Eastern
  - `get_weather` - US weather via weather.gov
- **Call Types:**
  - ✅ **Inbound calls** - Lead calls Barbara → Barbara greets first automatically → Looks up lead → Personalized conversation
  - ✅ **Outbound calls** - n8n → barbara-mcp → Barbara calls lead → Waits for lead to answer → Warm introduction
  - 4-second pause for natural ringback (caller's phone rings during connection)
  - **Auto-greeting (OCT 28)** - Inbound calls trigger `response.create` after context injection for immediate greeting
- **Audio Stack:**
  - SignalWire → WebSocket (g711_ulaw @ 8kHz, default codec)
  - Barbara → OpenAI (pcm16 @ 24kHz) → Real-time voice
  - SignalWire compatibility layer handles format conversion
- **Call Flow:**
  - SignalWire `start` event → Extract From/To/CallSid/direction/lead_id/broker_id
  - Load dynamic prompt from Supabase based on call type (inbound/outbound)
  - Barbara injects lead phone into context via system message
  - Calls `get_lead_context` immediately with correct phone number
  - Uses lead data (name, property, broker) to personalize conversation
  - Full transcript captured for both user and Barbara throughout call
  - Books appointments, sends email confirmations
  - Saves interaction with transcript and prompt version metadata
  - Triggers automated evaluation (background job, non-blocking)
- **Phone Number Logic:**
  - **Inbound:** Lead calls FROM their phone → Barbara looks up FROM number
  - **Outbound:** Barbara calls TO lead's phone → Barbara looks up TO number
  - Captured via SignalWire `<Parameter>` tags (clean WebSocket URLs, no query strings)
- **Services:**
  - Supabase client (leads, brokers, interactions, billing, prompts, prompt_versions, call_evaluations)
  - Nylas API wrapper (calendar availability, event creation)
  - Vertex AI (text-embedding-005 for knowledge search)
  - SignalWire REST API (outbound call placement)
  - OpenAI API (GPT-5-mini for call evaluation)
- **Deployment:**
  - GitHub Actions auto-deploy on `barbara-v3/**` changes
  - Fly.io with `--no-cache` (prevents stale Docker builds)
  - Environment secrets via `flyctl secrets set` (instant updates, ~5s restart)
- **Status:** ✅ **FULLY OPERATIONAL WITH CALL EVALUATION + DYNAMIC VOICE/VAD**
  - ✅ Inbound calls tested - caller ID, lead lookup, appointment booking working
  - ✅ Outbound calls tested - correct phone lookup, dynamic prompt selection
  - ✅ Voice & VAD tuning - Per-prompt database configuration
  - ✅ Clean logs - Changed from `debug` to `info` level
  - ✅ Dynamic prompt loading - Fetches from Supabase with version tracking
  - ✅ Full transcript capture - Both user and Barbara sides recorded
  - ✅ Automated evaluation - GPT-5-mini scores every call on 6 metrics
  - ✅ **Qualified lead detection (OCT 28)** - Pattern matching for phone lookups (handles E.164, 10-digit, formatted)
  - ✅ **Inbound auto-greeting (OCT 28)** - Barbara speaks first on inbound calls without waiting for user
- **Endpoints:**
  - Health: `https://barbara-v3-voice.fly.dev/health`
  - Inbound webhook: `https://barbara-v3-voice.fly.dev/incoming-call`
  - Outbound webhook: `https://barbara-v3-voice.fly.dev/outbound-call`
  - API (for n8n): `https://barbara-v3-voice.fly.dev/api/trigger-call`
  - Stream: `wss://barbara-v3-voice.fly.dev/media-stream`
- **Next Steps:**
  - [ ] Test voice changes in production (different voices for different call types)
  - [ ] Fine-tune VAD settings based on call quality feedback
  - [ ] Build dashboard to visualize call evaluation trends
  - [ ] A/B test different prompts via database-driven config
  - [ ] Add SMS confirmation tools (after regulatory approval)
  - [ ] Compare prompt versions to optimize performance

**7. Nylas Calendar Integration** ⭐ **PRODUCTION & TESTED** (OCT 20-26, 2025)
- **Provider:** Nylas v3 API - Production-grade calendar platform
- **Features:**
  - Real-time broker availability checking via Free/Busy API
  - Direct appointment booking during calls (Barbara books while talking!)
  - Smart slot suggestion logic (10 AM - 5 PM, 2-hour notice, same-day priority)
  - Calendar invite sent automatically to lead's email ✅ **CONFIRMED WORKING**
  - Event creation/deletion tested and working
- **Implementation:**
  - `check_broker_availability` tool - `/v3/calendars/free-busy` (15s timeout)
  - `book_appointment` tool - `/v3/grants/{email}/events` with `calendar_id` in body (15s timeout)
  - **CRITICAL FIX (Oct 22):** Nylas v3 uses **email as grant ID**, not UUID
  - Works with any calendar provider (Google, Outlook, iCloud, etc.)
- **Barbara's Booking Flow:**
  1. Checks broker's real calendar for available slots
  2. Suggests next available time (today > tomorrow > this week)
  3. Negotiates back-and-forth until lead confirms
  4. Verifies contact details (email, phone, name, address)
  5. Advanced commitment building (7-step process for 75-85% show rate)
  6. Books appointment in broker's calendar
  7. Sends calendar invite to lead's email ✅ **TESTED & WORKING**
  8. Creates billing event in Supabase
- **Testing Results (Oct 26):**
  - ✅ Inbound call: Lead booked appointment → Calendar invite received in email
  - ✅ Barbara successfully looked up lead by phone number
  - ✅ Real-time availability checking worked
  - ✅ Email confirmation sent and delivered
- **Performance Tracking:** Detailed timing logs for Nylas API calls, DB operations
- **Status:** ✅ **Production Ready & Tested End-to-End**
- **Next:** OAuth flow for broker self-service (requires production Nylas account)

**8. Automated Call Evaluation System** ⭐ **NEW OCT 27, 2025**
- **Purpose:** Data-driven prompt optimization through automated post-call quality analysis
- **Architecture:** GPT-5-mini evaluation engine + Supabase storage + transcript capture
- **Cost:** ~$0.0005 per evaluation (half a cent) - sustainable at massive scale
- **Features:**
  - ✅ **Full transcript capture** - Both user and Barbara sides during live calls
  - ✅ **Real-time transcription** - OpenAI Realtime API `inputAudioTranscription` with Whisper-1
  - ✅ **Automated evaluation** - Triggered as background job after every call (non-blocking)
  - ✅ **6 Performance metrics** (0-10 scale):
    1. Opening Effectiveness - Rapport building, name confirmation, tone setting
    2. Property Discussion Quality - Gathering details effectively
    3. Objection Handling - Addressing concerns, reframing negatives
    4. Booking Attempt Quality - Clear, confident appointment requests
    5. Tone Consistency - Conversational, empathetic, professional throughout
    6. Overall Call Flow - Logical progression, appropriate pacing
  - ✅ **AI-generated analysis** - Strengths, weaknesses, objections handled, opportunities missed, red flags
  - ✅ **Prompt version tracking** - Links each evaluation to specific prompt version for A/B testing
  - ✅ **Performance comparison** - Compare average scores across prompt versions
- **Database Schema:**
  - `call_evaluations` table with scores, analysis (JSONB), prompt_version, evaluation_model
  - Foreign key to `interactions` table (one evaluation per call)
  - Composite index on `prompt_version` for fast dashboard queries
  - Overall score computed column (average of 6 metrics)
- **Implementation:**
  - `barbara-v3/src/services/call-evaluation.service.ts` - Evaluation engine
  - `barbara-v3/src/services/transcript-store.ts` - In-memory transcript + prompt metadata storage
  - `barbara-v3/src/services/prompts.ts` - Dynamic prompt loading from Supabase
  - `barbara-v3/src/routes/streaming.ts` - Transcript capture via OpenAI events:
    - `conversation.item.input_audio_transcription.completed` - User transcript
    - `response.output_audio_transcript.delta` - Barbara transcript (streaming)
    - `response.output_audio_transcript.done` - Barbara transcript finalization
  - `barbara-v3/src/tools/business/save-interaction.tool.ts` - Triggers evaluation
- **Evaluation Prompt:**
  - Detailed rubric for each metric (3 quality levels: Poor 0-3, Fair 4-7, Good 8-10)
  - Structured JSON output with scores + analysis
  - Temperature 0.3 for consistent scoring
  - Response format: `{ "scores": {...}, "analysis": {...} }`
- **Integration Flow:**
  1. Call starts → Dynamic prompt loaded from Supabase with version metadata
  2. Transcript captured in real-time via OpenAI Realtime API events
  3. Call ends → `save_interaction` saves transcript + prompt metadata to DB
  4. Background job triggers `evaluateCall(interaction_id, transcript, prompt_version)`
  5. GPT-5-mini scores call on 6 metrics + generates analysis
  6. Results saved to `call_evaluations` table
  7. Dashboard queries available for performance comparison
- **Dashboard Queries:**
  - Average scores by prompt version (identify best-performing prompts)
  - Score trends over time (track improvement)
  - Common objections analysis (improve objection handling)
  - Red flags detection (identify problematic patterns)
- **Use Cases:**
  - A/B test different prompt versions (deploy v1 vs v2, compare scores)
  - Identify weak sections (low scores on specific metrics → improve that section)
  - Learn from best calls (high scores → extract patterns)
  - Monitor quality at scale (catch issues before they spread)
  - Continuous improvement loop (data-driven prompt engineering)
- **Status:** ✅ **Deployed to Production**
  - ✅ Database migration applied (call_evaluations table)
  - ✅ Transcript capture working (both user and Barbara)
  - ✅ Dynamic prompt loading operational
  - ✅ Evaluation service deployed to Fly.io
  - ✅ Ready for first test call
- **Cost Analysis:**
  - GPT-5-mini evaluation: ~$0.0005/call (0.05 cents)
  - Manual QA equivalent: $5-10/call (10,000-20,000x more expensive)
  - At 1,000 calls/month: $0.50 in evaluation costs
  - At 100,000 calls/month: $50 in evaluation costs (sustainable at scale)
- **Documentation:**
  - `database/migrations/20251027_call_evaluations_table.sql` - Schema
  - `database/queries/call-evaluation-dashboard.sql` - Example queries
  - `TRANSCRIPT_CAPTURE_IMPLEMENTATION.md` - Technical details
  - `DYNAMIC_PROMPT_LOADING.md` - Prompt system integration

**9. PromptLayer Integration** ⭐ PRODUCTION OCT 21-22
- **Purpose:** Prompt management, A/B testing, analytics for rapid iteration
- **Features:**
  - Auto-logs every conversation to PromptLayer at call end
  - Captures full transcript + metadata (lead_id, broker_id, duration, outcome)
  - Tool calls tracked for debugging
  - Enables A/B testing different Barbara prompts
  - Real-time evaluation of prompt changes
- **Implementation:**
  - `bridge/promptlayer-integration.js` - REST API wrapper
  - Integrated into `save_interaction` - logs automatically
  - Uses PromptLayer REST API with correct timestamp format (Unix seconds)
  - **CRITICAL FIX (Oct 22):** Changed from ISO strings to Unix timestamps (float)
- **Status:** ✅ Live - Logging all calls successfully
- **Use Case:** Helps iterate on Barbara's prompt without guessing
- **Note:** Being augmented by new Call Evaluation System for deeper automated analysis

**10. Live Call Intelligence Dashboard** ⭐ NEW OCT 21
- **Frontend:** Vue 3 component with shadcn styling
- **Backend:** `/api/active-calls` endpoint serving real-time metrics
- **Metrics Displayed:**
  - Call duration, sentiment (😊/😐/😟), interest level (0-100%)
  - Key topics discussed, buying signals detected
  - Call activity timeline (Barbara spoke / User spoke / Silence)
- **Refresh Rate:** 5 seconds (near real-time)
- **Files:**
  - `portal/src/components/LiveCallMonitor.vue` - Vue component
  - `bridge/api/active-calls.js` - Metrics calculation
- **Status:** ✅ Built - Ready to deploy to portal
- **Purpose:** Monitor active calls for quality, troubleshooting, training

**11. Barbara MCP Tools Expansion** ⭐ NEW OCT 21
- **Added to MCP Server:**
  - `check_broker_availability` - Nylas calendar availability
  - `book_appointment` - Nylas event creation
  - `update_lead_info` - Collect/verify contact details
- **Purpose:** n8n workflows can now call these tools directly
- **Architecture:** `barbara-mcp/index.js` proxies to `bridge/tools.js` API
- **Status:** ✅ Live - Available in n8n MCP tool list

**12. SwarmTrace MCP Server** ⭐ PRODUCTION OCT 21 - **REPLACED BATCHDATA**
- **Purpose:** Batch skip trace enrichment fallback (when PropertyRadar /persons API insufficient)
- **API:** SwarmTrace/Swarmalytics skip trace API
- **Cost Savings:** $0.0125/lead (vs $0.70/lead BatchData) - **98% cheaper at launch, 99% at scale**
  - Launch: $0.0125 per skip trace (1.25 cents)
  - Scale (high volume): $0.01 per skip trace (1 cent)
  - BatchData was: $0.50-0.70 per lookup
- **Features:**
  - Batch processing (multiple properties at once)
  - Adaptive concurrency and retries with exponential backoff
  - SSE transport for n8n MCP client compatibility
  - Bearer token authentication for security
  - Mock mode for testing without API costs
- **Architecture:** `swarmtrace-mcp/server.py` - FastMCP Python server
- **Integration:** Available as MCP tool in n8n workflows
- **Use Case:** Fallback enrichment when PropertyRadar /persons API returns low-quality data
- **Status:** ✅ Production - Active in AI Daily Lead Acquisition workflow

**13. SignalWire Phone Number Pool** ⭐ ACTIVE OCT 17
- **5 SignalWire Numbers:** Registered and active
  - **MyReverseOptions1** (+14244851544) - CA territory (Walter's primary)
  - **MyReverseOptions2** (+14245502888) - OR, WA territories
  - **MyReverseOptions3** (+14245502229) - TX, AZ territories  
  - **MyReverseOptions4** (+14245502223) - FL, GA territories
  - **MyReverseOptions5** (+14246724222) - NY, NJ, IL, IN territories
- **Database Integration:** `signalwire_phone_numbers` table with territory-based routing
- **Features:**
  - Territory-based automatic assignment
  - Race-condition safe atomic updates
  - Broker company branding
  - Callback support
- **Bridge Integration:** All numbers connected to OpenAI Realtime bridge via LaML
- **Status:** ✅ Production - All active on OpenAI Realtime (Vapi fully deprecated)

**6. PropertyRadar List Management**
- Helper workflows for broker-specific dynamic lists
- Webhook for Vercel UI integration
- Update workflow for territory changes
- **Broker Setup Process:**
  - ZIP codes assigned to broker territories (45,000-50,000 properties each)
  - Inbox names match ZIP codes (e.g., "90210@company.com", "90001@company.com")
  - Automatic PropertyRadar list creation with ZIP-based naming
- **Territory Sustainability Strategy:**
  - **100 leads/day × 22 work days/month × 12 months = 26,400/year per broker**
  - **PropertyRadar refresh rate: 60% annually (27,000-30,000 new properties)**
  - **Auto-refreshing dynamic lists** - territories never burn out
  - **Infinite scalability** - PropertyRadar handles list refresh automatically
- **Status:** Working, List ID 1104847 (Walter)

**7. Database Schema & SQL Functions**
- **Leads table:** Enrichment tracking, campaign history, archetype assignment, **persona_sender_name**, **assigned_phone_number_id** (NEW OCT 17)
- **Brokers table:** list_id, offset, daily_capacity, **daily_lead_surplus** (NEW)
- **Campaigns table:** 3-archetype system with Instantly campaign IDs
- **signalwire_phone_numbers table:** Production-scale pool management (NEW OCT 17)
  - Broker company assignment, active/available status tracking
  - Currently assigned lead, assignment/release timestamps
  - Appointment tracking, call outcomes
  - Composite index for high-performance queries at scale
- **SQL Helper Functions:**
  - `count_enriched_today(broker_id)` → Returns count
  - `filter_new_radar_ids(ids[])` → Dedup before purchasing
  - `update_broker_offset(broker_id, increment)` → Auto-increment pagination
  - `broker_leads_today(broker_id)` → Total leads pulled
- Pipeline events queue for async processing
- Deduplication functions and indexes
- Backfill support functions (successful/pending enrichment counts)
- Attribution dashboard view (vw_broker_daily_attribution)
- **Campaign system tables** (NEW - Oct 12):
  - `campaigns` table: 3-archetype config with Instantly IDs
  - `leads.campaign_history` JSONB: Tracks all campaign attempts
  - `leads.campaign_archetype`: Current campaign assignment
  - `add_to_campaign_history()` function: Atomic history updates
- **Status:** Production schema deployed
- **Cleanup:** Removed legacy `email`/`phone` columns, fixed dependent views

**4. PropertyRadar + SwarmTrace Enrichment** (`workflows/unified-enrichment-waterfall.json`)
- PropertyRadar /persons API enrichment (primary - first tier)
- SwarmTrace MCP fallback (when PropertyRadar quality < 70)
- Smart quality scoring (0-100 scale, weighted by data quality)
- Best-of-both merge logic (selects highest quality contact)
- Processes 50 leads per run (every 5 minutes)
- Actual success rate: 82-84% email, 97% phone coverage
- **Cost:** $0.0125/skip trace (only ~15-18% of leads need it = $0.27/day for 100 leads)
- **Status:** Production-ready, active in n8n (ID: nKfhu1tV6XwQVJYb)

**5. Automated Backfill System** (NEW - Oct 11/12)
- Q2H Backfill Checker: Runs 7x daily (8am-8pm, every 2 hours)
- EOD Safety Check: Runs at 10pm for final sweep
- Timezone-aware enrichment counting (America/Los_Angeles)
- Pending enrichment tracking (prevents over-pulling during active enrichment)
- Webhook-based architecture (backfill → webhook → pull worker)
- Per-broker shortfall calculation and attribution
- Dashboard with real-time visibility
- **Status:** Deployed to n8n, ready to activate
- **Cost savings:** $1,000-2,000/month (only pulls exact shortfall)

---

---

### 🔄 IN PROGRESS

**14. Vue.js Prompt Management Portal** ⭐ **PRODUCTION READY + INTEGRATED** (OCT 27, 2025)
- **Purpose:** AI-powered prompt engineering platform with GPT-5 evaluation + management + version control
- **Architecture:** Vue 3 + Vite + Supabase + Naive UI + OpenAI API (GPT-5 + GPT-5-mini)
- **Deployment:** Vercel (auto-deploy on `portal/**` changes)
- **Status:** ✅ **PRODUCTION READY - Integrated with Barbara V3**

**Core Features (LIVE):**
- ✅ **9 Fixed Prompts** - One for each call type (no create/delete, version control only)
  - 4 Lead-facing: inbound-qualified, inbound-unqualified, outbound-warm, outbound-cold
  - 2 Broker-facing: broker-schedule-check, broker-connect-appointment
  - 2 Special handling: transfer, callback
  - 1 System: fallback
- ✅ **AI Section Improver** (GPT-5-mini) - **NEW OCT 27**
  - Click sparkle icon on any section for AI-powered improvements
  - Quick suggestion prompts for common refinements
  - Context-aware improvements based on prompt purpose and goal
  - Side-by-side diff view (original vs AI-improved)
  - One-click accept to apply changes
  - Follows OpenAI Realtime API best practices automatically
  - Fast response time (~10-15 seconds)
- ✅ **Comprehensive AI Audit** (GPT-5) - **NEW OCT 27**
  - Full prompt evaluation across all 9 sections
  - Guided 6-question intake (problem, target profile, conversion goal, known issues, tone, edge cases)
  - Overall quality score (0-100) with visual rating
  - Detailed feedback: Strengths, Weaknesses, Critical Issues
  - Actionable recommendations with priority levels (Critical/High/Medium/Low)
  - Each recommendation includes: Issue description, Why it matters, Suggested content
  - One-click apply for individual recommendations
  - Evaluates: Realtime API compliance, consistency, alignment, variable usage, completeness
  - Comprehensive report modal with beautiful UI
  - Uses GPT-5 for thorough analysis (~30-45 seconds)
- ✅ **Structured Editor** - 9 JSONB sections per prompt:
  1. Role & Objective
  2. Personality & Tone
  3. Context (available variables)
  4. Reference Pronunciations
  5. Tools (available functions)
  6. Instructions & Rules
  7. Conversation Flow
  8. Output Format
  9. Safety & Escalation
- ✅ **Line Break Preservation** - HTML rendering with `<br>` tags, auto-resize on Enter
- ✅ **Version Control** - Deploy/rollback system with change summaries
- ✅ **Voice & VAD Settings per Prompt** - 10 OpenAI Realtime voices + VAD tuning (threshold, padding, silence duration)
- ✅ **Variable System** - 22 available variables with inline insertion
  - Click variable bolt icon to insert {{variable}} syntax
  - 6 Lead variables (name, email, phone, age)
  - 11 Property variables (address, city, state, equity calculations with Words versions)
  - 5 Broker variables (name, company, phone)
- ✅ **Tools Reference** - 11 production tools organized by category
- ✅ **Guide Tab** - Best practices and examples for each section
- ✅ **Performance Tab** - Placeholder for future analytics
- ✅ **Immediate UI Updates** - Deploy button refreshes status without navigation
- ✅ **Smart Prompt Loading** - Left-to-right order by call type priority
- ✅ **Metadata Context** - Purpose & Goal fields provide AI context without affecting OpenAI payload

**Database Schema (LIVE):**
- ✅ `prompts` table - 9 fixed prompts with call_type, voice, vad_threshold, vad_prefix_padding_ms, vad_silence_duration_ms, purpose, goal, is_active
- ✅ `prompt_versions` table - Version control with JSONB content, change summaries
- ✅ `prompt_deployments` table - Deployment history tracking
- ✅ `call_evaluations` table - Automated evaluation scores and analysis
- ✅ Unique constraint: Only one active prompt per call_type
- ✅ Metadata columns (purpose, goal) for AI context
- ✅ Voice & VAD columns with CHECK constraints for valid ranges
- ✅ Production prompts populated with content from `prompts/Production Prompts/`
- ✅ Migration 026: Added purpose/goal metadata for all 9 call types
- ✅ Migration 027: Added voice and VAD settings columns with defaults

**Barbara V3 Integration (LIVE):**
- ✅ **Dynamic Prompt Loader** (`barbara-v3/src/services/prompts.ts`)
  - Fetches prompts from database by call_type
  - Assembles 9 JSONB sections into single prompt string
  - Returns voice, VAD settings, and version metadata
  - 5-minute in-memory caching for performance
  - Applies voice & VAD settings via session.update message
- ✅ **Transcript Capture** (`barbara-v3/src/services/transcript-store.ts`)
  - Stores conversation transcript + prompt metadata in memory
  - Retrieved by save_interaction for database storage
- ✅ **Call Evaluation Integration** (`barbara-v3/src/services/call-evaluation.service.ts`)
  - Triggered automatically after every call
  - Links evaluation to prompt version used
  - Enables performance comparison across versions
- ✅ **Live in Production** - Barbara V3 loads all prompts from Supabase with dynamic voice & VAD per call type

**UI Improvements (OCT 27-28):**
- ✅ Version numbers more prominent (larger, bolder, darker)
- ✅ Settings tab with Voice & VAD configuration (call type removed - fixed per prompt)
- ✅ Horizontal scrolling for prompt/version cards
- ✅ Call type badges with Naive UI icons (purple text, no background)
- ✅ Cleaner card layout (removed category display)
- ✅ Deploy button updates UI immediately
- ✅ AI sparkle icons (gold/orange) for visual hierarchy
- ✅ Button reordering: Variable bolt before AI sparkle
- ✅ Styled AI Audit button (purple background, gold sparkle icon)
- ✅ Compact VAD controls (~25% smaller for better UI density)
- ✅ **Performance Metrics Styling (OCT 28)** - Compact, pastel design for better visual hierarchy:
  - Reduced card padding and spacing (8px gaps, tighter layout)
  - Pastel progress bar colors (soft green/yellow/red, 0.5-0.6 alpha)
  - Lighter card backgrounds (rgba(255, 255, 255, 0.5))
  - Smaller font sizes for metric labels/scores (0.72rem labels, 1.3rem scores)
  - Summary stats grid with custom styling (replaces n-statistic)
  - Fixed text cropping in "Last Evaluated" (line-height: 1.3)
- ✅ **AI Improvement Suggestions Styling (OCT 28)** - Perfect badge alignment and bulk actions:
  - Pastel badge colors (soft red/orange/blue, 0.15 alpha backgrounds)
  - Fixed badge alignment with min-width: 60px
  - Vertical centering with inline-flex + align-items: center
  - Left-justified suggestion text with proper spacing (16px padding)
  - Fixed "g" cropping with balanced padding (3px 8px) and line-height: 1.4
  - Consistent badge heights (min-height: 22px) for visual alignment
  - **"Apply All" button** - Pastel purple styling to open all suggested sections at once

**Production Content:**
- ✅ All 9 prompts populated with production-ready content
- ✅ Based on proven prompts from `prompts/Production Prompts/`
- ✅ Adapted to 9-section structure for better organization
- ✅ Variables verified against bridge's enrichedVariables
- ✅ Migration 025: Fixed variable references

**Key Accomplishments (OCT 27):**
- ✅ AI Section Improver with GPT-5-mini (10-15 second responses)
- ✅ Comprehensive AI Audit with GPT-5 (6-question guided evaluation)
- ✅ One-click apply for all AI recommendations
- ✅ Metadata system (purpose, goal) for AI context
- ✅ Realtime API best practices documentation
- ✅ Smart prompt loading (left-to-right by call type)
- ✅ Enhanced UX (button reordering, icon styling, AI Audit button, compact VAD controls)
- ✅ Variable inline insertion with bolt icon
- ✅ Integrated with Barbara V3 via dynamic prompt loader
- ✅ Call evaluation system tracks performance per prompt version
- ✅ **Dynamic Voice & VAD settings per prompt** - **NEW OCT 27**
  - Voice selection: 10 OpenAI Realtime voices (alloy, echo, shimmer, ash, ballad, coral, sage, verse, cedar, marin)
  - VAD Threshold: 0.3-0.8 (controls speech sensitivity)
  - VAD Prefix Padding: 100-1000ms (audio captured BEFORE speech)
  - VAD Silence Duration: 200-2000ms (silence before turn ends)
  - Auto-save on change (no manual save button needed)
  - Settings applied per prompt (not per version - tuning knobs)
  - Advanced settings section (collapsible with warning)
  - Reset to defaults button (shimmer, 0.5, 300ms, 500ms)
- ✅ All changes committed and deployed to production

**Next Steps:**
- [ ] Deploy portal UI to Vercel for broker access
- [ ] Build dashboard to visualize call evaluation trends per prompt version
- [ ] Add call analytics (transcripts, success rates per version)
- [ ] Add performance metrics dashboard showing evaluation scores
- [ ] Use evaluation data to guide prompt improvements
- [ ] A/B test prompt versions and compare evaluation scores

**15. Lead Management Portal** ⭐ **PRODUCTION READY** (OCT 28, 2025)
- **Purpose:** Comprehensive lead management interface with advanced filtering, sorting, and timeline views
- **Architecture:** Vue 3 + Vite + Supabase + Naive UI + Custom HTML table
- **Deployment:** Vercel (auto-deploy on `portal/**` changes)
- **Status:** ✅ **PRODUCTION READY - Fully Integrated with Supabase**

**Core Features (LIVE):**
- ✅ **Lead List Page** (`/admin/leads`) - Advanced lead management interface
  - Custom HTML table with responsive design (replaced n-data-table for full control)
  - Multi-select filters: Status, Campaign Status, Broker (all possible values from schema)
  - Advanced search: Name, address, city, ZIP code
  - Column sorting: Name, ZIP, Status, Campaign, Broker, Age, Activity
  - Dynamic lead count display (filtered results)
  - Default filter: Excludes `needs_contact_info` status leads
  - Infinite scroll with scroll-to-top button (auto-detects scrollable containers)
  - Alternating row shading (Excel-style) with hover effects
  - Responsive design: Handles navigation sidebar open/closed states
- ✅ **Lead Detail Page** (`/admin/leads/:id`) - Individual lead timeline view
  - Beautiful timeline design using Naive UI timeline components
  - Full interaction history with conversation transcripts
  - Metadata display: Notes, meeting links, conversation details
  - Timeline item types: Success (appointments), Info (AI calls), Default (emails/SMS)
  - Chronological sorting (newest first)
  - Rich content display with role-based transcript formatting
- ✅ **Database Integration** - Full Supabase integration
  - Real-time lead data fetching with broker name resolution
  - Interaction history with metadata parsing
  - Status color coding (new, contacted, qualified, etc.)
  - Campaign status tracking with visual indicators
  - Age calculation (person age + days since creation)
  - Relative time formatting (17h, 2d, 3w ago)
- ✅ **Authentication & RLS** - Secure access control
  - Admin users: Full access to all leads and interactions
  - Broker users: Access to assigned leads only
  - Fixed RLS policies based on `auth.users` table (not brokers table)
  - Role-based UI filtering and permissions
- ✅ **UI/UX Excellence** - Professional interface design
  - Matches existing PromptManagement.vue styling
  - Purple header theme with consistent branding
  - Compact table design with optimized column widths
  - Smooth animations and transitions
  - Mobile-responsive layout
  - Clean typography and spacing

**Database Schema Integration:**
- ✅ `leads` table - Full lead data with broker assignments
- ✅ `brokers` table - Broker information and company names
- ✅ `interactions` table - Call/email/SMS history with metadata
- ✅ `call_evaluations` table - Automated call quality scores
- ✅ `prompt_versions` table - Version tracking for timeline context
- ✅ RLS policies updated for authenticated user access
- ✅ `needs_contact_info` status for leads without email addresses

**Technical Implementation:**
- ✅ Custom HTML table with flexbox layout for precise control
- ✅ Scroll detection for multiple containers (window + layout containers)
- ✅ Multi-select filter components with all possible status values
- ✅ Computed properties for filtering, sorting, and data formatting
- ✅ Router integration for lead detail navigation
- ✅ Error handling and loading states
- ✅ Performance optimization with efficient data queries

**Key Accomplishments (OCT 28):**
- ✅ Built comprehensive lead list interface with advanced filtering
- ✅ Implemented lead detail timeline with interaction history
- ✅ Fixed RLS authentication issues (admin access restored)
- ✅ Created responsive table design with custom styling
- ✅ Added scroll-to-top functionality with auto-detection
- ✅ Integrated with existing portal architecture
- ✅ All changes committed and deployed to production

**Next Steps:**
- [ ] Add lead editing capabilities (update contact info, notes)
- [ ] Implement bulk actions (assign broker, update status)
- [ ] Add lead export functionality (CSV, PDF)
- [ ] Build lead analytics dashboard (conversion rates, trends)
- [ ] Add lead assignment workflow (territory-based routing)
- [ ] Implement lead scoring system (AI-powered qualification)

**16. System Metrics Dashboard** ⭐ **PRODUCTION READY** (OCT 31, 2025)
- **Purpose:** Real-time infrastructure and service dependency monitoring with comprehensive health visualization
- **Architecture:** Supabase Edge Function (Deno) + Vue 3 Portal Integration + API Status Aggregation
- **Deployment:** Edge Function on Supabase global network + Vue dashboard components
- **Status:** ✅ **PRODUCTION READY - Independent Service Deployed**

**Core Features (LIVE):**
- ✅ **Supabase Edge Function** - Independent monitoring service (removed from barbara-v3 bridge)
  - Endpoint: `https://mxnqfwuhvurajrgoefyg.supabase.co/functions/v1/system-metrics`
  - Monitors 5 platforms: Fly.io, Northflank, OpenAI, Gemini, SignalWire
  - Auto-scaling global edge deployment
  - CORS-enabled for cross-origin requests
  - 30-second average response time
- ✅ **Infrastructure Monitoring**
  - Fly.io: barbara-v3-voice app status, machine health (2/3 running), deployment version
  - Northflank: 5 n8n services (n8n, n8n-worker, n8n-custom-build, barbara-mcp, swarmtrace-mcp)
  - Service status detection: Running/Stopped/Degraded/Error
  - Replica counts and health checks
- ✅ **AI Service Dependencies**
  - OpenAI: Platform status + Realtime API + Chat API (critical for Barbara)
  - Google Gemini: API status + active incident detection
  - SignalWire: Platform + Voice/Calling + Messaging/SMS + AI Services + API/Dashboard
  - RSS feed parsing for incident tracking
  - Active incident categorization by service type
- ✅ **System Analytics Page** (`/admin/system-analytics`) - Detailed service monitoring
  - Real-time status cards for all 5 platforms
  - Individual service breakdowns with operational status
  - Auto-refresh every 2 minutes (120s) to avoid rate limiting
  - Dark mode theming with proper card styling
  - Color-coded status tags (green/yellow/red)
  - "Critical Dependency" badges for business-critical services (blue when operational, red when down)
- ✅ **Dashboard Health Card** - 6-ring visualization on main dashboard
  - Concentric ring design matching AI Performance card aesthetic
  - Color-coded rings: Green (operational), Yellow (degraded/rate limited), Red (down)
  - Center displays: "6/6" healthy services count
  - Legend shows: Service name + real-time status text (Operational/Running/Rate Limited/Degraded/Down)
  - Auto-refresh every 2 minutes (120s) to avoid rate limiting
  - Positioned as 2nd card after AI Performance
  - 6 rings represent: OpenAI Realtime, SignalWire Voice, Fly.io, Northflank, Gemini, SignalWire SMS
  - Rate limit detection: Shows yellow when API throttled, not red

**Implementation Details:**
- ✅ **Status Aggregation Logic**
  - Filters out unconfigured services from health percentage
  - Only counts monitored services (excludes unknown/error states)
  - Prioritizes running replica counts for Northflank (simplified detection)
  - Handles both string and object response formats from APIs
- ✅ **API Integration**
  - Fly.io: GraphQL API with machine state queries
  - Northflank: REST API with service detail endpoints (fixed status parsing)
  - OpenAI: Public status page JSON endpoint (`status.openai.com/api/v2/status.json`)
  - Gemini: Google Cloud incidents JSON endpoint (`status.cloud.google.com/incidents.json`)
  - SignalWire: RSS feed parsing with HTML content extraction (`status.signalwire.com/history.rss`)
- ✅ **Error Handling & Resilience**
  - 5-second timeout on all external API calls
  - Graceful degradation when services unavailable
  - Console logging for debugging Northflank API responses
  - Fallback status displays

**Database & Secrets:**
- ✅ Supabase Vault secrets created via SQL MCP:
  - `FLY_API_TOKEN` - Fly.io GraphQL API access
  - `NORTHFLANK_API_TOKEN` - Northflank REST API access
  - `NORTHFLANK_PROJECT_ID` - n8n-with-worker project
- ✅ Edge Function environment variables configured in Supabase Dashboard
- ✅ Authorization via Supabase anon key (JWT verification enabled)

**Key Accomplishments (OCT 31):**
- ✅ Built and deployed Supabase Edge Function for system monitoring
- ✅ Removed monitoring code from barbara-v3 bridge (reduced load)
- ✅ Created comprehensive System Analytics page with real-time updates
- ✅ Added 6-ring health visualization to main dashboard (2nd card position)
- ✅ Fixed CORS headers for cross-origin requests (added authorization header support)
- ✅ Implemented proper status detection for Northflank services (runningInstances > 0 = Running)
- ✅ Added debug logging for API response troubleshooting
- ✅ Simplified health calculation to ignore unconfigured services
- ✅ Fixed "Critical" badge to show "Critical Dependency" (informational, not error)
- ✅ Set environment variables via Supabase MCP using SQL vault.create_secret()
- ✅ Fixed all light mode theming issues across portal (UserProfile, PromptManagement, Appointments, Login, AdminLayout)
- ✅ Added dynamic logo switching between dark/light versions based on system theme
- ✅ Implemented Northflank rate limit detection (shows as yellow "Rate Limited" not red "Down")
- ✅ Increased refresh intervals to 2 minutes (4x reduction in API calls - 30/hr vs 120/hr)
- ✅ All changes committed and pushed to production (13 commits total)

**Files Created:**
- `supabase/functions/system-metrics/index.ts` - Edge Function with monitoring logic
- `SYSTEM_METRICS_SUPABASE_EDGE_FUNCTION.md` - Technical documentation
- `setup-supabase-secrets.md` - Environment variable setup guide
- `SETUP_COMPLETE.md` - Quick reference guide
- `DAILY_SUMMARY_OCT_31_2025.md` - Comprehensive daily work summary
- `portal/src/assets/barbara-logo-light.svg` - Light mode full logo
- `portal/src/assets/barbara-logo-compact-light.svg` - Light mode compact logo

**Files Modified:**
- `portal/src/views/admin/SystemAnalytics.vue` - Supabase endpoint, 2min refresh, rate limit handling
- `portal/src/views/admin/Dashboard.vue` - 6-ring Health Card, rate limit detection, 2min refresh
- `portal/src/views/admin/UserProfile.vue` - Theme-specific card backgrounds
- `portal/src/views/admin/PromptManagement.vue` - Theme-specific n-card backgrounds
- `portal/src/views/admin/Appointments.vue` - Theme-specific calendar backgrounds
- `portal/src/layouts/AdminLayout.vue` - Dynamic logo switching (dark/light)
- `portal/src/views/Login.vue` - Dynamic logo switching (dark/light)
- `MASTER_PRODUCTION_PLAN.md` - Updated with Oct 31 accomplishments

**Files Removed:**
- `monitoring/` directory (entire Vercel monitoring setup)
- `barbara-v3/src/services/system-metrics.ts` - Moved to Edge Function
- `barbara-v3/src/routes/api.ts` - Removed /api/system-metrics route

**Next Steps:**
- [ ] Add historical uptime tracking and trends
- [ ] Implement alerting for service degradation (email/Slack notifications)
- [ ] Add response time monitoring for critical services
- [ ] Build incident history timeline
- [ ] Add cost tracking for infrastructure services

**17. Lead Detail Page Enhancements** ⭐ **PRODUCTION READY** (OCT 28, 2025)
- **Purpose:** Advanced lead detail interface with call transcript modal, evaluation scores, and responsive design
- **Architecture:** Vue 3 + Vite + Supabase + Naive UI + Google Maps Embed API
- **Deployment:** Vercel (auto-deploy on `portal/**` changes)
- **Status:** ✅ **PRODUCTION READY - Fully Integrated with Call Evaluation System**

**Core Features (LIVE):**
- ✅ **Two-Column Responsive Layout** - Desktop: Lead Info & Map (left), Timeline (right); Mobile: Stacked layout
  - Breakpoint: 1000px (customizable responsive design)
  - Lead Info Card: Contact details, property information, broker assignment
  - Map Card: Google Maps integration with property location
  - Timeline Card: Complete interaction history with visual timeline
- ✅ **Google Maps Integration** - Interactive property location display
  - Search mode for address-based mapping (more forgiving than place mode)
  - Responsive iframe with proper sandbox permissions
  - "Open in Maps" and "Copy Address" action buttons
  - Fallback placeholder for missing addresses
  - Environment variable configuration (VITE_GOOGLE_MAPS_API_KEY)
- ✅ **Call Transcript Modal** - Full conversation history with messaging-style UI
  - Caller messages: Left-aligned blue bubbles
  - Barbara (AI) messages: Right-aligned gray bubbles
  - Real-time transcript capture from OpenAI Realtime API
  - Millisecond precision timestamps for correct conversation order
  - Scrollable conversation view with proper message formatting
- ✅ **Automated Call Evaluation Scores** - AI-powered call quality analysis
  - 6 performance metrics (0-10 scale): Opening Effectiveness, Property Discussion Quality, Objection Handling, Booking Attempt Quality, Tone Consistency, Overall Call Flow
  - Color-coded score display (green 8+, yellow 6-7, red <6)
  - Evaluation scores shown in timeline for AI calls
  - Detailed evaluation breakdown in transcript modal
- ✅ **Enhanced Timeline Design** - Professional interaction history display
  - Visual timeline with colored dots for different interaction types
  - Rounded timeline tags (12px border-radius) matching lead status styling
  - 1px timeline dot borders for subtlety
  - Chronological sorting (newest first)
  - Rich metadata display (duration, outcome, evaluation scores)
- ✅ **Navigation & UX Improvements** - Intuitive user experience
  - Icon-only back button (ArrowBackOutline) with proper positioning
  - Router scroll behavior (always scroll to top on navigation)
  - Responsive breakpoint adjustments for optimal layout
  - Error handling and loading states throughout

**Database Integration:**
- ✅ `call_evaluations` table - Automated evaluation scores and analysis
- ✅ `interactions` table - Conversation transcripts in metadata.conversation_transcript
- ✅ `leads` table - Property address formatting for two-line display
- ✅ `brokers` table - Broker name resolution for lead assignments
- ✅ RLS policies - Secure access control for authenticated users

**Technical Implementation:**
- ✅ **Responsive CSS Grid** - Two-column layout with proper breakpoints
- ✅ **Google Maps Embed API** - Search mode for reliable address mapping
- ✅ **Vue 3 Composition API** - Reactive data management and lifecycle hooks
- ✅ **Naive UI Components** - Modal, Scrollbar, Tag, Button, Icon integration
- ✅ **Supabase Integration** - Real-time data fetching with evaluation scores
- ✅ **Error Handling** - Comprehensive error states and fallback UI
- ✅ **Performance Optimization** - Efficient data queries and computed properties

**Key Accomplishments (OCT 28):**
- ✅ Built comprehensive call transcript modal with messaging-style UI
- ✅ Integrated automated call evaluation scores display (0-10 scale)
- ✅ Implemented two-column responsive layout with Google Maps
- ✅ Added millisecond precision timestamps for correct conversation order
- ✅ Enhanced timeline styling with rounded tags and subtle dot borders
- ✅ Created icon-only navigation with proper scroll behavior
- ✅ Fixed transcript content display (text vs content field issue)
- ✅ Added comprehensive error handling and loading states
- ✅ All changes committed and deployed to production

**Next Steps:**
- [ ] Add transcript search functionality within modal
- [ ] Implement transcript export (PDF, text)
- [ ] Add call quality trends dashboard
- [ ] Build A/B testing interface for prompt versions
- [ ] Add transcript annotation and note-taking
- [ ] Implement call replay functionality (if audio available)

**17. Cold Email Campaign System** ⭐ **PRODUCTION READY** (COMPLETE)
- **Multi-Angle Campaign Rotation:** 3 archetypes with automatic retry for non-responders
- **Campaign Config Table:** Database-driven campaign management (`campaigns` table)
- **Campaign History Tracking:** JSONB array tracks all attempts per lead
- **Smart Assignment Logic:** 
  - Round 1: Data-driven (mortgage status, equity level)
  - Round 2-3: Automatic rotation through untried angles
  - Auto-skip after 3 attempts
- **3 Campaign Archetypes:**
  1. "No More Payments" (has mortgage) - eliminate payment angle
  2. "Cash Unlocked" (paid off) - access equity angle  
  3. "High Equity Special" ($500k+) - premium positioning
- **Per-Broker Capacity:** View respects each broker's `daily_lead_capacity`
- **Workflow:** `campaign-feeder-daily-CLEAN.json`
- **Status:** ✅ **PRODUCTION READY - Instantly integration complete**
- **Next:** Refine campaign copy for improved conversion rates

**18. Reply Handler + TCPA Consent** ⭐ **PRODUCTION READY** (COMPLETE)
- ✅ Instantly webhook for reply detection
- ✅ Consent form workflow (for phone calls only)
- ✅ Database consent recording
- ✅ Full TCPA compliance workflow operational
- **Status:** ✅ **PRODUCTION READY - Full workflow operational**

**19. Scaling Strategy (100 Brokers)**
- **Territory Management:**
  - Each broker gets 45,000-50,000 properties
  - ZIP-based territory assignment
  - Automatic PropertyRadar list creation
- **Sustainability Model:**
  - 100 leads/day = 26,400/year per broker (22 work days/month × 12 months)
  - PropertyRadar 60% annual refresh = 27,000-30,000 new properties
  - Auto-refreshing dynamic lists - infinite scalability
- **Infrastructure:**
  - AI workflow scales horizontally (one per broker)
  - Database handles 100 concurrent workflows
  - PropertyRadar + SwarmTrace enrichment (82-84% email, 97% phone, 98-99% cost reduction vs BatchData)
- **Revenue Model:**
  - $6,030 profit per broker per month
  - $603,000 monthly profit at 100 brokers
  - $7.24M annual profit potential

---

## 📘 Campaign System Quick Reference

### How Campaign Rotation Works

**Round 1 (First Contact):**
- Lead gets data-driven archetype assignment
- High equity ($500k+) → "High Equity Special"
- Debt-free (isFreeAndClear=1) → "Cash Unlocked"
- Has mortgage → "No More Payments"

**Round 2 (14 days later, no reply):**
- Workflow checks `campaign_history`
- Assigns first untried archetype from sequence
- Example: Tried "No More Payments" → Try "Cash Unlocked"

**Round 3 (28 days later, still no reply):**
- Assigns second untried archetype
- Example: Tried both above → Try "High Equity Special"

**Exhausted (42 days, no reply):**
- Lead tried all 3 angles
- Workflow skips lead (returns empty array)
- Can manually reset `campaign_history` to retry

### Managing Campaign IDs

**To add Instantly campaign IDs:**
```sql
UPDATE campaigns 
SET instantly_campaign_id = 'your-instantly-uuid-here' 
WHERE archetype = 'no_more_payments';

UPDATE campaigns 
SET instantly_campaign_id = 'another-uuid' 
WHERE archetype = 'cash_unlocked';

UPDATE campaigns 
SET instantly_campaign_id = 'third-uuid' 
WHERE archetype = 'high_equity_special';
```

**To check campaign history for a lead:**
```sql
SELECT first_name, last_name, campaign_history 
FROM leads 
WHERE id = 'lead-uuid';
```

**To reset a lead's campaign history (retry all 3):**
```sql
UPDATE leads 
SET campaign_history = '[]', 
    campaign_archetype = NULL,
    added_to_campaign_at = NULL
WHERE id = 'lead-uuid';
```

**To see campaign distribution:**
```sql
SELECT 
  campaign_archetype,
  COUNT(*) as lead_count
FROM leads
WHERE campaign_archetype IS NOT NULL
GROUP BY campaign_archetype;
```

---

### 🔄 REMAINING TASKS

**1. Campaign Copy Refinement** ⭐ **HIGH PRIORITY**
- Refine messaging for all 3 archetypes:
  - "No More Payments" (has mortgage) - eliminate payment angle
  - "Cash Unlocked" (paid off) - access equity angle  
  - "High Equity Special" ($500k+) - premium positioning
- Improve subject lines and call-to-action effectiveness
- A/B test different copy variations

**2. Portal Vercel Deployment** ✅ **COMPLETE**
- ✅ Portal deployed to Vercel (https://equity-connect.vercel.app)
- ✅ Auto-deploy configured on `portal/**` changes
- ✅ Environment variables configured
- ✅ Production domain: **app.barbarapro.com** (portal/admin interface)
- ✅ Landing page domain: **barbarapro.com** (marketing site)
- ✅ Business registered: **Barbara LLC (Wyoming)** - October 30, 2025
- [ ] Implement post-deployment features:
  - Detailed analytics and reporting
  - Data export functionality (CSV, PDF)
  - Real-time notifications and alerts
  - Advanced filtering and search capabilities

**3. Lead Management Enhancements** ⭐ **MEDIUM PRIORITY**
- Add lead editing capabilities (update contact info, notes)
- Implement bulk actions (assign broker, update status)
- Build lead analytics dashboard (conversion rates, trends)
- Add territory-based lead assignment workflow
- Implement AI-powered lead scoring system

**4. Broker RLS Setup** ⭐ **MEDIUM PRIORITY**
- Configure Row Level Security policies:
  - **Brokers:** See only their assigned leads
  - **Admins:** See all leads across all brokers
- Test broker access restrictions
- Ensure proper data isolation

### 📅 FUTURE PHASES

**8. Phone Outreach** ⭐ **PRODUCTION READY** (COMPLETE)
- ✅ Barbara V3 AI voice calls (with consent)
- ✅ SignalWire phone pool management
- ✅ DNC registry integration
- ✅ Call outcome tracking
- **Status:** ✅ **PRODUCTION READY - Barbara V3 + SignalWire operational**
- **SMS Coordinator Persona ("Sarah") — WAITING ON 10DLC APPROVAL**
  - **Status:** ⏳ 10DLC registration delayed - used registered agent address (blacklisted by carrier)
  - **Issue:** SignalWire 10DLC campaign approval held up 3-4 days due to using registered agent business address instead of actual operating address
  - **Resolution:** Resubmitted with correct business address, awaiting carrier approval
  - **Expected:** Approval within 24-48 hours, then SMS bridge operational
  - **Architecture Ready:** SMS handler built and tested, waiting only on 10DLC approval
  - Continuity persona used in cold email campaigns will anchor SMS outreach. Barbara handles live calls, Sarah handles asynchronous texts so leads perceive a coordinated human team.
  - **Missed-call follow-up:** "Hi John, this is Sarah from Walter's office. The team let me know they couldn't reach you earlier – that's totally fine. What's a good time for a callback? Or happy to answer any questions here." Sends automatically when Barbara's call goes unanswered.
  - **Pre-appointment soft confirmation:** "Hi John, it's Sarah. Just confirming your appointment with Walter tomorrow at 2pm. Make sure you have your property tax bill handy – but if you can't find it, totally fine, we can work with that. Looking forward to it!"
  - **Post-booking thank-you / FAQ check-in:** "Thanks again for booking with Walter. Do you have any questions before we meet? Happy to help here." Keeps the conversation warm and catches objections early.
  - **Failed booking or call fallback:** If Barbara can't secure a time on voice, Sarah continues the conversation via SMS, re-running `check_broker_availability` → `book_appointment` and, once confirmed, `assign_tracking_number` directly from text.
  - **Conversation memory requirements:** SMS handler must persist per-lead context (phone, prior messages, tool calls) so Sarah replies in-thread, references earlier touchpoints, and respects STOP/HELP compliance while logging outcomes via `save_interaction`.
  - **Lesson Learned:** Always use actual operating address for 10DLC registration, not registered agent address (often flagged as commercial mail forwarding service)

**9. Appointment Booking** ⭐ **PRODUCTION READY** (COMPLETE)
- ✅ Nylas calendar integration (replaced Cal.com)
- ✅ Broker calendar sync
- ✅ Appointment confirmation workflows
- ✅ Real-time availability checking
- **Status:** ✅ **PRODUCTION READY - Nylas integration complete**

**10. Custom Broker Portal** ⭐ **ALPHA READY** (NEEDS DEPLOYMENT)
- ✅ Broker onboarding interface
- ✅ Territory management (ZIP code assignment)
- ✅ Lead dashboard with real-time metrics
- ✅ Campaign analytics and performance tracking
- ✅ Built on Vue.js + Supabase (custom, not third-party CRM)
- **Status:** ✅ **ALPHA READY - Ready for Vercel deployment**
- **Next:** Deploy to Vercel + implement RLS policies (broker vs admin access)

**11. Geo-Based Microsites + Calculator** (Phase 2 - After Stable Lead Gen)
- **Strategy:** Vercel geo-detection + encrypted lead tokens (no ethnic profiling)
- **City Pages:** Base domain + geo → auto-personalizes for visitor's city
- **Interactive Calculator:** Hail mary email #4 with pre-filled equity numbers
- **Tokens:** AES-256 encrypted, 90-day expiration, tracks visits/conversions
- **Domain Rotation:** Flexible - works with ANY domain (add/remove as deliverability changes)
  - Current: 15 domains from `config/SpaceshipDomains.tsv`
  - Add new domains anytime (just point DNS to Vercel)
  - Retire burnt domains without breaking old links (tokens still work)
  - No subdomain wildcards needed (simpler DNS management)
- **Cost:** $20/month (Vercel Pro for unlimited domains)
- **ROI:** 35-50x (additional conversions from visual engagement)
- **Documentation:** `docs/MICROSITE_ARCHITECTURE_PLAN.md`
- **Deployment Guide:** `docs/VERCEL_MICROSITE_DEPLOYMENT.md`
- **Migration:** `database/migrations/microsite-infrastructure.sql`
- **Templates:** `templates/microsite/city-based-config.json`
- **Status:** ✅ Planned, Ready to Implement

---

## 🏗️ System Architecture

### Data Flow
```
PropertyRadar Pull Worker (daily 6am)
  ↓ Pulls 250 leads per broker
Supabase Database + Pipeline Events Queue
  ↓
PropertyRadar + SwarmTrace Enrichment (every 5 min)
  ├─ PropertyRadar /persons API (first tier)
  └─ SwarmTrace MCP skip trace (quality < 70 fallback)
  ↓ Best-of-both merge + quality scoring
206+ enriched (82% success rate)
  ↓
Backfill System (throughout day)
  ├─ Q2H Checker (8am-8pm, every 2h)
  └─ EOD Safety Check (10pm)
  ↓ Monitors shortfall, auto-pulls more if needed
250 complete enrichments guaranteed ✅
  ↓
Campaign Feeder (Instantly.ai, daily 8am)
  ↓ (4-email sequence over 14 days)
Reply Handler (n8n webhook from Instantly)
  ↓ (positive replies only)
Consent Form (TCPA for phone calls)
  ↓ (consent recorded)
SignalWire Phone Pool Assignment (territory-based)
  ↓ (MyReverseOptions1-5 numbers)
Phone Outreach (VAPI + Barbara AI via SignalWire)
  ↓
Appointment (Cal.com)
  ↓
Deal Closed
```

---

## 📁 Database Schema (Supabase PostgreSQL)

### Core Tables

**`brokers`**
- Broker profiles (company, contact, NMLS)
- Configuration: `daily_lead_capacity`, `propertyradar_list_id`, `propertyradar_offset`
- Performance tracking: conversion_rate, show_rate, revenue

**`leads`**
- Property information (address, value, equity)
- Owner data (first_name, last_name, age)
- Contact info (primary_email, primary_phone, email_verified, phone_verified)
- Dedup keys (radar_id, apn, county_fips, addr_hash)
- Campaign tracking (campaign_status, added_to_campaign_at, current_sequence_step)
- Consent (consent, consented_at, consent_method)
- Enrichment data (radar_property_data, enrichment_data jsonb fields)

**`pipeline_events`**
- Async processing queue
- Event types: enrich_propertyradar, enrich_pdl, enrich_melissa
- Status tracking: pending, processing, complete, failed
- Lead and broker associations

**`broker_territories`**
- ZIP code assignments per broker
- Market names and active status

**Supporting Tables:**
- `consent_tokens` - TCPA consent nonce replay protection
- `pipeline_dlq` - Dead letter queue for failed events
- `interactions` - Call/email/appointment history
- `billing_events` - Performance-based billing tracking

---

## 🔧 n8n Workflows

### Data Acquisition
1. **PropertyRadar List Pull Worker** (Daily 6am)
   - File: `workflows/propertyradar-list-pull-worker.json`
   - Pulls 250 properties per broker
   - 17 nodes, ~40 second runtime

2. **PropertyRadar List Creator** (One-time per broker)
   - File: `workflows/propertyradar-create-list-helper.json`
   - Creates dynamic lists in PropertyRadar
   - Updates broker record with list_id

3. **Broker Setup Webhook** (Vercel UI trigger)
   - File: `workflows/propertyradar-broker-setup-webhook.json`
   - Auto-creates PropertyRadar lists when broker added in UI

### Enrichment ✅
4. **PropertyRadar + SwarmTrace Enrichment** (Every 5 min) ✅
   - File: `workflows/unified-enrichment-waterfall.json`
   - PropertyRadar `/persons` API (first tier - names, emails, phones)
   - SwarmTrace MCP skip trace (fallback when quality < 70)
   - Quality scoring system (0-100 scale)
   - Best-of-both merge logic
   - Target: 82-84% email coverage, 97% phone coverage
   - **Cost:** $0.0125/skip trace (98% cheaper than BatchData)
   - **Status:** Production-ready, 14 nodes

### Campaign Management
7. **Campaign Feeder** (Daily 8am)
   - File: `workflows/campaign-feeder-daily.json`
   - Sends enriched leads to Instantly
   - 250/day per broker

8. **Reply Handler** (Building Monday)
   - Instantly webhook trigger
   - Detects positive replies
   - Triggers consent form for calling

9. **Error Handler & DLQ Retry** (Existing)
   - File: `workflows/error-handler-dlq-retry.json`
   - Retries failed pipeline events

---

## 🔐 Compliance Rules

### Cold Email (CAN-SPAM)
**No consent required.**

Requirements:
- Unsubscribe link (Instantly auto-adds)
- Physical address (Instantly auto-adds)
- Accurate subject line
- Honor unsubscribes within 10 days

**Tools:** Instantly.ai handles all compliance

---

### Phone Calls (TCPA)
**Consent required before calling.**

Flow:
1. Lead replies to cold email
2. Send consent form: "May we call you?"
3. Lead submits form
4. Record consent with timestamp
5. Check DNC registry
6. Now can call (8am-9pm local time only)

**Tools:** n8n reply handler + consent form + DNC API

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

## 🗓️ Weekend Implementation Roadmap

### Saturday: Enrichment Workflow ✅
- [x] Built PropertyRadar enrichment workflow
- [x] Added quality scoring system (0-100 scale)
- [x] Updated database schema for enrichment tracking
- [x] Import into n8n, activated
- [x] Test with sample leads
- [x] Activate and monitor 250 lead enrichment
- [x] Verified 82-84% email coverage, 97% phone coverage

### Sunday: Campaign Setup
- [ ] Configure Instantly campaign
- [ ] Write 3-email sequence
- [ ] Test campaign feeder with 10 leads
- [ ] Verify Instantly custom fields populate correctly (property_address, estimated_equity, etc.)

### Monday: Reply Handling
- [ ] Build Instantly reply webhook
- [ ] Detect "YES" / positive intent
- [ ] Send TCPA consent form
- [ ] Record consent in database

### Tuesday: Production Launch
- [ ] Activate daily workflows
- [ ] Monitor first 50 leads through full cycle
- [ ] Track metrics (open rate, reply rate, consent rate)
- [ ] Fix any issues

---

## 📚 Documentation Structure

### Core Docs (Keep - Updated)
- **`docs/MASTER_PRODUCTION_PLAN.md`** ← THIS FILE (complete system overview)
- **`docs/WEEKEND_ROADMAP.md`** - Sat/Sun/Mon tasks
- **`docs/ENRICHMENT_WORKFLOW_FINAL.md`** - Unified enrichment with quality scoring
- **`docs/ECONOMICS_FULL_SCALE.md`** - Complete economics at 1-50 broker scale
- **`docs/COMPLIANCE_SIMPLE_GUIDE.md`** - Email vs call rules
- **`docs/PROPERTYRADAR_PULL_WORKFLOW_FINAL.md`** - PropertyRadar pull workflow details

### Reference Docs (Keep - Conceptually Accurate)
- `docs/DATABASE_ARCHITECTURE.md` - Database schema details
- `docs/COMPLIANCE_FRAMEWORK.md` - Full compliance requirements
- `docs/BROKER_SELF_SERVICE_ARCHITECTURE.md` - Vercel UI design

### Integration Guides (Keep)
- `docs/INSTANTLY_CONSENT_INTEGRATION.md` - Cold email setup (CORRECTED)
- `docs/CONSENT_MANAGEMENT_GUIDE.md` - TCPA consent for calls (CORRECTED)
- `docs/VAPI_AI_VOICE_INTEGRATION.md` - Voice call setup
- `docs/CALCOM_INTEGRATION.md` - Appointment booking

### Historical/Archive (Move to archive/)
- Old "COMPLETE" summaries (PHASE_1, PHASE_2, SESSION_COMPLETE)
- Old implementation summaries
- Gap analysis docs
- Interim workflow update docs

---

## 🚀 Quick Start (For New Team Members)

### Understand the System (30 min)
1. Read `docs/MASTER_PRODUCTION_PLAN.md` (this file)
2. Read `docs/WEEKEND_ROADMAP.md` (current tasks)
3. Review `docs/PROPERTYRADAR_PULL_WORKFLOW_FINAL.md` (working implementation)

### Set Up Local Environment (1 hour)
1. Clone repository
2. Import n8n workflows from `workflows/` directory
3. Configure Supabase credentials
4. Run database migrations from `config/`
5. Test PropertyRadar pull workflow

### Build Next Component (Per roadmap)
1. Check `docs/WEEKEND_ROADMAP.md` for current priority
2. Follow implementation guide for that component
3. Test with sample data
4. Deploy to production

---

## 🔍 Monitoring & Observability

### Key Metrics to Track

**Lead Acquisition:**
- Properties pulled daily (target: 250/broker)
- Deduplication rate (target: <5% duplicates)
- PropertyRadar list exhaustion date
- Cost per property (~$0.75)

**Enrichment:**
- Email coverage rate (target: 85%+)
- PropertyRadar contact hit rate (target: 70-85%)
- Cost per enriched lead (~$0.80)

**Campaign Performance:**
- Email open rate (target: 25%+)
- Reply rate (target: 3-5%)
- Consent form submission rate (target: 40% of replies)
- Unsubscribe rate (keep below 0.5%)

**Conversion Funnel:**
- Qualified leads (email verified): Target 85% of pulled
- Replies received: Target 3% of sent
- Consents obtained: Target 40% of replies
- Appointments set: Target 20% of consents
- Shows: Target 60% of appointments
- Applications: Target 40% of shows
- Funded deals: Target 50% of applications

---

## 🛠️ Tech Stack

**Infrastructure:**
- Database: Supabase (PostgreSQL + pgvector)
- Automation: n8n (self-hosted on Northflank)
- Email: Instantly.ai (cold email platform)
- Voice: OpenAI Realtime + SignalWire (custom bridge on Northflank)
- Calendar: Nylas v3 API (broker availability + booking)
- Analytics: PromptLayer (prompt management + A/B testing)
- Admin UI: Vercel (Next.js - future)

**APIs & Services:**
- PropertyRadar: Property data + owner contacts + enrichment
- SignalWire: Phone number pools + PSTN streaming + WebSocket bridge
- OpenAI Realtime: AI voice with Barbara assistant (production)
- OpenAI Embeddings: Vector search for knowledge base (80 chunks)
- Nylas: Calendar integration (availability + event creation)
- PromptLayer: Call analytics and prompt iteration

**Development:**
- Version Control: Git
- Documentation: Markdown
- Configuration: JSON workflows + SQL migrations

---

## 📞 Support & Resources

**PropertyRadar:**
- Dashboard: https://app.propertyradar.com
- API Docs: https://developers.propertyradar.com
- List ID: 1104668 (My Reverse Options - 52,823 properties)

**n8n:**
- Instance: https://n8n.instaroute.com
- Current Workflows: CTJmLVrXOJ4kqRRx (pull), 9I53ItoKTuhJ6jl4 (list creator)

**Supabase:**
- Project: mxnqfwuhvurajrgoefyg
- Dashboard: https://supabase.com/dashboard

**Instantly.ai:**
- Campaign ID: (TBD - configure Sunday)

---

## 🎯 Success Criteria

**By End of Week 1 (Oct 13):**
- ✅ 250 properties pulled from PropertyRadar
- ✅ 220+ leads enriched with emails
- ✅ 50+ leads sent to Instantly campaign
- ✅ First replies detected
- ✅ First consents collected

**By End of Month 1 (Nov 10) - Single Broker (100 leads/day):**
- 2,200 total leads (100/day × 22 days)
- 1,936 enriched with emails (88% coverage)
- 8,800 email sends (4-email campaign)
- 550 email opens (25% open rate)
- 110 replies (20% of opens)
- 44 consents for calling (40% of replies)
- 18 appointments booked (0.8/day average)
- $6,160 revenue ($350/show × 18)
- $133 platform costs
- **$6,027 profit per broker**

**Moonshot Goal: 100 Brokers at Scale:**
- **Monthly revenue:** $616,000
- **Monthly costs:** $13,300
- **Monthly profit:** $602,700
- **Annual profit:** $7.2M
- **Territory sustainability:** Auto-refreshing dynamic lists (infinite scalability)

---

**This is your single source of truth for the production system.** 🎯

