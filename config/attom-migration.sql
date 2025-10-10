-- ==========================================
-- ATTOM API Integration Migration
-- ==========================================
-- Adds ATTOM property ID for stable deduplication
-- Replaces BatchData integration
-- Migration Date: 2025-10-10

-- Step 1: Add ATTOM property ID column to leads table
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS attom_property_id TEXT;

-- Step 2: Create unique index for ATTOM property ID (primary dedupe key)
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_attom_id
  ON leads (attom_property_id)
  WHERE attom_property_id IS NOT NULL;

-- Step 3: Create index for query performance
CREATE INDEX IF NOT EXISTS idx_leads_attom_id
  ON leads (attom_property_id)
  WHERE attom_property_id IS NOT NULL;

-- Step 4: Add zip_index to source_bookmarks for single-zip processing
ALTER TABLE source_bookmarks
  ADD COLUMN IF NOT EXISTS zip_index INTEGER DEFAULT 0;

-- Step 5: Update get_or_create_bookmark to return zip_index
DROP FUNCTION IF EXISTS get_or_create_bookmark(TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_or_create_bookmark(
  p_source TEXT,
  p_query_sig TEXT
) RETURNS TABLE (
  last_page_fetched INTEGER,
  last_vendor_id TEXT,
  zip_index INTEGER
) AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- Insert or get existing bookmark
  INSERT INTO source_bookmarks (
    source,
    query_sig,
    last_page_fetched,
    zip_index,
    created_at,
    updated_at
  ) VALUES (
    p_source,
    p_query_sig,
    0,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT (source, query_sig)
  DO UPDATE SET
    updated_at = NOW()
  RETURNING * INTO v_record;
  
  -- Return the bookmark
  RETURN QUERY
  SELECT 
    v_record.last_page_fetched,
    v_record.last_vendor_id,
    v_record.zip_index;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create updated upsert_lead function with ATTOM support
DROP FUNCTION IF EXISTS upsert_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, UUID, TEXT);

CREATE OR REPLACE FUNCTION upsert_lead(
  p_attom_property_id TEXT,
  p_parcel_number TEXT,
  p_county_fips TEXT,
  p_address_line1 TEXT,
  p_city TEXT,
  p_state TEXT,
  p_zip TEXT,
  p_owner_name TEXT,
  p_estimated_value NUMERIC,
  p_equity_percent NUMERIC,
  p_assigned_broker_id UUID,
  p_source TEXT
) RETURNS UUID AS $$
DECLARE
  v_addr_hash TEXT;
  v_lead_id UUID;
  v_normalized_addr TEXT;
BEGIN
  -- Compute normalized address for hashing
  v_normalized_addr := 
    UPPER(TRIM(COALESCE(p_address_line1, ''))) || '|' ||
    UPPER(TRIM(COALESCE(p_city, ''))) || '|' ||
    UPPER(TRIM(COALESCE(p_state, ''))) || '|' ||
    SUBSTRING(COALESCE(p_zip, ''), 1, 5);
  
  -- Simple hash function (matches n8n Code node implementation)
  -- Note: In production, use a proper hash extension like pgcrypto
  v_addr_hash := MD5(v_normalized_addr);

  -- Upsert with multi-level conflict resolution
  -- Priority: 1) attom_property_id, 2) parcel+fips, 3) addr_hash
  
  INSERT INTO leads (
    attom_property_id,
    parcel_number,
    county_fips,
    addr_hash,
    address_line1,
    city,
    state,
    zip,
    owner_name,
    estimated_value,
    equity_percent,
    assigned_broker_id,
    source,
    created_at,
    updated_at
  ) VALUES (
    p_attom_property_id,
    p_parcel_number,
    p_county_fips,
    v_addr_hash,
    p_address_line1,
    p_city,
    p_state,
    p_zip,
    p_owner_name,
    p_estimated_value,
    p_equity_percent,
    p_assigned_broker_id,
    p_source,
    NOW(),
    NOW()
  )
  -- First try: ATTOM property ID (most stable)
  ON CONFLICT (attom_property_id)
    WHERE attom_property_id IS NOT NULL
    DO UPDATE SET
      parcel_number = COALESCE(EXCLUDED.parcel_number, leads.parcel_number),
      county_fips = COALESCE(EXCLUDED.county_fips, leads.county_fips),
      owner_name = EXCLUDED.owner_name,
      estimated_value = EXCLUDED.estimated_value,
      equity_percent = EXCLUDED.equity_percent,
      updated_at = NOW()
  RETURNING id INTO v_lead_id;
  
  -- If ATTOM ID conflict didn't happen, try parcel+fips
  IF v_lead_id IS NULL THEN
    INSERT INTO leads (
      attom_property_id,
      parcel_number,
      county_fips,
      addr_hash,
      address_line1,
      city,
      state,
      zip,
      owner_name,
      estimated_value,
      equity_percent,
      assigned_broker_id,
      source,
      created_at,
      updated_at
    ) VALUES (
      p_attom_property_id,
      p_parcel_number,
      p_county_fips,
      v_addr_hash,
      p_address_line1,
      p_city,
      p_state,
      p_zip,
      p_owner_name,
      p_estimated_value,
      p_equity_percent,
      p_assigned_broker_id,
      p_source,
      NOW(),
      NOW()
    )
    ON CONFLICT (parcel_number, county_fips)
      WHERE parcel_number IS NOT NULL AND county_fips IS NOT NULL
      DO UPDATE SET
        attom_property_id = COALESCE(EXCLUDED.attom_property_id, leads.attom_property_id),
        owner_name = EXCLUDED.owner_name,
        estimated_value = EXCLUDED.estimated_value,
        equity_percent = EXCLUDED.equity_percent,
        updated_at = NOW()
    RETURNING id INTO v_lead_id;
  END IF;
  
  -- If still no match, try addr_hash
  IF v_lead_id IS NULL THEN
    INSERT INTO leads (
      attom_property_id,
      parcel_number,
      county_fips,
      addr_hash,
      address_line1,
      city,
      state,
      zip,
      owner_name,
      estimated_value,
      equity_percent,
      assigned_broker_id,
      source,
      created_at,
      updated_at
    ) VALUES (
      p_attom_property_id,
      p_parcel_number,
      p_county_fips,
      v_addr_hash,
      p_address_line1,
      p_city,
      p_state,
      p_zip,
      p_owner_name,
      p_estimated_value,
      p_equity_percent,
      p_assigned_broker_id,
      p_source,
      NOW(),
      NOW()
    )
    ON CONFLICT (addr_hash)
      DO UPDATE SET
        attom_property_id = COALESCE(EXCLUDED.attom_property_id, leads.attom_property_id),
        parcel_number = COALESCE(EXCLUDED.parcel_number, leads.parcel_number),
        county_fips = COALESCE(EXCLUDED.county_fips, leads.county_fips),
        owner_name = EXCLUDED.owner_name,
        estimated_value = EXCLUDED.estimated_value,
        equity_percent = EXCLUDED.equity_percent,
        updated_at = NOW()
    RETURNING id INTO v_lead_id;
  END IF;

  RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create function to advance to next zip code
CREATE OR REPLACE FUNCTION advance_zip_bookmark(
  p_source TEXT,
  p_query_sig TEXT,
  p_total_zips INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE source_bookmarks
  SET 
    zip_index = (zip_index + 1) % p_total_zips,  -- Rotate through zips
    last_page_fetched = 0,  -- Reset page counter for new zip
    updated_at = NOW()
  WHERE source = p_source
    AND query_sig = p_query_sig;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Add comment for documentation
COMMENT ON COLUMN leads.attom_property_id IS 'ATTOM Data property ID - primary dedupe key (formerly Estated)';
COMMENT ON COLUMN source_bookmarks.zip_index IS 'Current zip code index being processed (for single-zip rotation)';
COMMENT ON FUNCTION get_or_create_bookmark IS 'Returns or creates bookmark for pagination with zip rotation support';
COMMENT ON FUNCTION advance_zip_bookmark IS 'Advances to next zip code in rotation and resets page counter';

