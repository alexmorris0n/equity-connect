-- BatchData Deduplication Migration
-- Adds triple-key deduplication and cursor tracking for BatchData MCP integration
-- Created: 2025-10-07

-- ================================================
-- STEP 1: Add BatchData dedup fields to leads table
-- ================================================

-- Add BatchData-specific fields
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS mak TEXT,
  ADD COLUMN IF NOT EXISTS apn TEXT,
  ADD COLUMN IF NOT EXISTS addr_hash TEXT,
  ADD COLUMN IF NOT EXISTS batchdata_payload JSONB,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Add comment documentation
COMMENT ON COLUMN leads.mak IS 'BatchData Master Address Key - primary dedup identifier';
COMMENT ON COLUMN leads.apn IS 'County Assessor Parcel Number - secondary dedup identifier';
COMMENT ON COLUMN leads.addr_hash IS 'SHA256(lower(address+city+state+zip)) - fallback dedup identifier';
COMMENT ON COLUMN leads.batchdata_payload IS 'Full raw BatchData JSON payload for auditing and future enrichment';
COMMENT ON COLUMN leads.last_seen_at IS 'Last time this property was seen in BatchData pull (for change detection)';

-- ================================================
-- STEP 2: Create unique constraint for deduplication
-- ================================================

-- Triple-key unique constraint using COALESCE to handle nulls
-- This ensures idempotent inserts with ON CONFLICT DO NOTHING
ALTER TABLE leads
  ADD CONSTRAINT IF NOT EXISTS leads_batchdata_dedupe_unique
  UNIQUE NULLS NOT DISTINCT (mak, apn, addr_hash);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_mak ON leads(mak) WHERE mak IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_apn ON leads(apn) WHERE apn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_addr_hash ON leads(addr_hash) WHERE addr_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_last_seen_at ON leads(last_seen_at) WHERE last_seen_at IS NOT NULL;

-- ================================================
-- STEP 3: Create cursor tracking table
-- ================================================

CREATE TABLE IF NOT EXISTS batchdata_cursor_state (
  zip TEXT PRIMARY KEY,
  broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE,
  last_page INT DEFAULT 0,
  last_mak TEXT,
  total_pulled INT DEFAULT 0,
  new_records_count INT DEFAULT 0,
  duplicate_count INT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  last_run_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE batchdata_cursor_state IS 'Tracks BatchData pull progress per ZIP code to enable incremental, resumable pulls';
COMMENT ON COLUMN batchdata_cursor_state.zip IS 'ZIP code being tracked';
COMMENT ON COLUMN batchdata_cursor_state.broker_id IS 'Broker assigned to this ZIP territory';
COMMENT ON COLUMN batchdata_cursor_state.last_page IS 'Last page number successfully processed';
COMMENT ON COLUMN batchdata_cursor_state.last_mak IS 'Last MAK (Master Address Key) processed for resume capability';
COMMENT ON COLUMN batchdata_cursor_state.total_pulled IS 'Total records pulled from BatchData for this ZIP';
COMMENT ON COLUMN batchdata_cursor_state.new_records_count IS 'Count of new (non-duplicate) records inserted';
COMMENT ON COLUMN batchdata_cursor_state.duplicate_count IS 'Count of duplicate records skipped';
COMMENT ON COLUMN batchdata_cursor_state.completed IS 'Whether this ZIP has been exhausted (no more records available)';
COMMENT ON COLUMN batchdata_cursor_state.last_run_at IS 'Timestamp of last pull attempt';

-- Create indexes for cursor state queries
CREATE INDEX IF NOT EXISTS idx_batchdata_cursor_broker ON batchdata_cursor_state(broker_id);
CREATE INDEX IF NOT EXISTS idx_batchdata_cursor_completed ON batchdata_cursor_state(completed) WHERE completed = FALSE;
CREATE INDEX IF NOT EXISTS idx_batchdata_cursor_last_run ON batchdata_cursor_state(last_run_at);

-- ================================================
-- STEP 4: Create helper function for idempotent inserts
-- ================================================

CREATE OR REPLACE FUNCTION insert_lead_with_batchdata_dedupe(
  p_mak TEXT,
  p_apn TEXT,
  p_addr_hash TEXT,
  p_payload JSONB,
  p_broker_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'BatchData'
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_lead_id UUID;
BEGIN
  -- Attempt insert with ON CONFLICT DO NOTHING
  INSERT INTO leads (
    mak,
    apn, 
    addr_hash,
    batchdata_payload,
    assigned_broker_id,
    source,
    first_name,
    last_name,
    email,
    phone,
    property_address,
    property_city,
    property_state,
    property_zip,
    property_value,
    estimated_equity,
    age,
    owner_occupied,
    status,
    last_seen_at,
    created_at
  )
  VALUES (
    p_mak,
    p_apn,
    p_addr_hash,
    p_payload,
    p_broker_id,
    p_source,
    p_payload->>'first_name',
    p_payload->>'last_name',
    p_payload->>'email',
    p_payload->>'phone',
    p_payload->>'address_line_1',
    p_payload->>'city',
    p_payload->>'state',
    p_payload->>'zip',
    (p_payload->>'property_value')::NUMERIC,
    (p_payload->>'estimated_equity')::NUMERIC,
    (p_payload->>'age')::INTEGER,
    (p_payload->>'owner_occupied')::BOOLEAN,
    'new',
    NOW(),
    NOW()
  )
  ON CONFLICT (mak, apn, addr_hash) DO UPDATE
    SET last_seen_at = NOW(),
        batchdata_payload = p_payload
  RETURNING id INTO v_lead_id;
  
  RETURN v_lead_id;
END;
$$;

COMMENT ON FUNCTION insert_lead_with_batchdata_dedupe IS 'Idempotent lead insertion with BatchData deduplication. Returns lead ID if inserted, NULL if duplicate.';

-- ================================================
-- STEP 5: Create helper function to update cursor state
-- ================================================

CREATE OR REPLACE FUNCTION update_batchdata_cursor(
  p_zip TEXT,
  p_broker_id UUID,
  p_page INT,
  p_last_mak TEXT,
  p_new_records INT,
  p_duplicates INT,
  p_completed BOOLEAN DEFAULT FALSE
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO batchdata_cursor_state (
    zip,
    broker_id,
    last_page,
    last_mak,
    total_pulled,
    new_records_count,
    duplicate_count,
    completed,
    last_run_at,
    updated_at
  )
  VALUES (
    p_zip,
    p_broker_id,
    p_page,
    p_last_mak,
    p_new_records + p_duplicates,
    p_new_records,
    p_duplicates,
    p_completed,
    NOW(),
    NOW()
  )
  ON CONFLICT (zip) DO UPDATE
    SET last_page = EXCLUDED.last_page,
        last_mak = EXCLUDED.last_mak,
        total_pulled = batchdata_cursor_state.total_pulled + (p_new_records + p_duplicates),
        new_records_count = batchdata_cursor_state.new_records_count + p_new_records,
        duplicate_count = batchdata_cursor_state.duplicate_count + p_duplicates,
        completed = EXCLUDED.completed,
        last_run_at = NOW(),
        updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION update_batchdata_cursor IS 'Updates cursor state after each BatchData pull batch';

-- ================================================
-- STEP 6: Create view for monitoring dedup stats
-- ================================================

CREATE OR REPLACE VIEW batchdata_dedup_stats AS
SELECT 
  bc.zip,
  bc.broker_id,
  b.company_name,
  bc.total_pulled,
  bc.new_records_count,
  bc.duplicate_count,
  ROUND(100.0 * bc.duplicate_count / NULLIF(bc.total_pulled, 0), 2) AS dedup_rate_pct,
  bc.completed,
  bc.last_run_at,
  COUNT(l.id) AS total_leads_in_zip
FROM batchdata_cursor_state bc
LEFT JOIN brokers b ON bc.broker_id = b.id
LEFT JOIN leads l ON l.property_zip = bc.zip AND l.source = 'BatchData'
GROUP BY bc.zip, bc.broker_id, b.company_name, bc.total_pulled, 
         bc.new_records_count, bc.duplicate_count, bc.completed, bc.last_run_at
ORDER BY bc.last_run_at DESC;

COMMENT ON VIEW batchdata_dedup_stats IS 'Monitoring dashboard for BatchData deduplication performance per ZIP';

-- ================================================
-- STEP 7: Create materialized view for daily new leads
-- ================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_new_leads_daily AS
SELECT 
  DATE(created_at) AS date,
  source,
  assigned_broker_id,
  COUNT(*) AS new_leads,
  COUNT(DISTINCT property_zip) AS unique_zips,
  COUNT(*) FILTER (WHERE mak IS NOT NULL) AS batchdata_leads,
  COUNT(*) FILTER (WHERE consent = TRUE) AS consented_leads
FROM leads
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(created_at), source, assigned_broker_id
ORDER BY date DESC;

CREATE INDEX IF NOT EXISTS idx_mv_new_leads_daily_date ON mv_new_leads_daily(date);
CREATE INDEX IF NOT EXISTS idx_mv_new_leads_daily_broker ON mv_new_leads_daily(assigned_broker_id);

COMMENT ON MATERIALIZED VIEW mv_new_leads_daily IS 'Daily rollup of new leads by source and broker for dashboarding';

-- ================================================
-- STEP 8: Create trigger for auto-enqueue to skip-trace
-- ================================================

CREATE TABLE IF NOT EXISTS skip_trace_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_skip_trace_queue_status ON skip_trace_queue(status, priority);
CREATE INDEX IF NOT EXISTS idx_skip_trace_queue_lead ON skip_trace_queue(lead_id);

COMMENT ON TABLE skip_trace_queue IS 'Queue for leads requiring skip-trace processing';

-- Trigger function to auto-enqueue new BatchData leads
CREATE OR REPLACE FUNCTION enqueue_new_lead_for_skip_trace()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only enqueue if from BatchData and has minimal contact info
  IF NEW.source = 'BatchData' AND NEW.mak IS NOT NULL THEN
    INSERT INTO skip_trace_queue (lead_id, priority)
    VALUES (NEW.id, 5)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_enqueue_lead_skip_trace
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_new_lead_for_skip_trace();

COMMENT ON TRIGGER trigger_enqueue_lead_skip_trace ON leads IS 'Automatically enqueues new BatchData leads for skip-trace processing';

-- ================================================
-- STEP 9: Grant permissions (adjust as needed)
-- ================================================

-- Grant read access to monitoring views
GRANT SELECT ON batchdata_dedup_stats TO authenticated;
GRANT SELECT ON mv_new_leads_daily TO authenticated;

-- Grant execute on helper functions (for n8n service role)
-- GRANT EXECUTE ON FUNCTION insert_lead_with_batchdata_dedupe TO service_role;
-- GRANT EXECUTE ON FUNCTION update_batchdata_cursor TO service_role;

-- ================================================
-- STEP 10: Refresh materialized view (schedule this daily)
-- ================================================

-- Run this command daily via cron or n8n workflow:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_new_leads_daily;

-- ================================================
-- VERIFICATION QUERIES
-- ================================================

-- Test the dedup constraint
-- INSERT INTO leads (mak, apn, addr_hash, source) VALUES ('MAK123', 'APN456', 'hash789', 'BatchData');
-- INSERT INTO leads (mak, apn, addr_hash, source) VALUES ('MAK123', 'APN456', 'hash789', 'BatchData'); -- Should be ignored

-- Check cursor state
-- SELECT * FROM batchdata_cursor_state ORDER BY last_run_at DESC;

-- View dedup stats
-- SELECT * FROM batchdata_dedup_stats;

-- Check skip-trace queue
-- SELECT * FROM skip_trace_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 10;

