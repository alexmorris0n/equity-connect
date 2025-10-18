-- Portal Dashboard Queries for Reply Analytics
-- Copy these queries into your portal backend/API
-- All queries are optimized with indexes

-- ============================================
-- OVERVIEW / KEY METRICS
-- ============================================

-- Today's Stats
SELECT 
  COUNT(*) as replies_today,
  SUM(cost_usd) as cost_today,
  AVG(cost_usd) as avg_cost_per_reply,
  AVG(token_count_total) as avg_tokens,
  COUNT(CASE WHEN call_triggered THEN 1 END) as calls_triggered,
  COUNT(CASE WHEN had_errors THEN 1 END) as errors
FROM reply_analytics
WHERE DATE(created_at) = CURRENT_DATE;

-- This Week's Stats
SELECT 
  COUNT(*) as replies_week,
  SUM(cost_usd) as cost_week,
  AVG(cost_usd) as avg_cost_per_reply,
  COUNT(CASE WHEN call_triggered THEN 1 END) as calls_triggered
FROM reply_analytics
WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE);

-- This Month's Stats
SELECT 
  COUNT(*) as replies_month,
  SUM(cost_usd) as cost_month,
  AVG(cost_usd) as avg_cost_per_reply,
  COUNT(CASE WHEN call_triggered THEN 1 END) as calls_triggered
FROM reply_analytics
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE);

-- ============================================
-- INTENT DISTRIBUTION
-- ============================================

-- Intent Breakdown (Today)
SELECT 
  intent,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) as percentage,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_cost
FROM reply_analytics
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY intent
ORDER BY count DESC;

-- Intent Trend (Last 30 Days)
SELECT 
  DATE(created_at) as date,
  intent,
  COUNT(*) as count
FROM reply_analytics
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), intent
ORDER BY date DESC, intent;

-- ============================================
-- COST TRACKING
-- ============================================

-- Daily Cost Trend (Last 30 Days)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as reply_count,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_cost_per_reply,
  SUM(token_count_total) as total_tokens
FROM reply_analytics
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Cost by Intent (Last 30 Days)
SELECT 
  intent,
  COUNT(*) as replies,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_cost,
  SUM(token_count_total) as total_tokens,
  AVG(token_count_total) as avg_tokens
FROM reply_analytics
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY intent
ORDER BY total_cost DESC;

-- ============================================
-- CONVERSATION QUALITY
-- ============================================

-- Lead Engagement Summary
SELECT 
  COUNT(DISTINCT lead_id) as unique_leads,
  AVG(total_replies) as avg_replies_per_lead,
  AVG(total_conversation_cost) as avg_cost_per_conversation,
  COUNT(CASE WHEN call_was_triggered THEN 1 END) as leads_with_calls,
  ROUND(
    COUNT(CASE WHEN call_was_triggered THEN 1 END)::numeric / 
    COUNT(DISTINCT lead_id)::numeric * 100, 
    2
  ) as call_conversion_rate
FROM reply_analytics_conversation_summary
WHERE last_reply_at >= CURRENT_DATE - INTERVAL '30 days';

-- Top Engaged Leads (Most Replies)
SELECT 
  l.first_name,
  l.last_name,
  l.primary_email,
  cs.total_replies,
  cs.conversation_depth,
  cs.intent_sequence,
  cs.call_was_triggered,
  cs.total_conversation_cost,
  cs.last_reply_at
FROM reply_analytics_conversation_summary cs
JOIN leads l ON l.id = cs.lead_id
WHERE cs.last_reply_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY cs.total_replies DESC
LIMIT 20;

-- ============================================
-- VAPI CALL PERFORMANCE
-- ============================================

-- VAPI Call Stats (Last 30 Days)
SELECT 
  COUNT(CASE WHEN call_triggered THEN 1 END) as calls_triggered,
  COUNT(CASE WHEN call_completed THEN 1 END) as calls_completed,
  ROUND(
    COUNT(CASE WHEN call_completed THEN 1 END)::numeric / 
    NULLIF(COUNT(CASE WHEN call_triggered THEN 1 END), 0)::numeric * 100, 
    2
  ) as completion_rate_percent,
  AVG(CASE WHEN call_duration_seconds > 0 THEN call_duration_seconds END) as avg_call_duration_seconds,
  COUNT(CASE WHEN call_outcome = 'booked' THEN 1 END) as bookings,
  ROUND(
    COUNT(CASE WHEN call_outcome = 'booked' THEN 1 END)::numeric / 
    NULLIF(COUNT(CASE WHEN call_completed THEN 1 END), 0)::numeric * 100, 
    2
  ) as booking_conversion_rate
FROM reply_analytics
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Daily Call Trend
SELECT 
  DATE(created_at) as date,
  COUNT(CASE WHEN call_triggered THEN 1 END) as calls_triggered,
  COUNT(CASE WHEN call_completed THEN 1 END) as calls_completed,
  COUNT(CASE WHEN call_outcome = 'booked' THEN 1 END) as bookings
FROM reply_analytics
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND call_triggered = true
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================
-- AI PERFORMANCE
-- ============================================

-- AI Efficiency Stats
SELECT 
  AVG(token_count_total) as avg_tokens,
  AVG(ai_steps) as avg_steps,
  AVG(cost_usd) as avg_cost,
  MIN(token_count_total) as min_tokens,
  MAX(token_count_total) as max_tokens,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY token_count_total) as median_tokens,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY token_count_total) as p95_tokens
FROM reply_analytics
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Token Usage by Intent
SELECT 
  intent,
  AVG(token_count_total) as avg_tokens,
  AVG(ai_steps) as avg_steps,
  AVG(cost_usd) as avg_cost,
  COUNT(*) as sample_size
FROM reply_analytics
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY intent
ORDER BY avg_tokens DESC;

-- ============================================
-- CAMPAIGN PERFORMANCE
-- ============================================

-- Performance by Campaign
SELECT 
  campaign_id,
  COUNT(*) as total_replies,
  COUNT(DISTINCT lead_id) as unique_leads,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_cost_per_reply,
  COUNT(CASE WHEN call_triggered THEN 1 END) as calls_triggered,
  ROUND(
    COUNT(CASE WHEN call_triggered THEN 1 END)::numeric / 
    COUNT(*)::numeric * 100, 
    2
  ) as call_trigger_rate
FROM reply_analytics
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND campaign_id IS NOT NULL
GROUP BY campaign_id
ORDER BY total_replies DESC;

-- ============================================
-- ERROR TRACKING
-- ============================================

-- Recent Errors
SELECT 
  created_at,
  intent,
  error_details,
  metadata
FROM reply_analytics
WHERE had_errors = true
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;

-- Error Rate by Intent
SELECT 
  intent,
  COUNT(*) as total_attempts,
  COUNT(CASE WHEN had_errors THEN 1 END) as errors,
  ROUND(
    COUNT(CASE WHEN had_errors THEN 1 END)::numeric / 
    COUNT(*)::numeric * 100, 
    2
  ) as error_rate_percent
FROM reply_analytics
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY intent
ORDER BY error_rate_percent DESC;

-- ============================================
-- REAL-TIME / RECENT ACTIVITY
-- ============================================

-- Last 10 Replies (Live Feed)
SELECT 
  ra.created_at,
  l.first_name,
  l.last_name,
  l.primary_email,
  ra.intent,
  ra.cost_usd,
  ra.call_triggered,
  ra.had_errors
FROM reply_analytics ra
JOIN leads l ON l.id = ra.lead_id
ORDER BY ra.created_at DESC
LIMIT 10;

-- Replies in Last Hour (For Real-Time Dashboard)
SELECT 
  COUNT(*) as replies_last_hour,
  SUM(cost_usd) as cost_last_hour,
  COUNT(CASE WHEN call_triggered THEN 1 END) as calls_last_hour
FROM reply_analytics
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- ============================================
-- PROJECTIONS & FORECASTING
-- ============================================

-- Monthly Cost Projection (Based on Current Rate)
WITH daily_avg AS (
  SELECT 
    AVG(daily_cost) as avg_daily_cost,
    AVG(daily_replies) as avg_daily_replies
  FROM (
    SELECT 
      DATE(created_at) as date,
      SUM(cost_usd) as daily_cost,
      COUNT(*) as daily_replies
    FROM reply_analytics
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY DATE(created_at)
  ) daily_stats
)
SELECT 
  avg_daily_cost,
  avg_daily_replies,
  avg_daily_cost * 30 as projected_monthly_cost,
  avg_daily_replies * 30 as projected_monthly_replies
FROM daily_avg;

-- ============================================
-- NOTES FOR PORTAL IMPLEMENTATION
-- ============================================

/*
PERFORMANCE TIPS:
1. All queries use indexed columns (lead_id, intent, created_at)
2. For real-time dashboards, cache results for 1-5 minutes
3. Use date ranges to limit data scanned
4. Consider materialized views for heavy aggregations

VISUALIZATION SUGGESTIONS:
- Overview: Big number cards (replies, cost, calls)
- Intent Distribution: Pie chart or donut chart
- Cost Trend: Line chart (daily over 30 days)
- Conversation Quality: Bar chart (replies per lead distribution)
- VAPI Performance: Funnel chart (triggered → completed → booked)
- AI Performance: Scatter plot (tokens vs cost)

API ENDPOINTS TO BUILD:
- GET /api/analytics/overview?period=today|week|month
- GET /api/analytics/intents?period=30d
- GET /api/analytics/costs?period=30d&group_by=day|week|month
- GET /api/analytics/conversations?limit=20
- GET /api/analytics/vapi?period=30d
- GET /api/analytics/realtime (SSE or polling)
*/

