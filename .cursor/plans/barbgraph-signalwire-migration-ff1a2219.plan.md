<!-- ff1a2219-4b85-4337-ae08-991c0645ff11 edc32f9b-25b6-4d8e-ace9-8d40cba8969b -->
# BarbGraph → SignalWire Native Contexts Migration

## Overview

Replace custom Python routing with SignalWire's native contexts system. Delete routers.py, node_completion.py, and manual routing logic. Enable POM mode and build contexts from database prompts.

**Critical Rule:** Delete code, don't comment it out. Clean break only - no hybrid systems.

---

## Phase 1: Database Migrations

Create SQL migration file: `database/migrations/2025-11-13_contexts_migration.sql`

### Tasks:

1. **Create `contexts_config` table** for context-level settings (isolated, fillers)
2. **Add columns to `prompts` table**: `step_name` (TEXT), `step_order` (INTEGER)
3. **Update `prompt_versions.content` JSONB** to include:

   - `step_criteria` - When to advance step
   - `valid_contexts` - Which contexts can follow
   - `valid_steps` - Which steps can follow

4. **Update all 8 node prompts** with variable syntax:

   - GREET: Use `{lead.first_name}`, `{property.city}`, `{property.state}`
   - VERIFY: Use `{lead.first_name}`, call `mark_wrong_person` tool
   - QUALIFY: Use `{lead.first_name}`, `{property.equity_formatted}`, `{status.qualified}`
   - QUOTE: Use `{property.equity_formatted}`, call `mark_quote_presented`
   - ANSWER: Use `{lead.first_name}`, `{property.city}`, `{status.broker_name}`, `{status.broker_company}`
   - OBJECTIONS: Use `{lead.first_name}`, call `mark_objection_handled`
   - BOOK: Use `{lead.first_name}`, `{status.broker_name}`, call `mark_appointment_booked`
   - EXIT: Use `{lead.first_name}`, transition to greet for wrong person scenario

**Key File:** `database/migrations/2025-11-13_contexts_migration.sql`

**Routing Logic (as SQL):**

- GREET → ["verify", "exit"]
- VERIFY → ["qualify", "exit"]
- QUALIFY → ["quote", "exit"]
- QUOTE → ["answer", "book", "exit"]
- ANSWER → ["objections", "book", "exit"]
- OBJECTIONS → ["answer", "book", "exit"]
- BOOK → ["exit"]
- EXIT → ["greet"]

---

## Phase 2: Create Contexts Builder Service

Create new file: `equity_connect/services/contexts_builder.py`

### Functions to implement:

1. **`build_contexts_object(vertical, initial_context, lead_context)`**

   - Main entry point
   - Returns complete contexts dict ready for `agent.set_prompt()`
   - Includes "default" context + all 8 BarbGraph contexts

2. **`_query_contexts_from_db(vertical)`**

   - Query `prompts` and `prompt_versions` tables
   - Group by context_name (node_name)
   - Extract steps, valid_contexts, functions arrays
   - Return structured dict

3. **`_build_default_context(initial_context)`**

   - Required by SignalWire
   - Single step that routes to initial_context
   - Uses `skip_user_turn: true` to route immediately

4. **`_build_context(context_name, context_config)`**

   - Build individual context object
   - Add steps array
   - Add isolated flag if true
   - Add enter/exit fillers if present

5. **`load_theme(vertical)`**

   - Query `theme_prompts` table
   - Return theme text content

**Key File:** `equity_connect/services/contexts_builder.py` (~350 lines)

**Database Query Pattern:**

```python
supabase.table('prompts') \
    .select('*, prompt_versions!inner(*)') \
    .eq('vertical', vertical) \
    .eq('is_active', True) \
    .execute()
```

---

## Phase 3: Refactor barbara_agent.py

File: `equity_connect/agent/barbara_agent.py`

### DELETE Completely (lines to remove):

1. **Import statements (lines 8-13):**

   - Delete `from equity_connect.workflows.routers import ...`
   - Delete `from equity_connect.workflows.node_completion import is_node_complete`
   - Delete `from equity_connect.services.prompt_loader import build_context_injection, load_node_prompt`
   - Keep only: `from equity_connect.services.prompt_loader import load_theme`

2. **Delete all routing methods:**

   - `check_and_route()` - entire method
   - `_route_to_node()` - entire method
   - `_get_next_node()` - entire method
   - `_build_transition_message()` - entire method
   - `_apply_node_function_restrictions()` - entire method
   - Total: ~300 lines deleted

3. **Delete BarbGraph state (lines 61-64):**
   ```python
   self.current_node = "greet"
   self.phone_number = None
   self.call_type = "inbound"
   ```


### MODIFY:

1. **Constructor `__init__()` (line 36):**

   - Change `use_pom=False` → `use_pom=True`
   - Remove BarbGraph state variables

2. **Replace `configure_per_call()` method (line 68, currently ~180 lines):**

   - NEW implementation (~60 lines):
     - Extract phone from body_params
     - Set meta_data with variables (lead, property, status objects)
     - Call `_get_initial_context(phone)` to determine starting context
     - Call `build_contexts_object()` to get contexts JSON
     - Call `load_theme()` to get theme text
     - Call `agent.set_prompt({"text": theme, "contexts": contexts_obj})`

### ADD New Method:

**`_get_initial_context(phone: str) -> str`** (full implementation from plan lines 606-657):

- Query conversation_state from database
- Check flags in priority order:

  1. `appointment_booked` → "exit"
  2. `ready_to_book` → "book"
  3. `quote_presented` + positive reaction → "answer"
  4. `qualified` but no quote → "quote"
  5. `verified` but not qualified → "qualify"
  6. `greeted` → "verify"
  7. Default → "greet"

- Add logging for each decision
- Return context name as string

**Key File:** `equity_connect/agent/barbara_agent.py`

**Variables Structure:**

```python
agent.set_meta_data({
    "lead": {
        "first_name": "...",
        "name": "...",
        "phone": "...",
        "email": "...",
        "id": "..."
    },
    "property": {
        "city": "...",
        "state": "...",
        "address": "...",
        "equity": 0,
        "equity_formatted": "$0"
    },
    "status": {
        "qualified": False,
        "call_type": "inbound",
        "broker_name": "...",
        "broker_company": "..."
    }
})
```

---

## Phase 4: Delete Old Routing Files

### Files to DELETE completely:

1. **`equity_connect/workflows/routers.py`**

   - Delete entire file (~200 lines)
   - Contains: 8 router functions (route_after_greet, route_after_verify, etc.)
   - Reason: Routing now defined in database via `valid_contexts`

2. **`equity_connect/workflows/node_completion.py`**

   - Delete entire file (~150 lines)
   - Contains: `is_node_complete()` and 8 completion checkers
   - Reason: Completion now defined via `step_criteria` strings

### Files to MODIFY:

3. **`equity_connect/services/prompt_loader.py`**

   - Keep ONLY: `load_theme(vertical)` function
   - DELETE:
     - `build_context_injection()` - replaced by `set_meta_data()`
     - `build_instructions_for_node()` - moved to contexts_builder
     - `load_node_prompt()` - moved to contexts_builder
   - Result: File goes from ~200 lines → ~30 lines

---

## Phase 5: Tool Registration (No Changes)

**All 21 tools stay exactly the same:**

- `equity_connect/tools/lead.py` (5 tools)
- `equity_connect/tools/calendar.py` (4 tools)
- `equity_connect/tools/knowledge.py` (1 tool)
- `equity_connect/tools/interaction.py` (4 tools)
- `equity_connect/tools/conversation_flags.py` (7 tools)

**Only difference:** Tools are now registered in database via `functions` arrays in steps:

```json
{
  "steps": [
    {
      "name": "answer_questions",
      "functions": ["search_knowledge", "mark_ready_to_book"],
      "text": "Answer questions..."
    }
  ]
}
```

Tools are still decorated with `@AgentBase.tool` - that registration still happens automatically.

---

## Verification Checklist

Before considering migration complete:

- [ ] SQL migration file created in `database/migrations/2025-11-13_contexts_migration.sql`
- [ ] All 8 nodes have `valid_contexts` defined in SQL
- [ ] All 8 nodes have prompts updated with `{variable}` syntax
- [ ] `contexts_builder.py` created with all 5 functions
- [ ] `barbara_agent.py` has `use_pom=True`
- [ ] `barbara_agent.py` has new `_get_initial_context()` method
- [ ] `barbara_agent.py` has refactored `configure_per_call()` method
- [ ] `barbara_agent.py` deleted all routing methods (~300 lines removed)
- [ ] `routers.py` deleted completely
- [ ] `node_completion.py` deleted completely
- [ ] `prompt_loader.py` simplified to only `load_theme()`
- [ ] All imports updated (removed routers, node_completion imports)
- [ ] No `use_pom=False` anywhere
- [ ] No `set_prompt_text()` calls (replaced with `set_prompt()`)
- [ ] No manual `switch_context()` calls

---

## Critical Rules (DO NOT VIOLATE)

1. **DELETE routing code completely** - don't comment it out
2. **NO string interpolation in Python** - variables expand in database prompts only
3. **NO business logic in contexts_builder.py** - just data transformation
4. **NO hard-coded prompts** - everything from database
5. **Use `{variable}` syntax** - NOT `%{variable}` (that's for SWML flows)
6. **Follow migration SQL exactly** - don't optimize schema
7. **Implement full `_get_initial_context()`** - don't simplify
8. **Less code, not more code** - deletion-heavy refactor

---

## File Summary

**NEW:**

- `database/migrations/2025-11-13_contexts_migration.sql` (~200 lines)
- `equity_connect/services/contexts_builder.py` (~350 lines)

**DELETED:**

- `equity_connect/workflows/routers.py` (DELETE)
- `equity_connect/workflows/node_completion.py` (DELETE)

**MODIFIED:**

- `equity_connect/agent/barbara_agent.py` (remove ~300 lines, add ~100 lines)
- `equity_connect/services/prompt_loader.py` (remove ~170 lines, keep ~30 lines)

**NO CHANGE:**

- All 21 tools in `equity_connect/tools/*.py`
- Database schema (just adding columns/table)
- Conversation state logic
- Multi-call persistence (improved via `_get_initial_context()`)

**Net Result:** ~500 lines of custom routing code → ~100 lines of context selection logic

### To-dos

- [ ] Create database/migrations/2025-11-13_contexts_migration.sql with contexts_config table, prompts columns, and all 8 node updates with variable syntax
- [ ] Create equity_connect/services/contexts_builder.py with build_contexts_object(), query functions, and load_theme()
- [ ] Refactor equity_connect/agent/barbara_agent.py: enable POM, delete routing methods, add _get_initial_context(), replace configure_per_call()
- [ ] Delete equity_connect/workflows/routers.py and equity_connect/workflows/node_completion.py completely
- [ ] Simplify equity_connect/services/prompt_loader.py to keep only load_theme() function
- [ ] Verify all checklist items: POM enabled, imports updated, no routing code remains, variable syntax correct