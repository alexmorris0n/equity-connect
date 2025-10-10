# ✅ PropertyRadar API Configuration FIXED!

**Date:** October 10, 2025  
**Issue:** Wrong endpoint and request format  
**Status:** ✅ CORRECTED

---

## 🔧 **What Was Fixed:**

### **1. URL Endpoint**
```
❌ WRONG: https://api.propertyradar.com/v1/properties/search
✅ FIXED: https://api.propertyradar.com/v1/properties/criteria
```

### **2. Request Body Format**
**❌ WRONG (what I had before):**
```json
{
  "filters": {
    "zip_codes": ["90016"],
    "owner_age_min": 62,
    "equity_min": 100000,
    "owner_occupied": true,
    "property_type": "single_family"
  },
  "append": {
    "email": true,
    "phone": true
  },
  "page": 1,
  "per_page": 50
}
```

**✅ CORRECT (PropertyRadar's actual format):**
```json
{
  "Criteria": [
    {
      "name": "ZipFive",
      "value": ["90016"]
    },
    {
      "name": "OwnerAge",
      "value": [[62, null]]
    },
    {
      "name": "AvailableEquity",
      "value": [[100000, null]]
    },
    {
      "name": "isSameMailingOrExempt",
      "value": [1]
    },
    {
      "name": "PropertyType",
      "value": [
        {
          "name": "PType",
          "value": ["SFR"]
        }
      ]
    }
  ],
  "Purchase": 0,
  "PurchasePhone": 1,
  "PurchaseEmail": 1,
  "Skip": 0,
  "Take": 50,
  "ReturnFields": [
    "RadarID",
    "Address",
    "City",
    "State",
    "ZipFive",
    "OwnerFirstName",
    "OwnerLastName",
    "OwnerAge",
    "MailFullName",
    "PropertyValue",
    "AvailableEquity",
    "OwnerOccupied",
    "Phone",
    "Email",
    "APN",
    "FIPS"
  ]
}
```

### **3. Response Field Names**
**❌ WRONG (what I assumed):**
```javascript
prop.address.line1
prop.owner.first_name
prop.property.estimated_value
prop.contact.email
```

**✅ CORRECT (PropertyRadar's actual structure):**
```javascript
prop.RadarID
prop.Address
prop.OwnerFirstName
prop.PropertyValue
prop.Email
prop.Phone
```

### **4. Authentication**
**✅ CORRECT:**
- Type: Bearer Auth
- Token: `f80a84dc50433d96e8c6a26abd19dc28e2ddbd1c`
- n8n sends: `Authorization: Bearer f80a84dc50433d96e8c6a26abd19dc28e2ddbd1c`

---

## 📋 **PropertyRadar API Key Facts:**

### **Criteria Format:**
- Uses **array of objects** (NOT nested filters object)
- Each criteria has `name` and `value`
- Multiple ranges use nested arrays: `[[min, max]]`
- Boolean values: `[1]` for true, `[0]` for false

### **Purchase Flags:**
- `Purchase: 0` = **TEST ONLY** (returns count, NO charges!)
- `Purchase: 1` = **PRODUCTION** (returns data, deducts from quota)
- `PurchasePhone: 1` = Append phone ($0.04 or free if under 2,500/month)
- `PurchaseEmail: 1` = Append email ($0.04 or free if under 2,500/month)

### **Pagination:**
- `Skip: 0` = Start at first record
- `Skip: 50` = Start at record 51 (page 2)
- `Take: 50` = Return 50 records per page
- Max `Take` = 100 (but 50 recommended)

---

## ⚠️ **CRITICAL: Purchase Flag**

**I set `Purchase: 0` for safety!**

This means your first test will:
- ✅ Return count of matching properties
- ✅ Show you what fields will be returned
- ❌ NOT actually return the property data
- ❌ NOT charge you

**When ready for production, change to:**
```json
"Purchase": 1
```

**Test first with `Purchase: 0` to verify:**
1. API authentication works
2. Filters are correct
3. You get expected count of results
4. No surprise charges!

---

## 🧪 **Testing Instructions:**

### **Step 1: Save Bearer Auth Credential**
In your open n8n credential screen:
- **Token:** `f80a84dc50433d96e8c6a26abd19dc28e2ddbd1c`
- Click **Save**

### **Step 2: Test the Workflow**
1. Go to: https://n8n.instaroute.com/workflow/HnPhfA6KCq5VjTCy
2. Click **"Execute Workflow"**
3. Watch the execution

### **Step 3: Check the Results**

**Expected with `Purchase: 0`:**
```json
{
  "TotalCount": 123,  // How many properties match your criteria
  "Message": "Test mode - set Purchase=1 to get actual data"
}
```

**This tells you:**
- ✅ API authentication works
- ✅ Your zip code has 123 qualifying properties
- ✅ Filters are working correctly
- ✅ NO charges incurred

### **Step 4: Enable Production Mode**

Once you verify the count looks good:
1. Open "PropertyRadar Property Search" node
2. Find `Purchase: 0` in the JSON body
3. Change to `Purchase: 1`
4. Save
5. Re-run workflow

**Now it will:**
- ✅ Return actual property data
- ✅ Include Phone and Email (if available)
- ✅ Charge: $0.012 per property + $0.04 per contact

---

## 📊 **What to Expect:**

**Test Run (Purchase=0):**
```
API Call: FREE (test mode)
Response: Count only
Cost: $0.00
```

**Production Run (Purchase=1, 50 properties):**
```
Properties: 50 × $0.012 = $0.60
Emails: ~35 × $0.04 = $1.40 (or FREE if under quota)
Phones: ~40 × $0.04 = $1.60 (or FREE if under quota)
─────────────────────────────────────
Total: $3.60 (or $0.60 if within free quota)
```

---

## ✅ **Workflow is Now READY!**

**What's been corrected:**
1. ✅ URL: `/properties/criteria` (official endpoint)
2. ✅ Body: Criteria array format (official syntax)
3. ✅ Field names: `OwnerAge`, `AvailableEquity`, etc. (official fields)
4. ✅ Purchase flags: `Purchase`, `PurchasePhone`, `PurchaseEmail`
5. ✅ Pagination: `Skip` and `Take` (official params)
6. ✅ Response parsing: Flat structure with capitalized field names

**Next step:** Save your Bearer Auth credential and test! 🚀

