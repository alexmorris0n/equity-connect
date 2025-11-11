# Event-Based State Machine Implementation

**Date:** November 11, 2025  
**Status:** ✅ COMPLETE

## Overview

Successfully replaced LangGraph orchestration with a simple event-driven state machine that routes between conversation nodes based on database state and agent turn completion.

## Architecture

- **Turn-based conversation:** LiveKit `AgentSession` handles STT → LLM → TTS pipeline
- **Event-driven routing:** `agent_speech_committed` event triggers node transition checks
- **DB state flags:** Tools set completion flags (greeted, verified, qualified, etc.) to trigger routing
- **Manual prompt swapping:** Node prompts loaded from `prompts/{vertical}/nodes/{node}.md` files
- **Conversation history preservation:** Only system instructions change between nodes, full conversation context maintained

## Implementation Summary

### 1. ✅ Created Node Completion Checker

**File:** `livekit-agent/workflows/node_completion.py` (NEW)

- Function: `is_node_complete(node_name: str, state: dict) -> bool`
- Checks DB state flags to determine if a node's goals are met
- 7 nodes supported: greet, verify, qualify, answer, objections, book, exit

### 2. ✅ Created Prompt Loader Service

**File:** `livekit-agent/services/prompt_loader.py` (NEW)

- Function: `load_node_prompt(node_name: str, vertical: str) -> str`
- Loads node-specific prompts from markdown files (`prompts/{vertical}/nodes/{node}.md`)
- Function: `build_context_injection(call_type, lead_context, phone_number) -> str`
- Builds situational context to prepend to prompts for call-type awareness

### 3. ✅ Updated Tools to Set Completion Flags

**File:** `livekit-agent/tools/lead.py`

- `get_lead_context()`: Now calls `update_conversation_state()` to set:
  - `verified=True` (triggers routing from verify node)
  - `greeted=True` (marks greet complete)
  - `qualified=<bool>` (based on lead status)

- `verify_caller_identity()` (NEW): 
  - Verifies caller by name and phone
  - Creates new lead if not found
  - Sets `verified=True`, `greeted=True`, `is_new_lead=True`

**File:** `livekit-agent/tools/calendar.py`

- `book_appointment()`: Now calls `update_conversation_state()` to set:
  - `appointment_booked=True`
  - `appointment_id=<nylas_event_id>`

### 4. ✅ Extended Agent Class with Node Routing

**File:** `livekit-agent/agent.py`

Replaced simple `EquityConnectAgent` with event-based routing version:

**New attributes:**
- `phone`: Caller's phone number (for state lookups)
- `current_node`: Current conversation node
- `session`: Reference to AgentSession (for generate_reply)

**New methods:**
- `on_enter()`: Called when agent joins, loads greet node and speaks first
- `load_node(node_name, speak_now)`: Loads node prompt from file, updates instructions
- `check_and_route()`: Checks DB state, determines if node is complete, routes to next node
- `route_next(state_row, conversation_data)`: Uses existing router functions (from `workflows/routers.py`)

**Key insight:** Only system instructions change between nodes. Conversation history (messages, tool calls) is preserved automatically by `AgentSession`.

### 5. ✅ Hooked Event-Based Routing in Entrypoint

**File:** `livekit-agent/agent.py` (entrypoint function)

Added event hook after `AgentSession` creation:

```python
# Link session to agent
agent.session = session

# Hook routing checks after each agent turn
@session.on("agent_speech_committed")
async def on_agent_finished_speaking():
    """Agent finished speaking - check if we should route"""
    await agent.check_and_route()
```

Agent creation now passes phone number:

```python
agent = EquityConnectAgent(
    instructions=instructions,
    phone_number=caller_phone or "unknown"
)
```

### 6. ✅ Updated Tools Module Exports

**File:** `livekit-agent/tools/__init__.py`

Added `verify_caller_identity` to:
- Import list
- `__all__` list
- `all_tools` list

## Routing Strategy

### Dynamic, Adaptive Routing

**CRITICAL:** Routing is NOT fixed. All 7 nodes are ALWAYS available. The router examines actual DB state to decide where to go next.

**Examples:**
- Senior says "my spouse handles this" → greet (re-greet spouse)
- Senior asks question mid-qualify → answer (skip ahead)
- Objection comes up during answer → objections
- Ready to book anytime → book
- Wrong person → exit

### Node Completion Criteria

| Node | Completion Flag |
|------|----------------|
| greet | `greeted == True` |
| verify | `verified == True` |
| qualify | `qualified != None` |
| answer | `questions_answered OR ready_to_book` |
| objections | `objection_handled == True` |
| book | `appointment_booked == True` |
| exit | Always true (ends conversation) |

### Existing Routers Used

Located in `livekit-agent/workflows/routers.py`:

- `route_after_greet(state)` → verify, qualify, answer, exit, or greet (re-greet)
- `route_after_verify(state)` → qualify, exit, or greet (spouse available)
- `route_after_qualify(state)` → answer or exit
- `route_after_answer(state)` → answer, objections, book, or exit
- `route_after_objections(state)` → answer, objections, book, or exit
- `route_after_book(state)` → exit or answer (booking failed)

## Files Changed

1. ✅ `livekit-agent/workflows/node_completion.py` - NEW (node completion checker)
2. ✅ `livekit-agent/services/prompt_loader.py` - NEW (prompt loader service)
3. ✅ `livekit-agent/tools/lead.py` - Modified (added state flags + verify_caller_identity tool)
4. ✅ `livekit-agent/tools/calendar.py` - Modified (added appointment_booked flag)
5. ✅ `livekit-agent/tools/__init__.py` - Modified (exported verify_caller_identity)
6. ✅ `livekit-agent/agent.py` - Modified (EquityConnectAgent class + event hooks)

## Files Preserved

- ✅ `livekit-agent/workflows/routers.py` - Still used for routing logic
- ✅ `prompts/*/nodes/*.md` - Node prompt files (to be created)
- ✅ `livekit-agent/services/conversation_state.py` - State management service

## Files Archived (Optional)

To be moved to `livekit-agent/workflows/archived/`:

- `conversation_graph.py` - LangGraph implementation (temporarily removed)
- `conversation_graph_simple.py` - Simple LangGraph mode (temporarily removed)
- `state.py` - LangGraph state definition (if not used by routers)

## Testing Strategy

### Test 1: Single Node (Greet)

1. Make inbound call
2. Verify agent greets first
3. Check logs for "📍 Loading node: greet"
4. Respond to agent
5. Check logs for "⏳ Node 'greet' not complete yet"

### Test 2: Greet → Verify Flow

1. Make call
2. Agent greets
3. User says "I need help with my home equity"
4. Agent asks for name
5. User provides name
6. Agent calls `verify_caller_identity` tool
7. Check logs for "🧭 Router: greet → verify"
8. Verify agent continues with verify node prompt

### Test 3: Full Flow (Greet → Verify → Qualify → Answer)

1. Call with known lead phone
2. Verify automatic routing through nodes
3. Check DB `conversation_state` for state flags being set
4. Verify appropriate node prompts are used

### Test 4: Edge Cases

1. Wrong person → Should route to exit
2. Not qualified → Should route to exit
3. Objection → Should route to objections node
4. Ready to book → Should route to book node

## Key Benefits

1. **No LangGraph complexity** - Simple event loop
2. **All existing work preserved** - Nodes, routers, tools, DB state
3. **Easy debugging** - Clear logs show current node and routing decisions
4. **Production-ready pattern** - Same as Vapi/Bland/Retell
5. **Reversible** - Can add LangGraph back later when streaming fixed
6. **Conversation history preserved** - Only instructions change, full context maintained

## Next Steps

1. Create node prompt files in `prompts/reverse_mortgage/nodes/`:
   - `greet.md`
   - `verify.md`
   - `qualify.md`
   - `answer.md`
   - `objections.md`
   - `book.md`
   - `exit.md`

2. Test with real inbound calls to verify routing works

3. Monitor logs for routing decisions and node transitions

4. Adjust completion criteria if needed based on real conversations

5. Add error handling for edge cases (DB failures, network issues)

## Estimated Completion Time

- ✅ Implementation: ~3 hours (COMPLETE)
- 🔄 Node prompts creation: ~1 hour
- 🔄 Testing: ~30 minutes
- 🔄 Refinements: ~1 hour

**Total: ~5.5 hours** (3 hours complete, 2.5 hours remaining)

