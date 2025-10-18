-- PropertyRadar List-Based Deduplication Migration
-- Adds dedup columns, unique indexes, and upsert function

-- Add dedup columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS radar_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS apn TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS county_fips TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS addr_hash TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_available BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_available BOOLEAN DEFAULT FALSE;

-- Create unique indexes for deduplication (hierarchical priority)
-- Priority 1: PropertyRadar RadarID (most reliable)
CREATE UNIQUE INDEX IF NOT EXISTS leads_radar_id_uidx ON leads (radar_id) WHERE radar_id IS NOT NULL;

-- Priority 2: APN + County FIPS (stable assessor key)
CREATE UNIQUE INDEX IF NOT EXISTS leads_apn_fips_uidx ON leads (apn, county_fips) WHERE apn IS NOT NULL AND county_fips IS NOT NULL;

-- Priority 3: Normalized address hash (fallback)
CREATE UNIQUE INDEX IF NOT EXISTS leads_addr_hash_uidx ON leads (addr_hash) WHERE addr_hash IS NOT NULL;

-- Add list_id column to brokers table
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS propertyradar_list_id TEXT;

COMMENT ON COLUMN brokers.propertyradar_list_id IS 'PropertyRadar dynamic list ID for this broker (format: RM_{broker_id})';
COMMENT ON COLUMN leads.radar_id IS 'PropertyRadar unique property ID (primary dedup key)';
COMMENT ON COLUMN leads.apn IS 'Assessor Parcel Number (secondary dedup key)';
COMMENT ON COLUMN leads.county_fips IS 'County FIPS code (used with APN for dedup)';
COMMENT ON COLUMN leads.addr_hash IS 'Normalized address hash (tertiary dedup key)';

-- Drop old upsert function if exists
DROP FUNCTION IF EXISTS upsert_lead_from_radar(jsonb);

-- Create new upsert function with dedup hierarchy
CREATE OR REPLACE FUNCTION upsert_lead_from_radar(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_existing_id UUID;
BEGIN
  -- Try to find existing lead by deduplication hierarchy
  SELECT id INTO v_existing_id
  FROM leads
  WHERE 
    -- Priority 1: PropertyRadar RadarID (most reliable)
    (radar_id = p->>'radar_id' AND p->>'radar_id' IS NOT NULL)
    OR
    -- Priority 2: APN + County FIPS (stable assessor key)
    (apn = p->>'apn' AND county_fips = p->>'county_fips' 
     AND p->>'apn' IS NOT NULL AND p->>'county_fips' IS NOT NULL)
    OR
    -- Priority 3: Normalized address hash (fallback)
    (addr_hash = p->>'addr_hash' AND p->>'addr_hash' IS NOT NULL)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- UPDATE existing lead (enrich with new data)
    UPDATE leads SET
      radar_id = COALESCE(leads.radar_id, p->>'radar_id'),
      apn = COALESCE(leads.apn, p->>'apn'),
      county_fips = COALESCE(leads.county_fips, p->>'county_fips'),
      addr_hash = COALESCE(leads.addr_hash, p->>'addr_hash'),
      radar_property_data = COALESCE(leads.radar_property_data, '{}'::JSONB) || COALESCE(p->'radar_property_data', '{}'::JSONB),
      radar_api_version = COALESCE(p->>'radar_api_version', leads.radar_api_version),
      property_address = COALESCE(leads.property_address, p->>'address_line1'),
      property_city = COALESCE(leads.property_city, p->>'city'),
      property_state = COALESCE(leads.property_state, p->>'state'),
      property_zip = COALESCE(leads.property_zip, p->>'postal_code'),
      age = COALESCE(leads.age, (p->>'age')::INTEGER),
      property_value = COALESCE(leads.property_value, (p->>'property_value')::NUMERIC),
      estimated_equity = COALESCE(leads.estimated_equity, (p->>'estimated_equity')::NUMERIC),
      owner_occupied = COALESCE(leads.owner_occupied, (p->>'owner_occupied')::BOOLEAN),
      phone_available = COALESCE((p->>'phone_available')::BOOLEAN, leads.phone_available),
      email_available = COALESCE((p->>'email_available')::BOOLEAN, leads.email_available),
      assigned_broker_id = COALESCE(leads.assigned_broker_id, (p->>'assigned_broker_id')::UUID),
      source = COALESCE(leads.source, p->>'source'),
      updated_at = NOW()
    WHERE id = v_existing_id
    RETURNING id INTO v_id;

    RETURN v_id;
    
  ELSE
    -- INSERT new lead
    INSERT INTO leads (
      radar_id,
      apn,
      county_fips,
      addr_hash,
      radar_property_data,
      radar_api_version,
      property_address,
      property_city,
      property_state,
      property_zip,
      age,
      property_value,
      estimated_equity,
      owner_occupied,
      phone_available,
      email_available,
      assigned_broker_id,
      source,
      status,
      campaign_status,
      created_at,
      updated_at
    ) VALUES (
      p->>'radar_id',
      p->>'apn',
      p->>'county_fips',
      p->>'addr_hash',
      COALESCE(p->'radar_property_data', '{}'::JSONB),
      COALESCE(p->>'radar_api_version', 'v1'),
      p->>'address_line1',
      p->>'city',
      p->>'state',
      p->>'postal_code',
      (p->>'age')::INTEGER,
      (p->>'property_value')::NUMERIC,
      (p->>'estimated_equity')::NUMERIC,
      (p->>'owner_occupied')::BOOLEAN,
      COALESCE((p->>'phone_available')::BOOLEAN, FALSE),
      COALESCE((p->>'email_available')::BOOLEAN, FALSE),
      (p->>'assigned_broker_id')::UUID,
      COALESCE(p->>'source', 'propertyradar'),
      'new',
      'new',
      NOW(),
      NOW()
    )
    ON CONFLICT (radar_id) DO NOTHING
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;
END;
$$;

-- Create index on broker list_id for faster lookups
CREATE INDEX IF NOT EXISTS brokers_propertyradar_list_id_idx ON brokers (propertyradar_list_id) WHERE propertyradar_list_id IS NOT NULL;

-- Grant execute on function
GRANT EXECUTE ON FUNCTION upsert_lead_from_radar(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_lead_from_radar(jsonb) TO service_role;

