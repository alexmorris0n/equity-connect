# Instantly.ai Consent Token Integration Guide

## 🎯 Overview
This guide shows how to integrate consent tokens with Instantly.ai email campaigns, allowing you to send personalized, secure consent links to leads.

---

## 🔧 Setup Process

### **Step 1: Configure Custom Fields in Instantly**

In your Instantly.ai campaign, add these custom fields:

1. **`consent_token`** - The signed JWT token
2. **`consent_url`** - The secure consent form URL
3. **`simple_consent_url`** - Fallback URL with parameters
4. **`broker_name`** - Broker's name for personalization
5. **`property_address`** - Lead's property address
6. **`estimated_equity`** - Estimated equity amount

### **Step 2: Email Template Variables**

Use these variables in your Instantly email templates:

```html
<!-- Personalized greeting -->
Hello <strong>{{firstName}} {{lastName}}</strong>,

<!-- Broker information -->
<div class="broker-info">
    <div class="broker-name">{{broker_name}}</div>
    <div class="broker-company">Your Reverse Mortgage Specialist</div>
</div>

<!-- Consent button with token -->
<a href="{{consent_url}}" class="consent-button">
    Yes, you may contact me
</a>

<!-- Fallback option -->
<div class="fallback-text">
    <strong>Prefer email?</strong> Just reply <span class="highlight">YES</span> and we'll take it from there.
</div>
```

---

## 📧 Email Template Setup

### **Template Variables Available**

| Variable | Description | Example |
|----------|-------------|---------|
| `{{firstName}}` | Lead's first name | Mary |
| `{{lastName}}` | Lead's last name | Garcia |
| `{{email}}` | Lead's email | mary@example.com |
| `{{consent_url}}` | Secure token URL | https://form.equityconnect.com/consent?token=eyJ... |
| `{{simple_consent_url}}` | Fallback URL | https://form.equityconnect.com/consent?first=Mary&last=Garcia... |
| `{{broker_name}}` | Broker's name | John Smith |
| `{{property_address}}` | Property address | 123 Main St, San Francisco, CA |
| `{{estimated_equity}}` | Estimated equity | $300,000 |

### **Sample Email Template**

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm Your Interest in Reverse Mortgage Information</title>
    <style>
        /* Your CSS styles here */
    </style>
</head>
<body>
    <div class="container">
        <h1>Confirm Your Interest</h1>
        
        <p>Hello <strong>{{firstName}} {{lastName}}</strong>,</p>
        
        <p>Thank you for your interest in reverse mortgage information. To keep you safe and compliant with federal rules, we need your permission to contact you.</p>

        <div class="broker-info">
            <div class="broker-name">{{broker_name}}</div>
            <div class="broker-company">Your Reverse Mortgage Specialist</div>
        </div>

        <div style="text-align: center;">
            <a href="{{consent_url}}" class="consent-button">
                Yes, you may contact me
            </a>
        </div>

        <div class="fallback-text">
            <strong>Prefer email?</strong> Just reply <span class="highlight">YES</span> and we'll take it from there.
        </div>
    </div>
</body>
</html>
```

---

## ⚙️ n8n Workflow Integration

### **Updated Workflow Flow**

```
PropStream Lead → Supabase Creation → Consent Token Generation → Instantly Import
```

### **Consent Token Generation Node**

The workflow now includes a "Generate Consent Token" node that:

1. **Creates JWT payload** with lead data
2. **Generates HMAC signature** for security
3. **Creates consent URLs** (both token and simple)
4. **Passes data to Instantly** as custom fields

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
      "estimated_equity": "{{estimated_equity}}",
      "broker": "{{broker}}",
      "consent_token": "{{consent_token}}",
      "consent_url": "{{consent_url}}",
      "simple_consent_url": "{{simple_consent_url}}",
      "broker_name": "{{broker_name}}"
    }
  }
}
```

---

## 🔐 Security Considerations

### **Token Security**
- **HMAC-SHA256** signatures prevent tampering
- **7-day expiration** for security
- **Server-side verification** required
- **Environment variable** for secret key

### **Environment Variables**
```bash
# Add to your n8n environment
FORM_LINK_SECRET=your-strong-secret-key-here
CONSENT_FORM_URL=https://form.equityconnect.com
```

### **Token Verification**
The consent form will verify tokens by:
1. **Checking signature** with HMAC
2. **Validating expiration** timestamp
3. **Extracting lead data** from payload
4. **Pre-filling form** with verified data

---

## 📊 Campaign Setup in Instantly

### **1. Create New Campaign**

1. **Go to Instantly.ai** dashboard
2. **Click "Create Campaign"**
3. **Choose "Email Sequence"**
4. **Select your email template**

### **2. Configure Custom Fields**

1. **Go to Campaign Settings**
2. **Click "Custom Fields"**
3. **Add the following fields**:

```
consent_token (Text)
consent_url (Text)
simple_consent_url (Text)
broker_name (Text)
property_address (Text)
estimated_equity (Number)
```

### **3. Set Up Email Sequence**

1. **Email 1**: Consent request (immediate)
2. **Email 2**: Follow-up (24 hours later)
3. **Email 3**: Final reminder (72 hours later)

### **4. Configure Triggers**

- **Send immediately** when lead is imported
- **Pause sequence** if consent is given
- **Resume sequence** if no response after 7 days

---

## 🧪 Testing the Integration

### **1. Test Token Generation**

```bash
# Test the n8n workflow
curl -X POST https://your-n8n.com/webhook/propstream-lead \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "test-lead-123",
    "broker_id": "test-broker",
    "first_name": "Test",
    "last_name": "User",
    "email": "test@example.com",
    "phone": "+14085551234"
  }'
```

### **2. Verify Instantly Import**

Check that the lead appears in Instantly with all custom fields populated:
- `consent_token` - Should be a long JWT string
- `consent_url` - Should be a valid URL with token
- `broker_name` - Should match the broker configuration

### **3. Test Email Delivery**

1. **Send test email** from Instantly
2. **Click consent link** to verify it works
3. **Check form pre-filling** with lead data
4. **Test consent submission** end-to-end

---

## 📈 Campaign Optimization

### **A/B Testing Variables**

Test different approaches:

1. **Token vs Simple URL**
   - A: `{{consent_url}}` (signed token)
   - B: `{{simple_consent_url}}` (parameters)

2. **Button Text**
   - A: "Yes, you may contact me"
   - B: "Confirm My Interest"

3. **Broker Personalization**
   - A: Include broker photo
   - B: Just broker name

### **Conversion Tracking**

Monitor these metrics:

- **Email open rates** by template
- **Consent link click rates** by method
- **Form completion rates** by pre-fill status
- **Overall consent rates** by broker

### **Instantly Analytics**

Use Instantly's built-in analytics to track:
- **Open rates** for each email in sequence
- **Click rates** on consent buttons
- **Reply rates** for "YES" responses
- **Unsubscribe rates** and reasons

---

## 🚨 Troubleshooting

### **Common Issues**

#### **1. Tokens Not Generating**
- **Check environment variables** are set
- **Verify n8n workflow** is running
- **Check Supabase connection** is working

#### **2. Custom Fields Not Populating**
- **Verify field names** match exactly
- **Check JSON formatting** in n8n
- **Test Instantly API** connection

#### **3. Consent Links Not Working**
- **Verify token signature** is correct
- **Check expiration** timestamps
- **Test form URL** is accessible

### **Debug Steps**

1. **Check n8n execution logs** for errors
2. **Verify Supabase data** is being created
3. **Test Instantly import** with sample data
4. **Validate email template** variables
5. **Test consent form** functionality

---

## 🎯 Best Practices

### **1. Email Design**
- **Use large, clear buttons** for consent
- **Include trust elements** (broker info, company details)
- **Provide multiple ways** to give consent
- **Test on mobile devices** for seniors

### **2. Token Management**
- **Rotate secret keys** regularly
- **Monitor token usage** for abuse
- **Set reasonable expiration** times
- **Log all token operations** for audit

### **3. Campaign Management**
- **Start with small batches** for testing
- **Monitor conversion rates** closely
- **Adjust timing** based on response patterns
- **Personalize content** by broker/region

---

## 🚀 Deployment Checklist

### **Pre-Launch**
- [ ] **Environment variables** configured
- [ ] **n8n workflows** tested and deployed
- [ ] **Instantly custom fields** created
- [ ] **Email templates** designed and tested
- [ ] **Consent form** deployed and functional

### **Launch**
- [ ] **Start with test leads** first
- [ ] **Monitor conversion rates** closely
- [ ] **Check for errors** in n8n logs
- [ ] **Verify Instantly delivery** is working

### **Post-Launch**
- [ ] **Analyze performance** data
- [ ] **Optimize based on results**
- [ ] **Scale up gradually**
- [ ] **Monitor for issues**

---

## 📚 Additional Resources

- **Instantly.ai Documentation**: https://docs.instantly.ai/
- **n8n Workflow Examples**: https://docs.n8n.io/
- **Consent Management Guide**: See `CONSENT_MANAGEMENT_GUIDE.md`
- **Email Template Examples**: See `templates/email/` directory

---

**Ready to launch?** This integration will give you secure, personalized consent links that significantly improve your conversion rates! 🚀
