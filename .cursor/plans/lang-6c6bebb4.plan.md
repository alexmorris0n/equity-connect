<!-- 6c6bebb4-43b6-49ec-a87b-08245b3c83c1 a303d6cd-4fc2-4ef7-b009-d052b8013bf2 -->
# Deterministic Call Lifecycle + DB-Backed Routing Plan

We’ll implement the remaining foundations so calls never get stuck or skip, using your chosen policies:

- One active row per phone_number/lead identity (reuse/refresh row on new calls)
- Deep-merge semantics for conversation_data (arrays append-unique)
- Increment call_count only on start_call (reuse flow), not on completion

### A) Database Migration

- Create `database/migrations/028_conversation_state.sql`:
                                                                                                                                                                                                                                                                - Table `conversation_state` with:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `id uuid pk`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `phone_number text not null`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `lead_id uuid references leads(id)`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `qualified boolean default false`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `current_node text`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `conversation_data jsonb default '{}'`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `call_count int default 1`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `last_call_at timestamptz default now()`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `topics_discussed text[]`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `call_status text default 'active'`  (active | completed | abandoned)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `call_ended_at timestamptz`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `created_at timestamptz default now()`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `updated_at timestamptz default now()`
                                                                                                                                                                                                                                                                - Indexes on `phone_number`, `call_status`, `lead_id`
                                                                                                                                                                                                                                                                - Add `updated_at` trigger:
    ```sql
    CREATE OR REPLACE FUNCTION set_conversation_state_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    DROP TRIGGER IF EXISTS trg_conversation_state_updated_at ON conversation_state;
    
    CREATE TRIGGER trg_conversation_state_updated_at
    BEFORE UPDATE ON conversation_state
    FOR EACH ROW
    EXECUTE PROCEDURE set_conversation_state_updated_at();
    ```


### B) Service Layer (Supabase)

- New `livekit-agent/services/conversation_state.py`:
                                                                                                                                                                                                                                                                - `start_call(phone, metadata)` — one active row per phone:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - If no row → create with `call_count=1`, `call_status='active'`, `last_call_at=now()`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - If row `completed` → reuse row, `call_count+=1`, `call_status='active'`, reset transients (see section C), preserve durables (see section C), `last_call_at=now()`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - If row `active` at new session → set `call_status='completed'`, `exit_reason='interrupted_or_replaced'`, then apply reuse flow above (increment happens here only)
                                                                                                                                                                                                                                                                - `get_conversation_state(phone)`
                                                                                                                                                                                                                                                                - `update_conversation_state(phone, updates)` — deep-merge `conversation_data` (scalars overwrite; nested dicts merge; arrays append-unique; `null` deletes key if provided)
                                                                                                                                                                                                                                                                - `mark_call_completed(phone, exit_reason)` — idempotent: only if current status is `active`; set `call_status='completed'`, `call_ended_at=now()`, `exit_reason=reason`; do NOT change `call_count`
                                                                                                                                                                                                                                                                - `extract_phone_from_messages(messages)` — fallback parsing if metadata missing

### C) Durable vs Transient Fields (Reset Policy)

- Durable (preserve across calls): `lead_id`, `qualified`, `topics_discussed`, `call_count`, `created_at`, `updated_at`
- Transient (reset on new call start): `current_node`, `verified`, `wrong_person`, `right_person_available`, `ready_to_book`, `has_objections`, `appointment_booked`, `appointment_datetime`, `exit_reason`, `node_visits`, KB telemetry (`kb_sources_count`, `kb_latency_ms`), `call_status` (set to `active` on start), `call_ended_at` (cleared), `last_call_at` (set to now)

### D) Deterministic Node Outputs (JSON) + Writers

- Node prompts (verify/qualify/answer/objections/book/exit) instruct: “Return JSON only.”
- Parse JSON in node handlers and write explicit flags to DB via `update_conversation_state`:
                                                                                                                                                                                                                                                                - verify → `{ verified: bool, wrong_person: bool, right_person_available?: bool }`
                                                                                                                                                                                                                                                                - qualify → `{ qualified: bool, age_verified: bool, homeowner: bool }`
                                                                                                                                                                                                                                                                - answer → `{ ready_to_book: bool, has_objections: bool, topics_discussed: string[] }` plus RAG telemetry
                                                                                                                                                                                                                                                                - objections → `{ has_objections: bool, ready_to_book: bool }`
                                                                                                                                                                                                                                                                - book → `{ appointment_booked: bool, appointment_datetime: iso8601 }`
                                                                                                                                                                                                                                                                - exit → `{ exit_reason: string, right_person_available?: bool }`

### E) Loop Guardrails

- Maintain `conversation_data.node_visits: { [node]: int }`
- Each node increments its count; routers apply soft caps, e.g. `answer>5 → exit` or force a close prompt

### F) Exact DB Contract for Routers

- Routers read keys only from DB (no heuristics):
                                                                                                                                                                                                                                                                - Top-level: `lead_id`, `qualified`, `current_node`, `call_status`
                                                                                                                                                                                                                                                                - `conversation_data` keys:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `verified`, `wrong_person`, `right_person_available`, `ready_to_book`, `has_objections`, `node_visits`, `appointment_booked`, `exit_reason`, `topics_discussed`

### G) Routers Implementation (`livekit-agent/workflows/routers.py`)

- `route_after_greet(state)`: if `wrong_person && right_person_available` → `greet` (re-greet spouse after short wait); elif `wrong_person` → `exit`; elif `lead_id && qualified` → `answer`; elif `lead_id` → `qualify`; else `verify`
- `route_after_verify(state)`: if `wrong_person && right_person_available` → `greet`; elif `wrong_person` → `exit`; elif `verified` → `qualify`; else `verify` (with visit cap)
- `route_after_qualify(state)`: if `qualified` → `answer`; else `exit`
- `route_after_answer(state)`: if `ready_to_book` → `book`; elif `has_objections` → `objections`; elif `node_visits.answer > 5` → `exit`; else `answer`
- `route_after_objections(state)`: if `ready_to_book` → `book`; elif `has_objections` → `answer`; else `answer`
- `route_after_exit(state)`: read DB; if `conversation_data.right_person_available` → `greet`; else → `END`

### H) Exit Node Behavior (Wrong-Person Quick Fix)

- Exit node prompt includes only behavior and flags; it does not route:
                                                                                                                                                                                                                                                                - If wrong person but right person available: ask to transfer, wait ~10s, then set `right_person_available=true` in DB; router decides next hop
- Graph change: `exit` no longer unconditional to END; add conditional edges wired to `route_after_exit`

### I) LangGraph Wiring (`livekit-agent/workflows/conversation_graph.py`)

- Messages-only state; per node: load prompt (persona + intent + node.md); `llm.bind_tools(all_tools)`; append AI message; routers fetch DB to decide next node
- Add conditional edges for exit:
  ```python
  workflow.add_conditional_edges("exit", route_after_exit)
  ```


### J) Agent Entrypoint (`livekit-agent/agent.py`)

- On connect: parse `participant.metadata` (phone,name,lead_id,qualified) → `start_call(phone, metadata)`
- On disconnect (BYE/room close): call `mark_call_completed(phone, exit_reason)` with reason (`hangup`,`no_response`,`error`) — idempotent check shields network drops and restarts
- Keep LLM inside LangGraph via `LLMAdapter(graph=create_conversation_graph(...))`; tools are bound in-graph only

### K) SIP Cloud Integration (SignalWire-specific metadata mapping)

- Map SIP/SignalWire call fields to `participant.metadata` when creating the room/token. Example:
```python
# api_server.py (SignalWire SWML webhook)
from datetime import datetime

def build_participant_metadata(request_data: dict, lead):
    """
    SignalWire SWML webhook provides call data in request body.
    Expected fields:
  - call.from: E.164 phone number
  - call.to: Your SignalWire number
  - call.call_id: Unique call identifier
    """
    call_info = request_data.get("call", {})
    from_number = call_info.get("from")      # E.164
    to_number = call_info.get("to")
    call_id = call_info.get("call_id")

    return {
        "phone_number": from_number,
        "signalwire_number": to_number,
        "call_id": call_id,
        "lead_id": str(lead.id) if lead else None,
        "qualified": bool(getattr(lead, "qualified", False)) if lead else False,
        "call_type": "inbound",
        "timestamp": datetime.utcnow().isoformat(),
    }

# token.with_metadata(json.dumps(build_participant_metadata(request.json, lead)))
```


### L) RAG Telemetry

- In `answer` and `objections` handlers, after RAG calls:
                                                                                                                                                                                                                                                                - write `kb_sources_count`, `kb_latency_ms`, `topics_discussed` (append-unique) via `update_conversation_state`

### M) Tests

- Unit tests: routers (mock service returning specific DB rows)
- Integration tests:

1) known qualified → greet→answer

2) unknown → verify→qualify→answer→book

3) not qualified → exit

4) objection loop → objections then back to answer

5) multi-call same number → call_count increments only on start_call, no stale active

6) wrong person → transfer available → re-greet path; unavailable → exit (simulate 10s wait via setting `right_person_available=true` in exit handler, then assert `route_after_exit` → `greet`)

7) verify fails 3× → exit

8) hangup mid-qualify → completion recorded with `exit_reason='hangup'`

9) simulated network drop → ensure idempotent completion (no double mark)

10) node_visits cap enforced → forced exit

### N) Optional Constraint (later)

- If required: enforce one active call per `lead_id` as well as per `phone_number`:
  ```sql
  CREATE UNIQUE INDEX idx_conversation_active_lead
  ON conversation_state(lead_id)
  WHERE call_status = 'active';
  ```

### To-dos

- [ ] Create migration for conversation_state table + updated_at trigger
- [ ] Implement start_call/update/mark_completed with deep-merge semantics
- [ ] Wire start_call on connect and idempotent mark_call_completed on disconnect
- [ ] Implement reset/preserve policy in start_call (topics preserved)
- [ ] Implement DB-driven routers using exact keys contract incl. wrong-person flow
- [ ] Add route_after_exit and conditional edges for exit node
- [ ] Update node handlers to parse JSON and write DB flags
- [ ] Track node_visits and apply soft caps in routers
- [ ] Write KB metrics and topics from answer/objections
- [ ] Add unit tests for routers with mocked DB service
- [ ] Add integration tests incl. failure paths and idempotent completion
- [ ] Add test for wrong-person transfer and re-greet behavior
- [ ] Implement SIP metadata mapping (api_server.py) and pass to token
- [ ] Use SignalWire SWML fields (call.from, call.to, call_id) in metadata