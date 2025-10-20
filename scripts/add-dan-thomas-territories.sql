-- =====================================================
-- DAN THOMAS - TERRITORY ASSIGNMENT TEMPLATE
-- =====================================================
-- Broker: Dan Thomas (NMLS #362053)
-- Usage: Fill in the broker_id and zip codes below
-- =====================================================

-- =====================================================
-- STEP 1: GET DAN'S BROKER ID (if you don't have it)
-- =====================================================

SELECT id, company_name, contact_name, nmls_number
FROM brokers
WHERE nmls_number = '362053';

-- Copy the 'id' from the result above and use it below

-- =====================================================
-- STEP 2: INSERT TERRITORY ZIP CODES
-- =====================================================

-- Replace 'PASTE_DAN_BROKER_ID_HERE' with Dan's actual broker UUID

/*
INSERT INTO broker_territories (broker_id, market_name, zip_code, neighborhood_name, priority, active)
VALUES
  -- Example territories (REPLACE WITH ACTUAL ZIP CODES)
  ('PASTE_DAN_BROKER_ID_HERE', 'dan-thomas-market-1', '94002', 'Belmont', 1, true),
  ('PASTE_DAN_BROKER_ID_HERE', 'dan-thomas-market-1', '94010', 'Burlingame', 1, true),
  ('PASTE_DAN_BROKER_ID_HERE', 'dan-thomas-market-1', '94025', 'Menlo Park', 1, true),
  ('PASTE_DAN_BROKER_ID_HERE', 'dan-thomas-market-1', '94301', 'Palo Alto', 1, true),
  ('PASTE_DAN_BROKER_ID_HERE', 'dan-thomas-market-1', '94401', 'San Mateo', 1, true);
  -- Add more zip codes as needed
*/

-- =====================================================
-- STEP 3: VERIFY TERRITORIES
-- =====================================================

/*
SELECT 
  b.company_name,
  bt.market_name,
  COUNT(DISTINCT bt.zip_code) as zip_count,
  array_agg(bt.zip_code ORDER BY bt.zip_code) as zip_codes
FROM broker_territories bt
JOIN brokers b ON bt.broker_id = b.id
WHERE b.nmls_number = '362053'
  AND bt.active = true
GROUP BY b.company_name, bt.market_name;
*/

-- =====================================================
-- TERRITORY PLANNING GUIDE
-- =====================================================

/*
Dan Thomas operates in the Bay Area (650 area code suggests Peninsula/South Bay)

Suggested Markets to Consider:
-------------------------------

1. PENINSULA MARKET
   - San Mateo County
   - Zip codes: 94002, 94010, 94011, 94014, 94015, 94030, 94066, 94401, 94402, 94403, 94404

2. SOUTH BAY MARKET
   - Santa Clara County (parts)
   - Zip codes: 94022, 94024, 94025, 94301, 94303, 94304, 94305, 94306

3. EAST BAY MARKET (if licensed)
   - Alameda County (select areas)
   - To be determined based on license coverage

Priority Levels:
----------------
1 = Primary market (highest priority)
2 = Secondary market (overflow)
3 = Expansion market (future growth)

How to Choose Zip Codes:
------------------------
1. Check Dan's current operating area
2. Verify license coverage in those counties
3. Look for areas with:
   - High home values ($500K+)
   - Older homeowners (62+)
   - High equity rates
   - Good reverse mortgage awareness

Next Steps:
-----------
1. Consult with Dan on his preferred territory
2. Get list of specific zip codes he wants to cover
3. Update the INSERT statement above with actual zip codes
4. Run the script to load territories
5. Verify with the SELECT query
*/

-- =====================================================
-- QUICK REFERENCE: Common Bay Area Zip Codes
-- =====================================================

/*
SAN MATEO COUNTY (Peninsula):
94002 - Belmont
94010 - Burlingame
94030 - Millbrae
94044 - Pacifica
94061 - Redwood City
94062 - Redwood City
94063 - Redwood City
94065 - Redwood Shores
94066 - San Bruno
94070 - San Carlos
94401 - San Mateo
94402 - San Mateo
94403 - San Mateo
94404 - Foster City

SANTA CLARA COUNTY (South Bay):
94022 - Los Altos
94024 - Los Altos
94025 - Menlo Park
94040 - Mountain View
94041 - Mountain View
94301 - Palo Alto
94303 - Palo Alto
94304 - Palo Alto
95014 - Cupertino
95070 - Saratoga
95120 - San Jose (South)
95123 - San Jose (South)

Add zip codes based on Dan's actual operating territory.
*/

