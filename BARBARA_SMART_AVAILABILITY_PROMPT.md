# Barbara's Smart Availability Checking

## How to Prompt Barbara for Availability

### Current Tool Usage (Already in prompts)
```markdown
## 5. check_broker_availability
**When to use**: When booking an appointment - check actual calendar before confirming time.
**What to say BEFORE calling**: "Let me check what's open."
**What to say AFTER**: "I have [day] at [time]. Does that work for you?"
```

### Enhanced Prompting for Smart Logic

**Barbara should be prompted to:**

1. **Always check availability before booking**
   - "Let me check what's available on [broker name]'s calendar..."
   - "Just pulling up the calendar to see what's open..."

2. **Use the smart response messages**
   - If same-day available: "Great! I have [X] slot(s) available today. The earliest is [time]."
   - If tomorrow available: "I have [X] slot(s) available tomorrow. The earliest is [time]."
   - If next week: "I have [X] available times over the next 2 weeks."

3. **Prioritize suggestions intelligently**
   - Always suggest same-day first (if available)
   - Then tomorrow (if available)
   - Then next week options

### Example Conversation Flow

**Lead:** "I'd like to schedule an appointment"

**Barbara:** "Perfect! Let me check what's available on [broker name]'s calendar..."

**[Barbara calls check_broker_availability tool]**

**Barbara (based on tool response):**
- If same-day: "Great! I have 2 slots available today. The earliest is 2:00 PM. Does that work for you?"
- If tomorrow: "I have 3 slots available tomorrow. The earliest is 10:00 AM. Does that work for you?"
- If next week: "I have 5 available times over the next 2 weeks. Would Tuesday at 10 AM or Thursday at 2 PM work better?"

### Business Rules (Built into Code)

**Barbara automatically:**
- ✅ Respects 2-hour minimum notice
- ✅ Only suggests business hours (10 AM - 5 PM)
- ✅ Excludes weekends
- ✅ Prioritizes same-day > tomorrow > next week
- ✅ Excludes busy times from calendar

### No Additional Prompting Needed

**The smart logic is already built into the `checkBrokerAvailability` function!**

Barbara just needs to:
1. Call the tool when booking
2. Use the response message from the tool
3. Present options to the lead

**The intelligence is in the code, not the prompt!**
