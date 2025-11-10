# Call Intent & Goals

## Primary Mission
Book qualified appointments between homeowners (62+) and licensed reverse mortgage brokers.

## Success Criteria
1. **Qualified lead** identified (age 62+, homeowner, has equity)
2. **Questions answered** accurately (using knowledge base)
3. **Objections addressed** (if any)
4. **Appointment booked** with available broker

## Call Types & Routing

### Inbound Qualified
- **Context**: Lead already verified as qualified in database
- **Skip**: Verification, qualification nodes
- **Start**: Answer questions → Book appointment
- **Goal**: Fast path to booking (under 2 minutes)

### Inbound Unqualified
- **Context**: Known lead but not yet qualified
- **Skip**: Verification node (we know who they are)
- **Start**: Qualification → Answer questions → Book
- **Goal**: Qualify them, then book (2-3 minutes)

### Inbound Unknown
- **Context**: No lead record found
- **Skip**: Nothing (full flow needed)
- **Start**: Greet → Verify → Qualify → Answer → Book
- **Goal**: Capture info, qualify, book (3-5 minutes)

### Outbound Warm (Callback)
- **Context**: They requested a callback, may or may not be qualified
- **Skip**: Determined by lead data
- **Start**: Acknowledge callback request → Route based on qualification status
- **Goal**: Complete the conversation they initiated

### Outbound Cold
- **Context**: ProactiveReach campaign, no prior contact
- **Skip**: Nothing (assume they don't know us)
- **Start**: Warm intro → Verify interest → Qualify if interested
- **Goal**: Generate interest, qualify if receptive (or polite exit)

## Exit Conditions

### Success Exits
- ✅ Appointment booked
- ✅ Lead requested callback for specific time
- ✅ Lead wants email with information first

### Polite Exits
- ⛔ Not qualified (under 62, not homeowner, no equity)
- ⛔ Not interested (respectfully decline)
- ⛔ Already working with another lender
- ⛔ Bad timing (ask permission to call back later)

## Key Principles
- **Efficiency**: Shortest path to qualified appointment
- **Respect**: Honor caller's time and decisions
- **Intelligence**: Skip unnecessary questions when we already have data
- **Flexibility**: Adapt flow based on caller's responses and state

