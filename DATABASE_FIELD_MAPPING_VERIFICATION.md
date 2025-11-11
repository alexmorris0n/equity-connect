# Database Field Mapping Verification

**Date:** November 11, 2025  
**Status:** ✅ VERIFIED

## Overview

Verified all database field mappings used in the event-based state machine implementation against the actual Supabase schema.

## ✅ Leads Table Field Mappings

### Phone Fields
| Code Usage | Database Column | Status |
|------------|----------------|--------|
| `lead.get('primary_phone')` | `primary_phone` (text) | ✅ CORRECT |
| `lead.get('primary_phone_e164')` | `primary_phone_e164` (text) | ✅ CORRECT |
| `f"primary_phone.ilike.%{phone}%"` | `primary_phone` | ✅ CORRECT |
| `f"primary_phone_e164.eq.{phone}"` | `primary_phone_e164` | ✅ CORRECT |

### Email Fields
| Code Usage | Database Column | Status |
|------------|----------------|--------|
| `lead.get('primary_email')` | `primary_email` (text) | ✅ CORRECT |

### Name Fields
| Code Usage | Database Column | Status |
|------------|----------------|--------|
| `lead.get('first_name')` | `first_name` (text) | ✅ CORRECT |
| `lead.get('last_name')` | `last_name` (text) | ✅ CORRECT |

### Property Fields
| Code Usage | Database Column | Status |
|------------|----------------|--------|
| `lead.get('property_address')` | `property_address` (text) | ✅ CORRECT |
| `lead.get('property_city')` | `property_city` (text) | ✅ CORRECT |
| `lead.get('property_state')` | `property_state` (text) | ✅ CORRECT |
| `lead.get('property_zip')` | `property_zip` (text) | ✅ CORRECT |
| `lead.get('property_value')` | `property_value` (numeric) | ✅ CORRECT |
| `lead.get('estimated_equity')` | `estimated_equity` (numeric) | ✅ CORRECT |

### Other Lead Fields
| Code Usage | Database Column | Status |
|------------|----------------|--------|
| `lead.get('age')` | `age` (integer) | ✅ CORRECT |
| `lead.get('status')` | `status` (lead_status enum) | ✅ CORRECT |
| `lead.get('qualified')` | `qualified` (boolean) | ✅ CORRECT |
| `lead.get('owner_occupied')` | `owner_occupied` (boolean) | ✅ CORRECT |
| `lead.get('assigned_broker_id')` | `assigned_broker_id` (uuid) | ✅ CORRECT |
| `lead.get('assigned_persona')` | `assigned_persona` (text) | ✅ CORRECT |
| `lead.get('persona_heritage')` | `persona_heritage` (text) | ✅ CORRECT |

## ✅ Brokers Table Field Mappings

| Code Usage | Database Column | Status |
|------------|----------------|--------|
| `broker.get('contact_name')` | `contact_name` (text) | ✅ CORRECT |
| `broker.get('company_name')` | `company_name` (text) | ✅ CORRECT |
| `broker.get('phone')` | `phone` (text) | ✅ CORRECT |
| `broker.get('email')` | `email` (text) | ✅ CORRECT |
| `broker.get('nmls_number')` | `nmls_number` (text) | ✅ CORRECT |
| `broker.get('nylas_grant_id')` | `nylas_grant_id` (varchar) | ✅ CORRECT |
| `broker.get('timezone')` | `timezone` (text) | ✅ CORRECT |

## ✅ Conversation State Table Field Mappings

| Code Usage | Database Column | Status |
|------------|----------------|--------|
| `state_row.get('phone_number')` | `phone_number` (text) | ✅ CORRECT |
| `state_row.get('lead_id')` | `lead_id` (uuid) | ✅ CORRECT |
| `state_row.get('qualified')` | `qualified` (boolean) | ✅ CORRECT |
| `state_row.get('current_node')` | `current_node` (text) | ✅ CORRECT |
| `state_row.get('conversation_data')` | `conversation_data` (jsonb) | ✅ CORRECT |
| `state_row.get('call_count')` | `call_count` (integer) | ✅ CORRECT |
| `state_row.get('last_call_at')` | `last_call_at` (timestamptz) | ✅ CORRECT |
| `state_row.get('call_status')` | `call_status` (text) | ✅ CORRECT |
| `state_row.get('exit_reason')` | `exit_reason` (text) | ✅ CORRECT |

## ✅ Interactions Table Field Mappings

| Code Usage | Database Column | Status |
|------------|----------------|--------|
| `interaction.get('metadata')` | `metadata` (jsonb) | ✅ CORRECT |
| `interaction.get('outcome')` | `outcome` (text enum) | ✅ CORRECT |
| `interaction.get('scheduled_for')` | `scheduled_for` (timestamptz) | ✅ CORRECT |

## 🔍 Phone Number Field Usage Audit

### leads Table Phone Fields (from schema):
- `primary_phone` (text, nullable) - Human-readable format
- `primary_phone_e164` (text, nullable) - E.164 format (+1XXXXXXXXXX)
- `phones` (jsonb) - Array of alternative phone numbers
- `phone_available` (boolean) - PropertyRadar availability flag

### Our Usage Pattern (CORRECT):
1. **Search queries:** Use BOTH `primary_phone` (ILIKE for flexibility) AND `primary_phone_e164` (exact match)
2. **Inserts:** Use `primary_phone` for new leads
3. **Updates:** Use `primary_phone` field name
4. **Display:** Read from `primary_phone`

### Code Locations:
- `livekit-agent/tools/lead.py` lines 36-37, 44, 100, 168, 223, 294
- `livekit-agent/tools/calendar.py` lines 163, 191, 257
- `livekit-agent/agent.py` lines 274

## ✅ All Field Mappings Verified

### Summary:
- ✅ **All phone field references use `primary_phone` or `primary_phone_e164`** (CORRECT)
- ✅ **All email field references use `primary_email`** (CORRECT)
- ✅ **No usage of deprecated or non-existent fields**
- ✅ **Consistent naming across all files**
- ✅ **Proper handling of nullable fields with `.get()` pattern**

### Files Checked:
1. ✅ `livekit-agent/tools/lead.py` - 9 phone field references
2. ✅ `livekit-agent/tools/calendar.py` - 3 phone field references
3. ✅ `livekit-agent/agent.py` - Phone field references in lead lookup
4. ✅ `livekit-agent/services/conversation_state.py` - State management
5. ✅ `livekit-agent/workflows/routers.py` - Router logic

## 🎯 No Issues Found

All field mappings are correct and consistent with the actual Supabase database schema. The code properly uses:

- `primary_phone` for leads table phone field
- `primary_email` for leads table email field
- `phone` for brokers table phone field
- Proper `.get()` pattern to handle nullable fields
- Both ILIKE and exact match for phone number lookups

## Ready for e.plan.md Migration

All database field references are verified and correct. You can proceed with the e.plan.md database migration with confidence.

