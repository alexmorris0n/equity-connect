# Instantly Merge Fields Reference
**Version:** 1.0  
**Date:** October 13, 2025  
**Updated For:** Campaign Feeder v3.0 (Reply-First Strategy)

---

## 📋 Available Merge Fields

### **Basic Lead Information**
Use these for personalization in all campaigns.

| Merge Field | Example Value | Usage |
|------------|---------------|-------|
| `{first_name}` | "John" | Personalize greeting |
| `{last_name}` | "Smith" | Full name if needed |
| `{property_address}` | "1234 Oak Street" | Reference their property |
| `{property_city}` | "Beverly Hills" | Local context |

**Example:**
```
Hi {first_name},

Your home at {property_address} in {property_city}...
```

---

### **Property Value Fields**
Use these to show home value and create credibility.

| Merge Field | Example Value | Usage |
|------------|---------------|-------|
| `{property_value}` | "$850,000" | Show current home value |
| `{property_value_range}` | "$765K-$935K" | Social proof range (±10%) |

**Example:**
```
Your home is currently valued around {property_value}.

Three homeowners near you with properties valued 
{property_value_range} just eliminated their mortgage 
payments this month.
```

---

### **Equity Fields**
Use these to show available equity and create interest.

| Merge Field | Example Value | Usage | Calculation |
|------------|---------------|-------|-------------|
| `{estimated_equity}` | "$625,000" | Total equity | From PropertyRadar |
| `{equity_50_percent}` | "$312,500" | Conservative access | 50% of equity |
| `{equity_60_percent}` | "$375,000" | Typical access | 60% of equity |
| `{equity_formatted_short}` | "$625K" | Short form for subject lines | Rounded to thousands |

**Example:**
```
Based on your equity, you could potentially access 
{equity_50_percent}–{equity_60_percent} and never 
make another house payment.
```

**Subject Line Example:**
```
Quick question about your {equity_formatted_short} equity
```

---

### **Payment Fields**
Use these for "No More Payments" campaign.

| Merge Field | Example Value | Usage | Calculation |
|------------|---------------|-------|-------------|
| `{estimated_monthly_payment}` | "$2,400" | Monthly savings | Rough estimate based on 40% LTV |

**Example:**
```
Your home at {property_address} is currently valued 
around {property_value}.

Many homeowners in {property_city} with similar 
properties are eliminating their {estimated_monthly_payment}/month 
mortgage payment — while keeping their home.
```

**Note:** This is a rough estimate. Actual calculation:
```javascript
(property_value × 0.4) × 0.005 = estimated monthly payment
```

---

### **Broker Information**
Use these in signature and compliance sections.

| Merge Field | Example Value | Usage |
|------------|---------------|-------|
| `{broker_name}` | "Walter Richards" | Personalize from line |
| `{broker_nmls}` | "NMLS #ML123456" | Compliance requirement |

**Example:**
```
– {broker_name}
My Reverse Options

---
{broker_name}, {broker_nmls}
This is a reverse mortgage (HECM). Homeowner must be 62+...
```

---

## 🎯 Campaign-Specific Examples

### **Campaign #1: No More Payments**
Target: Leads with active mortgage (`isFreeAndClear = 0`)

**Day 0 Email:**
```
Subject: Stop your {estimated_monthly_payment}/month payment

Hi {first_name},

Your home at {property_address} is currently valued around 
{property_value}.

Many homeowners in {property_city} with similar properties 
are using a federally-insured program to eliminate their 
monthly mortgage payment — while keeping their home.

Based on your equity, you could potentially access 
{equity_50_percent}–{equity_60_percent} and never make 
another house payment.

Interested in learning how this works?

– {broker_name}
```

---

### **Campaign #2: Cash Unlocked**
Target: Paid-off properties (`isFreeAndClear = 1`)

**Day 0 Email:**
```
Subject: Congrats on owning {property_address} free & clear

Hi {first_name},

Paying off your home is an incredible achievement — most 
people never get there.

Here's something many debt-free homeowners don't realize: 
you can safely access your equity WITHOUT selling or taking 
on monthly payments.

Your home is valued around {property_value}. That means 
you could potentially unlock {equity_50_percent}–{equity_60_percent} 
to use however you'd like.

Interested in learning how this works?

– {broker_name}
```

---

### **Campaign #3: High Equity Special**
Target: High-equity leads (`estimated_equity > $500,000`)

**Day 0 Email:**
```
Subject: You're sitting on {equity_formatted_short}+ in equity

Hi {first_name},

Your property at {property_address} has substantial equity 
built up.

Current value: {property_value}
Estimated equity: {estimated_equity}
Potential access: {equity_50_percent}–{equity_60_percent}

Many high-equity homeowners in {property_city} don't realize 
they can tap this wealth without selling or monthly payments.

Interested in learning how this works?

– {broker_name}, {broker_nmls}
```

---

## ⚠️ Important Notes

### **NO LINKS in Day 0-7 Emails**
For maximum deliverability, DO NOT include any links in the first three emails:
- ❌ Day 0: NO LINK
- ❌ Day 3: NO LINK  
- ❌ Day 7: NO LINK
- ✅ Day 14: Optional link OK (as backup CTA)

### **Reply-First Strategy**
Only send microsite links AFTER lead replies positively:

**Wrong:**
```
Check out your calculator: {city}.equityconnect.com  ❌
```

**Right:**
```
Want me to send you the exact calculation?
Just reply "YES" and I'll get it to you today.  ✅
```

Then when they reply, send microsite link in auto-response.

---

## 🔧 Setting Up in Instantly

### **Step 1: Create Custom Fields**
In Instantly dashboard:
1. Go to Settings → Custom Fields
2. Add each field from the table above
3. Match exact names (case-sensitive)

### **Step 2: Import Email Sequences**
1. Create 3 campaigns (No More Payments, Cash Unlocked, High Equity)
2. Import 4-email sequences for each
3. Use merge fields with `{curly_braces}` syntax

### **Step 3: Test Merge Fields**
Send test emails to yourself:
1. Add test lead with sample data
2. Send Day 0 email
3. Verify all fields populate correctly
4. Check formatting ($ signs, commas, etc.)

---

## 📊 Merge Field Formatting

All currency fields are pre-formatted in the workflow:

| Field | Raw Value | Formatted Output |
|-------|-----------|------------------|
| `property_value` | 850000 | "$850,000" |
| `estimated_equity` | 625000 | "$625,000" |
| `equity_50_percent` | 312500 | "$312,500" |
| `equity_60_percent` | 375000 | "$375,000" |
| `equity_formatted_short` | 625000 | "$625K" |
| `estimated_monthly_payment` | 2400 | "$2,400" |

**You don't need to add $ signs or commas - they're already included.**

---

## 🚫 Common Mistakes

### **Mistake #1: Adding Links Too Early**
```
❌ Day 0: Check out: {city}.equityconnect.com
✅ Day 0: Just reply "YES" for your personalized calculator
```

### **Mistake #2: Wrong Field Names**
```
❌ {equity_50}  (missing "_percent")
✅ {equity_50_percent}
```

### **Mistake #3: Double Formatting**
```
❌ ${equity_50_percent}  (already has $)
✅ {equity_50_percent}
```

### **Mistake #4: Using Wrong Campaign Fields**
```
❌ Campaign #2 (Cash Unlocked): "Stop your {estimated_monthly_payment}/month"
   (They don't have a payment - they paid it off!)

✅ Campaign #2: "Your home is valued at {property_value}"
```

---

## 🎬 What Happens Next

### **After Lead Replies:**
1. Instantly webhook sends reply to n8n
2. AI analyzes sentiment (positive/negative/neutral)
3. If positive → Auto-send microsite link
4. Microsite URL includes lead data: `{city}.equityconnect.com?id={lead_id}`
5. Microsite dynamically populates with their numbers

### **Microsite Data:**
The microsite will automatically pull:
- All merge fields above
- Plus: Calculator with pre-filled property value
- Plus: Appointment booking form
- Plus: Consent checkboxes

---

## 📝 Quick Reference Card

**Copy this for your Instantly setup:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTANTLY MERGE FIELDS - QUICK REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BASIC INFO:
{first_name} {last_name}
{property_address} {property_city}

PROPERTY VALUE:
{property_value} → "$850,000"
{property_value_range} → "$765K-$935K"

EQUITY:
{estimated_equity} → "$625,000"
{equity_50_percent} → "$312,500"
{equity_60_percent} → "$375,000"
{equity_formatted_short} → "$625K"

PAYMENT:
{estimated_monthly_payment} → "$2,400"

BROKER:
{broker_name} → "Walter Richards"
{broker_nmls} → "NMLS #ML123456"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REMEMBER: NO LINKS in Day 0-7 emails!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ✅ Next Steps

1. **Run the SQL migration** (campaign-tracking-migration.sql)
2. **Import updated workflow** into n8n
3. **Create custom fields in Instantly** (match exact names)
4. **Import email sequences** (3 campaigns × 4 emails = 12 total)
5. **Test with 10 sample leads** before full launch

---

**Questions? Check the main campaign strategy doc for full details.**

