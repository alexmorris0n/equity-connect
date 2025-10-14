# Instantly.ai Cold Email Campaign Guide

## 🎯 Overview
This guide shows how to set up CAN-SPAM compliant cold email campaigns via Instantly.ai for reverse mortgage leads.

**IMPORTANT:** Cold email does NOT require consent forms. Consent is only needed for PHONE CALLS after a lead replies with interest.

---

## 🔧 Setup Process

### **Step 1: Configure Custom Fields in Instantly**

In your Instantly.ai campaign, add these custom fields for personalization:

1. **`first_name`** - Lead's first name (for {{firstName}})
2. **`last_name`** - Lead's last name (for {{lastName}})
3. **`broker_name`** - Broker's name for personalization
4. **`property_address`** - Lead's property address
5. **`estimated_equity`** - Estimated equity amount (formatted: "$300,000")
6. **`property_value`** - Property value (formatted: "$650,000")

### **Step 2: Email Template Variables**

Use these variables in your Instantly cold email templates:

```html
<!-- Personalized greeting -->
Hello {{firstName}},

<!-- Value proposition -->
<p>I noticed your property at {{property_address}} has approximately {{estimated_equity}} in equity.</p>

<p>Many homeowners over 62 are using reverse mortgages to:</p>
<ul>
  <li>Eliminate monthly mortgage payments</li>
  <li>Access tax-free cash</li>
  <li>Stay in their home for life</li>
</ul>

<!-- Call to action - NO CONSENT FORM -->
<p><strong>Interested in learning more?</strong> Just reply "YES" and I'll send you a personalized analysis.</p>

<!-- Signature -->
<p>Best regards,<br>
{{broker_name}}<br>
Licensed Reverse Mortgage Specialist</p>

<!-- CAN-SPAM compliance (Instantly handles unsubscribe automatically) -->
```

---

## 📧 Email Template Setup

### **Template Variables Available**

| Variable | Description | Example |
|----------|-------------|---------|
| `{{firstName}}` | Lead's first name | Mary |
| `{{lastName}}` | Lead's last name | Garcia |
| `{{email}}` | Lead's email | mary@example.com |
| `{{broker_name}}` | Broker's name | John Smith |
| `{{property_address}}` | Property address | 123 Main St, Los Angeles, CA 90043 |
| `{{property_value}}` | Property value | $650,000 |
| `{{estimated_equity}}` | Estimated equity | $300,000 |

### **Sample Cold Email Template (Initial Outreach)**

```
Subject: Your {{property_address}} Property - Equity Options

Hi {{firstName}},

I noticed your home at {{property_address}} and wanted to reach out about a financial option many homeowners over 62 are using.

Your property has approximately {{estimated_equity}} in available equity.

A reverse mortgage could help you:
• Eliminate monthly mortgage payments
• Access tax-free cash (up to {{estimated_equity}})
• Stay in your home for life
• Never owe more than your home's value

Would you like a free, no-obligation analysis?

Just reply "YES" and I'll send you a personalized breakdown.

Best regards,
{{broker_name}}
NMLS Licensed Reverse Mortgage Specialist

---
This email is CAN-SPAM compliant. Unsubscribe link automatically included by Instantly.
```

---

## ⚙️ n8n Workflow Integration

### **Campaign Feeder Flow**

```
Daily 8am Trigger
  ↓
Get Campaign-Ready Leads (enriched with email)
  ↓
Format for Instantly (add broker info, format currency)
  ↓
Send to Instantly Campaign
  ↓
Mark leads as 'queued' in Supabase
```

### **Instantly Import Configuration**

```json
{
  "url": "https://api.instantly.ai/v1/campaigns/{{campaignId}}/leads/import",
  "body": {
    "email": "{{email}}",
    "firstName": "{{firstName}}",
    "lastName": "{{lastName}}",
    "customFields": {
      "property_address": "{{property_address}}",
      "property_value": "${{property_value}}",
      "estimated_equity": "${{estimated_equity}}",
      "broker_name": "{{broker_name}}",
      "broker_nmls": "{{broker_nmls}}"
    }
  }
}
```

**NO consent tokens in cold email - those are only for reply follow-ups!**

---

## 🔐 Compliance & Security

### **CAN-SPAM Compliance (Cold Email)**

**Required in EVERY email (Instantly handles automatically):**
- ✅ Clear "From" name (broker or company name)
- ✅ Accurate subject line (no deception)
- ✅ Physical mailing address (footer)
- ✅ One-click unsubscribe link
- ✅ Honor unsubscribe within 10 days

**NOT required for cold email:**
- ❌ Consent forms
- ❌ Opt-in before sending
- ❌ DNC registry check (that's for phone calls)

### **TCPA Compliance (Phone Calls - AFTER Reply)**

**Only needed when lead shows interest:**
1. Lead replies "YES" or "Interested" to email
2. n8n detects reply → triggers consent workflow
3. Send consent form: "May we call you?"
4. Lead submits form → consent recorded
5. NOW you can call them (VAPI/broker)

**Environment Variables (for reply handling):**
```bash
# Only needed when building reply handler (Monday)
FORM_LINK_SECRET=your-strong-secret-key-here
CONSENT_FORM_URL=https://form.equityconnect.com
```

---

## 📊 Campaign Setup in Instantly

### **1. Create New Campaign**

1. **Go to Instantly.ai** dashboard
2. **Click "Create Campaign"**
3. **Choose "Email Sequence"**
4. **Name:** "Reverse Mortgage - Initial Outreach"

### **2. Configure Custom Fields**

1. **Go to Campaign Settings**
2. **Click "Custom Fields"**
3. **Add the following fields**:

```
broker_name (Text)
property_address (Text)
property_value (Text) - Format: "$650,000"
estimated_equity (Text) - Format: "$300,000"
broker_nmls (Text) - Format: "NMLS #123456"
```

### **3. Set Up Email Sequence**

**Email 1 (Day 0):** Initial value proposition
- Subject: "Your {{property_address}} - Equity Options"
- Content: Brief intro, equity amount, 3 benefits
- CTA: "Reply YES for free analysis"

**Email 2 (Day 3):** Educational follow-up
- Subject: "How Reverse Mortgages Work - Quick Guide"
- Content: Common questions answered
- CTA: "Reply with questions"

**Email 3 (Day 7):** Final reminder
- Subject: "Last chance - Your ${{estimated_equity}} equity analysis"
- Content: Soft close, deadline urgency
- CTA: "Reply YES to claim"

### **4. Configure Campaign Settings**

- **Daily send limit:** 50-100 per day (warm start)
- **Sending schedule:** 8am-5pm recipient timezone
- **Stop on reply:** YES (pause sequence when they respond)
- **Track opens:** YES
- **Track clicks:** YES (for future microsite links)

---

## 🧪 Testing the Integration

### **1. Test Campaign Feeder Workflow**

Run the `campaign-feeder-daily.json` workflow manually:
1. Check it fetches enriched leads (with email + first_name)
2. Verify it formats data correctly for Instantly
3. Confirm leads appear in Instantly campaign

### **2. Test Instantly Import**

Send yourself a test email:
1. Add your email as a test lead
2. Run campaign feeder
3. Check Instantly dashboard - lead should appear
4. Verify all custom fields populated correctly

### **3. Test Email Delivery**

1. **Send test email** from Instantly to yourself
2. **Check personalization** (firstName, property_address, equity)
3. **Verify unsubscribe link** works (Instantly auto-adds)
4. **Reply "YES"** to test reply detection (build Monday)

### **4. Test Reply Detection** (Build Monday)

When lead replies:
1. Instantly webhook → n8n
2. n8n detects "YES" or positive intent
3. n8n sends TCPA consent form: "May we call you?"
4. Lead submits → consent recorded
5. Lead marked as callable

---

## 📈 Campaign Optimization

### **A/B Testing Variables**

Test different email approaches:

1. **Subject Lines**
   - A: "Your {{property_address}} - Equity Options"
   - B: "Unlock ${{estimated_equity}} from Your Home"

2. **Value Proposition**
   - A: Focus on eliminating mortgage payments
   - B: Focus on accessing cash

3. **Urgency**
   - A: No deadline pressure
   - B: Limited availability messaging

### **Key Metrics to Track**

**Email Performance:**
- **Open rate** (target: 25-35% for cold email)
- **Reply rate** (target: 3-5% positive replies)
- **Unsubscribe rate** (keep below 0.5%)
- **Bounce rate** (keep below 2%)

**Lead Engagement:**
- **Replies saying "YES"** or showing interest
- **Time to first reply** (median)
- **Sequence completion rate** (% who get all 3 emails)

### **Instantly Analytics Dashboard**

Use Instantly's built-in analytics to track:
- **Open rates** per email in sequence
- **Reply rates** by email step
- **Unsubscribe patterns** by timing
- **A/B test winners** by variant

---

## 🚨 Troubleshooting

### **Common Issues**

#### **1. Leads Not Importing to Instantly**
- **Check campaign feeder workflow** execution logs
- **Verify Instantly API key** is valid
- **Check campaign ID** is correct
- **Verify leads have email addresses** (enrichment completed)

#### **2. Custom Fields Not Populating**
- **Verify field names** match exactly (case-sensitive!)
- **Check data formatting** in n8n (currency with $, addresses formatted)
- **Test with sample lead** before batch import

#### **3. Low Open Rates (<15%)**
- **Check sender domain** reputation (use email warmup)
- **Verify SPF/DKIM** records configured
- **Test subject lines** with A/B testing
- **Check send timing** (avoid weekends/late nights)

#### **4. High Bounce Rates (>5%)**
- **Verify enrichment quality** (PDL email validation)
- **Check email format** validation in workflow
- **Remove obvious invalid** emails (test@, noreply@, etc.)

### **Debug Steps**

1. **Check campaign feeder** execution logs
2. **Verify enriched leads** have all required fields
3. **Test Instantly import** with 1-2 leads manually
4. **Review email template** for broken variables
5. **Monitor Instantly dashboard** for delivery issues

---

## 🎯 Best Practices

### **1. Email Design for Seniors**
- **Large fonts** (16px minimum)
- **Simple language** (avoid jargon)
- **Short paragraphs** (2-3 sentences max)
- **Clear call-to-action** ("Reply YES")
- **Mobile-friendly** (60% of seniors use mobile)

### **2. Sender Reputation**
- **Warm up email accounts** before high volume (start 10/day, increase slowly)
- **Monitor spam reports** (keep below 0.1%)
- **Use proper DNS** records (SPF, DKIM, DMARC)
- **Rotate sending accounts** (don't blast from one account)

### **3. Campaign Pacing**
- **Start small:** 50 emails/day per broker
- **Monitor engagement:** Scale up if open rates >25%
- **Pause if issues:** High bounces or spam reports
- **Test constantly:** A/B test subject lines, CTAs

### **4. Lead Quality**
- **Only send to enriched leads** (verified email addresses)
- **Segment by engagement:** Re-engage opens who didn't reply
- **Remove hard bounces** immediately
- **Honor unsubscribes** globally (across all campaigns)

---

## 🚀 Deployment Checklist

### **Saturday: Enrichment Workflows**
- [ ] Build PropertyRadar `/persons` enrichment (get owner names + emails)
- [ ] Build PDL fallback enrichment (for leads without PropertyRadar emails)
- [ ] Test both workflows with 10 sample leads
- [ ] Verify 85%+ email coverage after both passes

### **Sunday: Campaign Setup**
- [ ] Verify campaign feeder workflow (`campaign-feeder-daily.json`)
- [ ] Create Instantly campaign with 3-email sequence
- [ ] Configure custom fields (broker_name, property_address, equity)
- [ ] Write email templates (value prop, education, reminder)
- [ ] Test with 5-10 real leads

### **Monday: Reply Handler (Consent for Calls)**
- [ ] Build Instantly reply webhook handler
- [ ] Detect "YES" or positive intent in replies
- [ ] Send TCPA consent form (for phone calls only)
- [ ] Record consent in database
- [ ] Enable VAPI/broker calling for consented leads

### **Tuesday: Production Launch**
- [ ] Set campaign feeder to daily 8am
- [ ] Start with 50 leads/day per broker
- [ ] Monitor open rates (target: 25%+)
- [ ] Monitor reply rates (target: 3%+)
- [ ] Scale up if metrics are good

---

## 📚 Additional Resources

- **Instantly.ai Documentation**: https://docs.instantly.ai/
- **n8n Workflow Examples**: https://docs.n8n.io/
- **Consent Management Guide**: See `CONSENT_MANAGEMENT_GUIDE.md`
- **Email Template Examples**: See `templates/email/` directory

---

**Ready to launch?** This integration will give you secure, personalized consent links that significantly improve your conversion rates! 🚀
