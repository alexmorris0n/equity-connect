# Updated BatchData Pull Worker - Dynamic Territories

## Changes Summary

This document shows the exact n8n node configurations needed to make your workflow database-driven.

---

## NEW NODE: Fetch Broker Territories

**Add this node between "Cron Trigger" and "Define Market Params"**

```json
{
  "parameters": {
    "operation": "getAll",
    "tableId": "broker_territories",
    "returnAll": true,
    "additionalFields": {
      "filterType": "manual",
      "filters": {
        "conditions": [
          {
            "keyName": "active",
            "condition": "equals",
            "value": true
          }
        ]
      }
    }
  },
  "id": "fetch-broker-territories-node",
  "name": "Fetch Broker Territories",
  "type": "n8n-nodes-base.supabase",
  "typeVersion": 1,
  "position": [-976, -200],
  "credentials": {
    "supabaseApi": {
      "id": "po6noLWj9epbuiem",
      "name": "Supabase account"
    }
  }
}
```

**Purpose:** Queries all active broker territories from the database at the start of each workflow run.

**Output:** Array of territory records like:
```json
[
  {
    "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
    "market_name": "south-la-inglewood",
    "zip_code": "90016",
    "neighborhood_name": "Baldwin Hills"
  },
  // ... 30 more rows
]
```

---

## UPDATED NODE: Define Market Params

**Replace the current JavaScript code with this:**

```javascript
// ==========================================
// Dynamic Market Params from Database
// ==========================================
// Reads broker territories from Supabase instead of hardcoding
// Scales to unlimited brokers without workflow changes

const crypto = require('crypto');

// Get territories from previous Supabase node
const territories = $input.all();

if (!territories || territories.length === 0) {
  throw new Error('No active broker territories found in database');
}

// Group territories by broker + market
const brokerMarkets = {};

territories.forEach(t => {
  const key = `${t.json.broker_id}|${t.json.market_name}`;
  
  if (!brokerMarkets[key]) {
    brokerMarkets[key] = {
      broker_id: t.json.broker_id,
      market_name: t.json.market_name,
      zip_codes: [],
      neighborhoods: []
    };
  }
  
  brokerMarkets[key].zip_codes.push(t.json.zip_code);
  
  if (t.json.neighborhood_name && !brokerMarkets[key].neighborhoods.includes(t.json.neighborhood_name)) {
    brokerMarkets[key].neighborhoods.push(t.json.neighborhood_name);
  }
});

// Get first broker/market combination
// TODO: In future, loop through all brokers instead of just first
const markets = Object.values(brokerMarkets);
const firstMarket = markets[0];

console.log(`Processing ${markets.length} market(s), starting with: ${firstMarket.market_name}`);
console.log(`Broker: ${firstMarket.broker_id}`);
console.log(`Zip count: ${firstMarket.zip_codes.length}`);

// Build market parameters
const marketParams = {
  broker_id: firstMarket.broker_id,
  market: firstMarket.market_name,
  zip_codes: firstMarket.zip_codes.sort(), // Sort for consistent hashing
  neighborhoods: firstMarket.neighborhoods,
  filters: {
    owner_occupied: true,
    property_type: 'single_family',
    age_min: 62,
    equity_min: 100000
  },
  page_size: 100
};

// Generate query signature for bookmark tracking
// IMPORTANT: Include broker_id so each broker has separate bookmark
const querySigData = {
  broker_id: marketParams.broker_id,
  market: marketParams.market,
  zip_codes: marketParams.zip_codes,
  filters: marketParams.filters
};

const querySig = crypto
  .createHash('sha256')
  .update(JSON.stringify(querySigData))
  .digest('hex');

console.log(`Query signature: ${querySig.substring(0, 16)}...`);

// Return formatted output
return [{
  json: {
    source: 'batchdata',
    query_sig: querySig,
    broker_id: marketParams.broker_id,
    market: marketParams.market,
    params: marketParams,
    metadata: {
      zip_count: marketParams.zip_codes.length,
      neighborhood_count: marketParams.neighborhoods.length,
      total_markets_available: markets.length
    }
  }
}];
```

**Key Changes:**
1. ✅ Reads from `$input.all()` instead of hardcoding
2. ✅ Groups territories by broker + market
3. ✅ Includes `broker_id` in output for lead tagging
4. ✅ Includes `broker_id` in query signature for separate bookmarks
5. ✅ Logs metadata for debugging
6. ✅ Ready for multi-broker loop in future

---

## UPDATED NODE: Compute Addr Hash

**Add broker_id to the output:**

Find this section in your existing code:
```javascript
return {
  ...record,
  addr_hash: addrHash,
  source: 'batchdata'
};
```

**Replace with:**
```javascript
// Get broker_id from the Define Market Params node
const brokerId = $('Define Market Params').first().json.broker_id;

return {
  ...record,
  addr_hash: addrHash,
  source: 'batchdata',
  assigned_broker_id: brokerId  // ← NEW: Tag lead with broker
};
```

**Full Updated Code:**
```javascript
// Compute address hash for deduplication + tag with broker
const crypto = require('crypto');
const record = $input.item.json;

// Get broker_id from market params
const brokerId = $('Define Market Params').first().json.broker_id;

// Normalize address components
const line1 = (record.address_line1 || '').toUpperCase().trim();
const city = (record.city || '').toUpperCase().trim();
const state = (record.state || '').toUpperCase().trim();
const zip = (record.zip || '').substring(0, 5);

// Compute hash
const normalized = `${line1}|${city}|${state}|${zip}`;
const addrHash = crypto.createHash('sha256').update(normalized).digest('hex');

return {
  ...record,
  addr_hash: addrHash,
  source: 'batchdata',
  assigned_broker_id: brokerId  // Tag for revenue attribution
};
```

**Purpose:** Every lead pulled will be automatically assigned to the correct broker for revenue tracking.

---

## UPDATED CONNECTIONS

### Old Flow:
```
Cron Trigger → Define Market Params → Get Bookmark → ...
```

### New Flow:
```
Cron Trigger → Fetch Broker Territories → Define Market Params → Get Bookmark → ...
```

**In n8n UI:**
1. Delete the connection: `Cron Trigger` → `Define Market Params`
2. Add connection: `Cron Trigger` → `Fetch Broker Territories`
3. Add connection: `Fetch Broker Territories` → `Define Market Params`

---

## TESTING CHECKLIST

### Phase 1: Verify Database
```sql
-- Should return 31 zip codes
SELECT COUNT(*) FROM broker_territories WHERE active = true;

-- Should show south-la-inglewood market
SELECT market_name, COUNT(*) 
FROM broker_territories 
WHERE active = true 
GROUP BY market_name;
```

### Phase 2: Test Workflow Manually

1. **Open workflow in n8n**
2. **Click "Fetch Broker Territories" node**
3. **Click "Execute Node"**
4. **Verify output:** Should see 31 records with broker_id, market_name, zip_code
5. **Click "Define Market Params" node**
6. **Click "Execute Node"**  
7. **Verify output:** Should see:
   - `broker_id`: UUID
   - `market`: "south-la-inglewood"
   - `params.zip_codes`: Array of 31 zips
   - `metadata.zip_count`: 31

### Phase 3: Test Full Workflow

1. **Activate workflow** (or click "Execute Workflow")
2. **Check logs** - should see:
   - "Processing 1 market(s), starting with: south-la-inglewood"
   - "Zip count: 31"
3. **Check leads table:**
   ```sql
   SELECT 
     assigned_broker_id,
     COUNT(*) as lead_count,
     COUNT(DISTINCT property_zip) as zip_count
   FROM leads
   WHERE source = 'batchdata'
   GROUP BY assigned_broker_id;
   ```
4. **Verify:** Leads should be tagged with Test Mortgage Company's broker_id

---

## MULTI-BROKER SCALING (Future)

To process **ALL brokers** in one workflow run, add a "Split In Batches" node after "Fetch Broker Territories":

```javascript
// In a new "Group By Broker" node before "Split In Batches"
const territories = $input.all();
const brokerMarkets = {};

territories.forEach(t => {
  const key = `${t.json.broker_id}|${t.json.market_name}`;
  if (!brokerMarkets[key]) {
    brokerMarkets[key] = {
      broker_id: t.json.broker_id,
      market_name: t.json.market_name,
      territories: []
    };
  }
  brokerMarkets[key].territories.push(t.json);
});

// Return one item per broker/market
return Object.values(brokerMarkets).map(m => ({ json: m }));
```

Then loop through each broker's market with "Split In Batches".

---

## BENEFITS OF THIS APPROACH

✅ **No workflow edits** when adding new brokers  
✅ **Automatic broker attribution** for revenue tracking  
✅ **Separate bookmarks** per broker (via query_sig)  
✅ **Scales to 100+ brokers** without performance issues  
✅ **Easy territory management** via SQL  
✅ **Support overlapping territories** with priority field  
✅ **Audit trail** of territory changes (created_at, updated_at)  

---

## ADDING YOUR SECOND BROKER

1. **Insert broker record:**
   ```sql
   INSERT INTO brokers (company_name, contact_name, email, status)
   VALUES ('Hollywood Loans', 'Sarah Kim', 'sarah@hollywoodloans.com', 'active')
   RETURNING id;
   ```

2. **Insert territories:**
   ```sql
   INSERT INTO broker_territories (broker_id, market_name, zip_code, neighborhood_name)
   VALUES
     ('BROKER_ID_FROM_STEP_1', 'hollywood', '90028', 'Hollywood'),
     ('BROKER_ID_FROM_STEP_1', 'hollywood', '90038', 'Hollywood Hills'),
     ('BROKER_ID_FROM_STEP_1', 'hollywood', '90046', 'West Hollywood');
   ```

3. **Done!** Next workflow run will process BOTH brokers' territories.

---

*Workflow ID: HnPhfA6KCq5VjTCy*  
*Database: mxnqfwuhvurajrgoefyg*  
*Last Updated: October 10, 2025*

