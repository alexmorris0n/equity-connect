-- Migration: Phone Number Normalization
-- Purpose: Ensures all phone numbers are stored as clean 10-digit strings
-- Handles formats: (650) 530-0051, 650-530-0051, 650.530.0051, +16505300051, etc.

-- Create phone normalization function
CREATE OR REPLACE FUNCTION normalize_phone_number(phone_input TEXT)
RETURNS TEXT AS $$
DECLARE
  cleaned TEXT;
BEGIN
  -- Return NULL if input is NULL or empty
  IF phone_input IS NULL OR trim(phone_input) = '' THEN
    RETURN NULL;
  END IF;
  
  -- Remove all non-digit characters
  cleaned := regexp_replace(phone_input, '[^0-9]', '', 'g');
  
  -- Handle different lengths:
  -- 11 digits starting with 1 (US country code) -> remove leading 1
  IF length(cleaned) = 11 AND left(cleaned, 1) = '1' THEN
    cleaned := substring(cleaned from 2);
  END IF;
  
  -- Must be exactly 10 digits after normalization
  IF length(cleaned) = 10 THEN
    RETURN cleaned;
  END IF;
  
  -- If not 10 digits, return NULL (invalid phone number)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment
COMMENT ON FUNCTION normalize_phone_number(TEXT) IS 'Normalizes phone numbers to 10-digit format. Handles various formats: (650) 530-0051, 650-530-0051, +1-650-530-0051, etc.';

-- Example usage:
-- SELECT normalize_phone_number('(650) 530-0051');  -> '6505300051'
-- SELECT normalize_phone_number('650-530-0051');    -> '6505300051'
-- SELECT normalize_phone_number('+1-650-530-0051'); -> '6505300051'
-- SELECT normalize_phone_number('6505300051');      -> '6505300051'
-- SELECT normalize_phone_number('+16505300051');    -> '6505300051'

-- Optional: Clean existing phone numbers in leads table
-- Uncomment the following if you want to normalize existing data:

-- UPDATE leads 
-- SET phone = normalize_phone_number(phone)
-- WHERE phone IS NOT NULL;

-- UPDATE brokers
-- SET phone = normalize_phone_number(phone)
-- WHERE phone IS NOT NULL;

-- Verification query: Check if any invalid phone numbers remain
SELECT 
  'leads' as table_name,
  COUNT(*) as total_with_phone,
  COUNT(*) FILTER (WHERE length(phone) != 10) as invalid_count,
  COUNT(*) FILTER (WHERE length(phone) = 10) as valid_count
FROM leads 
WHERE phone IS NOT NULL
UNION ALL
SELECT 
  'brokers' as table_name,
  COUNT(*) as total_with_phone,
  COUNT(*) FILTER (WHERE length(phone) != 10) as invalid_count,
  COUNT(*) FILTER (WHERE length(phone) = 10) as valid_count
FROM brokers
WHERE phone IS NOT NULL;

