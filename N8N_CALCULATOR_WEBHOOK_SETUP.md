# n8n Calculator Webhook Setup

## ✅ Webhook Configuration

**Webhook URL:** `https://n8n.instaroute.com/webhook/calculator-form`  
**Status:** Active ✅  
**Method:** POST

---

## 📦 Webhook Payload

When a user submits their phone number on the calculator, this data is sent:

```json
{
  "token": "p9o1nkjej0zz",
  "phone": "(555) 123-4567",
  "lead_id": "uuid-of-lead",
  "submitted_at": "2025-01-14T20:00:00.000Z"
}
```

---

## 🔗 Environment Variable

**Add to Vercel:**

```
N8N_CALCULATOR_WEBHOOK_URL=https://n8n.instaroute.com/webhook/calculator-form
```

---

## 🎯 n8n Workflow Structure

### **Node 1: Webhook Trigger**
- **Type:** Webhook
- **Path:** `calculator-form`
- **Method:** POST
- **Output:** Receives calculator submission data

### **Node 2: Get Lead Data from Supabase**
- **Type:** Supabase
- **Operation:** Select
- **Table:** `leads`
- **Filter:** `id = {{ $json.lead_id }}`
- **Output:** Full lead record with property details

### **Node 3: Trigger Barbara**

**Option A: Create Inbound Call (Recommended)**
- **Type:** HTTP Request / Barbara API
- **Purpose:** Have Barbara call the lead immediately
- **Data Needed:**
  - Lead phone: `{{ $json.phone }}`
  - Lead name: `{{ $('Get Lead Data').item.json.first_name }}`
  - Property address: `{{ $('Get Lead Data').item.json.property_address }}`

**Option B: Create Task/Reminder**
- **Type:** Supabase Insert
- **Table:** `interactions` or similar
- **Purpose:** Log that Barbara needs to call them
- **Status:** "pending_callback"

**Option C: Send SMS to Barbara**
- **Type:** SMS API
- **Purpose:** Alert Barbara immediately
- **Message:** "Calculator submission from Susan at (555) 123-4567"

---

## 📊 Sample n8n Workflow JSON

```json
{
  "nodes": [
    {
      "parameters": {
        "path": "calculator-form",
        "options": {},
        "responseMode": "onReceived",
        "method": "POST"
      },
      "name": "Webhook - Calculator Submission",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "webhookId": "calculator-form"
    },
    {
      "parameters": {
        "operation": "select",
        "table": "leads",
        "filterType": "manual",
        "filterExpressions": [
          {
            "column": "id",
            "operator": "eq",
            "value": "={{ $json.lead_id }}"
          }
        ]
      },
      "name": "Get Lead from Supabase",
      "type": "n8n-nodes-base.supabase",
      "position": [450, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "YOUR_BARBARA_TRIGGER_URL",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "phone",
              "value": "={{ $json.phone }}"
            },
            {
              "name": "lead_name",
              "value": "={{ $('Get Lead from Supabase').item.json.first_name }} {{ $('Get Lead from Supabase').item.json.last_name }}"
            },
            {
              "name": "property_address",
              "value": "={{ $('Get Lead from Supabase').item.json.property_address }}"
            },
            {
              "name": "property_value",
              "value": "={{ $('Get Lead from Supabase').item.json.property_value }}"
            },
            {
              "name": "estimated_equity",
              "value": "={{ $('Get Lead from Supabase').item.json.estimated_equity }}"
            }
          ]
        }
      },
      "name": "Trigger Barbara Call",
      "type": "n8n-nodes-base.httpRequest",
      "position": [650, 300]
    }
  ]
}
```

---

## 🧪 Test Data

We successfully tested the webhook with:
```json
{
  "token": "test123",
  "phone": "(555) 123-4567",
  "lead_id": "test-lead-id",
  "submitted_at": "2025-01-14T20:00:00.000Z"
}
```

**Response:** `{"message":"Workflow was started"}` ✅

---

## 📋 Next Steps

1. ✅ **Webhook tested and working**
2. ⏳ **Add Node 2:** Get lead data from Supabase
3. ⏳ **Add Node 3:** Trigger Barbara to call
4. ⏳ **Add to Vercel:** Environment variable `N8N_CALCULATOR_WEBHOOK_URL`

---

## 💡 How It Works End-to-End

```
User submits phone on calculator
         ↓
API saves to database
         ↓
API triggers n8n webhook
         ↓
n8n gets full lead data
         ↓
n8n triggers Barbara
         ↓
Barbara calls lead!
```

---

**The webhook is ready to receive real submissions!** Just need to:
1. Add the Supabase node to get lead details
2. Add your Barbara trigger mechanism
3. Deploy with the environment variable

Want me to help you build out the full n8n workflow? 🚀

