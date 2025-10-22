-- Add preferred_language column to leads table
-- Allows Barbara to speak in the caller's preferred language

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en';

-- Add comment for documentation
COMMENT ON COLUMN leads.preferred_language IS 'Preferred language for AI agent communication (ISO 639-1 codes: en, es, etc.)';

-- Create index for language-based queries (if needed for analytics)
CREATE INDEX IF NOT EXISTS idx_leads_preferred_language ON leads(preferred_language);

-- Update existing leads to English (explicit default)
UPDATE leads SET preferred_language = 'en' WHERE preferred_language IS NULL;

