# Broker Territory Scaling Implementation

## 🎯 Problem Solved

**Before:** Zip codes were hardcoded in the n8n workflow. Adding a new broker required:
- Manually editing workflow code
- Copying/pasting zip codes
- Risk of errors
- No attribution/tracking

**After:** Zip codes are managed in the database. Adding a new broker requires:
- Insert broker record (1 SQL query)
- Insert territory zip codes (1 SQL query)
- **Zero workflow changes** ✅

---

## ✅ What's Been Completed

### 1. Database Schema ✅

Created `broker_territories` table:
```sql
CREATE TABLE broker_territories (
  id UUID PRIMARY KEY,
  broker_id UUID REFERENCES brokers(id),
  market_name TEXT,
  zip_code TEXT,
  neighborhood_name TEXT,
  priority INT DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Features:**
- ✅ Links brokers to their zip codes
- ✅ Supports multiple markets per broker
- ✅ Neighborhood tracking for microsites
- ✅ Priority field for overlapping territories
- ✅ Active/inactive toggle without deleting data
- ✅ Indexes for fast lookups
- ✅ Unique constraint prevents duplicate broker+zip combos

### 2. First Broker Loaded ✅

**Test Mortgage Company (John Doe)**
- Broker ID: `6a3c5ed5-664a-4e13-b019-99fe8db74174`
- Market: `south-la-inglewood`
- **31 zip codes** covering:
  - Baldwin Hills, Inglewood, Compton
  - South LA, Gardena, Hawthorne, Watts
  - And 20 more neighborhoods

**Verify:**
```sql
SELECT 
  b.company_name,
  COUNT(bt.zip_code) as zips,
  array_agg(bt.zip_code ORDER BY bt.zip_code) as zip_list
FROM brokers b
JOIN broker_territories bt ON bt.broker_id = b.id
WHERE bt.active = true
GROUP BY b.company_name;
```

### 3. Documentation Created ✅

| File | Purpose |
|------|---------|
| `docs/BROKER_TERRITORY_SCALING_GUIDE.md` | Complete guide with architecture, benefits, SQL queries |
| `config/add-broker-territory-template.sql` | SQL templates for adding new brokers quickly |
| `workflows/UPDATED-batchdata-pull-worker-dynamic.md` | Exact n8n node code to make workflow dynamic |
| `BROKER_SCALING_IMPLEMENTATION.md` | This summary document |

---

## ⏳ What Needs to Be Done

### Update n8n Workflow

**Current State:** Workflow hardcodes zips in "Define Market Params" node  
**Target State:** Workflow queries database dynamically

**Three simple steps:**

#### Step 1: Add Supabase Query Node
- **Node Name:** "Fetch Broker Territories"
- **Type:** Supabase → Get All
- **Table:** broker_territories
- **Filter:** active = true
- **Position:** After "Cron Trigger"

#### Step 2: Update "Define Market Params" Node
Replace current JavaScript with the code from:
`workflows/UPDATED-batchdata-pull-worker-dynamic.md`

Key changes:
- Read territories from `$input.all()` instead of hardcoding
- Group by broker_id + market_name
- Include broker_id in output
- Include broker_id in query signature

#### Step 3: Update "Compute Addr Hash" Node
Add this line to tag leads with broker:
```javascript
assigned_broker_id: $('Define Market Params').first().json.broker_id
```

**Detailed instructions in:** `workflows/UPDATED-batchdata-pull-worker-dynamic.md`

---

## 🚀 How to Add Your Second Broker

### Example: Adding "Hollywood Home Loans"

**Step 1: Insert Broker**
```sql
INSERT INTO brokers (company_name, contact_name, email, phone, status)
VALUES ('Hollywood Home Loans', 'Sarah Kim', 'sarah@hollywoodloans.com', '(323) 555-1234', 'active')
RETURNING id;
```

**Step 2: Copy the returned ID** (e.g., `abc-123-def-456`)

**Step 3: Insert Territories**
```sql
INSERT INTO broker_territories (broker_id, market_name, zip_code, neighborhood_name)
VALUES
  ('abc-123-def-456', 'hollywood', '90028', 'Hollywood'),
  ('abc-123-def-456', 'hollywood', '90038', 'Hollywood Hills'),
  ('abc-123-def-456', 'hollywood', '90046', 'West Hollywood'),
  ('abc-123-def-456', 'hollywood', '90068', 'Hollywood Hills East');
```

**Step 4: Verify**
```sql
SELECT 
  b.company_name,
  bt.market_name,
  COUNT(*) as zip_count
FROM brokers b
JOIN broker_territories bt ON bt.broker_id = b.id
WHERE bt.active = true
GROUP BY b.company_name, bt.market_name;
```

**Result:**
```
company_name              | market_name         | zip_count
--------------------------|---------------------|----------
Test Mortgage Company     | south-la-inglewood  | 31
Hollywood Home Loans      | hollywood           | 4
```

**Step 5: Run Workflow**
The workflow will now pull data for BOTH brokers automatically! 🎉

---

## 📊 Revenue Attribution

With broker_id tracked on every lead, you can now:

### 1. Leads Per Broker
```sql
SELECT 
  b.company_name,
  COUNT(l.id) as total_leads,
  COUNT(CASE WHEN l.status = 'contacted' THEN 1 END) as contacted,
  COUNT(CASE WHEN l.status = 'appointment_set' THEN 1 END) as appointments,
  COUNT(CASE WHEN l.status = 'funded' THEN 1 END) as funded
FROM brokers b
LEFT JOIN leads l ON l.assigned_broker_id = b.id
GROUP BY b.company_name;
```

### 2. Revenue Per Broker
```sql
SELECT 
  b.company_name,
  COUNT(DISTINCT l.id) as leads,
  SUM(CASE WHEN be.event_type = 'deal_funded' THEN be.amount ELSE 0 END) as total_revenue,
  AVG(b.performance_score) as avg_performance
FROM brokers b
LEFT JOIN leads l ON l.assigned_broker_id = b.id
LEFT JOIN billing_events be ON be.broker_id = b.id AND be.status = 'paid'
GROUP BY b.company_name
ORDER BY total_revenue DESC;
```

### 3. Territory Performance
```sql
SELECT 
  bt.market_name,
  bt.neighborhood_name,
  COUNT(DISTINCT l.id) as leads,
  AVG(l.lead_score) as avg_lead_score,
  COUNT(CASE WHEN l.status = 'funded' THEN 1 END) as funded_deals
FROM broker_territories bt
LEFT JOIN leads l ON l.property_zip = bt.zip_code
WHERE bt.active = true
GROUP BY bt.market_name, bt.neighborhood_name
ORDER BY leads DESC;
```

---

## 🔧 Territory Management

### Deactivate a Territory (Temporary Pause)
```sql
UPDATE broker_territories
SET active = false
WHERE broker_id = 'BROKER_ID' AND zip_code = '90028';
```

### Reactivate a Territory
```sql
UPDATE broker_territories
SET active = true
WHERE broker_id = 'BROKER_ID' AND zip_code = '90028';
```

### Transfer Territory to Another Broker
```sql
UPDATE broker_territories
SET broker_id = 'NEW_BROKER_ID'
WHERE broker_id = 'OLD_BROKER_ID' AND market_name = 'hollywood';
```

### View Overlapping Territories
```sql
SELECT 
  bt.zip_code,
  array_agg(b.company_name) as brokers,
  COUNT(*) as broker_count
FROM broker_territories bt
JOIN brokers b ON b.id = bt.broker_id
WHERE bt.active = true
GROUP BY bt.zip_code
HAVING COUNT(*) > 1;
```

### Handle Territory Conflicts with Priority
```sql
-- Set priority (lower number = higher priority)
UPDATE broker_territories
SET priority = 1
WHERE broker_id = 'PREFERRED_BROKER' AND zip_code = '90028';

UPDATE broker_territories
SET priority = 2
WHERE broker_id = 'BACKUP_BROKER' AND zip_code = '90028';

-- Query to get preferred broker per zip
SELECT DISTINCT ON (zip_code)
  zip_code,
  broker_id,
  market_name,
  priority
FROM broker_territories
WHERE active = true
ORDER BY zip_code, priority ASC;
```

---

## 📈 Scaling to 100+ Brokers

### Current: Sequential Processing
Workflow processes **one broker** per run. Simple and reliable.

**Throughput:** If each broker takes 2 minutes to process:
- 1 broker = 2 minutes
- 10 brokers = 20 minutes
- 100 brokers = 200 minutes (3.3 hours)

### Future: Parallel Processing

Add a "Split In Batches" loop to process **all brokers** in one run:

```
Fetch Broker Territories
  ↓
Group By Broker + Market
  ↓
Split In Batches (loop through each broker)
  ↓
Define Market Params (for current broker)
  ↓
BatchData AI Agent
  ↓
Process Leads
  ↓
Loop back to next broker
```

**Benefits:**
- Process 100 brokers in one workflow run
- Centralized error handling
- Single cron trigger for all brokers
- Parallel execution if needed

**Detailed implementation guide coming soon!**

---

## 🎯 Success Metrics

### Database
- [x] broker_territories table created
- [x] Indexes created
- [x] RLS policies enabled
- [x] First broker loaded with 31 zips

### Workflow
- [ ] "Fetch Broker Territories" node added
- [ ] "Define Market Params" updated to read from DB
- [ ] "Compute Addr Hash" updated to tag broker_id
- [ ] Workflow connections updated
- [ ] Test run successful with first broker

### Testing
- [ ] Manual node execution verified
- [ ] Full workflow execution verified
- [ ] Leads tagged with correct broker_id
- [ ] Second broker added and tested
- [ ] Revenue attribution queries working

---

## 📝 Quick Reference

| Task | File/Location |
|------|---------------|
| Full architecture guide | `docs/BROKER_TERRITORY_SCALING_GUIDE.md` |
| SQL templates | `config/add-broker-territory-template.sql` |
| Workflow node code | `workflows/UPDATED-batchdata-pull-worker-dynamic.md` |
| n8n workflow | https://n8n.instaroute.com/workflow/HnPhfA6KCq5VjTCy |
| Supabase database | https://supabase.com/dashboard/project/mxnqfwuhvurajrgoefyg |

| SQL Query | Purpose |
|-----------|---------|
| `SELECT * FROM broker_territories WHERE active = true;` | View all active territories |
| `SELECT * FROM brokers;` | View all brokers |
| `SELECT assigned_broker_id, COUNT(*) FROM leads GROUP BY 1;` | Leads per broker |

---

## 🚦 Next Steps

1. **Verify database setup** (already complete ✅)
2. **Update n8n workflow** (follow guide in `workflows/UPDATED-batchdata-pull-worker-dynamic.md`)
3. **Test with first broker** (Test Mortgage Company)
4. **Add second broker** (use template in `config/add-broker-territory-template.sql`)
5. **Test with multiple brokers**
6. **Enable parallel processing** (future enhancement)

---

## 🆘 Support

If you encounter issues:

1. **Check database:**
   ```sql
   SELECT COUNT(*) FROM broker_territories WHERE active = true;
   ```
   Should return 31 for first broker.

2. **Test workflow node by node:**
   - Execute "Fetch Broker Territories" → should return 31 records
   - Execute "Define Market Params" → should show 31 zips in output

3. **Check logs:**
   - Look for "Processing X market(s)" message
   - Verify broker_id appears in logs

4. **Review documentation:**
   - All guides are in the `/docs` and `/workflows` folders
   - SQL templates in `/config` folder

---

**Status:** Database setup complete ✅ | Workflow update pending ⏳  
**Last Updated:** October 10, 2025  
**Project:** Equity Connect - Broker Territory Management

