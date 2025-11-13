## MCP Migration Plan and Nylas SDK Integration

### Purpose
Move database-dependent tools behind MCP for stronger security, portability, and consistency with SignalWire’s MCP Gateway pattern, and evaluate replacing raw HTTP calls to Nylas with the official Python SDK or an MCP-backed Nylas connector.

### References
- SignalWire Agents MCP Gateway (pattern and examples): [https://github.com/signalwire/signalwire-agents/tree/main/mcp_gateway](https://github.com/signalwire/signalwire-agents/tree/main/mcp_gateway)
- Nylas Python SDK (official): [https://github.com/nylas/nylas-python](https://github.com/nylas/nylas-python)

---

## 1) Current State

### Tools that rely on Supabase
- Lead management (read/write)
  - `get_lead_context` (read)
  - `verify_caller_identity` (read/write: create/update lead rows)
  - `check_consent_dnc` (read)
  - `update_lead_info` (write)
  - `find_broker_by_territory` (read; sometimes write assignment)
- Conversation state flags (write-only flow flags in `conversation_state` JSONB)
  - `mark_ready_to_book`
  - `mark_has_objection`
  - `mark_objection_handled`
  - `mark_questions_answered`
  - `mark_quote_presented`
  - `mark_wrong_person`
  - `clear_conversation_flags`
- Interactions and telephony metadata (read/write)
  - `save_interaction`
  - `assign_tracking_number`
  - `send_appointment_confirmation`
  - `verify_appointment_confirmation`
- Calendar (uses external Nylas, but reads/writes config and logs in Supabase)
  - `check_broker_availability`
  - `book_appointment`
  - `reschedule_appointment`
  - `cancel_appointment`

### Always-available baseline tools
These flow-flag tools (and `get_lead_context`) are “always-on” at the agent level. They must remain callable regardless of UI selection; moving their implementations behind MCP must preserve this behavior.

---

## 2) Why Move to MCP

- Security and secrets hygiene: centralize credentials, minimize direct DB access from the agent worker.
- Decoupling: the voice agent focuses on conversation and tool schemas; data access is abstracted behind MCP.
- Observability and governance: consistent logging, retries, and error boundaries via the MCP gateway.
- Ecosystem alignment: matches the SignalWire Agents “MCP Gateway” pattern for tools and data access ([SignalWire MCP Gateway](https://github.com/signalwire/signalwire-agents/tree/main/mcp_gateway)).

---

## 3) Target Architecture (MCP)

- Register a Supabase MCP server (already available in this project) behind the SignalWire MCP Gateway.
- Keep tool schemas identical (names, params, return types) to avoid breaking the LLM prompt/programming.
- Implementation detail moves from “direct Supabase client” to “MCP call” per tool.
- Network and reliability:
  - Timeouts: 5–10s default, tool-specific overrides for heavier queries.
  - Retries: 1–2 retries for transient DB/network errors (exponential backoff).
  - Fallbacks: when read-only tools fail, surface a graceful, user-safe message; for writes, ensure idempotency via unique keys where possible.
- Auditing: log MCP request-id, duration, and response status in interaction logs.

---

## 4) Migration Plan (Phased)

Phase 1 — Read-only tools (low risk)
- `get_lead_context`, `check_consent_dnc`, `find_broker_by_territory`
- Validate latency/throughput; confirm parity of results.

Phase 2 — Flow flags (write, idempotent)
- `mark_ready_to_book`, `mark_has_objection`, `mark_objection_handled`, `mark_questions_answered`, `mark_quote_presented`, `mark_wrong_person`, `clear_conversation_flags`
- Guarantee idempotency (e.g., upsert/update by `phone_number` or `conversation_state.id`).

Phase 3 — Lead writes
- `verify_caller_identity`, `update_lead_info`
- Add defensive validation, schema guards; continue to enforce data invariants and audit logging.

Phase 4 — Calendar + interactions
- `check_broker_availability`, `book_appointment`, `reschedule_appointment`, `cancel_appointment`
- `save_interaction`, `assign_tracking_number`, `send_appointment_confirmation`, `verify_appointment_confirmation`
- Consider splitting calendar operations into a dedicated MCP (Nylas MCP) for clean separation.

Phase 5 — Decommission direct DB usage in the agent
- Remove direct Supabase client usage from the agent runtime where tools are concerned.
- Maintain direct DB read for non-tool bootstraps only if truly needed (prefer MCP everywhere practical).

---

## 5) Implementation Notes

- Tool APIs: Keep the exact JSON schemas. Only the caller path switches to MCP.
- Error taxonomy: Standardize error codes (e.g., `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `TIMEOUT`, `INTERNAL`) returned by MCP to the agent.
- Idempotency keys: Use natural keys (`phone_number`, `interaction_id`) for write tools to avoid duplicates on retry.
- Observability: Tag each MCP call with `interaction_id`, `tool_name`, and `node_name` for traceability.
- Rate limits: Enforce minimal client-side throttle (esp. for calendar/confirmation tools); MCP can apply server-side guards.

---

## 6) Nylas Integration: Python SDK vs HTTP vs MCP

We have three viable approaches for calendar (and related) tools:

Option A — Use MCP to front Nylas (Recommended for consistency)
- Create a dedicated Nylas MCP (or use an existing `nylas-api` MCP if available in the environment).
- MCP methods (examples): `nylas.get_calendars`, `nylas.check_availability`, `nylas.create_event`, `nylas.update_event`, `nylas.cancel_event`.
- Pros: Same security/observability benefits; consistent tool calling; secret isolation.
- Cons: One more hop vs direct SDK, but manageable with short-lived requests and caching.

Option B — Integrate Nylas Python SDK in the agent worker
- Use the official SDK in Python ([nylas-python](https://github.com/nylas/nylas-python)).
- Example operations: list calendars, create/update/cancel events; catch `NylasAPIError` for handling.
- Pros: Lower latency than an extra gateway hop; rich types; fewer raw HTTP details to manage.
- Cons: Credentials in agent runtime (needs secure secret management), more coupling between agent and external provider.

Option C — Raw HTTP (current pattern)
- Keep making direct HTTP requests to Nylas.
- Pros: No new dependency; full control over REST details.
- Cons: More boilerplate; higher maintenance; less consistent with overall MCP direction.

Recommendation (Current Decision)
- There is no Nylas MCP available in our environment today. We will embed the Nylas Python SDK in the agent (Option B) now, and keep the door open to wrap it behind an MCP later without changing tool schemas.

---

### 6.1) Nylas SDK Implementation Plan (Concrete)

Environment/Config
- Add dependency: `nylas` (PyPI).
- Env vars (in Fly.io/Secrets manager):
  - `NYLAS_API_KEY` (required)
  - `NYLAS_BASE_URL` (optional; use default for v3)
  - `NYLAS_NOTIFY_PARTICIPANTS_DEFAULT` (optional boolean default)
- Supabase-configured per-broker values:
  - `nylas_grant_id`
  - `default_calendar_id`

Wrapper Module
- Create `equity_connect/services/nylas_client.py`:
  - `list_calendars(grant_id: str) -> List[Calendar]`
  - `check_availability(grant_id: str, calendar_id: str, start_ts: int, end_ts: int) -> Dict`
  - `create_event(grant_id: str, calendar_id: str, title: str, description: str, start_ts: int, end_ts: int, attendees: List[Dict], notify: bool, external_id: Optional[str]) -> Dict`
  - `update_event(grant_id: str, event_id: str, fields: Dict, notify: bool) -> Dict`
  - `cancel_event(grant_id: str, event_id: str, notify: bool) -> None`
  - Error handling: catch `nylas.models.errors.NylasAPIError`, raise our normalized exceptions with code/message.
  - Idempotency: set `external_id` on create to avoid duplicates on retry.

Tool Wiring (no schema changes)
- `check_broker_availability` → `nylas_client.check_availability(...)`
- `book_appointment` → `nylas_client.create_event(...)` (attach `external_id = f"{interaction_id}:{phone}"`)
- `reschedule_appointment` → `nylas_client.update_event(...)`
- `cancel_appointment` → `nylas_client.cancel_event(...)`
- Continue persisting booking metadata to Supabase (via existing tool logic) after successful SDK calls.

Reliability/Observability
- Timeouts/retries around SDK calls (2 retries, backoff).
- Map errors to: `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `TIMEOUT`, `INTERNAL`.
- Log request_id (from Nylas response headers when available), duration, and tool name.

Security
- Keep `NYLAS_API_KEY` and any tenant/broker-specific auth in secrets (do not write to logs).
- Only expose normalized error messages to the LLM/tool result.

Fallback
- Feature flag to fall back to current HTTP implementation per tool if needed during rollout.

---

### 6.2) Knowledge Base via Supabase MCP (pgvector) — No Vertex Required

Summary
- If embeddings are stored in Supabase (pgvector), the Supabase MCP can handle KB semantic search end‑to‑end. Vertex AI is not required for lookups or retrieval‑augmented generation (RAG).
- Vertex is only needed if you want to use its embedding models or its managed vector store; otherwise pgvector + MCP is sufficient.

How it works
- The agent calls the existing `search_knowledge` tool → MCP endpoint (e.g., `kb.search`).
- MCP runs a pgvector similarity search in Supabase (with optional filters/MMR) and returns ranked chunks.
- The agent injects the returned chunks into the LLM prompt as context for answer generation.

Implementation checklist
- Schema: ensure a `vector` column (pgvector) sized to your embedding dimension (e.g., 1536) and metadata fields (vertical/language/recency).
- Index: create HNSW/IVFFlat index with the correct distance metric (cosine or inner product) and rebuild after bulk loads.
- Embeddings: if your KB is already embedded with the same model/dimension (e.g., “005”), no re‑embed is required. Track `embedding_provider`, `embedding_model`, `embedding_dim`, `version`.
- MCP endpoints to expose:
  - `kb.upsert_documents(chunks, metadata)` → embed (if needed) + insert/update rows
  - `kb.search(query, top_k, filters, mmr)` → return text + metadata + scores
  - `kb.delete(document_ids)` and (optional) `kb.reindex(source_id)`
- Results: return clean JSON (text, score, metadata) sized to the prompt budget.

Current environment (verified)
- pgvector extension is enabled
- `vector_embeddings` table exists with an `embedding` vector column
- An index exists on the embedding column

Rollout notes
- Keep the `search_knowledge` tool schema unchanged; just point it to MCP.kb.search.
- If you later switch embedding models, support dual vectors (old+new) and cut over after backfill.

---

## 7) Proposed Tool Surface (unchanged to the agent/LLM)

- Leads/consent/broker tools: same names and parameters; implementations now call Supabase MCP.
- Flow flag tools: same names; MCP writes to `conversation_state` with idempotency.
- Calendar tools: switch to the Nylas Python SDK internally (now), preserve function names and params. Optionally wrap behind an MCP later without changing tool schemas.
- Interactions/confirmations: same names; MCP-backed writes with consistent logging.

---

## 8) Risk Mitigation and Rollback

- Dual-path feature flag: for each tool, keep a “direct” implementation behind a feature flag to quickly revert.
- System health: temporary fallback to read-only mode when MCP is unavailable; degrade gracefully.
- Data correctness: writes are idempotent; include server-side constraints to prevent duplicates.
- Monitoring: add “MCP call success rate” and latency percentiles to the dashboard.

---

## 9) Rollout Checklist

1. Register Supabase MCP in the MCP Gateway; verify creds, ping, and simple SELECT.
2. Convert read-only tools to MCP; ship behind a feature flag; test live calls.
3. Convert flow flags and lead writes; validate data parity in Supabase.
4. Wire the Nylas Python SDK and convert calendar tools; exercise end-to-end booking.
5. Remove direct Supabase calls from the agent for converted tools; keep emergency fallback for one release.
6. Add metrics and alerts for MCP failures/timeouts; document runbooks.

KB Rollout Addendum (pgvector)
- Redirect `search_knowledge` to MCP.kb.search (pgvector) and remove Vertex dependency for lookups.
- Confirm index settings (dim/metric), filters, and MMR settings in MCP; reindex after any bulk upsert.

---

## 10) Notes for Nylas SDK Usage (if selected)

- Install: `pip install nylas --pre`
- Auth: Store API key/credentials in secure config; do not embed in code.
- Patterns to implement:
  - List calendars for `GRANT_ID`
  - Create event (title, description, start/end, timezone, notify participants)
  - Update/cancel event by ID
- Error handling: catch `nylas.models.errors.NylasAPIError`, map to tool error taxonomy.
- Idempotency: attach a request-id or external-id on events to avoid duplicates on retries.
- Webhooks: (optional) subscribe to event lifecycle to reconcile state in Supabase.

---

## 11) Expected Outcomes

- Cleaner separation of concerns: agent ≠ data layer.
- More consistent security model with centralized secrets.
- Easier tool portability and reuse via MCP.
- Reduced maintenance for HTTP glue by leveraging MCP and/or official SDKs.

---

## 12) Open Questions

- Do we want an “MCP first” policy for all external systems (Nylas, Instantly, etc.)?
- Are there any high-throughput tools that need SDK-level optimization (e.g., batch operations) before an MCP layer?
- Which data fields should be cached and for how long to reduce MCP/database round-trips during a single call?


