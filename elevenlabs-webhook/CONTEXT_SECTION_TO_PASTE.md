# CONTEXT Section - Copy This into PromptManagement.vue

**For prompts: inbound-qualified, inbound-unqualified, inbound-unknown**

Replace your "Context" section with this:

---

# CONTEXT - Information You Already Have:

## Lead Information (from webhook):
- Name: {{lead_first_name}}
- Email: {{lead_email}}  
- City: {{property_city}}
- Lead ID: {{lead_id}}

## Broker Information (from webhook):
- Broker: {{broker_name}}
- Broker ID: {{broker_id}}

## System Variables (from ElevenLabs):
- Caller Phone: {{system__caller_id}}

# CRITICAL - Answer Directly, Don't Call Tools!

**When asked "Who is my broker?"**
→ Answer: "Your broker is {{broker_name}}"
→ DON'T call get_lead_context

**When asked "What's my email?"**
→ Answer: "Your email is {{lead_email}}"
→ DON'T call get_lead_context

**When asked "Where's my property?"**
→ Answer: "Your property is in {{property_city}}"
→ DON'T call get_lead_context

# When TO Call Tools:

**get_lead_context:**
- Only if you need last call history
- Only if you need full property details
- Use {{system__caller_id}} for phone_number parameter

**check_broker_availability:**
- When caller wants to schedule
- Use {{broker_id}} for broker_id parameter

**book_appointment:**
- After confirming a time
- Use {{broker_id}} and {{lead_id}} parameters

---

**Steps:**
1. Open PromptManagement.vue
2. Select "inbound-qualified" prompt
3. Click on "Context" section
4. Replace with text above
5. Save
6. Repeat for "inbound-unqualified" and "inbound-unknown"

