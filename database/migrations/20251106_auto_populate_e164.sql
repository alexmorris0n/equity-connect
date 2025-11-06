-- Migration: Auto-populate primary_phone_e164 from primary_phone
-- Date: 2025-11-06
-- Purpose: 
--   1. Create trigger to automatically set primary_phone_e164 when primary_phone is set/updated
--   2. Backfill existing leads with E.164 format phone numbers
--   3. Ensure phone number normalization is applied consistently

-- ============================================================================
-- STEP 1: Create trigger function to auto-populate E.164 format
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_populate_phone_e164()
RETURNS TRIGGER AS $$
BEGIN
  -- If primary_phone is being set or changed
  IF NEW.primary_phone IS NOT NULL AND NEW.primary_phone != '' THEN
    -- First normalize the phone to 10 digits using existing function
    NEW.primary_phone := normalize_phone_number(NEW.primary_phone);
    
    -- Then set E.164 format (+1 prefix for US numbers)
    IF NEW.primary_phone IS NOT NULL THEN
      NEW.primary_phone_e164 := '+1' || NEW.primary_phone;
    ELSE
      NEW.primary_phone_e164 := NULL;
    END IF;
  ELSE
    -- If primary_phone is NULL or empty, clear E.164 too
    NEW.primary_phone_e164 := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Create trigger on leads table
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_auto_populate_phone_e164 ON leads;

CREATE TRIGGER trigger_auto_populate_phone_e164
  BEFORE INSERT OR UPDATE OF primary_phone
  ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_phone_e164();

-- ============================================================================
-- STEP 3: Backfill existing leads with E.164 phone numbers
-- ============================================================================

-- Update all leads that have primary_phone but no primary_phone_e164
UPDATE leads
SET 
  primary_phone = normalize_phone_number(primary_phone),
  primary_phone_e164 = '+1' || normalize_phone_number(primary_phone)
WHERE 
  primary_phone IS NOT NULL 
  AND primary_phone != ''
  AND normalize_phone_number(primary_phone) IS NOT NULL
  AND primary_phone_e164 IS NULL;

-- ============================================================================
-- STEP 4: Verify the migration
-- ============================================================================

-- Show summary of phone number population
DO $$
DECLARE
  total_leads INTEGER;
  has_phone INTEGER;
  has_e164 INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_leads FROM leads;
  SELECT COUNT(*) INTO has_phone FROM leads WHERE primary_phone IS NOT NULL;
  SELECT COUNT(*) INTO has_e164 FROM leads WHERE primary_phone_e164 IS NOT NULL;
  
  RAISE NOTICE '=== Phone Number Migration Summary ===';
  RAISE NOTICE 'Total leads: %', total_leads;
  RAISE NOTICE 'Leads with primary_phone: %', has_phone;
  RAISE NOTICE 'Leads with primary_phone_e164: %', has_e164;
  RAISE NOTICE 'Migration complete!';
END $$;

