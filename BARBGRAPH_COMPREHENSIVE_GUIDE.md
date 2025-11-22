# BarbGraph: Database-Driven Conversation Routing System

**Version:** 3.0  
**Last Updated:** November 21, 2025  
**Status:** ✅ **PRODUCTION READY - Dual Platform (SignalWire SWML + LiveKit Agents) + Production-Grade Fallbacks**

> **✅ CURRENT SYSTEM:** BarbGraph is a database-informed routing system that works on both SignalWire SWML and LiveKit Agents. Single source of truth in database (prompts, tools, routing rules) with platform-specific implementations. Enables A/B testing and cost comparison.
> 
> **Key Innovation:** Routing rules, prompts, tools, and flags stored in database with platform-specific implementations (LLM-driven for SignalWire, code-driven for LiveKit).
> 
> **🎯 Nov 18-19, 2025 - HOW THE SYSTEM ACTUALLY WORKS:**
>
> **Dual Platform Architecture with Single Source of Truth:**
> 
> BarbGraph routing logic is stored in the database and works on BOTH platforms:
> 
> **1. SignalWire SWML Bridge** (`swaig-agent/`)
>    - FastAPI SWAIG bridge generates SWML responses
>    - Contexts built from database via `services/contexts.py`
>    - Tools declared as SWAIG functions via `function_includes`
>    - SignalWire handles transitions natively based on `valid_contexts`
>    - Deployed to Fly.io (`barbara-swaig-bridge.fly.dev`)
>
> **2. LiveKit Agent** (`livekit-agent/`)
>    - BarbaraAgent class with `AgentSession`
>    - Python routers check database flags and `valid_contexts`
>    - Tools decorated with `@function_tool`
>    - Manual transitions via `session.generate_reply()`
>    - Deployed to Fly.io (`barbara-livekit.fly.dev`)
>
> **Database Schema (Shared):**
> - `prompts` / `prompt_versions` - Instructions, tools, valid_contexts, step_criteria fields:
>   - `step_criteria_source`: Human-readable natural language (shown in Vue UI)
>   - `step_criteria_sw`: SignalWire-optimized natural language (auto-generated)
>   - `step_criteria_lk`: LiveKit-optimized boolean expressions (auto-generated, used by LiveKit agent)
>   - `step_criteria`: Legacy field (fallback for backward compatibility)
> - `theme_prompts` - Core personality per vertical
> - `conversation_state` - Multi-call persistence, conversation_data JSONB flags
> - `agent_voice_config` - SignalWire voice configuration
> - `ai_templates` - LiveKit AI configuration (STT, LLM, TTS, VAD)
>
> **Tool Implementations (Mirrored):**
> - **SignalWire:** Returns `{response: str, action: []}` for SWAIG
> - **LiveKit:** Returns `str` or `None` for function calling
> - **Same Business Logic:** Both call same Supabase queries, APIs
>
> **Portal Changes Flow:**
> - Edit in Vue Portal (Verticals.vue) → Saves to database → Next call loads from database → Changes are live on BOTH platforms
>
> **Why Dual Platform:**
> - ✅ A/B testing - Compare SignalWire vs LiveKit with database-informed routing
> - ✅ Cost optimization - Real-world data on which is cheaper
> - ✅ Risk mitigation - One platform down, other continues
> - ✅ Provider flexibility - SignalWire native plugins vs LiveKit Inference
> - ✅ Single source of truth - Database prompts/tools/rules, platform-specific execution
>
> **Key Changes (Nov 18-19):**
> - SignalWire Agent SDK abandoned (tool availability bug)
> - Rebuilt as SWML bridge (FastAPI + SWAIG functions)
> - LiveKit agent spun up as backup/comparison platform
> - Database-driven routing works on both platforms
> - All routing improvements applied (valid_contexts, step_criteria, instructions)
> - Both deployed to Fly.io with auto-deploy via GitHub Actions
>
> **Routing Improvements (Nov 19):**
> - VERIFY valid_contexts expanded: `['qualify', 'answer', 'quote', 'objections']`
> - QUALIFY valid_contexts expanded: `['goodbye', 'quote', 'objections']`
> - "end" node removed from all routing
> - VERIFY step_criteria clarified with explicit routing rules
> - QUALIFY step_criteria clarified with explicit routing rules
> - VERIFY instructions: "collect missing, confirm existing" pattern
> - ANSWER instructions with ⚠️ CRITICAL ROUTING RULE for calculations
> - Added `appointment_datetime`, `borderline_equity`, `pending_birthday`, `manual_booking_required` flags
>
> **Complete 8-Node System:**
1. **GREET** (rapport) → 2. **VERIFY** (security) → 3. **QUALIFY** (gates) → 4. **QUOTE** (value) → 5. **ANSWER** (education) ←→ 6. **OBJECTIONS** (concerns) → 7. **BOOK** ($$$) → 8. **GOODBYE** (close)

**Revenue Impact:**
- VERIFY: Reduces hang-ups (trust)
- QUALIFY: Saves time (filters unqualified)
- QUOTE: Creates desire (concrete value)
- ANSWER: Builds trust (education)
- OBJECTIONS: Recovers deals (addresses doubts)
- BOOK: $$$ REVENUE $$$ ($300-$350 per show)

**Status:** ✅ All 8 nodes active on both platforms, routing improvements applied, production-ready

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

**BarbGraph** (Barbara + Graph) is a **database-driven conversation routing system** that works on multiple AI voice platforms.

Think of it like a GPS for conversations:
- **Current Location:** Which conversation stage Barbara is in right now
- **Destination:** What goal needs to be achieved in this stage
- **Route Calculation:** Dynamically deciding the next stage based on what happened
- **Rerouting:** Adapting when the caller takes an unexpected turn
- **Platform-Agnostic:** Same routing logic works on SignalWire SWML and LiveKit Agents

### Key Concepts

- **Node:** A conversation stage with specific goals (e.g., "Greet", "Qualify", "Quote")
- **Theme:** Universal personality prompt applied to all nodes (eliminates duplication)
- **State:** Data about the conversation stored in the database (e.g., "Has the caller been verified?")
- **Router:** Decision-making logic that determines which node comes next
- **valid_contexts:** Database array defining which nodes a node can route to
- **step_criteria:** Database field system for node completion logic. Three variants exist:
  - `step_criteria_source`: Human-readable natural language (displayed in Vue UI)
  - `step_criteria_sw`: SignalWire-optimized natural language (auto-generated)
  - `step_criteria_lk`: LiveKit-optimized boolean expressions (e.g., "greet_turn_count >= 2 OR greeted == True") - **Primary field used by LiveKit agent**. Evaluated safely by step_criteria_evaluator.py. See STEP_CRITERIA_EXPRESSION_FORMAT.md for syntax. The agent automatically falls back to legacy `step_criteria` field if `step_criteria_lk` is not populated (backward compatibility).
- **Platform:** The AI voice system executing the routing (SignalWire or LiveKit)

### Dual Platform Implementation

**SignalWire SWML:**
- **File:** `swaig-agent/main.py` - FastAPI bridge that generates SWML responses
- Contexts built from database and returned in SWML response (`swaig-agent/services/contexts.py`)
- SignalWire's LLM chooses transitions within allowed `valid_contexts` (LLM-driven routing)
- Natural language `step_criteria` guide LLM completion decisions
- Tools declared as SWAIG functions (return `{response: str, action: []}` format)
- SignalWire handles transitions automatically via native context system
- **Fallbacks:** Production-quality theme, node configs, and models from actual DB snapshot (2025-11-21) with LOUD ERROR logging if database fails

**LiveKit Agents:**
- **Files:** `livekit-agent/agents/*.py` - 8 native Agent classes (BarbaraGreetAgent, BarbaraVerifyTask, etc.)
- **Entrypoint:** `livekit-agent/agent.py` creates initial `BarbaraGreetAgent`
- **Tool-Based Routing:** Tools decorated with `@function_tool` return other Agent/Task instances
- **Automatic Handoffs:** LiveKit handles Agent handoffs automatically when tools return Agent instances
- **Example:** `mark_greeted()` tool checks `conversation_data.verified` flag and returns `BarbaraVerifyTask` or `BarbaraAnswerAgent`
- Tools check `valid_contexts` from database to validate allowed transitions before returning Agent
- No manual transitions needed - LiveKit handles all handoffs automatically
- **Fallbacks:** Production-quality theme, node configs, and models from actual DB snapshot (2025-11-21) with LOUD ERROR logging if database fails

**Both platforms:**
- Load same prompts, tools, routing rules from database
- Use same business logic (Supabase queries, API calls)
- Update same conversation_state flags
- **Key Difference:** 
  - **SignalWire** = LLM-driven routing (SignalWire's LLM chooses from `valid_contexts` based on conversation)
  - **LiveKit** = Tool-driven routing (LLM calls tool, tool returns next Agent instance, LiveKit handles handoff)

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

BarbGraph is a **3-layer architecture** with dual platform backend:

```
┌─────────────────────────────────────────────────────────────┐
│                     LAYER 1: FRONTEND                        │
│  Vue Portal - Context-Based Prompt Editor (Verticals.vue)   │
│  • Vertical selector (reverse_mortgage, solar, hvac)        │
│  • 8-node cards (greet, verify, qualify, quote, answer,     │
│    objections, book, goodbye)                               │
│  • JSONB content editor (instructions, tools, valid_contexts)│
│  • AI Helper (✨) for theme and node generation            │
│  • Variable insertion (⚡) for {lead.first_name} syntax    │
│  • Dual platform tabs: SignalWire + LiveKit config         │
└─────────────────────────────────────────────────────────────┘
                              ▼ saves to
┌─────────────────────────────────────────────────────────────┐
│              LAYER 2: DATABASE (Single Source of Truth)      │
│  Supabase PostgreSQL                                         │
│  • prompts table (vertical, node_name)                      │
│  • prompt_versions table (content JSONB with valid_contexts)│
│  • theme_prompts table (universal personality per vertical) │
│  • conversation_state table (conversation_data JSONB flags) │
│  • agent_voice_config table (SignalWire TTS settings)       │
│  • ai_templates table (LiveKit STT/LLM/TTS/VAD config)      │
└─────────────────────────────────────────────────────────────┘
                              ▼ loads from
┌─────────────────────────────────────────────────────────────┐
│              LAYER 3: DUAL PLATFORM BACKEND                  │
│                                                              │
│  ┌──────────────────────────┐  ┌─────────────────────────┐ │
│  │  SignalWire SWML Bridge  │  │  LiveKit Agent Worker   │ │
│  │  (Fly.io)                │  │  (Fly.io)               │ │
│  ├──────────────────────────┤  ├─────────────────────────┤ │
│  │ • FastAPI SWAIG bridge   │  │ • BarbaraAgent class    │ │
│  │ • contexts.py (DB → SWML)│  │ • routers.py (BarbGraph)│ │
│  │ • SWAIG function handlers│  │ • @function_tool tools  │ │
│  │ • SignalWire transitions │  │ • AgentSession          │ │
│  └──────────────────────────┘  └─────────────────────────┘ │
│                                                              │
│  Both platforms share:                                       │
│  • Same prompts from database                               │
│  • Same routing rules (valid_contexts, step_criteria)       │
│  • Same business logic (Supabase queries, APIs)             │
│  • Same conversation_state flags                            │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow: End-to-End (Both Platforms)

```
1. Admin edits "Greet" node prompt in Vue Portal
                    ↓
2. Vue saves to Supabase (prompts + prompt_versions)
                    ↓
3. Inbound call arrives → Routes to SignalWire OR LiveKit
                    ↓
4. Agent loads "Greet" prompt from Supabase (both platforms)
                    ↓
5. Agent speaks greeting (using loaded instructions)
                    ↓
6. Routing check fires (platform-specific trigger)
   - SignalWire: After function call
   - LiveKit: On agent_speech_committed event
                    ↓
7. Agent checks: is_node_complete("greet", state)?
                    ↓
8. If complete → determine next node using routing logic
   - SignalWire: valid_contexts array + LLM intent
   - LiveKit: route_after_greet(state) Python function
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

### conversation_data JSONB Fields (Used by Both Platforms):

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
  "appointment_datetime": "2025-11-21T14:00:00",
  "appointment_id": null,
  "wrong_person": false,
  "right_person_available": false,
  "node_before_objection": "answer",
  "borderline_equity": false,
  "pending_birthday": false,
  "manual_booking_required": false
}
```

**New Flags (Nov 19):**
- `appointment_datetime`: Exact booking time for returning caller acknowledgment
- `borderline_equity`: Low net proceeds (< $20k), needs special handling
- `pending_birthday`: Close to 62nd birthday (< 3 months), pre-qualify
- `manual_booking_required`: Booking tool failed, broker needs to follow up

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

### 3. Backend: Agent Components (Dual Platform)

#### Component 3.1a: SignalWire SWML Bridge

**File:** `swaig-agent/main.py`

**Purpose:** FastAPI bridge that generates SWML responses with contexts for SignalWire.

**Key Features:**
- Receives POST from SignalWire at `/agent/barbara`
- Builds contexts from database via `services/contexts.py`
- Declares SWAIG functions via `function_includes`
- Returns SWML JSON with `prompt.contexts`
- Handles function execution and routing updates

**Code Snippet: SWML Response Generation**

```python
from fastapi import FastAPI, Request
from services.contexts import build_contexts_object
from services.database import get_lead_by_phone, get_conversation_state

app = FastAPI()

@app.post("/agent/barbara")
async def handle_agent_request(request: Request):
    """Main SWAIG endpoint - generates SWML with contexts"""
    body = await request.json()
    
    # Extract call info
    phone = body.get("call", {}).get("from")
    
    # Load lead and conversation state
    lead = get_lead_by_phone(phone)
    state = get_conversation_state(phone)
    
    # Determine starting node (or resume from state)
    current_node = "greet"
    if state and state.get("conversation_data"):
        cd = state["conversation_data"]
        if cd.get("appointment_booked"):
            current_node = "goodbye"
        elif cd.get("ready_to_book"):
            current_node = "book"
        elif cd.get("qualified") is not None:
            current_node = "answer"
    
    # Build contexts object from database
    contexts = build_contexts_object(
        vertical="reverse_mortgage",
        lead_context=lead,
        phone_number=phone,
        default_node=current_node
    )
    
    # Return SWML response
    return {
        "version": "1.0.0",
        "sections": {
            "main": [
                {
                    "ai": {
                        "prompt": {
                            "contexts": contexts  # SignalWire handles routing
                        },
                        "params": {
                            "end_of_speech_timeout": 800,
                            "attention_timeout": 30000
                        }
                    }
                }
            ]
        }
    }
```

**SWAIG Function Declaration:**

```python
# In main.py - declare all tools
native_functions = [
    "mark_ready_to_book",
    "mark_has_objection",
    "mark_objection_handled",
    "mark_wrong_person",
    "mark_quote_presented",
    "mark_qualification_result",
    "verify_caller_identity",
    "update_lead_info",
    "check_broker_availability",
    "book_appointment",
    "search_knowledge"
]

# Function specifications
function_specs = {
    "mark_ready_to_book": {
        "function": "mark_ready_to_book",
        "purpose": "Mark that caller is ready to schedule appointment",
        "argument": {
            "type": "object",
            "properties": {}
        }
    },
    # ... more function specs
}
```

**Function Execution:**

```python
@app.post("/function/{function_name}")
async def handle_function(function_name: str, request: Request):
    """Handle SWAIG function execution"""
    body = await request.json()
    phone = body.get("caller_id_num")
    
    # Route to appropriate handler
    if function_name == "mark_ready_to_book":
        from tools.flags import handle_mark_ready_to_book
        result = handle_mark_ready_to_book(phone)
    elif function_name == "book_appointment":
        from tools.booking import handle_book_appointment
        args = body.get("argument", {})
        result = handle_book_appointment(phone, **args)
    # ... more handlers
    
    # Return SWAIG response format
    return {
        "response": result.get("response", "Done"),
        "action": result.get("action", [])
    }
```

---

#### Component 3.1b: LiveKit Native Agents

**Files:** `livekit-agent/agents/*.py` (8 Agent classes), `livekit-agent/agent.py` (entrypoint)

**Purpose:** LiveKit native Agent system with automatic handoffs via tool returns.

**Key Features:**
- Each conversation node is a separate Agent class (e.g., `BarbaraGreetAgent`, `BarbaraVerifyTask`)
- Tools decorated with `@function_tool` return other Agent/Task instances for handoffs
- LiveKit automatically handles Agent handoffs when tools return Agent instances
- No manual routing code needed - LiveKit handles all transitions

**Code Snippet: Greet Agent (LiveKit)**

```python
from livekit.agents import Agent, function_tool, RunContext
from services.prompt_loader import load_node_config
from services.conversation_state import update_conversation_state, get_conversation_state

class BarbaraGreetAgent(Agent):
    """Barbara's greeting agent - establishes rapport and determines next step"""
    
    def __init__(self, caller_phone: str, lead_data: dict, vertical: str = "reverse_mortgage"):
        # Load from database (same as SignalWire)
        config = load_node_config("greet", vertical)
        instructions = config['instructions']
        
        super().__init__(instructions=instructions)
        self.caller_phone = caller_phone
        self.lead_data = lead_data
        self.vertical = vertical
    
    async def on_enter(self) -> None:
        """Called when agent takes control - deliver scripted greeting"""
        first_name = self.lead_data.get('first_name', 'there')
        self.session.generate_reply(
            instructions=f"Deliver your warm greeting to {first_name}."
        )
    
    @function_tool()
    async def mark_greeted(self, context: RunContext, reason_summary: str):
        """Mark caller as greeted and route to appropriate next step.
        
        Call this after caller has responded to your greeting.
        This tool checks the database to determine if verification/qualification
        are already complete from a previous call, and routes accordingly.
        """
        # Check database status
        state = get_conversation_state(self.caller_phone)
        conversation_data = (state.get('conversation_data', {}) if state else {})
        verified = conversation_data.get('verified', False)
        qualified = conversation_data.get('qualified', False)
        
        # Mark greeted with reason
        update_conversation_state(
            self.caller_phone,
            {"conversation_data": {"greeted": True, "greeting_reason": reason_summary}}
        )
        
        # Route based on CURRENT database state
        if verified and qualified:
            # Both complete - skip to main conversation
            from .answer import BarbaraAnswerAgent
            return BarbaraAnswerAgent(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                chat_ctx=self.chat_ctx
            )
        elif verified and not qualified:
            # Verified but not qualified - skip verify, run qualify
            from .qualify import BarbaraQualifyTask
            return BarbaraQualifyTask(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                chat_ctx=self.chat_ctx
            )
        else:
            # Not verified - run verification
            from .verify import BarbaraVerifyTask
            return BarbaraVerifyTask(
                caller_phone=self.caller_phone,
                lead_data=self.lead_data,
                vertical=self.vertical,
                chat_ctx=self.chat_ctx
            )
```

**Key Insight:** When `mark_greeted()` returns an Agent instance, LiveKit automatically hands off control to that Agent. No manual routing code needed!

**LiveKit Entrypoint:**

```python
# livekit-agent/agent.py
async def entrypoint(ctx: JobContext):
    """Main entrypoint - creates initial greet agent"""
    # ... phone extraction, lead lookup, component loading ...
    
    # Create initial greet agent
    initial_agent = BarbaraGreetAgent(
        caller_phone=caller_phone,
        lead_data=lead_data,
        vertical=vertical
    )
    
    # Create AgentSession
    session = AgentSession(
        stt=stt_instance,
        llm=llm_instance,
        tts=tts_instance,
        vad=vad,
        turn_detection=turn_detector
    )
    
    # Start with initial agent - LiveKit handles all handoffs automatically
    await session.start(agent=initial_agent, room=ctx.room)
    
    # Session runs until participant disconnect
    # All routing happens via tool returns
```

---

#### Component 3.2: Prompt Loader (Both Platforms)

**SignalWire File:** `swaig-agent/services/contexts.py`
**LiveKit File:** `livekit-agent/services/prompt_loader.py`

**Purpose:** Load node prompts from Supabase with context injection.

**Both platforms implement:**
1. `load_theme()` - Loads universal personality prompt for vertical
2. `load_node_prompt()` - Loads node-specific prompt and combines with theme
3. `build_context_injection()` - Builds call-specific context string
4. `build_instructions_for_node()` - Main function that combines all three layers

**Variable Substitution:**
- Both use Python `Template().safe_substitute()` for `{lead.first_name}` style variables
- Context injected as formatted text block between theme and node

**Code Snippet: Main Function (Same for Both)**

```python
def build_instructions_for_node(
    node_name: str,
    call_type: str = "inbound",
    lead_context: Optional[dict] = None,
    phone_number: Optional[str] = None,
    vertical: str = "reverse_mortgage"
) -> str:
    """Build complete instructions for a node (theme + context + node prompt)
    
    Returns:
        Complete prompt text ready for agent
    """
    # 1. Load node prompt (already includes theme)
    node_prompt_with_theme = load_node_prompt(node_name, vertical)
    
    # 2. Build context injection (if we have context)
    context = None
    if lead_context and phone_number:
        context = build_context_injection(call_type, lead_context, phone_number)
    
    # 3. Combine: Theme → Context → Node
    if context:
        if "\n---\n" in node_prompt_with_theme:
            theme_part, node_part = node_prompt_with_theme.split("\n---\n", 1)
            instructions = f"{theme_part}\n\n{context}\n\n---\n{node_part}"
        else:
            instructions = f"{node_prompt_with_theme}\n\n{context}"
    else:
        instructions = node_prompt_with_theme
    
    return instructions
```

**Final Prompt Structure (Both Platforms):**
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

---

#### Component 3.3: Node Completion Checker

**File:** `livekit-agent/workflows/node_completion.py`

**Purpose:** Determine if a node's goals have been met based on DB state using database-driven `step_criteria_lk` boolean expressions.

**How It Works:**
1. Loads `step_criteria_lk` (LiveKit-optimized boolean expression) from database for the current node
2. Falls back to legacy `step_criteria` field if `step_criteria_lk` is not populated (backward compatibility)
3. Evaluates expression against `conversation_data` using safe expression evaluator
4. Falls back to hardcoded logic if evaluation fails or no database criteria available (safety)
5. Supports turn counting, tool-based completion, and intent detection

**Code Snippet:**

```python
def is_node_complete(node_name: str, state: dict, vertical: str = "reverse_mortgage", use_db_criteria: bool = True, state_row: Optional[dict] = None) -> bool:
    """Check if current node goals are met based on DB state
    
    Now supports database-driven step_criteria_lk (LiveKit-optimized) evaluation 
    with fallback to legacy step_criteria and then hardcoded logic.
    """
    
    # Try to use database step_criteria_lk if available
    if use_db_criteria:
        try:
            from services.prompt_loader import load_node_config
            from workflows.step_criteria_evaluator import evaluate_step_criteria
            
            config = load_node_config(node_name, vertical)
            
            # Try LiveKit-optimized field first (new system)
            step_criteria_lk = config.get('step_criteria_lk', '').strip()
            
            # Fallback to legacy field if new one is empty (backward compatibility)
            if not step_criteria_lk:
                step_criteria_lk = config.get('step_criteria', '').strip()
                if step_criteria_lk:
                    logger.info(f"ℹ️ Node '{node_name}' using legacy 'step_criteria' field")
            
            if step_criteria_lk:
                # Evaluate step_criteria expression against conversation state
                result = evaluate_step_criteria(step_criteria_lk, state)
                logger.info(f"✅ Evaluated step_criteria for {node_name}: '{step_criteria_lk}' → {result}")
                evaluated_result = result
            else:
                evaluated_result = None
        except Exception as e:
            logger.warning(f"⚠️ step_criteria evaluation failed: {e}, using fallback")
            evaluated_result = None
    else:
        evaluated_result = None
    
    # Use evaluated result if available, otherwise fall back to hardcoded logic
    if evaluated_result is not None:
        result = evaluated_result
    else:
        # Fallback to hardcoded flag-based completion (existing behavior)
        completion_criteria = {
            "greet": lambda s: True,  # Fallback (should use step_criteria_lk)
            "verify": lambda s: s.get("verified") == True,
            "qualify": lambda s: s.get("qualified") != None,
            # ... etc
        }
        checker = completion_criteria.get(node_name)
        result = checker(state) if checker else False
    
    return result
```

**Step Criteria Expression Format:**

Expressions are stored in the database as text and evaluated safely. See `livekit-agent/workflows/STEP_CRITERIA_EXPRESSION_FORMAT.md` for full syntax reference.

**Examples:**
- `"greet_turn_count >= 2 OR greeted == True"` - GREET node requires 2+ turns
- `"verified == True"` - VERIFY node completes when verified flag set
- `"qualified != None OR has_objection == True"` - QUALIFY completes when qualified OR objection detected
- `"quote_presented == True OR has_objection == True"` - QUOTE completes when presented OR objection

**Benefits:**
- Database-driven: Change completion logic without code deployment
- Flexible: Supports turn counting, tool flags, complex conditions
- Safe: No code injection risk (custom parser, not eval())
- Resilient: Production-quality fallbacks ensure system never breaks (actual DB snapshot with LOUD ERROR logging)

---

#### Component 3.4: Tool-Based Routing (LiveKit Only)

**Note:** This section is historical - LiveKit now uses native Agent handoffs via tool returns instead of Python routers.

**Old System (Refactored Away):**
- Python routers (`route_after_greet()`, etc.) checked flags and returned node names
- Completion checkers (`is_node_complete()`) evaluated flags and step_criteria
- Manual transitions via `load_node()` + `session.generate_reply()`

**New System (Current):**
- Tools decorated with `@function_tool` return Agent/Task instances
- LiveKit automatically handles handoffs when tools return Agent instances
- No manual routing code needed - routing logic is in tool implementations

**Historical Reference: route_after_greet**

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

**Key Insight (Old System):** Routers were **dynamic** - they examined actual DB state, not hardcoded sequences. 

**New System Insight:** Tools are **dynamic** - they examine actual DB state and return appropriate Agent instances. This enables seniors' unpredictable behavior to be handled gracefully. LiveKit handles all transitions automatically via tool returns.

---

#### Component 3.5: State Flag Tools (Both Platforms)

**SignalWire File:** `swaig-agent/tools/flags.py`
**LiveKit File:** `livekit-agent/tools/flags.py`

**Purpose:** Allow the LLM to signal routing intent by setting flags in the database.

**Implementation Differences:**
- **SignalWire:** Returns `{response: str, action: []}` dictionary for SWAIG format
- **LiveKit:** Returns `str` for function calling format
- **Business Logic:** Identical - same database updates

**Code Snippet: mark_ready_to_book (Both Platforms)**

**SignalWire Version:**
```python
def handle_mark_ready_to_book(phone: str) -> dict:
    """Mark that the caller is ready to schedule an appointment."""
    logger.info(f"🎯 Marking caller ready to book: {phone}")
    
    update_conversation_state(phone, {
        "conversation_data": {
            "ready_to_book": True,
            "questions_answered": True
        }
    })
    
    return {
        "response": "Caller marked as ready to book.",
        "action": []  # SWAIG format
    }
```

**LiveKit Version:**
```python
@function_tool
async def mark_ready_to_book(phone: str) -> str:
    """Mark that the caller is ready to schedule an appointment."""
    logger.info(f"🎯 Marking caller ready to book: {phone}")
    
    update_conversation_state(phone, {
        "conversation_data": {
            "ready_to_book": True,
            "questions_answered": True
        }
    })
    
    return "Caller marked as ready to book."
```

**Available Tools (Both Platforms):**
1. `mark_ready_to_book(phone)` - Caller wants to book
2. `mark_has_objection(phone, current_node)` - Caller has concerns
3. `mark_objection_handled(phone)` - Objection resolved
4. `mark_questions_answered(phone)` - All questions answered (DEPRECATED)
5. `mark_quote_presented(phone, quote_reaction)` - Quote presented with reaction
6. `mark_qualification_result(phone, qualified, reason)` - Set qualification status
7. `mark_wrong_person(phone, right_person_available)` - Wrong person answered
8. `clear_conversation_flags(phone)` - Reset routing flags (DEPRECATED)

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
| **SignalWire SWML Bridge** |
| `swaig-agent/main.py` | FastAPI SWAIG bridge + SWML generation |
| `swaig-agent/services/contexts.py` | Build contexts from database |
| `swaig-agent/services/database.py` | Supabase client + node configs |
| `swaig-agent/tools/flags.py` | State flag handlers (SWAIG format) |
| `swaig-agent/tools/lead.py` | Lead management handlers |
| `swaig-agent/tools/booking.py` | Calendar integration handlers |
| `swaig-agent/tools/knowledge.py` | Vector search handler |
| **LiveKit Agent** |
| `livekit-agent/agent.py` | BarbaraAgent class + routing hooks |
| `livekit-agent/services/prompt_loader.py` | DB query + context injection |
| `livekit-agent/workflows/node_completion.py` | Completion criteria checkers (now uses step_criteria from DB) |
| `livekit-agent/workflows/step_criteria_evaluator.py` | Safe expression evaluator for step_criteria |
| `livekit-agent/workflows/STEP_CRITERIA_EXPRESSION_FORMAT.md` | Expression syntax reference |
| `livekit-agent/workflows/routers.py` | 8 dynamic routing functions |
| `livekit-agent/tools/flags.py` | State flag tools (@function_tool) |
| `livekit-agent/tools/lead.py` | Lead lookup + verification |
| `livekit-agent/tools/calendar.py` | Appointment booking |
| `livekit-agent/tools/knowledge.py` | Vector search |
| **Shared/Portal** |
| `portal/src/views/admin/Verticals.vue` | Node editor UI (dual platform tabs) |
| `database/migrations/20251111_add_theme_prompts.sql` | Theme table creation |
| `database/migrations/20251111_add_quote_node_prompt.sql` | QUOTE node creation |
| `database/migrations/20251111_strip_personality_from_nodes.sql` | Personality removal |

---

## Summary

**BarbGraph** transforms voice AI conversations from chaotic monologues into structured, adaptive dialogues. By breaking conversations into 8 focused stages, using a universal theme for personality consistency, persisting state in a database, and dynamically routing based on actual behavior, it delivers:

- **Better Caller Experience:** Natural, progressive conversations that adapt to their needs
- **Higher Conversion:** Structured flow ensures no critical steps are skipped
- **Easier Maintenance:** Edit one node without breaking the entire system
- **Multi-Call Support:** Pick up where you left off, no matter when you call back
- **Scalability:** Same architecture works across all business verticals
- **Platform Flexibility:** Works on both SignalWire SWML and LiveKit Agents (different implementations)
- **A/B Testing:** Compare platforms with database-informed routing for cost/performance optimization
- **Risk Mitigation:** One platform down, the other continues serving calls
- **Production-Grade Resilience:** Fallbacks use actual DB snapshot (2025-11-21) with LOUD ERROR logging to ensure system never crashes and problems are impossible to miss

Whether you're a business owner looking to improve call quality or a developer building conversational AI, BarbGraph provides the foundation for world-class voice agent experiences with the flexibility to choose or switch platforms as needed.

---

## Maintaining Both Platforms via Vue Portal

**File:** `portal/src/views/admin/Verticals.vue`

### Overview

The Vue Portal provides unified management for both SignalWire and LiveKit platforms. Both platforms share the same prompt database but have separate AI model configurations.

### Shared Configuration (Both Platforms)

**Theme & Prompts Tab:**
- ✅ **Theme Editor** - Universal personality per vertical (shared by both platforms)
- ✅ **8-Node Prompt Editor** - Instructions, tools, valid_contexts (shared by both platforms)
- ✅ **Tool Selection** - Multi-select dropdown for available tools per node (shared)
- ✅ **AI Helper** - Generate prompts via GPT-4o-mini (shared)
- ✅ **Variable Insertion** - Add `{lead.first_name}` style variables (shared)
- ✅ **Version Control** - Draft/publish workflow (shared)

**What's Shared:**
- `theme_prompts` table - Both platforms load same theme
- `prompts` / `prompt_versions` table - Both platforms load same node instructions
- `conversation_state` table - Both platforms update same flags
- `valid_contexts` arrays - Both platforms respect same routing rules
- Tool definitions - Both platforms use same tool names (backward compatible)

**Impact of Changes:**
- ✅ Editing prompts in Vue Portal → Both platforms use updated prompts on next call
- ✅ Changing valid_contexts → Both platforms respect new routing rules
- ✅ Adding tools to node → Both platforms have access to tool
- ✅ No code deploy needed for prompt/instruction changes

### Platform-Specific Configuration

**Models & Voice Tab:**

The Models & Voice tab has **two sub-tabs** for platform-specific AI configuration:

**1. SignalWire Tab:**
- ✅ **LLM Model** - Select from `signalwire_available_llm_models` (e.g., "gpt-4o-mini", "gpt-4.1-mini")
- ✅ **STT Model** - Select from `signalwire_available_stt_models` (e.g., "deepgram:nova-3", "assemblyai:universal-streaming")
- ✅ **TTS Engine** - Select provider (ElevenLabs, OpenAI, Google Cloud, Amazon Polly, Azure, Cartesia, Rime)
- ✅ **Voice Name** - Select voice from `signalwire_available_voices` (e.g., "elevenlabs.rachel", "amazon.Joanna:neural:en-US")
- ✅ **Language Code** - Select language (en-US, es-US, es-MX)
- ✅ **Saves to:** `agent_voice_config` table
- ✅ **Live Reload:** SignalWire agent loads active models from database on each call

**2. LiveKit Tab:**
- ✅ **Model Type Selector** - Choose between:
  - **Pipeline Mode** - Separate STT + LLM + TTS (recommended)
  - **OpenAI Realtime** - Unified model with built-in STT/TTS
  - **Gemini Live** - Google's unified realtime model
- ✅ **Pipeline Mode Configuration:**
  - **STT Model** - Select from `livekit_available_stt_models` (e.g., "deepgram/nova-3:en", "assemblyai/universal-streaming:multi")
  - **LLM Model** - Select from `livekit_available_llm_models` (e.g., "openai/gpt-4o", "anthropic/claude-3-5-sonnet-20241022")
  - **TTS Voice** - Select from `livekit_available_voices` (e.g., "elevenlabs/eleven_turbo_v2_5:EXAVITQu4vr4xnSDxMaL")
  - **Custom Voice Support** - If custom ElevenLabs voice selected, uses plugin with user's API key
- ✅ **Realtime Mode Configuration:**
  - **Realtime Model** - Select from `livekit_available_realtime_models` (e.g., "gpt-4o-realtime-preview", "gemini-2.0-flash-exp")
  - **Voice** - Model-specific voice selection
  - **Temperature** - LLM temperature (0.6-1.2 for OpenAI, 0-2 for Gemini)
  - **Modalities** - Audio, text, or both
  - **Turn Detection** - Server VAD or semantic turn detection
- ✅ **Saves to:** `ai_templates` table (one active template per vertical)
- ✅ **Live Reload:** LiveKit agent loads active template from database on each call

**What's Separate:**
- SignalWire uses `agent_voice_config` table (simple TTS configuration)
- LiveKit uses `ai_templates` table (complex STT/LLM/TTS/VAD configuration)
- Different model catalogs (`signalwire_*` vs `livekit_*` tables)
- Different model formats (SignalWire uses colon format "deepgram:nova-3", LiveKit uses slash format "deepgram/nova-3:en")

### How to Maintain Both Platforms

**1. Editing Prompts (Shared):**
- Navigate to **Theme & Prompts** tab
- Edit theme or node prompts
- Changes affect **both platforms immediately** on next call
- No code deploy needed

**2. Changing Routing Rules (Shared):**
- Edit `valid_contexts` array in node prompt
- Changes affect **both platforms immediately**
- Both platforms respect same routing rules (implemented differently)

**3. Configuring SignalWire AI Models:**
- Navigate to **Models & Voice** tab
- Click **SignalWire** sub-tab
- Select LLM, STT, TTS models from dropdowns
- Click "Save SignalWire Configuration"
- Changes take effect on **next SignalWire call**

**4. Configuring LiveKit AI Models:**
- Navigate to **Models & Voice** tab
- Click **LiveKit** sub-tab
- Select model type (Pipeline, OpenAI Realtime, or Gemini Live)
- Configure models for selected type
- Click "Save LiveKit Configuration"
- Changes take effect on **next LiveKit call**

**5. Testing Changes:**
- Use **Test Full Vertical** button (browser-based WebRTC test)
- Or make test call via SignalWire phone number
- Both platforms load same prompts, different AI models

**Key Differences Summary:**

| Aspect | SignalWire | LiveKit |
|--------|-----------|---------|
| **Routing** | LLM-driven (SignalWire chooses from valid_contexts) | Tool-driven (tools return Agent instances) |
| **Prompts** | Same database (shared) | Same database (shared) |
| **AI Models** | `agent_voice_config` table | `ai_templates` table |
| **Model Format** | Colon format (`deepgram:nova-3`) | Slash format (`deepgram/nova-3:en`) |
| **Tool Format** | SWAIG functions (`{response, action}`) | `@function_tool` decorators (returns `str` or `Agent`) |
| **Update Method** | Edit in Vue → Database → Next call | Edit in Vue → Database → Next call |
| **Code Deploy** | Not needed for prompts | Not needed for prompts |
| **Code Deploy** | Needed for tool changes | Needed for tool changes |

---

**Questions?** Contact the dev team or consult the implementation docs:
- `MASTER_PRODUCTION_PLAN.md` - Complete system overview (Nov 22 dual platform update)
- `BARBGRAPH_SYSTEM_VERIFICATION.md` - System verification results
- `THEME_AND_QUOTE_IMPLEMENTATION_COMPLETE.md` - Theme system + QUOTE node
- `docs/conversation_flags.md` - All conversation flags documented
- `prompts/rewrite/trace_test.md` - 13 test scenarios with routing improvements

