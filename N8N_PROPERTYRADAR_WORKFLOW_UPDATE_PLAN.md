# n8n Workflow Update Plan: PropertyRadar Migration

**Workflow ID:** HnPhfA6KCq5VjTCy  
**Current Name:** "BatchData Pull Worker (Idempotent)"  
**New Name:** "PropertyRadar Pull Worker (Idempotent)"  
**Status:** Currently using ATTOM (BatchData replaced earlier)

---

## 📋 Changes Summary

### **Nodes to Update:**
1. ✏️ **Workflow Name** - Rename to reflect PropertyRadar
2. ✏️ **Define Market Params** - Update query sig to use 'propertyradar' instead of 'attom'
3. 🔄 **ATTOM Property Lookup** → **PropertyRadar Property Search** (MAJOR CHANGE)
4. 🔄 **Extract & Normalize ATTOM** → **Extract & Normalize PropertyRadar** (MAJOR CHANGE)
5. ✏️ **Compute Addr Hash** - Update to handle PropertyRadar data structure
6. ✏️ **Upsert Lead** - Call new `upsert_lead_from_radar` RPC function

### **Nodes to Keep Unchanged:**
- ✅ Cron Trigger
- ✅ Fetch Broker Territories
- ✅ Get Bookmark
- ✅ Select Current Zip
- ✅ Split In Batches
- ✅ Queue for Enrichment
- ✅ Loop Check
- ✅ Record Source Event
- ✅ Advance Bookmark
- ✅ Log Completion

---

## 🔧 Detailed Changes

### **1. Workflow Name**
```
OLD: "BatchData Pull Worker (Idempotent)"
NEW: "PropertyRadar Pull Worker (Idempotent)"
```

---

### **2. Define Market Params Node**

**Change:** Update query signature generation

**OLD Code (line 68):**
```javascript
const querySig = simpleHash(firstBroker.broker_id + '|attom');
```

**NEW Code:**
```javascript
const querySig = simpleHash(firstBroker.broker_id + '|propertyradar');
```

**OLD Return (line 77):**
```javascript
return [{
  json: {
    source: 'attom',
    ...
  }
}];
```

**NEW Return:**
```javascript
return [{
  json: {
    source: 'propertyradar',
    ...
  }
}];
```

---

### **3. ATTOM Property Lookup → PropertyRadar Property Search**

**COMPLETE REPLACEMENT**

**OLD Node:**
- **Type:** n8n-nodes-base.httpRequest
- **Method:** GET
- **URL:** `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/expandedprofile`
- **Headers:** `apikey: 90f712a7f24d63441c9e42386a9f7328`
- **Query Params:**
  - postalcode
  - page
  - pagesize
  - propertyindicator
  - minyearbuilt
  - maxyearbuilt

**NEW Node:**
- **Type:** n8n-nodes-base.httpRequest
- **Method:** POST
- **URL:** `https://api.propertyradar.com/v1/properties/search`
- **Headers:**
  - `Authorization: Bearer {{ $env.PROPERTYRADAR_API_KEY }}`
  - `Content-Type: application/json`
- **Body (JSON):**
```json
{
  "filters": {
    "zip_codes": ["{{ $('Select Current Zip').first().json.current_zip }}"],
    "owner_age_min": 62,
    "equity_min": 100000,
    "owner_occupied": true,
    "property_type": "single_family"
  },
  "append": {
    "email": true,
    "phone": true
  },
  "page": {{ $('Select Current Zip').first().json.page + 1 }},
  "per_page": 50
}
```

---

### **4. Extract & Normalize ATTOM → Extract & Normalize PropertyRadar**

**COMPLETE CODE REPLACEMENT**

**OLD Code:** Extracts ATTOM data structure (prop.address, prop.assessment, etc.)

**NEW Code:**
```javascript
// Extract and normalize PropertyRadar property data
const response = $input.first().json;

// Check if we have results
if (!response.properties || response.properties.length === 0) {
  console.log('No more properties in this zip');
  return [{
    json: {
      stop: true,
      reason: 'no_more_results_in_zip',
      advance_zip: true
    }
  }];
}

const properties = response.properties;
const normalizedLeads = [];

// Get broker ID from earlier node
const brokerId = $('Define Market Params').first().json.broker_id;

properties.forEach(prop => {
  try {
    // Extract PropertyRadar data
    const address = prop.address || {};
    const owner = prop.owner || {};
    const property = prop.property || {};
    const contact = prop.contact || {};
    
    // PropertyRadar already filters by age 62+, equity, and owner-occupied
    // So we can trust all results are qualified
    
    normalizedLeads.push({
      // PropertyRadar ID (primary dedup key)
      radar_id: prop.radar_id,
      radar_property_data: prop, // Store full response
      radar_api_version: 'v1',
      
      // Address
      property_address: address.line1,
      property_city: address.city,
      property_state: address.state,
      property_zip: address.zip,
      
      // Owner info
      first_name: owner.first_name,
      last_name: owner.last_name,
      age: owner.age,
      owner_occupied: owner.owner_occupied,
      
      // Property details
      property_value: property.estimated_value,
      estimated_equity: property.equity,
      
      // Contact info (from PropertyRadar append)
      email: contact.email || null,
      phone: contact.phone || null,
      email_verified: contact.email_confidence === 'high',
      phone_verified: contact.phone_confidence === 'high',
      
      // Skip-trace tier (0 = PropertyRadar)
      skiptrace_tier: (contact.email || contact.phone) ? 0 : null,
      
      // Enrichment metadata
      enrichment_meta: {
        email_confidence: contact.email_confidence,
        phone_confidence: contact.phone_confidence,
        propertyradar_api_version: 'v1'
      },
      
      // Assignment
      assigned_broker_id: brokerId,
      source: 'propertyradar'
    });
    
  } catch (error) {
    console.error('Error processing property:', error.message);
  }
});

console.log(`Normalized ${normalizedLeads.length} PropertyRadar properties (all pre-qualified)`);

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

### **5. Compute Addr Hash Node**

**Change:** Update to use PropertyRadar field names

**OLD Code (lines 16-20):**
```javascript
const line1 = (record.address_line1 || '').toUpperCase().trim();
const city = (record.city || '').toUpperCase().trim();
const state = (record.state || '').toUpperCase().trim();
const zip = (record.zip || '').substring(0, 5);
```

**NEW Code:**
```javascript
const line1 = (record.property_address || '').toUpperCase().trim();
const city = (record.property_city || '').toUpperCase().trim();
const state = (record.property_state || '').toUpperCase().trim();
const zip = (record.property_zip || '').substring(0, 5);
```

**OLD Return (line 28):**
```javascript
return {
  ...record,
  addr_hash: addrHash,
  source: 'batchdata',
  assigned_broker_id: brokerId
};
```

**NEW Return:**
```javascript
return {
  ...record,
  addr_hash: addrHash,
  source: 'propertyradar', // Already set but reinforce
  assigned_broker_id: brokerId // Already set but reinforce
};
```

---

### **6. Upsert Lead Node**

**Change:** Update RPC function name

**OLD:**
```javascript
url: "={{ $env.SUPABASE_URL }}/rest/v1/rpc/upsert_lead"
```

**NEW:**
```javascript
url: "={{ $env.SUPABASE_URL }}/rest/v1/rpc/upsert_lead_from_radar"
```

---

## 🎯 What These Changes Accomplish

### **Before (ATTOM):**
1. ❌ Pulls ALL properties in a zip
2. ❌ Filters client-side for 50%+ equity
3. ❌ No age filtering
4. ❌ No contact data
5. ❌ Cost: ~$0.21/lead after enrichment
6. ❌ Must route ALL leads to PDL/Melissa waterfall

### **After (PropertyRadar):**
1. ✅ Pre-filters at API level (age 62+, equity $100k+, owner-occupied)
2. ✅ Returns ONLY qualified leads
3. ✅ Includes contact data (email/phone) in same call
4. ✅ Cost: ~$0.092/lead (70% enriched at source)
5. ✅ Only 30% need waterfall enrichment

---

## 💰 Cost Impact

**250 leads/day:**
- ATTOM: $52.50/day ($1,575/month)
- PropertyRadar: $24.50/day ($735/month)
- **Savings: $28/day ($840/month - 53% reduction)**

**With 70% contact hit rate:**
- Enriched leads: 175/day
- Waterfall needed: 75/day
- Total enrichment cost: ~$10/day vs ~$25/day with ATTOM

---

## 🔒 Safety Measures

1. ✅ **Backward Compatibility:** 
   - Old dedup keys (mak, attom_property_id) still work
   - `upsert_lead_from_radar` handles all cases

2. ✅ **Idempotency Maintained:**
   - `radar_id` is stable property identifier
   - Bookmark system unchanged
   - Stop-when-known logic preserved

3. ✅ **Fallback Support:**
   - If PropertyRadar fails, workflow stops gracefully
   - Can temporarily revert to ATTOM if needed
   - All database columns support both sources

---

## ✅ Ready to Apply

This plan will be executed via n8n MCP partial update operations.

**Next Step:** Apply these changes to workflow HnPhfA6KCq5VjTCy


