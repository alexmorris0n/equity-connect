# Tool Calling in Prompt - Complete Summary

## ✅ Tool Calling is Now Fully Documented

### Location 1: Best Practices (Line 67-73)
```markdown
## Tool Calls - Keep Talking
**When calling tools (check_broker_availability, book_appointment, etc.):**
- **Talk WHILE the tool executes** - Don't wait in silence
- Narrate what you're doing: "Let me check what's available..."
- Continue naturally: "Just pulling up the calendar now..."
- When result comes back: "Okay! I see Tuesday at 10 or Thursday at 2..."
- **NEVER pause in silence** - Keep the conversation flowing
```

### Location 2: TOOLS Section (Lines 722-795)

**check_broker_availability:**
```javascript
check_broker_availability({
  broker_id: "broker-uuid",
  preferred_day: "tuesday",
  preferred_time: "morning"
})
```
- Call WHILE saying: "Let me check what's available..."
- Returns: Smart prioritized slots (today > tomorrow > next week)

**book_appointment:**
```javascript
book_appointment({
  lead_id: "lead-uuid",
  broker_id: "broker-uuid",
  scheduled_for: "2025-10-22T10:00:00Z",
  notes: "Interested in medical expenses"
})
```
- Call WHILE saying: "Let me get that booked..."
- Creates calendar event + sends invite (if email)

**update_lead_info:**
```javascript
update_lead_info({
  lead_id: "lead-uuid",
  primary_phone: "+16505300051",
  primary_email: "john.smith@gmail.com",
  last_name: "Smith",
  city: "San Francisco"
})
```
- Call silently when collecting/correcting info

**assign_tracking_number:**
```javascript
assign_tracking_number({
  lead_id: "lead-uuid",
  broker_id: "broker-uuid",
  signalwire_number: "+14244851544",
  appointment_datetime: "2025-10-22T10:00:00Z"
})
```
- Call IMMEDIATELY after booking
- Silent/automatic (don't announce)

**save_interaction:**
- Call at END of every call
- Saves structured context for next call

### Location 3: Booking Flow (Lines 512-575)

**Explicit tool calls in conversation flow:**

```markdown
**If they say YES to a time:**
- Say: "Perfect! Let me get that booked for you..."
- **CALL TOOL:** `book_appointment({ lead_id, broker_id, scheduled_for, notes })`
- Keep talking: "Just confirming it in the calendar..."
- When tool returns: "Excellent! You're all set for [day] at [time]."
- **CALL TOOL (silent):** `assign_tracking_number({ lead_id, broker_id, signalwire_number, appointment_datetime })`

**If they say NO or want a different time:**
- Say: "No problem! Let me check what else is available..."
- **CALL TOOL:** `check_broker_availability({ broker_id, preferred_day, preferred_time })`
- Present new options

**Phone/Email/Name/City updates:**
- **CALL:** `update_lead_info({ lead_id, primary_phone, primary_email, last_name, city })`
```

### Location 4: Critical Reminders (Lines 898-903)

```markdown
12. ✅ **TOOL CALLS:**
    - **check_broker_availability** - Before suggesting appointment times
    - **book_appointment** - When they confirm a time
    - **assign_tracking_number** - Immediately after booking (silent/automatic)
    - **update_lead_info** - When collecting/correcting contact info (silent)
    - **save_interaction** - At end of EVERY call with structured context
```

---

## Complete Tool Call Sequence

### During Booking Flow:

1. **Check Availability**
   ```
   Barbara: "Let me check what's available..."
   CALL: check_broker_availability(...)
   Barbara: "Just pulling up the calendar..."
   RESULT: "I have Tuesday at 10 AM or Thursday at 2 PM"
   ```

2. **Negotiate (if needed)**
   ```
   Lead: "Can we do Wednesday instead?"
   Barbara: "Let me check if Wednesday works..."
   CALL: check_broker_availability(...preferred_day: "wednesday")
   Barbara: "Yes! Wednesday at 11 AM is open"
   ```

3. **Book Appointment**
   ```
   Lead: "Wednesday at 11 works!"
   Barbara: "Perfect! Let me get that booked..."
   CALL: book_appointment(...)
   Barbara: "Just confirming it in the calendar..."
   RESULT: "Excellent! You're all set for Wednesday at 11 AM"
   ```

4. **Assign Tracking (Silent)**
   ```
   CALL: assign_tracking_number(...) [SILENT - don't announce]
   ```

5. **Update Contact Info (as needed)**
   ```
   Lead: "My new email is john@gmail.com"
   Barbara: "So that's J-O-H-N at G-mail dot com?"
   Lead: "Yes"
   CALL: update_lead_info({ primary_email: "john@gmail.com" }) [SILENT]
   ```

6. **Save Interaction (at end)**
   ```
   Barbara: "Thank you so much, John! Have a wonderful day!"
   CALL: save_interaction(...) [SILENT - before hanging up]
   ```

---

## Best Practices Summary

### ✅ DO:
- Talk WHILE tools execute
- Keep conversation flowing
- Use exact tool names from prompt
- Call assign_tracking_number immediately after booking
- Spell back email addresses
- Update contact info silently

### ❌ DON'T:
- Pause in silence while waiting for tools
- Announce silent tools (assign_tracking_number, update_lead_info)
- Skip any tools in the sequence
- Forget to save_interaction at end

---

## Answer to Your Question:

**Yes! Tool calling is fully documented in:**

1. ✅ Best Practices section (how to talk while calling)
2. ✅ TOOLS section (each tool explained with examples)
3. ✅ Booking Flow section (explicit CALL TOOL instructions)
4. ✅ Critical Reminders (all tools listed)

**Barbara knows exactly when and how to call each tool!** 🎯
