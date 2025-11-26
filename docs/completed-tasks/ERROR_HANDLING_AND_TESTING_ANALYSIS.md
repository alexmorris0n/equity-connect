# Error Handling & Testing Analysis - Agent Handoff Refactor

## Question 1: Error Cases in Node Transitions

### ✅ Currently Handled

#### 1. Missing Instructions (`node_agent.py:108-112`)
```python
if not instructions:
    logger.warning(f"⚠️ Node '{node_name}' has no instructions in database")
    instructions = f"You are handling the {node_name} phase of the conversation."
```
**Status:** ✅ Gracefully falls back to generic instructions

#### 2. Invalid/Missing Tools (`tool_loader.py:81-94`)
```python
for tool_name in tool_names:
    tool_func = TOOL_REGISTRY.get(tool_name)
    if tool_func:
        tools.append(tool_func)
    else:
        missing_tools.append(tool_name)
        logger.warning(f"⚠️ Tool '{tool_name}' not found in TOOL_REGISTRY - skipping")
```
**Status:** ✅ Logs warning, continues with available tools

#### 3. Database Load Failure (`node_agent.py:119-121`)
```python
except Exception as e:
    logger.error(f"❌ Failed to load config for node '{node_name}': {e}")
    raise
```
**Status:** ✅ Raises exception, prevents creating broken agent

#### 4. Invalid Transitions (`routing_coordinator.py:120-125`)
```python
if not is_valid:
    logger.error(f"❌ BLOCKED: Invalid transition {current_node} → {next_node}")
    logger.info(f"⏸️  Staying in current node - router suggested invalid transition")
    return None  # Don't transition
```
**Status:** ✅ Blocks invalid transitions, stays in current node

###⚠️ NOT Currently Handled

#### 1. Agent Creation Failure During Handoff
**Scenario:** Database connection fails during `handoff_to_node()`

**Current Code (`routing_coordinator.py:173-180`):**
```python
async def handoff_to_node(self, next_node, current_agent, session):
    from node_agent import BarbaraNodeAgent
    
    new_agent = BarbaraNodeAgent(
        node_name=next_node,
        # ... params ...
    )
    session.update_agent(new_agent)  # What if this fails?
```

**Risk:** If `BarbaraNodeAgent.__init__()` raises, the handoff fails mid-transition

**Solution:**
```python
async def handoff_to_node(self, next_node, current_agent, session):
    from node_agent import BarbaraNodeAgent
    
    try:
        logger.info(f"🔄 Handoff: {current_agent.node_name} → {next_node}")
        
        new_agent = BarbaraNodeAgent(
            node_name=next_node,
            vertical=self.vertical,
            phone_number=self.phone,
            chat_ctx=current_agent.chat_ctx,
            coordinator=self
        )
        
        session.update_agent(new_agent)
        logger.info(f"✅ Handoff complete: now in '{next_node}'")
        
    except Exception as e:
        logger.error(f"❌ Handoff FAILED: {current_agent.node_name} → {next_node}: {e}", exc_info=True)
        # Stay in current agent - conversation continues
        logger.info(f"⏸️  Staying in '{current_agent.node_name}' due to handoff failure")
        # Optionally: inform user there's a technical issue
        await session.generate_reply(
            instructions="Apologize briefly for a slight delay and continue the conversation naturally."
        )
```

#### 2. Empty Tools List
**Scenario:** Node has tools configured but all are invalid/missing

**Current Behavior:**
- `tool_loader.py` returns empty list
- Agent created with `tools=[]`
- Agent can still speak but has no actions

**Risk:** Node may expect tools (e.g., VERIFY needs `verify_caller_identity`)

**Solution:** Add validation in `BarbaraNodeAgent.__init__()`:
```python
# After loading tools
tools = load_tools_for_node(node_name, vertical)

if len(tools) == 0 and node_name in ["verify", "qualify", "quote", "book"]:
    # Critical nodes require tools
    logger.error(f"❌ CRITICAL: Node '{node_name}' requires tools but loaded 0!")
    raise ValueError(f"Node '{node_name}' misconfigured: no valid tools found")
```

#### 3. Malformed `chat_ctx`
**Scenario:** Previous agent's `chat_ctx` is corrupted or incompatible

**Current Code:** No validation before passing `chat_ctx`

**Solution:**
```python
# In routing_coordinator.py handoff_to_node()
try:
    chat_ctx = current_agent.chat_ctx
    # Validate chat_ctx structure
    if not hasattr(chat_ctx, 'items'):
        logger.warning(f"⚠️ chat_ctx missing 'items' attribute, creating fresh context")
        chat_ctx = None
except Exception as e:
    logger.error(f"❌ Failed to access chat_ctx: {e}, using fresh context")
    chat_ctx = None

new_agent = BarbaraNodeAgent(
    # ...
    chat_ctx=chat_ctx
)
```

---

## Question 2: Double-Handoff / Race Conditions

### Potential Race Condition

**Scenario:**
1. User finishes speaking → `on_user_turn_completed()` → `coordinator.check_and_route()`
2. Coordinator determines greet → verify transition
3. `handoff_to_node()` is called, starts creating verify agent
4. **MEANWHILE:** Agent finishes speaking → `agent_speech_committed` event → another `check_and_route()` call
5. Second routing check happens while first handoff is mid-transition

**Timeline:**
```
T0: User turn ends
T1: on_user_turn_completed() → check_and_route() [Call 1]
T2: Call 1 determines greet → verify
T3: Call 1 starts handoff_to_node()
T4: Agent speech committed → check_and_route() [Call 2] ⚠️ RACE!
T5: Call 1 completes session.update_agent(verify_agent)
T6: Call 2 running on OLD greet agent or NEW verify agent?
```

### ✅ Current Protection

**LiveKit's `session.update_agent()` is likely atomic** - the session switches agents completely before processing new events.

**Python's async/await model:** Since both calls are `await coordinator.check_and_route()`, they're sequential in the event loop.

### ⚠️ Potential Issue: Event Hook Timing

**Current code (agent.py line 971-976):**
```python
def on_agent_finished_speaking():
    import asyncio
    asyncio.create_task(agent.check_and_route())

session.on("agent_speech_committed", on_agent_finished_speaking)
```

**Problem:** `asyncio.create_task()` schedules routing check asynchronously, doesn't wait.

**After our refactor:** This event hook will be **removed** because routing happens via `on_user_turn_completed()` which is synchronous.

### ✅ Solution: Guard Against Concurrent Routing

Add a routing lock to `RoutingCoordinator`:

```python
class RoutingCoordinator:
    def __init__(self, phone, vertical):
        self.phone = phone
        self.vertical = vertical
        self._routing_in_progress = False  # Guard flag
        
    async def check_and_route(self, current_agent, session):
        # Guard against concurrent routing calls
        if self._routing_in_progress:
            logger.debug(f"⏸️  Routing already in progress, skipping duplicate check")
            return None
        
        self._routing_in_progress = True
        try:
            current_node = current_agent.node_name
            logger.info(f"🔍 Routing check from node: {current_node}")
            
            # ... rest of routing logic ...
            
            if next_node and next_node != current_node:
                await self.handoff_to_node(next_node, current_agent, session)
                return next_node
            
            return None
        finally:
            self._routing_in_progress = False
```

---

## Question 3: Automated Testing with `trace_test.md`

### Current `trace_test.md` Status

**Purpose:** Defines 13 conversation scenarios covering:
- Happy paths (3 scenarios)
- Objection handling (3 scenarios)
- Edge cases (4 scenarios)
- Failure modes (3 scenarios)

**Format:** Manual trace documentation, not automated

### ✅ YES - We Can Use It for Automated Testing!

### Implementation Strategy

#### Option 1: Stateful Simulation Script (Recommended)

Create `livekit-agent/tests/test_trace_scenarios.py`:

```python
"""Automated trace testing based on trace_test.md scenarios"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from node_agent import BarbaraNodeAgent
from routing_coordinator import RoutingCoordinator
from services.conversation_state import get_conversation_state, update_conversation_state

class MockSession:
    """Mock AgentSession for testing"""
    def __init__(self):
        self.current_agent = None
        self.chat_ctx = MagicMock()
        
    def update_agent(self, new_agent):
        """Simulates agent handoff"""
        self.current_agent = new_agent
        
    async def generate_reply(self, instructions):
        """Mock reply generation"""
        pass

@pytest.mark.asyncio
async def test_scenario_1_perfect_qualified_lead():
    """
    Scenario 1: Perfect Qualified Lead
    Expected: GREET → VERIFY → QUALIFY → QUOTE → BOOK → GOODBYE
    """
    phone = "+15551234567"
    
    # Setup initial state
    with patch('services.conversation_state.get_supabase_client'):
        with patch('services.conversation_state.get_conversation_state') as mock_get_state:
            with patch('services.conversation_state.update_conversation_state') as mock_update_state:
                
                # Mock database state progression
                conversation_states = {
                    "greet": {
                        "phone_number": phone,
                        "conversation_data": {
                            "greeted": True,
                            "greet_turn_count": 1
                        }
                    },
                    "verify": {
                        "phone_number": phone,
                        "conversation_data": {
                            "greeted": True,
                            "verified": True,
                            "verify_turn_count": 1
                        }
                    },
                    "qualify": {
                        "phone_number": phone,
                        "conversation_data": {
                            "greeted": True,
                            "verified": True,
                            "qualified": True,
                            "qualify_turn_count": 1
                        }
                    },
                    # ... continue for all nodes
                }
                
                current_node = "greet"
                def get_state_side_effect(p):
                    return conversation_states.get(current_node)
                
                mock_get_state.side_effect = get_state_side_effect
                
                # Create coordinator and initial agent
                coordinator = RoutingCoordinator(phone=phone, vertical="reverse_mortgage")
                session = MockSession()
                
                # Start at GREET
                greet_agent = BarbaraNodeAgent(
                    node_name="greet",
                    phone_number=phone,
                    coordinator=coordinator
                )
                session.current_agent = greet_agent
                
                # Simulate routing through nodes
                visited_nodes = ["greet"]
                
                # GREET → VERIFY
                current_node = "greet"
                next_node = await coordinator.check_and_route(session.current_agent, session)
                assert next_node == "verify", f"Expected greet → verify, got {next_node}"
                visited_nodes.append(next_node)
                
                # VERIFY → QUALIFY
                current_node = "verify"
                next_node = await coordinator.check_and_route(session.current_agent, session)
                assert next_node == "qualify", f"Expected verify → qualify, got {next_node}"
                visited_nodes.append(next_node)
                
                # Continue through all nodes...
                
                # Final assertion
                expected_flow = ["greet", "verify", "qualify", "quote", "book", "goodbye"]
                assert visited_nodes == expected_flow, f"Flow mismatch: {visited_nodes} != {expected_flow}"
                
                # Verify database state assertions
                final_state = conversation_states["goodbye"]
                assert final_state["conversation_data"]["greeted"] == True
                assert final_state["conversation_data"]["verified"] == True
                assert final_state["conversation_data"]["qualified"] == True
                assert "appointment_datetime" in final_state["conversation_data"]
```

#### Option 2: Integration Test with Real Database

Create `livekit-agent/tests/test_trace_integration.py`:

```python
"""Integration tests with real Supabase database"""

import pytest
import asyncio
from livekit.agents import AgentSession
from node_agent import BarbaraNodeAgent
from routing_coordinator import RoutingCoordinator
from services.conversation_state import start_call, get_conversation_state

@pytest.mark.integration
@pytest.mark.asyncio
async def test_scenario_1_with_real_db():
    """Test Scenario 1 with real database (slower but more accurate)"""
    
    test_phone = "+15551234567"
    
    # Start a test call in database
    start_call(
        phone_number=test_phone,
        vertical="reverse_mortgage",
        call_type="test-integration"
    )
    
    try:
        # Create coordinator and agent
        coordinator = RoutingCoordinator(phone=test_phone)
        
        # Simulate full conversation flow
        # ... (similar to Option 1 but uses real DB)
        
    finally:
        # Cleanup test data
        from services.supabase import get_supabase_client
        supabase = get_supabase_client()
        supabase.table("conversation_state").delete().eq("phone_number", test_phone).execute()
```

#### Option 3: Scenario Runner CLI Tool

Create `livekit-agent/scripts/run_trace_scenarios.py`:

```python
"""CLI tool to run trace scenarios from trace_test.md"""

import asyncio
import json
from routing_coordinator import RoutingCoordinator
from node_agent import BarbaraNodeAgent

SCENARIOS = {
    "scenario_1": {
        "name": "Perfect Qualified Lead",
        "expected_flow": ["greet", "verify", "qualify", "quote", "book", "goodbye"],
        "expected_flags": {
            "greeted": True,
            "verified": True,
            "qualified": True,
            "quote_presented": True,
            "appointment_booked": True
        }
    },
    # ... all 13 scenarios
}

async def run_scenario(scenario_id: str):
    """Run a single trace scenario"""
    scenario = SCENARIOS[scenario_id]
    print(f"\n{'='*60}")
    print(f"Running: {scenario['name']}")
    print(f"{'='*60}\n")
    
    # ... simulation logic ...
    
    print(f"\n✅ Scenario {scenario_id} PASSED")

if __name__ == "__main__":
    import sys
    scenario = sys.argv[1] if len(sys.argv) > 1 else "all"
    
    if scenario == "all":
        for scenario_id in SCENARIOS.keys():
            asyncio.run(run_scenario(scenario_id))
    else:
        asyncio.run(run_scenario(scenario))
```

**Usage:**
```bash
# Run all scenarios
python livekit-agent/scripts/run_trace_scenarios.py all

# Run specific scenario
python livekit-agent/scripts/run_trace_scenarios.py scenario_1
```

---

## Recommended Actions

### Immediate (Before Step 4 completion):

1. **Add error handling to `handoff_to_node()`** (5 minutes)
   - Wrap in try/except
   - Stay in current node on failure
   - Log errors

2. **Add routing lock to `RoutingCoordinator`** (3 minutes)
   - Prevent concurrent routing
   - Use `_routing_in_progress` flag

3. **Validate critical nodes have tools** (3 minutes)
   - Check in `BarbaraNodeAgent.__init__()`
   - Raise exception if verify/qualify/quote/book has 0 tools

### Short-term (After Step 4 completion):

4. **Create `test_trace_scenarios.py`** (2 hours)
   - Implement Option 1 (Stateful Simulation)
   - Start with Scenarios 1, 2, 7 (most critical)
   - Run via `pytest livekit-agent/tests/test_trace_scenarios.py`

5. **Create scenario runner CLI tool** (1 hour)
   - Implement Option 3
   - Easier for manual testing
   - Can be run by non-developers

### Medium-term (After initial testing):

6. **Expand test coverage** (4 hours)
   - All 13 scenarios from `trace_test.md`
   - Add assertion helpers for common checks
   - Generate test reports

7. **CI/CD Integration** (2 hours)
   - Run tests on every PR
   - Block merges if critical scenarios fail
   - Generate coverage reports

---

## Summary

### Question 1: Error Cases ✅ Mostly Covered
- Missing instructions: ✅ Handled
- Invalid tools: ✅ Handled (warnings)
- Database failures: ✅ Handled (raises)
- Invalid transitions: ✅ Blocked
- **Needs:** Handoff failure handling, empty tools validation

### Question 2: Double-Handoff ⚠️ Needs Guard
- Likely safe due to LiveKit's atomic updates
- **Recommended:** Add routing lock to be certain

### Question 3: Automated Testing ✅ Definitely Possible
- `trace_test.md` provides excellent test specifications
- **Recommended:** Stateful simulation (Option 1) for speed
- **Also recommended:** CLI runner (Option 3) for manual validation

---

## Next Steps

**Priority Order:**
1. Add error handling (15 minutes) - **DO NOW**
2. Complete Step 4 refactor (30 minutes)
3. Test with single live call (10 minutes)
4. Create basic trace test (Scenario 1) (30 minutes)
5. Expand to all scenarios (ongoing)

