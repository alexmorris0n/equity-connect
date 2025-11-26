-- ============================================================================
-- FIX SECURITY DEFINER VIEWS
-- ============================================================================
-- These views had SECURITY DEFINER which bypasses RLS.
-- Recreating them as SECURITY INVOKER (default) so RLS applies.
-- ============================================================================

-- ============================================================================
-- 1. active_node_prompts
-- ============================================================================
-- This view shows active prompts config - reference data all users can read.
-- The underlying tables (prompts, prompt_versions) have broker_read policies.

DROP VIEW IF EXISTS public.active_node_prompts;

CREATE VIEW public.active_node_prompts 
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.name,
  p.vertical,
  p.node_name,
  p.current_version,
  pv.content,
  pv.variables,
  pv.version_number
FROM prompts p
JOIN prompt_versions pv ON p.id = pv.prompt_id
WHERE p.is_active = true 
  AND pv.is_active = true 
  AND pv.is_draft = false 
  AND p.node_name IS NOT NULL 
  AND p.vertical IS NOT NULL;

COMMENT ON VIEW public.active_node_prompts IS 'Active node prompts with their current versions - RLS applied via underlying tables';

-- ============================================================================
-- 2. broker_performance
-- ============================================================================
-- Shows broker performance metrics. RLS on brokers/leads/billing_events filters data.

DROP VIEW IF EXISTS public.broker_performance;

CREATE VIEW public.broker_performance 
WITH (security_invoker = true)
AS
SELECT 
  b.id,
  b.company_name,
  b.contact_name,
  COUNT(l.id) AS total_leads,
  COUNT(CASE WHEN l.status = 'appointment_set' THEN 1 END) AS appointments,
  COUNT(CASE WHEN l.status = 'funded' THEN 1 END) AS funded,
  COALESCE(SUM(be.amount) FILTER (WHERE be.status = 'paid'), 0) AS total_revenue,
  b.performance_score,
  b.conversion_rate,
  b.show_rate
FROM brokers b
LEFT JOIN leads l ON l.assigned_broker_id = b.id
LEFT JOIN billing_events be ON be.broker_id = b.id
WHERE b.status = 'active'
GROUP BY b.id, b.company_name, b.contact_name, b.performance_score, b.conversion_rate, b.show_rate;

COMMENT ON VIEW public.broker_performance IS 'Broker performance metrics - RLS applied via underlying tables';

-- ============================================================================
-- 3. broker_pull_dashboard
-- ============================================================================
-- Daily lead pull stats per broker. RLS on brokers/broker_daily_stats filters.

DROP VIEW IF EXISTS public.broker_pull_dashboard;

CREATE VIEW public.broker_pull_dashboard 
WITH (security_invoker = true)
AS
SELECT 
  b.id AS broker_id,
  b.company_name,
  b.daily_lead_capacity,
  COALESCE(bds.leads_pulled_today, 0) AS leads_pulled_today,
  COALESCE(bds.daily_target, b.daily_lead_capacity) AS daily_target,
  COALESCE(bds.pulls_remaining, b.daily_lead_capacity) AS pulls_remaining,
  COALESCE(bds.progress_percent, 0) AS progress_percent,
  bds.current_zip,
  bds.zips_processed,
  (SELECT COUNT(*) FROM broker_territories WHERE broker_territories.broker_id = b.id AND broker_territories.active = true) AS total_zips,
  bds.total_cost_today,
  bds.api_calls_today,
  bds.status,
  bds.last_pull_at,
  bds.next_pull_scheduled,
  bds.error_message,
  bds.pull_date
FROM brokers b
LEFT JOIN broker_daily_stats bds ON bds.broker_id = b.id AND bds.pull_date = CURRENT_DATE
WHERE b.status = 'active'
ORDER BY b.company_name;

COMMENT ON VIEW public.broker_pull_dashboard IS 'Broker daily pull dashboard - RLS applied via underlying tables';

-- ============================================================================
-- 4. lead_funnel_stats
-- ============================================================================
-- Lead counts by status. RLS on leads filters to broker's own leads.

DROP VIEW IF EXISTS public.lead_funnel_stats;

CREATE VIEW public.lead_funnel_stats 
WITH (security_invoker = true)
AS
SELECT 
  status,
  COUNT(*) AS count,
  ROUND((COUNT(*)::numeric * 100.0) / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM leads
GROUP BY status
ORDER BY 
  CASE status
    WHEN 'new' THEN 1
    WHEN 'contacted' THEN 2
    WHEN 'replied' THEN 3
    WHEN 'qualified' THEN 4
    WHEN 'appointment_set' THEN 5
    WHEN 'showed' THEN 6
    WHEN 'application' THEN 7
    WHEN 'funded' THEN 8
    WHEN 'closed_lost' THEN 9
    ELSE NULL
  END;

COMMENT ON VIEW public.lead_funnel_stats IS 'Lead funnel statistics by status - RLS applied via leads table';

-- ============================================================================
-- 5. propertyradar_quality_stats
-- ============================================================================
-- Lead quality metrics by date. RLS on leads filters to broker's own.

DROP VIEW IF EXISTS public.propertyradar_quality_stats;

CREATE VIEW public.propertyradar_quality_stats 
WITH (security_invoker = true)
AS
SELECT 
  DATE(created_at) AS date,
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE radar_id IS NOT NULL) AS propertyradar_leads,
  COUNT(*) FILTER (WHERE primary_email IS NOT NULL) AS with_email,
  COUNT(*) FILTER (WHERE primary_phone IS NOT NULL) AS with_phone,
  COUNT(*) FILTER (WHERE primary_email IS NOT NULL AND primary_phone IS NOT NULL) AS with_both,
  COUNT(*) FILTER (WHERE primary_email IS NOT NULL OR primary_phone IS NOT NULL) AS with_any_contact,
  ROUND((100.0 * COUNT(*) FILTER (WHERE primary_email IS NOT NULL OR primary_phone IS NOT NULL)::numeric) / NULLIF(COUNT(*), 0)::numeric, 2) AS contact_rate_pct,
  COUNT(*) FILTER (WHERE skiptrace_tier = 0) AS radar_only,
  COUNT(*) FILTER (WHERE skiptrace_tier = 1) AS pdl_enriched,
  COUNT(*) FILTER (WHERE skiptrace_tier = 2) AS melissa_enriched,
  AVG(estimated_equity) FILTER (WHERE estimated_equity IS NOT NULL) AS avg_estimated_equity
FROM leads l
WHERE created_at >= (CURRENT_DATE - INTERVAL '30 days')
  AND radar_id IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

COMMENT ON VIEW public.propertyradar_quality_stats IS 'PropertyRadar lead quality stats - RLS applied via leads table';

-- ============================================================================
-- 6. v_billing_summary
-- ============================================================================
-- Billing summary by broker/date. RLS on billing_call_logs/brokers filters.

DROP VIEW IF EXISTS public.v_billing_summary;

CREATE VIEW public.v_billing_summary 
WITH (security_invoker = true)
AS
SELECT 
  DATE(bcl.created_at) AS call_date,
  b.company_name AS broker_company,
  b.contact_name AS broker_name,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE bcl.direction = 'broker_to_lead') AS broker_outbound,
  COUNT(*) FILTER (WHERE bcl.direction = 'lead_to_broker') AS lead_inbound,
  COUNT(*) FILTER (WHERE bcl.duration_seconds > 300) AS billable_calls,
  SUM(bcl.duration_seconds) AS total_duration_seconds,
  AVG(bcl.duration_seconds) FILTER (WHERE bcl.duration_seconds > 60) AS avg_duration_seconds,
  COUNT(DISTINCT bcl.lead_id) AS unique_leads,
  COUNT(DISTINCT bcl.campaign_id) AS campaigns_count
FROM billing_call_logs bcl
JOIN brokers b ON bcl.broker_id = b.id
GROUP BY DATE(bcl.created_at), b.company_name, b.contact_name
ORDER BY DATE(bcl.created_at) DESC, COUNT(*) DESC;

COMMENT ON VIEW public.v_billing_summary IS 'Billing call summary - RLS applied via underlying tables';

-- ============================================================================
-- 7. vw_broker_daily_attribution
-- ============================================================================
-- Daily attribution stats. RLS on brokers/leads/pipeline_events filters.

DROP VIEW IF EXISTS public.vw_broker_daily_attribution;

CREATE VIEW public.vw_broker_daily_attribution 
WITH (security_invoker = true)
AS
WITH broker_stats AS (
  SELECT 
    b.id AS broker_id,
    b.company_name,
    b.daily_lead_capacity,
    COUNT(l.id) AS total_pulls_today,
    COUNT(l.id) FILTER (WHERE l.first_name IS NOT NULL AND l.last_name IS NOT NULL AND l.primary_email IS NOT NULL) AS successful_enrichments_today
  FROM brokers b
  LEFT JOIN leads l ON l.assigned_broker_id = b.id 
    AND l.created_at >= (DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles')
    AND l.created_at < ((DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '1 day') AT TIME ZONE 'America/Los_Angeles')
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
    AND pe.created_at >= (DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles')
    AND pe.created_at < ((DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '1 day') AT TIME ZONE 'America/Los_Angeles')
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
  ROUND((bs.successful_enrichments_today::numeric / NULLIF(bs.daily_lead_capacity, 0)::numeric) * 100, 2) AS completion_percentage
FROM broker_stats bs
LEFT JOIN pending_stats ps ON ps.broker_id = bs.broker_id
ORDER BY GREATEST(0, bs.daily_lead_capacity - (bs.successful_enrichments_today + COALESCE(ps.pending_enrichments_today, 0))) DESC;

COMMENT ON VIEW public.vw_broker_daily_attribution IS 'Broker daily attribution dashboard - RLS applied via underlying tables';

-- ============================================================================
-- 8. vw_lead_quality_summary
-- ============================================================================
-- Lead quality grouped by status/source. RLS on leads filters.

DROP VIEW IF EXISTS public.vw_lead_quality_summary;

CREATE VIEW public.vw_lead_quality_summary 
WITH (security_invoker = true)
AS
SELECT 
  status,
  source,
  COUNT(*) AS count,
  AVG(quality_score) AS avg_quality_score,
  COUNT(CASE WHEN quality_score >= 60 THEN 1 END) AS contactable_count,
  COUNT(CASE WHEN quality_score >= 40 AND quality_score < 60 THEN 1 END) AS enriched_count,
  COUNT(CASE WHEN quality_score < 40 THEN 1 END) AS low_quality_count
FROM leads
GROUP BY status, source;

COMMENT ON VIEW public.vw_lead_quality_summary IS 'Lead quality summary by status and source - RLS applied via leads table';

-- ============================================================================
-- DONE - All 8 views now use SECURITY INVOKER (default)
-- RLS policies on underlying tables will filter data appropriately
-- ============================================================================

