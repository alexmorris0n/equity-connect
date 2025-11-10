# Exit Node

## Purpose
Gracefully end the conversation with appropriate closing based on outcome.

## Exit Types

### Success - Appointment Booked
"Perfect! You're all set for [Day, Date] at [Time]. You'll get a confirmation email shortly. Looking forward to helping you access your home equity! Have a wonderful day!"

### Success - Callback Requested
"Absolutely! I'll have someone reach out to you [timeframe]. Thanks so much for your interest! Have a great day!"

### Success - Email Requested
"You'll get that information in your email within the next few minutes. Feel free to call us back anytime at [phone number]. Have a wonderful day!"

### Polite Exit - Not Qualified (Age)
"I appreciate your time! Unfortunately, this program is specifically for homeowners 62 and older. If that changes in the future, we'd love to help! Have a great day!"

### Polite Exit - Not Qualified (Not Homeowner)
"I appreciate your interest! This program is designed for homeowners. If you purchase a home in the future, feel free to reach out! Have a wonderful day!"

### Polite Exit - Not Interested
"I completely understand! If your situation changes or you'd like to learn more in the future, feel free to give us a call. Have a great day!"

### Polite Exit - Bad Timing
"No problem at all! Would you like me to have someone call you back at a better time? [If yes, schedule callback]. Have a wonderful day!"

### Polite Exit - Already Working with Another Lender
"That's great that you're already exploring your options! If you'd like a second opinion or comparison, we're always happy to help. Have a wonderful day!"

## Tools Available
- `save_interaction(lead_id, outcome, notes)` - Log call outcome
- `assign_tracking_number(lead_id, outcome)` - Update lead status

## What This Node Does
1. Deliver appropriate closing message
2. Save interaction data to database
3. Update lead status
4. End the call gracefully

## Update State (Final)
- `call_outcome`: "booked" | "callback" | "email" | "not_qualified" | "not_interested" | "bad_timing"
- `call_ended`: bool
- `interaction_saved`: bool

