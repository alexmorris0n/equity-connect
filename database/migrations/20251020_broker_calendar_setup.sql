-- =====================================================
-- BROKER CALENDAR INTEGRATION SETUP
-- =====================================================
-- 
-- Purpose: Add calendar provider columns to brokers table
-- for multi-provider calendar integration (Google, Outlook, GHL, iCloud)
--
-- Created: 2025-10-20
-- =====================================================

-- Add calendar configuration columns
ALTER TABLE brokers
ADD COLUMN IF NOT EXISTS calendar_provider VARCHAR(20) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS calendar_credential_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS outlook_calendar_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS ghl_location_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS icloud_calendar_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Los_Angeles',
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"monday": ["09:00-17:00"], "tuesday": ["09:00-17:00"], "wednesday": ["09:00-17:00"], "thursday": ["09:00-17:00"], "friday": ["09:00-17:00"]}'::jsonb;

-- Add comments
COMMENT ON COLUMN brokers.calendar_provider IS 'Calendar system: google | outlook | ghl | icloud | none';
COMMENT ON COLUMN brokers.calendar_credential_name IS 'Name of n8n OAuth credential for this broker';
COMMENT ON COLUMN brokers.google_calendar_id IS 'Google Calendar ID (usually "primary")';
COMMENT ON COLUMN brokers.outlook_calendar_id IS 'Outlook Calendar ID';
COMMENT ON COLUMN brokers.ghl_location_id IS 'GoHighLevel Location ID';
COMMENT ON COLUMN brokers.icloud_calendar_url IS 'iCloud CalDAV URL (rarely used)';
COMMENT ON COLUMN brokers.timezone IS 'Broker timezone for appointment scheduling';
COMMENT ON COLUMN brokers.business_hours IS 'Fallback hours if no calendar connected. Format: {"monday": ["09:00-17:00", "18:00-20:00"]}';

-- Set default for existing brokers
UPDATE brokers 
SET calendar_provider = 'none'
WHERE calendar_provider IS NULL;

-- Example: Set up Walter Richards with Google Calendar
-- UPDATE brokers 
-- SET calendar_provider = 'google',
--     calendar_credential_name = 'Walter Richards - Google Calendar',
--     google_calendar_id = 'primary',
--     timezone = 'America/Los_Angeles'
-- WHERE contact_name = 'Walter Richards';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check calendar setup for all brokers
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Broker calendar columns added';
  RAISE NOTICE '';
  RAISE NOTICE 'Current broker calendar status:';
END $$;

SELECT 
  contact_name as broker,
  calendar_provider,
  CASE 
    WHEN calendar_provider = 'google' THEN '✅ Google Calendar'
    WHEN calendar_provider = 'outlook' THEN '✅ Outlook'
    WHEN calendar_provider = 'ghl' THEN '✅ GoHighLevel'
    WHEN calendar_provider = 'icloud' THEN '⚠️  iCloud (fallback)'
    ELSE '⚪ Not connected (uses fallback)'
  END as status,
  timezone
FROM brokers
ORDER BY contact_name;

-- =====================================================
-- NEXT STEPS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. For each broker, determine their calendar provider';
  RAISE NOTICE '2. Connect OAuth credentials in n8n (Google/Outlook)';
  RAISE NOTICE '3. Update broker record with provider and calendar ID';
  RAISE NOTICE '4. Import workflow: workflows/broker-calendar-unified.json';
  RAISE NOTICE '5. Test availability check for each broker';
  RAISE NOTICE '';
  RAISE NOTICE 'See: docs/BROKER_CALENDAR_ONBOARDING.md for detailed setup';
END $$;

