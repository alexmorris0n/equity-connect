# Context Narrative Injection - What It Is & Why We Use It

## What Is Context Narrative?

**Context narrative** is a technique where we format call-specific information (lead name, property, broker, etc.) as **natural, story-like instructions** that the LLM can easily understand and use, rather than dumping raw data.

### Example Output

Instead of this (data dump):
```
lead_name: "Testy Mctesterson"
lead_id: "07f26a19-e9dc-422c-b61d-030e3c7971bb"
property_city: "Inglewood"
property_state: "CA"
estimated_equity: 1000000
qualified: true
broker_name: "Walter Richards"
```

We format it like this (narrative):
```
=== CALL CONTEXT ===

You are answering an INBOUND call from Testy Mctesterson.

ABOUT TESTY:
- Full name: Testy Mctesterson (use "Testy" in conversation)
- Phone: +16505300051
- Email: alex@amorrison.email

TESTY'S PROPERTY:
- Location: Inglewood, CA
- Estimated equity: $1,000,000

QUALIFICATION STATUS:
- Testy is ALREADY QUALIFIED. Skip qualification questions.

ASSIGNED BROKER:
- Broker: Walter Richards from My Reverse Mortgage
- When Testy is ready to book, schedule with Walter Richards.

Use these facts naturally in conversation. If asked about their property, broker, or status, reference this information.

===================
```

## Why We Use Narrative Format

### 1. **LLMs Understand Stories Better Than Data**

LLMs are trained on natural language, not structured data. When you say:
- ❌ **Data dump**: `lead_name: "Testy Mctesterson"` → LLM might ignore it or not know how to use it
- ✅ **Narrative**: `"You are answering an INBOUND call from Testy Mctesterson."` → LLM immediately understands the situation

### 2. **Provides Situational Awareness**

The narrative tells the LLM:
- **What's happening**: "You are answering an INBOUND call..."
- **Who they're talking to**: "Testy Mctesterson"
- **What they know**: "Testy is ALREADY QUALIFIED"
- **What to do**: "Skip qualification questions" or "Ask qualification questions"

### 3. **Adapts Same Node Prompt to Different Scenarios**

Without context narrative, you'd need separate prompts for:
- Inbound vs outbound calls
- Qualified vs unqualified leads
- Known vs unknown callers
- With broker vs without broker

With context narrative, **one node prompt** adapts to all scenarios because the context tells the LLM how to adjust its behavior.

### 4. **Prevents "I Don't Know" Responses**

Before context narrative, Barbara would say:
- ❌ "I don't have your name yet" (even though it's in the database)
- ❌ "I don't know your property details" (even though we have them)

With context narrative, Barbara knows:
- ✅ "Hi Testy! I see you're calling from Inglewood, CA..."
- ✅ "I can see you're already qualified, so let's skip those questions..."

### 5. **Natural Integration with Conversation**

The narrative format makes it easy for the LLM to:
- Reference facts naturally: "I see your property is in Inglewood..."
- Use the right name: "Testy" instead of "Testy Mctesterson"
- Know what to skip: "Since you're already qualified..."
- Know who to book with: "I'll schedule you with Walter Richards..."

## How It Works

### The 3-Layer Prompt Structure

```
┌─────────────────────────────────────┐
│ 1. THEME (Static)                   │
│    - Barbara's core personality     │
│    - Speaking style                 │
│    - Core rules                     │
│    - Values                         │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ 2. CONTEXT (Dynamic, Per-Call)     │
│    - Call direction                 │
│    - Lead information               │
│    - Property details               │
│    - Qualification status           │
│    - Broker assignment              │
│    ← THIS IS THE NARRATIVE PART     │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ 3. NODE PROMPT (Static, Per-Node)   │
│    - Role in this stage             │
│    - Instructions for this node     │
│    - Available tools                │
└─────────────────────────────────────┘
```

### Code Flow

1. **Agent receives call** → `on_swml_request()` in `barbara_agent.py`
2. **Looks up lead** → Queries Supabase for lead data by phone number
3. **Builds context narrative** → `build_context_injection()` in `prompt_loader.py`
4. **Combines everything** → `build_instructions_for_node()` merges:
   - Theme (from database)
   - Context narrative (dynamically built)
   - Node prompt (from database)
5. **Sends to LLM** → `agent.set_prompt_text(instructions)`

## Real Example from Logs

From your test call logs:

```
✅ Loaded theme for reverse_mortgage: 695 chars
📋 Built context injection: 639 chars (name: Testy Mctesterson)
📋 Context injection preview: === CALL CONTEXT ===

You are answering an INBOUND call from Testy Mctesterson.

ABOUT TESTY:
- Full name: Testy Mctesterson (use "Testy" in conversation)
- Phone: +16505300051
- Email: alex@amorrison.email

TESTY'S PROPERTY:
- Location: Inglewood, CA
- Estimated equity: $1,000,000

QUALIFICATION STATUS:
- Testy is ALREADY QUALIFIED. Skip qualification questions.

ASSIGNED BROKER:
- Broker: Walter Richards from My Reverse Mortgage
- When Testy is ready to book, schedule with Walter Richards.
```

## Benefits Summary

| Before (Data Dump) | After (Narrative) |
|-------------------|-------------------|
| LLM doesn't know how to use raw data | LLM understands the situation immediately |
| "I don't have your name" responses | "Hi Testy!" responses |
| Separate prompts for each scenario | One prompt adapts to all scenarios |
| Hard to reference facts naturally | Easy to weave facts into conversation |
| Context feels disconnected | Context feels integrated |

## Key Takeaway

**Context narrative transforms database fields into actionable instructions** that the LLM can immediately understand and use in conversation. It's the difference between giving someone a spreadsheet vs. telling them a story about the situation.

