-- Barbara Call Evaluation Dashboard Queries
-- Run these in Supabase SQL Editor to analyze call performance

-- ============================================
-- 1. Recent Call Evaluations (Last 24 Hours)
-- ============================================
SELECT 
  ce.id,
  ce.evaluated_at,
  ce.overall_score,
  ce.opening_effectiveness,
  ce.property_discussion_quality,
  ce.objection_handling,
  ce.booking_attempt_quality,
  ce.tone_consistency,
  ce.overall_call_flow,
  i.outcome,
  i.duration_seconds,
  ce.prompt_version,
  ce.analysis->>'summary' as summary
FROM call_evaluations ce
JOIN interactions i ON ce.interaction_id = i.id
WHERE ce.evaluated_at > NOW() - INTERVAL '24 hours'
ORDER BY ce.evaluated_at DESC;

-- ============================================
-- 2. Prompt Version Comparison
-- ============================================
SELECT 
  prompt_version,
  COUNT(*) as total_calls,
  ROUND(AVG(overall_score), 2) as avg_overall_score,
  ROUND(AVG(opening_effectiveness), 2) as avg_opening,
  ROUND(AVG(property_discussion_quality), 2) as avg_property_discussion,
  ROUND(AVG(objection_handling), 2) as avg_objection_handling,
  ROUND(AVG(booking_attempt_quality), 2) as avg_booking_attempt,
  ROUND(AVG(tone_consistency), 2) as avg_tone,
  ROUND(AVG(overall_call_flow), 2) as avg_call_flow
FROM call_evaluations
WHERE prompt_version IS NOT NULL
GROUP BY prompt_version
ORDER BY avg_overall_score DESC;

-- ============================================
-- 3. Score Trend Over Time (Last 7 Days)
-- ============================================
SELECT 
  DATE(evaluated_at) as date,
  COUNT(*) as calls_evaluated,
  ROUND(AVG(overall_score), 2) as avg_score,
  ROUND(AVG(booking_attempt_quality), 2) as avg_booking_quality,
  ROUND(AVG(objection_handling), 2) as avg_objection_handling
FROM call_evaluations
WHERE evaluated_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(evaluated_at)
ORDER BY date DESC;

-- ============================================
-- 4. Red Flags and Weaknesses
-- ============================================
SELECT 
  ce.id,
  ce.evaluated_at,
  ce.overall_score,
  i.outcome,
  ce.analysis->'red_flags' as red_flags,
  ce.analysis->'weaknesses' as weaknesses,
  ce.analysis->>'summary' as summary
FROM call_evaluations ce
JOIN interactions i ON ce.interaction_id = i.id
WHERE 
  ce.overall_score < 6.0 
  OR jsonb_array_length(ce.analysis->'red_flags') > 0
ORDER BY ce.evaluated_at DESC
LIMIT 20;

-- ============================================
-- 5. Best Performing Calls (Learn From Winners)
-- ============================================
SELECT 
  ce.id,
  ce.evaluated_at,
  ce.overall_score,
  i.outcome,
  i.duration_seconds,
  ce.analysis->'strengths' as strengths,
  ce.analysis->>'summary' as summary,
  ce.prompt_version
FROM call_evaluations ce
JOIN interactions i ON ce.interaction_id = i.id
WHERE ce.overall_score >= 8.0
ORDER BY ce.overall_score DESC
LIMIT 10;

-- ============================================
-- 6. Common Objections Analysis
-- ============================================
SELECT 
  ce.evaluated_at,
  ce.overall_score,
  ce.objection_handling as objection_handling_score,
  jsonb_array_elements_text(ce.analysis->'objections_handled') as objection
FROM call_evaluations ce
WHERE jsonb_array_length(ce.analysis->'objections_handled') > 0
ORDER BY ce.evaluated_at DESC
LIMIT 50;

-- ============================================
-- 7. Missed Booking Opportunities
-- ============================================
SELECT 
  ce.evaluated_at,
  ce.booking_attempt_quality,
  i.outcome,
  ce.analysis->'booking_opportunities_missed' as missed_opportunities,
  ce.analysis->>'summary' as summary
FROM call_evaluations ce
JOIN interactions i ON ce.interaction_id = i.id
WHERE 
  jsonb_array_length(ce.analysis->'booking_opportunities_missed') > 0
  AND i.outcome != 'appointment_booked'
ORDER BY ce.evaluated_at DESC
LIMIT 20;

-- ============================================
-- 8. Evaluation Performance Stats
-- ============================================
SELECT 
  COUNT(*) as total_evaluations,
  ROUND(AVG(evaluation_duration_ms), 0) as avg_duration_ms,
  MIN(evaluation_duration_ms) as min_duration_ms,
  MAX(evaluation_duration_ms) as max_duration_ms,
  ROUND(AVG(overall_score), 2) as avg_overall_score,
  COUNT(CASE WHEN overall_score >= 8.0 THEN 1 END) as excellent_calls,
  COUNT(CASE WHEN overall_score < 6.0 THEN 1 END) as poor_calls
FROM call_evaluations;

