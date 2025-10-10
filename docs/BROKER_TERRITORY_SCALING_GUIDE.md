# Broker Territory Scaling Guide

## ✅ COMPLETED: Database Setup

### 1. Created `broker_territories` Table

```sql
CREATE TABLE broker_territories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  market_name TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  neighborhood_name TEXT,
  priority INT DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes Created:**
- `idx_broker_territories_broker_id` - Fast broker lookup
- `idx_broker_territories_zip` - Fast zip code lookup  
- `idx_broker_territories_active` - Filter active territories
- `idx_broker_territories_unique` - Prevent duplicate broker+zip combos

### 2. Loaded First Broker Territory

✅ **Test Mortgage Company (John Doe)**
- Market: `south-la-inglewood`
- **31 zip codes** across **26 neighborhoods**
- Covers: Inglewood, Compton, South LA, Gardena, Hawthorne, Watts, and more

---

## 🔄 NEXT: Update n8n Workflow to be Dynamic

### Current Problem
Your workflow hardcodes zip codes in the "Define Market Params" node. This doesn't scale.

### Solution: Query Database for Territories

#### **Step 1: Add Supabase Query Node**

Add a new node **BEFORE** "Define Market Params":

**Node Name:** `Fetch Broker Territories`  
**Node Type:** Supabase  
**Operation:** Get All  
**Table:** `broker_territories`  
**Filters:** `active = true`

**Position:** Right after "Cron Trigger"

#### **Step 2: Update "Define Market Params" Code**

Replace the current code with this **database-driven version**:

```javascript
// Dynamic market params from Supabase broker_territories
const crypto = require('crypto');

// Get broker territories from previous Supabase node
const territories = $input.all();

if (!territories || territories.length === 0) {
  throw new Error('No active broker territories found in database');
}

// Group by broker and market
const brokerMarkets = {};
territories.forEach(t => {
  const key = `${t.json.broker_id}|${t.json.market_name}`;
  if (!brokerMarkets[key]) {
    brokerMarkets[key] = {
      broker_id: t.json.broker_id,
      market: t.json.market_name,
      zip_codes: []
    };
  }
  brokerMarkets[key].zip_codes.push(t.json.zip_code);
});

// For now, process first broker/market (later: loop through all)
const firstMarket = Object.values(brokerMarkets)[0];

const marketParams = {
  broker_id: firstMarket.broker_id,
  market: firstMarket.market,
  zip_codes: firstMarket.zip_codes.sort(),
  filters: {
    owner_occupied: true,
    property_type: 'single_family',
    age_min: 62,
    equity_min: 100000
  },
  page_size: 100
};

// Query sig for bookmark tracking (includes broker_id)
const querySigData = {
  broker_id: marketParams.broker_id,
  zip_codes: marketParams.zip_codes,
  filters: marketParams.filters
};
const querySig = crypto.createHash('sha256').update(JSON.stringify(querySigData)).digest('hex');

return [{json: {
  source: 'batchdata',
  query_sig: querySig,
  broker_id: marketParams.broker_id,
  market: marketParams.market,
  params: marketParams
}}];
```

#### **Step 3: Update Workflow Connections**

**OLD Flow:**
```
Cron Trigger → Define Market Params → Get Bookmark → ...
```

**NEW Flow:**
```
Cron Trigger → Fetch Broker Territories → Define Market Params → Get Bookmark → ...
```

#### **Step 4: Tag Leads with Broker ID**

Update the "Compute Addr Hash" node to include `broker_id`:

```javascript
const crypto = require('crypto');
const record = $input.item.json;
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
  assigned_broker_id: brokerId  // ← NEW: Tag with broker
};
```

---

## 📈 FUTURE: Multi-Broker Scaling

### Option A: Sequential Processing (Current)
Process one broker at a time per workflow run. Simple and reliable.

### Option B: Parallel Processing (Advanced)
Use a "Split In Batches" node to loop through all brokers:

```
Fetch Broker Territories 
  → Group By Broker 
  → Split In Batches (by broker)
  → Define Market Params (per broker)
  → BatchData AI Agent
  → Loop back
```

This would pull data for ALL brokers in one workflow run.

---

## 🎯 Adding New Brokers

### 1. Insert Broker Record

```sql
INSERT INTO brokers (company_name, contact_name, email, status)
VALUES ('ABC Mortgage', 'Jane Smith', 'jane@abc.com', 'active')
RETURNING id;
```

### 2. Insert Territory Zip Codes

```sql
-- Replace BROKER_ID_HERE with the UUID from step 1
INSERT INTO broker_territories (broker_id, market_name, zip_code, neighborhood_name)
VALUES
  ('BROKER_ID_HERE', 'hollywood', '90028', 'Hollywood'),
  ('BROKER_ID_HERE', 'hollywood', '90038', 'Hollywood Hills'),
  ('BROKER_ID_HERE', 'hollywood', '90046', 'West Hollywood');
```

### 3. Done!

The workflow will **automatically** pull data for the new broker on the next run. No workflow edits needed!

---

## 💰 Revenue Attribution

With `broker_id` now tracked on leads, you can:

```sql
-- Revenue per broker
SELECT 
  b.company_name,
  COUNT(l.id) as lead_count,
  COUNT(CASE WHEN l.status = 'funded' THEN 1 END) as funded_count,
  SUM(be.amount) as total_revenue
FROM brokers b
LEFT JOIN leads l ON l.assigned_broker_id = b.id
LEFT JOIN billing_events be ON be.broker_id = b.id AND be.status = 'paid'
GROUP BY b.company_name;
```

---

## 🔍 Verify Current Setup

```sql
-- Check loaded territories
SELECT 
  b.company_name,
  bt.market_name,
  COUNT(DISTINCT bt.zip_code) as zip_count,
  array_agg(bt.zip_code ORDER BY bt.zip_code) as zips
FROM broker_territories bt
JOIN brokers b ON bt.broker_id = b.id
WHERE bt.active = true
GROUP BY b.company_name, bt.market_name;
```

**Current Result:**
- ✅ Test Mortgage Company
- ✅ south-la-inglewood market
- ✅ 31 zip codes loaded

---

## 📝 Summary of Changes

### Database
- ✅ Created `broker_territories` table
- ✅ Loaded 31 zip codes for first broker
- ✅ Added indexes for performance
- ✅ Set up RLS policies

### Workflow (To Do)
- ⏳ Add "Fetch Broker Territories" Supabase node
- ⏳ Update "Define Market Params" to read from database
- ⏳ Update "Compute Addr Hash" to tag leads with `broker_id`
- ⏳ Test with first broker territory

### Benefits
- ✅ Add brokers via SQL (no workflow edits)
- ✅ Scale to 100+ brokers easily
- ✅ Revenue attribution per broker
- ✅ Territory overlap management with priority
- ✅ Easy to reassign/update territories
- ✅ Can deactivate territories without deleting data

---

## 🚀 Next Steps

1. **Test Current Workflow:** Run it with hardcoded zips to confirm it works
2. **Update Workflow:** Apply the changes from Step 2 above
3. **Test Dynamic Version:** Run with database-driven territories
4. **Add Second Broker:** Test with multiple brokers
5. **Enable Parallel Processing:** Loop through all brokers in one run

---

*Generated: October 10, 2025*
*Database: mxnqfwuhvurajrgoefyg*
*Workflow: HnPhfA6KCq5VjTCy*

