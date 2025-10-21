-- Setup Test Broker for Nylas Testing
-- Replace the grant_id with the one from your Nylas dashboard

-- Option 1: Update Dan Thomas
UPDATE brokers
SET 
  nylas_grant_id = 'YOUR_GRANT_ID_HERE',  -- Replace with actual grant_id from Nylas
  calendar_provider = 'google',           -- or 'microsoft', 'icloud' 
  calendar_synced_at = NOW(),
  email = 'your_test_email@gmail.com'    -- Email of the connected calendar
WHERE contact_name = 'Dan Thomas';

-- Verify it worked
SELECT 
  contact_name,
  nylas_grant_id,
  calendar_provider,
  email,
  calendar_synced_at
FROM brokers
WHERE contact_name = 'Dan Thomas';

