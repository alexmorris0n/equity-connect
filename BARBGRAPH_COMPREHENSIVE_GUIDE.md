# BarbGraph: Event-Based Conversation Routing System

**Version:** 1.0  
**Last Updated:** November 11, 2025  
**Status:** ✅ Production Ready

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
3. **Qualify** - Check if they're a good fit
4. **Quote** - Show them financial estimates
5. **Answer** - Address their questions
6. **Objections** - Handle concerns
7. **Book** - Schedule an appointment
8. **Exit** - Say goodbye gracefully

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

- **Node:** A conversation stage with specific goals (e.g., "Greet", "Qualify")
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

Imagine Barbara is a tour guide taking callers through a museum with 7 rooms:

1. **Lobby (Greet):** Welcome the visitor, introduce yourself
2. **Security (Verify):** Check ID, get visitor badge
3. **Assessment (Qualify):** "Are you interested in Egyptian artifacts or Renaissance art?"
4. **Information Desk (Answer):** Answer specific questions about exhibits
5. **Guest Relations (Objections):** Handle concerns ("Is the museum wheelchair accessible?")
6. **Ticket Booth (Book):** Reserve a guided tour time
7. **Exit (Exit):** Thank them for visiting, show them out

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
│  • 7-node tab navigation (greet, verify, qualify, etc.)     │
│  • JSONB content editor (role, personality, instructions)   │
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
- **JSONB Content Editor:** 4 fields per node:
  - `role` - Who is Barbara in this stage?
  - `personality` - How should she sound?
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
    personality: currentVersion.value.content.personality || '',
    instructions: currentVersion.value.content.instructions || '',
    tools: currentVersion.value.content.tools 
      ? currentVersion.value.content.tools.split(',').map(t => t.trim()) 
      : []
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

#### Theme Prompts System

BarbGraph uses a two-layer prompt system:

1. **Theme Layer (Universal):** Defines Barbara's core personality for the entire vertical
2. **Node Layer (Specific):** Defines actions and goals for each conversation stage

**Why Separate Themes?**
- Eliminates duplication (personality defined once, not 8 times)
- Easy to maintain (update personality in one place)
- Consistency (all nodes use same core personality)
- Flexibility (different verticals can have different personalities)

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

**Prompt Injection Order:**

```
Theme (from theme_prompts)
  ↓
Call Context (injected by agent)
  ↓
Node Prompt (from prompt_versions)
  ↓
Final Combined Prompt
```

**Example Combined Prompt:**

```
# Barbara - Core Personality
[theme content here]

---

=== CALL CONTEXT ===
Call Type: inbound-qualified
...

---

## Role
[node-specific role]

## Instructions
[node-specific instructions]
```

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

#### Component 3.1: EquityConnectAgent Class

**File:** `livekit-agent/agent.py`

**Purpose:** Custom Agent subclass that implements event-based routing.

**Key Features:**
- Inherits from `livekit.agents.Agent`
- Stores: `phone_number`, `vertical`, `call_type`, `lead_context`, `current_node`
- Manages node transitions and routing checks
- Hooks into `agent_speech_committed` event

**Code Snippet: Agent Class**

```python
class EquityConnectAgent(Agent):
    """Voice agent with event-based node routing"""
    
    def __init__(
        self, 
        instructions: str, 
        phone_number: str, 
        vertical: str = "reverse_mortgage",
        call_type: str = "inbound-unknown",
        lead_context: dict = None
    ):
        super().__init__(
            instructions=instructions,
            tools=all_tools,
        )
        self.phone = phone_number
        self.vertical = vertical
        self.call_type = call_type
        self.lead_context = lead_context or {}
        self.current_node = "greet"
        self.session = None  # Set after AgentSession creates it
    
    async def on_enter(self):
        """Agent joins - start with greet node"""
        logger.info("🎤 Agent joined - loading greet node")
        await self.load_node("greet", speak_now=True)
    
    async def load_node(self, node_name: str, speak_now: bool = False):
        """Load node prompt and optionally trigger immediate speech"""
        logger.info(f"📍 Loading node: {node_name} (vertical={self.vertical})")
        
        # Load prompt from database or file
        node_prompt = load_node_prompt(node_name, vertical=self.vertical)
        
        # Inject call context for situational awareness
        context = build_context_injection(
            call_type=self.call_type,
            lead_context=self.lead_context,
            phone_number=self.phone
        )
        
        # Prepend context to node prompt
        full_prompt = context + "\n\n" + node_prompt
        
        self.current_node = node_name
        self.instructions = full_prompt  # CRITICAL: Persist to Agent
        
        # If speak_now, generate immediate response
        if speak_now and self.session:
            await self.session.generate_reply(instructions=full_prompt)
    
    async def check_and_route(self):
        """Check if we should transition to next node"""
        logger.info(f"🔍 Routing check from node: {self.current_node}")
        
        # Get conversation state from DB
        state_row = get_conversation_state(self.phone)
        if not state_row:
            return
        
        # Extract conversation_data (contains flags)
        state = state_row.get("conversation_data", {})
        
        # Check if current node is complete
        if not is_node_complete(self.current_node, state):
            logger.info(f"⏳ Node '{self.current_node}' not complete yet")
            return
        
        # Route to next node
        next_node = self.route_next(state_row, state)
        logger.info(f"🧭 Router: {self.current_node} → {next_node}")
        
        if next_node == "END":
            if self.session:
                await self.session.generate_reply(
                    instructions="Say a warm goodbye and thank them for their time."
                )
        elif next_node != self.current_node:
            await self.load_node(next_node, speak_now=False)
    
    def route_next(self, state_row: dict, conversation_data: dict) -> str:
        """Determine next node based on current node and DB state"""
        state = {
            "phone_number": self.phone,
            "lead_id": state_row.get("lead_id"),
            "qualified": state_row.get("qualified"),
        }
        
        # Call appropriate router function
        if self.current_node == "greet":
            return route_after_greet(state)
        elif self.current_node == "verify":
            return route_after_verify(state)
        elif self.current_node == "qualify":
            return route_after_qualify(state)
        elif self.current_node == "answer":
            return route_after_answer(state)
        elif self.current_node == "objections":
            return route_after_objections(state)
        elif self.current_node == "book":
            return route_after_book(state)
        elif self.current_node == "exit":
            return route_after_exit(state)
        else:
            return "END"
```

**Event Hook in Entrypoint:**

```python
# Create agent with phone number for event-based routing
agent = EquityConnectAgent(
    instructions=instructions,
    phone_number=caller_phone,
    vertical=vertical,
    call_type=call_type,
    lead_context=lead_context or {}
)

session = AgentSession(
    stt=stt_string,
    llm=llm_string,
    tts=tts_string,
    # ... other config
)

# Link session to agent
agent.session = session

# Hook routing checks after each agent turn
@session.on("agent_speech_committed")
async def on_agent_finished_speaking():
    """Agent finished speaking - check if we should route"""
    await agent.check_and_route()

# Start the session
await session.start(agent=agent, room=ctx.room)
```

---

#### Component 3.2: Prompt Loader

**File:** `livekit-agent/services/prompt_loader.py`

**Purpose:** Load node prompts from Supabase with file fallback + context injection.

**Code Snippet:**

```python
def load_node_prompt(node_name: str, vertical: str = "reverse_mortgage") -> str:
    """Load node prompt from database or fallback to markdown file"""
    
    # TRY DATABASE FIRST
    try:
        sb = get_supabase_client()
        result = sb.rpc('get_node_prompt', {
            'p_vertical': vertical,
            'p_node_name': node_name
        }).execute()
        
        if result.data and len(result.data) > 0:
            content = result.data[0].get('content', {})
            
            # Build prompt from JSONB fields
            prompt_parts = []
            if content.get('role'):
                prompt_parts.append(f"## Role\n{content['role']}\n")
            if content.get('personality'):
                prompt_parts.append(f"## Personality\n{content['personality']}\n")
            if content.get('instructions'):
                prompt_parts.append(f"## Instructions\n{content['instructions']}")
            
            if prompt_parts:
                prompt = "\n".join(prompt_parts)
                logger.info(f"✅ Loaded {node_name} from database (vertical={vertical})")
                return prompt
            else:
                logger.warning(f"Database returned empty content for {node_name}/{vertical}")
    
    except Exception as e:
        logger.warning(f"Failed to load from database: {e}, falling back to file")
    
    # FALLBACK TO FILE
    module_dir = os.path.dirname(__file__)
    prompt_path = os.path.join(module_dir, "..", "prompts", vertical, "nodes", f"{node_name}.md")
    prompt_path = os.path.abspath(prompt_path)
    
    try:
        with open(prompt_path, 'r') as f:
            return f.read()
    except FileNotFoundError:
        return f"You are in the {node_name} phase. Continue naturally."


def build_context_injection(call_type: str, lead_context: dict, phone_number: str) -> str:
    """Build context string to inject before node prompt"""
    
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
        
        if lead_context.get("property_address"):
            context_parts.append(f"Property: {lead_context['property_address']}")
        if lead_context.get("estimated_equity"):
            context_parts.append(f"Est. Equity: ${lead_context['estimated_equity']:,}")
    else:
        context_parts.append("Lead Status: Unknown (new caller)")
    
    context_parts.append("===================\n")
    return "\n".join(context_parts)
```

---

#### Component 3.3: Node Completion Checker

**File:** `livekit-agent/workflows/node_completion.py`

**Purpose:** Determine if a node's goals have been met based on DB state.

**Code Snippet:**

```python
def is_node_complete(node_name: str, state: dict) -> bool:
    """Check if current node goals are met based on DB state"""
    
    completion_criteria = {
        "greet": lambda s: s.get("greeted") == True,
        "verify": lambda s: s.get("verified") == True,
        "qualify": lambda s: s.get("qualified") != None,
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

**File:** `livekit-agent/workflows/routers.py`

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
            logger.info("✅ Already verified and qualified → ANSWER")
            return "answer"
        else:
            logger.info("✅ Verified, not qualified → QUALIFY")
            return "qualify"
    
    # Default: verify identity
    logger.info("🔍 Not verified → VERIFY")
    return "verify"
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

**File:** `livekit-agent/tools/conversation_flags.py`

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
2. `mark_has_objection(phone, current_node)` - Caller has concerns
3. `mark_objection_handled(phone)` - Objection resolved
4. `mark_questions_answered(phone)` - All questions answered
5. `mark_wrong_person(phone, right_person_available)` - Wrong person answered
6. `clear_conversation_flags(phone)` - Reset routing flags (new call)

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
  └─ route_after_qualify(state) → "answer" (qualified)
  ↓
📍 load_node("answer", speak_now=False)
  ↓
💬 "That's great! You qualify for our program. What questions can I answer?"
```

---

### Example 3: Objection Interrupt

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
       DB stores: qualified=true, quote_presented=true, questions_answered=true, ready_to_book=false

Day 7: Same caller calls back
       → Agent loads conversation_state
       → Skips Greet/Verify/Qualify/Quote (already complete)
       → Jumps to Answer: "Hi John! Have you had time to think it over?"
```

**Use Case 2: Spouse Handoff**
```
Call 1: Wife answers (wrong person) → Exit
        DB stores: wrong_person=true, right_person_available=true
        → Agent asks to speak with husband
        → Wife passes phone
        → Router detects right_person_available → Re-greet husband
```

**Use Case 3: Objection During Qualification**
```
Qualify node: "Are you 62+ years old?"
Caller: "Why does that matter? Are you discriminating by age?"
→ LLM detects objection → Calls mark_has_objection()
→ Router transitions to Objections node
→ Agent addresses concern
→ Router returns to Qualify node (node_before_objection)
→ Conversation resumes naturally
```

**Use Case 4: Multi-Vertical Platform**
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
| `livekit-agent/agent.py` | EquityConnectAgent class + event hooks |
| `livekit-agent/services/prompt_loader.py` | DB query + context injection |
| `livekit-agent/workflows/node_completion.py` | Completion criteria checkers |
| `livekit-agent/workflows/routers.py` | 7 dynamic routing functions |
| `livekit-agent/tools/conversation_flags.py` | 6 state flag tools |
| `livekit-agent/tools/lead.py` | Lead lookup + verification tools |
| `livekit-agent/tools/calendar.py` | Appointment booking tools |
| `portal/src/views/admin/PromptManagement.vue` | Node editor UI |
| `database/migrations/20251111_add_vertical_node_to_prompts.sql` | Schema update |
| `database/migrations/20251111_create_node_prompts.sql` | Initial prompt seeding |

---

## Summary

**BarbGraph** transforms voice AI conversations from chaotic monologues into structured, adaptive dialogues. By breaking conversations into focused stages, persisting state in a database, and dynamically routing based on actual behavior, it delivers:

- **Better Caller Experience:** Natural, progressive conversations that adapt to their needs
- **Higher Conversion:** Structured flow ensures no critical steps are skipped
- **Easier Maintenance:** Edit one node without breaking the entire system
- **Multi-Call Support:** Pick up where you left off, no matter when you call back
- **Scalability:** Same architecture works across all business verticals

Whether you're a business owner looking to improve call quality or a developer building conversational AI, BarbGraph provides the foundation for world-class voice agent experiences.

---

**Questions?** Contact the dev team or consult the implementation docs:
- `BARBGRAPH_INTEGRATION_FIXES_COMPLETE.md` - Bug fixes log
- `EVENT_BASED_STATE_MACHINE_IMPLEMENTATION.md` - Backend implementation
- `PLAN_3_EXECUTION_COMPLETE.md` - Frontend implementation
- `DATABASE_FIELD_MAPPING_VERIFICATION.md` - Schema reference

