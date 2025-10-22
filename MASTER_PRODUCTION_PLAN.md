# Equity Connect - Master Production Plan

**Last Updated:** October 22, 2025  
**Status:** Production Ready  
**Current Phase:** Calendar Integration Complete - Barbara Books Real Appointments + Advanced Commitment Building
**Latest Updates:** Appointment booking fix (Nylas grant ID), token limit removal (no more mid-sentence cutoffs), tool timeout extensions, PromptLayer timestamp fix, VAD recovery disabled, performance tracking added

---

## 🎯 System Overview

Equity Connect is an AI-powered lead generation and nurturing platform for reverse mortgage brokers. The system uses AI agents to autonomously pull qualified property leads, enrich them with contact data, and manage compliant multi-channel outreach campaigns.

**Key Innovation:** Model Context Protocol (MCP) architecture enables one AI agent to orchestrate 4+ external services, replacing 135 deterministic workflow nodes with 13 intelligent nodes.

**Tech Stack:**
- **AI:** Gemini 2.5 Flash via OpenRouter (orchestration), OpenAI Realtime (voice)
- **Orchestration:** n8n (self-hosted on Northflank)
- **Database:** Supabase (PostgreSQL + pgvector)
- **Data Sources:** PropertyRadar API (property data + contact enrichment)
- **Outreach:** Instantly.ai (email), OpenAI Realtime + SignalWire (voice)
- **Integration:** MCP servers (Supabase, Instantly, Barbara, SwarmTrace); Direct Supabase client for voice bridge

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

**Broker #2: Dan Thomas** - Bay Area, California (NEW)
- **Status:** Agreed to join - setup in progress
- **Territory:** Bay Area (San Francisco, Oakland, San Jose metro areas)
- **Role:** Second broker, validates multi-broker scaling
- **Purpose:** 
  - Prove system works with multiple brokers simultaneously
  - Validate territory isolation and lead routing
  - Test Barbara AI with different broker branding
  - Confirm economics model across multiple territories

**Next Steps for Dan:**
- [ ] Create Dan Thomas broker profile in Supabase
- [ ] Assign Bay Area ZIP codes (separate from Walter's territory)
- [ ] Create PropertyRadar dynamic list for Bay Area (45,000-50,000 properties)
- [ ] Clone Instantly campaigns (3 archetypes with Dan's branding)
- [ ] Set daily_lead_capacity (start with 50/day, scale to 100/day)
- [ ] Assign SignalWire phone number (MyReverseOptions2 for West Coast)
- [ ] Test parallel operation with Walter's existing campaigns

**Expected Timeline:**
- Week 1: Territory setup and first leads pulled
- Week 2-4: Email campaigns active alongside Walter's
- Month 2: Full 100 leads/day, both brokers running simultaneously
- Month 3: Validate multi-broker economics and territory isolation

**Why Dan is Important:**
- Proves we can run multiple brokers without conflicts
- Tests territory-based lead routing
- Validates phone number pool rotation
- Confirms we can scale to 10, then 100 brokers

---

### ✅ COMPLETE (As of Oct 14, 2025)

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

**6. Nylas Calendar Integration** ⭐ PRODUCTION OCT 20-22
- **Provider:** Nylas v3 API - Production-grade calendar platform
- **Features:**
  - Real-time broker availability checking via Free/Busy API
  - Direct appointment booking during calls (Barbara books while talking!)
  - Smart slot suggestion logic (10 AM - 5 PM, 2-hour notice, same-day priority)
  - Calendar invite sent automatically to lead's email
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
  7. Sends calendar invite to lead
  8. Creates billing event in Supabase
- **Performance Tracking:** Detailed timing logs for Nylas API calls, DB operations
- **Status:** ✅ Production Ready (Fixed Oct 22)
- **Next:** OAuth flow for broker self-service (requires production Nylas account)

**7. PromptLayer Integration** ⭐ PRODUCTION OCT 21-22
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

**8. Live Call Intelligence Dashboard** ⭐ NEW OCT 21
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

**9. Barbara MCP Tools Expansion** ⭐ NEW OCT 21
- **Added to MCP Server:**
  - `check_broker_availability` - Nylas calendar availability
  - `book_appointment` - Nylas event creation
  - `update_lead_info` - Collect/verify contact details
- **Purpose:** n8n workflows can now call these tools directly
- **Architecture:** `barbara-mcp/index.js` proxies to `bridge/tools.js` API
- **Status:** ✅ Live - Available in n8n MCP tool list

**10. SwarmTrace MCP Server** ⭐ PRODUCTION OCT 21 - **REPLACED BATCHDATA**
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

**11. SignalWire Phone Number Pool** ⭐ ACTIVE OCT 17
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

**Next Steps:**
- [ ] Test Barbara end-to-end with real lead (outbound call)
- [ ] Verify calendar booking works from n8n workflow
- [ ] Test advanced commitment building flow
- [ ] Monitor PromptLayer for call quality insights
- [ ] Deploy Live Call Dashboard to portal
- [ ] Upgrade Nylas to production account (for OAuth flow)
- [ ] Create n8n workflow for email reply → Barbara call
- [ ] Create n8n workflow for microsite instant call
- [ ] Document Barbara's prompt iteration process with PromptLayer

**9. Cold Email Campaign System** (Sunday/Monday)
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
- **Status:** Database ready, workflow built, needs Instantly campaign IDs

**10. Reply Handler + TCPA Consent** (Monday/Tuesday)
- Instantly webhook for reply detection
- Consent form workflow (for phone calls only)
- Database consent recording
- **Status:** Planned

**11. Scaling Strategy (100 Brokers)**
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

### 📅 FUTURE PHASES

**8. Phone Outreach** (Week 2)
- VAPI AI voice calls (with consent)
- SignalWire phone pool management
- DNC registry integration
- Call outcome tracking

**9. Appointment Booking** (Week 2)
- Cal.com integration
- Broker calendar sync
- Appointment confirmation workflows

**10. Custom Broker Portal** (Phase 3)
- Broker onboarding interface
- Territory management (ZIP code assignment)
- Lead dashboard with real-time metrics
- Campaign analytics and performance tracking
- Built on Vercel/Next.js (custom, not third-party CRM)
- **Status:** Planned for 100-broker scale

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

