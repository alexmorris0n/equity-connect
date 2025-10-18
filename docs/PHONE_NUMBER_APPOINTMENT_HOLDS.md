# Phone Number Appointment Holds

## Overview

When Barbara (VAPI AI agent) books an appointment with a lead, the assigned phone number must stay with that lead through the appointment and follow-up period. This ensures the lead can call back on the same number.

---

## 📅 Phone Number Lifecycle with Appointments

### **Scenario 1: No Appointment Booked**
```
Lead provides phone
  ↓
Phone assigned (18-hour hold)
  ↓
18 hours pass
  ↓
Phone released back to pool ✅
```

### **Scenario 2: Appointment Booked**
```
Lead provides phone
  ↓
Phone assigned (18-hour hold)
  ↓
Barbara books appointment for Oct 20, 2pm
  ↓
Phone hold EXTENDED to Oct 21, 2pm (appt + 24hrs)
  ↓
Appointment happens
  ↓
24 hours after appointment
  ↓
Phone released back to pool ✅
```

### **Scenario 3: No-Show**
```
Lead books appointment
  ↓
Phone held until appt + 24hrs
  ↓
Lead doesn't show up
  ↓
Broker marks as "no_show"
  ↓
24 hours from now (follow-up window)
  ↓
Phone released ✅
```

### **Scenario 4: Cancellation/Reschedule**
```
Lead books appointment
  ↓
Lead calls to cancel
  ↓
Broker marks as "cancelled" or "rescheduled"
  ↓
Phone IMMEDIATELY released
  ↓
New appointment booked (if rescheduled)
  ↓
Phone hold re-extended ✅
```

---

## 🔧 Integration Points

### **1. When Barbara Books Appointment (VAPI Call)**

Barbara needs to call the database function after successfully booking:

**Option A: VAPI Server-Side Function Tool**
Configure a VAPI function tool that calls your n8n webhook:

```json
{
  "type": "function",
  "name": "book_appointment",
  "description": "Book appointment and extend phone hold",
  "parameters": {
    "type": "object",
    "properties": {
      "lead_id": { "type": "string", "description": "Lead UUID" },
      "appointment_time": { "type": "string", "description": "ISO timestamp" }
    },
    "required": ["lead_id", "appointment_time"]
  },
  "server": {
    "url": "https://n8n.instaroute.com/webhook/vapi-appointment-booked"
  }
}
```

**Option B: VAPI Webhook (End of Call Summary)**
Send call metadata to webhook, which processes appointment bookings:

```json
POST https://n8n.instaroute.com/webhook/vapi-call-ended
{
  "callId": "...",
  "leadId": "07f26a19-e9dc-422c-b61d-030e3c7971bb",
  "outcome": "appointment_booked",
  "appointmentTime": "2025-10-20T14:00:00Z",
  "transcript": "..."
}
```

### **2. n8n Workflow to Handle Booking**

Create workflow: `VAPI_Appointment_Phone_Extension.json`

```
Webhook Trigger (VAPI)
  ↓
Extract: lead_id, appointment_time
  ↓
Supabase: Call extend_phone_for_appointment()
  ↓
Update leads table: appointment_scheduled_at
  ↓
Send confirmation (Slack/email)
```

**SQL Query in Supabase Node:**
```sql
SELECT extend_phone_for_appointment(
  '{{ $json.lead_id }}'::UUID,
  '{{ $json.appointment_time }}'::TIMESTAMP
);
```

### **3. After Appointment Completes**

When broker marks appointment outcome:

**n8n Workflow:** `Appointment_Outcome_Handler.json`

```
Calendar Webhook OR Manual Trigger
  ↓
Extract: lead_id, outcome (showed/no_show/cancelled)
  ↓
Supabase: Call complete_appointment_for_phone()
  ↓
Update leads table: status
  ↓
Log to interactions table
```

**SQL Query:**
```sql
SELECT complete_appointment_for_phone(
  '{{ $json.lead_id }}'::UUID,
  '{{ $json.outcome }}'  -- 'showed', 'no_show', 'cancelled', 'rescheduled'
);
```

---

## 📊 Monitoring Appointments & Phone Holds

### Check Current Appointments
```sql
SELECT 
  l.first_name,
  l.last_name,
  l.primary_email,
  spn.number as assigned_phone,
  spn.appointment_scheduled_at,
  spn.release_at,
  CASE 
    WHEN spn.appointment_scheduled_at IS NULL THEN 'No appointment'
    WHEN spn.appointment_scheduled_at > NOW() THEN 'Pending (' || 
      ROUND(EXTRACT(EPOCH FROM (spn.appointment_scheduled_at - NOW()))/3600, 1) || ' hrs)'
    WHEN spn.appointment_scheduled_at + INTERVAL '24 hours' > NOW() THEN 'Follow-up window'
    ELSE 'Completed + grace period over'
  END as appointment_status,
  spn.last_call_outcome
FROM leads l
JOIN signalwire_phone_numbers spn ON spn.currently_assigned_to = l.id
WHERE spn.appointment_scheduled_at IS NOT NULL
ORDER BY spn.appointment_scheduled_at ASC;
```

### Check Expired Phones (Should Be Empty After Release Function Runs)
```sql
SELECT 
  number,
  name,
  assignment_status,
  release_at,
  appointment_scheduled_at,
  EXTRACT(EPOCH FROM (NOW() - release_at))/3600 as hours_overdue
FROM signalwire_phone_numbers
WHERE release_at IS NOT NULL 
  AND release_at < NOW()
  AND assignment_status = 'assigned'
  AND (
    appointment_scheduled_at IS NULL 
    OR appointment_scheduled_at + INTERVAL '24 hours' <= NOW()
  );
```

---

## ⚠️ Important Notes

### **Phone Release Priority**
1. ✅ **Appointment scheduled in future** → Keep assigned
2. ✅ **Appointment within last 24 hours** → Keep assigned (follow-up window)
3. ✅ **Appointment was 24+ hours ago** → Release to pool
4. ✅ **No appointment + 18 hours passed** → Release to pool

### **Edge Cases**

**Lead replies again AFTER booking:**
- Phone already assigned → Reuse same phone ✅
- Release time already extended → No change needed ✅

**Appointment gets rescheduled:**
- Call `complete_appointment_for_phone('rescheduled')` → Releases immediately
- Then call `extend_phone_for_appointment(new_time)` → Re-extends hold

**Lead cancels appointment:**
- Call `complete_appointment_for_phone('cancelled')` → Releases immediately
- Phone becomes available for next lead

**Multiple appointments (follow-up consultations):**
- Each time appointment booked, extend to latest appointment + 24 hours
- Phone stays with lead through entire consultation series

---

## 🚀 Setup Checklist

- [x] ✅ Database functions created (`extend_phone_for_appointment`, `complete_appointment_for_phone`)
- [x] ✅ Release function updated to check appointments
- [ ] 🔲 VAPI function tool configured for Barbara
- [ ] 🔲 n8n webhook created for appointment bookings
- [ ] 🔲 n8n workflow to call `extend_phone_for_appointment()`
- [ ] 🔲 n8n workflow to call `complete_appointment_for_phone()`
- [ ] 🔲 Calendar integration webhooks configured
- [ ] 🔲 Monitoring dashboard showing appointment holds

---

## 🧪 Testing

### Test 1: Book Appointment
```sql
-- Simulate Barbara booking appointment
SELECT extend_phone_for_appointment(
  '07f26a19-e9dc-422c-b61d-030e3c7971bb'::UUID,
  NOW() + INTERVAL '2 days'  -- Appointment in 2 days
);

-- Verify: release_at should be 2 days + 24 hours from now
SELECT 
  number,
  appointment_scheduled_at,
  release_at,
  EXTRACT(EPOCH FROM (release_at - NOW()))/3600 as hours_until_release
FROM signalwire_phone_numbers
WHERE currently_assigned_to = '07f26a19-e9dc-422c-b61d-030e3c7971bb';
```

### Test 2: Mark as Showed
```sql
-- Lead showed up to appointment
SELECT complete_appointment_for_phone(
  '07f26a19-e9dc-422c-b61d-030e3c7971bb'::UUID,
  'showed'
);

-- Verify: release_at should be ~24 hours from now
SELECT 
  number,
  last_call_outcome,
  release_at,
  EXTRACT(EPOCH FROM (release_at - NOW()))/3600 as hours_until_release
FROM signalwire_phone_numbers
WHERE currently_assigned_to = '07f26a19-e9dc-422c-b61d-030e3c7971bb';
```

### Test 3: Cancellation
```sql
-- Lead cancels appointment
SELECT complete_appointment_for_phone(
  '07f26a19-e9dc-422c-b61d-030e3c7971bb'::UUID,
  'cancelled'
);

-- Verify: release_at should be NOW (immediate release)
SELECT 
  number,
  last_call_outcome,
  release_at,
  release_at <= NOW() as ready_to_release
FROM signalwire_phone_numbers
WHERE currently_assigned_to = '07f26a19-e9dc-422c-b61d-030e3c7971bb';

-- Run release function
SELECT release_expired_phone_numbers();

-- Verify: phone should now be available
SELECT assignment_status
FROM signalwire_phone_numbers
WHERE vapi_phone_number_id = '...';
-- Should return: 'available'
```

---

## 📝 Next Steps

1. **Configure VAPI Tool** - Add `book_appointment` function to Barbara's VAPI assistant
2. **Create n8n Workflows** - Build webhooks to handle appointment bookings and outcomes
3. **Test Integration** - Run end-to-end test with real VAPI call
4. **Monitor** - Set up dashboard to track appointment holds
5. **Schedule Cleanup** - Ensure `release_expired_phone_numbers()` runs every 15 minutes

---

**Last Updated:** October 18, 2025  
**Migration Applied:** `phone-release-appointment-hold.sql`

