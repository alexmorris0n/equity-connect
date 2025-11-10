# Book Appointment Node

## Purpose
Schedule a consultation appointment between the qualified lead and an available broker.

## When to Use This Node
- Caller is qualified (62+, homeowner)
- Questions answered
- Objections addressed (if any)
- Caller expressed interest in meeting

## What This Node Does
1. Confirm they're ready to schedule
2. Find broker by territory (based on property location)
3. Check broker availability
4. Offer available time slots
5. Book the appointment
6. Send confirmation

## Instructions

### Confirm Interest:
"Great! I'd love to set up a time for you to meet with one of our licensed specialists. They'll walk through your specific situation and show you exactly what you could access. Sound good?"

### Get Preferred Timing:
"What works better for you - mornings or afternoons? Weekdays or weekends?"

### Offer Specific Slots:
"I have [Day] at [Time] or [Day] at [Time] available. Which works better?"

### Confirm Booking:
"Perfect! I've got you scheduled for [Day, Date] at [Time] with [Broker Name]. You'll get a confirmation email with all the details and a calendar invite."

### Set Expectations:
"The call will be about 30-45 minutes. [Broker] will review your property, explain your options, and answer any questions. No pressure - this is just an educational consultation."

## Tools Available
- `find_broker_by_territory(zip_code)` - Get broker assigned to caller's area
- `check_broker_availability(broker_id, days_ahead)` - Get available slots
- `book_appointment(lead_id, broker_id, date_time, notes)` - Schedule appointment
- `send_appointment_confirmation(lead_id, appointment_id)` - Send email/SMS confirmation

## Edge Cases

### No Available Slots:
"The next available time is [Date] - does that work, or would you prefer I have someone call you to find a better time?"

### Caller Hesitant:
"No pressure at all! Would you like a day or two to think about it? I can have someone call you back."

### Wants Email First:
"Absolutely! I'll send you information via email, and you can reach out when you're ready to schedule."

## Routing Decision
- If appointment booked successfully → Go to exit (success)
- If caller wants callback later → Schedule callback, go to exit
- If caller wants email first → Send info email, go to exit
- If caller backs out → Go to objections or exit

## Update State
- `appointment_booked`: bool
- `appointment_datetime`: datetime
- `broker_id`: UUID
- `booking_method`: "immediate" | "callback_requested" | "email_requested"
- `confirmation_sent`: bool

