-- Migration: Update Phone Release Logic for Appointment Holds
-- Ensures phone numbers stay assigned until 24 hours AFTER appointment completes

-- Updated function with appointment-aware logic
CREATE OR REPLACE FUNCTION release_expired_phone_numbers()
RETURNS INTEGER AS $$
DECLARE
  released_count INTEGER;
BEGIN
  UPDATE signalwire_phone_numbers
  SET 
    currently_assigned_to = NULL,
    assigned_at = NULL,
    release_at = NULL,
    assignment_status = 'available',
    last_call_outcome = NULL,
    appointment_scheduled_at = NULL,
    updated_at = NOW()
  WHERE 
    assignment_status = 'assigned'
    AND release_at IS NOT NULL
    AND release_at <= NOW()
    -- CRITICAL: Don't release if appointment is scheduled in the future
    -- or if it completed less than 24 hours ago
    AND (
      appointment_scheduled_at IS NULL  -- No appointment scheduled
      OR 
      appointment_scheduled_at + INTERVAL '24 hours' <= NOW()  -- Appointment + grace period passed
    );
  
  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count;
END;
$$ LANGUAGE plpgsql;

-- Helper function to extend phone hold when appointment is booked
-- Barbara's VAPI prompt should call this when booking
CREATE OR REPLACE FUNCTION extend_phone_for_appointment(
  p_lead_id UUID,
  p_appointment_time TIMESTAMP
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE signalwire_phone_numbers
  SET 
    appointment_scheduled_at = p_appointment_time,
    -- Extend release to 24 hours AFTER appointment
    release_at = p_appointment_time + INTERVAL '24 hours',
    last_call_outcome = 'booked',
    assignment_status = 'assigned',
    updated_at = NOW()
  WHERE currently_assigned_to = p_lead_id
    AND status = 'active';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Helper function to mark appointment as completed (no-show, completed, etc.)
CREATE OR REPLACE FUNCTION complete_appointment_for_phone(
  p_lead_id UUID,
  p_outcome TEXT  -- 'showed', 'no_show', 'cancelled', 'rescheduled'
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE signalwire_phone_numbers
  SET 
    last_call_outcome = p_outcome,
    -- If showed or no-show, release 24 hours from now
    -- If cancelled/rescheduled, release immediately
    release_at = CASE 
      WHEN p_outcome IN ('showed', 'no_show') THEN NOW() + INTERVAL '24 hours'
      WHEN p_outcome IN ('cancelled', 'rescheduled') THEN NOW()
      ELSE release_at
    END,
    updated_at = NOW()
  WHERE currently_assigned_to = p_lead_id
    AND status = 'active';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Verification query: Check phones with appointments
-- SELECT 
--   number,
--   name,
--   currently_assigned_to,
--   appointment_scheduled_at,
--   release_at,
--   CASE 
--     WHEN appointment_scheduled_at IS NULL THEN 'No appointment'
--     WHEN appointment_scheduled_at > NOW() THEN 'Appointment pending'
--     WHEN appointment_scheduled_at + INTERVAL '24 hours' > NOW() THEN 'Appointment grace period'
--     ELSE 'Ready to release'
--   END as appointment_status
-- FROM signalwire_phone_numbers
-- WHERE currently_assigned_to IS NOT NULL
-- ORDER BY appointment_scheduled_at NULLS LAST;

