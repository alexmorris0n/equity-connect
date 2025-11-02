# Instantly Integration - Calculator Links

## 🎯 Goal
Add personalized calculator links as custom variables in Instantly so you can use them in email campaigns.

---

## 📋 Quick Start

### Method 1: Export from Supabase (Easiest)

1. **Go to Supabase SQL Editor**
2. **Run this query:**

```sql
SELECT 
  l.primary_email as email,
  l.first_name as "firstName",
  l.last_name as "lastName",
  CONCAT('https://equityconnect.com/calculator?t=', ct.token) as "calculatorLink",
  l.property_address as "propertyAddress",
  l.property_city as "propertyCity",
  l.property_state as "propertyState",
  l.property_value as "propertyValue",
  l.estimated_equity as "estimatedEquity"
FROM leads l
INNER JOIN calculator_tokens ct ON l.id = ct.lead_id
WHERE l.primary_email IS NOT NULL
  AND l.primary_email != ''
  AND ct.expires_at > NOW()
ORDER BY l.created_at DESC;
```

3. **Click "Download CSV"**
4. **Upload to Instantly** (see Step 2 below)

---

### Method 2: Use Export Script (More Control)

1. **Run the export script:**

```bash
cd scripts
node export-calculator-links.js
```

2. **Find the CSV:**
```
instantly-calculator-links.csv
```

3. **Upload to Instantly** (see Step 2 below)

---

## 📤 Step 2: Upload to Instantly

### In Instantly Dashboard:

1. **Go to your Campaign** (or create a new one)

2. **Click "Leads" → "Import Leads"**

3. **Upload your CSV file**

4. **Map the columns:**
   - `email` → Email
   - `firstName` → First Name
   - `lastName` → Last Name
   - `calculatorLink` → **Custom Variable** (name it: `calculatorLink`)
   - `propertyAddress` → **Custom Variable** (name it: `propertyAddress`)
   - `propertyCity` → **Custom Variable** (name it: `propertyCity`)
   - `propertyState` → **Custom Variable** (name it: `propertyState`)
   - `propertyValue` → **Custom Variable** (name it: `propertyValue`)
   - `estimatedEquity` → **Custom Variable** (name it: `estimatedEquity`)

5. **Import and verify**

---

## ✉️ Step 3: Use Variables in Email Template

### In Your Instantly Email Template:

```
Subject: Your Personalized Equity Calculator, {{firstName}}

Hi {{firstName}},

We've created a personalized home equity calculator just for your property at {{propertyAddress}}.

Based on our records:
• Property Value: ${{propertyValue}}
• Estimated Equity: ${{estimatedEquity}}

See Your Options Here:
{{calculatorLink}}

This link is unique to you and shows personalized calculations for your {{propertyCity}}, {{propertyState}} property.

No pressure, no obligation. Just real numbers for your situation.

Best regards,
The Equity Connect Team

P.S. This link expires in 90 days, so take a look when you have a moment.
```

---

## 🔄 Automated: n8n to Instantly API

If you want to automatically add leads with calculator links to Instantly campaigns via n8n:

### n8n Workflow Nodes:

#### 1. After "Insert Lead" (existing node)

#### 2. Add: Supabase - Get Calculator Token
```
Operation: Execute SQL
SQL:
SELECT token 
FROM calculator_tokens 
WHERE lead_id = '{{ $json.id }}'
LIMIT 1;
```

#### 3. Add: HTTP Request - Add to Instantly
```
Method: POST
URL: https://api.instantly.ai/api/v1/lead/add
Headers:
  - Content-Type: application/json
  - Authorization: Bearer YOUR_INSTANTLY_API_KEY

Body:
{
  "api_key": "YOUR_INSTANTLY_API_KEY",
  "campaign_id": "YOUR_CAMPAIGN_ID",
  "email": "{{ $('Insert Lead').item.json.primary_email }}",
  "first_name": "{{ $('Insert Lead').item.json.first_name }}",
  "last_name": "{{ $('Insert Lead').item.json.last_name }}",
  "variables": {
    "calculatorLink": "https://equityconnect.com/calculator?t={{ $json.token }}",
    "propertyAddress": "{{ $('Insert Lead').item.json.property_address }}",
    "propertyCity": "{{ $('Insert Lead').item.json.property_city }}",
    "propertyState": "{{ $('Insert Lead').item.json.property_state }}",
    "propertyValue": "{{ $('Insert Lead').item.json.property_value }}",
    "estimatedEquity": "{{ $('Insert Lead').item.json.estimated_equity }}"
  }
}
```

---

## 📧 Email Template Examples

### Version 1: Simple & Direct

```
Subject: {{firstName}}, see your equity options

Hi {{firstName}},

Your property at {{propertyAddress}} may qualify for:
• Monthly payments
• Lump sum cash
• Line of credit

See your personalized calculations:
{{calculatorLink}}

Takes 2 minutes. No obligation.

- Equity Connect
```

---

### Version 2: Value-Focused

```
Subject: ${{estimatedEquity}} in home equity - here's what you can do with it

{{firstName}},

Our records show your {{propertyCity}} property has approximately ${{estimatedEquity}} in equity.

We've created a calculator showing exactly how you could access this:

👉 {{calculatorLink}}

You'll see:
✓ Monthly payment amounts
✓ Lump sum options  
✓ Line of credit flexibility

This link is personalized for {{propertyAddress}} and expires in 90 days.

Questions? Just reply.

Best,
Equity Connect Team
```

---

### Version 3: Curiosity-Driven

```
Subject: Re: {{propertyAddress}}

{{firstName}},

Quick question about your {{propertyCity}} property -

Have you ever used an equity calculator to see what you could access from your home?

We built one specifically for {{propertyAddress}}:
{{calculatorLink}}

It shows personalized numbers based on your property value and equity.

No signup required. Just click and see.

Worth a look?

- Team @ Equity Connect
```

---

## 🔧 Instantly API Integration (Advanced)

### Add Lead with Calculator Link via API

```bash
curl -X POST https://api.instantly.ai/api/v1/lead/add \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "YOUR_API_KEY",
    "campaign_id": "YOUR_CAMPAIGN_ID",
    "email": "susan@example.com",
    "first_name": "Susan",
    "last_name": "Anderson",
    "variables": {
      "calculatorLink": "https://equityconnect.com/calculator?t=p9o1nkjej0zz",
      "propertyAddress": "110 La Honda Rd",
      "propertyCity": "Redwood City",
      "propertyState": "CA",
      "propertyValue": "850000",
      "estimatedEquity": "425000"
    }
  }'
```

---

## 📊 Variable Reference

| Variable Name | Example Value | Use In Email |
|---------------|--------------|--------------|
| `{{email}}` | susan@example.com | Default (email address) |
| `{{firstName}}` | Susan | Personalization |
| `{{lastName}}` | Anderson | Full name |
| `{{calculatorLink}}` | https://equityconnect.com/calculator?t=p9o1n... | Main CTA |
| `{{propertyAddress}}` | 110 La Honda Rd | Property reference |
| `{{propertyCity}}` | Redwood City | Location context |
| `{{propertyState}}` | CA | Location context |
| `{{propertyValue}}` | 850000 | Show numbers |
| `{{estimatedEquity}}` | 425000 | Show equity amount |

---

## 🧪 Testing

### 1. Test with One Lead First

```sql
-- Get one lead for testing
SELECT 
  l.primary_email as email,
  l.first_name as "firstName",
  CONCAT('https://equityconnect.com/calculator?t=', ct.token) as "calculatorLink"
FROM leads l
INNER JOIN calculator_tokens ct ON l.id = ct.lead_id
WHERE l.primary_email IS NOT NULL
LIMIT 1;
```

### 2. Add to Instantly Test Campaign

### 3. Send Test Email

### 4. Verify:
- ✅ Calculator link works
- ✅ Shows correct lead data
- ✅ Variables populate correctly

---

## 🚨 Important Notes

### URL Format
Always use: `https://equityconnect.com/calculator?t=TOKEN`

Don't use:
- ❌ `calculator/?t=TOKEN` (missing domain)
- ❌ `calculator?token=TOKEN` (wrong parameter)
- ❌ Plain token without URL

### Token Expiration
- Tokens expire after 90 days
- Before exporting, filter for non-expired tokens:
  ```sql
  WHERE ct.expires_at > NOW()
  ```

### Email Filtering
- Only export leads with valid emails
- Check for bounced emails in Instantly
- Remove unsubscribed leads

---

## 📈 Tracking & Analytics

### See Who Clicked Their Calculator Link

```sql
SELECT 
  l.first_name,
  l.last_name,
  l.primary_email,
  ct.token,
  ct.used_at as first_click,
  ct.phone_submitted,
  ct.metadata
FROM calculator_tokens ct
JOIN leads l ON ct.lead_id = l.id
WHERE ct.used_at IS NOT NULL
ORDER BY ct.used_at DESC;
```

### See Who Submitted Phone Number

```sql
SELECT 
  l.first_name,
  l.last_name,
  l.primary_email,
  ct.phone_submitted,
  ct.metadata->>'submitted_at' as submitted_at
FROM calculator_tokens ct
JOIN leads l ON ct.lead_id = l.id
WHERE ct.phone_submitted IS NOT NULL
ORDER BY ct.metadata->>'submitted_at' DESC;
```

---

## 🔄 Re-Export for New Leads

Run the export script whenever you have new leads:

```bash
# Weekly export
node scripts/export-calculator-links.js

# Or schedule via cron
0 9 * * 1 cd /path/to/project && node scripts/export-calculator-links.js
```

---

## ✅ Checklist

- [ ] Export leads with calculator links
- [ ] Upload CSV to Instantly
- [ ] Map custom variables correctly
- [ ] Test with one lead first
- [ ] Update email template with variables
- [ ] Send test email
- [ ] Verify calculator link works
- [ ] Monitor clicks and submissions
- [ ] Set up weekly re-export for new leads

---

## 🆘 Troubleshooting

### Variables Not Showing?
- Check column mapping in Instantly import
- Verify CSV has correct headers
- Make sure variables use exact names: `calculatorLink` not `calculator_link`

### Calculator Link Broken?
- Check URL format (should start with https://)
- Verify token exists in database
- Check if token expired

### No Data in Calculator?
- Verify token is valid
- Check lead has property data in database
- Look for errors in browser console

---

## 📞 Support

Questions? Check:
1. `TOKEN_CALCULATOR_IMPLEMENTATION_COMPLETE.md` - Full calculator docs
2. `N8N_CALCULATOR_TOKEN_INTEGRATION.md` - n8n workflow integration
3. Database trigger status: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_auto_create_calculator_token'`

---

**Ready to send personalized calculator links in your email campaigns! 🚀**
