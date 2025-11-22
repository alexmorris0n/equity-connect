-- Migration: Add qualification fields and auto-update trigger
-- Date: November 22, 2025
-- Purpose: Add granular qualification gate fields (age_62, homeowner, primary_residence, sufficient_equity)

-- Add granular qualification fields to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS age_qualified BOOLEAN DEFAULT false;

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS homeowner_qualified BOOLEAN DEFAULT false;

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS primary_residence_qualified BOOLEAN DEFAULT false;

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS equity_qualified BOOLEAN DEFAULT false;

-- Create function to update qualified field (auto-computed from all 4 gates)
CREATE OR REPLACE FUNCTION update_lead_qualified()
RETURNS TRIGGER AS $$
BEGIN
    -- Set qualified = true only if ALL four qualification gates are true
    NEW.qualified := (
        COALESCE(NEW.age_qualified, false) = true AND
        COALESCE(NEW.homeowner_qualified, false) = true AND
        COALESCE(NEW.primary_residence_qualified, false) = true AND
        COALESCE(NEW.equity_qualified, false) = true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update qualified field on INSERT or UPDATE
DROP TRIGGER IF EXISTS trigger_update_lead_qualified ON leads;
CREATE TRIGGER trigger_update_lead_qualified
    BEFORE INSERT OR UPDATE OF age_qualified, homeowner_qualified, primary_residence_qualified, equity_qualified
    ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_qualified();

-- Backfill existing leads: If status is 'qualified' or beyond, mark all gates as true
UPDATE leads
SET 
    age_qualified = true,
    homeowner_qualified = true,
    primary_residence_qualified = true,
    equity_qualified = true
WHERE status IN ('qualified', 'appointment_set', 'showed', 'application', 'funded');

-- Recompute qualified for all existing leads
UPDATE leads
SET qualified = (
    COALESCE(age_qualified, false) = true AND
    COALESCE(homeowner_qualified, false) = true AND
    COALESCE(primary_residence_qualified, false) = true AND
    COALESCE(equity_qualified, false) = true
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_qualified ON leads(qualified);

-- Comments
COMMENT ON COLUMN leads.age_qualified IS 'True if caller confirmed they are 62+ years old (FHA requirement)';
COMMENT ON COLUMN leads.homeowner_qualified IS 'True if caller confirmed they own the property';
COMMENT ON COLUMN leads.primary_residence_qualified IS 'True if caller confirmed property is their primary residence (not rental/investment)';
COMMENT ON COLUMN leads.equity_qualified IS 'True if caller confirmed they have sufficient equity in the property';
COMMENT ON COLUMN leads.qualified IS 'Auto-computed: true if age_qualified, homeowner_qualified, primary_residence_qualified, and equity_qualified are ALL true';

