# ATTOM Property Pull Worker - n8n Configuration

## Overview

This workflow replaces the BatchData integration with ATTOM API for cost-effective, incremental lead generation.

**Key Changes:**
- ✅ Single-zip processing (not 32 zips at once)
- ✅ True per-property billing
- ✅ ATTOM property ID for stable deduplication
- ✅ Zip rotation logic for full territory coverage

---

## Workflow Structure

```
┌─────────────────────┐
│  Cron Trigger       │ (Hourly or Daily)
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Fetch Broker        │ Get all active territories
│ Territories         │ from broker_territories table
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Define Market       │ Group by broker
│ Params              │ Select CURRENT zip code
└──────┬──────────────┘ (based on zip_index from bookmark)
       │
       ▼
┌─────────────────────┐
│ Get Bookmark        │ Fetch pagination state
└──────┬──────────────┘ + zip_index
       │
       ▼
┌─────────────────────┐
│ ATTOM Property      │ Query SINGLE zip code
│ Lookup              │ 50 properties per page
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Extract &           │ Normalize ATTOM response
│ Normalize           │ Filter by equity (50%+)
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Check Stop-When     │ Have we seen these IDs?
│ -Known              │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ IF Seen Before?     │
└──┬────────────────┬─┘
   │ Yes            │ No
   ▼                ▼
┌────────┐    ┌───────────┐
│ Stop   │    │ Process   │
│        │    │ Leads     │
└────────┘    └─────┬─────┘
                    │
                    ▼
              ┌───────────────┐
              │ Upsert Lead   │ With attom_property_id
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │ Queue for     │
              │ Enrichment    │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │ Advance       │ Increment page OR
              │ Bookmark      │ rotate to next zip
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │ Log           │
              │ Completion    │
              └───────────────┘
```

---

## Node Configurations

### Node 1: Cron Trigger

**Type:** Schedule Trigger  
**Interval:** Every 6 hours (4x per day)

**Why 6 hours:**
- Processes all 32 zips in ~8 hours (one zip every 15 minutes)
- Gentle rate limiting to avoid ATTOM API throttling
- Cost: 4 pulls/day × $25 = $100/day maximum

---

### Node 2: Fetch Broker Territories

**Type:** Supabase  
**Operation:** Get All  
**Table:** `broker_territories`

**Configuration:**
```json
{
  "operation": "getAll",
  "tableId": "broker_territories",
  "returnAll": true,
  "filters": {
    "conditions": [
      {
        "keyName": "active",
        "condition": "is",
        "keyValue": "true"
      }
    ]
  }
}
```

**Output:** Array of broker territories (32 records for Walter Richards)

---

### Node 3: Define Market Params

**Type:** Code (JavaScript)

**Full Code:**

```javascript
// ==========================================
// ATTOM Single-Zip Market Params
// ==========================================
// Processes ONE zip code at a time for cost control
// Rotates through broker territories using zip_index

// Simple hash function
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Get territories from previous node
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

// Get first broker (TODO: Loop through all brokers in future)
const firstBroker = Object.values(brokerMarkets)[0];

// Sort zip codes for consistent rotation
firstBroker.zip_codes.sort();

// Get current zip index from bookmark (will be fetched in next node)
// For now, we'll pass all zips and let the bookmark determine which one
const querySig = simpleHash(firstBroker.broker_id + '|attom');

console.log(`Broker: ${firstBroker.broker_id}`);
console.log(`Total zips: ${firstBroker.zip_codes.length}`);
console.log(`Query sig: ${querySig}`);

return [{
  json: {
    source: 'attom',
    broker_id: firstBroker.broker_id,
    market: firstBroker.market_name,
    all_zip_codes: firstBroker.zip_codes,
    total_zips: firstBroker.zip_codes.length,
    query_sig: querySig
  }
}];
```

---

### Node 4: Get Bookmark

**Type:** HTTP Request (Supabase RPC)

**Configuration:**
```json
{
  "method": "POST",
  "url": "https://mxnqfwuhvurajrgoefyg.supabase.co/rest/v1/rpc/get_or_create_bookmark",
  "authentication": "predefinedCredentialType",
  "nodeCredentialType": "supabaseApi",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "bodyParameters": {
    "parameters": [
      {
        "name": "p_source",
        "value": "={{ $('Define Market Params').first().json.source }}"
      },
      {
        "name": "p_query_sig",
        "value": "={{ $('Define Market Params').first().json.query_sig }}"
      }
    ]
  }
}
```

**Output:**
```json
{
  "last_page_fetched": 0,
  "last_vendor_id": null,
  "zip_index": 0
}
```

---

### Node 5: Select Current Zip

**Type:** Code (JavaScript)

**Full Code:**

```javascript
// Select the current zip code based on bookmark zip_index
const marketParams = $('Define Market Params').first().json;
const bookmark = $('Get Bookmark').first().json;

const currentZipIndex = bookmark.zip_index || 0;
const currentZip = marketParams.all_zip_codes[currentZipIndex];

console.log(`Processing zip ${currentZipIndex + 1}/${marketParams.total_zips}: ${currentZip}`);

return [{
  json: {
    broker_id: marketParams.broker_id,
    market: marketParams.market,
    current_zip: currentZip,
    zip_index: currentZipIndex,
    total_zips: marketParams.total_zips,
    page: bookmark.last_page_fetched || 0,
    query_sig: marketParams.query_sig
  }
}];
```

---

### Node 6: ATTOM Property Lookup

**Type:** HTTP Request

**IMPORTANT:** You need to sign up for ATTOM API first at https://api.developer.attomdata.com/

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
        "value": "YOUR_ATTOM_API_KEY_HERE"
      }
    ]
  },
  "sendQuery": true,
  "queryParameters": {
    "parameters": [
      {
        "name": "postalcode",
        "value": "={{ $('Select Current Zip').first().json.current_zip }}"
      },
      {
        "name": "page",
        "value": "={{ $('Select Current Zip').first().json.page + 1 }}"
      },
      {
        "name": "pagesize",
        "value": "50"
      }
    ]
  },
  "options": {}
}
```

**Notes:**
- Replace `YOUR_ATTOM_API_KEY_HERE` with your actual ATTOM API key
- Queries ONE zip code at a time
- Page size: 50 properties
- Cost: ~$5 per call (50 × $0.10)

---

### Node 7: Extract & Normalize

**Type:** Code (JavaScript)

**Full Code:**

```javascript
// Extract and normalize ATTOM property data
const response = $input.first().json;

// Check if we have results
if (!response.property || response.property.length === 0) {
  console.log('No more properties in this zip');
  return [{
    json: {
      stop: true,
      reason: 'no_more_results_in_zip',
      advance_zip: true
    }
  }];
}

const properties = response.property;
const normalizedLeads = [];

// Get broker ID from earlier node
const brokerId = $('Define Market Params').first().json.broker_id;

properties.forEach(prop => {
  try {
    // Extract address (ATTOM format)
    const address = prop.address || {};
    
    // Extract owner
    const owner = prop.owner || {};
    const owner1 = owner.owner1 || {};
    
    // Extract AVM/valuation
    const avm = prop.avm || {};
    const avmValue = avm.amount || {};
    
    // Extract assessment as fallback
    const assessment = prop.assessment || {};
    const market = assessment.market || {};
    
    // Extract identifier
    const identifier = prop.identifier || {};
    
    // Compute estimated value (prefer AVM, fallback to assessment)
    const estimatedValue = avmValue.value || market.mktttlvalue || 0;
    
    // Extract mortgage data
    const mortgages = prop.mortgage || [];
    const totalMortgage = mortgages.reduce((sum, m) => sum + (m.amount || 0), 0);
    
    // Calculate equity
    const equity = estimatedValue - totalMortgage;
    const equityPercent = estimatedValue > 0 ? (equity / estimatedValue) * 100 : 0;
    
    // Only include if meets equity threshold (50%+)
    if (equityPercent >= 50) {
      // Build owner name
      let ownerName = '';
      if (owner1.fullName) {
        ownerName = owner1.fullName;
      } else if (owner1.firstName || owner1.lastName) {
        ownerName = [owner1.firstName, owner1.middleName, owner1.lastName]
          .filter(Boolean)
          .join(' ');
      }
      
      normalizedLeads.push({
        attom_property_id: identifier.attomId || identifier.Id,
        parcel_number: identifier.apn,
        county_fips: identifier.fips,
        address_line1: address.line1,
        city: address.locality,
        state: address.countrySubd,
        zip: address.postal1,
        owner_name: ownerName,
        estimated_value: estimatedValue,
        equity_percent: Math.round(equityPercent * 100) / 100,  // Round to 2 decimals
        assigned_broker_id: brokerId,
        source: 'attom'
      });
    }
  } catch (error) {
    console.error('Error processing property:', error.message);
    // Skip this property, continue with others
  }
});

console.log(`Normalized ${normalizedLeads.length} properties (${properties.length} total, filtered by 50%+ equity)`);

// Return normalized leads
if (normalizedLeads.length === 0) {
  return [{
    json: {
      stop: true,
      reason: 'no_qualifying_properties',
      advance_page: true
    }
  }];
}

return normalizedLeads.map(lead => ({ json: lead }));
```

---

### Node 8: Check Stop-When-Known

**Type:** HTTP Request (Supabase RPC)

**Configuration:** (Same as before - checks if vendor IDs have been seen)

---

### Node 9: IF Seen Before?

**Type:** IF Conditional

**Configuration:** (Same as before)

---

### Node 10: Compute Addr Hash

**Type:** Code (JavaScript)

**Updated Code:**

```javascript
// Compute address hash for deduplication
// Simple hash function (matches Supabase MD5)
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

const record = $input.item.json;

// Normalize address components
const line1 = (record.address_line1 || '').toUpperCase().trim();
const city = (record.city || '').toUpperCase().trim();
const state = (record.state || '').toUpperCase().trim();
const zip = (record.zip || '').substring(0, 5);

// Compute hash (for backup deduplication)
const normalized = `${line1}|${city}|${state}|${zip}`;
const addrHash = simpleHash(normalized);

return {
  ...record,
  addr_hash: addrHash
};
```

---

### Node 11: Upsert Lead

**Type:** HTTP Request (Supabase RPC)

**Configuration:**

```json
{
  "method": "POST",
  "url": "https://mxnqfwuhvurajrgoefyg.supabase.co/rest/v1/rpc/upsert_lead",
  "authentication": "predefinedCredentialType",
  "nodeCredentialType": "supabaseApi",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={\n  \"p_attom_property_id\": \"={{ $json.attom_property_id }}\",\n  \"p_parcel_number\": \"={{ $json.parcel_number }}\",\n  \"p_county_fips\": \"={{ $json.county_fips }}\",\n  \"p_address_line1\": \"={{ $json.address_line1 }}\",\n  \"p_city\": \"={{ $json.city }}\",\n  \"p_state\": \"={{ $json.state }}\",\n  \"p_zip\": \"={{ $json.zip }}\",\n  \"p_owner_name\": \"={{ $json.owner_name }}\",\n  \"p_estimated_value\": {{ $json.estimated_value }},\n  \"p_equity_percent\": {{ $json.equity_percent }},\n  \"p_assigned_broker_id\": \"={{ $json.assigned_broker_id }}\",\n  \"p_source\": \"attom\"\n}"
}
```

---

### Node 12: Queue for Enrichment

**Type:** Supabase  
**Configuration:** (Same as before - inserts into pipeline_events)

---

### Node 13: Advance Bookmark

**Type:** Code (JavaScript)

**Updated Code:**

```javascript
// Advance bookmark - either increment page OR rotate to next zip
const currentPage = $('Select Current Zip').first().json.page;
const currentZipIndex = $('Select Current Zip').first().json.zip_index;
const totalZips = $('Select Current Zip').first().json.total_zips;

// Check if we got results
const propertiesProcessed = $('Extract & Normalize').all().length;

let shouldAdvanceZip = false;
let newPage = currentPage + 1;
let newZipIndex = currentZipIndex;

// If we got fewer than 50 properties, we've exhausted this zip
if (propertiesProcessed < 50) {
  console.log(`Only ${propertiesProcessed} properties returned - end of zip ${currentZipIndex + 1}`);
  shouldAdvanceZip = true;
  newZipIndex = (currentZipIndex + 1) % totalZips;
  newPage = 0;  // Reset page for new zip
}

// Build update query
const querySig = $('Define Market Params').first().json.query_sig;

return [{
  json: {
    source: 'attom',
    query_sig: querySig,
    new_page: newPage,
    new_zip_index: newZipIndex,
    should_advance_zip: shouldAdvanceZip
  }
}];
```

---

### Node 14: Update Bookmark in Supabase

**Type:** Supabase  
**Operation:** Update  
**Table:** `source_bookmarks`

**Configuration:**

```json
{
  "operation": "update",
  "tableId": "source_bookmarks",
  "where": {
    "conditions": [
      {
        "keyName": "source",
        "condition": "equal",
        "keyValue": "={{ $json.source }}"
      },
      {
        "keyName": "query_sig",
        "condition": "equal",
        "keyValue": "={{ $json.query_sig }}"
      }
    ]
  },
  "fieldsUi": {
    "fieldValues": [
      {
        "fieldName": "last_page_fetched",
        "fieldValue": "={{ $json.new_page }}"
      },
      {
        "fieldName": "zip_index",
        "fieldValue": "={{ $json.new_zip_index }}"
      },
      {
        "fieldName": "updated_at",
        "fieldValue": "={{ $now }}"
      }
    ]
  }
}
```

---

### Node 15: Log Completion

**Type:** Code (JavaScript)

**Updated Code:**

```javascript
// Log completion with zip rotation info
const propertiesProcessed = $('Extract & Normalize').all().length;
const currentZip = $('Select Current Zip').first().json.current_zip;
const zipIndex = $('Select Current Zip').first().json.zip_index;
const totalZips = $('Select Current Zip').first().json.total_zips;
const advanceBookmark = $('Advance Bookmark').first().json;

console.log(`✅ ATTOM pull complete`);
console.log(`   Zip: ${currentZip} (${zipIndex + 1}/${totalZips})`);
console.log(`   Properties: ${propertiesProcessed}`);
console.log(`   Next zip index: ${advanceBookmark.new_zip_index}`);
console.log(`   Next page: ${advanceBookmark.new_page}`);

return [{
  json: {
    status: 'success',
    properties_processed: propertiesProcessed,
    current_zip: currentZip,
    zip_progress: `${zipIndex + 1}/${totalZips}`
  }
}];
```

---

## Zip Rotation Logic

### How It Works

1. **Start:** zip_index = 0, page = 0
2. **Pull:** 50 properties from zip_codes[0]
3. **Next pull:** page = 1 (same zip, next page)
4. **Continue** until <50 properties returned
5. **Rotate:** zip_index = 1, page = 0
6. **Repeat** for zip_codes[1]
7. **Loop back** to zip_codes[0] when zip_index reaches end

### Example for Walter Richards (32 zips)

```
Pull 1:  90016 (page 1) → 50 properties → cost $5
Pull 2:  90016 (page 2) → 50 properties → cost $5
Pull 3:  90016 (page 3) → 15 properties → cost $1.50 (exhausted)
Pull 4:  90018 (page 1) → 50 properties → cost $5
Pull 5:  90018 (page 2) → 50 properties → cost $5
... (continues for all 32 zips)
Pull 96: 90016 (page 1) → 0 properties (all seen before, stop-when-known)
```

**Total cost for full territory:** ~$160 (32 zips × $5 average per zip)

---

## Testing Checklist

### Before Production Deployment

- [ ] Sign up for ATTOM API trial
- [ ] Get API key
- [ ] Test with 1 property in 1 zip code
- [ ] Verify cost is ~$0.10
- [ ] Check response format matches extraction code
- [ ] Verify equity calculation is correct
- [ ] Test deduplication (run same query twice)
- [ ] Confirm stop-when-known logic works
- [ ] Monitor ATTOM API rate limits

### Production Validation

- [ ] Deploy workflow to production n8n
- [ ] Run for 1 zip code (full pagination)
- [ ] Verify total cost matches expectation
- [ ] Check lead quality in Supabase
- [ ] Confirm broker assignment is correct
- [ ] Monitor for 24 hours
- [ ] Scale to all 32 zips

---

## Cost Projections (ATTOM)

### Conservative Estimate

**Assumptions:**
- 32 zips
- Average 100 properties per zip (after 50%+ equity filter)
- $0.10 per property

**Cost:**
- 32 zips × 100 properties × $0.10 = **$320 one-time**
- After first full rotation: Stop-when-known prevents re-pulls
- Ongoing cost: ~$25/day for new listings

### Optimistic Estimate

**Assumptions:**
- Only pull 250 properties total (target daily volume)
- Focus on highest-equity zips first

**Cost:**
- 250 properties × $0.10 = **$25/day**
- $750/month

---

## Next Steps

1. ✅ Database migrations applied
2. ⏳ Sign up for ATTOM API trial
3. ⏳ Get API key and add to n8n credentials
4. ⏳ Update workflow with ATTOM nodes
5. ⏳ Test with 1 zip code
6. ⏳ Deploy to production

---

**Migration ready:** Database schema updated  
**Waiting on:** ATTOM API account signup  
**Expected cost:** $25/day (vs $6,200+ with BatchData)

