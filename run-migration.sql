-- =====================================================
-- QUICK NYLAS MIGRATION
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add Nylas columns to brokers table
ALTER TABLE brokers
ADD COLUMN IF NOT EXISTS nylas_grant_id VARCHAR(200),
ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS calendar_provider VARCHAR(20) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Los_Angeles';

-- Add comments
COMMENT ON COLUMN brokers.nylas_grant_id IS 'Nylas grant ID (e.g., grant_abc123) - stores OAuth tokens securely';
COMMENT ON COLUMN brokers.calendar_provider IS 'Auto-detected by Nylas: google | microsoft | icloud | exchange';
COMMENT ON COLUMN brokers.calendar_synced_at IS 'When broker last synced their calendar via Nylas OAuth';
COMMENT ON COLUMN brokers.timezone IS 'Broker timezone for appointment scheduling';

-- Set default for existing brokers
UPDATE brokers 
SET calendar_provider = 'none'
WHERE calendar_provider IS NULL;

-- Create helper function to find brokers needing sync
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

-- Verify migration
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

-- Show success message
DO $$
BEGIN
  RAISE NOTICE '✅ Nylas calendar columns added successfully!';
  RAISE NOTICE '📊 Next: Deploy Supabase Edge Functions';
END $$;

