-- ==========================================
-- BROKER TERRITORY SETUP TEMPLATE
-- ==========================================
-- Use this template to add new brokers and their territories
-- Replace placeholders with actual values

-- STEP 1: Insert the broker
-- ==========================================
INSERT INTO brokers (
  company_name,
  contact_name,
  email,
  phone,
  nmls_number,
  license_states,
  pricing_model,
  status
)
VALUES (
  'BROKER_COMPANY_NAME',     -- e.g., 'Hollywood Home Loans'
  'CONTACT_PERSON_NAME',      -- e.g., 'Sarah Johnson'
  'EMAIL@EXAMPLE.COM',        -- e.g., 'sarah@hollywoodloans.com'
  '(555) 123-4567',           -- Phone number
  'NMLS123456',               -- NMLS license number
  'CA',                       -- License states (comma-separated)
  'performanceBased',         -- Options: performanceBased, flatFee
  'active'                    -- Options: active, inactive, suspended
)
RETURNING id, company_name;

-- Copy the ID from the result above and use it in STEP 2


-- STEP 2: Insert territory zip codes
-- ==========================================
-- Replace 'BROKER_ID_FROM_STEP_1' with the UUID returned above
-- Add/remove rows as needed for your broker's territory

INSERT INTO broker_territories (broker_id, market_name, zip_code, neighborhood_name, priority, active)
VALUES
  -- Example: Hollywood Market
  ('BROKER_ID_FROM_STEP_1', 'hollywood', '90028', 'Hollywood', 1, true),
  ('BROKER_ID_FROM_STEP_1', 'hollywood', '90038', 'Hollywood Hills', 1, true),
  ('BROKER_ID_FROM_STEP_1', 'hollywood', '90046', 'West Hollywood', 1, true),
  
  -- Example: Beverly Hills Market  
  ('BROKER_ID_FROM_STEP_1', 'beverly-hills', '90210', 'Beverly Hills', 1, true),
  ('BROKER_ID_FROM_STEP_1', 'beverly-hills', '90211', 'Beverly Hills', 1, true),
  
  -- Add more zip codes as needed...
  ('BROKER_ID_FROM_STEP_1', 'market-name', 'ZIP', 'Neighborhood', 1, true);


-- STEP 3: Verify the setup
-- ==========================================
SELECT 
  b.company_name,
  b.contact_name,
  b.status,
  bt.market_name,
  COUNT(DISTINCT bt.zip_code) as zip_count,
  array_agg(DISTINCT bt.zip_code ORDER BY bt.zip_code) as zip_codes
FROM brokers b
JOIN broker_territories bt ON bt.broker_id = b.id
WHERE b.company_name = 'BROKER_COMPANY_NAME'  -- Replace with actual name
GROUP BY b.company_name, b.contact_name, b.status, bt.market_name;


-- ==========================================
-- QUICK EXAMPLES
-- ==========================================

-- Example 1: Add broker with single market
/*
INSERT INTO brokers (company_name, contact_name, email, status)
VALUES ('Westside Lending', 'Mike Chen', 'mike@westside.com', 'active')
RETURNING id;

-- Let's say the returned id is: 'abc-123-def-456'

INSERT INTO broker_territories (broker_id, market_name, zip_code, neighborhood_name)
VALUES
  ('abc-123-def-456', 'santa-monica', '90401', 'Santa Monica'),
  ('abc-123-def-456', 'santa-monica', '90402', 'Santa Monica'),
  ('abc-123-def-456', 'santa-monica', '90403', 'Santa Monica'),
  ('abc-123-def-456', 'santa-monica', '90404', 'Santa Monica'),
  ('abc-123-def-456', 'venice', '90291', 'Venice'),
  ('abc-123-def-456', 'venice', '90292', 'Venice');
*/


-- Example 2: Import from CSV file
/*
-- First create a temp table from your CSV
CREATE TEMP TABLE temp_zips (
  neighborhood TEXT,
  zip_code TEXT
);

-- Then import (use Supabase dashboard or COPY command)
-- Finally insert into broker_territories:
INSERT INTO broker_territories (broker_id, market_name, zip_code, neighborhood_name)
SELECT 
  'BROKER_ID_HERE',
  'market-name',
  zip_code,
  neighborhood
FROM temp_zips;
*/


-- Example 3: Bulk add zip codes for multiple markets
/*
WITH zip_data AS (
  SELECT * FROM (VALUES
    ('market1', '90001', 'Neighborhood A'),
    ('market1', '90002', 'Neighborhood B'),
    ('market2', '91001', 'Neighborhood C'),
    ('market2', '91002', 'Neighborhood D')
  ) AS t(market, zip, neighborhood)
)
INSERT INTO broker_territories (broker_id, market_name, zip_code, neighborhood_name)
SELECT 
  'BROKER_ID_HERE',
  market,
  zip,
  neighborhood
FROM zip_data;
*/


-- ==========================================
-- USEFUL MANAGEMENT QUERIES
-- ==========================================

-- View all territories by broker
SELECT 
  b.company_name,
  bt.market_name,
  COUNT(*) as zip_count,
  string_agg(bt.zip_code, ', ' ORDER BY bt.zip_code) as zips
FROM brokers b
JOIN broker_territories bt ON bt.broker_id = b.id
WHERE bt.active = true
GROUP BY b.company_name, bt.market_name
ORDER BY b.company_name, bt.market_name;


-- Find overlapping territories (same zip for multiple brokers)
SELECT 
  bt.zip_code,
  bt.neighborhood_name,
  COUNT(DISTINCT bt.broker_id) as broker_count,
  array_agg(b.company_name) as brokers
FROM broker_territories bt
JOIN brokers b ON b.id = bt.broker_id
WHERE bt.active = true
GROUP BY bt.zip_code, bt.neighborhood_name
HAVING COUNT(DISTINCT bt.broker_id) > 1
ORDER BY broker_count DESC;


-- Deactivate a broker's territory (without deleting)
UPDATE broker_territories
SET active = false, updated_at = NOW()
WHERE broker_id = 'BROKER_ID_HERE'
  AND market_name = 'MARKET_NAME';


-- Reactivate a territory
UPDATE broker_territories
SET active = true, updated_at = NOW()
WHERE broker_id = 'BROKER_ID_HERE'
  AND market_name = 'MARKET_NAME';


-- Transfer territory from one broker to another
UPDATE broker_territories
SET broker_id = 'NEW_BROKER_ID', updated_at = NOW()
WHERE broker_id = 'OLD_BROKER_ID'
  AND market_name = 'MARKET_NAME';


-- Delete a broker and all their territories (CASCADE)
DELETE FROM brokers WHERE id = 'BROKER_ID_HERE';
-- This will automatically delete all broker_territories records

