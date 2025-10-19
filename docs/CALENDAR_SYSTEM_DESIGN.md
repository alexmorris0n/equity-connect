# Calendar Platform Architecture

**Last Updated:** October 18, 2025  
**Author:** Codex (GPT-5)  
**Scope:** Unified calendar system for Equity Connect brokers accessible from the OpenAI Realtime bridge (`bridge/tools.js`) and n8n workflows.

---

## 1. Goals & Requirements

- Enable up to **100 broker calendars** to sync into a single availability layer.
- Support **multiple providers**: Google Workspace/Calendar, Microsoft Outlook/Exchange, iCloud (CalDAV/ICS), and GoHighLevel (GHL).
- Provide **read** (availability lookup) and **write** (booking) access as standardized tools for:
  - OpenAI Realtime voice agent (Barbara) via `check_broker_availability` / `book_appointment`.
  - n8n automations (email CTA follow-ups, microsite scheduling, manual overrides).
- Persist all bookings and sync metadata in **Supabase**.
- Maintain **provider webhooks / polling** to keep busy blocks accurate (≤ 5 min drift).
- Make the system stateless for bridge and n8n nodes (all state in Supabase).

---

## 2. High-Level Architecture

```
┌─────────────────────┐      ┌─────────────────────┐
│   Provider APIs      │      │    Provider Webhooks │
│  (Google, Outlook,   │◄────►│  (Google Push, MS    │
│   iCloud, GHL)       │      │   Graph, GHL)        │
└────────┬────────────┘      └────────┬────────────┘
         │                              │
         ▼                              │
┌────────────────────────────────────────────────────┐
│               Calendar Sync Worker                  │
│  (bridge/calendar-sync.js, runs via n8n Cron)       │
│  - Uses per-provider connectors                     │
│  - Stores tokens in Supabase vault                  │
│  - Writes events ➝ Supabase tables                  │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────┐
│                   Supabase                          │
│  broker_calendar_accounts (OAuth, secrets in Vault) │
│  broker_calendars (per calendar metadata)           │
│  calendar_events (busy/free blocks)                 │
│  calendar_availability_overrides (manual blocks)    │
│  calendar_bookings (confirmed AI / human bookings)  │
│  calendar_sync_state (last sync timestamps/errors)  │
│  calendar_working_hours (defaults/overrides)        │
│  calendar_slot_cache (15 min availability cache)    │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────┐
│          Consumers (stateless tool layer)           │
│  bridge/tools.js ➝ calendarService.getAvailability  │
│  bridge/tools.js ➝ calendarService.bookAppointment  │
│  n8n HTTP node ➝ /calendar/availability endpoint    │
│  n8n Supabase node ➝ call RPCs (get_availability)   │
└────────────────────────────────────────────────────┘
```

---

## 3. Supabase Data Model

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `broker_calendar_accounts` | `id`, `broker_id`, `provider`, `status`, `vault_secret_id`, `refresh_token`, `_metadata` | One OAuth/Credential bundle per broker/provider. Tokens stored via Supabase Vault; only metadata and references live in plain tables. |
| `broker_calendars` | `id`, `account_id`, `external_calendar_id`, `display_name`, `timezone`, `is_primary`, `sync_window_days`, `color` | Each exposed calendar (brokers may share accounts but expose distinct calendars). |
| `calendar_events` | `id`, `calendar_id`, `external_event_id`, `start_time`, `end_time`, `is_busy`, `source`, `raw_payload`, `last_seen_at` | Normalized event blocks. Only busy blocks stored—free time derived. |
| `calendar_bookings` | `id`, `lead_id`, `broker_id`, `calendar_id`, `slot_start`, `slot_end`, `status`, `created_by` (`ai_bridge`, `n8n`, `manual`), `provider_event_id`, `meeting_link` | Canonical record for confirmed appointments. |
| `calendar_availability_overrides` | `id`, `calendar_id`, `type` (`block`, `open`), `start_time`, `end_time`, `reason`, `created_by` | Manual control for brokers or ops to force availability. |
| `calendar_working_hours` | `broker_id`, `weekday`, `start_local`, `end_local`, `is_active` | Default office hours (fallback when provider doesn't expose). |
| `calendar_slot_cache` | `broker_id`, `generated_for` (ISO date), `resolution_minutes`, `slots` (JSONB array), `expires_at` | Precomputed availability matrix to avoid recalculating for each tool hit. |
| `calendar_sync_state` | `calendar_id`, `last_synced_at`, `last_webhook_at`, `status`, `error_message` | Monitoring and observability for sync health. |

**Indexes & Constraints**
- Unique `(calendar_id, external_event_id)` on `calendar_events`.
- Unique `(lead_id, slot_start)` on `calendar_bookings` to prevent duplicates.
- Partial index on `calendar_events` for future windows (`start_time >= now()`).
- Row-level security aligned with broker access (bridge uses service role).

---

## 4. Provider Connectors

### Google Calendar
- OAuth 2.0 (offline access) with Supabase Vault storing refresh_token.
- Use `@googleapis/calendar`.
- Webhook via channel watch (renew every 7 days) → worker endpoint.

### Microsoft Outlook / Office 365
- Microsoft Graph API, delegated OAuth with offline `refresh_token`.
- Use `@microsoft/microsoft-graph-client`.
- Subscriptions + webhooks for changes (renew every 3 days).

### iCloud Calendar
- CalDAV using app-specific password.
- Use `node-caldav` or custom CalDAV client.
- No webhooks → Poll every 5 minutes / delta sync via `sync-token`.

### GoHighLevel (GHL)
- REST API `v1/appointments` endpoints per calendar.
- API key per sub-account.
- Webhooks: `appointment.status.updated` for near real-time sync.

Each connector implements a shared interface in `bridge/calendar/providers/*`:
```ts
interface CalendarConnector {
  listCalendars(account): Promise<CalendarMetadata[]>;
  listEvents(calendar, window): Promise<CalendarEvent[]>;
  createEvent(calendar, bookingPayload): Promise<CreateEventResult>;
  deleteEvent(calendar, eventId): Promise<void>;
}
```

---

## 5. Sync Worker

`bridge/calendar/sync.js` (invoked via `npm run calendar:sync` or n8n Cron):
1. Fetch all active `broker_calendar_accounts`.
2. For each account:
   - Load credentials from Supabase Vault.
   - Refresh tokens if needed.
   - Discover calendars (first run or when flagged).
   - Loop through calendars and call `listEvents` for windows:
     - Past 1 day (cleanup for cancellations).
     - Next 30 days (configurable).
   - Upsert records into `calendar_events`.
   - Record heartbeat in `calendar_sync_state`.
3. Publish summary metrics (errors, latency) → Supabase `calendar_sync_logs`.

Webhook receiver endpoint (`/calendar/webhooks/:provider`) updates events immediately and inserts raw payloads into `calendar_events` (idempotent).

---

## 6. Availability Computation

### Algorithm
1. Determine scheduling window (default next 14 days, skip weekends unless broker opted-in).
2. Pull broker working hours (or fallback to 9am–5pm in broker timezone).
3. Merge busy blocks from:
   - `calendar_events` (`is_busy = true`).
   - `calendar_bookings` (pending or confirmed).
   - `calendar_availability_overrides` (type = `block`).
4. Carve free slots using desired slot duration (default 30 min).
5. Apply lead preferences (`preferred_day`, `preferred_time_of_day`).
6. Cache final result in `calendar_slot_cache` (resolution 15 min) to serve AI/N8N quickly.

Exposed via:
```ts
const slots = await calendarService.getAvailability({
  brokerId,
  durationMinutes: 30,
  windowDays: 14,
  preferredDay,
  preferredPeriod
});
```

---

## 7. Booking Flow

1. Bridge / n8n calls `calendarService.bookSlot(payload)` with:
   - `lead_id`, `broker_id`, `slot_start`, `slot_end`, `notes`, `channel`.
2. Service revalidates slot availability (race condition guard).
3. `createEvent` on provider.
4. Insert row in `calendar_bookings` with returned `provider_event_id` and `meeting_link`.
5. Update `interactions` + `billing_events` (existing logic).
6. Push confirmation:
   - n8n webhook for SMS/E-mail.
   - Update `calendar_events` via webhook or local upsert.

If provider call fails, roll back local insert with transactional block using Supabase RPC (`book_calendar_slot` function).

---

## 8. Security & Compliance

- Use Supabase **Vault** for all secrets (`refresh_token`, `client_secret`).
- Bridge runs with **service-role key** inside container; n8n uses signed JWT or dedicated service key.
- Webhook endpoints validate provider signatures (Google channel IDs, MS `validationToken`, GHL HMAC).
- All booking actions logged in `calendar_audit_log` table (who/what/when).
- Respect caller timezone: store all times in UTC, include broker timezone for display.

---

## 9. Implementation Phases

### Phase 1 – Foundations (Days 1-3)
1. Create Supabase migration introducing calendar tables + RLS.
2. Build `bridge/calendar` module scaffolding and config loader.
3. Replace placeholder `check_broker_availability` / `book_appointment` with service calls (feature-flagged).

### Phase 2 – Google & Outlook (Days 4-9)
1. Implement Google & Microsoft connectors (OAuth handshake, sync, booking).
2. Build sync worker + caching logic.
3. Create HTTP endpoints for n8n (`GET /calendar/availability`, `POST /calendar/book`).
4. End-to-end tests with two brokers (QA).

### Phase 3 – iCloud & GHL (Days 10-14)
1. Implement CalDAV polling for iCloud (app-specific password onboarding doc).
2. Add GoHighLevel connector (API key + webhooks).
3. Expand booking flow to support provider-specific meeting links.

### Phase 4 – Scale & Observability (Days 15+)
1. Dashboard in Supabase / Grafana for sync health.
2. Alerting for stale sync (>15 min).
3. Bulk onboarding tools (import 100 brokers via CSV or Supabase script).
4. Load testing (simulate 100 brokers, 1k slots request/min).

---

## 10. Integration Checklist

- [ ] Migration deployed (tables, vault policies, RPCs).
- [ ] `.env` updates: provider credentials, encryption keys.
- [ ] Bridge config flag `ENABLE_CALENDAR_SERVICE`.
- [ ] n8n nodes updated to call new endpoints.
- [ ] Broker onboarding SOP for providing OAuth consent / credentials.
- [ ] Runbook for rotating client secrets and handling provider outages.

---

## 11. Next Steps

1. Approve schema migration draft.
2. Decide hosting location for sync worker (Northflank cron vs dedicated container).
3. Prepare Google & Microsoft OAuth credentials (redirect URIs, consent screen).
4. Build minimal admin UI (could be Supabase UI) for viewing broker calendar status.

Once foundation is in place, Barbara’s tool calls and n8n workflows will consume the same availability engine, ensuring consistent booking logic across all channels.

