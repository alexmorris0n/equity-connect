# PropertyRadar Node - CORRECT Configuration

Based on official PropertyRadar API documentation: https://developers.propertyradar.com

---

## ✅ **CORRECT API Endpoint:**

**Method:** `POST`  
**URL:** `https://api.propertyradar.com/v1/properties/criteria`

*NOT* `/properties/search` - that endpoint doesn't exist!

---

## ✅ **CORRECT Authentication:**

**Type:** Bearer Auth  
**Token:** `f80a84dc50433d96e8c6a26abd19dc28e2ddbd1c`

n8n will send: `Authorization: Bearer f80a84dc50433d96e8c6a26abd19dc28e2ddbd1c`

---

## ✅ **CORRECT Request Body Format:**

PropertyRadar uses a **Criteria Array** format (NOT filters object!):

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
  "Purchase": 1,
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
    "Email"
  ]
}
```

---

## 📋 **Key PropertyRadar API Parameters:**

### **Criteria Array:**
| Criteria Name | Value Format | What It Does |
|---------------|--------------|--------------|
| `ZipFive` | `["90016"]` | ZIP code filter |
| `OwnerAge` | `[[62, null]]` | Age 62 to infinity |
| `AvailableEquity` | `[[100000, null]]` | $100k+ equity |
| `isSameMailingOrExempt` | `[1]` | Owner-occupied (1=yes, 0=no) |
| `PropertyType` → `PType` | `["SFR"]` | Single Family Residence |

### **Purchase Flags:**
- `Purchase`: 1 = deduct from quota, 0 = test only
- `PurchasePhone`: 1 = append phone ($0.04 or free)
- `PurchaseEmail`: 1 = append email ($0.04 or free)

### **Pagination:**
- `Skip`: Record offset (0 for page 1, 50 for page 2, etc.)
- `Take`: Records per page (max 100, recommended 50)

---

## 🔧 **CORRECTED n8n Node JSON Body:**

```javascript
={{
  JSON.stringify({
    Criteria: [
      {
        name: "ZipFive",
        value: [$('Select Current Zip').first().json.current_zip]
      },
      {
        name: "OwnerAge",
        value: [[62, null]]
      },
      {
        name: "AvailableEquity",
        value: [[100000, null]]
      },
      {
        name: "isSameMailingOrExempt",
        value: [1]
      },
      {
        name: "PropertyType",
        value: [
          {
            name: "PType",
            value: ["SFR"]
          }
        ]
      }
    ],
    Purchase: 0,  // SET TO 0 FOR TESTING! Change to 1 for production
    PurchasePhone: 1,
    PurchaseEmail: 1,
    Skip: $('Select Current Zip').first().json.page * 50,
    Take: 50,
    ReturnFields: [
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
  })
}}
```

---

## ⚠️ **IMPORTANT: Testing vs Production**

**For Testing (First Run):**
```json
"Purchase": 0,  // Returns count only, no charges!
```

**For Production:**
```json
"Purchase": 1,  // Actually returns data and deducts from quota
```

**Always test with `Purchase: 0` first to see how many records will be returned!**

---

## 📝 **What I Need to Update:**

I need to update your PropertyRadar node with:
1. ✅ Correct URL: `/properties/criteria` (not `/properties/search`)
2. ✅ Correct body format: Criteria array (not filters object)
3. ✅ Proper field names: `OwnerAge`, `AvailableEquity`, `ZipFive`, etc.
4. ✅ Purchase flags: `Purchase`, `PurchasePhone`, `PurchaseEmail`
5. ✅ Pagination: `Skip` and `Take` (not `page` and `per_page`)

**Should I update the workflow with the correct PropertyRadar API format now?** 🔧

