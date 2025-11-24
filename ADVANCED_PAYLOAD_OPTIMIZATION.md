# Advanced Payload Optimization Strategies

**Date**: November 24, 2025  
**Source**: SignalWire SWML Best Practices

---

## Strategy 1: Lazy Context Loading 🚀

### Concept:
Only send GREET context initially. Load VERIFY, QUALIFY, etc. dynamically when needed.

### Current Architecture:
```python
# swaig-agent/services/contexts.py
contexts = await build_contexts_structure(
    starting_node=current_node
)
# Returns ALL 8 contexts at once (~18,843 chars)
```

### Optimized Architecture:
```python
# Send only starting context initially
contexts = await build_single_context(node_name=current_node)
# Returns 1 context (~2,000 chars)

# On context switch, dynamically load next context
@app.post("/context-switch")
async def load_next_context(current: str, next: str):
    context = await build_single_context(node_name=next)
    return context
```

### Implementation:

**Step 1: Modify contexts builder**
```python
# swaig-agent/services/contexts.py

async def build_single_context(
    node_name: str,
    lead_context: Optional[Dict] = None,
    conversation_state: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Build ONLY the requested context, not all 8.
    For lazy loading optimization.
    """
    node_config = await get_node_config(node_name, "reverse_mortgage")
    
    step = {
        "name": "main",
        "text": node_config.get('instructions', ''),
        "valid_contexts": node_config.get('valid_contexts', []),
        "functions": node_config.get('functions', []),
        "step_criteria": node_config.get('step_criteria', '')
    }
    
    return {
        node_name: {"steps": [step]}
    }
```

**Step 2: Add context loading endpoint**
```python
# swaig-agent/main.py

@app.post("/webhooks/load-context")
async def load_context_dynamically(request: Request):
    """
    Dynamically load a context when AI switches nodes.
    Called via SWAIG action during context transitions.
    """
    data = await request.json()
    next_context = data.get('next_context')
    caller_id = data.get('caller_id')
    
    # Load lead data for personalization
    phone = caller_id.replace('+1', '').replace('+', '')
    lead = await get_lead_by_phone(phone)
    state = await get_conversation_state(phone)
    
    # Build only the requested context
    context = await build_single_context(
        node_name=next_context,
        lead_context=lead,
        conversation_state=state
    )
    
    return {"context": context}
```

**Savings**: 
- Initial payload: ~2,000 chars (1 context) vs ~18,843 chars (8 contexts)
- **87% reduction** on initial load ✅

---

## Strategy 2: Remove Duplication 🔍

### Current Duplication:

**Theme repeated in every context?** Let me check:

```python
# Currently in swaig-agent/main.py
prompt_text = combined_prompt_text  # Theme + caller context
# This goes in top-level prompt.text (good!)

# Each context has:
contexts = {
    "greet": {"steps": [{"text": greet_instructions}]},
    "verify": {"steps": [{"text": verify_instructions}]},
    ...
}
```

**Analysis**: ✅ **No theme duplication** - Theme is only in top-level `prompt.text`

### Where We DO Have Duplication:

**1. Tool Descriptions** (Biggest offender)

40 tools defined in SWML, but many are never used in certain contexts:

```python
# Current: ALL tools sent to SignalWire
"SWAIG": {
    "functions": [
        {"mark_phone_verified": {...}},  # 40 tools
        {"mark_email_verified": {...}},
        {"mark_address_verified": {...}},
        # ... 37 more
    ]
}

# Only VERIFY uses these 3 tools!
```

**Optimization**: Only send tools used by at least one context
```python
# Collect unique tools across all contexts
used_tools = set()
for context in contexts.values():
    for step in context['steps']:
        used_tools.update(step.get('functions', []))

# Only define those tools in SWAIG
"SWAIG": {
    "functions": [
        tool_defs[tool] for tool in used_tools
    ]
}
```

**Savings**: If we send 20 tools instead of 40 = **~4,000 chars (13%)**

**2. Repeated Instructions Across Nodes**

Example patterns that repeat:
- "⚠️ IMMEDIATELY call" (appears 15+ times)
- "⏸️ WAIT for answer" (appears 12+ times)
- "DO NOT proceed until tool is called" (appears 10+ times)

**Optimization**: Create instruction macros
```python
# In theme (top-level)
MACROS = {
    "CALL_TOOL": "⚠️ IMMEDIATELY call",
    "WAIT": "⏸️ WAIT for answer",
    "GUARD": "DO NOT proceed until tool is called"
}

# In node instructions
"{{CALL_TOOL}} mark_phone_verified()\n{{WAIT}}\n{{GUARD}}"
```

**Savings**: ~500 chars (2%)

---

## Strategy 3: Move Examples to Tools 💡

### Current Approach:

Examples embedded in instructions:

```
**Example 1**:
Lead: John Smith
User: "This is John"
→ mark_handoff_complete(new_person_name="John")

**Example 2**:
Lead: Mary Johnson  
User: "I'm Mary"
→ mark_handoff_complete(new_person_name="Mary")
```

### Optimized Approach:

**Create a "get_examples" tool**:

```python
# swaig-agent/tools/examples.py

EXAMPLES_DB = {
    "handoff_detection": [
        {"lead": "John Smith", "user_says": "This is John", "action": "mark_handoff_complete"},
        {"lead": "Mary Johnson", "user_says": "I'm Mary", "action": "mark_handoff_complete"}
    ],
    "objection_handling": [
        {"type": "third_party_approval", "script": "..."},
        {"type": "cost_fees", "script": "..."}
    ]
}

async def get_examples(category: str) -> Dict[str, Any]:
    """
    Return examples for a specific scenario.
    Called by AI when it needs clarification.
    """
    examples = EXAMPLES_DB.get(category, [])
    return {
        "response": json.dumps(examples),
        "action": []
    }
```

**In instructions**:
```
BEFORE (verbose):
**Example 1**: Lead: John Smith, User: "This is John" → mark_handoff_complete(new_person_name="John")
**Example 2**: Lead: Mary Johnson, User: "I'm Mary" → mark_handoff_complete(new_person_name="Mary")
**Example 3**: Lead: Robert Williams, User: "Robert here" → mark_handoff_complete(new_person_name="Robert")

AFTER (concise):
When user confirms identity, call mark_handoff_complete(new_person_name="[FirstName]")
If unsure, call get_examples(category="handoff_detection")
```

**Savings**: ~1,500 chars (5%) across all nodes

**Bonus**: Examples become updatable without touching prompts!

---

## Strategy 4: Remove ALL Duplication (Aggressive)

### What Else Can We Dedupe?

**1. Routing Instructions**

Currently in BOTH `step_criteria` AND `instructions`:

```
instructions: "If qualified=false, route to GOODBYE"
step_criteria: "Route: qualified=false → GOODBYE"
```

**Optimization**: Remove from instructions, keep only in step_criteria
**Savings**: ~1,000 chars (3%)
**Trade-off**: Less explicit for AI

**2. Tool Call Guards**

Repeated pattern:
```
⚠️ IMMEDIATELY call mark_phone_verified()
DO NOT proceed until tool is called.
```

**Optimization**: Move to theme as "CRITICAL RULE: Always call tools immediately after receiving info"
**Savings**: ~800 chars (3%)

---

## Combined Optimization Plan

### Option A: Conservative (If payload is slightly too big)

1. ✅ Remove unused tools from SWAIG (-4,000 chars / 13%)
2. ✅ Remove `role` fields (-2,400 chars / 8%)
3. ✅ Condense GOODBYE examples (-1,000 chars / 3%)

**Total**: -7,400 chars (24% reduction)  
**New size**: ~31 KB → ~24 KB

---

### Option B: Moderate (If significantly too big)

All of Option A, plus:
4. ✅ Move examples to tools (-1,500 chars / 5%)
5. ✅ Create instruction macros (-500 chars / 2%)
6. ✅ Remove routing from instructions (-1,000 chars / 3%)

**Total**: -10,400 chars (34% reduction)  
**New size**: ~31 KB → ~21 KB

---

### Option C: Aggressive (Maximum optimization)

All of Option B, plus:
7. ✅ **Lazy context loading** (-87% initial payload!)
8. ✅ Dynamic context switching via webhook

**Initial payload**: ~31 KB → **~4 KB** (only GREET + theme)  
**Subsequent contexts**: Loaded on-demand (~2 KB each)

**Benefits**:
- ✅ Fastest initial connection
- ✅ Minimal bandwidth per call
- ✅ Scales to unlimited contexts
- ✅ Future-proof architecture

**Trade-offs**:
- ⚠️ More complex (webhook for context loading)
- ⚠️ Slight latency on context switches (~50-100ms)
- ⚠️ Requires robust error handling

---

## Implementation Roadmap

### Phase 1: Test Current (No Changes)
1. Deploy as-is
2. Monitor for payload errors
3. Measure actual SWML size

**Decision point**: If no errors → DONE ✅

---

### Phase 2: Quick Wins (If needed)
1. Remove unused tools from SWAIG
2. Remove `role` fields
3. Condense GOODBYE

**Timeline**: 1 hour  
**Risk**: Low

**Decision point**: If still too big → Phase 3

---

### Phase 3: Structural Changes (If still needed)
1. Move examples to tools
2. Create instruction macros
3. Remove duplication

**Timeline**: 3-4 hours  
**Risk**: Medium (requires testing)

**Decision point**: If still too big → Phase 4

---

### Phase 4: Lazy Loading (Nuclear option)
1. Implement single context builder
2. Add context loading webhook
3. Update SWML to support dynamic contexts
4. Extensive testing

**Timeline**: 1 day  
**Risk**: Medium-High (architectural change)

---

## My Recommendation

### Start with Phase 1 (Test as-is)
- Current payload (~40-50 KB) is likely fine
- SignalWire probably supports 100-500 KB
- No premature optimization

### If errors occur:
- **Phase 2 first** (quick wins, low risk)
- **Phase 3 if needed** (structural, medium risk)
- **Phase 4 only if desperate** (lazy loading, higher complexity)

### Best long-term strategy:
**Lazy loading** is the most scalable. If you plan to:
- Add more nodes (beyond 8)
- Add multilingual support (duplicate contexts per language)
- Support multiple verticals (different prompt sets)

Then lazy loading becomes essential eventually.

---

## Bottom Line

**Current**: ~40-50 KB payload  
**Risk**: LOW (likely fine)  
**Action**: Deploy → Monitor → Optimize if needed  
**Backup**: 4-phase optimization plan ready

We have options. Let's test first! 🚀

