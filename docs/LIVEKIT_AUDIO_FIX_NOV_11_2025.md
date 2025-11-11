# LiveKit Voice Agent Audio Fix - November 11, 2025

## 🎯 Mission: Get Audio Working with LiveKit Cloud + LangGraph

### Starting Problem
- Agent connected to calls successfully
- LangGraph workflow executed all nodes
- **NO AUDIO** - Complete silence on calls
- User couldn't hear Barbara, Barbara couldn't respond

---

## 🔍 Root Cause Analysis

### Issue #1: Duplicate LLM in Agent Class
**Problem:**
```python
# ❌ WRONG - LLM passed to both AgentSession AND Agent
session = AgentSession(llm=llm_plugin, ...)
await session.start(agent=Agent(llm=llm_plugin, instructions=instructions), ...)
```

**Solution:**
```python
# ✅ CORRECT - LLM only in AgentSession, Agent only has instructions
session = AgentSession(llm=llm_plugin, ...)
await session.start(agent=Agent(instructions=instructions), ...)
```

**Why:** According to [LiveKit Agents 1.0 docs](https://docs.livekit.io/agents), `AgentSession` handles the entire STT→LLM→TTS pipeline. The `Agent` class defines behavior (instructions), not the LLM.

---

### Issue #2: LangGraph Workflow Architecture Mismatch

**Problem:** LangGraph workflow was designed as a **multi-step sequential workflow** that executes all nodes in one turn:
```
User connects → GREET → VERIFY → QUALIFY → EXIT → END (all at once)
```

**Expected:** A **turn-based conversational agent**:
```
User speaks → Process one turn → Agent responds → Wait for next user input
```

**Why LangGraph Wasn't Streaming Audio:**
- Each node uses `ainvoke()` which waits for the ENTIRE response
- No streaming chunks sent to TTS
- TTS never receives audio data to synthesize
- Result: Silence

```python
# ❌ Current implementation (no streaming)
ai_response = await llm_with_tools.ainvoke(messages)

# ✅ Needed for voice (streaming)
async for chunk in llm_with_tools.astream(messages):
    # Send chunk to TTS immediately
```

---

### Issue #3: Testing Approach

**Problem:** Testing complex LangGraph workflow before verifying basic audio pipeline

**Solution:** Implement simple LLM test mode to isolate the issue

---

## ✅ Solutions Implemented

### 1. Fixed Agent Class Usage
**File:** `livekit-agent/agent.py`
- Removed `llm` parameter from `Agent()` constructor
- Only pass `instructions` to `Agent()`
- Let `AgentSession` handle the LLM

**Commit:** `fix(agent): Critical fixes for LangGraph voice streaming`

---

### 2. Added Test Mode with Simple LLM
**File:** `livekit-agent/agent.py`

```python
USE_SIMPLE_LLM_TEST = True  # Bypass LangGraph for testing

if USE_SIMPLE_LLM_TEST:
    # Use OpenRouter with native LiveKit plugin
    llm_plugin = openai.LLM.with_openrouter(
        model=template.get("llm_model", "gpt-4o"),
        temperature=template.get("llm_temperature", 0.8),
    )
else:
    # Use LangGraph workflow (needs streaming fixes)
    conversation_graph = create_conversation_graph(base_llm, all_tools, lead_context)
    llm_plugin = livekit_langchain.LLMAdapter(graph=conversation_graph)
```

**Why This Worked:**
- `openai.LLM.with_openrouter()` supports **streaming by default**
- Bypasses complex workflow to test basic audio pipeline
- Uses official [LiveKit OpenRouter plugin](https://docs.livekit.io/agents/models/llm/plugins/openrouter/)

**Commit:** `test: Add simple LLM mode to test audio pipeline`

---

### 3. Cleaned Up Database
**Removed:**
- `llm_base_url` column (not needed with native plugin)
- Migration `20251110_add_llm_base_url_for_openrouter.sql`

**Why:** The native `.with_openrouter()` method handles the OpenRouter API endpoint automatically.

**Commit:** `cleanup: Remove llm_base_url column and migration`

---

### 4. Added Initial Greeting Trigger
**File:** `livekit-agent/agent.py`

```python
# For inbound calls, agent should greet first
if call_type in ["inbound-unknown", "inbound-callback", "inbound-qualified"]:
    logger.info("🎙️ Triggering initial greeting for inbound call...")
    await session.generate_reply(instructions="Greet the caller warmly and introduce yourself.")
```

**Reference:** [LiveKit Telephony Docs](https://docs.livekit.io/agents/start/telephony/)

---

## 🎉 SUCCESS: Audio Working!

### Test Results (November 11, 2025 - 01:50 UTC)

**Call Flow:**
```
01:50:30 - Agent connected to room
01:50:33 - TEST MODE activated
01:50:35 - Initial greeting triggered
01:50:40 - User disconnected (CLIENT_INITIATED)
```

**User Report:**
- ✅ **Heard Barbara's voice greeting**
- ✅ Call reconnected and regreeted (confirmed audio working)
- ✅ No errors in audio pipeline

**Logs:**
```
🧪 TEST MODE: Using simple OpenRouter LLM (bypassing LangGraph)
🎙️ STT: deepgram - nova-2
🧠 LLM: openrouter - gpt-4o (temp=0.8, top_p=1.0)
🔊 TTS: elevenlabs - 6aDn1KB0hjpdcocrUkmq (speed=1.0)
🎙️ Triggering initial greeting for inbound call...
```

---

## 🔧 What Still Needs Fixing: LangGraph Streaming

### Current State
- ✅ Basic audio pipeline works (STT → OpenRouter LLM → TTS)
- ❌ LangGraph workflow doesn't stream to TTS
- ❌ Multi-node workflow executes all at once instead of turn-by-turn

### Required Changes

#### 1. Convert Nodes to Streaming
**File:** `livekit-agent/workflows/conversation_graph.py`

```python
# Current (broken for voice)
async def node_function(state: ConversationState) -> dict:
    messages = state.get("messages", [])
    ai_response = await llm_with_tools.ainvoke(messages)  # ❌ No streaming
    return {"messages": [ai_response]}

# Needed (streaming for voice)
async def node_function(state: ConversationState) -> dict:
    messages = state.get("messages", [])
    
    # Stream tokens to TTS in real-time
    response_chunks = []
    async for chunk in llm_with_tools.astream(messages):  # ✅ Streaming
        response_chunks.append(chunk)
        # Chunks automatically flow to TTS via LLMAdapter
    
    # Combine chunks for state
    ai_response = AIMessage(content="".join([c.content for c in response_chunks]))
    return {"messages": [ai_response]}
```

**References:**
- [LangGraph Streaming Docs](https://docs.langchain.com/oss/python/langgraph/streaming)
- [LiveKit Agents Issue #3111](https://github.com/livekit/agents/issues/3111) - LLMAdapter streaming with subgraphs

---

#### 2. Redesign for Turn-Based Conversation

**Current Problem:** Workflow runs start-to-finish in one invocation

**Option A - Single-Node with Routing:**
- Collapse workflow into one node
- Use LLM reasoning + prompt engineering for routing
- Simpler, but less deterministic

**Option B - Session-Managed Multi-Turn:**
- Store current node in conversation state
- Execute ONE node per user message
- Use LiveKit session to manage turns
- More complex, but maintains deterministic flow

---

## 📊 Architecture Summary

### Current Working Setup (Test Mode)
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Deepgram  │────▶│  OpenRouter  │────▶│ ElevenLabs  │
│  STT (nova) │     │  (gpt-4o)    │     │   TTS (v2)  │
└─────────────┘     └──────────────┘     └─────────────┘
                           ▲
                           │
                    ┌──────┴──────┐
                    │   LiveKit   │
                    │ AgentSession│
                    └─────────────┘
```

### Target Setup (LangGraph Mode)
```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Deepgram  │────▶│    LangGraph     │────▶│ ElevenLabs  │
│  STT (nova) │     │ (streaming nodes)│     │   TTS (v2)  │
└─────────────┘     └──────────────────┘     └─────────────┘
                            ▲
                            │
                    ┌───────┴────────┐
                    │ LLMAdapter     │
                    │ (with astream) │
                    └────────────────┘
```

---

## 🎓 Key Learnings

1. **LiveKit Agents 1.0 API:**
   - `AgentSession` is the unified orchestrator
   - `Agent` class only defines behavior, not LLM
   - Never pass LLM to both session and agent

2. **Voice Requires Streaming:**
   - `ainvoke()` waits for complete response → NO AUDIO
   - `astream()` sends chunks immediately → AUDIO WORKS
   - TTS needs real-time data to synthesize speech

3. **Test Incrementally:**
   - Start with simple LLM before complex workflows
   - Isolate issues one at a time
   - Don't test complex LangGraph without basic audio working

4. **OpenRouter Integration:**
   - LiveKit has native OpenRouter plugin
   - Use `openai.LLM.with_openrouter()` method
   - No need to manually set `base_url` or manage API keys

5. **Documentation is Critical:**
   - Always check official docs before implementing
   - LiveKit docs are comprehensive and accurate
   - Community examples (GitHub) are invaluable

---

## 📚 References

- [LiveKit Agents Documentation](https://docs.livekit.io/agents)
- [LiveKit OpenRouter Plugin](https://docs.livekit.io/agents/models/llm/plugins/openrouter/)
- [OpenRouter + LiveKit Guide](https://openrouter.ai/docs/community/live-kit)
- [LangGraph Streaming](https://docs.langchain.com/oss/python/langgraph/streaming)
- [LiveKit Telephony Integration](https://docs.livekit.io/agents/start/telephony/)
- [LiveKit Agents GitHub](https://github.com/livekit/agents)
- [dqbd/langgraph-livekit-agents](https://github.com/dqbd/langgraph-livekit-agents) - Reference implementation

---

## ✅ Next Steps

1. **Test Full Conversation** (with simple LLM)
   - Verify two-way audio
   - Test turn-taking
   - Verify interruptions work

2. **Implement LangGraph Streaming**
   - Convert nodes from `ainvoke()` to `astream()`
   - Test each node individually
   - Ensure TTS receives streaming data

3. **Redesign Workflow for Turn-Based**
   - Implement session-managed multi-turn OR
   - Simplify to single-node with prompt-based routing

4. **Re-enable LangGraph Mode**
   - Set `USE_SIMPLE_LLM_TEST = False`
   - Test full deterministic workflow
   - Verify DB-backed routing works

5. **Production Readiness**
   - Add error handling for streaming failures
   - Implement fallback mechanisms
   - Add monitoring and metrics
   - Test edge cases (interruptions, silence, etc.)

---

## 🙏 Acknowledgments

Special thanks to:
- LiveKit team for excellent documentation
- dqbd for the LangGraph-LiveKit reference implementation
- OpenRouter for flexible model access
- The user for patience through the debugging process! 🎉

---

**Status:** ✅ Audio Pipeline Working | ⏳ LangGraph Streaming In Progress

**Last Updated:** November 11, 2025
**Next Milestone:** LangGraph Streaming Implementation

