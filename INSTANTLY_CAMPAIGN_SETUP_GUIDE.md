# Instantly Campaign Setup Guide
**Complete Manual Setup Instructions**  
**Date:** October 13, 2025

---

## 📋 **Overview**

You're creating **3 campaigns** with **4 emails each** (12 total emails).

**Campaigns:**
1. No More Payments - For leads with mortgages
2. Cash Unlocked - For paid-off properties
3. High Equity Special - For equity > $500K

**Settings for ALL campaigns:**
- Daily limit: 30 emails per account
- Email gap: 10 minutes between emails
- Sending hours: 9:00 AM - 5:00 PM
- Timezone: America/Chicago
- Track opens: OFF
- Track clicks: OFF
- Stop on reply: ON
- Stop on auto-reply: ON

**⚠️ IMPORTANT SYNTAX:**
- **Merge fields:** Use double braces `{{firstName}}` `{{property_value}}`
- **Spintax:** Use `{{RANDOM | option1 | option2 | option3}}`
- **Example:** `{{RANDOM | Hi | Hello | Hey}} {{firstName}}`

---

## 🚀 **Campaign #1: "No More Payments"**

### **Step 1: Create Campaign**
1. Go to Instantly.ai → **Campaigns**
2. Click **"New Campaign"**
3. Name: `No More Payments`
4. Click **Create**

---

### **Step 2: Add Email Sequence**

#### **Email #1 (Day 0)**

**Subject Line:**
```
{{RANDOM | Stop | End | Eliminate}} your {{estimated_monthly_payment}}/month {{RANDOM | payment | house payment}}
```

**Email Body:**
```
Your home at {{property_address}} is worth {{property_value}}.

{{firstName}}, this is a government-insured program that lets you stop making mortgage payments. You keep your home. No sale required.

Based on your equity, you would receive {{equity_50_percent}} to {{equity_60_percent}}.

After that, no more monthly house payments.

This is called a reverse mortgage. It's federally insured.

Want to learn more?

{{senderFirstName}}
Equity Connect

---
Reply "stop" to opt out.
```

**Settings:**
- Delay: 0 days (sends immediately)

---

#### **Email #2 (Day 3)**

**Subject Line:**
```
{{RANDOM | Following up | Quick question}} - {{property_address}}
```

**Email Body:**
```
{{firstName}},

I sent you information about stopping your {{estimated_monthly_payment}} monthly payment.

Here are your numbers:

Home equity: {{estimated_equity}}
What you receive: {{equity_50_percent}} to {{equity_60_percent}}
Monthly payment after: $0

This is a reverse mortgage. The government insures it. You keep your home.

Would you like the exact numbers for your property?

Reply "YES" and I will send them today.

{{senderFirstName}}
Equity Connect

---
Reply "stop" to opt out.
```

**Settings:**
- Delay: 3 days after Email #1

---

#### **Email #3 (Day 7)**

**Subject Line:**
```
{{RANDOM | 3 | Three}} {{RANDOM | neighbors | homeowners near you}} just did this
```

**Email Body:**
```
{{firstName}},

Three homeowners near {{property_address}} stopped making mortgage payments this month.

They all had homes worth {{property_value_range}} with good equity built up.

They used a government program called a reverse mortgage.

They each received money and stopped making monthly payments. They kept their homes.

Does this sound like something you want to learn about?

Reply "INFO" for more information.

{{senderFirstName}}
Equity Connect

---
Reply "stop" to opt out.
```

**Settings:**
- Delay: 3 days after Email #2 (7 days total)

---

#### **Email #4 (Day 14)**

**Subject Line:**
```
{{RANDOM | Last message | Final message | Closing your file}} - {{firstName}}
```

**Email Body:**
```
{{firstName}},

This is my last message.

Your home: {{property_address}}
Current value: {{property_value}}
Your equity: {{estimated_equity}}
Money you could receive: {{equity_50_percent}} to {{equity_60_percent}}
Monthly payment after: $0

This is a reverse mortgage. It is government-insured.

If you want more information, reply "INFO" today.

If not, I will close your file and stop contacting you.

{{senderFirstName}}
Equity Connect

---
Reply "stop" to opt out.
```

**Settings:**
- Delay: 7 days after Email #3 (14 days total)

---

### **Step 3: Configure Campaign Settings**

1. Click **Settings** (gear icon)
2. Set these options:

**Sending Schedule:**
- Timezone: `America/Chicago`
- Sending hours: `9:00 AM - 5:00 PM`
- Days: Monday-Friday (uncheck weekends if preferred)

**Daily Limits:**
- Daily limit per account: `30`
- Email gap: `10 minutes`

**Tracking:**
- Track opens: **OFF** ❌
- Track clicks: **OFF** ❌

**Automation:**
- Stop on reply: **ON** ✅
- Stop on auto-reply: **ON** ✅

3. Click **Save**

---

### **Step 4: Add Accounts (Later)**
- Don't add accounts yet (waiting for Zapmail)
- Campaign will be saved as draft
- Add mailboxes when ready

---

## 🚀 **Campaign #2: "Cash Unlocked"**

### **Step 1: Create Campaign**
1. Go to Instantly.ai → **Campaigns**
2. Click **"New Campaign"**
3. Name: `Cash Unlocked`
4. Click **Create**

---

### **Step 2: Add Email Sequence**

#### **Email #1 (Day 0)**

**Subject Line:**
```
Your home is {{RANDOM | paid off | debt-free | free and clear}} - here's what that means
```

**Email Body:**
```
You paid off your home. That is a real accomplishment.

{{firstName}}, here is something many people with paid-off homes don't know:

You can receive {{equity_50_percent}} to {{equity_60_percent}} from your home's equity. You don't sell. You don't make monthly payments. You keep living there.

Your home is worth {{property_value}}.

You can use the money for:
• Extra retirement income
• Medical bills
• Helping your children or grandchildren
• Emergency savings

This is called a reverse mortgage. The government insures it.

Want to learn more?

{{senderFirstName}}
Equity Connect

---
Reply "stop" to opt out.
```

**Settings:**
- Delay: 0 days

---

#### **Email #2 (Day 3)**

**Subject Line:**
```
How {{RANDOM | paid-off | debt-free}} homeowners use this {{RANDOM | program | opportunity}}
```

**Email Body:**
```
{{firstName}},

Since your home is paid off, here are examples from {{property_city}}:

Janet, age 72, home worth {{property_value}}:
She received $375,000. Now she has $1,200 extra income each month. No payments required.

Robert, age 68, home worth {{property_value}}:
He received $425,000. He made home improvements so he can stay there as he ages. No payments required.

Your situation:
Your equity is about {{estimated_equity}}
You could receive {{equity_50_percent}} to {{equity_60_percent}}

This is a reverse mortgage. It is government-insured.

Would you like to discuss your specific situation?

Reply "YES"

{{senderFirstName}}
Equity Connect

---
Reply "stop" to opt out.
```

**Settings:**
- Delay: 3 days after Email #1

---

#### **Email #3 (Day 7)**

**Subject Line:**
```
{{RANDOM | 4 | Four}} ways to use your {{RANDOM | home equity | equity}}
```

**Email Body:**
```
{{firstName}},

You worked hard to pay off {{property_address}}. Now your equity can help you.

Four ways homeowners with paid-off homes use this program:

1. Monthly income: Get regular deposits with no repayment required

2. Medical costs: Cover healthcare or long-term care expenses

3. Home improvements: Make changes so you can stay in your home longer

4. Help family: Give money to children or grandchildren

Your equity: {{estimated_equity}}
You could receive: {{equity_50_percent}} to {{equity_60_percent}}

This is a government-insured reverse mortgage.

Want to see which option fits your needs?

Reply "INFO"

{{senderFirstName}}
Equity Connect

---
Reply "stop" to opt out.
```

**Settings:**
- Delay: 3 days after Email #2 (7 days total)

---

#### **Email #4 (Day 14)**

**Subject Line:**
```
{{RANDOM | Last message | Final message | Closing your file}} - your home equity
```

**Email Body:**
```
{{firstName}},

This is my last message.

Your home: {{property_address}}
You own it free and clear: Yes
Estimated value: {{property_value}}
Your equity: {{estimated_equity}}
Money you could receive: {{equity_50_percent}} to {{equity_60_percent}}

Since your home is paid off, you have the most options available.

This is a reverse mortgage. It is government-insured.

Reply "INFO" for a one-page summary.
Or reply "CALL" to speak with me directly.

Otherwise I will close your file today.

{{senderFirstName}}
Equity Connect

---
Reply "stop" to opt out.
```

**Settings:**
- Delay: 7 days after Email #3 (14 days total)

---

### **Step 3: Configure Campaign Settings**

**Use same settings as Campaign #1:**
- Timezone: America/Chicago
- Hours: 9:00 AM - 5:00 PM
- Daily limit: 30
- Email gap: 10 minutes
- Track opens: OFF
- Track clicks: OFF
- Stop on reply: ON
- Stop on auto-reply: ON

---

## 🚀 **Campaign #3: "High Equity Special"**

### **Step 1: Create Campaign**
1. Go to Instantly.ai → **Campaigns**
2. Click **"New Campaign"**
3. Name: `High Equity Special`
4. Click **Create**

---

### **Step 2: Add Email Sequence**

#### **Email #1 (Day 0)**

**Subject Line:**
```
{{RANDOM | Your home equity | You're sitting on}} {{equity_formatted_short}}{{RANDOM | + in equity | }}
```

**Email Body:**
```
{{property_address}} has {{estimated_equity}} in equity.

{{firstName}}, most homeowners with high equity don't realize you can receive {{equity_50_percent}} to {{equity_60_percent}} without:

• Selling your home
• Making monthly payments
• Moving out

The money is not taxable as income.

Your heirs will still inherit any remaining equity.

This is a reverse mortgage. The government insures it.

Is this worth a conversation?

{{senderFirstName}}
Equity Connect

---
Reply "stop" to opt out.
```

**Settings:**
- Delay: 0 days

---

#### **Email #2 (Day 3)**

**Subject Line:**
```
{{RANDOM | Strategic | Smart}} options for {{RANDOM | high-equity | high-net-worth}} homeowners
```

**Email Body:**
```
{{firstName}},

Homeowners with high equity like yours often use this program for:

Estate planning:
Keep your cash savings for your children. Use your home equity for your expenses instead.

Investment planning:
Get cash from your home at a low rate. Invest it where you earn more.

Retirement income:
Turn your home equity into monthly income. Delay taking Social Security to get higher benefits later.

Your situation:
You could receive: {{equity_50_percent}} to {{equity_60_percent}}
This money is not taxable

This is complex planning. You should discuss it with your financial advisor.

Would you like more information to share with your advisor?

Reply "YES"

{{senderFirstName}}
Equity Connect

---
Reply "stop" to opt out.
```

**Settings:**
- Delay: 3 days after Email #1

---

#### **Email #3 (Day 7)**

**Subject Line:**
```
{{RANDOM | Include | Bring}} your {{RANDOM | advisor | financial advisor}} {{RANDOM | in this conversation | to the call}}
```

**Email Body:**
```
{{firstName}},

Many of my clients with high-value homes bring their financial advisor or accountant to our first meeting.

This makes sense for a property like yours with {{estimated_equity}} in equity.

I can explain:
• Exact money available based on your age
• Tax treatment and reporting
• How this fits with your financial plan
• Comparison to home equity loans

We can schedule a call with you and your advisor together.

Or I can speak with your advisor first, if you prefer.

Reply with what works for you:
"SCHEDULE" - Book a time with me
"ADVISOR" - I will contact your advisor first
"INFO" - Email information to share with your advisor

{{senderFirstName}}
Equity Connect

---
Reply "stop" to opt out.
```

**Settings:**
- Delay: 3 days after Email #2 (7 days total)

---

#### **Email #4 (Day 14)**

**Subject Line:**
```
{{RANDOM | Final offer | Last chance}} - {{RANDOM | detailed analysis | full report}} for {{property_address}}
```

**Email Body:**
```
{{firstName}},

This is my final message.

I can prepare a detailed summary for your property:

Your home: {{property_address}}
Current value: {{property_value}}
Your equity: {{estimated_equity}}
Money available based on your age: {{equity_50_percent}} to {{equity_60_percent}}
Tax treatment: Not taxable as income
Comparison to other options: Home equity loan vs. reverse mortgage
Timeline: What to expect next

This will be 3-4 pages. You can review it with your advisor.

Reply "SUMMARY" for the full report.
Or reply "CALL" to discuss directly with me.

Otherwise I will close your file today.

{{senderFirstName}}
Equity Connect

---
Reply "stop" to opt out.
```

**Settings:**
- Delay: 7 days after Email #3 (14 days total)

---

### **Step 3: Configure Campaign Settings**

**Use same settings as Campaigns #1 & #2:**
- Timezone: America/Chicago
- Hours: 9:00 AM - 5:00 PM
- Daily limit: 30
- Email gap: 10 minutes
- Track opens: OFF
- Track clicks: OFF
- Stop on reply: ON
- Stop on auto-reply: ON

---

## ✅ **Final Checklist**

After creating all 3 campaigns, verify:

### **Campaign #1: No More Payments**
- [ ] 4 emails with correct delays (0, 3, 7, 14 days)
- [ ] All merge fields present: {{firstName}}, {{property_address}}, {{property_value}}, {{equity_50_percent}}, {{equity_60_percent}}, {{estimated_equity}}, {{estimated_monthly_payment}}, {{property_value_range}}, {{senderFirstName}}
- [ ] Spintax in subject lines: {{RANDOM | option1 | option2}}
- [ ] Settings: Daily limit 30, email gap 10 min, tracking OFF
- [ ] Stop on reply: ON

### **Campaign #2: Cash Unlocked**
- [ ] 4 emails with correct delays (0, 3, 7, 14 days)
- [ ] All merge fields present
- [ ] Same settings as Campaign #1
- [ ] Stop on reply: ON

### **Campaign #3: High Equity Special**
- [ ] 4 emails with correct delays (0, 3, 7, 14 days)
- [ ] All merge fields present (including {{equity_formatted_short}})
- [ ] Spintax in subject lines: {{RANDOM | option1 | option2}}
- [ ] Same settings as Campaign #1
- [ ] Stop on reply: ON

---

## 📋 **Getting Campaign IDs**

After creating each campaign:

1. Open the campaign in Instantly
2. Look at the URL in your browser
3. Copy the campaign ID (usually at the end of URL)
4. It looks like: `abc123def456`

**Save these IDs - you'll need them for the database!**

Example:
- Campaign #1 ID: `_____________` (fill in)
- Campaign #2 ID: `_____________` (fill in)
- Campaign #3 ID: `_____________` (fill in)

---

## 🗄️ **Next Step: Add to Database**

Once you have all 3 campaign IDs, run this SQL in Supabase:

```sql
INSERT INTO campaigns (archetype, campaign_name, instantly_campaign_id) VALUES
('no_more_payments', 'No More Payments', 'YOUR_CAMPAIGN_1_ID_HERE'),
('cash_unlocked', 'Cash Unlocked', 'YOUR_CAMPAIGN_2_ID_HERE'),
('high_equity_special', 'High Equity Special', 'YOUR_CAMPAIGN_3_ID_HERE');
```

Replace `YOUR_CAMPAIGN_X_ID_HERE` with the actual IDs from Instantly.

---

## 🚀 **After Setup Complete**

When ready to launch:

1. ✅ Add Zapmail mailboxes to Instantly
2. ✅ Assign mailboxes to each campaign
3. ✅ Add campaign IDs to database (SQL above)
4. ✅ Test n8n workflow with 5-10 test leads
5. ✅ Activate campaigns in Instantly
6. ✅ Run campaign feeder workflow

---

## 📝 **Notes**

- **Spintax syntax:** Single braces `{option1|option2}` creates variations for deliverability
- **Merge fields:** Double braces `{{firstName}}` for personalization variables
- **Custom fields:** Make sure all 11 custom fields were created (you did this earlier with CSV)
- **senderFirstName:** This pulls from the mailbox persona automatically (e.g., "Sarah" if email is from sarah@equityconnect.com)
- **No links:** Notice NO LINKS in any emails (reply-first strategy for better deliverability)
- **Clean footer:** Just company name + opt-out (you're not a broker, no NMLS needed)

---

## ❓ **Troubleshooting**

**If merge fields don't show up:**
- Go to Settings → Custom Fields
- Verify all 11 fields exist
- Re-upload test CSV if needed

**If spintax doesn't work:**
- Make sure you're using correct syntax: `{{RANDOM | option1 | option2 | option3}}`
- Must include `RANDOM` keyword
- Spaces around pipe symbols
- Test by sending yourself a test email

**If merge fields show up as {{firstName}} literally:**
- Make sure custom fields exist in Settings → Custom Fields
- Field names must match EXACTLY (case-sensitive)
- Re-upload test CSV if needed

**If campaigns won't save:**
- Check that all required fields are filled
- Make sure delays are set (0, 3, 7, 14 days)
- Verify timezone is selected

---

**Setup should take 20-30 minutes for all 3 campaigns.**

**Good luck! 🚀**

