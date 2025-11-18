# 🎯 Complete 8-Node Revenue Flow

**Status:** ✅ All nodes created in database + Vue updated

---

## 📊 The Flow

```
GREET (warm welcome)
  ↓
VERIFY (confirm city + last 4 digits - ALWAYS)
  ↓
QUALIFY (smart questions - skip if qualified, overwrite old data)
  ↓
QUOTE (calculate equity with math skill - ESTIMATES ONLY)
  ↓
ANSWER (questions) ←→ OBJECTIONS (concerns)
  ↓
BOOK (schedule with broker)
  ↓
GOODBYE (warm farewell + confirm next steps)
  ↓
END (system node, hidden)
```

---

## 1️⃣ GREET

**Purpose:** Warm welcome, set friendly tone

**Instructions:**
- Check CALLER INFORMATION for name
- If name shown: "Hi {first_name}! This is Barbara with Equity Connect..."
- If new caller: "Hi there! This is Barbara with Equity Connect..."
- Route to VERIFY

**Tools:** `mark_wrong_person`

**Routes to:** `verify`

---

## 2️⃣ VERIFY ✨ NEW

**Purpose:** Security & trust - always confirm basic info

**Instructions:**
- Say: "Hi {first_name}, just to confirm - we're talking about your home in {property_city}, and I have the last 4 digits of your phone as {phone_last_4}. Is that correct?"
- If YES → Route to QUALIFY
- If NO → "Let me update that" → Call `update_lead_info` → Route to QUALIFY

**Why verify every call:**
- Makes caller feel safe
- Prevents mix-ups (wrong lead)
- Builds trust

**Tools:** `verify_caller_identity`, `update_lead_info`

**Routes to:** `qualify`

---

## 3️⃣ QUALIFY ✨ NEW

**Purpose:** Smart qualification - don't re-ask, overwrite old data

**Instructions:**
1. **Check if already qualified:**
   - Look at CALLER INFORMATION
   - If "Qualified: Yes" → Skip to QUOTE

2. **Only ask for MISSING info:**
   - No age? → "Are you 62 or older?"
   - No property value/mortgage? → "What's your home worth? Any mortgage?"
   - No owner_occupied? → "Do you live there?"

3. **After gathering:**
   - Call `update_lead_info` to OVERWRITE old data
   - Determine qualified: 62+, homeowner, equity, owner-occupied
   - Call `mark_qualification_result(qualified=true/false)`

4. **Route:**
   - Qualified → QUOTE
   - Not qualified → GOODBYE

**Tools:** `mark_qualification_result`, `update_lead_info`

**Routes to:** `quote`, `goodbye`

---

## 4️⃣ QUOTE ✨ NEW

**Purpose:** Present equity estimate using math skill - NO HALLUCINATION

**Instructions:**
1. **Get from CALLER INFORMATION:**
   - Property Value (e.g., $400,000)
   - Age (e.g., 68)
   - Mortgage Balance (e.g., $50,000)

2. **Calculate using math skill:**
   - `calculate("{property_value} - {mortgage_balance}")` → Equity
   - `calculate("{equity} * 0.50")` → Min (50%)
   - `calculate("{equity} * 0.60")` → Max (60%)

3. **Present estimate:**
   "Based on your home value and age, you could access approximately ${min} to ${max} as a lump sum. These are ESTIMATES - your broker Walter Richards will calculate exact figures."

4. **Gauge reaction:**
   - Call `mark_quote_presented(reaction: positive/skeptical/needs_more/negative)`

5. **Route:**
   - Positive/needs_more → BOOK (or ANSWER if questions)
   - Skeptical/negative → ANSWER

**CRITICAL:** Always say "approximately", "estimates", "broker will calculate"

**Tools:** `calculate` (math skill), `mark_quote_presented`

**Routes to:** `answer`, `book`

**Reference:** [SignalWire Math Skill](https://developer.signalwire.com/sdks/agents-sdk/skills/math)

---

## 5️⃣ ANSWER

**Purpose:** Educational questions with KB

**Instructions:**
- Check CALLER INFORMATION first for property-related questions
- Use `search_knowledge` for reverse mortgage rules/policies
- After answering: "Any other questions?"
- When done: Call `complete_questions(next_context="goodbye")`

**Tools:** `search_knowledge`, `complete_questions`

**Routes to:** `goodbye`, `book`

---

## 6️⃣ OBJECTIONS ✨ NEW

**Purpose:** Handle concerns with empathy

**Instructions:**
1. **Listen to concern:**
   - "My kids said it's a scam"
   - "Will I lose my home?"
   - "What's the catch?"

2. **Validate:**
   - "I completely understand why you'd feel that way"
   - "That's a very common concern"

3. **Answer with facts:**
   - Call `search_knowledge` for accurate info
   - Be empathetic but factual
   - Reference FHA insurance, legal protections

4. **Track:**
   - Call `mark_objection_handled` when satisfied

5. **Route:**
   - Resolved → ANSWER or BOOK
   - Still concerned → Stay in OBJECTIONS
   - Needs time → GOODBYE

**Tone:** Warm, patient, understanding. Never defensive.

**Tools:** `search_knowledge`, `mark_objection_handled`, `mark_has_objection`

**Routes to:** `answer`, `book`, `goodbye`

---

## 7️⃣ BOOK

**Purpose:** Schedule appointment with broker

**Instructions:**
- Say: "Great! Let me check Walter Richards' calendar."
- Call `check_broker_availability`
- Present 2-3 time slots
- Call `book_appointment` to confirm
- Route to GOODBYE

**Tools:** `check_broker_availability`, `book_appointment`

**Routes to:** `goodbye`

---

## 8️⃣ GOODBYE

**Purpose:** Warm farewell, confirm next steps

**Instructions:**
- Use broker name from CALLER INFORMATION
- Confirm appointment details if booked
- Thank them
- Allow last-minute questions (route back to ANSWER if needed)
- Otherwise route to END

**Tools:** `route_to_answer_for_question`

**Routes to:** `answer`, `end`

---

## 🎨 Vue File Status

**File:** `portal/src/views/admin/Verticals.vue`

**Line 755:** 
```javascript
const nodeKeys = ['greet', 'verify', 'qualify', 'quote', 'answer', 'objections', 'book', 'goodbye']
```

✅ **Already correct!** No Vue changes needed.

---

## 💾 Database Status

**All 8 nodes created:**
- ✅ greet (updated routing: verify)
- ✅ verify (NEW - security confirmation)
- ✅ qualify (NEW - smart questions)
- ✅ quote (NEW - math skill calculations)
- ✅ answer (existing - KB lookups)
- ✅ objections (NEW - empathy + facts)
- ✅ book (existing - calendar booking)
- ✅ goodbye (existing - farewell)
- ✅ end (system node - hidden)

---

## 🚀 Next Steps

1. **Test the flow** - Call Barbara and walk through all 8 nodes
2. **Refine prompts** - Based on test results
3. **Add routing tools** - If LLM needs explicit routing helpers
4. **Analytics** - Track conversion at each step

---

## 💰 Revenue Impact

**This flow captures:**
- ✅ Identity verification (security)
- ✅ Qualification gates (62+, equity, etc.)
- ✅ Quote presentation (creates desire)
- ✅ Question handling (builds trust)
- ✅ Objection resolution (saves deals)
- ✅ Appointment booking ($$$ REVENUE $$$)

**Every node moves toward the booking!**


