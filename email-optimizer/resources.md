# Email Optimizer Resources & Best Practices

## Audience Profile

- **Age:** 62+ (mostly 65-80)
- **Property:** Long-term homeowners, high equity, Los Angeles area
- **Mindset:** Skeptical of unsolicited financial offers, bombarded with reverse mortgage marketing daily via mail/phone/TV
- **Email behavior:** Deletes emails from strangers about finances -- associates them with scams
- **Domains:** Gmail, Yahoo, Hotmail, AOL, SBCGlobal (consumer domains, not business)

## What's NOT Working (from 3,242 emails, 0% reply rate)

1. Subject lines signal "marketing email" immediately
2. Emails explain the product upfront -- by the time they see "reverse mortgage," they've mentally filed it as spam
3. Calculator link (strongest asset) buried in email #3 instead of email #1
4. 3-step sequences over 11 days -- too long, too much explanation
5. No brand recognition = no trust = delete on sight
6. Copy reads like a pitch, not a person

## Cold Email Best Practices for B2C Seniors

### Subject Lines
- Shorter is better (3-5 words)
- Vague/curiosity-driven outperforms specific/descriptive
- First name only ("{{firstName}}") can work
- "Quick question" consistently performs well across industries
- Avoid anything that signals marketing: offers, benefits, product names
- Never use ALL CAPS or excessive punctuation

### Opening Lines
- Don't introduce yourself first -- lead with relevance
- Questions outperform statements
- Reference something specific about THEM (city, situation)
- Keep first paragraph under 20 words

### Body Copy
- Under 100 words total for email #1 (shorter = higher reply rate for cold email)
- One idea per email, not multiple benefits
- Sound like a human text, not a marketing email
- No bullet points in email #1 -- too formatted, looks like marketing
- Save details for follow-ups

### CTA
- Ask for phone number (primary goal)
- One CTA only -- don't give multiple options
- "Reply with your number" is clean and simple
- Don't over-explain what happens next

### Radical Ideas to Test
- Email #1 with ZERO mention of reverse mortgage -- pure curiosity
- One-line emails ("{{firstName}}, quick question about your home in {{property_city}}?")
- Leading with the calculator link in email #1 instead of burying it
- Removing all product explanation -- just ask if they're interested in learning about their equity options
- Using "Re:" in subject to simulate thread (test carefully -- can backfire)
- Sending email #1 as if replying to a previous conversation

## Compliance Requirements (NEVER VIOLATE)

### Must Include
- Broker NMLS number
- Unsubscribe option ("Reply STOP")
- Business address (Barbara LLC, 6210 Wilshire Blvd Ste 200, LA CA 90048)
- Coordinator signature with Equity Connect

### Language Rules
- Use "approximately" not "exactly" for numbers
- Use "estimated" not "guaranteed"
- Use "may qualify" not "you qualify"
- Use "government-insured" not "risk-free"
- Never say "eliminate debt" -- say "eliminate payment"
- Never say "refinance" -- triggers filters

### Spam Trigger Words (NEVER USE)
- Free, cash, $$$, earn, profit
- Act now, limited time, urgent, expires
- Guarantee, promise, certified
- Click here, buy now, order now
- Special promotion, exclusive deal
- Don't delete, this is not spam
- ALL CAPS anywhere
- Excessive punctuation (!!!)
- Multiple dollar signs

## Instantly Variables Available

```
{{firstName}} - Lead first name
{{property_city}} - City name
{{property_value}} - Formatted ($500,000)
{{estimated_equity}} - Formatted ($480,000)
{{equity_50_percent}} - 50% of equity ($240,000)
{{equity_60_percent}} - 60% of equity ($288,000)
{{equity_formatted_short}} - Short format ($480k)
{{estimated_monthly_payment}} - Monthly payment
{{broker_first_name}} - Broker first name
{{broker_company}} - Broker company
{{broker_nmls}} - NMLS number
{{accountSignature}} - Sender persona name
{{calculator_token}} - Personalized calculator link token
```

## Sending Infrastructure

- 28 Google Workspace accounts across 15 domains
- 6 sender personas
- Warmup scores: 93-100
- Daily limit: 25/account = 700/day max
- Text-only (no HTML)
- Open tracking: disabled (text-only)
