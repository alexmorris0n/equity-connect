-- Create function to get broker daily stats for workflow reporting
-- Returns actual counts from database instead of parsing AI output

CREATE OR REPLACE FUNCTION get_broker_daily_stats(p_broker_id uuid)
RETURNS TABLE(
  total_created bigint,
  with_email bigint,
  uploaded bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint,
    COUNT(CASE WHEN primary_email IS NOT NULL THEN 1 END)::bigint,
    COUNT(CASE WHEN campaign_status = 'active' THEN 1 END)::bigint
  FROM leads 
  WHERE assigned_broker_id = p_broker_id
  AND created_at AT TIME ZONE 'America/Los_Angeles' >= CURRENT_DATE AT TIME ZONE 'America/Los_Angeles';
END;
$$ LANGUAGE plpgsql;

