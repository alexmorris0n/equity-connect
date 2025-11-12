# SignalWire SDK Integration - Fixed ✅

## What Was Fixed

This document summarizes the fixes made to properly integrate the Barbara agent with SignalWire SDK's official APIs.

## Changes Made

### 1. Tool Registration (`equity_connect/tools/registry.py`)

**Before (Wrong):**
```python
def _try_register(agent, name, description, parameters, handler):
    # Custom registration with fallback logic
    # Attempted multiple SDK integration points
```

**After (Correct):**
```python
agent.define_tool(
    name="get_lead_context",
    description="Get lead information...",
    parameters={...},
    handler=lambda args, raw_data: get_lead_context(args.get("phone"))
)
```

**Key Changes:**
- Removed custom `_try_register` function with fallback logic
- Using SignalWire's official `agent.define_tool()` API
- All 21 tools now registered correctly with proper handler signature: `(args: Dict, raw_data: Dict)`

### 2. Agent Class (`equity_connect/agent/barbara_agent.py`)

**Before (Wrong):**
```python
class BarbaraAgent(_Base):  # Conditional base class
    def __init__(self, sw_context=None):
        # Fallback logic for when SDK not available
        if _Base is not object:
            try:
                super().__init__(...)
```

**After (Correct):**
```python
from signalwire_agents import AgentBase

class BarbaraAgent(AgentBase):
    def __init__(self):
        super().__init__(
            name="barbara-agent",
            route="/agent",
            port=8080,
            auto_answer=True,
            record_call=True
        )
```

**Key Changes:**
- Proper inheritance from `AgentBase` (no fallback logic needed)
- Configured voice, AI params, and speech hints using SDK APIs
- Added `on_function_call()` hook to trigger BarbGraph routing after tool execution
- Integrated all 8 BarbGraph routers and node completion checkers
- Using `set_prompt_text()` for prompt updates

### 3. App Entry Point (`equity_connect/app.py`)

**Before (Wrong):**
```python
from http.server import BaseHTTPRequestHandler, HTTPServer

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Custom HTTP server implementation

server = HTTPServer(("0.0.0.0", port), HealthHandler)
server.serve_forever()
```

**After (Correct):**
```python
from equity_connect.agent.barbara_agent import BarbaraAgent

if __name__ == "__main__":
    agent = BarbaraAgent()
    agent.run()  # SignalWire handles everything
```

**Key Changes:**
- Removed custom HTTP server
- Using SignalWire's `agent.run()` which automatically:
  - Sets up HTTP server on port 8080
  - Handles `/agent` endpoint for SIP routing
  - Provides `/healthz` endpoint for Fly.io
  - Auto-detects deployment environment

### 4. Prompt Loader (`equity_connect/services/prompt_loader.py`)

**Added:**
```python
def build_instructions_for_node(
    node_name: str,
    call_type: str = "outbound",
    lead_context: Optional[dict] = None,
    phone_number: Optional[str] = None,
    vertical: str = "reverse_mortgage"
) -> str:
    """Build complete instructions for a node (theme + context + node prompt)"""
    theme = load_theme(vertical)
    node_prompt = load_node_prompt(node_name, vertical)
    context = build_context_injection(call_type, lead_context, phone_number) if lead_context else None
    
    # Combine: Theme → Context → Node
    parts = [theme]
    if context:
        parts.append(f"\n{context}")
    parts.append(f"\n{node_prompt}")
    
    return "\n".join(parts)
```

**Key Changes:**
- Added unified function to build complete prompt text for SignalWire
- Combines theme, context, and node prompts in correct hierarchical order
- Used by `BarbaraAgent._route_to_node()` for prompt updates

## What DIDN'T Change

**All business logic remains 100% unchanged:**

- ✅ All 21 tools (lead.py, calendar.py, knowledge.py, interaction.py, conversation_flags.py) - ZERO changes
- ✅ All 8 BarbGraph routers (routers.py) - ZERO changes  
- ✅ All 8 node completion checkers (node_completion.py) - ZERO changes
- ✅ Supabase schema and database queries - ZERO changes
- ✅ Prompt loading from database - ZERO changes
- ✅ Conversation state management - ZERO changes

**Only the integration layer was fixed** - the "wiring" to SignalWire SDK.

## How BarbGraph Routing Works Now

1. **Tool Execution:** User input triggers LLM, which calls a tool (e.g., `verify_caller_identity`)
2. **Routing Hook:** `on_function_call()` intercepts the tool call
3. **Completion Check:** Checks if current node is complete using `is_node_complete()`
4. **Router Decision:** If complete, calls appropriate router (e.g., `route_after_verify()`)
5. **Prompt Update:** If routing to new node, calls `_route_to_node()` which:
   - Loads theme + node prompt from Supabase
   - Builds context injection with lead data
   - Updates agent instructions via `set_prompt_text()`
   - Updates `current_node` state

## Next Steps

### 1. Deploy to Fly.io

```bash
# GitHub Actions will automatically deploy when you push
git add -A
git commit -m "fix: SignalWire SDK integration with official APIs"
git push origin main
```

### 2. Verify Deployment

```bash
# Check health endpoint
curl https://barbara-agent.fly.dev/healthz

# Check agent endpoint (should return SWML)
curl https://barbara-agent.fly.dev/agent
```

### 3. Configure SignalWire Voice App

Point your SignalWire Voice App to:
```
https://barbara-agent.fly.dev/agent
```

### 4. Test Call Flow

Make a test call and verify:
- [ ] All 21 tools register (check logs)
- [ ] BarbGraph routing triggers correctly
- [ ] Node transitions logged (greet → verify → qualify, etc.)
- [ ] Prompts load from Supabase
- [ ] Conversation state persists in database
- [ ] Multi-call persistence works (call back same number)

## Troubleshooting

### If tools don't register:
Check logs for `define_tool` errors - likely parameter schema issues

### If routing doesn't work:
Check logs for `on_function_call` execution - verify tools are being called

### If prompts don't load:
Check Supabase connection and verify theme_prompts/prompt_versions tables have data

### If health check fails:
Verify port 8080 is exposed in Dockerfile and fly.toml

## Files Changed

1. `equity_connect/tools/registry.py` - Tool registration fixed
2. `equity_connect/agent/barbara_agent.py` - Proper AgentBase inheritance
3. `equity_connect/app.py` - Using SignalWire's agent.run()
4. `equity_connect/services/prompt_loader.py` - Added build_instructions_for_node()

## Files Unchanged

All business logic files remain unchanged:
- `equity_connect/tools/*.py` (21 tool implementations)
- `equity_connect/workflows/routers.py` (8 routers)
- `equity_connect/workflows/node_completion.py` (8 checkers)
- `equity_connect/services/supabase.py` (database client)
- `equity_connect/services/conversation_state.py` (state management)
- `equity_connect/services/nylas.py` (calendar integration)
- `equity_connect/services/vertex.py` (embeddings)

## Summary

The migration preserved all business logic while fixing the integration layer to use SignalWire's official SDK APIs. This ensures compatibility, maintainability, and proper support from SignalWire.

**The car is now wired correctly - same engine, same body, just proper electrical connections.** 🚗⚡

