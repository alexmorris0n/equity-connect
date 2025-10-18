<!-- ef50beba-49c7-4230-957b-6b201fe94b5b 2502c784-5dc8-4f42-83a5-5dac97c9e9ae -->
# Vapi Number Pool & Barbara Call System (Final Plan)

This plan incorporates webhook security, E.164 enforcement, sequential broker dialing, a refined call trigger logic based on Instantly replies, and gives the Vapi assistant direct Supabase access.

## 1. Database Schema (Supabase)

*Adds Timezone, Foreign Keys, and E.164 enforcement notes.*

```sql
-- Brokers Table Additions
ALTER TABLE brokers
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Los_Angeles', -- For Cal.com scheduling
  ADD COLUMN IF NOT EXISTS primary_phone_e164 TEXT, -- Enforce E.164 on write
  ADD COLUMN IF NOT EXISTS secondary_phone_e164 TEXT, -- Enforce E.164 on write
  ADD COLUMN IF NOT EXISTS cal_user_id TEXT,
  ADD COLUMN IF NOT EXISTS cal_event_type_slug TEXT,
  ADD COLUMN IF NOT EXISTS number_pool_size INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS number_pool_active BOOLEAN DEFAULT FALSE;

-- Leads Table Additions
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS vapi_assignment_id UUID,
  ADD COLUMN IF NOT EXISTS primary_phone_e164 TEXT; -- Enforce E.164 on write

-- Add Foreign Key Constraint for Integrity
ALTER TABLE leads
  ADD CONSTRAINT fk_vapi_assignment
  FOREIGN KEY (vapi_assignment_id)
  REFERENCES vapi_number_assignments(id) ON DELETE SET NULL;

-- vapi_number_pool, vapi_number_assignments, vapi_call_logs tables remain as previously defined.
-- E.164 format should be validated in n8n before any database writes.
```

## 2. Vapi Configuration

### A. Supabase MCP Tool for Vapi

We will expose Supabase as an MCP tool, allowing Barbara to query data directly.

**Tool Definition in Vapi Assistant:**

```json
{
  "type": "function",
  "function": {
    "name": "supabase_query",
    "description": "Query the Supabase database to get information about leads, brokers, or territories. Can be used to find a lead by phone number or find a broker for a given zip code.",
    "parameters": {
      "type": "object",
      "properties": {
        "query_type": { "type": "string", "enum": ["get_lead_details", "find_broker_by_zip", "get_broker_details"] },
        "identifier": { "type": "string", "description": "The value to search for, e.g., a lead_id, phone number, or zip code." }
      },
      "required": ["query_type", "identifier"]
    },
    "server": { "url": "https://n8n.instaroute.com/webhook/vapi-supabase-tool" }
  }
}
```

### B. Barbara Assistant Update

- Add the `supabase_query` tool.
- Add the `check_availability_and_book` (Cal.com) tool.
- **System Prompt Update**: The prompt will now instruct Barbara to use these tools.
  - *For outbound calls*: "You will be given a `lead_id`. Use the `supabase_query` tool with `query_type: 'get_lead_details'` to get all context about the lead before you speak."
  - *For inbound unknown callers*: "Your goal is to qualify the caller. Ask for their name and zip code. Use the `supabase_query` tool with `query_type: 'find_broker_by_zip'` to see if we serve their area. If we do, proceed to book an appointment using the Cal.com tool."

## 3. n8n Workflows (Revised Flow)

### WF1: Handle Instantly Reply & Trigger Call (Webhook)

*This is the new primary entry point for outbound calls.*

- **Trigger**: Instantly Webhook (`/webhook/instantly-reply`).
- **Steps**:

  1. Receive reply payload.
  2. **AI Node**: Analyze reply. If intent is `call_requested` and a valid phone number is present, proceed.
  3. **Assign Number**: Get an `available` number from the lead's assigned broker's pool. Create a `vapi_number_assignments` record (`status: 'booked'`) and lock the pool number. Update the lead with `vapi_assignment_id`.
  4. **Trigger Call**: Use Vapi MCP `create_call`. Pass only the `lead_id` in `assistantOverrides.variableValues`. Barbara will use the Supabase tool to fetch all other details.
  5. **Log**: Create initial record in `vapi_call_logs` (`direction: 'outbound_to_lead'`).

### WF2: Vapi Inbound Call Router (Webhook)

*Handles all incoming calls to the number pool.*

- **Trigger**: Vapi Webhook (`/webhook/vapi-inbound`).
- **Steps**:

  1. Secure with signature validation.
  2. Find active assignment via the called number.
  3. **If assignment exists (known caller)**:

     - If caller is the lead -> forward to broker (ring primary, then secondary).
     - If caller is the broker -> forward to lead.
     - Respond with "Call Connector" assistant and `forward_to_number`.

  1. **If no assignment (unknown caller)**:

     - Respond with `assistantId` for **Barbara**. She will handle intake as defined in her prompt.

### WF3: Tool Backend - Supabase & Cal.com (Webhook)

*A single webhook endpoint in n8n to power Barbara's tools.*

- **Trigger**: Webhook (`/webhook/vapi-tools`).
- **Logic**:
  - If `tool_name` is `supabase_query`: Execute a read-only query against Supabase and return the results.
  - If `tool_name` is `check_availability_and_book`: Interact with the Cal.com API, respecting the broker's `timezone`, and return available slots or booking confirmation.

### WF4: Call Completed & Logging (Webhook)

*Same as before, but now triggered for all call types.*

- **Trigger**: Vapi `call-ended` Webhook.
- **Steps**:

  1. Secure and use DLQ for errors.
  2. Update `vapi_call_logs` with final status, duration, recording.
  3. Update `vapi_number_assignments`: set `status: 'call_completed'`, `last_call_at`, and `release_at = NOW() + INTERVAL '24 hours'`.
  4. **If call was "no-answer"**: Trigger the Retry Workflow (WF6).

### WF5: Daily Number Cleanup (Scheduled)

- **Trigger**: Daily at 3 AM.
- **Logic**: Finds assignments where `status = 'call_completed'` and `release_at < NOW()`. Sets assignment to `released` and pool number to `available`.

### WF6: Unreachable Lead Retries (Sub-Workflow)

- **Logic**: On "no-answer", check retry count. If < 3, leave voicemail/SMS and schedule next call attempt in the main `vapi_call_logs` or a new `retries` table.

## 4. Finalized Decisions

- **Security**: Webhook signature validation will be implemented.
- **Data**: E.164 format and Foreign Keys will be enforced.
- **Timezone**: `brokers.timezone` field will be used for Cal.com bookings.
- **Call Logic**: Sequential ring (primary -> secondary) for inbound lead calls.
- **Trigger**: Outbound calls are triggered by Instantly replies.
- **Unknown Callers**: Barbara handles intake, queries Supabase by zip, and attempts to book a new appointment.

This revised plan is now ready for implementation. It is more robust, secure, and aligns perfectly with your desired operational flow.

### To-dos

- [ ] Create database migration SQL for vapi_number_pool, vapi_number_assignments, vapi_call_logs tables and broker field additions
- [ ] Purchase phone numbers in Vapi (10-15 per broker) and insert into vapi_number_pool table
- [ ] Update Barbara assistant with vector store connection and context variable injection in prompt
- [ ] Create n8n workflow: Appointment booked → assign number from pool
- [ ] Create n8n workflow: Trigger Barbara call via Vapi MCP create_call tool
- [ ] Create n8n workflow: Log call results from Vapi webhook using get_call MCP tool
- [ ] Create n8n workflow: Daily number release automation (3am cron)
- [ ] Test complete flow: booking → number assignment → Barbara call → logging → release