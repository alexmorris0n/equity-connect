# Equity Connect - Master Production Plan

**Last Updated:** November 14, 2025  
**Status:** ✅ Production Ready - SignalWire Agent SDK + Fly.io + SignalWire Native Contexts  
**Current Phase:** SignalWire Contexts Migration Complete + AI Helper System Active + Draft/Publish Workflow Active + CLI Test Automation

---

## 🎯 System Overview

**Barbara LLC (Wyoming)** - Registered October 30, 2025

Equity Connect is an AI-powered lead generation and nurturing platform for reverse mortgage brokers. The system uses AI agents to autonomously pull qualified property leads, enrich them with contact data, and manage compliant multi-channel outreach campaigns.

**Production Domains:**
- **barbarapro.com** - Broker recruitment landing page (B2B)
- **app.barbarapro.com** - Admin portal and broker interface
- **Vercel Development:** https://equity-connect.vercel.app

**Key Innovation:** SignalWire native contexts system provides structured, adaptive conversations with 8 conversation contexts and dynamic routing via `valid_contexts` arrays stored in database.

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
├── equity_connect/               → Fly.io Agent Worker (PRODUCTION READY)
│   ├── app.py                    → Main entrypoint (SignalWire SDK)
│   ├── agent/
│   │   └── barbara_agent.py     → SignalWire contexts integration (AgentBase)
│   ├── Dockerfile                → Fly.io deployment
│   ├── fly.toml                  → Fly.io configuration (LAX primary region)
│   ├── services/                 → Business logic
│   │   ├── supabase.py          → Database client + utilities
│   │   ├── conversation_state.py → Multi-call persistence
│   │   └── contexts_builder.py  → SignalWire contexts builder from DB
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
├── cli-testing-service/          → Fly.io CLI testing API (runs swaig-test for Vertical drafts + autosave validation)
├── propertyradar-mcp/            → Docker/Local (property lookups)
├── swarmtrace-mcp/               → Docker/Local (analytics)
├── database/                     → Shared Supabase schema
├── workflows/                    → N8N workflow definitions
├── config/                       → API configurations
└── deprecated/                   → Archived services (bridge/, barbara-v3/, elevenlabs-webhook/)
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

## 🆕 Nov 17-18 Critical Fixes: POM Conversion + Tool Availability + Nov 18 8-Node Revenue System

### 🏗️ SignalWire POM (Prompt Object Model) Architecture Conversion

**Date:** November 16-17, 2025  
**Status:** ✅ **COMPLETE - Production Ready**

**Root Problem:**
- Initial implementation attempted to use SignalWire's `%{variable}` syntax for runtime variable substitution
- Signals showed correct substitution but LLM wasn't receiving personalized prompts
- `configure_per_call` callback was never being invoked due to `on_swml_request` override conflict

**The Solution: SignalWire's Official Pattern**

**Key Discovery from SignalWire AI Agents SDK API Reference:**
> SignalWire expects prompts to be **built dynamically in Python code** with actual data substituted **before** calling `agent.prompt_add_section()`. Variable substitution happens in YOUR code, not at LLM runtime.

**Architectural Changes:**

1. **Removed `on_swml_request` Override (Critical Fix)**
   - **Problem:** Overriding `on_swml_request` prevented SDK from calling `configure_per_call`
   - **Fix:** Deleted entire `on_swml_request` method (498 lines)
   - **Result:** SDK's default implementation now properly invokes `configure_per_call` for every call/tool/reconfig

2. **Python-Side Variable Substitution**
   - **Database:** Prompts stored with `$variable` syntax (Python `string.Template`)
   - **Code:** `contexts_builder.py` performs `Template().safe_substitute()` with lead/broker data
   - **Agent:** `configure_per_call` calls `agent.prompt_add_section()` with **already-substituted text**
   - **Pattern:** Matches official SignalWire SDK examples exactly

3. **ContextBuilder API Integration**
   - **Implementation:** `_apply_contexts_via_builder()` builds contexts using SignalWire's ContextBuilder
   - **Method:** `agent.prompt_add_section("Section Title", substituted_text)`
   - **Result:** Dynamic prompt building with real data for every call phase

**Variable Substitution Flow:**
```
1. Load prompt template from DB: "Hi $first_name! I work with $broker_name..."
2. Load lead_context from DB/cache: {first_name: "Testy", broker_name: "Walter Richards"}
3. Python substitution: Template(template).safe_substitute(lead_context)
   → "Hi Testy! I work with Walter Richards..."
4. Build POM: agent.prompt_add_section("Greeting", substituted_text)
5. SignalWire receives fully-realized prompt (no variable placeholders)
```

**Critical Fixes Applied:**
- ✅ Phone extraction from nested `body_params['call']['from']` on initial request
- ✅ Phone fallback to `body_params['caller_id_num']` for mid-call reconfigurations
- ✅ Restored static configuration to `__init__` (hints, pronunciations, post-prompt)
- ✅ Dual global_data structure: nested (for tools) + flat (for prompt substitution)
- ✅ Cache restoration includes `last_name` field to prevent full-name greetings

### 🔧 Nov 18: Critical Tool Availability Bug Fix

**Date:** November 18, 2025  
**Status:** ✅ **FIXED - Tools Now Available**

**Root Cause:**
- All contexts had **empty `tools` arrays** in the database
- `flow_flags` field (LiveKit legacy) contained state management tools
- Python code (`contexts_builder.py`) only read `content->tools`, ignored `content->flow_flags`
- **Result:** LLM instructed to use tools that weren't available → calls hung up

**The Fix: Database Migration**
- **Merged `flow_flags` into `tools` arrays** for all 8 contexts
- **Removed `trg_enforce_flow_flags_separated` trigger** (was preventing updates)
- **Deleted `flow_flags` field entirely** (no longer needed)
- **Result:** All tools now available in every context (9-11 tools per context)

**Before:**
```json
{
  "tools": ["verify_caller_identity"],
  "flow_flags": ["mark_ready_to_book", "mark_has_objection", ...]
}
```
**After:**
```json
{
  "tools": ["verify_caller_identity", "mark_ready_to_book", "mark_has_objection", ...]
}
```

**Impact:**
- ✅ `get_lead_context` tool can now access cached global_data correctly
- ✅ `search_knowledge` available in ANSWER context (was causing hang-ups)
- ✅ All state management tools available when needed
- ✅ No more "tool not available" errors

### 🛠️ Tool Execution Fixes

**`get_lead_context` Tool Critical Fixes:**
1. **Global Data Access:** Changed from `self.get_global_data()` (doesn't exist) to `raw_data.get('global_data', {})`
2. **Error Handling:** Wrapped all tool logic in try/except, returns `SwaigFunctionResult` even on error
3. **Auto-Toggle:** Tool toggles itself off after first execution (success OR error) to save tokens
4. **Cache Restoration:** Properly restores nested structure for tool compatibility

**All 21 Tools:**
- ✅ Error handling added to all tools (prevents call hangups)
- ✅ Consistent `SwaigFunctionResult` usage for tool toggling
- ✅ 7 one-time-use tools auto-disable after execution
- ✅ Comprehensive tool testing suite (`scripts/test_all_tools.py`)

### 🚨 Nov 18: The `configure_per_call` Crisis - Why Dynamic Context Rebuilding is a Trap

**Date:** November 18, 2025  
**Status:** ⚠️ **CRITICAL LEARNING - ABANDONED APPROACH**

**The Promise:**
SignalWire's `configure_per_call` callback looked like the holy grail for personalization:
- Called on every incoming call
- Could rebuild contexts dynamically with caller-specific data
- Perfect for injecting lead information into prompts

**The Reality: A Nightmarish Debugging Experience**

**Problem 1: Maximum Recursion Depth Exceeded**
```python
# This simple approach caused infinite loops:
def configure_per_call(self, query_params, body_params, headers, agent):
    contexts = self._build_contexts_from_database()  # Load from DB
    agent.set_prompt(contexts)  # Apply to agent
    # Result: RuntimeError: maximum recursion depth exceeded
```

**Root Cause:** Conflicting context definitions between `__init__` and `configure_per_call` caused the SDK to enter an infinite loop trying to reconcile them.

**Problem 2: Undocumented Callback Behavior**
- `configure_per_call` called **multiple times per call** (not just once)
- Called on: initial request, after tool execution, on reconfigurations
- Phone number extraction logic different for each invocation:
  - Initial: `query_params['call']['from']`
  - Mid-call: `body_params['caller_id_num']`
- **No clear documentation** on when/why/how many times it fires

**Problem 3: Context State Pollution**
```python
# This pattern broke mid-call:
def configure_per_call(...):
    phone = extract_phone(...)  # Different extraction each time
    lead = load_lead(phone)     # DB query every time
    contexts = build_contexts(lead)  # Rebuild everything
    agent.set_prompt(contexts)  # Overwrite previous state
    
# Result: Contexts thrashed, conversation history lost
```

**Problem 4: The `on_swml_request` Conflict**
- Overriding `on_swml_request` **prevents** `configure_per_call` from firing
- SDK's default implementation triggers the callback
- No warning, no error, just silent failure
- Lost 8+ hours debugging this

**Problem 5: Variable Substitution Confusion**
SignalWire documentation shows `%{variable}` syntax, but:
- Variables **only work in SWML** (XML-like call flow language)
- Variables **DO NOT work in POM mode** (Python Prompt Object Model)
- Must do substitution in Python code **before** passing to SDK
- This is mentioned nowhere in the main docs

**The Failed Approaches (All Abandoned):**

1. **Hybrid Approach (Failed)**
   - Build contexts in `__init__` → Personalize in `configure_per_call`
   - Result: Recursion errors, context pollution

2. **Full Dynamic Rebuild (Failed)**
   - Remove all contexts from `__init__` → Build everything in `configure_per_call`
   - Result: Recursion errors, unpredictable callback timing

3. **Variable Substitution (Failed)**
   - Use `%{lead_name}` in prompts → Expect runtime substitution
   - Result: Variables passed literally to LLM, no substitution

**The Working Solution: `on_swml_request` Personalization**

```python
def __init__(self):
    # Build contexts ONCE from database (stable structure)
    contexts = self._load_context_configs_from_db()
    self.set_prompt(contexts)
    
def on_swml_request(self, query_params, body_params, headers):
    # Extract phone and load lead data
    phone = self._extract_phone_from_params(query_params, body_params)
    lead = load_lead(phone)
    
    # Inject personalization as a SECTION (not rebuilding contexts)
    caller_info = f"""
=== CALLER INFORMATION ===
Name: {lead['first_name']} {lead['last_name']}
City: {lead['property_city']}
Value: ${lead['property_value']:,}
===========================
"""
    
    self.prompt_add_section("Caller Info", caller_info)
    
    # Set global_data for tools
    self.set_global_data({
        "lead_id": lead['id'],
        "first_name": lead['first_name'],
        "property_city": lead['property_city'],
        ...
    })
    
    return None  # DON'T modify SWML
```

**Why This Works:**
- ✅ Contexts built ONCE (stable, no recursion)
- ✅ Personalization added as text section (LLM sees it)
- ✅ `on_swml_request` called ONCE per call (predictable)
- ✅ Global data available to tools
- ✅ No variable substitution needed (already substituted in Python)

**Critical Lessons:**

1. **`configure_per_call` is for EXPERTS ONLY**
   - Requires deep understanding of SDK internals
   - Easy to create infinite loops
   - Undocumented callback timing
   - Not recommended unless you're a SignalWire SDK contributor

2. **Use `on_swml_request` for Personalization**
   - Called once per call (predictable)
   - Perfect for injecting caller-specific data
   - Can modify `global_data` safely
   - Can add prompt sections without rebuilding contexts

3. **Variable Substitution Must Happen in Python**
   - Don't rely on `%{variable}` or `${variable}` syntax
   - Do `Template().safe_substitute()` in your code
   - Pass final text to `prompt_add_section()`

4. **Context Structure Should Be Static**
   - Build contexts once in `__init__` from database
   - Don't rebuild contexts per-call unless you enjoy pain
   - Personalization = adding sections, not rebuilding structure

**Time Lost:** ~12 hours of debugging recursion errors, callback timing, and variable substitution

**Documentation Quality:** 2/10 - Critical behaviors undocumented, examples misleading

**Recommendation:** Avoid `configure_per_call` unless you have SignalWire support on speed dial.

---

### 🎯 Nov 18: 8-Node Revenue System Implementation

**Date:** November 18, 2025  
**Status:** ✅ **COMPLETE - All Nodes Created**

**Business Context:**
User clarified: "We get paid per booking. Answers, objections, and booking are our money makers."

**Original 5-Node System (Insufficient):**
1. GREET - Warm welcome
2. ANSWER - Answer questions
3. BOOK - Schedule appointment
4. GOODBYE - Farewell
5. END - System node (hidden)

**Missing Critical Revenue Nodes:**
- ❌ No identity verification (security risk)
- ❌ No qualification gates (wasting time on unqualified leads)
- ❌ No quote presentation (no value proposition)
- ❌ No objection handling (losing deals to concerns)

**Complete 8-Node Revenue System:**

1. **GREET** - Warm introduction, set tone
   - Routes to: `verify`
   - Tools: `mark_wrong_person`
   - Purpose: First impression, rapport building

2. **VERIFY** ✨ NEW - Security & trust confirmation
   - Routes to: `qualify`
   - Tools: `verify_caller_identity`, `update_lead_info`
   - Purpose: Confirm identity (city + last 4 digits of phone)
   - **Why:** Makes caller feel safe, prevents mix-ups
   - Instructions: "Always verify even if we have their info"

3. **QUALIFY** ✨ NEW - Smart qualification gates
   - Routes to: `quote`, `goodbye`
   - Tools: `mark_qualification_result`, `update_lead_info`
   - Purpose: Check 4 gates (62+, homeowner, equity, owner-occupied)
   - **Why:** Don't waste time on unqualified leads
   - Instructions: "Skip if already qualified, only ask missing info, overwrite old data"

4. **QUOTE** ✨ NEW - Present equity estimate
   - Routes to: `answer`, `book`
   - Tools: `calculate` (math skill), `mark_quote_presented`
   - Purpose: Show financial value (50-60% of equity)
   - **Why:** Creates desire, shows concrete benefit
   - Instructions: "Use math skill to calculate (NO HALLUCINATION), always say 'approximately' and 'estimates'"
   - **Critical:** References SignalWire Math Skill for safe calculations

5. **ANSWER** - Educational questions with KB
   - Routes to: `goodbye`, `book`
   - Tools: `search_knowledge`, `complete_questions`
   - Purpose: Build trust through education
   - **Why:** Informed customers convert better
   - Instructions: "Check CALLER INFORMATION first for property questions, ONLY use KB for reverse mortgage rules"

6. **OBJECTIONS** ✨ NEW - Handle concerns with empathy
   - Routes to: `answer`, `book`, `goodbye`
   - Tools: `search_knowledge`, `mark_objection_handled`, `mark_has_objection`
   - Purpose: Address doubts, reframe concerns
   - **Why:** Save deals that would otherwise be lost
   - Instructions: "Listen, validate, answer with facts (FHA insurance, legal protections), never defensive"
   - **Tone:** Warm, patient, understanding

7. **BOOK** - Schedule appointment (REVENUE EVENT)
   - Routes to: `goodbye`
   - Tools: `check_broker_availability`, `book_appointment`
   - Purpose: Convert to appointment ($300-$350 per show)
   - **Why:** THIS IS HOW WE GET PAID
   - Instructions: "Check calendar, present 2-3 slots, confirm booking"

8. **GOODBYE** - Warm farewell, confirm next steps
   - Routes to: `answer`, `end`
   - Tools: `route_to_answer_for_question`
   - Purpose: Professional conclusion, last-minute questions
   - **Why:** Leave positive impression, allow final questions

**Database Implementation:**
```sql
-- Created 4 new prompts
INSERT INTO prompts (vertical, node_name, name, description, current_version)
VALUES
  ('reverse_mortgage', 'verify', 'Verify', 'Quick confirmation - city and last 4 digits of phone', 1),
  ('reverse_mortgage', 'qualify', 'Qualify', 'Smart qualification - only ask missing info, overwrite old data', 1),
  ('reverse_mortgage', 'quote', 'Quote', 'Present equity estimate using math skill - always use estimate language', 1),
  ('reverse_mortgage', 'objections', 'Objections', 'Handle concerns and objections with empathy - routes back to answer or book', 1);

-- Created prompt_versions with detailed instructions
-- All tools properly assigned
-- Routing paths defined via valid_contexts arrays
```

**Updated GREET Routing:**
```sql
-- OLD: GREET routes to ANSWER
UPDATE prompt_versions SET content = jsonb_set(content, '{valid_contexts}', '["answer"]')

-- NEW: GREET routes to VERIFY (proper flow)
UPDATE prompt_versions SET content = jsonb_set(content, '{valid_contexts}', '["verify"]')
```

**Vue Portal Already Updated:**
```javascript
// portal/src/views/admin/Verticals.vue line 755
const nodeKeys = ['greet', 'verify', 'qualify', 'quote', 'answer', 'objections', 'book', 'goodbye']
// ✅ Already had correct 8 nodes, just needed database to catch up
```

**Revenue Impact:**
- ✅ VERIFY: Builds trust and security (reduces hang-ups)
- ✅ QUALIFY: Filters out unqualified leads (saves time)
- ✅ QUOTE: Creates desire with concrete numbers (moves to action)
- ✅ ANSWER: Educates and builds trust (overcomes uncertainty)
- ✅ OBJECTIONS: Saves deals from doubts (recovers lost opportunities)
- ✅ BOOK: Converts to appointment ($$$ REVENUE $$$)

**Complete Flow:**
```
GREET (rapport) 
  → VERIFY (security) 
  → QUALIFY (gates) 
  → QUOTE (value proposition) 
  → ANSWER (education) ←→ OBJECTIONS (concerns)
  → BOOK ($$$) 
  → GOODBYE (professional close)
```

**Documentation Created:**
- `COMPLETE_8NODE_FLOW.md` - Full node descriptions, routing, tools, instructions

**Status:** ✅ All 8 nodes created, tested, production-ready

---

### 🔍 Nov 18-19: Database Routing Validator + Auto-Fix

**Date:** November 18-19, 2025  
**Status:** ✅ **COMPLETE - Production Ready**

**Problem:**
- Manual trace tests (`prompts/rewrite/trace_test.md`) are design-level only and don't validate actual database state
- CLI testing service (`swaig-test`) validates SWML structure but not database configuration
- Missing `valid_contexts` arrays or empty `tools` arrays cause calls to hang/disconnect
- Tools mentioned in instructions but not in `tools` array cause "tool not available" errors

**The Solution: Database Routing Configuration Validator**

**New Validator Script:** `scripts/validate_database_routing.py`
- Queries actual database state (not just code)
- Validates `valid_contexts` arrays are set (not null/empty)
- Validates `tools` arrays are populated with all tools mentioned in instructions
- Validates routing targets exist (no invalid context names)
- Validates tools exist and are registered in agent
- Returns structured JSON with errors and actionable fixes

**Auto-Fix Capability:**
- `auto_fix_context()` function can automatically add missing tools to database
- `auto_fix_all()` function fixes all contexts for a vertical
- Supports `--auto-fix` flag to automatically apply fixes
- Re-validates after fixing to confirm issues resolved

**CLI Testing Service Integration:**
- New `/api/validate-routing` endpoint in `cli-testing-service/server.js`
- Accepts `vertical` parameter and optional `autoFix: true`
- Returns structured response with `errors`, `fixes`, and `autoFixed` fields
- Executor (`cli-testing-service/validate-routing.js`) spawns Python validator with JSON output

**Portal Integration (Verticals.vue):**
- Validates routing BEFORE save (blocks invalid saves)
- Clear error messages showing exactly what needs to be added:
  ```
  VERIFY:
    • Instructions mention tools not in tools array: get_lead_context - ADD THESE TOOLS
      → ADD TOOLS: get_lead_context
      → ADD VALID_CONTEXTS: answer, exit
  ```
- Stores fixes for auto-fix button (future enhancement)
- `autoFixRoutingIssues()` function ready for manual trigger

**Usage:**
```bash
# Manual validation
python scripts/validate_database_routing.py reverse_mortgage

# With auto-fix
python scripts/validate_database_routing.py reverse_mortgage --auto-fix --json

# Via API
POST /api/validate-routing
{
  "vertical": "reverse_mortgage",
  "autoFix": true
}
```

**What It Catches (That Other Tests Miss):**
- ❌ `valid_contexts` is `null` → Causes call disconnections
- ❌ `valid_contexts` is empty → Can't route anywhere
- ❌ `tools` array is empty → LLM has no tools available
- ❌ Instructions mention `search_knowledge` but tool not in array → Tool not available
- ❌ `valid_contexts` contains `invalid_node` → Routing failure
- ❌ Tools array contains `invalid_tool` → Tool execution failure

**Impact:**
- ✅ Prevents configuration bugs from reaching production
- ✅ Clear error messages show exactly what to add/remove
- ✅ Auto-fix capability reduces manual work
- ✅ Integrated into save flow (blocks invalid saves)
- ✅ Catches issues that `swaig-test` and trace tests miss

### 🔍 Jan 19, 2025: Comprehensive Trace Analysis + All 13 Fixes Applied

**Date:** January 19, 2025  
**Status:** ✅ **COMPLETE - All Fixes Applied and Verified**

**Problem:**
- Manual trace tests (`prompts/rewrite/trace_test.md`) identified 13 scenarios with routing mismatches and instruction gaps
- Database configuration didn't match scenario expectations
- Missing explicit instructions for edge cases and flag-setting
- Routing logic gaps causing call disconnections

**The Solution: Comprehensive Trace-Driven Fixes**

**Analysis Process:**
1. Analyzed all 13 scenarios in `trace_test.md` against actual database configurations
2. Identified explicit mismatches (no inferences, only documented gaps)
3. Created actionable fix list with SQL migrations and instruction updates
4. Applied fixes in priority order (CRITICAL → HIGH → MEDIUM → LOW)
5. Verified all fixes via comprehensive Python tests

**13 Fixes Applied:**

**CRITICAL (2 fixes):**
- ✅ FIX #1: GREET valid_contexts missing "qualify" → Added routing capability
- ✅ FIX #2: OBJECTIONS cannot return to QUALIFY → Added bidirectional routing

**HIGH PRIORITY (4 fixes):**
- ✅ FIX #3: Missing explicit flag-setting instructions → Added to GREET and VERIFY
- ✅ FIX #4: QUALIFY missing "all 4 gates at once" handling → Added edge case instructions
- ✅ FIX #5: QUOTE missing math skill reference → Added explicit calculation instructions
- ✅ FIX #6: BOOK missing error handling for check_broker_availability → Added timeout/error handling

**MEDIUM PRIORITY (5 fixes):**
- ✅ FIX #7: EXIT missing "Send FAQ and Follow Up" scenario → Added FAQ follow-up instructions
- ✅ FIX #8: QUALIFY missing "Interrupted at Gate Question" tracking → Added interruption state tracking
- ✅ FIX #9: QUALIFY missing "Pending Birthday" flag → Added pending_birthday flag instructions
- ✅ FIX #10: QUOTE missing late disqualification handling → Added disqualification detection
- ✅ FIX #11: EXIT missing reschedule intent detection → Added keyword detection logic

**LOW PRIORITY (2 fixes):**
- ✅ FIX #12: BOOK missing duration parameter instructions → Added duration handling (notes code limitation)
- ✅ FIX #13: Multiple contexts missing explicit question handling → Added universal question handling to 6 nodes

**Verification:**
- ✅ Created comprehensive Python test suite (`scripts/test_all_fixes_comprehensive.py`)
- ✅ All 13 fixes verified via database queries and code path checks
- ✅ All routing fixes verified via `build_contexts_object()` tests
- ✅ All instruction updates verified via database content checks

**Documentation:**
- ✅ `TRACE_ANALYSIS_RAW_DATA.md` - Raw analysis of all 13 scenarios
- ✅ `TRACE_ANALYSIS_ACTIONABLE_FIXES.md` - Prioritized fix list with SQL/instructions
- ✅ All fixes marked as ✅ APPLIED in documentation

**Impact:**
- ✅ All routing mismatches resolved (GREET → QUALIFY, OBJECTIONS → QUALIFY)
- ✅ All instruction gaps filled (flag-setting, error handling, edge cases)
- ✅ All edge cases handled (interruptions, pending birthdays, late disqualifications)
- ✅ Universal question handling added to all relevant nodes
- ✅ Production-ready for real-world call scenarios

## 🆕 Nov 14 Evening Updates

- **CLI Testing Service Stabilized:** Extracted the `test-cli` workflow into its own Fastify app (`cli-testing-service/`) with Fly.io deployment, dedicated Dockerfile, and CORS lockdown. Added structured logging so portal-triggered tests are visible immediately.
- **Save → Test Automation:** CLI validation now fires as part of the save toast workflow (manual trigger under the hood today); wiring the Vertical editor's save/publish action to fire automatically is the remaining step before activation can be blocked on failure.
- **Context Guardrails (Hard Fail):** `contexts_builder.py` now validates every context has at least one active step and raises an error (blocking saves/tests) if anything is missing, preventing "Context must have at least one step" runtime errors.
- **Barbara Runtime Hardening:** Replaced deprecated `set_meta_data` with `set_global_data`, added `_ensure_skill` to avoid duplicate skill loading (datetime), and made phone normalization + conversation-state lookups resilient to `None` values.
- **Regression Test Run:** Successfully executed the CLI test suite for all 8 BarbGraph nodes plus the theme at version `14ab0a70-5ff4-4142-9313-f89a5ce51ce7`, confirming each context produces a valid SWAIG payload.

### 🎙️ Nov 17 Voice UX Improvements

- **`skip_user_turn` Implementation:** Added support for SignalWire's `skip_user_turn` step-level setting to eliminate awkward silences at call start.
  - **GREET Context:** `skip_user_turn: true` + `step_criteria: "none"` → Barbara speaks IMMEDIATELY on call connect (zero delay)
  - **QUOTE & EXIT Contexts:** `skip_user_turn: true` → Present quote/farewell without pause (smooth transitions)
  - **All Other Contexts:** `skip_user_turn: false` → Wait for user input (questions require responses)
  - **Implementation:** `contexts_builder.py` reads `skip_user_turn` from Supabase `prompt_versions.content` JSONB and applies to step objects
- **3-Layer Voice UX Stack Complete:**
  1. **Agent-Level:** `wait_for_user=False` (Barbara speaks when call connects)
  2. **Prompt Structure:** Front-loaded greeting text (what to say first)
  3. **Step-Level:** `skip_user_turn` per context (granular execution control)
- **Production Ready:** All 8 contexts configured with appropriate `skip_user_turn` settings for optimal conversation flow

### 🔄 Nov 15 Prompt/Theme Reset

- **Full Supabase Reset:** Deleted every `prompt_versions` row (and parent `prompts`) for `vertical='reverse_mortgage'`, plus the existing `theme_prompts` entry and dependent `vertical_snapshots`. This guarantees no legacy prompt content remains.
- **New Baseline (v1):** Reinserted all eight node prompts (`greet`, `verify`, `qualify`, `quote`, `answer`, `objections`, `book`, `exit`) directly from `prompts/rewrite/*.md`. Each prompt now has `current_version=1` and a single active version that mirrors the rewrite files verbatim.
- **Theme Reloaded:** Loaded `prompts/rewrite/theme_review.md` into `theme_prompts` as record `4d56083c-da10-45c3-8444-b0ceda41dba9` (`is_active=true`, `version=1`, ~5.5k chars). This is the only theme entry for the vertical.
- **Clean Slate for Testing:** With no historical versions present, the next regression cycle should treat this as v1 of the SignalWire-native prompt stack before publishing snapshots or activating additional versions.

### Context Flow + CLI Validation (Nov 14, 2025)

1. **Portal Save → Supabase:** Vertical editor saves write the latest theme + node JSON (role, instructions, tools, `valid_contexts`, `step_criteria`) into Supabase (`theme_prompts`, `prompts`, `prompt_versions`). The eight-stage BarbGraph structure, theme-first persona, and database-driven routing are preserved through version IDs.
2. **Guardrails During Context Build:** When Barbara boots per call, `contexts_builder.build_contexts_object()` loads the saved version and validates every context has at least one step; if a node is missing, it raises immediately so saves/tests fail fast instead of silently backfilling.
3. **SignalWire Runtime:** `barbara_agent.py` loads the theme into the Prompt Object Model, attaches the guardrailed contexts block, and hands routing off to SignalWire’s native context system. `valid_contexts` arrays in Supabase dictate which node unlocks next, while SWAIG tools continue to set conversation-state flags in the database.
4. **CLI Testing Service:** The Fly.io `cli-testing-service` receives portal (or manual) POSTs that include `versionId`, `vertical`, `nodeName`, and overrides. It shells out to `swaig-test /app/equity_connect/test_barbara.py` with those params, exercising the same loader/guardrails the runtime uses. Successful runs (exit code `0`) confirm the SWML payload is valid—see Fly logs at `2025-11-14T19:28:26Z` for the `greet` node example.
5. **Automation Status:** Manual trigger exists today (save toast + curl). Next step is wiring the Vertical editor’s save/publish action to automatically call the tester and block activation when validation fails.

### 🎧 Browser Test Calls (Nov 15, 2025)

- **Portal-Only Experience:** The new `TestCallModal.vue` (Models tab + node cards) opens a WebRTC session directly in the browser—no PSTN leg, no phone number input. Mic + speakers stay local, mirroring Holy Guacamole’s UX.
- **Guest Tokens Only:** `barbara-mcp/index.js` now exposes a single `/api/test-call/token` endpoint that scopes guest tokens to `SIGNALWIRE_ALLOWED_ADDRESSES` for 60 minutes. All legacy `/start` outbound-call code has been removed.
- **SignalWire Client:** The portal imports `@signalwire/js`, fetches a guest token, and dials the Barbara agent route (`/agent`) with `audio: true, video: false`. Remote audio attaches to a hidden `rootElement` while the UI renders `BarbaraAvatar.vue` (idle vs talking MP4 swap).
- **Test Metadata:** User metadata is passed via `userVariables` exactly like Holy Guacamole (`test_mode`, `use_draft`, `start_node`, `stop_on_route`, `vertical`). `barbara_agent.py` reads them inside `on_swml_request`, forces draft prompts, and seeds context tracking with the requested node.
- **Node Path Events:** During test mode the agent now emits `node_transition` and `test_complete` user events (piggybacked on SWAIG responses). The modal subscribes to `roomSession.on('user_event', ...)`, updates the live node path, and animates the avatar to “talking” whenever Barbara routes.
- **Two Modes:** “⚡ Test This Node” (per-node button) sets `mode=single`, `stop_on_route=true` and auto-stops at the first route change. “🎯 Test Full Vertical” lives in both the Models & Voice tab and the Nodes header, starting at GREET and running the full 8-node flow.
- **Assets:** `portal/public/barbara_idle.mp4` + `portal/public/barbara_talking.mp4` power the avatar swap. Swapping the MP4s swaps the animation—documented under `portal/src/components/BarbaraAvatar.vue`.

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

## 🎙️ SignalWire Agent SDK Migration ⭐ **COMPLETE (NOV 13, 2025)**

**Status:** ✅ **MIGRATION COMPLETE - SignalWire Native Contexts System Active**

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

**✅ Phase 4: Fly.io Deployment (COMPLETE)**
- ✅ Created Dockerfile with correct Python module structure
- ✅ Configured fly.toml (LAX primary region, 2 CPUs, 1GB RAM)
- ✅ Set up GitHub Actions deployment workflow
- ✅ Deployed to Fly.io (`barbara-agent.fly.dev`)

**✅ Phase 5: BarbGraph → SignalWire Contexts Migration (COMPLETE - NOV 13, 2025)**
- ✅ Replaced custom Python routing with SignalWire native contexts
- ✅ Deleted `routers.py`, `node_completion.py`, `prompt_loader.py` (~732 lines)
- ✅ Created `contexts_builder.py` service (~233 lines)
- ✅ Added `contexts_config` table for context-level settings
- ✅ Added `step_name`, `step_order` columns to `prompts` table
- ✅ Added `valid_contexts` arrays to all 8 node prompts (routing logic in DB)
- ✅ Added `step_criteria` to prompt_versions for completion detection
- ✅ Updated all 8 prompts with `{variable}` syntax for SignalWire substitution
- ✅ Implemented `_get_lead_context()` and `_get_initial_context()` helpers
- ✅ Enabled POM mode (`use_pom=True`) for native context routing
- ✅ Net result: -838 lines of code (deletion-heavy refactor)

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

**✅ SignalWire Contexts Routing - NATIVE**
- ✅ Routing logic moved to database (`valid_contexts` arrays in prompt_versions)
- ✅ SignalWire handles context transitions automatically
- ✅ No manual routing code needed (deleted ~500 lines)
- ✅ Dynamic routing based on `valid_contexts` arrays and step criteria

**✅ Prompt System - UNCHANGED**
- ✅ Theme prompts from `theme_prompts` table
- ✅ Node prompts from `prompt_versions` table
- ✅ Context injection logic (call_type, lead_context, phone_number)
- ✅ Prompt combination order: Theme → Context → Node

### Critical Bug Fixes (16 Total)

**Migration Bugs:**
1. ✅ Theme duplication in `_load_initial_prompt()` - **FIXED**
2. ✅ Theme duplication in `_route_to_node()` - **FIXED**
3. ✅ Theme duplication in `build_instructions_for_node()` - **FIXED**
4. ✅ Dockerfile CMD path incorrect - **FIXED**

**Contexts Migration Bugs:**
5. ✅ Voice format bug - Changed `"rachel"` → `"elevenlabs.rachel"` - **FIXED**
6. ✅ SQL idempotency - Added `NOT LIKE '%{lead.%'` checks - **FIXED**
7. ✅ `first_name` extraction - Added to `_get_lead_context()` returns - **FIXED**
8. ✅ `is_active` filter on wrong table - Removed from prompts query - **FIXED**
9. ✅ Email key mismatch - Changed `"primary_email"` → `"email"` - **FIXED**
10. ✅ `valid_contexts` missing from context object - Added to `_build_context()` - **FIXED**

**Portal Bugs:**
11. ✅ VoiceConfig reactivity - Fixed 3 functions (onEngineChange, selectVoice, resetToDefault) - **FIXED**
12. ✅ Portal save bug - Fixed content merge to preserve migration fields - **FIXED**
13. ✅ VoiceConfig hardcoded provider - Fixed initialization to preserve user selection - **FIXED**
14. ✅ AI Helper diff comparison - Fixed `value.match is not a function` by ensuring string conversion - **FIXED**

**Draft/Publish Workflow Bugs:**
15. ✅ Documentation mismatch in `get_current_draft_version()` - Fixed to return NULL (not 0) - **FIXED**
16. ✅ Cross-vertical data corruption in `publish_draft_version()` - Added vertical constraint to prevent affecting other verticals - **FIXED**

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
- `equity_connect/agent/barbara_agent.py` - Major refactor (deleted ~514 lines, added ~180 lines)
  - Removed all routing methods (replaced by SignalWire contexts)
  - Added `_get_lead_context()` and `_get_initial_context()` helpers
  - Updated `configure_per_call()` and `on_swml_request()` to use contexts
  - Enabled POM mode (`use_pom=True`)
- All tool files (unchanged - still use `@AgentBase.tool` decorators)

**Deleted Files:**
- `equity_connect/workflows/routers.py` - 254 lines (replaced by `valid_contexts` arrays)
- `equity_connect/workflows/node_completion.py` - 150 lines (replaced by `step_criteria`)
- `equity_connect/services/prompt_loader.py` - 328 lines (replaced by `contexts_builder.py`)

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

**Status:** ✅ **SIGNALWIRE CONTEXTS MIGRATION COMPLETE (November 13, 2025)**

### ✅ Phase 6: Draft/Publish Workflow (COMPLETE - NOV 14, 2025)
- ✅ Added `is_draft` columns to `prompt_versions` and `theme_prompts`
- ✅ Created `get_current_draft_version()` helper function
- ✅ Created `publish_draft_version()` function for publishing drafts
- ✅ Created `activate_version()` function for rollback capability
- ✅ Created `discard_draft_changes()` function to delete drafts
- ✅ Two-stage save workflow: Save edits → Publish vertical
- ✅ Draft versions stay inactive until explicitly published
- ✅ Activation control for rollback to previous versions

### ✅ Phase 7: Voice Configuration System (COMPLETE - NOV 13, 2025)
- ✅ Created `agent_voice_config` table for TTS provider configuration
- ✅ Implemented `_get_voice_config()` and `_build_voice_string()` helpers
- ✅ Created `VoiceConfig.vue` component for admin portal
- ✅ Support for 7 TTS providers: ElevenLabs, OpenAI, Google Cloud, Amazon Polly, Azure, Cartesia, Rime
- ✅ Language-specific configuration (en-US, es-US, es-MX)
- ✅ Default configs: ElevenLabs Rachel (en-US), Domi (es-US, es-MX)

**Note:** Voice pricing system was completed separately on Nov 12, 2025 for BarbaraConfig.vue. Voice configuration system (Phase 6) is the production implementation for agent runtime.

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

## 🎯 SignalWire Native Contexts System ⭐ **PRODUCTION READY (NOV 13, 2025)**

**Status:** ✅ **MIGRATION COMPLETE - BarbGraph Replaced with SignalWire Native Contexts + AI Helper System Active**

**Previous System:** BarbGraph event-based state machine (deprecated November 13, 2025)

### Overview

SignalWire native contexts system provides structured, adaptive dialogue management with 8 conversation contexts and dynamic routing via `valid_contexts` arrays stored in the database. This replaces the previous BarbGraph custom routing system.

**Why SignalWire Contexts?**
- Framework-native routing (no custom code needed)
- Automatic context transitions based on `valid_contexts` arrays
- Step-based completion detection via `step_criteria`
- Database-driven routing logic (easy to update without code changes)
- Variable substitution via `set_meta_data()` (SignalWire handles it)
- POM mode enabled for native context management

### Architecture: 3-Layer System

```
┌─────────────────────────────────────────────────────────────┐
│                     LAYER 1: FRONTEND                        │
│  Vue Portal - Context-Based Prompt Editor (Verticals.vue)   │
│  • Vertical selector (reverse_mortgage, solar, hvac)        │
│  • 8-context node cards (greet, verify, qualify, quote,     │
│    answer, objections, book, exit)                          │
│  • JSONB content editor (instructions, tools, valid_contexts)│
│  • AI Helper (✨) for theme and node generation            │
│  • Variable insertion (⚡) for {lead.first_name} syntax    │
│  • Vertical-level versioning with snapshots                 │
└─────────────────────────────────────────────────────────────┘
                              ▼ saves to
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 2: DATABASE                         │
│  Supabase PostgreSQL                                         │
│  • theme_prompts table (universal personality per vertical) │
│  • prompts table (vertical, node_name, step_name, step_order)│
│  • prompt_versions table (content JSONB with valid_contexts)│
│  • contexts_config table (isolated, enter_fillers, exit_fillers)│
│  • conversation_state table (conversation_data JSONB)        │
│  • vertical_snapshots table (version metadata)               │
│  • agent_voice_config table (TTS provider settings)        │
└─────────────────────────────────────────────────────────────┘
                              ▼ loads from
┌─────────────────────────────────────────────────────────────┐
│                     LAYER 3: BACKEND                         │
│  SignalWire Agent Worker (Fly.io)                            │
│  • BarbaraAgent class (SignalWire AgentBase)                │
│  • contexts_builder.py (builds contexts from DB)             │
│  • set_meta_data() for variable substitution                │
│  • set_prompt() with contexts object                        │
│  • SignalWire handles routing via valid_contexts arrays     │
│  • Step completion via step_criteria                        │
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

**Key Principle:** Routing is defined by `valid_contexts` arrays in the database. SignalWire automatically handles transitions based on these arrays and step criteria.

**Routing Logic (in Database):**
- **GREET** → `["verify", "exit"]`
- **VERIFY** → `["qualify", "exit"]`
- **QUALIFY** → `["quote", "exit"]`
- **QUOTE** → `["answer", "book", "exit"]`
- **ANSWER** → `["objections", "book", "exit"]`
- **OBJECTIONS** → `["answer", "book", "exit"]`
- **BOOK** → `["exit"]`
- **EXIT** → `["greet"]` (for wrong person re-greet)

**Step Criteria:** Each step has `step_criteria` (default: "User has responded appropriately.") that determines when to advance.

**Variable Substitution:** Variables like `{lead.first_name}` are set via `set_meta_data()` and automatically substituted by SignalWire.

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

**Status:** ✅ **PRODUCTION READY - SignalWire Contexts System Active (November 13, 2025)**

### Implementation Complete

**SignalWire Contexts Migration (November 13, 2025)** - ✅ **COMPLETE**
- ✅ Replaced custom Python routing with SignalWire native contexts
- ✅ Created `contexts_builder.py` service to build contexts from database
- ✅ Added `contexts_config` table for context-level settings
- ✅ Added `step_name` and `step_order` columns to `prompts` table
- ✅ Added `valid_contexts` arrays to all 8 node prompts (routing in DB)
- ✅ Added `step_criteria` to prompt_versions for completion detection
- ✅ Updated all 8 prompts with `{variable}` syntax for SignalWire substitution
- ✅ Implemented `_get_lead_context()` and `_get_initial_context()` helpers
- ✅ Enabled POM mode (`use_pom=True`) for native context routing
- ✅ Deleted `routers.py`, `node_completion.py`, `prompt_loader.py` (~732 lines)
- ✅ Net result: -838 lines of code (deletion-heavy refactor)

**Database Schema Migrations (Supabase)** - ✅ **COMPLETE**
- ✅ Created `theme_prompts` table for universal personality
- ✅ Created `contexts_config` table for context-level settings
- ✅ Created `vertical_snapshots` table for version metadata
- ✅ Created `agent_voice_config` table for TTS provider configuration
- ✅ Added `vertical`, `step_name`, `step_order` columns to `prompts` table
- ✅ Added `valid_contexts` and `step_criteria` to `prompt_versions.content` JSONB
- ✅ Added `vertical_versions` JSONB array to `prompt_versions` and `theme_prompts`
- ✅ Updated RLS policies and indexes
- ✅ Seeded reverse_mortgage theme (695 chars)
- ✅ Updated all 8 node prompts with `{variable}` syntax

**Vue Portal UI (Verticals.vue)** - ✅ **COMPLETE**
- ✅ Vertical-level versioning system with snapshots
- ✅ 8-context node cards with expand/collapse
- ✅ AI Helper system (✨) for theme and node generation
- ✅ Variable insertion button (⚡) for `{variable}` syntax
- ✅ Multi-select tools dropdown with search
- ✅ Database-driven model selection (STT, LLM, TTS)
- ✅ Real-time preview (Theme + Context + Node)
- ✅ Node tooltips with descriptions
- ✅ Responsive layout (desktop/mobile)

### Key Features

✅ **Context-Aware Tool Toggling** - Tools disable themselves after use to save tokens  
✅ **Metadata Caching** - Lead data cached in `self.metadata` to eliminate redundant DB lookups  
✅ **Variable Substitution** - `$lead.first_name`, `$property.city` automatically substituted by contexts_builder  
✅ **Step-Based Completion** - `step_criteria` determines when to advance to next step  
✅ **Dynamic Routing** - All 8 contexts always available, `valid_contexts` arrays control transitions  
✅ **Conversation History Preserved** - Full context maintained across all context transitions  
✅ **Re-Greeting Logic** - Handles spouse handoff scenarios (EXIT → GREET transition)  
✅ **QUOTE Context** - Presents financial estimates before Q&A phase  
✅ **AI Helper System** - GPT-4o-mini powered prompt generation for theme and nodes  
✅ **Vertical-Level Versioning** - Single version number per vertical with snapshot rollback  
✅ **Context Guardrails** - `contexts_builder` enforces that every context has steps and blocks activation if any node is empty  
✅ **CLI Regression Suite** - Dedicated `cli-testing-service` runs `swaig-test` for every node save to catch prompt/tool regressions pre-activation  
✅ **`skip_user_turn` Support** - Step-level execution control for immediate greetings (GREET, QUOTE, EXIT) vs. waiting for input (all others)  

### Files Modified

**Backend:**
- `equity_connect/agent/barbara_agent.py` - SignalWire contexts integration (deleted ~514 lines, added ~180 lines)
- `equity_connect/services/contexts_builder.py` - NEW: Builds SignalWire contexts from database (~233 lines)
- `equity_connect/tools/*.py` - All 21 tools unchanged (still use `@AgentBase.tool` decorators)

**Frontend:**
- `portal/src/views/admin/Verticals.vue` - Complete rewrite with contexts system, AI Helper, vertical versioning
- `portal/src/components/VoiceConfig.vue` - NEW: TTS provider configuration component

**Database:**
- `theme_prompts` table - Universal personality per vertical
- `prompts` table - Added `step_name`, `step_order` columns
- `prompt_versions` table - Added `valid_contexts`, `step_criteria` to content JSONB, added `vertical_versions` JSONB array
- `conversation_state` table - Routing flags in conversation_data JSONB (unchanged)
- `contexts_config` table - NEW: Context-level settings (isolated, enter_fillers, exit_fillers)
- `vertical_snapshots` table - NEW: Version metadata for entire vertical snapshots
- `agent_voice_config` table - NEW: TTS provider configuration per vertical/language

**Documentation:**
- `BARBGRAPH_COMPREHENSIVE_GUIDE.md` - Complete system guide
- `BARBGRAPH_CURRENT_PROMPTS.md` - All 8 node prompts documented
- `BARBGRAPH_SYSTEM_VERIFICATION.md` - System verification results
- `THEME_AND_QUOTE_IMPLEMENTATION_COMPLETE.md` - Implementation summary

**Status:** ✅ **PRODUCTION READY - SignalWire Contexts Migration Complete, AI Helper System Active (November 13, 2025)**

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
  - `vertical_snapshots` table tracks version metadata
  - `vertical_versions` JSONB array tags content to versions (no duplication)
  - All-or-nothing drafting for entire vertical
  - Full snapshot rollback capability
- ✅ **Global Settings Tabs** - Theme, Models & Voice, Telephony, Safety
- ✅ **Dynamic Model Selection** - STT, LLM, and TTS models loaded from database
- ✅ **Database-Driven Voice Catalog** - 400+ voices from `signalwire_available_voices` table
- ✅ **STT Model Catalog** - Models from `signalwire_available_stt_models` table (English/Spanish)
- ✅ **LLM Model Catalog** - OpenAI models from `signalwire_available_llm_models` table
- ✅ **Multi-Select Tools Dropdown** - Searchable tool selector with baseline flow flags filtered
- ✅ **Variable Insertion Button** - ⚡ button next to Instructions field for `{variable}` insertion
- ✅ **AI Helper System** - ✨ AI-powered prompt generation for theme and nodes
  - Theme generator with 7-question form
  - Node generator with scenario selection and quick-fill templates
  - GPT-4o-mini integration via OpenAI API
  - Redline diff preview before accepting
  - Auto-suggests 2-5 relevant tools based on goal/scenarios
  - Smart variable insertion with `{lead.first_name}` format
  - Suggests 2-3 additional edge case scenarios
- ✅ **Responsive Layout** - Desktop (horizontal node cards), mobile (vertical stack)
- ✅ **Version History Bar** - Left sidebar (desktop) or top bar (mobile)
- ✅ **Real-Time Preview** - Combined prompt preview (Theme + Context + Node)
- ✅ **Node Tooltips** - Red asterisk (*) indicators with descriptions for each node

**Database Tables:**
- `signalwire_available_voices` - TTS voice catalog (7 providers, 400+ voices, English/Spanish)
- `signalwire_available_stt_models` - STT model catalog (5 providers, English/Spanish models)
- `signalwire_available_llm_models` - LLM model catalog (OpenAI only - SignalWire default)
- `theme_prompts` - Global vertical configuration (theme content + config JSONB)
- `vertical_snapshots` - Version metadata for entire vertical snapshots
- `contexts_config` - Context-level settings (isolated, enter_fillers, exit_fillers)
- `agent_voice_config` - TTS provider configuration per vertical/language

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

1. **Auto-Test on Save**
   - [x] Deploy dedicated `cli-testing-service` on Fly.io (Fastify + swaig-test wrapper)
   - [x] Run manual regression suite for all 8 nodes + theme (version `14ab0a70-5ff4-4142-9313-f89a5ce51ce7`)
   - [ ] Trigger CLI validation automatically on every Vertical save/publish action
   - [ ] Block activation + surface stdout/stderr when a node payload fails validation

2. **Regression Suite After v1 Reset**
   - [ ] Run `prompts/rewrite/trace_test.md` (13 baseline scenarios) against the fresh Supabase prompt set
   - [ ] Add the 7 edge-case traces to `trace_results.md` for the new baseline
   - [ ] Snapshot the passing version ID in `vertical_snapshots` once tests succeed

3. **SignalWire Context Guardrails**
   - [x] Filter zero-step contexts and log each skip
   - [x] Backfill missing nodes with default v1 instructions (`services/default_contexts.py`)
   - [x] Add phone + conversation-state fallbacks to prevent `NoneType` errors
   - [ ] Instrument Supabase to track which contexts required fallback content

4. **Monitor Production Metrics**
   - [ ] Monitor AI provider costs and latency via LiveKit dashboard
   - [ ] Track node completion rates (% who reach each stage)
   - [ ] Monitor conversation quality (transcript analysis)
   - [ ] A/B test different provider combinations (DeepSeek vs Claude, Cartesia vs ElevenLabs)

5. **Portal Enhancements**
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

### SignalWire Contexts System
- [x] 8 contexts implemented (greet, verify, qualify, quote, answer, objections, book, exit)
- [x] Theme prompt system active
- [x] 21 tools verified and exported
- [x] Native contexts routing (valid_contexts arrays in DB)
- [x] Database schema complete (contexts_config, vertical_snapshots, agent_voice_config)
- [x] Vue Portal UI complete (Verticals.vue with AI Helper)
- [x] Vertical-level versioning system active
- [x] AI Helper system for prompt generation
- [x] Context guardrails to block empty contexts (fail-fast enforcement)
- [x] 13 critical bugs fixed

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
- [x] CLI regression suite (8 nodes + theme) passes before activation

**Status:** ✅ **PRODUCTION READY - SignalWire Contexts System Active, AI Helper System Operational (November 13, 2025)**

---

**This is your single source of truth for the production system.** 🎯
