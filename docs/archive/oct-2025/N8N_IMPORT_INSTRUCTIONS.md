# n8n Workflow Import Instructions

## Step-by-Step Guide

### 1. Open n8n Dashboard
Go to: https://n8n.instaroute.com

### 2. Import Workflow

**Click:** "+ Add workflow" (top right)  
**Click:** Three dots menu (⋮) → "Import from File"  
**Select:** `workflows/broker-calendar-nylas.json`  
**Click:** "Import"

### 3. Create Nylas API Credential

**In n8n:**
1. Click "Credentials" in left sidebar
2. Click "+ Add Credential"
3. Search for: "HTTP Header Auth"
4. Fill in:
   - **Name:** `Nylas API Key`
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer YOUR_NYLAS_API_KEY`  
     (Replace with actual API key from .env - starts with `nyk_`)
5. Click "Save"

### 4. Update Workflow Nodes

**Open the imported workflow**

**For "Nylas: Get Calendar Events" node:**
- Click the node
- Under "Credentials" → Select: "Nylas API Key"
- Save

**For "Nylas: Create Calendar Event" node:**
- Click the node  
- Under "Credentials" → Select: "Nylas API Key"
- Save

**For "Get Broker Info" nodes:**
- Should already use "SupaBase Equity Connect"
- If not, select it from dropdown

### 5. Activate Workflow

**Toggle:** "Inactive" → "Active" (top right)

### 6. Get Webhook URLs

**Copy these URLs:**
```
Availability: https://n8n.instaroute.com/webhook/broker-availability-nylas
Booking: https://n8n.instaroute.com/webhook/broker-book-appointment-nylas
```

**Verify they match your .env:**
```bash
N8N_AVAILABILITY_WEBHOOK=https://n8n.instaroute.com/webhook/broker-availability-nylas
N8N_BOOKING_WEBHOOK=https://n8n.instaroute.com/webhook/broker-book-appointment-nylas
```

### 7. Test the Webhook

**PowerShell test:**
```powershell
$body = '{"broker_id":"test","preferred_day":"tuesday"}' 
Invoke-RestMethod -Method Post -Uri "https://n8n.instaroute.com/webhook/broker-availability-nylas" -ContentType "application/json" -Body $body
```

**Expected:** Should NOT return 404  
**Might return:** Error "Broker not found" (that's OK - means webhook works!)

---

## ✅ Success Checklist

- [ ] Workflow imported
- [ ] Nylas API Key credential created
- [ ] Both Nylas nodes use the credential
- [ ] Workflow activated (green toggle)
- [ ] Webhook URL accessible (no 404)

---

## 🆘 Troubleshooting

**"Cannot find credential"**
- Make sure you selected "HTTP Header Auth" (not "Header Auth")
- Header name must be exactly: `Authorization`
- Header value must start with: `Bearer `

**"Workflow not activating"**
- Check all nodes have valid credentials
- Make sure Supabase credential exists
- Click each node to verify no errors

**"Webhook returns 404"**
- Workflow might not be activated
- Check the webhook path in the workflow node
- Verify it's the production workflow, not a copy

---

**Ready to import? Let me know when you've done this and we'll test it!**

