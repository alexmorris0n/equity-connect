-- =====================================================
-- TRACKING NUMBER SYSTEM FOR BROKER BILLING PROTECTION
-- =====================================================
-- 
-- Purpose: Assign SignalWire numbers ONLY when appointments are booked
-- to track broker→lead calls and prevent billing fraud.
--
-- Created: 2025-10-20
-- =====================================================

-- Step 1: Create billing call logs table
CREATE TABLE IF NOT EXISTS billing_call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Call participants
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE,
  
  -- Call details
  tracking_number VARCHAR(20) NOT NULL,        -- SignalWire number used
  caller_number VARCHAR(20) NOT NULL,          -- Who called
  direction VARCHAR(20) NOT NULL,              -- 'broker_to_lead' or 'lead_to_broker'
  duration_seconds INTEGER,                    -- Call duration (billing proof!)
  call_sid VARCHAR(100),                       -- SignalWire CallSid
  call_status VARCHAR(20),                     -- completed, failed, busy, no-answer
  
  -- Attribution
  appointment_datetime TIMESTAMP,              -- When appointment was scheduled
  campaign_id VARCHAR(100),                    -- Which campaign generated this lead
  campaign_archetype VARCHAR(100),             -- Campaign type for reporting
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_billing_lead (lead_id, created_at DESC),
  INDEX idx_billing_broker (broker_id, created_at DESC),
  INDEX idx_billing_appointment (appointment_datetime),
  INDEX idx_billing_duration (duration_seconds) WHERE duration_seconds > 300  -- Billable calls only
);

-- Add comment
COMMENT ON TABLE billing_call_logs IS 'Tracks all calls on assigned tracking numbers for broker billing verification';

-- Step 2: Update signalwire_phone_numbers table
ALTER TABLE signalwire_phone_numbers 
ADD COLUMN IF NOT EXISTS assigned_broker_id UUID REFERENCES brokers(id);

COMMENT ON COLUMN signalwire_phone_numbers.currently_assigned_to IS 'Lead ID when number is assigned for appointment tracking';
COMMENT ON COLUMN signalwire_phone_numbers.assigned_broker_id IS 'Broker ID when number is assigned for appointment tracking';
COMMENT ON COLUMN signalwire_phone_numbers.assignment_status IS 'available | assigned_for_tracking';
COMMENT ON COLUMN signalwire_phone_numbers.release_at IS 'When to release number (midnight after appointment day)';

-- Step 3: Create assign_tracking_number function
CREATE OR REPLACE FUNCTION assign_tracking_number(
  p_lead_id UUID,
  p_broker_id UUID,
  p_signalwire_number VARCHAR(20),
  p_appointment_datetime TIMESTAMP
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_release_at TIMESTAMP;
BEGIN
  -- Calculate release time: midnight after appointment day
  v_release_at := (p_appointment_datetime::date + INTERVAL '1 day')::timestamp;
  
  -- Assign number to lead/broker pair
  UPDATE signalwire_phone_numbers
  SET 
    currently_assigned_to = p_lead_id,
    assigned_broker_id = p_broker_id,
    assigned_at = NOW(),
    release_at = v_release_at,
    assignment_status = 'assigned_for_tracking',
    appointment_scheduled_at = p_appointment_datetime
  WHERE number = p_signalwire_number
    AND status = 'active'
  RETURNING jsonb_build_object(
    'success', true,
    'number', number,
    'lead_id', currently_assigned_to,
    'broker_id', assigned_broker_id,
    'appointment_datetime', p_appointment_datetime,
    'release_at', release_at,
    'message', 'Tracking number assigned for appointment'
  ) INTO v_result;
  
  -- If no number found/updated, return error
  IF v_result IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'SignalWire number not found or already assigned'
    );
  END IF;
  
  -- Log assignment for audit trail
  INSERT INTO interactions (lead_id, broker_id, type, direction, content, metadata)
  VALUES (
    p_lead_id,
    p_broker_id,
    'tracking_number_assigned',
    'outbound',
    'Tracking number assigned for appointment',
    jsonb_build_object(
      'tracking_number', p_signalwire_number,
      'appointment_datetime', p_appointment_datetime,
      'release_at', v_release_at
    )
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION assign_tracking_number IS 'Assigns SignalWire tracking number to lead/broker pair after appointment is booked. Holds until midnight after appointment day for billing verification.';

-- Step 4: Create release function for nightly cron
CREATE OR REPLACE FUNCTION release_expired_tracking_numbers()
RETURNS JSON AS $$
DECLARE
  v_released_count INTEGER;
BEGIN
  -- Release numbers past their appointment day (midnight threshold)
  UPDATE signalwire_phone_numbers
  SET 
    currently_assigned_to = NULL,
    assigned_broker_id = NULL,
    assignment_status = 'available',
    release_at = NULL,
    appointment_scheduled_at = NULL,
    updated_at = NOW()
  WHERE assignment_status = 'assigned_for_tracking'
    AND release_at <= NOW();
  
  GET DIAGNOSTICS v_released_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'released_count', v_released_count,
    'timestamp', NOW(),
    'message', format('Released %s tracking numbers', v_released_count)
  );
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION release_expired_tracking_numbers IS 'Releases tracking numbers after appointment day ends (midnight). Run via nightly cron job.';

-- Step 5: Create helper function to get tracking number assignment
CREATE OR REPLACE FUNCTION get_tracking_number_assignment(
  p_number VARCHAR(20)
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT jsonb_build_object(
    'assigned', assignment_status = 'assigned_for_tracking',
    'number', number,
    'lead_id', currently_assigned_to,
    'broker_id', assigned_broker_id,
    'lead_phone', l.primary_phone,
    'broker_phone', b.phone,
    'appointment_datetime', appointment_scheduled_at,
    'release_at', release_at,
    'lead_name', l.first_name || ' ' || COALESCE(l.last_name, ''),
    'broker_name', b.contact_name,
    'campaign_id', l.campaign_id
  ) INTO v_result
  FROM signalwire_phone_numbers spn
  LEFT JOIN leads l ON spn.currently_assigned_to = l.id
  LEFT JOIN brokers b ON spn.assigned_broker_id = b.id
  WHERE spn.number = p_number;
  
  RETURN COALESCE(v_result, '{"assigned": false}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION get_tracking_number_assignment IS 'Returns full assignment details for a tracking number. Used by bridge to route calls.';

-- Step 6: Set up nightly cron job (if pg_cron extension available)
-- Note: Check if pg_cron is installed first with: SELECT * FROM pg_extension WHERE extname = 'pg_cron';
-- If not available, use n8n scheduled workflow instead.

DO $$
BEGIN
  -- Only create cron job if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove old job if exists
    PERFORM cron.unschedule('release-tracking-numbers');
    
    -- Schedule new job for midnight every night
    PERFORM cron.schedule(
      'release-tracking-numbers',
      '0 0 * * *',  -- Midnight daily
      $$SELECT release_expired_tracking_numbers()$$
    );
    
    RAISE NOTICE 'Cron job scheduled: release-tracking-numbers at midnight daily';
  ELSE
    RAISE NOTICE 'pg_cron extension not available - use n8n scheduled workflow instead';
  END IF;
END $$;

-- Step 7: Create billing analytics view
CREATE OR REPLACE VIEW v_billing_summary AS
SELECT 
  DATE(bcl.created_at) as call_date,
  b.company_name as broker_company,
  b.contact_name as broker_name,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE bcl.direction = 'broker_to_lead') as broker_outbound,
  COUNT(*) FILTER (WHERE bcl.direction = 'lead_to_broker') as lead_inbound,
  COUNT(*) FILTER (WHERE bcl.duration_seconds > 300) as billable_calls,
  SUM(bcl.duration_seconds) as total_duration_seconds,
  AVG(bcl.duration_seconds) FILTER (WHERE bcl.duration_seconds > 60) as avg_duration_seconds,
  COUNT(DISTINCT bcl.lead_id) as unique_leads,
  COUNT(DISTINCT bcl.campaign_id) as campaigns_count
FROM billing_call_logs bcl
JOIN brokers b ON bcl.broker_id = b.id
GROUP BY DATE(bcl.created_at), b.company_name, b.contact_name
ORDER BY call_date DESC, total_calls DESC;

-- Add comment
COMMENT ON VIEW v_billing_summary IS 'Daily billing summary by broker. Billable calls = duration > 5 minutes (300 seconds).';

-- Step 8: Grant permissions
GRANT EXECUTE ON FUNCTION assign_tracking_number TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION release_expired_tracking_numbers TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_tracking_number_assignment TO authenticated, service_role;
GRANT SELECT ON v_billing_summary TO authenticated, service_role;
GRANT ALL ON billing_call_logs TO authenticated, service_role;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify setup
DO $$
BEGIN
  RAISE NOTICE '✅ Tracking number system installed';
  RAISE NOTICE '✅ Functions created: assign_tracking_number, release_expired_tracking_numbers, get_tracking_number_assignment';
  RAISE NOTICE '✅ Table created: billing_call_logs';
  RAISE NOTICE '✅ View created: v_billing_summary';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Add assign_tracking_number to bridge/tools.js';
  RAISE NOTICE '2. Update Barbara prompt to call assign_tracking_number after booking';
  RAISE NOTICE '3. Update bridge call-status webhook to log to billing_call_logs';
  RAISE NOTICE '4. Set up n8n nightly cleanup workflow (if pg_cron not available)';
END $$;

