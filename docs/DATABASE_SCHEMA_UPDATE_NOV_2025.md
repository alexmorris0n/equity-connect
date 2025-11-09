# Database Schema Documentation Update - November 6, 2025

## 🎯 Summary

Updated database schema documentation to match the **actual Supabase database schema** by comparing docs against live database via MCP.

## 🔍 What Was Wrong

The documentation was **outdated** and **incomplete**, causing issues when:
- Creating new features (wrong column names, missing fields)
- Writing SQL queries (using non-existent columns)
- Integrating new systems (missing recent additions like Nylas, PropertyRadar, prompt management)

## ✅ What Was Fixed

### `DATABASE_SCHEMA_REFERENCE.md`

#### **1. `leads` Table - Major Additions**

**Contact Fields:**
- ✅ Added `primary_phone_e164` (E.164 formatted phone)
- ✅ Added `last_email_from` (tracking last sender)
- ✅ Added `last_contact_at` (alternative timestamp field)

**Status & Tracking:**
- ✅ Updated `status` enum with missing values: `enriched`, `contactable`, `do_not_contact`, `needs_contact_info`
- ✅ Updated `campaign_status` enum with: `queued`, `active`, `sent`, `delivered`, `opened`, `clicked`, `replied`, `bounced`, `unsubscribed`, `paused`, `completed`, `do_not_contact`, `converted`
- ✅ Added `qualified` (boolean)
- ✅ Added `preferred_language` (ISO 639-1 codes: en, es)
- ✅ Added `last_reply_date`, `last_interaction_date` (timestamp without timezone variants)

**Enrichment & Data Quality:**
- ✅ Added entire enrichment section with 11 fields:
  - `enriched_by`, `enriched_at`, `enrichment_data`, `enrichment_meta`, `enrichment_quality`
  - `quality_score`, `skiptrace_tier`, `skiptrace_completed_at`
  - `last_melissa_try_at`, `phones` (JSONB array), `emails` (JSONB array)

**PropertyRadar Integration:**
- ✅ Added 6 PropertyRadar-specific fields:
  - `radar_id` (PRIMARY deduplication key)
  - `radar_property_data` (full API response)
  - `radar_api_version`
  - `county_fips`
  - `phone_available`, `email_available`

**BatchData Integration:**
- ✅ Added 4 BatchData fields:
  - `batchdata_property_id`
  - `batchdata_property_data`
  - `best_property_data` (merged best-of-both)
  - `attom_property_id`

**Campaign History:**
- ✅ Added campaign tracking fields:
  - `campaign_history` (JSONB array)
  - `first_campaign_date`, `last_campaign_date`, `campaign_count`

**Other Important Additions:**
- ✅ Added 10+ missing columns: `first_seen_at`, `last_seen_at`, `source`, `vendor_record_id`, `vendor_list_id`, `address_line1`, `address_line2`, `addr_hash` (UNIQUE), `owner_company`, `dedupe_key`, `upload_batch_id`, `notes`

---

#### **2. `brokers` Table - Comprehensive Update**

Reorganized into logical sections and added **30+ missing fields**:

**Core Broker Info:**
- ✅ Added `user_id` (FK to auth.users)
- ✅ Added `user_role` (varchar)
- ✅ Added `primary_phone_e164`, `secondary_phone_e164`
- ✅ Added `license_states`, `website_url`, `preferred_contact_method`

**Address Fields:**
- ✅ Added complete address structure: `address_street`, `address_city`, `address_state`, `address_zip`

**Status & Performance:**
- ✅ Added performance tracking: `performance_score`, `conversion_rate`, `show_rate`, `current_balance`, `weekly_revenue`, `monthly_revenue`

**Lead Management:**
- ✅ Added `daily_capacity` (alternative to daily_lead_capacity)
- ✅ Added `max_leads_per_week`
- ✅ Added `current_offset`, `list_id`
- ✅ Added `propertyradar_list_id`, `propertyradar_offset`, `daily_lead_surplus`

**Pricing & Contract:**
- ✅ Added 10 contract fields: `lead_price`, `payment_terms`, `contract_type`, `auto_renew`, `start_date`, `contract_signed_date`, `contract_end_date`, `termination_date`, `termination_reason`, `referral_source`

**Calendar Integration (Nylas):**
- ✅ Added Nylas OAuth fields:
  - `nylas_account_id` (legacy)
  - `nylas_calendar_id` (legacy)
  - `nylas_grant_id` (current - stores OAuth tokens)
  - `calendar_synced_at`
  - `calendar_provider` (auto-detected: google | microsoft | icloud | exchange)
  - `timezone`

**Timestamps & Notes:**
- ✅ Added `notes` field

---

#### **3. `signalwire_phone_numbers` Table - Corrections**

- ✅ Added `territories` (text[] array)
- ✅ Added `assigned_broker_id` (FK to brokers.id)
- ✅ Corrected `assignment_status` values: `available` | `assigned_for_tracking`
- ✅ Added `notes` field
- ✅ Added `created_at`, `updated_at` timestamps
- ✅ Updated descriptions to match actual usage

---

#### **4. `interactions` Table - Enum Updates**

- ✅ Updated `type` enum to include: `email_opened`, `email_clicked`, `sms_sent`, `sms_replied`, `note`
- ✅ Updated `outcome` enum to include: `cancelled`, `appointment_rescheduled`
- ✅ Added all missing columns: `subject`, `duration_seconds`, `scheduled_for`, `meeting_link`, `recording_url`

---

#### **5. New Tables Added (8 major tables)**

**Prompt Management System:**
- ✅ `prompts` - Main prompt registry with voice settings and VAD configuration
- ✅ `prompt_versions` - Versioned prompt content with structured sections
- ✅ `broker_prompt_assignments` - Assign prompts to brokers with custom variables

**Quality & Analytics:**
- ✅ `call_evaluations` - AI-generated call quality scores (0-10 ratings + analysis)

**Campaign Infrastructure:**
- ✅ `calculator_tokens` - Personalized calculator links with token management
- ✅ `campaigns` - Campaign configuration for Instantly sequences
- ✅ `email_events` - Email campaign event tracking (sent, opened, clicked, replied, etc.)

**Billing & Performance:**
- ✅ `billing_events` - Performance-based billing events (qualified_lead, appointment_set, showed, application, funded)

**Territory & Lead Management:**
- ✅ `broker_territories` - Maps brokers to ZIP codes for lead routing
- ✅ `broker_daily_stats` - Daily PropertyRadar pull progress tracking

---

#### **6. Supporting Tables Documented**

Added quick reference section for 15+ supporting tables:
- `pipeline_events`, `microsites`, `consent_tokens`, `personas`, `neighborhoods`
- `source_bookmarks`, `lead_source_events`, `dlq`, `pipeline_dlq`
- `verification_code_map`, `suppression_contacts`
- `vapi_number_pool`, `vapi_number_assignments`, `vapi_call_logs`
- `billing_call_logs`, `lead_pull_results`, `instantly_persona_sync_log`
- `user_preferences`, `prompt_deployments`, `prompt_version_performance`, `prompt_audit_log`
- `vector_embeddings`

---

### `DATABASE_ARCHITECTURE.md`

- ✅ Updated header to reflect production status
- ✅ Added "Last Updated" date
- ✅ Added note pointing to complete schema reference
- ✅ Updated migration status to reflect ongoing enhancements
- ✅ Added "Related Documentation" section with cross-references

---

## 📊 By The Numbers

| Metric | Count |
|--------|-------|
| **Tables Added to Docs** | 8 major + 15 supporting |
| **Missing Fields Added to `leads`** | 40+ |
| **Missing Fields Added to `brokers`** | 30+ |
| **Enum Values Corrected** | 20+ |
| **New Sections Created** | 12 |

---

## 🎯 Impact

### **Before:**
- ❌ Creating features with wrong schema → had to go back and check Supabase MCP
- ❌ SQL queries failing due to non-existent columns
- ❌ Missing documentation for Nylas, PropertyRadar, prompt management
- ❌ Incomplete enum values causing validation errors

### **After:**
- ✅ Single source of truth for all database schema
- ✅ Complete column listing with data types and defaults
- ✅ All enum values documented
- ✅ Recent integrations (Nylas, PropertyRadar, prompts) fully documented
- ✅ Cross-references between related tables
- ✅ Clear organization by functional area

---

## 📝 How This Was Done

1. **Queried actual database** using `mcp_supabase_list_tables` to get complete schema
2. **Compared** with existing documentation
3. **Identified gaps**: missing tables, missing columns, outdated enums
4. **Updated systematically**:
   - Added all missing columns with data types and defaults
   - Corrected enum values
   - Added new tables
   - Reorganized for clarity
   - Added cross-references

---

## 🔗 Files Updated

1. **`docs/DATABASE_SCHEMA_REFERENCE.md`** - Major comprehensive update
2. **`docs/DATABASE_ARCHITECTURE.md`** - Status and cross-reference updates
3. **`docs/DATABASE_SCHEMA_UPDATE_NOV_2025.md`** - This summary document

---

## ✅ Verification

All updates verified against live Supabase database schema via MCP:
- ✅ Column names match exactly
- ✅ Data types match exactly
- ✅ Enum values match exactly
- ✅ Defaults documented correctly
- ✅ Foreign keys documented
- ✅ Constraints noted

---

## 🚀 Next Steps

**Developers can now:**
- Reference `DATABASE_SCHEMA_REFERENCE.md` as single source of truth
- Write SQL with confidence (correct column names, types, enums)
- Understand all available fields for new features
- See how tables relate via foreign keys
- Know which fields are required vs optional
- Use correct enum values

**No more:**
- ❌ Guessing column names
- ❌ Going back to Supabase MCP mid-feature
- ❌ Using outdated enum values
- ❌ Missing recent additions

---

📅 **Documentation Last Verified:** November 6, 2025  
🗄️ **Database:** Supabase (mxnqfwuhvurajrgoefyg)  
✨ **Status:** Complete and production-ready


