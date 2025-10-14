-- ============================================
-- Enrichment Backfill System - SQL Functions
-- ============================================
-- Run this in Supabase SQL Editor to create:
-- 1. Timezone-aware enrichment counting function
-- 2. Attribution dashboard view
-- 3. Performance indexes

-- ============================================
-- 1. Count Successful Enrichments Today (LA Timezone)
-- ============================================
-- Counts leads for a specific broker that were:
-- - Created today (America/Los_Angeles business day)
-- - Successfully enriched (first_name + last_name + primary_email)
-- Used by backfill workflows to calculate shortfall

CREATE OR REPLACE FUNCTION broker_successful_enrichments_today(p_broker UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE AS $$
  WITH local_day AS (
    SELECT DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Los_Angeles') AS start_local
  )
  SELECT COUNT(*)::INTEGER
  FROM leads l
  CROSS JOIN local_day d
  WHERE l.assigned_broker_id = p_broker
    AND l.created_at >= (d.start_local AT TIME ZONE 'America/Los_Angeles')
    AND l.created_at < ((d.start_local + INTERVAL '1 day') AT TIME ZONE 'America/Los_Angeles')
    AND l.first_name IS NOT NULL
    AND l.last_name IS NOT NULL
    AND l.primary_email IS NOT NULL;
$$;

-- Test the function (optional):
-- SELECT broker_successful_enrichments_today('your-broker-uuid-here');


-- ============================================
-- 2. Count Pending Enrichment Events Today (LA Timezone)
-- ============================================
-- Counts pipeline_events that are still pending enrichment
-- Prevents backfill from over-pulling while enrichment is in progress
-- Used to calculate "in-flight" total: successful + pending

CREATE OR REPLACE FUNCTION broker_pending_enrichments_today(p_broker UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE AS $$
  WITH local_day AS (
    SELECT DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Los_Angeles') AS start_local
  )
  SELECT COUNT(*)::INTEGER
  FROM pipeline_events pe
  CROSS JOIN local_day d
  WHERE pe.broker_id = p_broker
    AND pe.event_type = 'enrich_propertyradar'
    AND pe.status = 'pending'
    AND pe.created_at >= (d.start_local AT TIME ZONE 'America/Los_Angeles')
    AND pe.created_at < ((d.start_local + INTERVAL '1 day') AT TIME ZONE 'America/Los_Angeles');
$$;

-- Test the function (optional):
-- SELECT broker_pending_enrichments_today('your-broker-uuid-here');


-- ============================================
-- 3. Broker Daily Attribution Dashboard View
-- ============================================
-- Shows real-time attribution and shortfall per broker
-- Useful for monitoring and ops dashboards

CREATE OR REPLACE VIEW vw_broker_daily_attribution AS
WITH broker_stats AS (
  SELECT 
    b.id AS broker_id,
    b.company_name,
    b.daily_lead_capacity,
    COUNT(l.id) AS total_pulls_today,
    COUNT(l.id) FILTER (
      WHERE l.first_name IS NOT NULL 
      AND l.last_name IS NOT NULL 
      AND l.primary_email IS NOT NULL
    ) AS successful_enrichments_today
  FROM brokers b
  LEFT JOIN leads l ON l.assigned_broker_id = b.id 
    AND l.created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles'
    AND l.created_at < (DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '1 day') AT TIME ZONE 'America/Los_Angeles'
  WHERE b.status = 'active'
  GROUP BY b.id, b.company_name, b.daily_lead_capacity
),
pending_stats AS (
  SELECT 
    pe.broker_id,
    COUNT(*) AS pending_enrichments_today
  FROM pipeline_events pe
  WHERE pe.event_type = 'enrich_propertyradar'
    AND pe.status = 'pending'
    AND pe.created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles'
    AND pe.created_at < (DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '1 day') AT TIME ZONE 'America/Los_Angeles'
  GROUP BY pe.broker_id
)
SELECT 
  bs.broker_id,
  bs.company_name,
  bs.daily_lead_capacity,
  bs.total_pulls_today,
  bs.successful_enrichments_today,
  COALESCE(ps.pending_enrichments_today, 0) AS pending_enrichments_today,
  (bs.successful_enrichments_today + COALESCE(ps.pending_enrichments_today, 0)) AS in_flight_total,
  GREATEST(0, bs.daily_lead_capacity - (bs.successful_enrichments_today + COALESCE(ps.pending_enrichments_today, 0))) AS true_shortfall,
  ROUND(
    (bs.successful_enrichments_today::NUMERIC / NULLIF(bs.daily_lead_capacity, 0) * 100), 
    2
  ) AS completion_percentage
FROM broker_stats bs
LEFT JOIN pending_stats ps ON ps.broker_id = bs.broker_id
ORDER BY true_shortfall DESC;

-- Query the view:
-- SELECT * FROM vw_broker_daily_attribution;


-- ============================================
-- 3. Performance Indexes
-- ============================================
-- Speeds up timezone-aware queries and attribution lookups

-- Index for successful enrichment queries (what we count)
CREATE INDEX IF NOT EXISTS leads_broker_created_enriched_idx
  ON leads (assigned_broker_id, created_at)
  WHERE first_name IS NOT NULL AND last_name IS NOT NULL AND primary_email IS NOT NULL;

-- Index for quality tracking queries
CREATE INDEX IF NOT EXISTS leads_enrichment_quality_idx
  ON leads (enrichment_quality)
  WHERE enrichment_quality IS NOT NULL;

-- Index for all attribution queries (total pulls)
CREATE INDEX IF NOT EXISTS leads_broker_created_all_idx
  ON leads (assigned_broker_id, created_at);

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify everything is working:

-- 1. Check if function exists
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_name = 'broker_successful_enrichments_today';

-- 2. Check if view exists
-- SELECT table_name, table_type 
-- FROM information_schema.tables 
-- WHERE table_name = 'vw_broker_daily_attribution';

-- 3. Check if indexes exist
-- SELECT indexname, tablename 
-- FROM pg_indexes 
-- WHERE tablename = 'leads' 
-- AND indexname LIKE '%enriched%';

-- ============================================
-- Complete!
-- ============================================
-- Next steps:
-- 1. Run the backfill checker workflows
-- 2. Manually add enrichment_quality field to enrichment waterfall
-- 3. Monitor vw_broker_daily_attribution for real-time stats

