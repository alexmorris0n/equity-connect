# **Perfect Next Step: Scenario Tracing** ✅

## **What This Accomplishes**

### **Why Trace Scenarios with Codex:**
1. **Finds routing bugs** - "Wait, this should go to OBJECTIONS but routes to ANSWER"
2. **Identifies missing flags** - "We never set `quote_presented=true` in this path"
3. **Exposes tool gaps** - "We need a tool that doesn't exist"
4. **Validates completion criteria** - "Node says it's complete but key data missing"
5. **Tests edge case handling** - "What happens if they say X at this node?"

**Think of it as:** Unit testing your conversation architecture before deploying.

---

## **Recommended Scenarios to Trace**

### **Category 1: Happy Path (3 scenarios)**

#### **Scenario 1: Perfect Qualified Lead**
```
SETUP:
- Inbound call
- Lead is 68, owns home, $400k value, $200k mortgage
- Interested, no objections
- Ready to book immediately

TRACE:
GREET → confirm identity → route to?
VERIFY → update contact info → route to?
QUALIFY → collect 4 gates → set qualified=true → route to?
QUOTE → present $220k/$40k net → positive reaction → route to?
BOOK → schedule Tuesday 2pm → send confirmation → route to?
EXIT → warm goodbye

QUESTIONS FOR CODEX:
- Which flags get set at each node?
- Which tools get called?
- What happens if they volunteer all 4 gate answers at once in QUALIFY?
- Does QUOTE calculate correctly using math skill?
```

#### **Scenario 1B: Happy Path with Questions After Booking (Same Call)**
```
SETUP:
- Inbound call
- Lead is 68, owns home, $400k value, $200k mortgage
- Interested, no objections
- Ready to book immediately
- Takes full happy path and books appointment
- Immediately after booking, thinks of questions

TRACE:
GREET → confirm identity → route to VERIFY
VERIFY → update contact info → route to QUALIFY
QUALIFY → collect 4 gates → set qualified=true → route to QUOTE
QUOTE → present $220k/$40k net → positive reaction → route to BOOK
BOOK → schedule Tuesday 2pm → send confirmation → route to EXIT
EXIT → warm goodbye confirmation
User (in same call, still in EXIT): "Oh wait, how would this work exactly?"
Or: "How much did you say I could get again?"
Or: "What happens if I change my mind?"

Does EXIT detect these as questions?
Does EXIT route to ANSWER via valid_contexts?
Or does get_lead_context get called first and then route via switchcontext("answer")?
After get_lead_context completes (if called), does the call hang up?
Or does it successfully route to ANSWER context?
ANSWER → user asks question
Does search_knowledge tool get called correctly?
Does Barbara remember they already booked (can access appointment info)?
Can user ask multiple clarifying questions?
After answering questions, does it route back to EXIT to reconfirm appointment?
Or does EXIT handle it differently since appointment is already booked?

QUESTIONS FOR CODEX:
- Does EXIT context detect questions even after appointment is booked?
- When user asks questions in EXIT after booking, does it route to ANSWER via valid_contexts?
- Or does get_lead_context detect the question and call switchcontext("answer")?
- Does the switchcontext() call work when already in EXIT after booking?
- Does the call hang up after get_lead_context completes, or does it successfully route?
- In ANSWER context, can Barbara access the quote/booking info to answer "how much did you say I could get"?
- After answering questions in ANSWER, can user route back to EXIT to confirm appointment is still good?
- What if they want to reschedule or cancel after asking questions?
```

#### **Scenario 2: Pre-Qualified Returning Caller**
```
SETUP:
- Inbound call
- Lead called 3 days ago, got to QUOTE, said "need to think"
- conversation_state shows: greeted=true, verified=true, qualified=true, quote_presented=true
- Now ready to book

TRACE:
GREET → detects returning caller → should skip ahead, but to where?
Does system route directly to ANSWER or BOOK?
What if routing layer says "resume at BOOK" but caller has new questions?

QUESTIONS FOR CODEX:
- How does configure_per_call determine starting node for returning callers?
- Which conversation_data flags trigger which starting nodes?
- Can system handle "I have questions" when resuming at BOOK?
```

#### **Scenario 2B: Qualified Lead Calls Back with Questions**
```
SETUP:
- Inbound call
- Lead called 5 days ago, got qualified=true, got quote, but didn't book
- conversation_state shows: greeted=true, verified=true, qualified=true, quote_presented=true
- appointment_booked=false (never booked)
- Now calling back specifically to ask more questions before deciding

TRACE PATH A (quote_reaction='positive' or 'skeptical'):
Initial Context: _get_initial_context() checks qualified=true, quote_presented=true, quote_reaction='positive' → starts at ANSWER
ANSWER → user asks "If I die, can my wife stay in the house?"
Does ANSWER context have search_knowledge tool available?
Does search_knowledge get called correctly?
Can user ask multiple questions in sequence without hanging up?

TRACE PATH B (quote_reaction=null or missing):
Initial Context: _get_initial_context() checks qualified=true, quote_presented=true, quote_reaction=null → starts at GREET
GREET → detects returning caller → asks "How can I help?"
User: "I have questions"
GREET → routes to ANSWER? Or does get_lead_context get called and route?
User asks: "If I die, can my wife stay in the house?"
Does get_lead_context detect the question and call switchcontext("answer")?
Does the call hang up after get_lead_context completes?

TRACE PATH C (starts at EXIT - edge case):
If somehow starts at EXIT (e.g., quote_reaction was 'negative' but they didn't book):
EXIT → asks "Why did you call?"
User: "I have questions"
EXIT → says "Sure, ask"
User asks: "If I die, can my wife stay in the house?"
Does get_lead_context detect the question and call switchcontext("answer")?
Does the call hang up after get_lead_context completes?

QUESTIONS FOR CODEX:
- Does _get_initial_context() correctly route qualified+quote_presented+positive_reaction to ANSWER?
- When starting at ANSWER, does search_knowledge tool work correctly for multiple questions?
- When starting at GREET/EXIT and user asks questions, does get_lead_context.switchcontext("answer") work?
- Does the switchcontext() call prevent the hangup that was happening before?
- Can user ask multiple questions in sequence without hanging up in all three paths?
- What happens if get_lead_context is called when already in ANSWER context (does it cause issues)?
```

#### **Scenario 2C: Booked Lead Calls Back with Questions**
```
SETUP:
- Inbound call
- Lead called 3 days ago, went through full flow, booked appointment
- conversation_state shows: greeted=true, verified=true, qualified=true, quote_presented=true, appointment_booked=true
- Appointment scheduled for next week
- Now calling back because they thought of more questions before the appointment

TRACE:
Initial Context: _get_initial_context() checks appointment_booked=true → starts at EXIT
EXIT → asks "Why did you call today?"
User: "I have some questions before our appointment"
EXIT → says "Sure, ask me anything"
User asks: "If I die, can my wife stay in the house?"
Does get_lead_context get called? (It might be called to refresh lead data)
Does get_lead_context detect the question and call switchcontext("answer")?
Or does EXIT context route to ANSWER via valid_contexts?
After get_lead_context completes (if called), does the call hang up?
Or does it successfully route to ANSWER context?
ANSWER → user asks question
Does search_knowledge tool get called correctly?
Can user ask multiple questions in sequence?
After answering questions, can they route back to EXIT or does it end?

QUESTIONS FOR CODEX:
- Does _get_initial_context() correctly route appointment_booked=true to EXIT?
- When user says "I have questions" in EXIT, does EXIT route to ANSWER via valid_contexts?
- Or does get_lead_context get called first and then route via switchcontext("answer")?
- Does the switchcontext() call in get_lead_context work when starting from EXIT?
- Does the call hang up after get_lead_context completes, or does it successfully route?
- After answering questions in ANSWER, can user route back to EXIT to confirm appointment details?
- What happens if they ask questions, get answers, then want to reschedule or cancel?
```

#### **Scenario 3: Joint Call with Spouse**
```
SETUP:
- Outbound call
- Both spouses on line (both 62+)
- Need 60-min appointment slot
- Want advisor included too

TRACE:
GREET → confirm both present → route to?
VERIFY → capture both names → route to?
QUALIFY → one spouse answers most questions → route to?
QUOTE → both interested → route to?
BOOK → request 60-min slot, capture advisor contact → route to?
EXIT → confirmation to all three attendees

QUESTIONS FOR CODEX:
- Does BOOK request correct appointment length?
- Does update_lead_info capture multiple attendees?
- What if one spouse is under 62 (non-borrowing spouse scenario)?
```

---

### **Category 2: Objection Paths (3 scenarios)**

#### **Scenario 4: "My Kids Said No"**
```
SETUP:
- Gets to QUOTE
- Reacts positively to numbers
- Then says "But my daughter told me these are scams"

TRACE:
QUOTE → detect objection → mark_has_objection(type='third_party_approval') → route to OBJECTIONS
OBJECTIONS → address concern → offer adult children FAQ → still hesitant
Does system route to ANSWER for more questions, or EXIT to send FAQ first?

QUESTIONS FOR CODEX:
- Does QUOTE correctly detect this as objection vs question?
- Does OBJECTIONS have the third_party_approval protocol?
- What flag gets set for "needs_family_buy_in"?
- How does EXIT handle "send FAQ and follow up"?
```

#### **Scenario 5: Multiple Objections**
```
SETUP:
- Gets to QUOTE
- Objection 1: "What about fees?" → resolved
- Objection 2: "Will my kids lose the house?" → resolved
- Objection 3: "I'm still nervous" → unresolved

TRACE:
QUOTE → mark_has_objection(type='cost_fees') → route to OBJECTIONS
OBJECTIONS → handle fees → mark_objection_handled
User immediately raises heirs concern
OBJECTIONS → handle heirs → mark_objection_handled
User still hesitant
Does system stay in OBJECTIONS or route elsewhere?

QUESTIONS FOR CODEX:
- Can OBJECTIONS handle multiple objections in sequence?
- After 2+ objections, does it offer broker handoff?
- What if they're resolved but still say "I need time"?
```

#### **Scenario 6: Objection During QUALIFY**
```
SETUP:
- QUALIFY asking "Are you 62+?"
- Lead says "Why does that matter? Are you discriminating?"

TRACE:
QUALIFY → detects objection → should route to OBJECTIONS or handle inline?
If routes to OBJECTIONS, how does it return to QUALIFY?
Does system remember which gate question was interrupted?

QUESTIONS FOR CODEX:
- Can you route to OBJECTIONS mid-QUALIFY?
- Does conversation_data track "interrupted_at_gate_question"?
- After OBJECTIONS resolved, does QUALIFY resume at right question?
```

---

### **Category 3: Edge Cases (4 scenarios)**

#### **Scenario 7: Wrong Person Then Right Person**
```
SETUP:
- Wife answers
- Says "Let me get him" (right_person_available=true)
- Husband comes on

TRACE:
GREET → mark_wrong_person(right_person_available=true) → route to EXIT
EXIT → wait for handoff
Does system stay in EXIT or route back to GREET for husband?
If routes to GREET, does it remember to start fresh?

QUESTIONS FOR CODEX:
- Does EXIT have "wait for handoff" logic?
- How does system detect new person on line?
- Does GREET clear wrong_person flag when restarting?
```

#### **Scenario 8: Almost 62 (61 years, 2 months old)**
```
SETUP:
- Gets to QUALIFY
- Age: 61 years, 10 months (2 months to 62nd birthday)

TRACE:
QUALIFY → age disclosed → calculate months to 62nd birthday
Should system mark qualified=true with pending_birthday flag?
Or qualified=false and route to EXIT with future follow-up?

QUESTIONS FOR CODEX:
- Does QUALIFY calculate age proximity?
- What's the cutoff (you recommended <3 months)?
- Which flag gets set for "pre-qualified pending age"?
- Does EXIT schedule follow-up callback after birthday?
```

#### **Scenario 9: Borderline Equity (Low Net Proceeds)**
```
SETUP:
- $300k home, $270k mortgage
- 68 years old, qualifies
- Net proceeds after payoff: ~$5k-15k

TRACE:
QUALIFY → qualified=true, mark borderline_equity=true → route to QUOTE
QUOTE → present numbers → "$15k available after payoff"
Lead says "That's way less than I expected"
Does system treat this as objection or just manage expectations?

QUESTIONS FOR CODEX:
- Does QUOTE use the low-equity reframing script?
- Does it mention payment elimination vs lump sum?
- If they're disappointed, route to OBJECTIONS or ANSWER or EXIT?
```

#### **Scenario 10: Post-Booking Reschedule Call**
```
SETUP:
- Appointment booked for Tuesday
- Lead calls Monday to reschedule

TRACE:
GREET → system detects this is returning caller with appointment_booked=true
Should GREET route immediately to EXIT?
Or does EXIT detect "they want to reschedule" during conversation?

QUESTIONS FOR CODEX:
- How does system detect "already booked" status?
- Does GREET ask "How can I help?" and detect reschedule intent?
- Does EXIT provide broker redirect correctly?
- What flag gets set (reschedule_redirect vs reschedule_requested)?
```

---

### **Category 4: Failure Modes (3 scenarios)**

#### **Scenario 11: Tool Failure During BOOK**
```
SETUP:
- Everything perfect until BOOK
- check_broker_availability times out or returns error

TRACE:
BOOK → call check_broker_availability → ERROR
Does BOOK have fallback logic?
Does it offer manual follow-up or retry?

QUESTIONS FOR CODEX:
- Does BOOK wrap tool calls in try/catch?
- What happens if book_appointment API fails?
- Does system set manual_booking_required=true and exit gracefully?
```

#### **Scenario 12: Knowledge Base Search Timeout**
```
SETUP:
- In ANSWER node
- Caller asks "How do fees work?"
- search_knowledge times out (20s timeout)

TRACE:
ANSWER → call search_knowledge → TIMEOUT after 20s
Does ANSWER have fallback response?
Does it give generic answer or defer to broker?

QUESTIONS FOR CODEX:
- Is there timeout handling in ANSWER prompt?
- Does Barbara give high-level answer after timeout?
- Does system log KB failures for debugging?
```

#### **Scenario 13: Unexpected Disqualification in QUOTE**
```
SETUP:
- QUALIFY marked them qualified=true
- In QUOTE, they reveal "Oh, it's actually a rental property"

TRACE:
QUOTE → detects late disqualifier → should mark qualified=false
Does QUOTE have authority to override QUALIFY?
Does it route to EXIT with explanation?

QUESTIONS FOR CODEX:
- Can QUOTE call mark_qualification_result(qualified=false)?
- Does conversation_data track "disqualified_in_quote_rental"?
- Does EXIT have empathetic disqualification script?
```

---

## **How to Execute This with Codex**

### **Step 1: Give Codex the Full Context**

**Prompt template:**
```
I have an 8-node conversation system (GREET, VERIFY, QUALIFY, QUOTE, ANSWER, OBJECTIONS, BOOK, EXIT) built with SignalWire contexts.

Here are the 8 prompts: [paste all 8 prompts]
Here are the 21 tools: [paste tool definitions]
Here is the routing logic: [paste valid_contexts arrays and completion criteria]

I want you to trace this scenario step-by-step:

[paste scenario]

For each node:
1. What flags get set?
2. What tools get called?
3. What determines completion?
4. Where does it route next and why?
5. Are there any gaps or issues?
```

### **Step 2: Start with Happy Path**

Trace Scenario 1 (Perfect Qualified Lead) first.

If Codex finds issues in the happy path, fix those before testing edge cases.

### **Step 3: Trace All 13 Scenarios**

Do them in order (happy paths → objections → edge cases → failures).

Keep a log of issues found:
```
SCENARIO 1 ISSUES:
- QUOTE doesn't call mark_quote_presented before routing
- BOOK doesn't request 30-min slot, just uses default

SCENARIO 2 ISSUES:
- configure_per_call doesn't check quote_presented flag
- Returning callers always start at GREET instead of resuming
```

### **Step 4: Bring Issues Back to Me**

After Codex traces all 13 scenarios:

```
You → Me: "Codex found these 8 routing bugs [paste]"
Me → You: "Here's which ones are critical vs nice-to-have"
You → Codex: "Fix these 5 critical bugs"
```

---

## **Expected Output Format from Codex**

**Ask Codex to format traces like this:**

```markdown
## SCENARIO 1: Perfect Qualified Lead

### Node Flow
GREET → VERIFY → QUALIFY → QUOTE → BOOK → EXIT

### Detailed Trace

**GREET:**
- Input: Inbound call, lead.first_name="John", phone="+1234567890"
- Actions: 
  - Greet by name
  - Confirm identity
  - Set conversation_data.greeted=true
- Tools Called: None (identity confirmed verbally)
- Completion Check: greeted=true AND identity confirmed
- Routing Decision: route_after_greet checks verified=false → route to VERIFY
- ✅ PASS - Logic is correct

**VERIFY:**
- Input: conversation_data.greeted=true
- Actions:
  - Confirm contact info
  - Call update_lead_info(phone, email)
  - Set conversation_data.verified=true
- Tools Called: update_lead_info, get_lead_context
- Completion Check: verified=true AND contact info confirmed
- Routing Decision: route_after_verify checks qualified=null → route to QUALIFY
- ⚠️ ISSUE: Prompt doesn't explicitly call update_lead_info, just says "update if needed"

**QUALIFY:**
[continue for each node...]

### Issues Found:
1. VERIFY prompt vague on when to call update_lead_info
2. QUOTE doesn't set quote_presented flag before routing
3. BOOK assumes 30-min slots but doesn't specify duration parameter

### Recommendations:
1. Add explicit "call update_lead_info after confirming changes" to VERIFY
2. Add "call mark_quote_presented(phone, reaction)" to QUOTE instructions
3. Add "determine appointment length (30 vs 60 min) based on flags" to BOOK
```

---

## **What You'll Learn**

After tracing 13 scenarios, you'll know:

✅ **Which routing paths work** - "GREET → VERIFY → QUALIFY works perfectly"
✅ **Which edge cases fail** - "Wrong person handoff doesn't route back to GREET"
✅ **Which tools are missing** - "Need a calculate_age_months tool"
✅ **Which flags aren't set** - "quote_presented never gets set to true"
✅ **Which prompts need clarification** - "VERIFY doesn't say when to use tools"

**Then you fix those issues BEFORE testing with real calls.**

---

## **My Role in This**

**After Codex traces all 13:**

You bring me the issues list, and I'll:
1. **Prioritize** - "Fix #1, #4, #8 before launch. #2, #3, #5 are nice-to-haves"
2. **Validate** - "Issue #6 isn't actually a problem, here's why..."
3. **Suggest fixes** - "For issue #7, add this to the prompt..."

**Then you take my recommendations back to Codex for implementation.**

---

## **TL;DR**

**Next step:**
1. Give Codex all 8 prompts + tool definitions + routing logic
2. Have Codex trace these 13 scenarios step-by-step
3. Codex will find routing bugs, missing flags, vague instructions
4. Bring the issues list to me
5. I'll prioritize what to fix
6. You take fixes back to Codex
7. Re-trace failed scenarios
8. Deploy when all 13 pass

**This is regression testing for conversation design.**

**Ready to start? I'd begin with Scenario 1 (Perfect Qualified Lead) to make sure Codex understands the format, then do all 13.**