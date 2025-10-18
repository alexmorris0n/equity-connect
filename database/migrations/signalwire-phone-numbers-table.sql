-- SignalWire Phone Numbers Table for VAPI Integration
-- This table stores all SignalWire phone numbers registered with VAPI
-- Used by n8n workflow for dynamic phone number pool management

CREATE TABLE IF NOT EXISTS signalwire_phone_numbers (
  id SERIAL PRIMARY KEY,
  vapi_phone_number_id VARCHAR(100) UNIQUE NOT NULL,
  number VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  territories TEXT[], -- Array of ZIP codes or regions for future enhancement
  status VARCHAR(20) DEFAULT 'active', -- active, inactive, maintenance
  assigned_broker_company VARCHAR(200), -- Broker company name (e.g., "My Reverse Options")
  
  -- POOL MANAGEMENT COLUMNS
  currently_assigned_to UUID REFERENCES leads(id) ON DELETE SET NULL, -- Which lead currently has this number
  assigned_at TIMESTAMP, -- When was this number assigned to current lead
  release_at TIMESTAMP, -- When should this number be released back to pool
  assignment_status VARCHAR(20) DEFAULT 'available', -- available, assigned, reserved
  last_call_outcome VARCHAR(50), -- booked, no_answer, busy, voicemail, cancelled
  appointment_scheduled_at TIMESTAMP, -- If booked, when is the appointment
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert all 5 SignalWire numbers for My Reverse Options
INSERT INTO signalwire_phone_numbers (vapi_phone_number_id, number, name, territories, assigned_broker_company, notes) VALUES
('45b2f2bb-5d0f-4c96-b43f-673584207d9d', '+14244851544', 'MyReverseOptions1', NULL, 'My Reverse Options', 'Pool number 1 for My Reverse Options'),
('9cc9e5da-5470-433f-b413-3ba887553c2c', '+14245502888', 'MyReverseOptions2', NULL, 'My Reverse Options', 'Pool number 2 for My Reverse Options'),
('70cbe9e3-4c9b-4492-959b-2a83589953c3', '+14245502229', 'MyReverseOptions3', NULL, 'My Reverse Options', 'Pool number 3 for My Reverse Options'),
('29686c26-e95c-4c0f-9814-6243b95f4075', '+14245502223', 'MyReverseOptions4', NULL, 'My Reverse Options', 'Pool number 4 for My Reverse Options'),
('7ed9bf10-9070-4560-bc8e-645dc911bd2b', '+14246724222', 'MyReverseOptions5', NULL, 'My Reverse Options', 'Pool number 5 for My Reverse Options')
ON CONFLICT (vapi_phone_number_id) DO UPDATE 
SET assigned_broker_company = EXCLUDED.assigned_broker_company;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_territories ON signalwire_phone_numbers USING GIN (territories);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_status ON signalwire_phone_numbers (status);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_assignment_status ON signalwire_phone_numbers (assignment_status);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_assigned_to ON signalwire_phone_numbers (currently_assigned_to);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_release_at ON signalwire_phone_numbers (release_at);

-- CRITICAL: Composite index for high-performance pool queries at scale (100+ brokers)
-- Optimizes: WHERE broker_company + assignment_status + ORDER BY assigned_at
CREATE INDEX IF NOT EXISTS idx_signalwire_pool_assignment 
ON signalwire_phone_numbers (assigned_broker_company, assignment_status, assigned_at) 
WHERE status = 'active';

-- Function to auto-release expired numbers back to pool
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
    AND release_at <= NOW();
  
  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count;
END;
$$ LANGUAGE plpgsql;

-- You can schedule this function to run periodically via pg_cron or call it from n8n
-- SELECT release_expired_phone_numbers();

-- Add RLS (Row Level Security) if needed
-- ALTER TABLE signalwire_phone_numbers ENABLE ROW LEVEL SECURITY;
