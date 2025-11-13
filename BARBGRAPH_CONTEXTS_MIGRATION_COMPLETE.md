# BarbGraph → SignalWire Contexts Migration COMPLETE

**Date:** 2025-11-13  
**Status:** ✅ COMPLETE - Ready for database migration review

---

## Executive Summary

Successfully migrated from custom BarbGraph routing to SignalWire's native contexts system. This was a **deletion-heavy refactor** that replaced ~500 lines of custom routing code with framework-native contexts and steps.

---

## What Changed

### ✅ NEW FILES CREATED

1. **`database/migrations/2025-11-13_contexts_migration.sql`** (~225 lines)
   - 5 commented sections for easy review
   - Creates `contexts_config` table
   - Adds `step_name` and `step_order` columns to `prompts`
   - Updates all 8 nodes with `valid_contexts` routing logic
   - Updates all 8 node prompts with `{variable}` syntax

2. **`equity_connect/services/contexts_builder.py`** (~233 lines)
   - `build_contexts_object()` - Main entry point
   - `_query_contexts_from_db()` - Database query with **tools→functions mapping**
   - `_build_default_context()` - Required SignalWire entry point
   - `_build_context()` - Individual context builder
   - `load_theme()` - Theme loader with error handling

### ❌ FILES DELETED

1. **`equity_connect/workflows/routers.py`** - Entire file deleted (~254 lines)
2. **`equity_connect/workflows/node_completion.py`** - Entire file deleted (~150 lines)
3. **`equity_connect/services/prompt_loader.py`** - Entire file deleted (~328 lines)

### ✏️ FILES MODIFIED

**`equity_connect/agent/barbara_agent.py`** - Major refactor

**Deleted (~514 lines):**
- All routing methods:
  - `_check_and_route_after_tool()`
  - `_get_next_node()`
  - `_build_transition_message()`
  - `_route_to_node()`
  - `_apply_node_function_restrictions()`
  - `_save_node_summary()`
  - `_format_node_data()`
  - `_get_next_node_from_state()`
- Routing logic in `on_function_call()`
- BarbGraph state variables: `self.current_node`, `self.phone_number`, `self.call_type`
- Old imports: routers, node_completion, prompt_loader functions

**Added (~170 lines):**
- New imports: `build_contexts_object`, `load_theme` from contexts_builder
- `_get_lead_context()` - SYNC method to query Supabase directly
- `_get_initial_context()` - Multi-call persistence logic
- New `configure_per_call()` - Uses contexts pattern
- Updated `on_swml_request()` - Uses contexts pattern with set_meta_data()

**Modified:**
- Constructor: `use_pom=False` → `use_pom=True`
- Skills: Now enabled (datetime, math) since POM supports them

---

## Key Architecture Changes

### Before (Custom BarbGraph)

```python
# Manual routing after every tool call
def on_function_call():
    result = super().on_function_call()
    routing_result = check_and_route()  # Manual check
    if routing_result:
        return routing_result  # Manual transition
    return result

# Manual prompt switching
def _route_to_node(node_name, phone):
    instructions = build_instructions_for_node(...)  # String concatenation
    result.switch_context(system_prompt=instructions)
    self.current_node = node_name  # Manual state tracking
```

### After (SignalWire Contexts)

```python
# No manual routing - contexts handle it
def on_function_call():
    result = super().on_function_call()
    return result  # Contexts handle routing automatically

# No manual prompt switching - just configuration
def on_swml_request():
    set_meta_data({...})  # Variables for substitution
    initial_context = _get_initial_context(phone)
    contexts_obj = build_contexts_object(...)
    theme_text = load_theme(...)
    set_prompt({"text": theme, "contexts": contexts_obj})
    # SignalWire handles the rest
```

---

## Variable Syntax

### Database Prompts Now Use `{variable}` Syntax:

**Example from GREET node:**
```
"Warmly greet {lead.first_name} from {property.city}, {property.state}..."
```

**Variables set via `set_meta_data()`:**
```python
agent.set_meta_data({
    "lead": {
        "first_name": "Testy",
        "name": "Testy Mctesterson",
        "phone": "+16505300051",
        "email": "alex@amorrison.email",
        "id": "uuid-here"
    },
    "property": {
        "city": "Inglewood",
        "state": "CA",
        "address": "123 Main St",
        "equity": 1000000,
        "equity_formatted": "$1,000,000"
    },
    "status": {
        "qualified": True,
        "call_type": "inbound",
        "broker_name": "Walter Richards",
        "broker_company": "My Reverse Mortgage"
    }
})
```

---

## Routing Logic Now in Database

**Old:** Python router functions (`route_after_greet`, etc.)

**New:** `valid_contexts` arrays in prompt_versions.content:

- **GREET** → `["verify", "exit"]`
- **VERIFY** → `["qualify", "exit"]`
- **QUALIFY** → `["quote", "exit"]`
- **QUOTE** → `["answer", "book", "exit"]`
- **ANSWER** → `["objections", "book", "exit"]`
- **OBJECTIONS** → `["answer", "book", "exit"]`
- **BOOK** → `["exit"]`
- **EXIT** → `["greet"]` (for wrong person re-greet)

---

## Tool-Function Mapping

**Database has:** `"tools": ["search_knowledge", "mark_ready_to_book"]`

**SignalWire needs:** `"functions": ["search_knowledge", "mark_ready_to_book"]`

**Mapping happens in `_query_contexts_from_db()`:**
```python
step = {
    "name": prompt.get('step_name', 'main'),
    "text": content.get('instructions', ''),
    "step_criteria": content.get('step_criteria', '...'),
    "functions": content.get('tools', [])  # ← Map database "tools" to step "functions"
}
```

---

## Error Handling Strategy

**Principle:** Fail loud, not silent

**In contexts_builder.py:**
- If no contexts found → raise ValueError
- If theme not found → raise ValueError
- No fallback prompts in code

**In barbara_agent.py:**
- Wrap critical calls in try/except
- Log errors with full context
- Re-raise exceptions (don't degrade)

**Example:**
```python
try:
    contexts_obj = build_contexts_object(...)
except Exception as e:
    logger.error(f"❌ Failed to build contexts: {e}")
    raise  # Fail loud
```

---

## Verification Checklist Results

### ✅ Database:
- [x] SQL file created with 5 commented sections
- [x] contexts_config table creation SQL ready
- [x] prompts table alteration SQL ready
- [x] All 8 nodes have valid_contexts arrays defined
- [x] All 8 nodes have prompts updated with {variable} syntax

### ✅ Code:
- [x] contexts_builder.py created with all 5 functions
- [x] contexts_builder.py maps tools→functions correctly
- [x] contexts_builder.py has error handling (raises ValueError)
- [x] barbara_agent.py imports updated correctly
- [x] barbara_agent.py has use_pom=True (line 35)
- [x] barbara_agent.py has _get_lead_context() method (SYNC)
- [x] barbara_agent.py has _get_initial_context() method
- [x] barbara_agent.py configure_per_call() uses contexts
- [x] barbara_agent.py on_swml_request() uses contexts
- [x] barbara_agent.py deleted ~514 lines of routing code
- [x] routers.py DELETED completely
- [x] node_completion.py DELETED completely
- [x] prompt_loader.py DELETED completely

### ✅ No Traces:
- [x] No use_pom=False
- [x] No set_prompt_text() calls
- [x] No switch_context() calls
- [x] No routing imports
- [x] No BarbGraph state variables
- [x] No manual routing logic

### ✅ Linting:
- [x] No linter errors in barbara_agent.py
- [x] No linter errors in contexts_builder.py

---

## Code Statistics

**Lines Deleted:** ~1,246 lines
- routers.py: 254 lines
- node_completion.py: 150 lines
- prompt_loader.py: 328 lines
- barbara_agent.py routing methods: 514 lines

**Lines Added:** ~408 lines
- contexts_migration.sql: 225 lines
- contexts_builder.py: 233 lines
- barbara_agent.py helper methods: ~170 lines
- barbara_agent.py updated methods: -220 lines (net reduction)

**Net Result:** **-838 lines** (deletion-heavy refactor)

---

## Next Steps

### 1. Review SQL Migration
```bash
# Review the migration file
cat database/migrations/2025-11-13_contexts_migration.sql
```

The SQL is organized into 5 sections:
1. Create contexts_config table
2. Alter prompts table
3. Add step_criteria defaults
4. Add valid_contexts routing
5. Update prompts with variable syntax

### 2. Run SQL Migration (MANUAL - DO NOT AUTO-EXECUTE)
```bash
# Connect to Supabase and run the migration
# Review each section before executing
```

### 3. Test the Agent
```bash
# Start the agent
cd equity_connect
python -m equity_connect.agent.barbara_agent

# Test call to verify:
# - Greeting uses variables ({lead.first_name}, {property.city})
# - Contexts transition naturally
# - Tools still callable
# - Multi-call persistence works
```

### 4. Monitor Logs
Look for:
- ✅ "Built X contexts" - confirms contexts loaded
- ✅ "Initial context: greet" - confirms routing logic
- ✅ "Variables set for [name]" - confirms meta_data working
- ❌ Any "No contexts found" errors
- ❌ Any "No theme found" errors

---

## Testing Scenarios

1. **New caller:** Should start at "greet" context
2. **Returning caller (qualified):** Should resume at "quote" or "answer"
3. **Appointment booked:** Should go to "exit"
4. **Variables expansion:** {lead.first_name} should become "Testy" not literal string

---

## Rollback Plan (If Needed)

```bash
# Revert git changes
git checkout equity_connect/agent/barbara_agent.py
git checkout equity_connect/services/
git checkout equity_connect/workflows/

# Don't run the SQL migration
# (or rollback with: DROP TABLE contexts_config; ALTER TABLE prompts DROP COLUMN...)
```

---

## Critical Reminders

1. **Variable syntax:** Use `{variable}` NOT `%{variable}` (that's for SWML flows)
2. **Error handling:** Code fails loudly - no silent fallbacks
3. **Tools still work:** All 21 tools unchanged, still decorated with @AgentBase.tool
4. **Two-level registration:** Python decorators (global) + functions arrays (step-level)
5. **Theme placement:** Goes in `text` field, not repeated per-context
6. **All methods SYNC:** configure_per_call, _get_lead_context, _get_initial_context

---

## Files Changed Summary

**NEW:**
- database/migrations/2025-11-13_contexts_migration.sql
- equity_connect/services/contexts_builder.py

**DELETED:**
- equity_connect/workflows/routers.py
- equity_connect/workflows/node_completion.py  
- equity_connect/services/prompt_loader.py

**MODIFIED:**
- equity_connect/agent/barbara_agent.py

**UNCHANGED:**
- All 21 tools in equity_connect/tools/*.py
- Database schema (migrations add columns/table, don't modify existing)
- Conversation state logic
- All tool decorators and implementations

---

## Success Criteria

Migration is successful if:

- ✅ Agent starts without errors
- ✅ Logs show "Built X contexts" messages
- ✅ Variables expand correctly in prompts
- ✅ Contexts transition naturally (greet → verify → qualify...)
- ✅ Tools are still callable
- ✅ Multi-call persistence works (resume where left off)
- ✅ No routing errors in logs

---

**🎉 Migration complete! Review the SQL migration file and run it when ready.**

