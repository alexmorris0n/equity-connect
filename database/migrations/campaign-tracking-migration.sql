-- ================================================================
-- CAMPAIGN TRACKING MIGRATION
-- Version: 1.0
-- Date: October 13, 2025
-- Purpose: Add timestamp tracking for 3/6/9 month re-engagement
-- ================================================================

-- ================================================================
-- PART 1: Add Tracking Fields to Leads Table
-- ================================================================

-- Add campaign date tracking columns
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS first_campaign_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_campaign_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS campaign_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reply_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_interaction_date TIMESTAMP;

-- Add indexes for re-engagement queries
CREATE INDEX IF NOT EXISTS idx_leads_first_campaign_date 
ON leads(first_campaign_date) 
WHERE first_campaign_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_last_reply_date 
ON leads(last_reply_date) 
WHERE last_reply_date IS NOT NULL;

-- Add comment documentation
COMMENT ON COLUMN leads.first_campaign_date IS 'Timestamp when lead first entered ANY campaign (for 3/6/9 month re-engagement)';
COMMENT ON COLUMN leads.last_campaign_date IS 'Timestamp when lead last entered a campaign';
COMMENT ON COLUMN leads.campaign_count IS 'Number of times lead has been added to campaigns (retries)';
COMMENT ON COLUMN leads.last_reply_date IS 'Timestamp of most recent email reply from lead';
COMMENT ON COLUMN leads.last_interaction_date IS 'Timestamp of any interaction (reply, open, click, booking)';

-- ================================================================
-- PART 2: Update RPC Function for Campaign History
-- ================================================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS add_to_campaign_history(UUID, VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS add_to_campaign_history(UUID, VARCHAR, VARCHAR, VARCHAR, TIMESTAMP);

-- Create/Replace RPC function with timestamp tracking
CREATE OR REPLACE FUNCTION add_to_campaign_history(
  p_lead_id UUID,
  p_archetype VARCHAR,
  p_campaign_id VARCHAR,
  p_campaign_name VARCHAR,
  p_added_at TIMESTAMP DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  v_history JSONB;
  v_new_entry JSONB;
  v_entry_count INTEGER;
BEGIN
  -- Build new campaign history entry
  v_new_entry := jsonb_build_object(
    'archetype', p_archetype,
    'campaign_id', p_campaign_id,
    'campaign_name', p_campaign_name,
    'added_at', p_added_at,
    'result', NULL  -- Will be updated by reply webhooks later
  );
  
  -- Get existing history (or empty array if NULL)
  SELECT COALESCE(campaign_history, '[]'::jsonb) INTO v_history
  FROM leads WHERE id = p_lead_id;
  
  -- Append new entry to history array
  v_history := v_history || v_new_entry;
  v_entry_count := jsonb_array_length(v_history);
  
  -- Update lead with all tracking fields
  UPDATE leads SET
    campaign_history = v_history,
    campaign_archetype = p_archetype,
    status = 'in_campaign',
    first_campaign_date = COALESCE(first_campaign_date, p_added_at),  -- Set once, never change
    last_campaign_date = p_added_at,  -- Always update to latest
    campaign_count = v_entry_count,  -- Total number of campaign entries
    updated_at = NOW()
  WHERE id = p_lead_id;
  
  -- Return success with entry count
  RETURN jsonb_build_object(
    'success', true, 
    'entries', v_entry_count,
    'first_campaign_date', (SELECT first_campaign_date FROM leads WHERE id = p_lead_id),
    'archetype', p_archetype
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_to_campaign_history TO anon, authenticated, service_role;

-- ================================================================
-- PART 3: Update View for Fresh Leads Only
-- ================================================================

-- Drop existing view if exists
DROP VIEW IF EXISTS vw_campaign_ready_leads;

-- Create view that filters for FRESH LEADS ONLY
CREATE OR REPLACE VIEW vw_campaign_ready_leads AS
SELECT 
  l.*,
  ROW_NUMBER() OVER (
    PARTITION BY l.assigned_broker_id 
    ORDER BY l.created_at ASC
  ) AS broker_row_number
FROM leads l
WHERE 
  -- Must be enriched and assigned
  l.status IN ('enriched', 'campaign_ready')
  AND l.assigned_broker_id IS NOT NULL
  
  -- FRESH LEADS ONLY: Never been in a campaign
  AND (
    l.campaign_history IS NULL 
    OR l.campaign_history = '[]'::jsonb
    OR jsonb_array_length(l.campaign_history) = 0
  )
  
  -- Not opted out or dead
  AND l.status NOT IN ('unsubscribed', 'bounced', 'not_interested', 'dead')
  
  -- Has required data
  AND l.primary_email IS NOT NULL
  AND l.first_name IS NOT NULL
  AND l.property_value IS NOT NULL
  AND l.estimated_equity IS NOT NULL;

-- Grant permissions
GRANT SELECT ON vw_campaign_ready_leads TO anon, authenticated, service_role;

COMMENT ON VIEW vw_campaign_ready_leads IS 'Fresh leads ready for campaign assignment - excludes leads with existing campaign history';

-- ================================================================
-- PART 4: Create Re-Engagement Views (For Future Workflows)
-- ================================================================

-- 3-Month Re-Engagement View
CREATE OR REPLACE VIEW vw_reengagement_3month AS
SELECT 
  l.*,
  l.first_campaign_date,
  l.campaign_count,
  (l.campaign_history->0->>'archetype') AS original_archetype,
  AGE(NOW(), l.first_campaign_date) AS time_since_first_campaign
FROM leads l
WHERE 
  -- First campaign was 3+ months ago
  l.first_campaign_date <= NOW() - INTERVAL '3 months'
  
  -- Never replied
  AND l.last_reply_date IS NULL
  
  -- Not in active campaign
  AND l.status NOT IN ('in_campaign', 'appointment_booked', 'unsubscribed', 'not_interested')
  
  -- Tried less than 2 times (allow one re-engagement)
  AND l.campaign_count < 2;

GRANT SELECT ON vw_reengagement_3month TO anon, authenticated, service_role;

-- 6-Month Re-Engagement View
CREATE OR REPLACE VIEW vw_reengagement_6month AS
SELECT 
  l.*,
  l.first_campaign_date,
  l.campaign_count,
  (l.campaign_history->0->>'archetype') AS original_archetype,
  AGE(NOW(), l.first_campaign_date) AS time_since_first_campaign
FROM leads l
WHERE 
  l.first_campaign_date <= NOW() - INTERVAL '6 months'
  AND l.last_reply_date IS NULL
  AND l.status NOT IN ('in_campaign', 'appointment_booked', 'unsubscribed', 'not_interested')
  AND l.campaign_count < 3;

GRANT SELECT ON vw_reengagement_6month TO anon, authenticated, service_role;

-- 9-Month Re-Engagement View
CREATE OR REPLACE VIEW vw_reengagement_9month AS
SELECT 
  l.*,
  l.first_campaign_date,
  l.campaign_count,
  (l.campaign_history->0->>'archetype') AS original_archetype,
  AGE(NOW(), l.first_campaign_date) AS time_since_first_campaign
FROM leads l
WHERE 
  l.first_campaign_date <= NOW() - INTERVAL '9 months'
  AND l.last_reply_date IS NULL
  AND l.status NOT IN ('in_campaign', 'appointment_booked', 'unsubscribed', 'not_interested')
  AND l.campaign_count < 4;

GRANT SELECT ON vw_reengagement_9month TO anon, authenticated, service_role;

-- ================================================================
-- PART 5: Helper Function to Update Reply Status
-- ================================================================

-- Function to log when lead replies (called by reply webhook)
CREATE OR REPLACE FUNCTION log_lead_reply(
  p_lead_id UUID,
  p_reply_text TEXT DEFAULT NULL,
  p_sentiment VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_history JSONB;
  v_last_entry JSONB;
BEGIN
  -- Update reply timestamp
  UPDATE leads SET
    last_reply_date = NOW(),
    last_interaction_date = NOW(),
    status = CASE 
      WHEN p_sentiment = 'POSITIVE' THEN 'replied_positive'
      WHEN p_sentiment = 'NEGATIVE' THEN 'replied_negative'
      ELSE 'replied_neutral'
    END
  WHERE id = p_lead_id;
  
  -- Update last campaign history entry with result
  SELECT campaign_history INTO v_history
  FROM leads WHERE id = p_lead_id;
  
  IF v_history IS NOT NULL AND jsonb_array_length(v_history) > 0 THEN
    -- Get last entry
    v_last_entry := v_history->-1;
    
    -- Update result if NULL
    IF v_last_entry->>'result' IS NULL THEN
      v_last_entry := jsonb_set(v_last_entry, '{result}', to_jsonb('replied'::text));
      v_last_entry := jsonb_set(v_last_entry, '{replied_at}', to_jsonb(NOW()));
      
      -- Replace last entry with updated version
      v_history := v_history - (jsonb_array_length(v_history) - 1);
      v_history := v_history || v_last_entry;
      
      UPDATE leads SET campaign_history = v_history WHERE id = p_lead_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'reply_logged', true);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION log_lead_reply TO anon, authenticated, service_role;

-- ================================================================
-- PART 6: Example Queries for Re-Engagement (Reference)
-- ================================================================

-- These are example queries you'll use in future re-engagement workflows

-- Query 1: Find leads ready for 3-month re-engagement
/*
SELECT * FROM vw_reengagement_3month
ORDER BY first_campaign_date ASC
LIMIT 100;
*/

-- Query 2: Check what archetype a lead originally received
/*
SELECT 
  id,
  first_name,
  last_name,
  first_campaign_date,
  campaign_count,
  campaign_history->0->>'archetype' AS original_archetype,
  campaign_history->0->>'added_at' AS original_date
FROM leads
WHERE first_campaign_date IS NOT NULL
ORDER BY first_campaign_date DESC;
*/

-- Query 3: Find high-equity leads that never replied (for special re-engagement)
/*
SELECT * FROM leads
WHERE 
  estimated_equity > 500000
  AND first_campaign_date IS NOT NULL
  AND last_reply_date IS NULL
  AND AGE(NOW(), first_campaign_date) > INTERVAL '3 months'
  AND status NOT IN ('unsubscribed', 'not_interested')
ORDER BY estimated_equity DESC;
*/

-- ================================================================
-- PART 7: Migration Verification Queries
-- ================================================================

-- Check that columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'leads' 
  AND column_name IN (
    'first_campaign_date', 
    'last_campaign_date', 
    'campaign_count',
    'last_reply_date',
    'last_interaction_date'
  );

-- Check that indexes were created
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'leads' 
  AND indexname LIKE 'idx_leads_%campaign%';

-- Check that views were created
SELECT 
  viewname
FROM pg_views
WHERE viewname LIKE 'vw_%engagement%'
  OR viewname = 'vw_campaign_ready_leads';

-- Check that functions were created
SELECT 
  routine_name, 
  routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'add_to_campaign_history',
  'log_lead_reply'
);

-- ================================================================
-- PART 8: Backfill Existing Data (If Needed)
-- ================================================================

-- If you have existing leads with campaign_history but no first_campaign_date,
-- run this to backfill:

/*
UPDATE leads
SET 
  first_campaign_date = (campaign_history->0->>'added_at')::timestamp,
  last_campaign_date = (campaign_history->-1->>'added_at')::timestamp,
  campaign_count = jsonb_array_length(campaign_history)
WHERE 
  campaign_history IS NOT NULL 
  AND jsonb_array_length(campaign_history) > 0
  AND first_campaign_date IS NULL;
*/

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================

-- Verify everything worked
DO $$
BEGIN
  RAISE NOTICE '✅ Campaign tracking migration complete!';
  RAISE NOTICE '📊 Added tracking fields: first_campaign_date, last_campaign_date, campaign_count';
  RAISE NOTICE '🔄 Updated add_to_campaign_history RPC function';
  RAISE NOTICE '👁️ Created vw_campaign_ready_leads (fresh leads only)';
  RAISE NOTICE '📅 Created re-engagement views (3/6/9 months)';
  RAISE NOTICE '📝 Created log_lead_reply helper function';
END $$;

