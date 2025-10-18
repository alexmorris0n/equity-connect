-- ============================================
-- RESET WALTER'S COUNTERS FOR TEST RUN
-- ============================================
-- Purpose: Reset daily counters so the AI workflow can run fresh
-- Safe to run multiple times
-- ============================================

-- STEP 1: Find Walter's broker_id
-- Run this first to confirm you have the right broker
SELECT 
  id,
  company_name,
  contact_name,
  daily_lead_capacity,
  daily_lead_surplus,
  propertyradar_offset,
  propertyradar_list_id,
  status
FROM brokers 
WHERE company_name ILIKE '%walter%' 
   OR contact_name ILIKE '%walter%';

-- If you see Walter's record above, note the ID and continue

-- ============================================
-- STEP 2: RESET COUNTERS
-- ============================================
-- Replace 'WALTER_BROKER_ID_HERE' with actual UUID from Step 1

-- Reset daily_lead_surplus to 0
UPDATE brokers 
SET daily_lead_surplus = 0
WHERE company_name ILIKE '%walter%' 
   OR contact_name ILIKE '%walter%';

-- Optionally: Reset PropertyRadar offset to 0 (if you want to start from beginning of list)
-- Uncomment the next 3 lines if you want to reset offset:
-- UPDATE brokers 
-- SET propertyradar_offset = 0
-- WHERE company_name ILIKE '%walter%' OR contact_name ILIKE '%walter%';

-- ============================================
-- STEP 3: OPTIONAL - CLEAR TODAY'S LEADS
-- ============================================
-- WARNING: Only run this if you want to DELETE Walter's leads from today
-- This allows the workflow to pull fresh leads as if it's a new day

-- First, see how many leads would be affected:
SELECT COUNT(*) as todays_leads_count
FROM leads
WHERE assigned_broker_id = (
  SELECT id FROM brokers 
  WHERE company_name ILIKE '%walter%' 
     OR contact_name ILIKE '%walter%'
  LIMIT 1
)
AND created_at AT TIME ZONE 'America/Los_Angeles' >= (CURRENT_DATE AT TIME ZONE 'America/Los_Angeles')::timestamp;

-- If you want to DELETE today's leads, uncomment below:
-- DELETE FROM leads
-- WHERE assigned_broker_id = (
--   SELECT id FROM brokers 
--   WHERE company_name ILIKE '%walter%' 
--      OR contact_name ILIKE '%walter%'
--   LIMIT 1
-- )
-- AND created_at AT TIME ZONE 'America/Los_Angeles' >= (CURRENT_DATE AT TIME ZONE 'America/Los_Angeles')::timestamp;

-- ============================================
-- STEP 4: VERIFY RESET
-- ============================================
-- Check Walter's current state
SELECT 
  b.company_name,
  b.daily_lead_capacity,
  b.daily_lead_surplus,
  b.propertyradar_offset,
  COUNT(l.id) FILTER (
    WHERE l.created_at AT TIME ZONE 'America/Los_Angeles' >= (CURRENT_DATE AT TIME ZONE 'America/Los_Angeles')::timestamp
  ) as leads_today,
  COUNT(l.id) FILTER (
    WHERE l.created_at AT TIME ZONE 'America/Los_Angeles' >= (CURRENT_DATE AT TIME ZONE 'America/Los_Angeles')::timestamp
    AND l.campaign_status = 'active'
  ) as leads_uploaded_today
FROM brokers b
LEFT JOIN leads l ON l.assigned_broker_id = b.id
WHERE b.company_name ILIKE '%walter%' 
   OR b.contact_name ILIKE '%walter%'
GROUP BY b.id, b.company_name, b.daily_lead_capacity, b.daily_lead_surplus, b.propertyradar_offset;

-- ============================================
-- QUICK RESET (One-liner)
-- ============================================
-- If you just want to reset counters without deleting leads:

-- UPDATE brokers SET daily_lead_surplus = 0 WHERE company_name ILIKE '%walter%';

-- ============================================
-- CREATE HELPER FUNCTIONS FOR WORKFLOW
-- ============================================
-- These are referenced by the AI workflow but may not exist yet

-- Function: Count enriched leads today for a broker
CREATE OR REPLACE FUNCTION count_enriched_today(p_broker_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE AS $$
  SELECT COUNT(*)::INTEGER
  FROM leads
  WHERE assigned_broker_id = p_broker_id
    AND created_at AT TIME ZONE 'America/Los_Angeles' >= (CURRENT_DATE AT TIME ZONE 'America/Los_Angeles')::timestamp
    AND first_name IS NOT NULL
    AND last_name IS NOT NULL
    AND primary_email IS NOT NULL;
$$;

-- Function: Filter out radar_ids that already exist in database
CREATE OR REPLACE FUNCTION filter_new_radar_ids(p_radar_ids TEXT[])
RETURNS TABLE(radar_id TEXT)
LANGUAGE SQL
STABLE AS $$
  SELECT unnest(p_radar_ids) AS radar_id
  EXCEPT
  SELECT radar_id::TEXT FROM leads WHERE radar_id IS NOT NULL;
$$;

-- Function: Update broker's PropertyRadar offset
CREATE OR REPLACE FUNCTION update_broker_offset(p_broker_id UUID, p_increment INT)
RETURNS TABLE(new_offset INT)
LANGUAGE SQL
VOLATILE AS $$
  UPDATE brokers 
  SET propertyradar_offset = COALESCE(propertyradar_offset, 0) + p_increment
  WHERE id = p_broker_id
  RETURNING propertyradar_offset;
$$;

-- ============================================
-- DONE!
-- ============================================
-- Walter is ready for a test run
-- Run your AI Daily Lead Pull workflow now

