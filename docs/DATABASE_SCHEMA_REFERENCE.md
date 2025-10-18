# DATABASE SCHEMA REFERENCE
**Last Updated:** October 17, 2025  
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
| `first_name` | `text` | `first_name` | ✅ |
| `last_name` | `text` | `last_name` | ✅ |

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
| `status` | `lead_status` enum | `new`, `contacted`, `replied`, `qualified`, `appointment_set`, `showed`, `application`, `funded`, `closed_lost` |
| `campaign_status` | `campaign_status` enum | `new`, `contacted`, `replied`, `unsubscribed` |
| `last_reply_at` | `timestamptz` | Most recent reply time |
| `last_contact` | `timestamptz` | Last outreach attempt |
| `interaction_count` | `integer` | Total interactions |

### Broker Assignment
| Column Name | Data Type | Foreign Key |
|------------|-----------|-------------|
| `assigned_broker_id` | `uuid` | → `brokers.id` |

### Other Important Fields
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | `uuid` | Primary key |
| `consent` | `boolean` | TCPA consent flag |
| `consented_at` | `timestamptz` | When consent given |
| `created_at` | `timestamptz` | Record creation |
| `updated_at` | `timestamptz` | Last update |

---

## TABLE: `brokers`

| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | `uuid` | Primary key |
| `company_name` | `text` | Company name (used for phone pool matching) |
| `contact_name` | `text` | Primary contact |
| `email` | `text` | Broker email |
| `phone` | `text` | Broker phone |
| `nmls_number` | `text` | NMLS license number |
| `status` | `text` | `active`, `inactive`, `suspended` |
| `pricing_model` | `text` | Default: `performanceBased` |
| `daily_lead_capacity` | `integer` | Default: 5 |
| `number_pool_size` | `integer` | Default: 15 |
| `number_pool_active` | `boolean` | Default: false |

**Important for Phone Pool:**
- `company_name` is used to match phone numbers in pool
- Example: `"My Reverse Options"` gets phone numbers where `assigned_broker_company = 'My Reverse Options'`

---

## TABLE: `signalwire_phone_numbers`

### Core Fields
| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | `integer` | Serial primary key |
| `vapi_phone_number_id` | `varchar(100)` | VAPI's phone number ID (UNIQUE) |
| `number` | `varchar(20)` | E.164 format: `+14244851544` |
| `name` | `varchar(100)` | Friendly name: `MyReverseOptions1` |
| `status` | `varchar(20)` | `active`, `inactive`, `maintenance` |

### Pool Management Fields
| Column Name | Data Type | Default | Notes |
|------------|-----------|---------|-------|
| `assigned_broker_company` | `varchar(200)` | - | Broker company this number belongs to |
| `currently_assigned_to` | `uuid` | `NULL` | FK → `leads.id` (which lead has this number) |
| `assigned_at` | `timestamp` | `NULL` | When assigned to current lead |
| `release_at` | `timestamp` | `NULL` | When to release back to pool |
| `assignment_status` | `varchar(20)` | `available` | `available`, `assigned`, `reserved` |
| `last_call_outcome` | `varchar(50)` | - | `booked`, `no_answer`, `busy`, `voicemail` |
| `appointment_scheduled_at` | `timestamp` | - | If booked, appointment time |

### Important Constraints
- **UNIQUE CONSTRAINT:** `idx_unique_lead_phone_assignment` on `currently_assigned_to` (WHERE NOT NULL)
  - **Prevents:** One lead from having multiple phone numbers assigned
  - **Error if violated:** `23505: duplicate key value violates unique constraint`

### Indexes for Performance
```sql
-- Composite index for pool queries (used by AI)
idx_signalwire_pool_assignment ON (assigned_broker_company, assignment_status, assigned_at) WHERE status = 'active'

-- Individual indexes
idx_signalwire_phone_numbers_assigned_to ON (currently_assigned_to)
idx_signalwire_phone_numbers_status ON (status)
idx_signalwire_phone_numbers_release_at ON (release_at)
```

---

## TABLE: `interactions`

| Column Name | Data Type | Notes |
|------------|-----------|-------|
| `id` | `uuid` | Primary key |
| `lead_id` | `uuid` | FK → `leads.id` |
| `broker_id` | `uuid` | FK → `brokers.id` |
| `type` | `interaction_type` enum | `email_sent`, `email_replied`, `ai_call`, etc. |
| `direction` | `text` | `inbound`, `outbound` |
| `content` | `text` | Email body, call transcript, etc. |
| `metadata` | `jsonb` | Additional structured data |
| `created_at` | `timestamptz` | Interaction timestamp |

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

## CHANGE LOG

**2025-10-18:**
- ✅ Added appointment-aware phone release logic
- ✅ Created `extend_phone_for_appointment()` function
- ✅ Created `complete_appointment_for_phone()` function
- ✅ Updated `release_expired_phone_numbers()` to check appointments
- ✅ Phone numbers now held through appointment + 24 hour follow-up window
- 📋 Created integration guide: `PHONE_NUMBER_APPOINTMENT_HOLDS.md`

**2025-10-17:**
- ✅ Verified actual database schema
- ✅ Fixed confusion between `email`/`primary_email` and `phone`/`primary_phone`
- ✅ Documented phone assignment fields
- ✅ Added NULL vs 'null' warning
- ✅ Documented broker company matching requirement
- ✅ Updated `InstalyReplyPrompt` with phone reuse logic

**Schema Already Has:**
- ✅ `assigned_phone_number_id` column on `leads`
- ✅ `phone_assigned_at` column on `leads`
- ✅ `persona_sender_name` column on `leads`
- ✅ `campaign_archetype` column on `leads`
- ✅ `appointment_scheduled_at` column on `signalwire_phone_numbers`
- ✅ `last_call_outcome` column on `signalwire_phone_numbers`
- ✅ Unique constraint preventing duplicate phone assignments
- ✅ All necessary indexes for performance

