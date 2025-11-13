# Tool Execution & Post-Call Data Capture

## 🔧 How Tools Work

### Tool Execution Flow

1. **SignalWire SDK calls tool** → `on_function_call(name, args, raw_data)`
2. **Parent class executes tool** → `super().on_function_call()` handles async execution
3. **Tool returns result** → Can be plain data or `SwaigFunctionResult` with UX actions
4. **Routing check** → `_check_and_route_after_tool()` checks if node is complete
5. **Context switch** → If routing needed, return `SwaigFunctionResult` with `context_switch`

### Available Data in Tools

When a tool is called, `raw_data` contains:

```python
raw_data = {
    "call_id": "unique-call-uuid",
    "caller_id_num": "+16505300051",
    "caller_id_name": "John Doe",  # If available
    "global_data": {
        "lead_id": "abc-123",
        "qualified": True,
        "home_value": 500000,
        # ... other lead context
    },
    "call_log": [
        # Processed conversation history (consolidated, with latency metrics)
        {"role": "user", "content": "...", "latency_ms": 1200},
        {"role": "assistant", "content": "...", "latency_ms": 800}
    ],
    "raw_call_log": [
        # Full conversation transcript (NEVER consolidated)
        {"role": "user", "content": "...", "timestamp": "2025-11-13T00:42:17Z"},
        {"role": "assistant", "content": "...", "timestamp": "2025-11-13T00:42:19Z"}
    ],
    "channel_active": True,  # Whether call is still active
    "meta_data": {
        # Custom metadata passed between tools
        "check_count": 1,
        "last_broker_id": "..."
    }
}
```

### Tool Wrapper Pattern

All tools follow this pattern:

```python
@AgentBase.tool(
    description="...",
    parameters={...}
)
async def tool_name(self, args, raw_data):
    """Tool wrapper - calls actual tool function"""
    from equity_connect.tools.module import tool_function
    return await tool_function(args.get("param"), raw_data)
```

**Key Points:**
- Tools are `async` functions
- `args` contains tool parameters (from LLM)
- `raw_data` contains SignalWire context (call_id, transcripts, etc.)
- Tools can return `SwaigFunctionResult` for UX actions (`say()`, `send_sms()`, etc.)

---

## 📊 Post-Call Data Capture

### 1. Call Summary (`on_summary` callback)

**When:** Called by SignalWire after call ends and post-prompt is processed

**What we receive:**
```python
summary = {
    # Structured summary from post-prompt analysis
    "outcome": "appointment_booked",
    "key_points": [...],
    "next_steps": [...],
    # ... other structured data
}

raw_data = {
    "timestamp": "2025-11-13T00:45:00Z",
    "call_id": "...",
    # ... other call metadata
}
```

**What we save:**
- Saved to `interactions` table
- Includes: lead_id, broker_id, outcome, summary content
- Metadata includes: summary dict, call_ended_at, final node

### 2. Conversation Transcripts

**Available in tools via `raw_data["raw_call_log"]`:**
- Full conversation transcript (never consolidated)
- Each message has: `role`, `content`, `timestamp`
- Available during call for tools to use
- Should be saved via `save_interaction` tool

**Current Status:**
- ✅ Transcripts available in `raw_data` during call
- ✅ Can be accessed by `save_interaction` tool
- ⚠️ Need to verify `save_interaction` is capturing transcripts

### 3. Call Recordings

**SignalWire SDK:**
- `record_call=True` enabled in agent config
- `record_format="mp3"` set
- Recording URL should be available in call metadata

**What we need:**
- Recording URL passed to `save_interaction` tool
- Stored in `interactions.recording_url`

### 4. Call Metadata

**Available data:**
- Call duration (calculate from timestamps)
- Call start/end times
- Final BarbGraph node
- Tools executed (from call_log)
- Outcome (from summary)

---

## ✅ Verification Checklist

### Tool Execution
- [ ] `on_function_call` is being called (check logs for `🔧 DEBUG: on_function_call invoked`)
- [ ] Tools execute successfully (check logs for `✅ DEBUG: Tool executed successfully`)
- [ ] Routing works after tools (check logs for `🔄 DEBUG: Routing detected`)
- [ ] Context switches happen (check logs for `✅ DEBUG: Context switched to node`)

### Post-Call Data
- [ ] `on_summary` is called (check logs for `📊 Conversation completed`)
- [ ] Summary is saved to database (check logs for `✅ Call summary saved`)
- [ ] Transcripts are captured in `raw_call_log` (verify in tool `raw_data`)
- [ ] `save_interaction` tool receives transcripts (check tool implementation)
- [ ] Recording URL is captured (verify SignalWire provides it)
- [ ] All metadata is saved (check `interactions` table)

---

## 🔍 Debugging Tools

### Check Tool Execution
```python
# In on_function_call
logger.info(f"🔧 Tool: {name}, Args: {args}")
logger.debug(f"📊 Raw data keys: {list(raw_data.keys()) if raw_data else 'None'}")
logger.debug(f"📝 Transcript length: {len(raw_data.get('raw_call_log', []))}")
```

### Check Post-Call Data
```python
# In on_summary
logger.info(f"📊 Summary: {summary}")
logger.debug(f"📝 Raw data: {raw_data}")
logger.info(f"💾 Saving to interactions table...")
```

### Verify Database
```sql
-- Check interactions table
SELECT 
    id,
    lead_id,
    outcome,
    content,
    metadata->>'summary' as summary,
    metadata->>'conversation_transcript' as transcript,
    recording_url,
    created_at
FROM interactions
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🚨 Known Issues

1. **Transcript Capture**: Need to verify `save_interaction` tool is extracting `raw_call_log` from `raw_data` and saving it
2. **Recording URL**: Need to verify SignalWire provides recording URL in `raw_data` or `on_summary`
3. **Call Duration**: Need to calculate from call start/end timestamps

---

## 📝 Next Steps

1. **Test tool execution** - Verify all tools are called correctly
2. **Verify transcript capture** - Check if `raw_call_log` is being saved
3. **Test post-call summary** - Verify `on_summary` is called and data is saved
4. **Check recording URLs** - Verify SignalWire provides recording URLs
5. **Database verification** - Query `interactions` table to confirm all data is captured

