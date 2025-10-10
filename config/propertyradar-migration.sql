-- =====================================================
-- PROPERTYRADAR MIGRATION
-- =====================================================
-- Version: 2025-10-10
-- Purpose: Add PropertyRadar support and update deduplication hierarchy
-- Replaces: BatchData (mak) and ATTOM (attom_property_id)
-- Priority: radar_id → mak → attom_property_id → apn+county_fips → addr_hash
-- =====================================================

-- =====================================================
-- SECTION 1: ADD PROPERTYRADAR COLUMNS
-- =====================================================

-- Add PropertyRadar-specific columns to leads table
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS radar_id TEXT,
  ADD COLUMN IF NOT EXISTS radar_property_data JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS radar_api_version TEXT DEFAULT 'v1';

-- Add comments for documentation
COMMENT ON COLUMN leads.radar_id IS 'PropertyRadar unique property identifier - PRIMARY deduplication key';
COMMENT ON COLUMN leads.radar_property_data IS 'Full PropertyRadar API response payload for auditing and future enrichment';
COMMENT ON COLUMN leads.radar_api_version IS 'PropertyRadar API version used for this record';

-- =====================================================
-- SECTION 2: CREATE DEDUPLICATION INDEXES
-- =====================================================

-- PropertyRadar ID (HIGHEST PRIORITY)
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_radar_id
  ON leads (radar_id)
  WHERE radar_id IS NOT NULL;

-- Keep existing indexes for backward compatibility and fallback dedup
-- (mak, attom_property_id, apn+county_fips, addr_hash remain unchanged)

-- Query performance index for PropertyRadar leads
CREATE INDEX IF NOT EXISTS idx_leads_radar_id
  ON leads (radar_id)
  WHERE radar_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_radar_api_version
  ON leads (radar_api_version)
  WHERE radar_api_version IS NOT NULL;

-- =====================================================
-- SECTION 3: UPDATE UPSERT FUNCTION
-- =====================================================

-- Enhanced upsert function with PropertyRadar support
-- Deduplication priority: radar_id → mak → attom_property_id → apn+county_fips → addr_hash
CREATE OR REPLACE FUNCTION upsert_lead_from_radar(p JSONB)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
  v_existing_id UUID;
BEGIN
  -- Try to find existing lead by deduplication hierarchy
  SELECT id INTO v_existing_id
  FROM leads
  WHERE 
    -- Priority 1: PropertyRadar ID
    (radar_id = p->>'radar_id' AND p->>'radar_id' IS NOT NULL)
    OR
    -- Priority 2: BatchData MAK (backward compatibility)
    (mak = p->>'mak' AND p->>'mak' IS NOT NULL)
    OR
    -- Priority 3: ATTOM property ID (backward compatibility)
    (attom_property_id = p->>'attom_property_id' AND p->>'attom_property_id' IS NOT NULL)
    OR
    -- Priority 4: APN + County FIPS
    (parcel_number = p->>'parcel_number' AND county_fips = p->>'county_fips' 
     AND p->>'parcel_number' IS NOT NULL AND p->>'county_fips' IS NOT NULL)
    OR
    -- Priority 5: Address hash
    (addr_hash = p->>'addr_hash' AND p->>'addr_hash' IS NOT NULL)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- UPDATE existing lead with safe merges
    UPDATE leads SET
      -- PropertyRadar fields (always update if provided)
      radar_id = COALESCE(p->>'radar_id', radar_id),
      radar_property_data = COALESCE(leads.radar_property_data, '{}'::JSONB) || COALESCE(p->'radar_property_data', '{}'::JSONB),
      radar_api_version = COALESCE(p->>'radar_api_version', radar_api_version),
      
      -- Backward compatibility fields (preserve if already set)
      mak = COALESCE(leads.mak, p->>'mak'),
      apn = COALESCE(leads.apn, p->>'apn'),
      attom_property_id = COALESCE(leads.attom_property_id, p->>'attom_property_id'),
      parcel_number = COALESCE(leads.parcel_number, p->>'parcel_number'),
      county_fips = COALESCE(leads.county_fips, p->>'county_fips'),
      addr_hash = COALESCE(leads.addr_hash, p->>'addr_hash'),
      
      -- Address fields
      address_line1 = COALESCE(leads.address_line1, p->>'address_line1'),
      unit = COALESCE(leads.unit, p->>'unit'),
      city = COALESCE(leads.city, p->>'city'),
      state = COALESCE(leads.state, p->>'state'),
      postal_code = COALESCE(leads.postal_code, p->>'postal_code'),
      
      -- Owner info
      owner_name = COALESCE(leads.owner_name, p->>'owner_name'),
      first_name = COALESCE(leads.first_name, p->>'first_name'),
      last_name = COALESCE(leads.last_name, p->>'last_name'),
      age = COALESCE(leads.age, (p->>'age')::INTEGER),
      
      -- Property details
      estimated_value = COALESCE(leads.estimated_value, (p->>'estimated_value')::NUMERIC),
      estimated_equity = COALESCE(leads.estimated_equity, (p->>'estimated_equity')::NUMERIC),
      equity_percent = COALESCE(leads.equity_percent, (p->>'equity_percent')::NUMERIC),
      property_value = COALESCE(leads.property_value, (p->>'property_value')::NUMERIC),
      owner_occupied = COALESCE(leads.owner_occupied, (p->>'owner_occupied')::BOOLEAN),
      
      -- Contact info (PropertyRadar may include this)
      email = COALESCE(leads.email, p->>'email'),
      phone = COALESCE(leads.phone, p->>'phone'),
      
      -- Verification flags (OR logic - once verified, stays verified)
      email_verified = COALESCE(leads.email_verified, FALSE) OR COALESCE((p->>'email_verified')::BOOLEAN, FALSE),
      phone_verified = COALESCE(leads.phone_verified, FALSE) OR COALESCE((p->>'phone_verified')::BOOLEAN, FALSE),
      
      -- Skip-trace tier (upgrade tier if better enrichment provided)
      -- Tier 0 = PropertyRadar, Tier 1 = PDL, Tier 2 = Melissa
      skiptrace_tier = GREATEST(
        COALESCE(leads.skiptrace_tier, 0),
        COALESCE((p->>'skiptrace_tier')::INTEGER, 0)
      ),
      skiptrace_completed_at = CASE
        WHEN (p->>'skiptrace_tier')::INTEGER > COALESCE(leads.skiptrace_tier, 0)
        THEN NOW()
        ELSE leads.skiptrace_completed_at
      END,
      
      -- Enrichment metadata (merge JSONB)
      enrichment_meta = COALESCE(leads.enrichment_meta, '{}'::JSONB) || COALESCE(p->'enrichment_meta', '{}'::JSONB),
      
      -- Broker assignment
      assigned_broker_id = COALESCE(leads.assigned_broker_id, (p->>'assigned_broker_id')::UUID),
      
      -- Source tracking
      source = COALESCE(leads.source, p->>'source'),
      
      -- Timestamps
      updated_at = NOW(),
      last_seen_at = NOW()
    WHERE id = v_existing_id
    RETURNING id INTO v_id;

    RETURN v_id;
    
  ELSE
    -- INSERT new lead
    INSERT INTO leads (
      -- PropertyRadar fields
      radar_id,
      radar_property_data,
      radar_api_version,
      
      -- Backward compatibility fields
      mak,
      apn,
      attom_property_id,
      parcel_number,
      county_fips,
      addr_hash,
      
      -- Address fields
      address_line1,
      unit,
      city,
      state,
      postal_code,
      
      -- Owner info
      owner_name,
      first_name,
      last_name,
      age,
      
      -- Property details
      estimated_value,
      estimated_equity,
      equity_percent,
      property_value,
      owner_occupied,
      
      -- Contact info
      email,
      phone,
      email_verified,
      phone_verified,
      
      -- Skip-trace
      skiptrace_tier,
      skiptrace_completed_at,
      enrichment_meta,
      
      -- Assignment
      assigned_broker_id,
      source,
      
      -- Status
      status,
      campaign_status,
      
      -- Timestamps
      created_at,
      updated_at,
      last_seen_at
    ) VALUES (
      -- PropertyRadar fields
      p->>'radar_id',
      COALESCE(p->'radar_property_data', '{}'::JSONB),
      COALESCE(p->>'radar_api_version', 'v1'),
      
      -- Backward compatibility fields
      p->>'mak',
      p->>'apn',
      p->>'attom_property_id',
      p->>'parcel_number',
      p->>'county_fips',
      p->>'addr_hash',
      
      -- Address fields
      p->>'address_line1',
      p->>'unit',
      p->>'city',
      p->>'state',
      p->>'postal_code',
      
      -- Owner info
      p->>'owner_name',
      p->>'first_name',
      p->>'last_name',
      (p->>'age')::INTEGER,
      
      -- Property details
      (p->>'estimated_value')::NUMERIC,
      (p->>'estimated_equity')::NUMERIC,
      (p->>'equity_percent')::NUMERIC,
      (p->>'property_value')::NUMERIC,
      (p->>'owner_occupied')::BOOLEAN,
      
      -- Contact info
      p->>'email',
      p->>'phone',
      COALESCE((p->>'email_verified')::BOOLEAN, FALSE),
      COALESCE((p->>'phone_verified')::BOOLEAN, FALSE),
      
      -- Skip-trace
      COALESCE((p->>'skiptrace_tier')::INTEGER, 0),
      CASE WHEN (p->>'skiptrace_tier')::INTEGER > 0 THEN NOW() ELSE NULL END,
      COALESCE(p->'enrichment_meta', '{}'::JSONB),
      
      -- Assignment
      (p->>'assigned_broker_id')::UUID,
      COALESCE(p->>'source', 'propertyradar'),
      
      -- Status
      COALESCE(p->>'status', 'new'),
      COALESCE(p->>'campaign_status', 'new'),
      
      -- Timestamps
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION upsert_lead_from_radar IS 'Idempotent lead upsert with PropertyRadar deduplication. Priority: radar_id → mak → attom_property_id → apn+county → addr_hash';

-- =====================================================
-- SECTION 4: HELPER FUNCTIONS
-- =====================================================

-- Function to get leads needing enrichment (PropertyRadar leads with no contact)
CREATE OR REPLACE FUNCTION get_leads_needing_enrichment(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID,
  radar_id TEXT,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  owner_name TEXT,
  first_name TEXT,
  last_name TEXT,
  age INTEGER
) LANGUAGE SQL AS $$
  SELECT 
    l.id,
    l.radar_id,
    l.address_line1,
    l.city,
    l.state,
    l.postal_code,
    l.owner_name,
    l.first_name,
    l.last_name,
    l.age
  FROM leads l
  WHERE l.skiptrace_tier IS NULL OR l.skiptrace_tier = 0
    AND (l.email IS NULL OR l.phone IS NULL)
    AND l.created_at >= NOW() - INTERVAL '7 days'
    AND l.radar_id IS NOT NULL
  ORDER BY l.equity_percent DESC NULLS LAST
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION get_leads_needing_enrichment IS 'Returns PropertyRadar leads without contact info for enrichment waterfall';

-- =====================================================
-- SECTION 5: UPDATE EXISTING HELPER FUNCTIONS
-- =====================================================

-- Update get_campaign_ready_leads to prioritize PropertyRadar leads
CREATE OR REPLACE FUNCTION get_campaign_ready_leads()
RETURNS TABLE (
  id UUID,
  assigned_broker_id UUID,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  owner_name TEXT,
  email TEXT,
  phone TEXT,
  equity_percent NUMERIC
) LANGUAGE SQL AS $$
  WITH broker_capacity AS (
    SELECT 
      b.id as broker_id,
      b.daily_lead_capacity,
      COUNT(l.id) FILTER (WHERE l.added_to_campaign_at >= CURRENT_DATE) as today_count
    FROM brokers b
    LEFT JOIN leads l ON l.assigned_broker_id = b.id
    GROUP BY b.id, b.daily_lead_capacity
  ),
  ranked_leads AS (
    SELECT 
      l.id,
      l.assigned_broker_id,
      l.address_line1,
      l.city,
      l.state,
      l.postal_code,
      l.owner_name,
      l.email,
      l.phone,
      l.equity_percent,
      ROW_NUMBER() OVER (
        PARTITION BY l.assigned_broker_id 
        ORDER BY 
          -- Prioritize PropertyRadar leads (most recent data)
          CASE WHEN l.radar_id IS NOT NULL THEN 0 ELSE 1 END,
          l.equity_percent DESC NULLS LAST,
          l.created_at ASC
      ) as rank,
      bc.daily_lead_capacity - bc.today_count as remaining_capacity
    FROM leads l
    INNER JOIN broker_capacity bc ON l.assigned_broker_id = bc.broker_id
    WHERE l.campaign_status IS NULL
      AND (l.email_verified = true OR l.phone_verified = true)
      AND bc.today_count < bc.daily_lead_capacity
  )
  SELECT 
    rl.id,
    rl.assigned_broker_id,
    rl.address_line1,
    rl.city,
    rl.state,
    rl.postal_code,
    rl.owner_name,
    rl.email,
    rl.phone,
    rl.equity_percent
  FROM ranked_leads rl
  WHERE rl.rank <= rl.remaining_capacity
  ORDER BY rl.assigned_broker_id, rl.rank;
$$;

COMMENT ON FUNCTION get_campaign_ready_leads IS 'Returns campaign-ready leads prioritizing PropertyRadar sources';

-- =====================================================
-- SECTION 6: DATA QUALITY VIEWS
-- =====================================================

-- View for PropertyRadar data quality monitoring
CREATE OR REPLACE VIEW propertyradar_quality_stats AS
SELECT 
  DATE(l.created_at) as date,
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE l.radar_id IS NOT NULL) as propertyradar_leads,
  COUNT(*) FILTER (WHERE l.email IS NOT NULL) as with_email,
  COUNT(*) FILTER (WHERE l.phone IS NOT NULL) as with_phone,
  COUNT(*) FILTER (WHERE l.email IS NOT NULL AND l.phone IS NOT NULL) as with_both,
  COUNT(*) FILTER (WHERE l.email IS NOT NULL OR l.phone IS NOT NULL) as with_any_contact,
  ROUND(100.0 * COUNT(*) FILTER (WHERE l.email IS NOT NULL OR l.phone IS NOT NULL) / NULLIF(COUNT(*), 0), 2) as contact_rate_pct,
  COUNT(*) FILTER (WHERE l.skiptrace_tier = 0) as radar_only,
  COUNT(*) FILTER (WHERE l.skiptrace_tier = 1) as pdl_enriched,
  COUNT(*) FILTER (WHERE l.skiptrace_tier = 2) as melissa_enriched,
  AVG(l.equity_percent) FILTER (WHERE l.equity_percent IS NOT NULL) as avg_equity_percent
FROM leads l
WHERE l.created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND l.radar_id IS NOT NULL
GROUP BY DATE(l.created_at)
ORDER BY date DESC;

COMMENT ON VIEW propertyradar_quality_stats IS 'Daily PropertyRadar data quality and enrichment metrics';

-- =====================================================
-- SECTION 7: BACKWARD COMPATIBILITY
-- =====================================================

-- Keep old function name as alias for backward compatibility
CREATE OR REPLACE FUNCTION upsert_lead_from_attom(p JSONB)
RETURNS UUID LANGUAGE plpgsql AS $$
BEGIN
  -- Redirect to new PropertyRadar function
  RETURN upsert_lead_from_radar(p);
END;
$$;

COMMENT ON FUNCTION upsert_lead_from_attom IS 'DEPRECATED: Use upsert_lead_from_radar instead. Kept for backward compatibility.';

-- =====================================================
-- SECTION 8: GRANTS & PERMISSIONS
-- =====================================================

-- Grant execute on new functions
GRANT EXECUTE ON FUNCTION upsert_lead_from_radar TO authenticated;
GRANT EXECUTE ON FUNCTION get_leads_needing_enrichment TO authenticated;
GRANT EXECUTE ON FUNCTION get_campaign_ready_leads TO authenticated;

-- Grant select on new view
GRANT SELECT ON propertyradar_quality_stats TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Test the deduplication hierarchy
-- Example INSERT with PropertyRadar ID:
-- SELECT upsert_lead_from_radar(jsonb_build_object(
--   'radar_id', 'RADAR123456',
--   'address_line1', '123 Main St',
--   'city', 'Los Angeles',
--   'state', 'CA',
--   'postal_code', '90016',
--   'owner_name', 'John Doe',
--   'age', 65,
--   'estimated_value', 500000,
--   'equity_percent', 75,
--   'owner_occupied', true,
--   'email', 'john@example.com',
--   'phone', '+13105551234',
--   'email_verified', true,
--   'phone_verified', true,
--   'skiptrace_tier', 0,
--   'source', 'propertyradar',
--   'assigned_broker_id', 'your-broker-uuid-here'
-- ));

-- Check PropertyRadar leads
-- SELECT COUNT(*), COUNT(DISTINCT radar_id) FROM leads WHERE radar_id IS NOT NULL;

-- View quality stats
-- SELECT * FROM propertyradar_quality_stats ORDER BY date DESC LIMIT 7;

-- Check leads needing enrichment
-- SELECT * FROM get_leads_needing_enrichment(10);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PROPERTYRADAR MIGRATION COMPLETED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Added columns:';
  RAISE NOTICE '  - radar_id (unique index)';
  RAISE NOTICE '  - radar_property_data (JSONB)';
  RAISE NOTICE '  - radar_api_version';
  RAISE NOTICE '';
  RAISE NOTICE 'Created functions:';
  RAISE NOTICE '  - upsert_lead_from_radar()';
  RAISE NOTICE '  - get_leads_needing_enrichment()';
  RAISE NOTICE '  - Updated: get_campaign_ready_leads()';
  RAISE NOTICE '';
  RAISE NOTICE 'Created views:';
  RAISE NOTICE '  - propertyradar_quality_stats';
  RAISE NOTICE '';
  RAISE NOTICE 'Dedup priority: radar_id → mak → attom_property_id → apn+fips → addr_hash';
  RAISE NOTICE '========================================';
END $$;

