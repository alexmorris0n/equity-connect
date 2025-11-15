---

### Category 5: Additional Edge Cases (7 scenarios)

#### Scenario 14: Low-Tech Caller (no email/text)
- Caller cannot receive email/SMS confirmations.
- BOOK should capture mailing address, offer reminder call, set low_tech_user=true.
- EXIT reiterates phone-based reminder.

#### Scenario 15: Language Preference Shift Mid-Call
- Caller starts in English, then requests Spanish mid-flow.
- GREET/VERIFY detect preference, set preferred_language, ensure router restarts appropriate persona or exits gracefully.

#### Scenario 16: Multiple Properties with Conflicting Info
- Caller owns two homes and mixes details.
- QUALIFY/QUOTE must align on one property, update notes for broker.

#### Scenario 17: Confirmation Failure After Booking
- BOOK succeeds but send_appointment_confirmation fails.
- Should set confirmation_pending=true and EXIT explains manual follow-up.

#### Scenario 18: DNC/Compliance Trigger
- Caller says "I'm on the Do Not Call list" after greeting.
- GREET/EXIT must mark do_not_contact=true and exit immediately.

#### Scenario 19: No Broker Calendars Available
- Territory lacks active broker or calendar connection.
- BOOK detects missing 
ylas_grant_id, sets manual_booking_required=true, EXIT promises callback.

#### Scenario 20: Lead Already in Application Status
- conversation_state shows qualified=true but CRM status "application".
- GREET should recognize and route to EXIT with "already in process" messaging.
