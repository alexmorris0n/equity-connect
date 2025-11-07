# DATABASE SCHEMA REFERENCE
**Last Updated:** November 6, 2025  
**Database:** Supabase (PostgreSQL 17)  
**Project:** Equity Connect (`mxnqfwuhvurajrgoefyg`)

> ⚠️ **IMPORTANT:** Always check this document before writing SQL queries in prompts!  
> This is the source of truth for actual column names and data types.

---

## TABLE: `leads`

### Primary Contact Fields
| Column Name | Data Type | Used In Prompts As | Notes |
|------------|-----------|-------------------|-------|
| `primary_email` | `text` | `primary_email` | ✅ USE THIS (not `email`) |
| `primary_phone` | `text` | `primary_phone` | ✅ USE THIS (not `phone`) |
| `primary_phone_e164` | `text` | `primary_phone_e164` | E.164 formatted phone number |
| `first_name` | `text` | `first_name` | ✅ |
| `last_name` | `text` | `last_name` | ✅ |
| `last_email_from` | `text` | `last_email_from` | Last email address that contacted this lead |

**⚠️ CRITICAL:** The database has `primary_email` and `primary_phone`, NOT `email` and `phone`!

### Property Fields
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `property_address` | `text` | Full address |
| `property_city` | `text` | City |
| `property_state` | `text` | State (2-letter) |
| `property_zip` | `text` | ZIP code |
| `property_value` | `numeric` | Dollar amount |
| `estimated_equity` | `numeric` | Dollar amount |

### Phone Number Assignment (VAPI Integration)
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `assigned_phone_number_id` | `text` | FK to `signalwire_phone_numbers.vapi_phone_number_id` |
| `phone_assigned_at` | `timestamp` | When phone was assigned |
| `vapi_call_id` | `text` | VAPI call tracking |
| `vapi_assignment_id` | `uuid` | VAPI assignment tracking |

**⚠️ NULL Handling:** Use SQL `NULL`, NOT the string `'null'`!
```sql
-- ✅ CORRECT
SET assigned_phone_number_id = NULL

-- ❌ WRONG - This creates corrupt data!
SET assigned_phone_number_id = 'null'
```

### Campaign & Persona Fields
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `campaign_archetype` | `text` | Campaign type identifier |
| `persona_sender_name` | `varchar` | Persona name for emails |
| `assigned_persona` | `text` | Legacy - use `persona_sender_name` instead |
| `instantly_campaign_id` | `text` | Instantly.ai campaign ID |

### Status & Tracking Fields
| Column Name | Data Type | Enum Values |
|------------|-----------|-------------|
| `status` | `lead_status` enum | `new`, `contacted`, `replied`, `qualified`, `appointment_set`, `showed`, `application`, `funded`, `closed_lost`, `enriched`, `contactable`, `do_not_contact`, `needs_contact_info` |
| `campaign_status` | `campaign_status` enum | `new`, `queued`, `active`, `sent`, `delivered`, `opened`, `clicked`, `replied`, `bounced`, `unsubscribed`, `paused`, `completed`, `do_not_contact`, `converted` |
| `qualified` | `boolean` | Default: false |
| `preferred_language` | `varchar` | ISO 639-1 codes (en, es, etc.) Default: 'en' |
| `last_reply_at` | `timestamptz` | Most recent reply time |
| `last_reply_date` | `timestamp` | Last reply date (no timezone) |
| `last_contact` | `timestamptz` | Last outreach attempt |
| `last_contact_at` | `timestamptz` | Alternative timestamp field |
| `last_interaction_date` | `timestamp` | Last interaction date (no timezone) |
| `interaction_count` | `integer` | Total interactions |

### Broker Assignment
| Column Name | Data Type | Foreign Key |
|------------|-----------|-------------|
| `assigned_broker_id` | `uuid` | → `brokers.id` |

### Enrichment & Data Quality Fields
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `enriched_by` | `text` | Which service enriched this lead |
| `enriched_at` | `timestamptz` | When enrichment occurred |
| `enrichment_data` | `jsonb` | Legacy enrichment data |
| `enrichment_meta` | `jsonb` | JSON metadata from enrichment providers (confidence scores, verification codes) |
| `enrichment_quality` | `text` | Quality assessment |
| `quality_score` | `numeric` | Default: 0 |
| `skiptrace_tier` | `integer` | 1=PDL, 2=Melissa - indicates which enrichment tier was successful |
| `skiptrace_completed_at` | `timestamptz` | When skiptrace finished |
| `last_melissa_try_at` | `timestamptz` | Last Melissa API attempt |
| `phones` | `jsonb` | Array of phone objects. Default: '[]' |
| `emails` | `jsonb` | Array of email objects. Default: '[]' |

### PropertyRadar Integration Fields
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `radar_id` | `text` | PropertyRadar unique property identifier - PRIMARY deduplication key |
| `radar_property_data` | `jsonb` | Full PropertyRadar API response payload for auditing. Default: '{}' |
| `radar_api_version` | `text` | PropertyRadar API version used for this record. Default: 'v1' |
| `county_fips` | `text` | County FIPS code (used with APN for secondary dedup) |
| `phone_available` | `boolean` | PropertyRadar PhoneAvailability > 0. Default: false |
| `email_available` | `boolean` | PropertyRadar EmailAvailability > 0. Default: false |

### BatchData Integration Fields
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `batchdata_property_id` | `text` | BatchData property ID |
| `batchdata_property_data` | `jsonb` | Raw BatchData skip trace enrichment results. Default: '{}' |
| `best_property_data` | `jsonb` | Merged best-of-both from PropertyRadar and BatchData. Default: '{}' |
| `attom_property_id` | `text` | ATTOM Data property ID - primary dedupe key (formerly Estated) |

### Campaign History & Tracking
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `campaign_history` | `jsonb` | JSON array tracking all campaigns this lead has been added to. Default: '[]' |
| `first_campaign_date` | `timestamp` | When first added to any campaign |
| `last_campaign_date` | `timestamp` | When last added to campaign |
| `campaign_count` | `integer` | Number of campaigns. Default: 0 |

### Other Important Fields
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | `uuid` | Primary key |
| `consent` | `boolean` | TCPA consent flag |
| `consented_at` | `timestamptz` | When consent given |
| `created_at` | `timestamptz` | Record creation |
| `updated_at` | `timestamptz` | Last update |
| `first_seen_at` | `timestamptz` | First time this record appeared. Default: now() |
| `last_seen_at` | `timestamptz` | Last time this record was seen. Default: now() |
| `source` | `text` | Data source (PropStream, PropertyRadar, BatchData, etc). Default: 'PropStream' |
| `vendor_record_id` | `text` | Vendor's unique ID for this lead |
| `vendor_list_id` | `text` | Batch/list context |
| `address_line1` | `text` | Normalized address line 1 |
| `address_line2` | `text` | Normalized address line 2 |
| `addr_hash` | `text` | SHA-256 hash for deduplication (UNIQUE) |
| `owner_company` | `text` | Owner company name |
| `dedupe_key` | `text` | Legacy deduplication key |
| `upload_batch_id` | `text` | Upload batch identifier |
| `notes` | `text` | Free-form notes |

---

## TABLE: `brokers`

### Core Broker Info
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK → `auth.users.id` |
| `user_role` | `varchar` | Default: 'broker' |
| `company_name` | `text` | Company name (used for phone pool matching) |
| `contact_name` | `text` | Primary contact |
| `email` | `text` | Broker email (UNIQUE) |
| `phone` | `text` | Broker phone |
| `primary_phone_e164` | `text` | E.164 formatted primary phone |
| `secondary_phone_e164` | `text` | E.164 formatted secondary phone |
| `nmls_number` | `text` | NMLS license number |
| `license_states` | `text` | Licensed states |
| `website_url` | `text` | Broker website |
| `preferred_contact_method` | `text` | Preferred contact method |

### Address Fields
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `address_street` | `text` | Street address |
| `address_city` | `text` | City |
| `address_state` | `text` | State |
| `address_zip` | `text` | ZIP code |

### Status & Performance
| Column Name | Data Type | Constraints | Default |
|------------|-----------|-------------|---------|
| `status` | `text` | `active`, `inactive`, `suspended` | 'active' |
| `performance_score` | `integer` | 0-100 | 100 |
| `conversion_rate` | `numeric` | - | 0 |
| `show_rate` | `numeric` | - | 0 |
| `current_balance` | `numeric` | - | 0 |
| `weekly_revenue` | `numeric` | - | 0 |
| `monthly_revenue` | `numeric` | - | 0 |

### Lead Management
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `daily_lead_capacity` | `integer` | Default: 5 |
| `daily_capacity` | `integer` | Alternative field. Default: 5 |
| `max_leads_per_week` | `integer` | Weekly limit |
| `current_offset` | `integer` | PropertyRadar pagination offset. Default: 0 |
| `list_id` | `text` | PropertyRadar list ID |
| `propertyradar_list_id` | `text` | PropertyRadar dynamic list ID (format: L7A8B9C0) |
| `propertyradar_offset` | `integer` | Current offset. Default: 0 |
| `daily_lead_surplus` | `integer` | Surplus leads. Default: 0 |

### Phone Pool Management
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `number_pool_size` | `integer` | Default: 15 |
| `number_pool_active` | `boolean` | Default: false |

### Pricing & Contract
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `pricing_model` | `text` | Default: 'performanceBased' |
| `lead_price` | `numeric` | Price per lead |
| `payment_terms` | `text` | Payment terms |
| `contract_type` | `text` | Contract type |
| `auto_renew` | `boolean` | Auto renewal. Default: false |
| `start_date` | `date` | Contract start date |
| `contract_signed_date` | `date` | When contract was signed |
| `contract_end_date` | `date` | Contract end date |
| `termination_date` | `date` | Termination date |
| `termination_reason` | `text` | Reason for termination |
| `referral_source` | `text` | How broker was referred |

### Calendar Integration (Nylas)
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `nylas_account_id` | `text` | Legacy Nylas account ID |
| `nylas_calendar_id` | `text` | Legacy Nylas calendar ID |
| `nylas_grant_id` | `varchar` | Nylas grant ID (e.g., grant_abc123) - stores OAuth tokens securely |
| `calendar_synced_at` | `timestamptz` | When broker last synced their calendar via Nylas OAuth |
| `calendar_provider` | `varchar` | Auto-detected by Nylas: google \| microsoft \| icloud \| exchange. Default: 'none' |
| `timezone` | `text` | Broker timezone for appointment scheduling. Default: 'America/Los_Angeles' |

### Timestamps & Notes
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `created_at` | `timestamptz` | Default: now() |
| `updated_at` | `timestamptz` | Default: now() |
| `notes` | `text` | Free-form notes |

**Important for Phone Pool:**
- `company_name` is used to match phone numbers in pool
- Example: `"My Reverse Options"` gets phone numbers where `assigned_broker_company = 'My Reverse Options'`

---

## TABLE: `signalwire_phone_numbers`

### Core Fields
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | `integer` | Serial primary key |
| `vapi_phone_number_id` | `varchar` | VAPI's phone number ID (UNIQUE) |
| `number` | `varchar` | E.164 format: `+14244851544` |
| `name` | `varchar` | Friendly name: `MyReverseOptions1` |
| `status` | `varchar` | `active`, `inactive`, `maintenance`. Default: 'active' |
| `territories` | `text[]` | Array of territories this number serves |

### Pool Management Fields
| Column Name | Data Type | Default | Notes |
|------------|-----------|---------|-------|
| `assigned_broker_company` | `varchar` | - | Broker company this number belongs to |
| `assigned_broker_id` | `uuid` | `NULL` | FK → `brokers.id` - Broker ID when number is assigned for appointment tracking |
| `currently_assigned_to` | `uuid` | `NULL` | FK → `leads.id` - Lead ID when number is assigned for appointment tracking |
| `assigned_at` | `timestamp` | `NULL` | When assigned to current lead |
| `release_at` | `timestamp` | `NULL` | When to release back to pool (midnight after appointment day) |
| `assignment_status` | `varchar` | `'available'` | `available` \| `assigned_for_tracking` |
| `last_call_outcome` | `varchar` | - | Most recent call outcome |
| `appointment_scheduled_at` | `timestamp` | - | If booked, appointment time |
| `notes` | `text` | - | Free-form notes |

### Timestamps
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `created_at` | `timestamp` | Default: now() |
| `updated_at` | `timestamp` | Default: now() |

### Important Constraints
- **UNIQUE CONSTRAINT:** `idx_unique_lead_phone_assignment` on `currently_assigned_to` (WHERE NOT NULL)
  - **Prevents:** One lead from having multiple phone numbers assigned
  - **Error if violated:** `23505: duplicate key value violates unique constraint`

---

## TABLE: `interactions`

| Column Name | Data Type | Enum Values | Notes |
|------------|-----------|-------------|-------|
| `id` | `uuid` | - | Primary key |
| `lead_id` | `uuid` | - | FK → `leads.id` |
| `broker_id` | `uuid` | - | FK → `brokers.id` |
| `type` | `interaction_type` enum | `email_sent`, `email_opened`, `email_clicked`, `email_replied`, `ai_call`, `appointment`, `sms_sent`, `sms_replied`, `note` | Interaction type. New value: note (audit trail for cancellations/reschedules) |
| `direction` | `text` | `inbound`, `outbound` | Call/message direction |
| `subject` | `text` | - | Email subject or call topic |
| `content` | `text` | - | Email body, call transcript, etc. |
| `duration_seconds` | `integer` | - | Call duration |
| `outcome` | `text` | `positive`, `neutral`, `negative`, `no_response`, `appointment_booked`, `not_interested`, `follow_up_needed`, `cancelled`, `appointment_rescheduled` | Interaction outcome. New values: cancelled, appointment_rescheduled |
| `scheduled_for` | `timestamptz` | - | Scheduled appointment time |
| `meeting_link` | `text` | - | Video meeting link |
| `recording_url` | `text` | - | Call recording URL |
| `metadata` | `jsonb` | - | Additional structured data |
| `created_at` | `timestamptz` | - | Interaction timestamp. Default: now() |

**Metadata Usage:**
```sql
-- Store phone assignment details
metadata = jsonb_build_object(
  'intent', 'phone_provided',
  'assigned_phone_number_id', '701f7d5d-...',
  'assigned_phone_number', '+14244851544'
)
```

---

## TABLE: `prompts`

Main prompt registry for AI voice agents.

| Column Name | Data Type | Constraints | Notes |
|------------|-----------|-------------|-------|
| `id` | `uuid` | PRIMARY KEY | Default: gen_random_uuid() |
| `name` | `varchar` | UNIQUE | Prompt name |
| `description` | `text` | - | What this prompt does |
| `current_version` | `integer` | - | Active version number. Default: 1 |
| `is_base_prompt` | `boolean` | - | Mark as default prompt for new brokers. Default: false |
| `is_active` | `boolean` | - | Whether this prompt is active. Default: true |
| `voice` | `varchar` | alloy, echo, shimmer, ash, ballad, coral, sage, verse, cedar, marin | OpenAI Realtime API voice. Default: 'alloy' |
| `call_type` | `varchar` | inbound-qualified, inbound-unqualified, inbound-unknown, outbound-warm, outbound-cold, broker-schedule-check, broker-connect-appointment | Call scenario type |
| `purpose` | `text` | - | High-level description of when/why this prompt is used (not sent to OpenAI) |
| `goal` | `text` | - | What success looks like for this call type (not sent to OpenAI) |
| `vad_threshold` | `numeric` | 0.0-1.0 | Voice Activity Detection threshold. Lower = more sensitive. Default: 0.5 |
| `vad_prefix_padding_ms` | `integer` | 100-1000 | Milliseconds of audio to capture BEFORE speech starts. Default: 300 |
| `vad_silence_duration_ms` | `integer` | 200-2000 | Milliseconds of silence before considering speech finished. Default: 500 |
| `created_at` | `timestamp` | - | Default: now() |
| `updated_at` | `timestamp` | - | Default: now() |

---

## TABLE: `prompt_versions`

Versioned prompt content with structured sections.

| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | `uuid` | PRIMARY KEY. Default: gen_random_uuid() |
| `prompt_id` | `uuid` | FK → `prompts.id` |
| `version_number` | `integer` | Version number |
| `content` | `jsonb` | Structured JSON with sections (role, personality, context, etc.) |
| `variables` | `text[]` | Array of template variables used in content |
| `change_summary` | `text` | What changed in this version |
| `is_active` | `boolean` | Is this the active version? Default: false |
| `is_draft` | `boolean` | Is this a draft? Default: true |
| `created_by` | `varchar` | Who created this version |
| `created_at` | `timestamp` | Default: now() |
| `applied_suggestions` | `jsonb` | Array of section keys where AI suggestions have been applied. Default: '[]' |

---

## TABLE: `broker_prompt_assignments`

Assign prompts to brokers with custom variables.

| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | `uuid` | PRIMARY KEY. Default: gen_random_uuid() |
| `broker_id` | `uuid` | FK → `brokers.id` |
| `prompt_id` | `uuid` | FK → `prompts.id` |
| `prompt_version` | `integer` | Version number to use |
| `custom_variables` | `jsonb` | Broker-specific variable overrides (name, NMLS, company, etc.) |
| `assigned_at` | `timestamp` | Default: now() |
| `assigned_by` | `uuid` | FK → `brokers.id` (who assigned it) |

---

## TABLE: `call_evaluations`

AI-generated evaluations of call quality.

| Column Name | Data Type | Constraints | Notes |
|------------|-----------|-------------|-------|
| `id` | `uuid` | PRIMARY KEY | Default: gen_random_uuid() |
| `interaction_id` | `uuid` | FK → `interactions.id` | Which call was evaluated |
| `opening_effectiveness` | `integer` | 0-10 | How well did the call open? |
| `property_discussion_quality` | `integer` | 0-10 | Quality of property discussion |
| `objection_handling` | `integer` | 0-10 | How well were objections handled? |
| `booking_attempt_quality` | `integer` | 0-10 | Quality of booking attempt |
| `tone_consistency` | `integer` | 0-10 | Was tone consistent? |
| `overall_call_flow` | `integer` | 0-10 | Overall flow rating |
| `overall_score` | `numeric` | GENERATED | Average of all scores |
| `analysis` | `jsonb` | - | Detailed analysis. Default: '{}' |
| `prompt_version` | `text` | - | Prompt version used |
| `prompt_registry_id` | `text` | - | Prompt registry ID |
| `evaluation_model` | `text` | - | AI model used. Default: 'gpt-5-mini' |
| `evaluated_at` | `timestamptz` | - | Default: now() |
| `evaluation_duration_ms` | `integer` | - | How long evaluation took |
| `created_at` | `timestamptz` | - | Default: now() |
| `updated_at` | `timestamptz` | - | Default: now() |

---

## TABLE: `calculator_tokens`

Stores unique tokens for personalized calculator links sent to leads.

| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | `uuid` | PRIMARY KEY. Default: gen_random_uuid() |
| `token` | `text` | UNIQUE token string (e.g., abc123) used in URL |
| `lead_id` | `uuid` | UNIQUE FK → `leads.id` |
| `created_at` | `timestamptz` | Default: now() |
| `expires_at` | `timestamptz` | When this token expires. Default: now() + 30 days |
| `used_at` | `timestamptz` | Timestamp when the calculator was first accessed |
| `phone_submitted` | `text` | Phone number submitted through the calculator |
| `metadata` | `jsonb` | Additional data like IP address, user agent, etc. Default: '{}' |

---

## TABLE: `campaigns`

Campaign configuration for Instantly email sequences.

| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | `uuid` | PRIMARY KEY. Default: gen_random_uuid() |
| `archetype` | `text` | UNIQUE campaign archetype identifier |
| `instantly_campaign_id` | `text` | Instantly.ai campaign ID |
| `campaign_name` | `text` | Human-readable campaign name |
| `description` | `text` | Campaign description |
| `sequence_order` | `integer` | Order in rotation sequence |
| `active` | `boolean` | Is campaign active? Default: true |
| `created_at` | `timestamptz` | Default: now() |
| `updated_at` | `timestamptz` | Default: now() |

---

## TABLE: `email_events`

Tracks email campaign events.

| Column Name | Data Type | Constraints | Notes |
|------------|-----------|-------------|-------|
| `id` | `uuid` | PRIMARY KEY | Default: gen_random_uuid() |
| `lead_id` | `uuid` | FK → `leads.id` | Which lead |
| `broker_id` | `uuid` | FK → `brokers.id` | Which broker |
| `event_type` | `text` | sent, delivered, opened, clicked, replied, bounced, unsubscribed, marked_spam | Event type |
| `email_subject` | `text` | - | Email subject line |
| `email_from_address` | `text` | - | From address |
| `campaign_archetype` | `text` | - | Campaign archetype |
| `persona_name` | `text` | - | Persona name |
| `clicked_link` | `text` | - | Which link was clicked |
| `clicked_cta` | `text` | - | Which CTA was clicked |
| `reply_content` | `text` | - | Reply body text |
| `reply_sentiment` | `text` | positive, neutral, negative, interested, not_interested | AI-detected sentiment |
| `metadata` | `jsonb` | - | Additional data. Default: '{}' |
| `created_at` | `timestamptz` | - | Default: now() |

---

## TABLE: `billing_events`

Performance-based billing events.

| Column Name | Data Type | Enum Values | Notes |
|------------|-----------|-------------|-------|
| `id` | `uuid` | - | PRIMARY KEY. Default: gen_random_uuid() |
| `broker_id` | `uuid` | - | FK → `brokers.id` |
| `lead_id` | `uuid` | - | FK → `leads.id` |
| `event_type` | `billing_event_type` enum | qualified_lead, appointment_set, appointment_showed, application_submitted, deal_funded | Billable event type |
| `amount` | `numeric` | - | Dollar amount to bill |
| `status` | `text` | pending, invoiced, paid, reversed | Payment status. Default: 'pending' |
| `invoice_id` | `text` | - | Invoice reference |
| `original_event_id` | `uuid` | - | FK → `billing_events.id` (for reversals) |
| `metadata` | `jsonb` | - | Additional data |
| `created_at` | `timestamptz` | - | Default: now() |
| `reversed_at` | `timestamptz` | - | When reversed |

---

## TABLE: `broker_territories`

Maps brokers to their territory zip codes for lead routing.

| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | `uuid` | PRIMARY KEY. Default: gen_random_uuid() |
| `broker_id` | `uuid` | FK → `brokers.id` |
| `market_name` | `text` | Market name |
| `zip_code` | `text` | ZIP code |
| `neighborhood_name` | `text` | Neighborhood name |
| `priority` | `integer` | Priority level. Default: 1 |
| `active` | `boolean` | Is active? Default: true |
| `created_at` | `timestamptz` | Default: now() |
| `updated_at` | `timestamptz` | Default: now() |

---

## TABLE: `broker_daily_stats`

Tracks daily PropertyRadar pull progress per broker for UI dashboard.

| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | `uuid` | PRIMARY KEY. Default: gen_random_uuid() |
| `broker_id` | `uuid` | FK → `brokers.id` |
| `pull_date` | `date` | Default: CURRENT_DATE |
| `leads_pulled_today` | `integer` | Default: 0 |
| `daily_target` | `integer` | Default: 0 |
| `pulls_remaining` | `integer` | GENERATED: daily_target - leads_pulled_today |
| `progress_percent` | `numeric` | GENERATED: (leads_pulled_today / daily_target) * 100 |
| `current_zip_index` | `integer` | Default: 0 |
| `current_zip` | `text` | Current ZIP being processed |
| `zips_processed` | `integer` | Default: 0 |
| `total_zips` | `integer` | Default: 0 |
| `session_id` | `text` | Session identifier |
| `last_pull_at` | `timestamptz` | Last pull timestamp |
| `next_pull_scheduled` | `timestamptz` | Next scheduled pull |
| `total_cost_today` | `numeric` | Default: 0 |
| `api_calls_today` | `integer` | Default: 0 |
| `status` | `text` | pending, in_progress, completed, paused, error. Default: 'pending' |
| `error_message` | `text` | Error details |
| `created_at` | `timestamptz` | Default: now() |
| `updated_at` | `timestamptz` | Default: now() |

---

## COMMON SQL PATTERNS FOR PROMPTS

### 1. Get Lead with Broker Info
```sql
SELECT 
  l.id, 
  l.first_name, 
  l.last_name, 
  l.primary_email,           -- ✅ NOT email
  l.primary_phone,           -- ✅ NOT phone
  l.status,
  l.property_address,
  l.property_city,
  l.property_state,
  l.property_zip,
  l.property_value,
  l.estimated_equity,
  l.campaign_archetype,
  l.assigned_persona,
  l.persona_sender_name,
  b.id as broker_id,
  b.company_name as broker_company,
  b.contact_name as broker_contact_name,
  b.nmls_number as broker_nmls,
  b.phone as broker_phone
FROM leads l 
LEFT JOIN brokers b ON l.assigned_broker_id = b.id 
WHERE l.primary_email = 'user@example.com'  -- ✅ primary_email
LIMIT 1
```

### 2. Check for Existing Phone Assignment
```sql
SELECT 
  spn.vapi_phone_number_id,
  spn.number,
  spn.name,
  spn.assignment_status,
  spn.release_at
FROM signalwire_phone_numbers spn
WHERE spn.currently_assigned_to = '07f26a19-e9dc-422c-b61d-030e3c7971bb'
  AND spn.status = 'active'
  AND spn.assigned_broker_company = 'My Reverse Options'
LIMIT 1
```

### 3. Assign New Phone Number (Atomic)
```sql
WITH selected_number AS (
  SELECT 
    vapi_phone_number_id,
    number,
    name
  FROM signalwire_phone_numbers 
  WHERE status = 'active' 
    AND assigned_broker_company = 'My Reverse Options'
    AND (
      assignment_status = 'available' 
      OR (release_at IS NOT NULL AND release_at <= NOW())
    )
  ORDER BY 
    COALESCE(assigned_at, '1970-01-01'::TIMESTAMP) ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED  -- Prevents race conditions
)
UPDATE signalwire_phone_numbers 
SET 
  currently_assigned_to = '07f26a19-e9dc-422c-b61d-030e3c7971bb',
  assigned_at = NOW(),
  release_at = NOW() + INTERVAL '18 hours',
  assignment_status = 'assigned',
  last_call_outcome = NULL,
  updated_at = NOW()
FROM selected_number
WHERE signalwire_phone_numbers.vapi_phone_number_id = selected_number.vapi_phone_number_id
RETURNING 
  signalwire_phone_numbers.vapi_phone_number_id,
  signalwire_phone_numbers.number,
  signalwire_phone_numbers.name
```

### 4. Update Lead with Phone Assignment
```sql
UPDATE leads 
SET 
  assigned_phone_number_id = '701f7d5d-7422-488a-bf61-3dcdfd731e72',
  phone_assigned_at = NOW()
WHERE id = '07f26a19-e9dc-422c-b61d-030e3c7971bb'
  AND assigned_phone_number_id IS NULL  -- Only if not already set
RETURNING id
```

### 5. Release Phone from Different Broker
```sql
UPDATE signalwire_phone_numbers 
SET 
  currently_assigned_to = NULL,    -- ✅ SQL NULL, not 'null'
  assignment_status = 'available',
  release_at = NULL,
  updated_at = NOW()
WHERE currently_assigned_to = '07f26a19-e9dc-422c-b61d-030e3c7971bb'
  AND status = 'active'
  AND assigned_broker_company != 'My Reverse Options'  -- Different broker
RETURNING vapi_phone_number_id
```

---

## COMMON MISTAKES TO AVOID

### ❌ WRONG: Using `email` instead of `primary_email`
```sql
-- ❌ WRONG - Column doesn't exist!
WHERE l.email = 'user@example.com'

-- ✅ CORRECT
WHERE l.primary_email = 'user@example.com'
```

### ❌ WRONG: Using string `'null'` instead of SQL NULL
```sql
-- ❌ WRONG - Creates corrupt data!
UPDATE leads SET assigned_phone_number_id = 'null'

-- ✅ CORRECT
UPDATE leads SET assigned_phone_number_id = NULL
```

### ❌ WRONG: Not checking broker company match
```sql
-- ❌ WRONG - Might reuse phone from different broker!
WHERE spn.currently_assigned_to = '...'

-- ✅ CORRECT - Ensure broker match
WHERE spn.currently_assigned_to = '...'
  AND spn.assigned_broker_company = 'My Reverse Options'
```

### ❌ WRONG: Forgetting FOR UPDATE SKIP LOCKED
```sql
-- ❌ WRONG - Race condition possible!
SELECT ... FROM signalwire_phone_numbers
WHERE assignment_status = 'available'
LIMIT 1

-- ✅ CORRECT - Atomic assignment
SELECT ... FROM signalwire_phone_numbers
WHERE assignment_status = 'available'
LIMIT 1
FOR UPDATE SKIP LOCKED
```

---

## PROMPT-SPECIFIC COLUMN USAGE

### InstalyReplyPrompt
**Used Columns:**
- `leads.primary_email` (lookup key)
- `leads.primary_phone` (update with extracted phone)
- `leads.status` (update to `qualified`)
- `leads.persona_sender_name` (set from webhook)
- `leads.last_reply_at` (timestamp)
- `leads.assigned_phone_number_id` (phone assignment tracking)
- `leads.phone_assigned_at` (phone assignment timestamp)
- `leads.campaign_archetype` (campaign type)

**Broker Columns (from JOIN):**
- `brokers.company_name` (for phone pool matching)
- `brokers.contact_name` (broker name for variables)
- `brokers.nmls_number` (license number)
- `brokers.phone` (broker phone)

### BarbaraVapiPrompt
**Used Columns:**
- All interaction history via `interactions` table
- Lead data from `leads` table
- Phone number details from `signalwire_phone_numbers`

---

## VERIFICATION QUERIES

### Check for Corrupt 'null' Strings
```sql
-- Find leads with string 'null' instead of SQL NULL
SELECT id, primary_email, assigned_phone_number_id
FROM leads
WHERE assigned_phone_number_id = 'null';

-- Fix them
UPDATE leads 
SET assigned_phone_number_id = NULL
WHERE assigned_phone_number_id = 'null';
```

### Check Phone Pool Status
```sql
SELECT 
  assigned_broker_company,
  assignment_status,
  COUNT(*) as count
FROM signalwire_phone_numbers
WHERE status = 'active'
GROUP BY assigned_broker_company, assignment_status
ORDER BY assigned_broker_company, assignment_status;
```

### Check for Duplicate Assignments
```sql
-- Should return 0 rows
SELECT currently_assigned_to, COUNT(*) as count
FROM signalwire_phone_numbers 
WHERE currently_assigned_to IS NOT NULL 
GROUP BY currently_assigned_to 
HAVING COUNT(*) > 1;
```

---

## FUNCTIONS AVAILABLE

### `release_expired_phone_numbers()`
**Purpose:** Auto-release phone numbers that have passed their `release_at` time  
**Returns:** Number of phone numbers released  
**Important:** Does NOT release phones with pending/recent appointments!  
**Usage:**
```sql
SELECT release_expired_phone_numbers();
```

**Release Logic:**
```sql
-- Only releases if:
-- 1. release_at has passed, AND
-- 2. No appointment scheduled OR appointment was 24+ hours ago
WHERE release_at <= NOW()
  AND (
    appointment_scheduled_at IS NULL
    OR appointment_scheduled_at + INTERVAL '24 hours' <= NOW()
  )
```

### `get_or_assign_phone_for_lead(p_lead_id, p_broker_company)`
**Purpose:** Get existing phone or assign new one (handles both cases atomically)  
**Returns:** Table with `vapi_phone_number_id`, `number`, `name`, `was_existing`  
**Usage:**
```sql
SELECT * FROM get_or_assign_phone_for_lead(
  '07f26a19-e9dc-422c-b61d-030e3c7971bb'::UUID,
  'My Reverse Options'
);
```

### `extend_phone_for_appointment(p_lead_id, p_appointment_time)` ⭐ NEW
**Purpose:** Extend phone hold when appointment is booked  
**Returns:** Boolean (success/failure)  
**When to Call:** When Barbara books an appointment via VAPI  
**Usage:**
```sql
-- Example: Appointment booked for Oct 20, 2025 at 2:00 PM
SELECT extend_phone_for_appointment(
  '07f26a19-e9dc-422c-b61d-030e3c7971bb'::UUID,
  '2025-10-20 14:00:00'::TIMESTAMP
);
```

**What it does:**
- Sets `appointment_scheduled_at` to appointment time
- Extends `release_at` to appointment time + 24 hours
- Sets `last_call_outcome` to `'booked'`
- Keeps phone assigned through appointment + follow-up window

### `complete_appointment_for_phone(p_lead_id, p_outcome)` ⭐ NEW
**Purpose:** Mark appointment as completed and adjust release timing  
**Returns:** Boolean (success/failure)  
**When to Call:** After appointment completes (showed, no-show, cancelled)  
**Usage:**
```sql
-- Lead showed up to appointment
SELECT complete_appointment_for_phone(
  '07f26a19-e9dc-422c-b61d-030e3c7971bb'::UUID,
  'showed'
);

-- Lead didn't show
SELECT complete_appointment_for_phone(
  '07f26a19-e9dc-422c-b61d-030e3c7971bb'::UUID,
  'no_show'
);

-- Appointment cancelled
SELECT complete_appointment_for_phone(
  '07f26a19-e9dc-422c-b61d-030e3c7971bb'::UUID,
  'cancelled'
);
```

**Outcome Logic:**
- `showed` / `no_show`: Release 24 hours from now (follow-up window)
- `cancelled` / `rescheduled`: Release immediately (back to pool)

---

## ADDITIONAL TABLES (SUPPORTING)

### `pipeline_events`
Tracks pipeline processing events for debugging and monitoring.

### `microsites`
Personalized microsite configurations.

### `consent_tokens`
TCPA consent token management.

### `personas`
Persona configurations for culturally-matched advisors.

### `neighborhoods`
Neighborhood data and statistics for microsite generation.

### `source_bookmarks`
Pagination state for PropertyRadar/BatchData pulls.

### `lead_source_events`
Tracks every API pull to enable idempotent pagination.

### `dlq` / `pipeline_dlq`
Dead letter queues for failed operations.

### `verification_code_map`
Maps provider verification codes.

### `suppression_contacts`
Contact suppression list.

### `vapi_number_pool` / `vapi_number_assignments` / `vapi_call_logs`
VAPI phone number management (legacy - mostly migrated to SignalWire).

### `billing_call_logs`
Call tracking for broker billing verification.

### `lead_pull_results`
Results from PropertyRadar pull operations.

### `instantly_persona_sync_log`
Log of Instantly persona synchronization runs.

### `user_preferences`
User preference settings (theme, notifications).

### `prompt_deployments` / `prompt_version_performance` / `prompt_audit_log`
Prompt deployment tracking and performance metrics.

### `vector_embeddings`
Vector embeddings for AI/RAG features.

---

## CHANGE LOG

**2025-11-06:**
- 🔄 Major schema documentation update
- ✅ Added all missing columns from actual Supabase schema
- ✅ Updated all enum values to match database
- ✅ Added new tables: `prompts`, `prompt_versions`, `broker_prompt_assignments`, `call_evaluations`, `calculator_tokens`, `campaigns`, `email_events`, `billing_events`, `broker_territories`, `broker_daily_stats`
- ✅ Documented Nylas calendar integration fields
- ✅ Documented PropertyRadar integration fields
- ✅ Documented BatchData integration fields
- ✅ Documented campaign history tracking
- ✅ Documented enrichment and data quality fields
- ✅ Updated broker table with all address, contract, and performance fields
- ✅ Corrected SignalWire phone numbers schema

**2025-10-18:**
- ✅ Added appointment-aware phone release logic
- ✅ Created `extend_phone_for_appointment()` function
- ✅ Created `complete_appointment_for_phone()` function
- ✅ Updated `release_expired_phone_numbers()` to check appointments
- ✅ Phone numbers now held through appointment + 24 hour follow-up window

**2025-10-17:**
- ✅ Verified actual database schema
- ✅ Fixed confusion between `email`/`primary_email` and `phone`/`primary_phone`
- ✅ Documented phone assignment fields
- ✅ Added NULL vs 'null' warning
- ✅ Documented broker company matching requirement

