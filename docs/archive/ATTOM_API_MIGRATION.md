# ATTOM API Integration Guide

## Executive Summary

**ATTOM Data Solutions** (formerly Estated) is the production-ready property data provider for Equity Connect. This replaces the BatchData integration due to incompatible billing model.

### Key Advantages

| Feature | ATTOM | BatchData (Deprecated) |
|---------|-------|----------------------|
| **Billing Model** | Per-record lookup | All search results upfront |
| **Cost (250 leads/day)** | ~$25/day | ~$2,000-$3,000/day |
| **Field Control** | Granular | Limited |
| **Dedupe Keys** | property_id, APN, FIPS | Proprietary hash |
| **Legal Compliance** | Fully resell-safe | Unknown |
| **API Stability** | Enterprise-grade | Startup |

---

## Cost Analysis

### BatchData Problem (Why We Migrated)

**Critical Issue:** BatchData charges for the ENTIRE result set upfront, not just paginated records.

**Example:**
- Query: 32 LA zip codes + owner-occupied + high-equity
- Total matches: ~10,000 properties
- **Cost charged IMMEDIATELY: 10,000 × $0.62 = $6,200**
- `take: 50` only controls pagination display, NOT billing

**First test pull:**
- Cost: $31 for ~50 total matches in result set
- With full 32-zip deployment: $6,200+ per query
- **Economically non-viable**

### ATTOM Pricing Model

**True per-lookup billing:**
- 250 properties/day × $0.10 = **$25/day**
- 7,500 properties/month = **$750/month**
- Scales linearly with usage

---

## API Structure

### Base Endpoint

```
https://api.gateway.attomdata.com/propertyapi/v1.0.0/
```

### Authentication

**Headers:**
```
Accept: application/json
apikey: YOUR_API_KEY_HERE
```

### Key Endpoints for Equity Connect

#### 1. Property Detail Lookup (Primary)

```
GET /property/detail
```

**Parameters:**
- `address1` - Street address
- `address2` - City, State ZIP
- `postalcode` - ZIP code (for batch lookup)

**Response includes:**
- Property ID (stable dedupe key)
- Owner information
- Property characteristics
- AVM valuation
- Equity estimates

#### 2. Property Expanded Detail (with AVM)

```
GET /property/expandedprofile
```

**Includes everything from detail PLUS:**
- Detailed valuation history
- Market trends
- Neighborhood statistics
- School data

**Use case:** Full enrichment for qualified leads

#### 3. Property Basic Search (Discovery)

```
GET /property/address
```

**Parameters:**
- `postalcode` - ZIP code
- `propertytype` - Single Family
- Owner-occupied filters

**Use case:** Finding new properties in broker territories

---

## Database Schema Updates

### Add ATTOM Property ID Column

```sql
-- Add ATTOM property ID for stable deduplication
ALTER TABLE leads
  ADD COLUMN attom_property_id TEXT;

-- Create unique index for ATTOM property ID
CREATE UNIQUE INDEX uq_leads_attom_id
  ON leads (attom_property_id)
  WHERE attom_property_id IS NOT NULL;

-- Add index for performance
CREATE INDEX idx_leads_attom_id
  ON leads (attom_property_id);
```

### Updated Deduplication Hierarchy

```sql
-- Priority order for lead deduplication:
-- 1. attom_property_id (most stable)
-- 2. parcel_number + county_fips (county records)
-- 3. addr_hash (normalized USPS address)

-- Function to compute addr_hash (already exists)
-- Keep existing simple_hash function

-- Updated upsert_lead function
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
BEGIN
  -- Compute address hash
  v_addr_hash := simple_hash(
    UPPER(TRIM(p_address_line1)) || '|' ||
    UPPER(TRIM(p_city)) || '|' ||
    UPPER(TRIM(p_state)) || '|' ||
    SUBSTRING(p_zip, 1, 5)
  );

  -- Upsert with conflict resolution
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
  ON CONFLICT (attom_property_id)
    WHERE attom_property_id IS NOT NULL
    DO UPDATE SET
      owner_name = EXCLUDED.owner_name,
      estimated_value = EXCLUDED.estimated_value,
      equity_percent = EXCLUDED.equity_percent,
      updated_at = NOW()
  ON CONFLICT (parcel_number, county_fips)
    WHERE parcel_number IS NOT NULL AND county_fips IS NOT NULL
    DO UPDATE SET
      attom_property_id = EXCLUDED.attom_property_id,
      owner_name = EXCLUDED.owner_name,
      estimated_value = EXCLUDED.estimated_value,
      equity_percent = EXCLUDED.equity_percent,
      updated_at = NOW()
  ON CONFLICT (addr_hash)
    DO UPDATE SET
      attom_property_id = EXCLUDED.attom_property_id,
      parcel_number = EXCLUDED.parcel_number,
      county_fips = EXCLUDED.county_fips,
      owner_name = EXCLUDED.owner_name,
      estimated_value = EXCLUDED.estimated_value,
      equity_percent = EXCLUDED.equity_percent,
      updated_at = NOW()
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql;
```

---

## n8n Workflow Integration

### Updated Node Structure

```
1. Fetch Broker Territories (Supabase)
2. Define Market Params (Code)
3. Get Bookmark (Supabase RPC)
4. ATTOM Property Lookup (HTTP Request) ← NEW
5. Extract & Normalize (Code) ← UPDATED
6. Check Stop-When-Known (Supabase RPC)
7. IF Seen Before? (Conditional)
8. Compute Addr Hash (Code)
9. Upsert Lead (Supabase RPC) ← UPDATED
10. Queue for Enrichment (Supabase)
11. Record Source Event (Supabase)
12. Advance Bookmark (Supabase)
13. Log Completion (Code)
```

### Node 4: ATTOM Property Lookup (HTTP Request)

**Configuration:**

```json
{
  "method": "GET",
  "url": "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/address",
  "authentication": "headerAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Accept",
        "value": "application/json"
      },
      {
        "name": "apikey",
        "value": "YOUR_ATTOM_API_KEY"
      }
    ]
  },
  "sendQuery": true,
  "queryParameters": {
    "parameters": [
      {
        "name": "postalcode",
        "value": "={{ $('Define Market Params').first().json.params.zip_codes[0] }}"
      },
      {
        "name": "page",
        "value": "={{ $('Get Bookmark').first().json.last_page_fetched + 1 }}"
      },
      {
        "name": "pagesize",
        "value": "50"
      }
    ]
  }
}
```

**Key Changes from BatchData:**
- ✅ True pagination (page/pagesize)
- ✅ Only billed for records returned
- ✅ Query ONE zip code at a time (not 32 at once)

### Node 5: Extract & Normalize (Code)

**Updated JavaScript:**

```javascript
// Extract and normalize ATTOM property data
const response = $input.all()[0].json;

if (!response.property || response.property.length === 0) {
  return [{ stop: true, reason: 'no_results' }];
}

const properties = response.property;
const normalizedLeads = [];

properties.forEach(prop => {
  // Extract address
  const address = prop.address || {};
  
  // Extract owner
  const owner = prop.owner || {};
  
  // Extract AVM/valuation
  const avm = prop.avm || {};
  const assessment = prop.assessment || {};
  
  // Extract identifier (for deduplication)
  const identifier = prop.identifier || {};
  
  // Compute estimated equity
  const estimatedValue = avm.amount?.value || assessment.market?.mktttlvalue || 0;
  const mortgage = prop.mortgage?.[0]?.amount || 0;
  const equity = estimatedValue - mortgage;
  const equityPercent = estimatedValue > 0 ? (equity / estimatedValue) * 100 : 0;
  
  // Only include if meets equity threshold (50%+)
  if (equityPercent >= 50) {
    normalizedLeads.push({
      attom_property_id: identifier.attomId,
      parcel_number: identifier.apn,
      county_fips: identifier.fips,
      address_line1: address.line1,
      city: address.locality,
      state: address.countrySubd,
      zip: address.postal1,
      owner_name: owner.owner1?.fullName || owner.owner1?.firstName + ' ' + owner.owner1?.lastName,
      estimated_value: estimatedValue,
      equity_percent: equityPercent,
      raw_data: prop // Store full response for enrichment
    });
  }
});

// Get broker_id from market params
const brokerId = $('Define Market Params').first().json.broker_id;

// Return normalized leads with broker assignment
return normalizedLeads.map(lead => ({
  json: {
    ...lead,
    assigned_broker_id: brokerId,
    source: 'attom'
  }
}));
```

### Node 9: Upsert Lead (Updated)

**Supabase RPC Call:**

```json
{
  "function": "upsert_lead",
  "parameters": {
    "p_attom_property_id": "={{ $json.attom_property_id }}",
    "p_parcel_number": "={{ $json.parcel_number }}",
    "p_county_fips": "={{ $json.county_fips }}",
    "p_address_line1": "={{ $json.address_line1 }}",
    "p_city": "={{ $json.city }}",
    "p_state": "={{ $json.state }}",
    "p_zip": "={{ $json.zip }}",
    "p_owner_name": "={{ $json.owner_name }}",
    "p_estimated_value": "={{ $json.estimated_value }}",
    "p_equity_percent": "={{ $json.equity_percent }}",
    "p_assigned_broker_id": "={{ $json.assigned_broker_id }}",
    "p_source": "attom"
  }
}
```

---

## Broker Territory Strategy

### ONE Zip at a Time (Critical Change)

**BatchData model (BROKEN):**
- Query all 32 zips at once
- Charged for 10,000+ properties upfront
- Cost: $6,200+

**ATTOM model (CORRECT):**
- Query 1 zip at a time
- Pull 50 properties per page
- Only charged for properties returned
- Cost per zip: ~$0.50-$5.00

### Updated Define Market Params Logic

```javascript
// Process ONE zip code at a time for ATTOM
const territories = $input.all();

if (!territories || territories.length === 0) {
  throw new Error('No active broker territories found');
}

// Group by broker
const brokerMarkets = {};

territories.forEach(t => {
  const key = t.json.broker_id;
  
  if (!brokerMarkets[key]) {
    brokerMarkets[key] = {
      broker_id: t.json.broker_id,
      market_name: t.json.market_name,
      zip_codes: []
    };
  }
  
  brokerMarkets[key].zip_codes.push(t.json.zip_code);
});

const firstBroker = Object.values(brokerMarkets)[0];

// Get the CURRENT zip code to process
// Store progress in bookmark using zip_index
const currentZipIndex = $('Get Bookmark').first().json.zip_index || 0;
const currentZip = firstBroker.zip_codes[currentZipIndex];

return [{
  json: {
    source: 'attom',
    broker_id: firstBroker.broker_id,
    market: firstBroker.market_name,
    current_zip: currentZip,
    zip_index: currentZipIndex,
    total_zips: firstBroker.zip_codes.length,
    query_sig: simpleHash(firstBroker.broker_id + '|' + currentZip)
  }
}];
```

### Updated Bookmark Schema

```sql
-- Add zip_index to track progress through broker territories
ALTER TABLE source_bookmarks
  ADD COLUMN zip_index INTEGER DEFAULT 0;

-- Update get_or_create_bookmark to handle zip rotation
CREATE OR REPLACE FUNCTION get_or_create_bookmark(
  p_source TEXT,
  p_query_sig TEXT
) RETURNS TABLE (
  last_page_fetched INTEGER,
  last_vendor_id TEXT,
  zip_index INTEGER
) AS $$
DECLARE
  v_bookmark RECORD;
BEGIN
  -- Try to find existing bookmark
  SELECT * INTO v_bookmark
  FROM source_bookmarks
  WHERE source = p_source
    AND query_sig = p_query_sig;
  
  IF FOUND THEN
    RETURN QUERY
    SELECT 
      v_bookmark.last_page_fetched,
      v_bookmark.last_vendor_id,
      v_bookmark.zip_index;
  ELSE
    -- Create new bookmark
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
    RETURNING 
      source_bookmarks.last_page_fetched,
      source_bookmarks.last_vendor_id,
      source_bookmarks.zip_index
    INTO v_bookmark;
    
    RETURN QUERY
    SELECT 
      v_bookmark.last_page_fetched,
      v_bookmark.last_vendor_id,
      v_bookmark.zip_index;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

## Implementation Checklist

### Phase 1: Database Setup
- [ ] Run ATTOM schema migration (add attom_property_id column)
- [ ] Create unique indexes
- [ ] Update upsert_lead function
- [ ] Update get_or_create_bookmark function
- [ ] Add zip_index column to source_bookmarks

### Phase 2: ATTOM Account Setup
- [ ] Sign up at [ATTOM Developer Platform](https://api.developer.attomdata.com/)
- [ ] Get API key
- [ ] Test API with 1-2 property lookups
- [ ] Verify cost per lookup
- [ ] Add credits to account

### Phase 3: n8n Workflow Update
- [ ] Replace BatchData node with ATTOM HTTP Request node
- [ ] Update Define Market Params for single-zip processing
- [ ] Update Extract & Normalize code for ATTOM response format
- [ ] Update Upsert Lead to include attom_property_id
- [ ] Test with 1 zip code (50 properties max)
- [ ] Verify cost matches expectations

### Phase 4: Production Deployment
- [ ] Deploy to production n8n
- [ ] Enable for Walter Richards' 32 zip codes
- [ ] Monitor costs and data quality
- [ ] Document any issues

---

## Cost Projections

### Daily Operations

**Single Broker (32 zips):**
- 32 zips × 50 properties/zip = 1,600 properties
- 1,600 × $0.10 = **$160/day**
- Monthly: **$4,800/month**

**Optimized (target 250/day):**
- 250 properties × $0.10 = **$25/day**
- Monthly: **$750/month**

**Strategy:** Pull fewer properties per zip, focus on highest-equity targets

### Comparison vs BatchData

| Metric | ATTOM | BatchData |
|--------|-------|-----------|
| **First query cost** | $5 (50 properties) | $6,200 (all matches) |
| **250 leads/day** | $25/day | $2,000+/day |
| **Monthly (250/day)** | $750/month | $60,000+/month |
| **Scalability** | Linear | Exponential |

---

## Next Steps

1. **Apply database migrations** (see Phase 1 checklist)
2. **Sign up for ATTOM** trial account
3. **Test with 1-2 properties** to verify cost and data format
4. **Update n8n workflow** with new ATTOM nodes
5. **Run pilot with 1 zip code** (50 properties)
6. **Scale to full 32-zip deployment** once validated

---

## Support & Resources

- **ATTOM Documentation:** https://api.developer.attomdata.com/docs
- **ATTOM Support:** datacustomercare@attomdata.com
- **API Status:** Check ATTOM developer dashboard

---

**Migration completed:** [DATE]  
**Estimated cost savings:** $59,250/month vs BatchData  
**Production ready:** Pending Phase 3 completion

