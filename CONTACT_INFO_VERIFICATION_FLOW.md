# Contact Info Verification Flow

## The Two Scenarios

### Scenario 1: CALLER INFORMATION Has Data (Returning Lead)
**Barbara verifies existing info:**
- ✅ Phone exists → Verify it's still correct
- ✅ Email exists → Verify it's still correct
- ✅ Last name exists → Use it
- ✅ Address exists → Verify it

**Example:**
```
CALLER INFORMATION:
- first_name: "John"
- last_name: "Smith"
- primary_phone: "+16505300051"
- primary_email: "john.smith@gmail.com"
- city: "San Francisco"
```

**Barbara says:**
- "Walter will call you at this number: six five zero, five three zero, zero zero five one. Is that the best number?" → **Verify**
- "I'll send a calendar invite to john.smith@gmail.com. Is that still the best email?" → **Verify**
- "And just to confirm your address in San Francisco?" → **Verify**

**Result:**
- If they confirm all → ✅ Book appointment (all info verified)
- If they correct something → Update with `update_lead_info`, then book

---

### Scenario 2: CALLER INFORMATION Missing Data (New Lead)
**Barbara collects missing info:**
- ❌ No phone → Collect it
- ❌ No email → Collect it
- ❌ No last name → Collect it
- ❌ No address → Collect it

**Example:**
```
CALLER INFORMATION:
- first_name: "John"
- last_name: null
- primary_phone: null
- primary_email: null
- city: null
```

**Barbara says:**
- "What's the best number for Walter to call you?" → **Collect**
- "And what's your email address so I can send you a calendar invite?" → **Collect**
- "Could I get your last name for the appointment?" → **Collect**
- "And what city are you in?" → **Collect**

**Result:**
- All info collected → Update with `update_lead_info` → Book appointment

---

## Complete Flow Chart

```
┌─────────────────────────────────────┐
│  Appointment Time Confirmed         │
│  (Lead said "yes" to Tuesday 10AM)  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  CHECK: Do we have PHONE?           │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
    ✅ YES            ❌ NO
       │                │
       ▼                ▼
   VERIFY IT        COLLECT IT
   "Is 650...      "What's the
   still good?"    best number?"
       │                │
       └────────┬───────┘
                ▼
       Update if changed/collected
                │
                ▼
┌─────────────────────────────────────┐
│  CHECK: Do we have EMAIL?           │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
    ✅ YES            ❌ NO
       │                │
       ▼                ▼
   VERIFY IT        COLLECT IT
   "Is john@...    "What's your
   still good?"    email?"
       │                │
       └────────┬───────┘
                ▼
       Spell it back to verify
       Update if changed/collected
                │
                ▼
┌─────────────────────────────────────┐
│  CHECK: Do we have LAST NAME?       │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
    ✅ YES            ❌ NO
       │                │
       ▼                ▼
   USE IT          COLLECT IT
   (move on)       "Last name?"
       │                │
       └────────┬───────┘
                ▼
       Update if collected
                │
                ▼
┌─────────────────────────────────────┐
│  CHECK: Do we have ADDRESS/CITY?    │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
    ✅ YES            ❌ NO
       │                │
       ▼                ▼
   VERIFY IT        COLLECT IT
   "Confirm        "What city
   San Fran?"      are you in?"
       │                │
       └────────┬───────┘
                ▼
       Update if changed/collected
                │
                ▼
┌─────────────────────────────────────┐
│  ALL GAPS FILLED!                   │
│  Ready to book appointment          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  BOOK APPOINTMENT                   │
│  Call book_appointment tool         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Calendar invite sent (if email)    │
│  Appointment confirmed              │
└─────────────────────────────────────┘
```

## Key Rules

### ALWAYS Verify if Exists
- ✅ Phone exists → Verify
- ✅ Email exists → Verify
- ✅ Address exists → Verify

### ALWAYS Collect if Missing
- ❌ Phone missing → Collect
- ❌ Email missing → Collect
- ❌ Last name missing → Collect
- ❌ Address missing → Collect

### ALWAYS Repeat Back
- 📞 Phone → Repeat digits
- 📧 Email → Spell it out
- 🏠 Address → Confirm city

### ALWAYS Update Database
- Use `update_lead_info` tool for any:
  - New info collected
  - Corrected info verified
  - Changed info updated

## Example Conversations

### Example 1: All Info Exists (Just Verify)
**Barbara:** "Perfect! Let me get that booked... You're all set for Tuesday at 10 AM."

**Barbara:** "Walter will call you at six five zero, five three zero, zero zero five one. Is that the best number?"

**Lead:** "Yes."

**Barbara:** "I'll send a calendar invite to john.smith@gmail.com. Is that still the best email?"

**Lead:** "Yes."

**Barbara:** "Perfect! You'll get a calendar invite shortly. Thank you, John!"

---

### Example 2: Missing Email (Collect It)
**Barbara:** "Perfect! Let me get that booked... You're all set for Tuesday at 10 AM."

**Barbara:** "Walter will call you at six five zero, five three zero, zero zero five one. Is that the best number?"

**Lead:** "Yes."

**Barbara:** "And what's your email address so I can send you a calendar invite?"

**Lead:** "john.smith@gmail.com"

**Barbara:** "Perfect! So that's J-O-H-N dot S-M-I-T-H at G-mail dot com?"

**Lead:** "Yes."

**Barbara:** "Excellent! You'll get a calendar invite shortly. Thank you, John!"

---

### Example 3: Phone Changed (Update It)
**Barbara:** "Perfect! Let me get that booked... You're all set for Tuesday at 10 AM."

**Barbara:** "Walter will call you at six five zero, five three zero, zero zero five one. Is that the best number?"

**Lead:** "Actually, my new number is 415-555-1234."

**Barbara:** "Got it! So that's four one five, five five five, one two three four?"

**Lead:** "Yes."

**Barbara:** *[Calls update_lead_info with new phone]*

**Barbara:** "Perfect! Walter will call you at that number. And what's your email for the calendar invite?"

---

## Bottom Line

**GOAL: Fill in ALL gaps before booking**

- ✅ If info exists → Verify it
- ❌ If info missing → Collect it
- 🔄 If info changed → Update it

**After verification/collection → Book appointment with complete, accurate contact info!** 📅
