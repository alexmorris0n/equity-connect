-- =====================================================
-- SETUP DAN THOMAS - BROKER CONFIGURATION
-- =====================================================
-- Created: October 19, 2025
-- Broker: Dan Thomas
-- NMLS: 362053
-- Daily Capacity: 5 leads (testing)
-- =====================================================

-- =====================================================
-- STEP 1: ADD BROKER RECORD
-- =====================================================

-- First, check if daily_capacity column exists (if not, we'll add it)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'brokers' AND column_name = 'daily_capacity'
  ) THEN
    ALTER TABLE brokers ADD COLUMN daily_capacity INT DEFAULT 5;
    RAISE NOTICE 'Added daily_capacity column to brokers table';
  END IF;
END $$;

-- Add daily_lead_surplus column if it doesn't exist (used by DailyLeadPullPrompt)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'brokers' AND column_name = 'daily_lead_surplus'
  ) THEN
    ALTER TABLE brokers ADD COLUMN daily_lead_surplus INT DEFAULT 0;
    RAISE NOTICE 'Added daily_lead_surplus column to brokers table';
  END IF;
END $$;

-- Add current_offset column if it doesn't exist (for PropertyRadar pagination)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'brokers' AND column_name = 'current_offset'
  ) THEN
    ALTER TABLE brokers ADD COLUMN current_offset INT DEFAULT 0;
    RAISE NOTICE 'Added current_offset column to brokers table';
  END IF;
END $$;

-- Add list_id column if it doesn't exist (PropertyRadar list ID)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'brokers' AND column_name = 'list_id'
  ) THEN
    ALTER TABLE brokers ADD COLUMN list_id TEXT;
    RAISE NOTICE 'Added list_id column to brokers table';
  END IF;
END $$;

-- Insert Dan Thomas broker record
INSERT INTO brokers (
  company_name,
  contact_name,
  email,
  phone,
  nmls_number,
  license_states,
  pricing_model,
  status,
  daily_capacity,
  daily_lead_surplus,
  max_leads_per_week,
  current_offset,
  list_id,
  performance_score,
  sms_notifications
) VALUES (
  'About Reverse Mortgage',           -- company_name
  'Dan Thomas',                        -- contact_name (also known as Daniel Thomas)
  'info@aboutreversemortgage.com',    -- email
  '(650) 292-5744',                   -- phone (primary)
  '362053',                            -- nmls_number
  'CA',                                -- license_states (California - update as needed)
  'performanceBased',                  -- pricing_model (default)
  'active',                            -- status
  5,                                   -- daily_capacity (5 leads per day for testing)
  0,                                   -- daily_lead_surplus (starts at 0)
  35,                                  -- max_leads_per_week (5/day * 7 days)
  0,                                   -- current_offset (starts at 0)
  NULL,                                -- list_id (to be set when PropertyRadar list is created)
  100,                                 -- performance_score (starts at 100)
  true                                 -- sms_notifications
)
RETURNING 
  id AS broker_id,
  company_name,
  contact_name,
  nmls_number,
  email,
  phone,
  daily_capacity;

-- =====================================================
-- STEP 2: VERIFY INSERTION
-- =====================================================

SELECT 
  id,
  company_name,
  contact_name,
  nmls_number,
  email,
  phone,
  daily_capacity,
  status,
  created_at
FROM brokers
WHERE nmls_number = '362053';

-- =====================================================
-- NOTES FOR NEXT STEPS
-- =====================================================

/*
BROKER CREATED: Dan Thomas (NMLS #362053)
-------------------------------------------

📋 COPY THE BROKER ID FROM THE RESULT ABOVE

Next Steps:
-----------

1. CREATE PROPERTYRADAR LIST
   - Log into PropertyRadar
   - Create a new list for Dan Thomas's territory
   - Copy the list_id from the URL

2. UPDATE BROKER WITH LIST_ID
   Run this command with the actual list_id:
   
   UPDATE brokers 
   SET list_id = 'YOUR_LIST_ID_HERE'
   WHERE nmls_number = '362053';

3. ADD TERRITORY ZIP CODES
   Use the template: scripts/add-dan-thomas-territories.sql
   (Created alongside this file)

4. CREATE CAMPAIGNS IN INSTANTLY
   Dan will need 3 campaigns created:
   - cash_unlocked (for debt-free homeowners)
   - high_equity_special (for 75%+ equity)
   - no_more_payments (for active mortgage, lower equity)

5. UPDATE CAMPAIGNS TABLE
   After creating Instantly campaigns, run:
   
   INSERT INTO campaigns (archetype, instantly_campaign_id, broker_id, active)
   VALUES 
     ('cash_unlocked', 'INSTANTLY_CAMPAIGN_ID_1', 'DAN_BROKER_ID', true),
     ('high_equity_special', 'INSTANTLY_CAMPAIGN_ID_2', 'DAN_BROKER_ID', true),
     ('no_more_payments', 'INSTANTLY_CAMPAIGN_ID_3', 'DAN_BROKER_ID', true);

6. TEST DAILY LEAD PULL
   Run the DailyLeadPullPrompt workflow with Dan's broker_id

📞 SECONDARY PHONE: (888) 878-0441
   (Add to broker notes or create separate contact field if needed)

*/

-- =====================================================
-- OPTIONAL: Add secondary phone to notes
-- =====================================================

UPDATE brokers
SET notes = 'Secondary Phone: (888) 878-0441'
WHERE nmls_number = '362053';

