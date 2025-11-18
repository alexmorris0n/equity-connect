# BarbGraph: Event-Based Conversation Routing System

**Version:** 2.0  
**Last Updated:** November 18, 2025  
**Status:** ⚠️ **DEPRECATED - Replaced by SignalWire Native Contexts System**

> **⚠️ IMPORTANT:** BarbGraph was replaced by SignalWire's native contexts system on November 13, 2025. This document is preserved for historical reference. For current implementation details, see:
> - **`MASTER_PRODUCTION_PLAN.md`** - Current system architecture (SignalWire Contexts)
> - **SignalWire Contexts System** - Uses `valid_contexts` arrays in database instead of custom Python routing
> - **`equity_connect/services/contexts_builder.py`** - Current implementation
> 
> **Key Changes:**
> - Custom Python routing (`routers.py`, `node_completion.py`) → SignalWire native contexts
> - Event-based state machine → Database-driven `valid_contexts` arrays
> - Manual routing code (~500 lines) → Framework-native routing
> - Same 8-node structure, but implemented via SignalWire's POM mode
>
> **Nov 16-18, 2025 Critical POM Conversion & Tool Fixes:**
> 
> **🏗️ SignalWire POM Architecture:**
> - **Removed `on_swml_request` Override:** Overriding prevented SDK from calling `configure_per_call`. Deleted entire method (498 lines) to enable SDK's default implementation.
> - **Python-Side Variable Substitution:** Prompts stored with `$variable` syntax (Python `string.Template`), substituted in `contexts_builder.py` before calling `agent.prompt_add_section()`.
> - **Official Pattern:** Matches SignalWire SDK examples - substitution happens in YOUR code, not at LLM runtime.
> - **ContextBuilder API:** Uses `agent.prompt_add_section("Section Title", substituted_text)` for dynamic prompt building.
> 
> **🔧 Critical Bug Fixes (Nov 17-18):**
> - **Phone Extraction:** Fixed nested `body_params['call']['from']` extraction on initial request, added fallback to `caller_id_num` for mid-call reconfigs.
> - **Static Configuration:** Restored hints, pronunciations, post-prompt to `__init__` (lost when deleting `on_swml_request`).
> - **Global Data Structure:** Dual structure - nested (for tools) + flat (for prompt substitution).
> - **Cache Restoration:** Added `last_name` to prevent full-name greetings.
> - **Tool Availability:** Merged `flow_flags` into `tools` arrays, removed `trg_enforce_flow_flags_separated` trigger (was preventing updates).
> - **Tool Execution:** Fixed `get_lead_context` to access `global_data` via `raw_data` parameter, added error handling to all 21 tools.
>
> **Nov 14, 2025 Validation Enhancements:**
> - `contexts_builder.py` now guards against zero-step contexts, logs every skip, and auto-applies default V1 prompts from `services/default_contexts.py`.
> - `barbara_agent.py` uses `set_global_data`, `_ensure_skill`, and safer phone normalization to eliminate runtime regressions surfaced by CLI tests.
> - The new `cli-testing-service/` runs `swaig-test` for every node save so invalid context payloads are caught before activation.
>
> **Nov 17, 2025 Voice UX Improvements:**
> - **`skip_user_turn` Support:** Step-level execution control added to eliminate awkward silences
> - **GREET Context:** `skip_user_turn: true` + `step_criteria: "none"` → Barbara speaks IMMEDIATELY on call connect
> - **QUOTE & EXIT:** `skip_user_turn: true` → Smooth transitions without pauses
> - **All Others:** `skip_user_turn: false` → Wait for user input (questions require responses)
> - **3-Layer Stack Complete:** Agent-level (`wait_for_user=False`) + Prompt structure (front-loaded greeting) + Step-level (`skip_user_turn`)
> - **Tool Auto-Toggle:** 7 tools (get_lead_context, verify_caller_identity, find_broker_by_territory, book_appointment, assign_tracking_number, mark_qualification_result, mark_quote_presented) disable themselves after execution using `SwaigFunctionResult` to save LLM tokens
>
> **🚨 Nov 18, 2025 - The `configure_per_call` Crisis:**
> 
> **CRITICAL WARNING: Dynamic Context Rebuilding is a Trap**
> 
> SignalWire's `configure_per_call` callback appears to offer per-call personalization, but in practice:
> 
> **Fatal Problems Encountered:**
> 1. **Maximum Recursion Depth:** Conflicting context definitions between `__init__` and `configure_per_call` cause infinite loops
> 2. **Undocumented Callback Timing:** Called multiple times per call (initial, after tools, reconfigs) with NO documentation on when/why
> 3. **Phone Extraction Chaos:** Different extraction logic needed for each invocation (query_params vs body_params)
> 4. **`on_swml_request` Conflict:** Overriding it SILENTLY prevents `configure_per_call` from firing (no warning, 8+ hours lost)
> 5. **Variable Substitution Lies:** `%{variable}` syntax only works in SWML mode, NOT in POM mode (undocumented)
> 6. **Context State Pollution:** Rebuilding contexts mid-call thrashes state and loses conversation history
> 
> **Time Lost:** ~12 hours debugging recursion, callbacks, and variables
> 
> **Documentation Quality:** 2/10 - Critical behaviors undocumented, examples misleading
> 
> **The ONLY Working Pattern:**
> ```python
> def __init__(self):
>     # Build contexts ONCE from database (stable structure)
>     contexts = self._load_context_configs_from_db()
>     self.set_prompt(contexts)
>     
> def on_swml_request(self, query_params, body_params, headers):
>     # Extract phone and load lead data ONCE per call
>     phone = self._extract_phone_from_params(query_params, body_params)
>     lead = load_lead(phone)
>     
>     # Inject as SECTION (not rebuilding contexts)
>     caller_info = f"=== CALLER INFO ===\nName: {lead['first_name']}\n..."
>     self.prompt_add_section("Caller Info", caller_info)
>     self.set_global_data({"lead_id": lead['id'], ...})
>     
>     return None  # DON'T modify SWML
> ```
> 
> **Lessons:**
> - ✅ `on_swml_request` called ONCE per call (predictable)
> - ✅ Contexts built ONCE in `__init__` (stable, no recursion)
> - ✅ Personalization via sections (LLM sees it, tools access global_data)
> - ❌ `configure_per_call` is for SDK EXPERTS ONLY (avoid unless you enjoy pain)
> - ❌ Don't rebuild contexts per-call (context pollution, recursion errors)
> - ❌ Variable substitution must happen in Python BEFORE passing to SDK
>
> **Recommendation:** Avoid `configure_per_call` unless you have SignalWire support on speed dial.
>
> **🎯 Nov 18, 2025 - 8-Node Revenue System Implemented:**
> 
> **Business Requirement:** "We get paid per booking. Answers, objections, and booking are our money makers."
> 
> **Complete 8-Node System:**
> 1. GREET (rapport) → 2. VERIFY (security) → 3. QUALIFY (gates) → 4. QUOTE (value) → 5. ANSWER (education) ←→ 6. OBJECTIONS (concerns) → 7. BOOK ($$$) → 8. GOODBYE (close)
> 
> **New Nodes Created (Nov 18):**
> - **VERIFY:** Security confirmation (city + last 4 digits) - builds trust
> - **QUALIFY:** Smart gates (62+, homeowner, equity, owner-occupied) - filters leads
> - **QUOTE:** Equity estimate with math skill (50-60% calculation) - creates desire
> - **OBJECTIONS:** Empathy + facts (FHA insurance, legal protections) - saves deals
> 
> **Revenue Impact:**
> - VERIFY: Reduces hang-ups (trust)
> - QUALIFY: Saves time (filters unqualified)
> - QUOTE: Creates desire (concrete value)
> - ANSWER: Builds trust (education)
> - OBJECTIONS: Recovers deals (addresses doubts)
> - BOOK: $$$ REVENUE $$$ ($300-$350 per show)
> 
> **Status:** ✅ All 8 nodes created in database, routing configured, production-ready

---

## 📚 Table of Contents

1. [Executive Summary (Non-Technical)](#executive-summary-non-technical)
2. [What is BarbGraph?](#what-is-barbgraph)
3. [Why BarbGraph is Better Than Mono-Prompting](#why-barbgraph-is-better-than-mono-prompting)
4. [How BarbGraph Works (Simple Explanation)](#how-barbgraph-works-simple-explanation)
5. [Technical Architecture](#technical-architecture)
6. [Component Details](#component-details)
7. [Code Examples](#code-examples)
8. [Benefits & Use Cases](#benefits--use-cases)
9. [Future Enhancements](#future-enhancements)

---

## Executive Summary (Non-Technical)

**BarbGraph** is a conversation management system that makes AI phone agents (like Barbara) smarter and more natural to talk to.

### The Problem We Solved

Previously, Barbara used one giant instruction manual for the entire call. This caused:
- **Confusion:** Barbara tried to do everything at once
- **Repetition:** She'd ask the same questions multiple times
- **Inconsistency:** Sometimes she'd skip important steps
- **Poor Flow:** Conversations felt robotic and unpredictable

### The Solution

BarbGraph breaks the conversation into **8 clear stages** (like chapters in a book):

1. **Greet** - Say hello and build rapport
2. **Verify** - Confirm who's calling
3. **Qualify** - Check if they're a good fit (age, home ownership, equity)
4. **Quote** - Show them personalized financial estimates (equity × 0.50 to 0.60)
5. **Answer** - Address their questions, provide information
6. **Objections** - Handle concerns, reframe negatives
7. **Book** - Schedule an appointment with broker
8. **Exit** - Say goodbye gracefully (can re-greet if spouse available)

Each stage has its own focused instructions, and Barbara automatically moves between stages based on what the caller says and does.

---

## What is BarbGraph?

**BarbGraph** (Barbara + Graph) is an **event-based state machine** that orchestrates multi-stage conversations for voice AI agents.

Think of it like a GPS for conversations:
- **Current Location:** Which conversation stage Barbara is in right now
- **Destination:** What goal needs to be achieved in this stage
- **Route Calculation:** Dynamically deciding the next stage based on what happened
- **Rerouting:** Adapting when the caller takes an unexpected turn

### Key Concepts

- **Node:** A conversation stage with specific goals (e.g., "Greet", "Qualify", "Quote")
- **Theme:** Universal personality prompt applied to all nodes (eliminates duplication)
- **State:** Data about the conversation stored in the database (e.g., "Has the caller been verified?")
- **Router:** Decision-making logic that determines which node comes next
- **Event:** A trigger that happens during the call (e.g., "Barbara finished speaking")

---

## Why BarbGraph is Better Than Mono-Prompting

| Feature | Mono-Prompting | BarbGraph |
|---------|---------------|-----------|
| **Instructions** | One giant prompt trying to do everything | 8 focused prompts, each with clear objectives |
| **Conversation Flow** | Hope the AI follows the plan | Enforced structure with flexibility |
| **Memory** | AI must remember what's been done | Database tracks progress automatically |
| **Adaptability** | Hard to handle unexpected turns | Dynamically routes based on actual conversation state |
| **Debugging** | "Why did it fail?" is unclear | "It failed at the Verify stage because..." |
| **Editing** | Change one thing, break everything | Edit one node without affecting others |
| **Multi-Call Support** | Starts over every time | Remembers where you left off |
| **Call Type Handling** | Separate prompts for each scenario | One prompt adapts via context injection |
| **Conversation Quality** | Unpredictable, often repetitive | Structured, progressive, natural |

### Real-World Example

**Mono-Prompting Scenario:**
```
Barbara: Hi! I'm Barbara. Are you John? What's your address? Do you own a home? 
         Are you 62+? What questions do you have? Want to book an appointment?
Caller: Wait, slow down! Who are you calling for?
Barbara: I'm calling about reverse mortgages. Are you interested?
```
**Problem:** Barbara dumps everything at once. No progression. Feels like spam.

**BarbGraph Scenario:**
```
Barbara: Hi! This is Barbara calling about your reverse mortgage inquiry. 
         Am I speaking with John?
Caller: No, this is his wife Sarah.
Barbara: [Router detects: wrong_person = true]
         [Transitions to EXIT node]
         Oh, I apologize! Is John available?
Caller: Yes, let me grab him.
Barbara: [Router detects: right_person_available = true]
         [Re-routes to GREET node to start fresh with John]
```
**Solution:** Barbara adapts in real-time. Conversation feels human.

---

## How BarbGraph Works (Simple Explanation)

### The Conversation Journey

Imagine Barbara is a tour guide taking callers through a museum with 8 rooms:

1. **Lobby (Greet):** Welcome the visitor, introduce yourself
2. **Security (Verify):** Check ID, get visitor badge
3. **Assessment (Qualify):** "Are you interested in Egyptian artifacts or Renaissance art?"
4. **Financial Desk (Quote):** Show them estimated tour costs and benefits
5. **Information Desk (Answer):** Answer specific questions about exhibits
6. **Guest Relations (Objections):** Handle concerns ("Is the museum wheelchair accessible?")
7. **Ticket Booth (Book):** Reserve a guided tour time
8. **Exit (Exit):** Thank them for visiting, show them out

### Barbara's Job in Each Room

- **Stay Focused:** Only worry about the current room's task
- **Check Progress:** "Have I completed this room's checklist?"
- **Decide Next Room:** "Based on what the visitor said, where should we go next?"
- **Remember Everything:** Even though she moves between rooms, she remembers the entire conversation

### The Magic: Automatic Routing

Barbara doesn't blindly follow "Room 1 → Room 2 → Room 3."

Instead, after each room, she checks:
- ✅ Did I complete this room's goals?
- 🤔 What did the visitor say or do?
- 🧭 What's the best next room based on the situation?

**Example Scenarios:**

- Visitor asks a question in the Lobby → Jump to Information Desk
- Wrong person at Security → Go to Exit (ask if right person is available)
- Visitor ready to book in Assessment → Skip ahead to Ticket Booth
- Visitor sees quote and is excited → Go to Information Desk (answer questions)
- Visitor has concerns in Ticket Booth → Detour to Guest Relations
- Right person becomes available at Exit → Return to Lobby (start fresh)

This is called **dynamic routing** - the path changes based on what actually happens.

---

## Technical Architecture

### System Overview

BarbGraph is a **3-layer architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                     LAYER 1: FRONTEND                        │
│  Vue Portal - Node-Based Prompt Editor (PromptManagement.vue)│
│  • Vertical selector (reverse_mortgage, solar, hvac)        │
│  • 8-node tab navigation (greet, verify, qualify, quote, etc.)     │
│  • Theme editor (universal personality per vertical)        │
│  • JSONB content editor (role, instructions, tools)         │
│  • Save/Load via Supabase RPC                               │
└─────────────────────────────────────────────────────────────┘
                              ▼ saves to
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 2: DATABASE                         │
│  Supabase PostgreSQL                                         │
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
│  • Prompt loader (DB query + file fallback)                 │
│  • State flag tools (mark_ready_to_book, etc.)              │
│  • Node completion checkers (is_node_complete)              │
│  • Dynamic routers (route_after_greet, etc.)                │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow: End-to-End

```
1. Admin edits "Greet" node prompt in Vue Portal
                    ↓
2. Vue saves to Supabase (prompts + prompt_versions)
                    ↓
3. Inbound call arrives → LiveKit Cloud dispatches
                    ↓
4. Agent loads "Greet" prompt from Supabase
                    ↓
5. Agent speaks greeting (using loaded instructions)
                    ↓
6. agent_speech_committed event fires
                    ↓
7. Agent checks: is_node_complete("greet", state)?
                    ↓
8. If complete → route_after_greet(state) decides next node
                    ↓
9. Agent loads "Verify" prompt from Supabase
                    ↓
10. Conversation continues... (repeat steps 5-9)
```

---

## Component Details

### 1. Frontend: Vue Portal Node Editor

**File:** `portal/src/views/admin/PromptManagement.vue`

**Purpose:** Web UI for editing conversation node prompts without touching code.

**Key Features:**
- **Vertical Selector:** Choose business vertical (reverse_mortgage, solar, hvac)
- **8-Node Tabs:** Greet, Verify, Qualify, Quote, Answer, Objections, Book, Exit
- **Theme Editor:** Universal personality per vertical (edits theme_prompts table)
- **JSONB Content Editor:** 3 fields per node (personality moved to theme):
  - `role` - Who is Barbara in this stage?
  - `instructions` - What should she do?
  - `tools` - Which tools can she use? (comma-separated)
- **Smart Save Button:** Creates new version, deactivates old, updates current_version
- **Live Reload:** Agent picks up changes immediately on next call

**Code Snippet: Node Save Logic**

```javascript
async function saveCurrentNode() {
  // Build JSONB content object from form fields
  const contentObj = {
    role: currentVersion.value.content.role || '',
    instructions: currentVersion.value.content.instructions || '',
    tools: currentVersion.value.content.tools 
      ? currentVersion.value.content.tools.split(',').map(t => t.trim()) 
      : []
    // Note: personality moved to theme_prompts table (universal per vertical)
  }
  
  // Check if node already exists
  const existingNode = currentNodePrompt.value
  
  if (existingNode) {
    // UPDATE: Increment version number and create new version
    const newVersionNumber = existingNode.version_number + 1
    
    await supabase.from('prompt_versions').insert({
      prompt_id: existingNode.id,
      version_number: newVersionNumber,
      content: contentObj,
      is_active: true,
      change_summary: `Updated ${selectedNode.value} node from Vue portal`
    })
    
    // Deactivate old version
    await supabase.from('prompt_versions')
      .update({ is_active: false })
      .eq('prompt_id', existingNode.id)
      .eq('version_number', existingNode.version_number)
      
  } else {
    // INSERT: Create new prompt + first version
    const { data: newPrompt } = await supabase.from('prompts').insert({
      name: selectedNode.value.charAt(0).toUpperCase() + selectedNode.value.slice(1),
      vertical: selectedVertical.value,
      node_name: selectedNode.value,
      current_version: 1,
      is_active: true
    }).select().single()
    
    await supabase.from('prompt_versions').insert({
      prompt_id: newPrompt.id,
      version_number: 1,
      content: contentObj,
      is_active: true
    })
  }
}
```

---

### 2. Database: Supabase Schema

**Key Tables:**

#### Theme Prompts System ⭐ **ACTIVE (NOV 11, 2025)**

BarbGraph uses a two-layer prompt system:

1. **Theme Layer (Universal):** Defines Barbara's core personality for the entire vertical
2. **Node Layer (Specific):** Defines actions and goals for each conversation stage

**Why Separate Themes?**
- ✅ Eliminates duplication (personality defined once, not 8 times)
- ✅ Easy to maintain (update personality in one place)
- ✅ Consistency (all nodes use same core personality)
- ✅ Flexibility (different verticals can have different personalities)

**Theme Prompts Table:**

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

**Current Status:**
- ✅ `reverse_mortgage` theme seeded (695 characters)
- ✅ All 8 node prompts stripped of personality (moved to theme)
- ✅ Theme loading implemented in `prompt_loader.py`
- ✅ Combined prompt injection working (Theme → Context → Node)

**Prompt Injection Order:**

```
Theme (from theme_prompts table)
  ↓
Call Context (injected by agent)
  ↓
Node Prompt (from prompt_versions table)
  ↓
Final Combined Prompt
```

**Example Combined Prompt:**

```
# Barbara - Core Personality
[theme content - 695 chars for reverse_mortgage]
- Warm, empathetic, patient
- Senior-friendly communication style
- Professional but approachable
- Values: Trust, transparency, respect
...

---

=== CALL CONTEXT ===
Call Type: inbound-qualified
Direction: Inbound
Lead Status: Known & Qualified
Lead Name: John Smith
Property: 123 Main St, Los Angeles, CA
Est. Equity: $450,000
===================

---

## Role
[node-specific role]

## Instructions
[node-specific instructions]
```

**Implementation:**
- `load_theme(vertical)` - Loads theme from database
- `load_node_prompt(node_name, vertical)` - Loads node and combines with theme
- Theme automatically prepended to every node prompt
- Separator `---` inserted between theme and node for clarity

#### `prompts` Table
Stores metadata for each conversation node prompt.

```sql
CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    vertical TEXT NOT NULL,           -- reverse_mortgage, solar, hvac
    node_name TEXT NOT NULL,          -- greet, verify, qualify, etc.
    current_version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vertical, node_name)       -- One prompt per vertical/node combo
);
```

#### `prompt_versions` Table
Stores versioned content for each prompt (enables rollback).

```sql
CREATE TABLE prompt_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL,           -- { role, personality, instructions, tools }
    is_active BOOLEAN DEFAULT false,
    is_draft BOOLEAN DEFAULT false,
    change_summary TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(prompt_id, version_number)
);
```

#### `conversation_state` Table
Stores conversation progress and flags for routing decisions.

```sql
CREATE TABLE conversation_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number TEXT NOT NULL UNIQUE,
    lead_id UUID REFERENCES leads(id),
    qualified BOOLEAN,                -- Top-level field (frequently queried)
    conversation_data JSONB DEFAULT '{}',  -- All routing flags live here
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Example `conversation_data` JSONB:**

```json
{
  "greeted": true,
  "verified": true,
  "qualified": true,
  "quote_presented": true,
  "quote_reaction": "positive",
  "questions_answered": false,
  "ready_to_book": false,
  "has_objection": false,
  "objection_handled": false,
  "appointment_booked": false,
  "appointment_id": null,
  "wrong_person": false,
  "right_person_available": false,
  "node_before_objection": "answer"
}
```

**QUOTE Node Flags:**
- `quote_presented`: Boolean - Has the financial quote been presented?
- `quote_reaction`: String - Caller's reaction ("positive", "skeptical", "needs_more", "not_interested")

#### `active_node_prompts` View
Pre-joins prompts with their active versions for fast queries.

```sql
CREATE VIEW active_node_prompts AS
SELECT 
    p.id,
    p.name,
    p.vertical,
    p.node_name,
    pv.version_number,
    pv.content
FROM prompts p
JOIN prompt_versions pv ON p.id = pv.prompt_id 
    AND p.current_version = pv.version_number
WHERE p.is_active = true AND pv.is_active = true;
```

#### `get_node_prompt()` RPC Function
Supabase function to query prompts by vertical + node_name.

```sql
CREATE OR REPLACE FUNCTION get_node_prompt(
    p_vertical TEXT,
    p_node_name TEXT
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    vertical TEXT,
    node_name TEXT,
    version_number INTEGER,
    content JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM active_node_prompts
    WHERE active_node_prompts.vertical = p_vertical
      AND active_node_prompts.node_name = p_node_name;
END;
$$ LANGUAGE plpgsql;
```

---

### 3. Backend: Agent Components

#### Component 3.1: BarbaraAgent Class

**File:** `equity_connect/agent/barbara_agent.py`

**Purpose:** Custom Agent subclass (SignalWire AgentBase) that implements event-based routing.

**Key Features:**
- Inherits from `signalwire_agents.AgentBase`
- Stores: `phone_number`, `call_type`, `current_node`
- Manages node transitions using **`context_switch` SWAIG action**
- Automatic routing after tool execution via `check_and_route()`

**Code Snippet: Agent Class (SignalWire SDK)**

```python
from signalwire_agents import AgentBase
from signalwire_agents.core import SwaigFunctionResult

class BarbaraAgent(AgentBase):
    """Barbara - Conversational AI agent for reverse mortgage lead qualification
    
    Uses BarbGraph 8-node event-driven routing with SignalWire SDK infrastructure.
    All business logic (tools, routers, checkers) remains unchanged from LiveKit version.
    """
    
    def __init__(self):
        super().__init__(
            name="barbara-agent",
            route="/agent",
            host="0.0.0.0",
            port=8080,
            use_pom=True,  # Enable Prompt Object Model
            auto_answer=True,
            record_call=True
        )
        
        # Enable SIP routing for inbound calls
        self.enable_sip_routing(auto_map=True)
        
        # Set up dynamic configuration (per-request)
        self.set_dynamic_config_callback(self.configure_per_call)
        
        # BarbGraph routing state
        self.current_node = "greet"
        self.phone_number = None
        self.call_type = "inbound"
    
    def configure_per_call(self, query_params, body_params, headers, agent):
        """Configure agent dynamically per-request
        
        This runs for EVERY incoming call and handles:
        - AI provider configuration (TTS/LLM/STT)
        - Multi-call persistence (resume where left off)
        - Initial BarbGraph node selection
        - Prompt loading with context injection
        """
        # Extract call info
        phone = body_params.get('From') or query_params.get('phone')
        broker_id = query_params.get('broker_id')
        
        # Configure AI (TTS/LLM/STT/skills)
        agent.add_language("English", "en-US", voice="rachel", engine="elevenlabs")
        agent.set_params({"ai_model": "gpt-4o", "end_of_speech_timeout": 800})
        agent.add_skill("datetime")  # Temporal awareness
        agent.add_skill("math")  # Reliable calculations
        
        # Multi-call persistence: check if returning caller
        current_node = "greet"
        if phone:
            state_row = get_conversation_state(phone)
            if state_row:
                cd = state_row.get("conversation_data", {})
                if cd.get("appointment_booked"):
                    current_node = "exit"  # Already done
                elif cd.get("ready_to_book"):
                    current_node = "book"  # Resume at booking
                elif cd.get("qualified") is not None:
                    current_node = "answer"  # Already qualified
        
        # Load BarbGraph node prompt (theme + context + node)
        instructions = build_instructions_for_node(
            node_name=current_node,
            call_type="inbound",
            lead_context=lead_context,
            phone_number=phone,
            vertical="reverse_mortgage"
        )
        
        agent.set_prompt_text(instructions)
        
        # Store state
        self.current_node = current_node
        self.phone_number = phone
    
    def check_and_route(self, tool_name: str):
        """Check if we should transition to next node after tool execution"""
        phone = self.phone_number
        if not phone:
            return
        
        # Get conversation state from DB
        state_row = get_conversation_state(phone)
        if not state_row:
            return
        
        # Check if current node is complete
        conversation_data = state_row.get("conversation_data", {})
        if is_node_complete(self.current_node, conversation_data):
            # Determine next node using BarbGraph routers
            next_node = self._get_next_node(state_row)
            
            if next_node and next_node != self.current_node:
                logger.info(f"🔀 Routing: {self.current_node} → {next_node}")
                self._route_to_node(next_node, phone)
    
    def _route_to_node(self, node_name: str, phone: str):
        """Route to new BarbGraph node using context_switch for smooth transitions
        
        This is the proper SignalWire pattern for mid-call prompt changes.
        Uses context_switch action instead of basic set_prompt_text() to:
        - Provide transition context to the LLM
        - Consolidate conversation history (save tokens)
        - Create natural, smooth node transitions
        
        Returns:
            SwaigFunctionResult with context_switch action
        """
        # Save per-node summary before transitioning
        self._save_node_summary(self.current_node, phone)
        
        # Get conversation state for context
        state_row = get_conversation_state(phone)
        lead_context = self._extract_lead_context(state_row)
        
        # Load new node prompt (theme + context + node)
        node_prompt = build_instructions_for_node(
            node_name=node_name,
            call_type=self.call_type,
            lead_context=lead_context,
            phone_number=phone,
            vertical="reverse_mortgage"
        )
        
        # Build transition context message
        transition_message = self._build_transition_message(node_name, state_row)
        
        # Use SWAIG context_switch action (proper SignalWire pattern)
        result = SwaigFunctionResult()
        result.switch_context(
            system_prompt=node_prompt,
            user_prompt=transition_message,
            consolidate=True  # Summarize previous conversation to save tokens
        )
        
        # Update tracking
        self.current_node = node_name
        self.phone_number = phone
        
        # Apply function restrictions per node
        self._apply_node_function_restrictions(node_name)
        
        logger.info(f"✅ Context switched to node '{node_name}' with consolidation")
        
        return result
    
    def _build_transition_message(self, node_name: str, state: dict) -> str:
        """Build user message to provide context for node transition
        
        This message helps the LLM understand WHY the prompt changed and what
        happened in the previous node. Creates smoother, more natural transitions.
        """
        conversation_data = state.get("conversation_data", {}) if state else {}
        
        messages = {
            "greet": "Call starting. Greet the caller warmly and introduce yourself.",
            "verify": "Caller has been greeted. Now verify their identity and collect basic information.",
            "qualify": "Identity verified. Now determine if they qualify for a reverse mortgage.",
            "quote": f"Lead is qualified. Present the financial quote using their equity.",
            "answer": "Quote presented. Answer any questions they have about reverse mortgages.",
            "objections": f"Caller expressed concerns. Address them empathetically with facts.",
            "book": "Caller is ready to schedule. Check broker availability and book a time.",
            "exit": "Call objectives complete. Thank the caller and end professionally."
        }
        
        return messages.get(node_name, "Continue the conversation naturally.")
```

**SignalWire Routing Pattern:**

Unlike LiveKit's `agent_speech_committed` event hook, SignalWire routing happens **after tool execution**:

```python
# Automatic routing after each tool call
def check_and_route(self, tool_name: str):
    """Called after EVERY tool execution to check for node transitions"""
    # 1. Check if current node is complete
    # 2. If complete, get next node from BarbGraph router
    # 3. Call _route_to_node() which returns SwaigFunctionResult
    # 4. SignalWire SDK applies context_switch action automatically
```

**Key Difference from LiveKit:**
- **LiveKit:** Hook into `agent_speech_committed` event explicitly
- **SignalWire:** Routing happens in tool execution flow, uses SWAIG actions

---

#### Component 3.2: Prompt Loader (SignalWire Implementation)

**File:** `equity_connect/services/prompt_loader.py`

**Purpose:** Load node prompts from Supabase with file fallback + context injection for SignalWire SDK.

**Key Functions:**
1. `load_theme()` - Loads universal personality prompt for vertical
2. `load_node_prompt()` - Loads node-specific prompt and combines with theme
3. `build_context_injection()` - Builds call-specific context string
4. `build_instructions_for_node()` - **Main function** that combines all three layers

**Context Injection Method:**
SignalWire uses **string concatenation** (not template variables like `{{variable}}`). Context is injected as a formatted text block that gets inserted between the theme and node sections.

**Code Snippet: Main Function**

```python
def build_instructions_for_node(
    node_name: str,
    call_type: str = "outbound",
    lead_context: Optional[dict] = None,
    phone_number: Optional[str] = None,
    vertical: str = "reverse_mortgage"
) -> str:
    """Build complete instructions for a node (theme + context + node prompt)
    
    This is the main function called by BarbaraAgent to get full prompt text for SignalWire.
    Combines theme, call context, and node-specific instructions in the correct order.
    
    Returns:
        Complete prompt text ready for agent.set_prompt_text() or context_switch
    """
    # 1. Load node prompt (already includes theme from load_node_prompt())
    # load_node_prompt() returns: theme + "---" + node
    node_prompt_with_theme = load_node_prompt(node_name, vertical)
    
    # 2. Build context injection (if we have context)
    context = None
    if lead_context and phone_number:
        context = build_context_injection(call_type, lead_context, phone_number)
    
    # 3. Combine: Theme → Context → Node
    # Insert context between theme and node sections
    if context:
        # Split on the separator "---" that load_node_prompt adds
        if "\n---\n" in node_prompt_with_theme:
            theme_part, node_part = node_prompt_with_theme.split("\n---\n", 1)
            instructions = f"{theme_part}\n\n{context}\n\n---\n{node_part}"
        else:
            # Fallback: append context after everything
            instructions = f"{node_prompt_with_theme}\n\n{context}"
    else:
        # No context: use node prompt as-is (already has theme)
        instructions = node_prompt_with_theme
    
    return instructions
```

**Code Snippet: Context Injection**

```python
def build_context_injection(call_type: str, lead_context: dict, phone_number: str) -> str:
    """Build context string to inject into prompt
    
    Creates a formatted text block with call-specific information:
    - Call type and direction
    - Lead status (known/new)
    - Property information
    - Qualification status
    - Broker assignment
    
    This context is inserted between theme and node sections so the LLM
    has situational awareness without needing separate prompts per call type.
    """
    is_inbound = call_type.startswith("inbound")
    is_qualified = lead_context.get("qualified", False)
    lead_id = lead_context.get("lead_id")
    lead_name = lead_context.get("name", "Unknown")
    
    context_parts = [
        "=== CALL CONTEXT ===",
        f"Call Type: {call_type}",
        f"Direction: {'Inbound' if is_inbound else 'Outbound'}",
        f"Phone: {phone_number}",
    ]
    
    if lead_id:
        context_parts.append(f"Lead Status: Known (ID: {lead_id})")
        context_parts.append(f"Lead Name: {lead_name}")
        context_parts.append(f"Qualified: {'Yes' if is_qualified else 'No'}")
        
        # Add property context if available
        if lead_context.get("property_address"):
            context_parts.append(f"Property: {lead_context['property_address']}")
        elif lead_context.get("property_city") or lead_context.get("property_state"):
            # Construct from city/state if full address not available
            addr_parts = []
            if lead_context.get("property_city"):
                addr_parts.append(lead_context['property_city'])
            if lead_context.get("property_state"):
                addr_parts.append(lead_context['property_state'])
            if addr_parts:
                context_parts.append(f"Property: {', '.join(addr_parts)}")
        
        if lead_context.get("estimated_equity"):
            context_parts.append(f"Est. Equity: ${lead_context['estimated_equity']:,}")
        
        # Add broker info if assigned
        if lead_context.get("broker_name"):
            broker_info = f"Assigned Broker: {lead_context.get('broker_name')}"
            if lead_context.get("broker_company"):
                broker_info += f" ({lead_context.get('broker_company')})"
            context_parts.append(broker_info)
    else:
        context_parts.append("Lead Status: Unknown (new caller)")
    
    context_parts.append("===================\n")
    return "\n".join(context_parts)
```

**Final Prompt Assembly (SignalWire):**

```python
# In barbara_agent.py on_swml_request() or _route_to_node():

# Load complete instructions (theme + context + node)
instructions = build_instructions_for_node(
    node_name=current_node,
    call_type=call_direction,
    lead_context=lead_context,
    phone_number=phone,
    vertical="reverse_mortgage"
)

# Apply to agent
self.set_prompt_text(instructions)  # Initial call setup
# OR
result.switch_context(system_prompt=instructions, ...)  # Mid-call routing
```

**Final Prompt Structure:**
```
# Barbara - Core Personality
[Theme content - universal personality for vertical]
---

=== CALL CONTEXT ===
Call Type: inbound
Direction: Inbound
Phone: +15551234567
Lead Status: Known (ID: abc-123)
Lead Name: John Smith
Qualified: Yes
Property: 123 Main St, Los Angeles, CA
Est. Equity: $450,000
Assigned Broker: Walter White (ABC Mortgage)
===================

---

## Role
[Node-specific role]

## Instructions
[Node-specific instructions]
```

**Key Points:**
- ✅ **"Injection" is the correct term** - it's a common industry term meaning "inserting data into a template/prompt"
- ✅ Context is injected as **formatted text**, not template variables (SignalWire doesn't use `{{variable}}` syntax)
- ✅ Order: **Theme → Context → Node** (optimal for LLM parsing)
- ✅ Context is **optional** - if no lead_context provided, prompt still works (theme + node only)
- ✅ Same node prompt adapts to different call types via context injection (no duplicate prompts needed)

---

#### Component 3.3: Node Completion Checker

**File:** `equity_connect/workflows/node_completion.py`

**Purpose:** Determine if a node's goals have been met based on DB state.

**Code Snippet:**

```python
def is_node_complete(node_name: str, state: dict) -> bool:
    """Check if current node goals are met based on DB state"""
    
    completion_criteria = {
        "greet": lambda s: s.get("greeted") == True,
        "verify": lambda s: s.get("verified") == True,
        "qualify": lambda s: s.get("qualified") != None,
        "quote": lambda s: s.get("quote_presented") == True,
        "answer": lambda s: s.get("questions_answered") or s.get("ready_to_book"),
        "objections": lambda s: s.get("objection_handled") == True,
        "book": lambda s: s.get("appointment_booked") == True,
        "exit": lambda s: True,  # Exit always completes immediately
    }
    
    checker = completion_criteria.get(node_name)
    return checker(state) if checker else False
```

**How It Works:**
- Each node has a lambda function that checks specific flags in `conversation_data`
- These flags are set by tools when the LLM accomplishes a goal
- Agent calls this after each turn to decide if routing should happen

---

#### Component 3.4: Dynamic Routers

**File:** `equity_connect/workflows/routers.py`

**Purpose:** DB-driven routing logic for each node.

**Code Snippet: route_after_greet**

```python
def route_after_greet(state: ConversationState) -> Literal["verify", "qualify", "answer", "exit", "greet"]:
    """
    DB-driven routing after greeting.
    - If wrong_person and NOT available → exit
    - If wrong_person but available → greet (re-greet)
    - If verified → qualify
    - If already qualified → answer
    - If unverified → verify
    """
    row = _db(state)  # Get conversation_state DB row
    if not row:
        return "verify"
    
    cd = _cd(row)  # Get conversation_data JSONB
    
    # Check if wrong person answered
    if cd.get("wrong_person"):
        if cd.get("right_person_available"):
            logger.info("🔄 Wrong person, but right person available → RE-GREET")
            return "greet"
        else:
            logger.info("🚪 Wrong person, not available → EXIT")
            return "exit"
    
    # Check if already verified and qualified
    if cd.get("verified"):
        if row.get("qualified"):
            # If qualified but quote not presented, go to quote first
            if not cd.get("quote_presented"):
                logger.info("✅ Verified and qualified → QUOTE")
                return "quote"
            else:
                logger.info("✅ Already verified, qualified, and quoted → ANSWER")
                return "answer"
        else:
            logger.info("✅ Verified, not qualified → QUALIFY")
            return "qualify"
    
    # Default: verify identity
    logger.info("🔍 Not verified → VERIFY")
    return "verify"
```

**Code Snippet: route_after_quote**

```python
def route_after_quote(state: ConversationState) -> Literal["answer", "book", "exit"]:
    """
    DB-driven routing after quote presentation.
    - If quote_reaction == "not_interested" → exit
    - If ready_to_book → book
    - If has_questions → answer
    - Default → answer
    """
    row = _db(state)
    if not row:
        return "answer"
    cd = _cd(row)
    
    # Check reaction to quote
    quote_reaction = cd.get("quote_reaction")
    if quote_reaction == "not_interested":
        logger.info("🚪 Not interested in quote → EXIT")
        return "exit"
    
    # Check if ready to book
    if cd.get("ready_to_book"):
        logger.info("✅ Ready to book after quote → BOOK")
        return "book"
    
    # Default: answer questions
    logger.info("💬 Has questions about quote → ANSWER")
    return "answer"
```

**Code Snippet: route_after_objections**

```python
def route_after_objections(state: ConversationState) -> Literal["answer", "objections", "book", "exit"]:
    """
    DB-driven routing after objection handling.
    - If objection_handled and ready_to_book → book
    - If objection_handled → return to answer (or original node)
    - If wrong_person → exit
    - Else → stay in objections
    """
    row = _db(state)
    if not row:
        return "answer"
    cd = _cd(row)
    
    if cd.get("wrong_person"):
        logger.info("🚪 Wrong person → EXIT")
        return "exit"
    
    if cd.get("objection_handled"):
        if cd.get("ready_to_book"):
            logger.info("✅ Objection handled + ready to book → BOOK")
            return "book"
        else:
            # Return to the node they were in before the objection
            previous_node = cd.get("node_before_objection", "answer")
            logger.info(f"✅ Objection handled → {previous_node.upper()}")
            return previous_node
    
    logger.info("⏳ Objection not resolved → STAY IN OBJECTIONS")
    return "objections"
```

**Key Insight:** Routers are **dynamic** - they examine actual DB state, not hardcoded sequences. This enables seniors' unpredictable behavior to be handled gracefully.

---

#### Component 3.5: State Flag Tools

**File:** `equity_connect/tools/conversation_flags.py`

**Purpose:** Allow the LLM to signal routing intent by setting flags in the database.

**Code Snippet: mark_ready_to_book**

```python
@function_tool
async def mark_ready_to_book(phone: str) -> str:
    """Mark that the caller is ready to schedule an appointment."""
    logger.info(f"🎯 Marking caller ready to book: {phone}")
    
    update_conversation_state(phone, {
        "conversation_data": {
            "ready_to_book": True,
            "questions_answered": True,  # Implicit - satisfied enough to book
        }
    })
    
    return "Caller marked as ready to book. Transition to booking node will occur."
```

**Code Snippet: mark_has_objection**

```python
@function_tool
async def mark_has_objection(phone: str, current_node: str) -> str:
    """Mark that the caller has raised an objection or concern."""
    logger.info(f"🚧 Objection detected for: {phone}")
    
    update_conversation_state(phone, {
        "conversation_data": {
            "has_objection": True,
            "node_before_objection": current_node,  # Remember where we were
        }
    })
    
    return "Objection noted. Will transition to objection handling."
```

**Code Snippet: mark_wrong_person**

```python
@function_tool
async def mark_wrong_person(phone: str, right_person_available: bool = False) -> str:
    """Mark that we're speaking to the wrong person."""
    logger.info(f"❌ Wrong person on call: {phone}")
    
    update_conversation_state(phone, {
        "conversation_data": {
            "wrong_person": True,
            "right_person_available": right_person_available,
        }
    })
    
    if right_person_available:
        return "Wrong person, but right person is available. Will re-greet."
    else:
        return "Wrong person and not available. Will politely exit."
```

**Available Tools:**
1. `mark_ready_to_book(phone)` - Caller wants to book
2. `mark_has_objection(phone, objection_type)` - Caller has concerns
3. `mark_objection_handled(phone)` - Objection resolved
4. `mark_questions_answered(phone)` - All questions answered
5. `mark_quote_presented(phone, quote_reaction)` - Quote presented with reaction
6. `mark_wrong_person(phone, right_person_available)` - Wrong person answered
7. `clear_conversation_flags(phone)` - Reset routing flags (new call)

---

## Code Examples

### Example 1: Full Conversation Flow

```
📞 CALL STARTS
  ↓
🎤 Agent.on_enter() → load_node("greet", speak_now=True)
  ↓
💬 "Hi! This is Barbara from Equity Connect. Am I speaking with John?"
  ↓
👤 USER: "No, this is his wife Sarah."
  ↓
🛠️ LLM calls: mark_wrong_person(phone="+1234567890", right_person_available=False)
  ↓
💾 DB UPDATE: conversation_data.wrong_person = true
  ↓
🔔 agent_speech_committed event fires
  ↓
🔍 check_and_route()
  ├─ is_node_complete("greet", state) → True (greeted)
  └─ route_after_greet(state) → "exit" (wrong person, not available)
  ↓
📍 load_node("exit", speak_now=False)
  ↓
💬 "I apologize for the confusion. Is John available by any chance?"
  ↓
👤 USER: "Yes, let me grab him."
  ↓
🛠️ LLM calls: mark_wrong_person(phone="+1234567890", right_person_available=True)
  ↓
💾 DB UPDATE: conversation_data.right_person_available = true
  ↓
🔔 agent_speech_committed event fires
  ↓
🔍 check_and_route()
  ├─ is_node_complete("exit", state) → True (always complete)
  └─ route_after_exit(state) → "greet" (right person available)
  ↓
📍 load_node("greet", speak_now=True)
  ↓
💬 "Hi John! This is Barbara from Equity Connect..."
```

---

### Example 2: Qualification Flow

```
📍 QUALIFY NODE
  ↓
💬 "Great! Let me ask a few quick questions. Do you own your home?"
  ↓
👤 USER: "Yes, for 30 years."
  ↓
💬 "Perfect. And are you 62 years or older?"
  ↓
👤 USER: "I'm 68."
  ↓
🛠️ LLM calls: update_lead_info(phone="+1234567890", age=68, owns_home=True)
  ↓
💾 DB UPDATE: lead.status = "qualified", conversation_state.qualified = true
  ↓
🔔 agent_speech_committed event fires
  ↓
🔍 check_and_route()
  ├─ is_node_complete("qualify", state) → True (qualified != null)
  └─ route_after_qualify(state) → "quote" (qualified)
  ↓
📍 load_node("quote", speak_now=False)
  ↓
💬 "Perfect! Based on your equity of $450,000, you could access $225,000 to $270,000."
  ↓
👤 USER: "That sounds great! How does this work?"
  ↓
🛠️ LLM calls: mark_quote_presented(phone="+1234567890", quote_reaction="positive")
  ↓
💾 DB UPDATE: conversation_data.quote_presented = true, quote_reaction = "positive"
  ↓
🔔 agent_speech_committed event fires
  ↓
🔍 check_and_route()
  ├─ is_node_complete("quote", state) → True (quote_presented == true)
  └─ route_after_quote(state) → "answer" (has questions)
  ↓
📍 load_node("answer", speak_now=False)
  ↓
💬 "That's great! You qualify for our program. What questions can I answer?"
```

---

### Example 3: Quote Presentation Flow

```
📍 QUALIFY NODE (completed)
  ↓
💾 DB: qualified = true
  ↓
🔍 route_after_qualify(state) → "quote"
  ↓
📍 QUOTE NODE
  ↓
💬 "Perfect! Based on your equity of $450,000, you could access $225,000 to $270,000."
  ↓
👤 USER: "That sounds interesting. Tell me more."
  ↓
🛠️ LLM calls: mark_quote_presented(phone="+1234567890", quote_reaction="positive")
  ↓
💾 DB UPDATE:
    conversation_data.quote_presented = true
    conversation_data.quote_reaction = "positive"
  ↓
🔔 agent_speech_committed event fires
  ↓
🔍 check_and_route()
  ├─ is_node_complete("quote", state) → True (quote_presented == true)
  └─ route_after_quote(state) → "answer" (has questions)
  ↓
📍 load_node("answer", speak_now=False)
  ↓
💬 "I'd be happy to explain! Reverse mortgages allow you to..."
```

**Alternative: Not Interested**
```
👤 USER: "No thanks, I'm not interested."
  ↓
🛠️ LLM calls: mark_quote_presented(phone="+1234567890", quote_reaction="not_interested")
  ↓
💾 DB UPDATE: quote_reaction = "not_interested"
  ↓
🔍 route_after_quote(state) → "exit" (not_interested)
  ↓
📍 load_node("exit", speak_now=False)
  ↓
💬 "I completely understand. Thank you for your time. Have a great day!"
```

---

### Example 4: Objection Interrupt

```
📍 ANSWER NODE (mid-conversation)
  ↓
💬 "Reverse mortgages work by..."
  ↓
👤 USER: "Wait, I heard these are scams?"
  ↓
🛠️ LLM calls: mark_has_objection(phone="+1234567890", current_node="answer")
  ↓
💾 DB UPDATE: 
    conversation_data.has_objection = true
    conversation_data.node_before_objection = "answer"
  ↓
🔔 agent_speech_committed event fires
  ↓
🔍 check_and_route()
  ├─ is_node_complete("answer", state) → True (has_objection detected)
  └─ route_after_answer(state) → "objections"
  ↓
📍 load_node("objections", speak_now=False)
  ↓
💬 "I completely understand that concern. Let me clarify..."
  ↓
[Agent addresses objection]
  ↓
🛠️ LLM calls: mark_objection_handled(phone="+1234567890")
  ↓
💾 DB UPDATE: conversation_data.objection_handled = true
  ↓
🔔 agent_speech_committed event fires
  ↓
🔍 check_and_route()
  ├─ is_node_complete("objections", state) → True (objection_handled)
  └─ route_after_objections(state) → "answer" (return to node_before_objection)
  ↓
📍 load_node("answer", speak_now=False)
  ↓
💬 "Does that help clarify? What other questions do you have?"
```

---

## Benefits & Use Cases

### Benefits

✅ **Structured Conversations**
- Each node has clear objectives
- Progressive disclosure (don't overwhelm the caller)
- Enforced flow prevents skipping critical steps

✅ **Dynamic Adaptability**
- Routes based on actual conversation state, not hardcoded paths
- Handles unexpected scenarios (wrong person, objections, early booking)
- Graceful recovery from errors

✅ **Multi-Call Continuity**
- Database persists conversation state across calls
- "Pick up where we left off" - no need to re-qualify
- Long sales cycles supported (call back in a week)

✅ **Debugging & Analytics**
- "Call failed at VERIFY node" - exact failure point
- Track conversion metrics per node (% who reach BOOK)
- A/B test different node prompts easily

✅ **Maintainability**
- Edit one node without breaking others
- Version control for prompts (rollback if needed)
- Non-technical admins can update via Vue Portal

✅ **Scalability**
- Same architecture works for any vertical (solar, HVAC, insurance)
- Context injection eliminates need for duplicate prompts
- Add new nodes without refactoring entire system

---

### Use Cases

**Use Case 1: Multi-Call Sales Cycle**
```
Day 1: Call arrives → Greet → Verify → Qualify → Quote → Answer → Exit (not ready)
       DB stores: qualified=true, quote_presented=true, quote_reaction="positive", 
                  questions_answered=true, ready_to_book=false

Day 7: Same caller calls back
       → Agent loads conversation_state
       → Skips Greet/Verify/Qualify/Quote (already complete)
       → Jumps to Answer: "Hi John! Have you had time to think it over?"
       → Routes to Book if ready_to_book=true
```

**Use Case 2: Spouse Handoff**
```
Call 1: Wife answers (wrong person) → Exit
        DB stores: wrong_person=true, right_person_available=true
        → Agent asks to speak with husband
        → Wife passes phone
        → Router detects right_person_available → Re-greet husband
```

**Use Case 3: Quote Presentation Flow**
```
Qualify node: "Perfect! Based on your equity of $450,000, you could access $225,000 to $270,000."
→ LLM calls mark_quote_presented(phone, quote_reaction="positive")
→ Router transitions to Quote node
→ Agent presents detailed financial estimates
→ Router checks quote_reaction:
   - "positive" → Answer (they're interested, answer questions)
   - "skeptical" → Answer (address concerns with information)
   - "needs_more" → Answer (provide more details)
   - "not_interested" → Exit (polite goodbye)
```

**Use Case 4: Objection During Qualification**
```
Qualify node: "Are you 62+ years old?"
Caller: "Why does that matter? Are you discriminating by age?"
→ LLM detects objection → Calls mark_has_objection()
→ Router transitions to Objections node
→ Agent addresses concern
→ Router returns to Qualify node (node_before_objection)
→ Conversation resumes naturally
```

**Use Case 5: Multi-Vertical Platform**
```
Reverse Mortgage vertical:
  - Greet prompt emphasizes "senior homeowners"
  - Qualify asks: age, home ownership, equity
  
Solar vertical:
  - Greet prompt emphasizes "reduce energy bills"
  - Qualify asks: roof condition, utility costs, property ownership
  
Same agent code, different prompts loaded via vertical selector
```

---

## Future Enhancements

### Planned Features

1. **Analytics Dashboard**
   - Conversion funnel by node (% who reach each stage)
   - Average time spent per node
   - Most common exit points

2. **A/B Testing**
   - Deploy 2 versions of same node
   - Route 50% of calls to each
   - Measure which performs better

3. **Smart Routing**
   - ML model predicts best next node based on conversation history
   - Sentiment analysis influences routing (frustrated → objections)

4. **Multi-Language Support**
   - Same node structure, different language prompts
   - Auto-detect caller language, load appropriate vertical+language

5. **Visual Flow Editor**
   - Drag-and-drop node creation in Vue Portal
   - Visual routing diagram shows all possible paths
   - Real-time preview of conversation flow

6. **Advanced Context Injection**
   - CRM integration (pull lead data from Salesforce/HubSpot)
   - Calendar availability ("I have slots at 2pm and 4pm today")
   - Weather/location context ("I see you're in Miami, great for solar!")

---

## Appendix: Key Files Reference

| File | Purpose |
|------|---------|
| `equity_connect/agent/barbara_agent.py` | BarbaraAgent class (SignalWire AgentBase) + routing hooks |
| `equity_connect/services/prompt_loader.py` | DB query + context injection (SignalWire implementation) |
| `equity_connect/workflows/node_completion.py` | Completion criteria checkers |
| `equity_connect/workflows/routers.py` | 8 dynamic routing functions (added route_after_quote) |
| `equity_connect/tools/conversation_flags.py` | 7 state flag tools (added mark_quote_presented) |
| `equity_connect/tools/lead.py` | Lead lookup + verification tools |
| `equity_connect/tools/calendar.py` | Appointment booking tools |
| `portal/src/views/admin/PromptManagement.vue` | Node editor UI |
| `database/migrations/20251111_add_theme_prompts.sql` | Theme table creation |
| `database/migrations/20251111_add_quote_node_prompt.sql` | QUOTE node creation |
| `database/migrations/20251111_strip_personality_from_nodes.sql` | Personality removal |
| `database/migrations/20251111_add_vertical_node_to_prompts.sql` | Schema update |
| `database/migrations/20251111_seed_reverse_mortgage_node_prompts.sql` | Initial prompt seeding |

---

## Summary

**BarbGraph** transforms voice AI conversations from chaotic monologues into structured, adaptive dialogues. By breaking conversations into 8 focused stages, using a universal theme for personality consistency, persisting state in a database, and dynamically routing based on actual behavior, it delivers:

- **Better Caller Experience:** Natural, progressive conversations that adapt to their needs
- **Higher Conversion:** Structured flow ensures no critical steps are skipped
- **Easier Maintenance:** Edit one node without breaking the entire system
- **Multi-Call Support:** Pick up where you left off, no matter when you call back
- **Scalability:** Same architecture works across all business verticals

Whether you're a business owner looking to improve call quality or a developer building conversational AI, BarbGraph provides the foundation for world-class voice agent experiences.

---

**Questions?** Contact the dev team or consult the implementation docs:
- `BARBGRAPH_SYSTEM_VERIFICATION.md` - System verification results (21 tools, field names, data flow)
- `THEME_AND_QUOTE_IMPLEMENTATION_COMPLETE.md` - Theme system + QUOTE node implementation
- `BARBGRAPH_INTEGRATION_FIXES_COMPLETE.md` - Bug fixes log
- `EVENT_BASED_STATE_MACHINE_IMPLEMENTATION.md` - Backend implementation
- `PLAN_3_EXECUTION_COMPLETE.md` - Frontend implementation
- `MASTER_PRODUCTION_PLAN.md` - Complete system overview

