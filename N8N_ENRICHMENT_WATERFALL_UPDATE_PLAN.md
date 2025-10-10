# n8n Enrichment Waterfall Update Plan

**Workflow ID:** Fjx1BYwrVsqHdNjK  
**Current Name:** "Enrichment Pipeline (BatchData → Melissa Waterfall)"  
**New Name:** "Enrichment Pipeline (PropertyRadar → PDL → Melissa Waterfall)"

---

## 📋 Current Flow (BatchData → Melissa)

```
Every 5 Minutes
  → Get Pending Enrichments (pipeline_events)
  → Split Events
  → Get Lead
  → BatchData Skip-Trace (Stage 1) ← AI AGENT
      ├─ Groq Chat Model
      └─ BatchData MCP Tool
  → Parse BatchData
  → Has Contact?
      ├─ YES → Update (Stage 1) → Done
      └─ NO → Prep Melissa
          → Melissa (Stage 2)
          → Parse Melissa
          → Update (Stage 2)
  → Prep Suppression
  → Upsert Suppression
  → Compute Score
  → Mark Complete
```

**Problem:** Still uses BatchData AI Agent for Tier-1 enrichment!

---

## 🎯 New Flow (PropertyRadar → PDL → Melissa)

```
Every 5 Minutes
  → Get Pending Enrichments (pipeline_events)
  → Split Events
  → Get Lead
  → Check PropertyRadar Contact? ← NEW CONDITIONAL
      ├─ Has Email/Phone from PropertyRadar (skiptrace_tier = 0)?
      │  └─ YES → Skip enrichment, go to Compute Score (70% of leads)
      │
      └─ NO → Needs enrichment (30% of leads) ↓
          → PDL Person Enrich (Tier-1) ← REPLACE BATCHDATA
          → Parse PDL Response
          → Has Contact from PDL?
              ├─ YES → Update (Tier 1) → Done
              └─ NO → Melissa (Tier-2)
                  → Parse Melissa
                  → Update (Tier 2)
  → Prep Suppression
  → Upsert Suppression
  → Compute Score
  → Mark Complete
```

---

## 🔧 Required Changes

### **1. Update Workflow Name**
```
OLD: "Enrichment Pipeline (BatchData → Melissa Waterfall)"
NEW: "Enrichment Pipeline (PropertyRadar → PDL → Melissa Waterfall)"
```

---

### **2. Add New Node: "Check PropertyRadar Contact"**

**Type:** IF Conditional  
**Position:** After "Get Lead", before enrichment  
**Purpose:** Skip enrichment for PropertyRadar leads with contact

**Condition:**
```javascript
{{ $json.skiptrace_tier === 0 && ($json.email !== null || $json.phone !== null) }}
```

**Logic:**
- **TRUE:** PropertyRadar already enriched → Skip to "Compute Score"
- **FALSE:** Needs enrichment → Route to PDL

---

### **3. Replace "BatchData Skip-Trace (Stage 1)" with "PDL Person Enrich"**

**OLD Node:** AI Agent with BatchData MCP  
**NEW Node:** HTTP Request to PeopleDataLabs

**Configuration:**
```json
{
  "method": "POST",
  "url": "https://api.peopledatalabs.com/v5/person/enrich",
  "authentication": "headerAuth",
  "headerParameters": {
    "parameters": [
      {
        "name": "X-API-Key",
        "value": "={{ $env.PDL_API_KEY }}"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "bodyParameters": {
    "street_address": "={{ $json.property_address }}",
    "locality": "={{ $json.property_city }}",
    "region": "={{ $json.property_state }}",
    "postal_code": "={{ $json.property_zip }}",
    "name": "={{ $json.first_name }} {{ $json.last_name }}",
    "min_likelihood": 6
  }
}
```

---

### **4. Update "Parse BatchData" → "Parse PDL"**

**NEW Code:**
```javascript
// Parse PeopleDataLabs response
const response = $input.first().json;
const lead = $('Get Lead').first().json;

// Initialize result
let result = {
  lead_id: lead.id,
  pdl_hit: false,
  primary_email: null,
  primary_phone: null,
  email_verified: false,
  phone_verified: false,
  emails: '[]',
  phones: '[]',
  enriched_by: 'pdl',
  enriched_at: new Date().toISOString()
};

// Check if PDL found a match
if (response.status === 200 && response.data) {
  const person = response.data;
  
  // Extract best email
  if (person.emails && person.emails.length > 0) {
    const primaryEmail = person.emails.find(e => e.type === 'primary' || e.current === true);
    const bestEmail = primaryEmail || person.emails[0];
    
    result.primary_email = bestEmail.address;
    result.email_verified = bestEmail.type === 'professional' || bestEmail.current === true;
    result.emails = JSON.stringify(person.emails.map(e => ({
      email: e.address,
      type: e.type,
      source: 'pdl'
    })));
  }
  
  // Extract best phone
  if (person.phone_numbers && person.phone_numbers.length > 0) {
    const mobilePhone = person.phone_numbers.find(p => p.type === 'mobile' && p.current === true);
    const primaryPhone = person.phone_numbers.find(p => p.type === 'primary');
    const bestPhone = mobilePhone || primaryPhone || person.phone_numbers[0];
    
    if (bestPhone) {
      result.primary_phone = bestPhone.number;
      result.phone_verified = bestPhone.current === true;
      result.phones = JSON.stringify(person.phone_numbers.map(p => ({
        phone: p.number,
        type: p.type,
        source: 'pdl'
      })));
    }
  }
  
  // Check if we got usable contact
  if (result.primary_email || result.primary_phone) {
    result.pdl_hit = true;
    result.has_contact = true;
  }
}

return [{ json: result }];
```

---

### **5. Update "Has Contact?" Conditional**

**NEW Condition:**
```javascript
{{ $json.pdl_hit === true }}
```

---

### **6. Remove BatchData AI Agent Nodes**

**Nodes to remove:**
- "Groq Chat Model" (id: groq-stage1)
- "BatchData MCP Tool" (id: batchdata-mcp-stage1)

**These are only connected to the old BatchData agent node, so they can be safely removed.**

---

### **7. Update "Update (Stage 1)" to use PDL tier**

**Update Supabase update to set:**
```javascript
{
  "skiptrace_tier": 1,  // 1 = PDL (was batchdata)
  "enriched_by": "pdl"
}
```

---

### **8. Update "Update (Stage 2)" to use Melissa tier**

**Keep existing but ensure:**
```javascript
{
  "skiptrace_tier": 2,  // 2 = Melissa
  "enriched_by": "melissa"
}
```

---

## 📊 New Waterfall Logic

### **Tier 0: PropertyRadar (70% enriched)**
- Already has email/phone from property pull workflow
- `skiptrace_tier = 0`
- **Skip enrichment entirely** ✅

### **Tier 1: PDL (60% of remaining 30% = 18%)**
- PropertyRadar had no contact
- PDL enriches address + name
- Cost: $0.05/lookup
- `skiptrace_tier = 1` if hit

### **Tier 2: Melissa (30% of PDL misses = 4%)**
- Both PropertyRadar AND PDL missed
- Melissa last resort
- Cost: $0.15/append
- `skiptrace_tier = 2` if hit

### **DLQ: No Contact (8%)**
- All three tiers missed
- Store with `skiptrace_tier = NULL`
- Flag for manual review

---

## 💰 Cost Impact

### **Before (BatchData → Melissa):**
```
All 250 leads → BatchData AI Agent: ~$0.50/lead
Misses → Melissa: ~$0.15/lead
Average: ~$0.62/lead
Monthly: $4,650 (250 leads/day)
```

### **After (PropertyRadar → PDL → Melissa):**
```
70% PropertyRadar only: 175 × $0.00 = $0
20% PDL: 50 × $0.05 = $2.50
8% Melissa: 20 × $0.15 = $3.00
2% DLQ: 5 × $0.00 = $0
────────────────────────────────
Daily enrichment cost: $5.50
Monthly: $165
Savings: $4,485/month (96% reduction!)
```

---

## ✅ Expected Outcome

**Final Enrichment Distribution (250 leads/day):**
- ✅ 175 leads (70%): PropertyRadar only - **FREE**
- ✅ 45 leads (18%): PropertyRadar + PDL - **$2.25/day**
- ✅ 10 leads (4%): PropertyRadar + PDL + Melissa - **$3.25/day**
- ❌ 20 leads (8%): No contact found - **DLQ**

**Total enriched:** 230/250 = **92% success rate**  
**Total cost:** **$5.50/day** vs **$155/day** with BatchData

---

## 🎯 Implementation Steps

1. ✅ Rename workflow
2. ✅ Add "Check PropertyRadar Contact" conditional
3. ✅ Replace BatchData Agent with PDL HTTP Request
4. ✅ Update "Parse BatchData" → "Parse PDL"
5. ✅ Update tier numbers (0=Radar, 1=PDL, 2=Melissa)
6. ✅ Remove BatchData AI agent nodes
7. ✅ Test with 5 sample leads

---

## 🔒 Safety Notes

- ✅ Backward compatible: Existing leads with `mak` or `attom_property_id` still work
- ✅ Waterfall still works for ALL leads without contact (regardless of source)
- ✅ DLQ handling unchanged
- ✅ Suppression list logic unchanged
- ✅ Quality scoring unchanged

---

**Ready to apply these changes to workflow Fjx1BYwrVsqHdNjK**

