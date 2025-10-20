-- =====================================================
-- NYLAS CALENDAR INTEGRATION SETUP
-- =====================================================
-- 
-- Purpose: Replace multi-provider OAuth with Nylas unified API
-- Nylas handles Google, Microsoft, iCloud, Exchange calendars
--
-- Created: 2025-10-20
-- =====================================================

-- Add Nylas grant column
ALTER TABLE brokers
ADD COLUMN IF NOT EXISTS nylas_grant_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ;

-- Keep calendar_provider for display purposes (Nylas tells us which one)
-- Keep timezone for scheduling
ALTER TABLE brokers
ADD COLUMN IF NOT EXISTS calendar_provider VARCHAR(20) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Los_Angeles';

-- Remove old provider-specific columns (if migrating from old system)
ALTER TABLE brokers
DROP COLUMN IF EXISTS calendar_credential_name,
DROP COLUMN IF EXISTS google_calendar_id,
DROP COLUMN IF EXISTS outlook_calendar_id,
DROP COLUMN IF EXISTS ghl_location_id,
DROP COLUMN IF EXISTS icloud_calendar_url,
DROP COLUMN IF EXISTS icloud_calendar_id,
DROP COLUMN IF EXISTS business_hours;

-- Add comments
COMMENT ON COLUMN brokers.nylas_grant_id IS 'Nylas grant ID (e.g., grant_abc123) - stores OAuth tokens securely';
COMMENT ON COLUMN brokers.calendar_provider IS 'Auto-detected by Nylas: google | microsoft | icloud | exchange';
COMMENT ON COLUMN brokers.calendar_synced_at IS 'When broker last synced their calendar via Nylas OAuth';
COMMENT ON COLUMN brokers.timezone IS 'Broker timezone for appointment scheduling (e.g., America/Los_Angeles)';

-- Set default for existing brokers
UPDATE brokers 
SET calendar_provider = 'none'
WHERE calendar_provider IS NULL;

-- =====================================================
-- EXAMPLE: Manual Setup for Testing
-- =====================================================

-- After broker completes OAuth flow, you'll update like this:
-- UPDATE brokers 
-- SET nylas_grant_id = 'grant_abc123',
--     calendar_provider = 'google',
--     calendar_synced_at = NOW(),
--     timezone = 'America/Los_Angeles'
-- WHERE id = 'broker-456';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check calendar sync status for all brokers
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Nylas calendar columns added';
  RAISE NOTICE '';
  RAISE NOTICE 'Current broker calendar status:';
END $$;

SELECT 
  contact_name as broker,
  CASE 
    WHEN nylas_grant_id IS NOT NULL THEN '✅ Synced via Nylas'
    ELSE '⚪ Not synced yet'
  END as sync_status,
  calendar_provider,
  timezone,
  calendar_synced_at
FROM brokers
ORDER BY contact_name;

-- =====================================================
-- HELPER FUNCTION: Get Brokers Needing Sync
-- =====================================================

CREATE OR REPLACE FUNCTION get_brokers_needing_calendar_sync()
RETURNS TABLE (
  broker_id UUID,
  contact_name VARCHAR,
  email VARCHAR,
  company_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.contact_name,
    b.email,
    b.company_name
  FROM brokers b
  WHERE b.nylas_grant_id IS NULL
    AND b.status = 'active'
  ORDER BY b.contact_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_brokers_needing_calendar_sync IS 'Returns list of active brokers who have not synced their calendar yet';

-- =====================================================
-- NEXT STEPS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '1. Set up Nylas application at https://dashboard.nylas.com';
  RAISE NOTICE '2. Add Nylas credentials to .env:';
  RAISE NOTICE '   - NYLAS_CLIENT_ID';
  RAISE NOTICE '   - NYLAS_CLIENT_SECRET';
  RAISE NOTICE '   - NYLAS_API_KEY';
  RAISE NOTICE '';
  RAISE NOTICE '3. Create Supabase Edge Functions:';
  RAISE NOTICE '   - /api/nylas/auth-url (generates OAuth URL)';
  RAISE NOTICE '   - /api/nylas/callback (handles OAuth callback)';
  RAISE NOTICE '';
  RAISE NOTICE '4. Add CalendarSync.vue component to broker portal';
  RAISE NOTICE '';
  RAISE NOTICE '5. Import n8n workflow: workflows/broker-calendar-nylas.json';
  RAISE NOTICE '';
  RAISE NOTICE '6. Send sync emails to brokers:';
  RAISE NOTICE '   SELECT * FROM get_brokers_needing_calendar_sync();';
  RAISE NOTICE '';
  RAISE NOTICE 'See: docs/BROKER_CALENDAR_ONBOARDING_NYLAS.md for details';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

