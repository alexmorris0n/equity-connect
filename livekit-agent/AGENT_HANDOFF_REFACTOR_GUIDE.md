# Step 4: Agent Handoff Refactor - Implementation Guide

## Overview

This document describes the refactoring of `agent.py` from a single agent with node-switching to agent handoffs using `BarbaraNodeAgent`.

## Architecture Change

### Before (Node-Switching):
```python
class BarbaraAgent(Agent):
    current_node = "greet"
    
    async def load_node(self, node_name):
        # Load instructions and tools for node
        await self.update_instructions(instructions)
        await self.update_tools(filtered_tools)
        # Agent stays the same, just updates config
    
    async def check_and_route(self):
        if is_node_complete():
            next_node = route_next()
            await self.load_node(next_node)
```

### After (Agent Handoffs):
```python
# Initial agent
greet_agent = BarbaraNodeAgent(node_name="greet", phone="+1234567890")

# Routing coordinator checks completion and performs handoffs
coordinator = RoutingCoordinator(phone="+1234567890")

async def check_and_route():
    if is_node_complete():
        next_node = route_next()
        # Create new agent for next node
        new_agent = BarbaraNodeAgent(node_name=next_node, chat_ctx=current_agent.chat_ctx)
        # Perform handoff
        session.update_agent(new_agent)
```

## Key Changes to `agent.py`

###1. Remove `BarbaraAgent` class

**Old:**
```python
class BarbaraAgent(Agent):
    def __init__(self, instructions, phone_number, vertical, call_type, lead_context):
        super().__init__(instructions=instructions, tools=all_tools)
        self.phone = phone_number
        self.current_node = "greet"
    
    async def on_enter(self):
        await self.load_node("greet", speak_now=True)
    
    async def on_user_turn_completed(self, turn_ctx, new_message):
        await self.check_and_route()
    
    async def load_node(self, node_name, speak_now=False):
        # ... 100+ lines of node loading logic
    
    async def check_and_route(self):
        # ... 80+ lines of routing logic
    
    def route_next(self, state_row, conversation_data):
        # ... 50+ lines of router mapping
```

**New:**
```python
# No BarbaraAgent class - routing moved to RoutingCoordinator
# Agent instances are created per-node via BarbaraNodeAgent
```

### 2. Modify `entrypoint()` function

**Changes:**
1. Create `RoutingCoordinator` instance
2. Create initial `BarbaraNodeAgent` for "greet" node
3. Attach coordinator's `check_and_route()` to session events
4. Start session with initial greet agent

**Old:**
```python
async def entrypoint(ctx: JobContext):
    # ... metadata extraction (keep this) ...
    
    # Create single agent with all tools
    agent = BarbaraAgent(
        instructions=initial_instructions,
        phone_number=caller_phone,
        vertical="reverse_mortgage",
        call_type=call_type,
        lead_context=lead_context
    )
    
    # ... session creation (keep this) ...
    
    # Hook routing
    def on_agent_finished_speaking():
        asyncio.create_task(agent.check_and_route())
    
    session.on("agent_speech_committed", on_agent_finished_speaking)
    
    # Start session
    await session.start(agent=agent, room=ctx.room)
```

**New:**
```python
async def entrypoint(ctx: JobContext):
    # ... metadata extraction (UNCHANGED) ...
    
    # Create routing coordinator
    coordinator = RoutingCoordinator(
        phone=caller_phone,
        vertical="reverse_mortgage"
    )
    
    # Create initial greet agent (database-driven)
    initial_agent = BarbaraNodeAgent(
        node_name="greet",
        vertical="reverse_mortgage",
        phone_number=caller_phone,
        chat_ctx=None  # Fresh conversation
    )
    
    # ... session creation (UNCHANGED) ...
    
    # Hook routing via coordinator
    def on_agent_finished_speaking():
        asyncio.create_task(coordinator.check_and_route(
            current_agent=session.current_agent,
            session=session
        ))
    
    session.on("agent_speech_committed", on_agent_finished_speaking)
    
    # Start session with greet agent
    await session.start(agent=initial_agent, room=ctx.room)
```

### 3. Hook `on_user_turn_completed` via event

**Old:**
```python
class BarbaraAgent(Agent):
    async def on_user_turn_completed(self, turn_ctx, new_message):
        await self.check_and_route()
```

**New:**
Since `BarbaraNodeAgent` extends `Agent`, it inherits the `on_user_turn_completed` hook.
But we need the coordinator's routing logic, not the agent's.

**Solution:** Add an `on_user_turn_completed` override to `BarbaraNodeAgent`:

```python
# In node_agent.py
class BarbaraNodeAgent(Agent):
    def __init__(self, node_name, vertical, phone_number, chat_ctx, coordinator=None):
        super().__init__(instructions=instructions, tools=tools, chat_ctx=chat_ctx)
        self.coordinator = coordinator  # Reference to routing coordinator
    
    async def on_user_turn_completed(self, turn_ctx, new_message):
        if self.coordinator:
            await self.coordinator.check_and_route(self, self.session)
```

### 4. Pass coordinator reference to agents

**In entrypoint:**
```python
# Create coordinator
coordinator = RoutingCoordinator(phone=caller_phone, vertical="reverse_mortgage")

# Create initial agent with coordinator reference
initial_agent = BarbaraNodeAgent(
    node_name="greet",
    vertical="reverse_mortgage",
    phone_number=caller_phone,
    chat_ctx=None,
    coordinator=coordinator  # Pass reference
)
```

**In routing_coordinator.py handoff_to_node:**
```python
async def handoff_to_node(self, next_node, current_agent, session):
    new_agent = BarbaraNodeAgent(
        node_name=next_node,
        vertical=self.vertical,
        phone_number=self.phone,
        chat_ctx=current_agent.chat_ctx,
        coordinator=self  # Pass self reference
    )
    session.update_agent(new_agent)
```

## Files Changed

1. **New file:** `livekit-agent/routing_coordinator.py` ✅ (already created)
2. **Modified:** `livekit-agent/node_agent.py` (add coordinator param + on_user_turn_completed)
3. **Modified:** `livekit-agent/agent.py` (remove BarbaraAgent class, simplify entrypoint)

## Testing Checklist

- [ ] Initial call connects and greet node loads
- [ ] Conversation history persists across handoffs
- [ ] Tools are node-specific (verify node has verify tools, not all tools)
- [ ] Routing respects `valid_contexts` (blocks invalid transitions)
- [ ] `step_criteria` evaluation works (turn counting, flag checking)
- [ ] Goodbye node properly ends conversation
- [ ] Re-entrancy works (e.g., spouse handoff back to greet)

## Next Steps

1. Update `node_agent.py` to accept `coordinator` parameter
2. Simplify `agent.py` entrypoint to use `RoutingCoordinator` and `BarbaraNodeAgent`
3. Test with real call
4. Verify all 13 scenarios from `trace_test.md`

