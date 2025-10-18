# Compliance - Simple Rules

**TL;DR:** Email = no consent. Calls = consent required.

---

## ✅ Cold Email (What You're Doing Sunday)

### CAN-SPAM Act Requirements

**You CAN:**
- ✅ Send cold emails without asking permission first
- ✅ Buy email lists (like from PropertyRadar)
- ✅ Send to anyone with a business inquiry
- ✅ Follow up multiple times (but include unsubscribe)

**You MUST:**
- ✅ Include working unsubscribe link (Instantly auto-adds)
- ✅ Include physical mailing address (Instantly auto-adds)
- ✅ Use accurate "From" name and subject line
- ✅ Honor unsubscribe requests within 10 days
- ✅ Process unsubscribes for 30 days after

**You DON'T Need:**
- ❌ Consent forms before sending
- ❌ Opt-in confirmation
- ❌ DNC registry check (that's for phone calls)
- ❌ Special permissions

**Instantly.ai handles all CAN-SPAM requirements automatically.**

---

## ❌ Phone Calls (NOT Until After They Reply)

### TCPA (Telephone Consumer Protection Act)

**You CANNOT:**
- ❌ Call without prior express written consent
- ❌ Use auto-dialers without consent
- ❌ Send SMS without consent
- ❌ Call before 8am or after 9pm local time

**You MUST:**
- ✅ Get written/electronic consent BEFORE calling
- ✅ Check National DNC Registry before each call
- ✅ Provide easy opt-out method
- ✅ Keep consent records for 4 years
- ✅ Honor do-not-call requests immediately

### When Consent is Required:

**Our Flow:**
```
1. Send cold email (NO CONSENT NEEDED ✅)
   ↓
2. Lead replies "YES, interested"
   ↓
3. Send consent form: "May we call you?" ← TCPA CONSENT STARTS HERE
   ↓
4. Lead submits form → consent recorded
   ↓
5. NOW you can call them ✅
```

**Consent form must ask:**
- "Do you consent to receive calls about reverse mortgage options?"
- Clear checkbox or "I agree" button
- Includes disclosure about auto-dialer (if using VAPI)
- Records timestamp, IP, and consent method

---

## 🎯 Your Implementation

### Email Campaigns (Sunday)
**Compliance:** CAN-SPAM  
**Consent needed:** NO  
**What to do:** Send cold emails via Instantly with unsubscribe link  
**Tools:** Instantly.ai handles all compliance automatically

### Phone Calls (After Replies - Monday)
**Compliance:** TCPA  
**Consent needed:** YES  
**What to do:** Send consent form when lead replies with interest  
**Tools:** n8n reply handler + consent form + database recording

---

## 🚨 Penalties to Avoid

### CAN-SPAM Violations
- **Penalty:** Up to $51,744 per email
- **Common violations:** No unsubscribe, misleading subject, no physical address
- **How to avoid:** Use Instantly (it handles everything)

### TCPA Violations
- **Penalty:** $500-$1,500 per call
- **Common violations:** Calling without consent, calling DNC numbers, calling after 9pm
- **How to avoid:** NEVER call until consent form is submitted

---

## ✅ Simple Checklist

### Before Sending Email:
- [x] Using Instantly.ai or similar platform
- [x] Unsubscribe link included (auto)
- [x] Physical address included (auto)
- [x] Sender name is real (broker or company)
- [x] Subject line is accurate

### Before Making Phone Call:
- [ ] Lead replied with interest to email
- [ ] Consent form sent and submitted
- [ ] Consent timestamp recorded in database
- [ ] DNC registry checked (number not on list)
- [ ] Calling between 8am-9pm lead's local time

---

**That's it! Email = easy. Calls = get consent first.**

