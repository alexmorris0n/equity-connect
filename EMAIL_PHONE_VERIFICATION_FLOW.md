# Email & Phone Verification Flow

## Why This Matters

**Calendar invites are only sent if the lead has a valid email address.**

Without verified contact info:
- ❌ Lead doesn't get calendar invite
- ❌ Lead might forget appointment
- ❌ Broker wastes time calling no-shows
- ❌ Lost revenue

With verified contact info:
- ✅ Lead gets calendar invite
- ✅ Lead has reminder on their phone
- ✅ Better show-up rates
- ✅ More revenue

## How Calendar Invites Work

### In `bookAppointment` Function (bridge/tools.js)

```javascript
// Get lead info
const { data: lead } = await sb
  .from('leads')
  .select('first_name, last_name, primary_phone, primary_email')
  .eq('id', lead_id)
  .single();

const leadEmail = lead.primary_email || null;

// Create event with participants
const eventBody = {
  title: `Reverse Mortgage Consultation - ${leadName}`,
  participants: [
    {
      name: broker.contact_name,
      email: broker.email  // Broker always gets invite
    }
  ],
  // ... rest of event
};

// Add lead as participant ONLY if they have email
if (leadEmail) {
  eventBody.participants.push({
    name: leadName,
    email: leadEmail  // Lead gets invite too!
  });
}
```

**Result:**
- ✅ Broker always gets calendar event (on their calendar)
- ✅ Lead gets calendar invite IF they have valid email
- ❌ Lead gets nothing if no email in database

## Barbara's Contact Verification Flow

### Step 1: Check Existing Data
Barbara receives CALLER INFORMATION with:
- `primary_phone` - from call metadata or database
- `primary_email` - from database (might be null)

### Step 2: Verify Phone Number
**After booking appointment:**

Barbara says:
- "[Broker name] will call you at this number: [repeat phone]. Is that the best number?"

**If they correct it:**
- Barbara calls `update_lead_info` with new phone
- Database updated immediately

**If no phone or unclear:**
- "What's the best number for [broker name] to call you?"
- Get phone number
- Call `update_lead_info` to save it

### Step 3: Collect/Verify Email
**For calendar invite:**

**If NO email in database:**
- "And what's your email address so I can send you a calendar invite?"
- Get email from lead
- **CRITICAL:** Spell it back: "So that's J-O-H-N dot S-M-I-T-H at G-mail dot com?"
- Call `update_lead_info` to save it

**If email EXISTS in database:**
- "I'll send a calendar invite to [their email]. Is that still the best email?"
- **If they correct it:** Get new email, spell it back, update database

**If they don't have email or decline:**
- "No problem! [Broker name] will give you a call at the scheduled time."
- Book appointment anyway (phone call is primary contact method)

### Step 4: Book Appointment
- Barbara calls `book_appointment` with lead_id
- Function checks database for `primary_email`
- If email exists → Lead gets calendar invite
- If no email → Only broker gets calendar event

## Example Conversation

**Barbara:** "Perfect! Let me get that booked for you... Just confirming it in the calendar... Excellent! You're all set for Tuesday at 10 AM."

**Barbara:** "[Broker name] will call you at this number: six five zero, five three zero, zero zero five one. Is that the best number to reach you?"

**Lead:** "Yes, that's right."

**Barbara:** "And what's your email address so I can send you a calendar invite?"

**Lead:** "john.smith@gmail.com"

**Barbara:** "Perfect! So that's J-O-H-N dot S-M-I-T-H at G-mail dot com?"

**Lead:** "Yes."

**Barbara:** "Excellent! I've sent you a calendar invite for Tuesday at 10 AM. Would you like a text reminder the day before?"

**Lead:** "Sure!"

**Barbara:** "Perfect! Thank you so much, John, and have a wonderful day!"

## What Happens After Booking

### If Lead Has Email
1. ✅ Appointment booked in database
2. ✅ Calendar event created on broker's calendar
3. ✅ Calendar invite sent to lead's email
4. ✅ Lead sees appointment in their calendar app
5. ✅ Lead gets reminder notifications
6. ✅ Higher show-up rate

### If Lead Has NO Email
1. ✅ Appointment booked in database
2. ✅ Calendar event created on broker's calendar
3. ❌ No calendar invite sent to lead
4. ⚠️ Lead relies on memory or text reminder
5. ⚠️ Lower show-up rate

## Implementation Checklist

### Already Implemented ✅
- ✅ `bookAppointment` checks for `primary_email`
- ✅ Calendar invite sent if email exists
- ✅ Prompt includes phone verification
- ✅ Prompt includes email collection/verification
- ✅ Prompt spells back email for accuracy

### What Barbara Does Automatically
- ✅ Verifies phone number
- ✅ Collects email if missing
- ✅ Spells back email to verify
- ✅ Updates database with `update_lead_info`
- ✅ Books appointment with verified contact info

## Best Practices

### For Cold Leads (No Email in Database)
1. Always ask for email
2. Spell it back to verify
3. Emphasize benefit: "so I can send you a calendar invite"
4. If they decline, book anyway (phone is primary)

### For Returning Leads (Email in Database)
1. Verify email is still current
2. If they update it, spell it back
3. Update database immediately

### For Leads Without Email
1. Don't pressure them
2. Emphasize phone call as primary contact
3. Offer text reminder as alternative
4. Book appointment anyway

## Revenue Impact

**With verified email:**
- 📧 Lead gets calendar invite
- 📱 Lead gets phone/watch notifications
- ✅ Higher show-up rate (60-80%)
- 💰 More revenue

**Without email:**
- 📞 Lead relies on memory
- ⚠️ Lower show-up rate (30-50%)
- 💸 Lost revenue

**Collecting and verifying email = Higher conversion = More money!** 💰
