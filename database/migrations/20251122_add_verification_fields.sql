-- Migration: Add verification fields and auto-update trigger
-- Date: November 22, 2025
-- Purpose: Add address_verified and verified summary boolean fields

-- Add address_verified field to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS address_verified BOOLEAN DEFAULT false;

-- Add verified summary field (auto-computed from phone_verified, email_verified, address_verified)
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- Create function to update verified field
CREATE OR REPLACE FUNCTION update_lead_verified()
RETURNS TRIGGER AS $$
BEGIN
    -- Set verified = true only if ALL three verification fields are true
    NEW.verified := (
        COALESCE(NEW.phone_verified, false) = true AND
        COALESCE(NEW.email_verified, false) = true AND
        COALESCE(NEW.address_verified, false) = true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update verified field on INSERT or UPDATE
DROP TRIGGER IF EXISTS trigger_update_lead_verified ON leads;
CREATE TRIGGER trigger_update_lead_verified
    BEFORE INSERT OR UPDATE OF phone_verified, email_verified, address_verified
    ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_verified();

-- Backfill existing leads: set address_verified = true if property_address is populated
UPDATE leads
SET address_verified = true
WHERE property_address IS NOT NULL 
  AND property_address != '';

-- Recompute verified for all existing leads
UPDATE leads
SET verified = (
    COALESCE(phone_verified, false) = true AND
    COALESCE(email_verified, false) = true AND
    COALESCE(address_verified, false) = true
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_verified ON leads(verified);

-- Comments
COMMENT ON COLUMN leads.address_verified IS 'True if the property address has been verbally confirmed by the caller';
COMMENT ON COLUMN leads.verified IS 'Auto-computed: true if phone_verified, email_verified, and address_verified are ALL true';

