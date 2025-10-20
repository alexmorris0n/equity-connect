# Dan Thomas - Broker Setup Guide

**Created:** October 19, 2025  
**Broker:** Dan Thomas (Daniel Thomas)  
**NMLS:** #362053  
**Email:** info@aboutreversemortgage.com  
**Phone:** (650) 292-5744  
**Secondary Phone:** (888) 878-0441  
**Daily Capacity:** 5 leads/day (testing)

---

## 🎯 Setup Checklist

- [ ] **Step 1:** Run broker setup SQL script
- [ ] **Step 2:** Create PropertyRadar list for Dan's territory
- [ ] **Step 3:** Update broker with PropertyRadar list_id
- [ ] **Step 4:** Define and add territory zip codes
- [ ] **Step 5:** Create 3 Instantly campaigns
- [ ] **Step 6:** Link campaigns to database
- [ ] **Step 7:** Test daily lead pull workflow

---

## 📋 Step-by-Step Instructions

### **STEP 1: Create Broker Record**

Run this script in your Supabase SQL editor:

```bash
scripts/setup-dan-thomas-broker.sql
```

**What it does:**
- Creates broker record with Dan's info
- Sets daily capacity to 5 leads
- Adds necessary columns if they don't exist
- Returns broker_id (SAVE THIS!)

**Expected Output:**
```
broker_id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
company_name: About Reverse Mortgage
contact_name: Dan Thomas
nmls_number: 362053
email: info@aboutreversemortgage.com
phone: (650) 292-5744
daily_capacity: 5
```

---

### **STEP 2: Create PropertyRadar List**

1. Log into PropertyRadar
2. Navigate to Lists
3. Create new list: "Dan Thomas - Reverse Mortgage Leads"
4. Add search criteria:
   - **Age:** 62+ (at least one owner)
   - **Property Type:** Single Family Residence
   - **Owner Occupied:** Yes
   - **Equity:** $100,000+ minimum
   - **Territory:** (Add Dan's zip codes in Step 4)
5. Save the list
6. Copy the `list_id` from the URL:
   ```
   https://app.propertyradar.com/lists/YOUR_LIST_ID_HERE
   ```

---

### **STEP 3: Update Broker with List ID**

```sql
UPDATE brokers 
SET list_id = 'YOUR_LIST_ID_FROM_PROPERTYRADAR'
WHERE nmls_number = '362053';

-- Verify
SELECT id, contact_name, list_id, daily_capacity
FROM brokers
WHERE nmls_number = '362053';
```

---

### **STEP 4: Add Territory Zip Codes**

**Planning Phase:**
- Dan's phone area code (650) suggests Bay Area Peninsula
- Need to confirm with Dan which specific areas he wants to target
- Start with 10-20 zip codes for testing

**Once territories are decided:**

1. Open the template:
   ```bash
   scripts/add-dan-thomas-territories.sql
   ```

2. Replace `PASTE_DAN_BROKER_ID_HERE` with Dan's actual broker_id

3. Add Dan's zip codes (example):
   ```sql
   INSERT INTO broker_territories (broker_id, market_name, zip_code, neighborhood_name, priority, active)
   VALUES
     ('DAN_BROKER_ID', 'peninsula-south-bay', '94002', 'Belmont', 1, true),
     ('DAN_BROKER_ID', 'peninsula-south-bay', '94010', 'Burlingame', 1, true),
     ('DAN_BROKER_ID', 'peninsula-south-bay', '94025', 'Menlo Park', 1, true),
     ('DAN_BROKER_ID', 'peninsula-south-bay', '94301', 'Palo Alto', 1, true),
     ('DAN_BROKER_ID', 'peninsula-south-bay', '94401', 'San Mateo', 1, true);
   ```

4. Run the script

5. Verify territories loaded:
   ```sql
   SELECT 
     b.company_name,
     bt.market_name,
     COUNT(DISTINCT bt.zip_code) as zip_count,
     array_agg(bt.zip_code ORDER BY bt.zip_code) as zip_codes
   FROM broker_territories bt
   JOIN brokers b ON bt.broker_id = b.id
   WHERE b.nmls_number = '362053'
     AND bt.active = true
   GROUP BY b.company_name, bt.market_name;
   ```

---

### **STEP 5: Create Instantly Campaigns**

Dan needs **3 email campaigns** in Instantly (one for each archetype):

#### **Campaign 1: Cash Unlocked**
- **Name:** `Dan Thomas - Cash Unlocked`
- **Target:** Debt-free homeowners (no mortgage)
- **Angle:** Access your home equity without selling or payments
- **Warmup:** 5 days
- **Daily Send Limit:** 10-15 during testing

#### **Campaign 2: High Equity Special**  
- **Name:** `Dan Thomas - High Equity Special`
- **Target:** 75%+ equity with small remaining mortgage
- **Angle:** Eliminate mortgage payment, access equity
- **Warmup:** 5 days
- **Daily Send Limit:** 10-15 during testing

#### **Campaign 3: No More Payments**
- **Name:** `Dan Thomas - No More Payments`
- **Target:** Active mortgage, moderate equity
- **Angle:** Stop monthly mortgage payments, increase cash flow
- **Warmup:** 5 days
- **Daily Send Limit:** 10-15 during testing

**Email Sequences:**
- Use the templates from `templates/email/`
- Personalize with Dan's name, NMLS, and contact info
- 4-email sequence for each campaign
- Include merge fields for property-specific data

**IMPORTANT:** Save the Instantly campaign IDs for Step 6

---

### **STEP 6: Link Campaigns to Database**

Once Instantly campaigns are created, link them in Supabase:

```sql
-- Get Dan's broker_id if you don't have it
SELECT id FROM brokers WHERE nmls_number = '362053';

-- Insert campaign mappings
INSERT INTO campaigns (archetype, instantly_campaign_id, broker_id, active)
VALUES 
  ('cash_unlocked', 'INSTANTLY_CAMPAIGN_ID_1', 'DAN_BROKER_ID_HERE', true),
  ('high_equity_special', 'INSTANTLY_CAMPAIGN_ID_2', 'DAN_BROKER_ID_HERE', true),
  ('no_more_payments', 'INSTANTLY_CAMPAIGN_ID_3', 'DAN_BROKER_ID_HERE', true);

-- Verify campaigns
SELECT 
  c.archetype,
  c.instantly_campaign_id,
  c.active,
  b.contact_name as broker_name
FROM campaigns c
JOIN brokers b ON c.broker_id = b.id
WHERE b.nmls_number = '362053';
```

---

### **STEP 7: Test Daily Lead Pull**

**In n8n:**

1. Open the "Daily Lead Pull" workflow
2. Find the Manual Trigger or Test node
3. Set test parameters:
   ```json
   {
     "broker_id": "DAN_BROKER_ID_FROM_STEP_1",
     "broker_name": "Dan Thomas",
     "broker_nmls": "362053",
     "daily_capacity": 5,
     "daily_lead_surplus": 0,
     "list_id": "YOUR_PROPERTYRADAR_LIST_ID",
     "current_offset": 0
   }
   ```
4. Run the workflow manually
5. Monitor execution:
   - Should pull properties from PropertyRadar
   - Filter for new leads
   - Skip trace contacts
   - Insert to database
   - Upload to appropriate Instantly campaigns
   - Update broker surplus

**Expected Results:**
- First run: 5-7 properties pulled (accounting for 80% skip-trace success rate)
- Properties inserted into `leads` table
- Leads uploaded to Instantly campaigns based on archetype
- Broker `current_offset` updated for next run

---

## 🔍 Monitoring & Verification

### **Check Lead Generation**

```sql
-- Today's leads for Dan
SELECT 
  id,
  first_name,
  last_name,
  primary_email,
  property_city,
  property_value,
  estimated_equity,
  campaign_archetype,
  campaign_status,
  created_at
FROM leads
WHERE assigned_broker_id = 'DAN_BROKER_ID'
  AND created_at AT TIME ZONE 'America/Los_Angeles' >= 
      (CURRENT_DATE AT TIME ZONE 'America/Los_Angeles')::timestamp
ORDER BY created_at DESC;
```

### **Check Campaign Distribution**

```sql
-- Lead distribution by archetype
SELECT 
  campaign_archetype,
  COUNT(*) as lead_count,
  COUNT(CASE WHEN campaign_status = 'active' THEN 1 END) as in_campaign
FROM leads
WHERE assigned_broker_id = 'DAN_BROKER_ID'
GROUP BY campaign_archetype;
```

### **Check Daily Performance**

```sql
-- Daily stats for Dan
SELECT 
  DATE(created_at AT TIME ZONE 'America/Los_Angeles') as date,
  COUNT(*) as leads_generated,
  COUNT(CASE WHEN primary_email IS NOT NULL THEN 1 END) as with_email,
  COUNT(CASE WHEN campaign_status = 'active' THEN 1 END) as added_to_campaign
FROM leads
WHERE assigned_broker_id = 'DAN_BROKER_ID'
GROUP BY DATE(created_at AT TIME ZONE 'America/Los_Angeles')
ORDER BY date DESC
LIMIT 7;
```

---

## 🚨 Troubleshooting

### **Issue: No leads generated**
- **Check:** PropertyRadar list has records
- **Check:** Territory zip codes are loaded
- **Check:** `current_offset` isn't past the end of the list
- **Fix:** Reset offset: `UPDATE brokers SET current_offset = 0 WHERE nmls_number = '362053';`

### **Issue: Leads not uploading to Instantly**
- **Check:** Campaign IDs are correct in `campaigns` table
- **Check:** Leads have `primary_email` populated
- **Check:** Instantly API credentials are valid
- **Fix:** Check n8n workflow execution logs

### **Issue: Wrong campaign archetype**
- **Check:** Property equity calculations
- **Check:** Campaign archetype logic in DailyLeadPullPrompt
- **Fix:** Review archetype assignment in Step 7 of DailyLeadPullPrompt

---

## 📊 Dan's Profile Summary

| Field | Value |
|-------|-------|
| **Broker ID** | _(Set after Step 1)_ |
| **Company** | About Reverse Mortgage |
| **NMLS** | 362053 |
| **Email** | info@aboutreversemortgage.com |
| **Phone** | (650) 292-5744 |
| **Secondary Phone** | (888) 878-0441 |
| **Daily Capacity** | 5 leads |
| **Weekly Capacity** | 35 leads |
| **Pricing Model** | Performance Based |
| **Status** | Active (Testing) |
| **Territory** | _(To be defined)_ |
| **PropertyRadar List** | _(To be created)_ |

---

## 📝 Notes

- **Testing Phase:** Dan is starting with 5 leads/day to test the system
- **Scale Up:** Once proven, can increase to 10-20 leads/day
- **Territory:** Focus on Bay Area Peninsula (650 area code)
- **Compliance:** Ensure all campaigns include proper disclosures and opt-out
- **Follow-up:** Monitor reply rates and adjust email copy as needed

---

## 🎯 Success Metrics (First 30 Days)

- [ ] **5 leads/day** consistently generated
- [ ] **80%+ email delivery** rate
- [ ] **15-20% open** rate on first email
- [ ] **5-10% reply** rate across sequence
- [ ] **1-2 qualified** appointments set per week

---

**Last Updated:** October 19, 2025  
**Status:** Ready for implementation  
**Next Review:** After first 100 leads generated

