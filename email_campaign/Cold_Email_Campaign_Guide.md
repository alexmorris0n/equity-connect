# Cold Email Campaign System - Complete Strategy Guide

**Last Updated:** October 31, 2025  
**Status:** Version A (Production Ready)  
**Purpose:** Complete strategy, intent, and implementation guide for all 3 cold email campaigns

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Campaign Architecture](#campaign-architecture)
3. [Writing Principles](#writing-principles)
4. [Campaign Details](#campaign-details)
5. [Technical Integration](#technical-integration)
6. [Deliverability Guidelines](#deliverability-guidelines)
7. [A/B Testing Framework](#ab-testing-framework)
8. [Quick Reference](#quick-reference)

---

## System Overview

### What Equity Connect Does

**We are:**
- A curated marketplace (one homeowner → one broker)
- A pre-qualification filter (verify interest before broker involvement)
- A transparent connector (upfront about our role)

**We are NOT:**
- A lead aggregator selling to 100 brokers
- The broker pretending to be someone else
- A marketing agency running ads

### Complete Funnel Flow

```
Cold Email (Instantly.ai) - 4 emails over 14 days
    ↓
Lead Replies
    ↓
Reply Handler (n8n + Gemini Flash AI)
    ↓
Phone Provided?
    ↓               ↓
   YES             NO
    ↓               ↓
Pause Campaign   Email Response
Barbara Call     Ask for phone
    ↓               ↓
Pre-qualify     Continue sequence
Book Appt       (Email 2, 3, 4)
    ↓               ↓
Broker Call     Multiple chances
```

### Campaign Pause Logic

**Instantly Settings:**
- ❌ Auto-pause on reply: **DISABLED**
- ✅ Full 4-email sequence runs by default

**Reply Handler Pauses When:**
1. **PHONE_PROVIDED** → Instantly API pause (Barbara calls)
2. **UNSUBSCRIBE** → Instantly API pause (honor request)

**Campaign Continues When:**
- Lead replies with interest but no phone
- Lead asks question but no phone
- Lead doesn't reply at all

---

## Campaign Architecture

### The 3 Archetypes

| Campaign | Equity | Mortgage | Emotional Driver |
|----------|--------|----------|------------------|
| **1. No More Payments** | 50%+ | Has mortgage | Payment relief |
| **2. Cash Unlocked** | 50-79% | Paid off | Opportunity cost |
| **3. High Equity Special** | 80%+ | Any | Strategic planning |

### Universal Structure

**4-Email Sequence (14 days):**

| Email | Day | Purpose | CTA |
|-------|-----|---------|-----|
| 1 | 0 | Build interest + explain who we are | Phone ask |
| 2 | 3 | Address objections + reinforce value | Phone ask |
| 3 | 7 | Social proof + urgency | Phone ask |
| 4 | 14 | Final offer + deadline | Phone ask |

**Every email includes:**
- Phone number request (primary CTA)
- Call expectation ("we'll call you today")
- Specific broker mention
- Personalized data (city, equity, value)
- Coordinator signature

---

## Writing Principles

### 1. Personal Coordinator Voice

**❌ Avoid:**
- "Dear Homeowner"
- "SPECIAL OFFER!"
- "You've been selected!"
- "Click here to claim"

**✅ Use:**
- "Hi {{firstName}}"
- "I work with homeowners in {{property_city}}"
- "Two people I connected last month"
- "Reply with your phone number"

### 2. Transparent Positioning

**Always state:**
- "I'm {{accountSignature}} with Equity Connect"
- "We pre-qualify homeowners, then connect them with trusted specialists"
- "For {{property_city}}, we work with {{broker_first_name}} at {{broker_company}}"

**Why:**
- Builds trust (not hiding who we are)
- Differentiates from lead blasters
- Sets expectations clearly

### 3. Phone Number as Primary CTA

**Every email ends with:**
- "Reply with your best phone number"
- "We'll call you today/within 2 hours"
- "Takes 5-10 minutes to verify eligibility"

**Why:**
- Clear next step
- Low commitment
- Sets call expectation

### 4. Natural Urgency

**❌ Avoid:**
- "LIMITED TIME OFFER!"
- "Only 3 spots left!"
- "Expires in 24 hours!"

**✅ Use:**
- "This is my third message"
- "I'll close your file today"
- "If I don't hear from you"

### 5. Compliance Language

**Always use:**
- "approximately" not "exactly"
- "estimated" not "guaranteed"
- "may qualify" not "you qualify"
- "government-insured" not "risk-free"

---

## Campaign Details

### Campaign 1: No More Payments

**Target:** 62+ with active mortgages, 50%+ equity

**Psychographics:**
- Payment fatigued
- Worried about retirement income
- Want relief without selling
- House-rich, cash-poor

**Core Message:**  
"Eliminate your monthly mortgage payment completely. Keep your home. No sale required."

**Emotional Hook:** Relief, freedom, security

**Tone:** Empathetic, understanding, lifeline

**Key Benefits:**
- Zero monthly payments
- Keep home and title
- Government-insured
- 60,000+ used it last year

**Email Progression:**
1. **Introduction** - Explain benefit, show numbers
2. **Objection handling** - "What's the catch?" answer
3. **Social proof** - Two examples from their area
4. **Final offer** - Recap + hard deadline

---

### Campaign 2: Cash Unlocked

**Target:** 62+ mortgage-free, 50-79% equity

**Psychographics:**
- Financially stable
- Proud of being debt-free
- Equity sitting idle
- Need funds for specific purposes

**Core Message:**  
"You've built substantial equity. Access 50-60% without selling or payments."

**Emotional Hook:** Opportunity cost, smart money management

**Tone:** Respectful, consultative, opportunity-focused

**Key Benefits:**
- Access idle equity
- Not taxable as income
- 4 common uses (income, healthcare, mods, family)
- Zero payments

**Email Progression:**
1. **Opportunity** - Show what's possible, 4 uses
2. **Four use cases** - Concrete examples
3. **Social proof** - Two examples with different uses
4. **Final opportunity** - Flexibility emphasis

---

### Campaign 3: High Equity Special

**Target:** 62+ with 80%+ equity, wealthy/sophisticated

**Psychographics:**
- High net worth
- Work with financial advisors
- Care about tax implications
- Estate planning mindset

**Core Message:**  
"Strategic financial tool for high-equity homeowners. Tax and estate benefits."

**Emotional Hook:** Tax efficiency, strategic planning, exclusive insights

**Tone:** Peer-to-peer, advisory, sophisticated

**Key Benefits:**
- Not taxable as income
- Estate planning flexibility
- Can include financial advisor
- Strategic retirement tool

**Email Progression:**
1. **Strategic intro** - Tax benefits, advisor inclusion
2. **Tax & estate** - Three strategic reasons
3. **Advisor-inclusive** - Topics we'll cover
4. **Detailed breakdown** - Comprehensive analysis offer

---

## Technical Integration

### Variable Mapping (Instantly.ai)

**Lead Variables:**
```
{{firstName}} - First name
{{property_city}} - City
{{property_value}} - Formatted ($500,000)
{{estimated_equity}} - Formatted ($480,000)
{{equity_50_percent}} - 50% ($240,000)
{{equity_60_percent}} - 60% ($288,000)
{{equity_formatted_short}} - Short ($480k)
{{estimated_monthly_payment}} - Payment (Campaign 1)
```

**Broker Variables:**
```
{{broker_first_name}} - Broker first name
{{broker_company}} - Company name
{{broker_nmls}} - NMLS number
{{broker_phone}} - Phone number
```

**Persona Variables:**
```
{{accountSignature}} - Coordinator name
```

### Campaign Schedule

- **Email 1:** Day 0 (immediate)
- **Email 2:** Day 3
- **Email 3:** Day 7
- **Email 4:** Day 14

**Send Times:**
- 9:00 AM - 11:00 AM local time
- Tuesday - Thursday preferred
- Avoid Mondays and Fridays

### Deliverability Settings

- Daily limit: 50 emails per inbox
- Warmup: Yes (new domains)
- SPF/DKIM/DMARC: Configured
- Reply tracking: Enabled
- Open tracking: Enabled
- Click tracking: Disabled
- Auto-pause on reply: **DISABLED**
- Auto-pause on unsubscribe: Enabled

### Reply Handler Integration

**PHONE_PROVIDED:**
1. Extract and normalize phone
2. Update database
3. **Pause Instantly campaign (API)**
4. Trigger Barbara call
5. Log interaction

**QUESTION:**
1. Search Knowledge Base
2. Compose email answer
3. Ask for phone
4. Send via Instantly MCP
5. **Campaign continues**
6. Log interaction

**INTEREST:**
1. Compose thank you
2. Ask for phone
3. Send via Instantly MCP
4. **Campaign continues**
5. Log interaction

**UNSUBSCRIBE:**
1. Update status
2. **Pause Instantly campaign (API)**
3. Log interaction
4. No email sent

### Instantly API Pause

```javascript
POST https://api.instantly.ai/api/v1/lead/pause
Headers: {
  'Authorization': 'Bearer API_KEY'
}
Body: {
  "campaign_id": "uuid",
  "email": "lead@example.com"
}
```

---

## Deliverability Guidelines

### Domain Setup Requirements

- ✅ SPF record configured
- ✅ DKIM keys added
- ✅ DMARC policy set
- ✅ Custom tracking domain (optional)

### Spam Trigger Words to AVOID

**Money/Urgency:**
- Free, cash, $$$, earn, profit
- Act now, limited time, urgent, expires
- Guarantee, promise, certified

**Sales Pressure:**
- Click here, buy now, order now
- Special promotion, exclusive deal
- Don't delete, this is not spam

**Sketchy Financial:**
- Eliminate debt (use "eliminate payment")
- Get out of debt
- Refinance (triggers filters)
- Credit

**Format Issues:**
- ALL CAPS
- Excessive punctuation!!!
- Multiple dollar signs

### Safe Alternative Language

| ❌ Avoid | ✅ Use Instead |
|---------|---------------|
| Free money | Access your equity |
| No risk | Government-insured |
| Limited time | This is my [X] message |
| Click here | Reply with phone |
| Guaranteed | Most homeowners qualify |
| Refinance | Reverse mortgage program |
| Eliminate debt | Eliminate payment |

### Email Formatting

**Structure:**
- Plain text or minimal HTML
- 150-250 words per email
- 3-5 short paragraphs
- One clear CTA
- Mobile-friendly

**Personalization:**
- Use {{firstName}} in greeting
- Include {{property_city}} at least once
- Reference specific numbers
- Sign with real person name

**Links:**
- Avoid URL shorteners
- Use full URLs if needed
- Minimize links (0-1 ideal)
- Never "Click here" text

### Monitoring Metrics

**Daily:**
- Bounce rate (<2%)
- Spam rate (<0.1%)
- Reply rate (target 3-5%)
- Open rate (target 25-35%)

**Weekly:**
- Deliverability score
- Domain reputation
- Email performance
- Campaign pausing working?

**Monthly:**
- A/B test results
- Broker satisfaction
- Lead quality
- Conversion rates

---

## A/B Testing Framework

### When to Test

**After 100 emails sent per campaign** for statistical significance.

**Test one variable at a time:**
1. Subject lines
2. Opening hooks
3. Email length
4. Social proof format
5. CTA phrasing
6. Send timing

### Subject Line Tests

**Campaign 1 Examples:**

**Version A (Current):**
- "{{property_city}} - eliminate your monthly mortgage payment"

**Version B (Curiosity):**
- "{{firstName}}, what would you do with an extra $2,400/month?"

**Version C (Question):**
- "{{firstName}}, are you still making mortgage payments?"

### Opening Hook Tests

**Current:**
```
I'm {{accountSignature}} with Equity Connect.

I work with homeowners over 62 who are still 
making mortgage payments.
```

**Test B (Question):**
```
Quick question: Are you still making mortgage 
payments on your {{property_city}} home?

What if I told you there's a way to eliminate 
that payment - and keep your home?
```

**Test C (Curiosity):**
```
I noticed something interesting about your 
{{property_city}} home.

With approximately {{estimated_equity}} in 
equity, you might qualify to eliminate your 
monthly payment completely.
```

### Tracking Metrics

**Track:**
- Open rate (subject line)
- Reply rate (overall effectiveness)
- Phone provision rate (CTA)
- Qualified lead rate (quality)
- Appointment rate (end-to-end)

**Sample Size:**
- Minimum 100 emails per version
- Run for 7+ days
- Statistical significance: p < 0.05

**Decision:**
- B beats A by 20%+ → Make B new control
- B beats A by 10-20% → Run longer
- B loses to A → Keep A
- No clear winner → Keep simpler

### Testing Priority

**Test in this order:**

1. **Subject lines** (biggest open rate impact)
2. **Opening hooks** (biggest engagement impact)
3. **Email length** (affects reply rate)
4. **CTA phrasing** (affects phone provision)
5. **Social proof** (affects trust)
6. **Send timing** (affects opens)

---

## Quick Reference

### Campaign Assignment Logic

```
IF equity >= 80% 
  → Campaign 3 (High Equity Special)
ELSE IF mortgage_paid_off = true 
  → Campaign 2 (Cash Unlocked)
ELSE IF has_mortgage = true 
  → Campaign 1 (No More Payments)
```

### Target Metrics

| Metric | Target | Good | Excellent |
|--------|--------|------|-----------|
| Open Rate | 25% | 30% | 35%+ |
| Reply Rate | 3% | 5% | 7%+ |
| Phone Rate | 40% | 50% | 60%+ |
| Booking Rate | 20% | 25% | 30%+ |

### Compliance Checklist

Before sending ANY email:

- ✅ "approximately" or "estimated" for numbers
- ✅ "may qualify" not "you qualify"
- ✅ "government-insured" mentioned
- ✅ No guaranteed amounts
- ✅ Broker NMLS included
- ✅ Unsubscribe present
- ✅ No spam words
- ✅ No ALL CAPS
- ✅ Real person signature
- ✅ Phone CTA only

### Spam Word Quick List

**Never use:**
- Free, cash, $$$
- Act now, limited time, urgent
- Guarantee, promise
- Click here, buy now
- Special promotion
- Don't delete
- Eliminate debt
- Get out of debt

---

## Document Control

**Version:** A (Production)  
**Date:** October 31, 2025  
**Next Review:** After 100 emails sent  
**Owner:** Alex Morrison  
**Approval Required:** Before 20%+ copy changes

---

**Use this guide for:**
- Writing new campaigns
- Creating A/B test variations
- Training team members
- Explaining strategy to brokers
- Debugging performance issues

Keep updated as you learn what works.

---

## Appendix: Complete Email Copy

### Campaign 1: No More Payments

**Email 1 - Subject:** {{property_city}} - eliminate your monthly mortgage payment

**Email 2 - Subject:** Quick question about your {{property_city}} home

**Email 3 - Subject:** Two {{property_city}} homeowners just did this

**Email 4 - Subject:** Final message - {{property_city}}

*(Full copy available in Campaign_1_No_More_Payments.html)*

### Campaign 2: Cash Unlocked

**Email 1 - Subject:** Your {{property_city}} home - {{equity_formatted_short}} available

**Email 2 - Subject:** Four ways to use your {{estimated_equity}} equity

**Email 3 - Subject:** Two real examples from {{property_city}}

**Email 4 - Subject:** Last message - your home equity options

*(Full copy available in Campaign_2_Cash_Unlocked.html)*

### Campaign 3: High Equity Special

**Email 1 - Subject:** Your {{property_city}} home - {{equity_formatted_short}} in equity

**Email 2 - Subject:** Smart options for high-equity homeowners

**Email 3 - Subject:** Include your financial advisor in this conversation

**Email 4 - Subject:** Final message - your equity breakdown

*(Full copy available in Campaign_3_High_Equity_Special.html)*

---

**END OF GUIDE**
