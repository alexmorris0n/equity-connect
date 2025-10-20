# BARBARA JSON SYSTEM - PROMPT ENGINEERING & TUNING GUIDE

**How to optimize Barbara's performance through strategic tweaks**

---

## 🎯 THE TWO TUNING SURFACES

### 1. **Personality Prompt** (`barbara-personality-core.md`)
**What it controls:** Tone, warmth, conversation style, response length

**When to tweak:** When you want to change HOW Barbara speaks

### 2. **Conversation Controller** (`conversation-controller.js`)
**What it controls:** Logic, validation, phase gates, slot extraction

**When to tweak:** When you want to change WHAT Barbara must collect

---

## 📝 PART 1: TUNING THE PERSONALITY PROMPT

### Current Structure:
```markdown
# ROLE & OBJECTIVE → Who Barbara is, what she does
# TONE & VOICE → How she should sound
# CONVERSATION FLOW → How she uses controller_state JSON
# BEHAVIOR RULES → What she must/must not do
# CALLER INFORMATION → What data is available
# TOOLS → What functions she can call
```

---

### 🎨 Common Personality Tweaks

#### **A. Adjust Response Length**

**Current:**
```markdown
- 2-3 sentences maximum per response
```

**For more concise Barbara:**
```markdown
- 1-2 sentences maximum per response
- Keep answers SHORT and direct
- Seniors need brevity
```

**For more conversational Barbara:**
```markdown
- 2-4 sentences per response
- Add warmth and acknowledgment
- Build rapport naturally
```

**Where:** Lines 8-10 in `barbara-personality-core.md`

---

#### **B. Adjust Tone/Accent Strength**

**Current:**
```markdown
- Bubbly and upbeat with Southern warmth ("Oh my goodness!" "That's wonderful!")
```

**For stronger Southern accent:**
```markdown
- Strong Southern charm and warmth
- Use expressions like: "Well bless your heart!" "Sugar" "Honey" "Y'all"
- Warm drawl, patient and caring
```

**For more professional/neutral:**
```markdown
- Warm and professional (minimal accent)
- Use expressions like: "Wonderful!" "I understand" "That makes sense"
- Friendly but not overly casual
```

**Where:** Lines 13-15 in `barbara-personality-core.md`

---

#### **C. Adjust Interruption Handling**

**Current:**
```markdown
(Implicit - relies on VAD)
```

**Add explicit guidance:**
```markdown
## INTERRUPTION BEHAVIOR
- When user interrupts, STOP immediately
- Don't apologize ("sorry for interrupting")
- Acknowledge naturally: "Yes, absolutely!" or "Got it!"
- Address their point and continue
```

**Where:** Add new section after TONE & VOICE

---

#### **D. Add Specific Objection Responses**

**Current:**
```markdown
(Generic - use search_knowledge for questions)
```

**Add common objections:**
```markdown
## COMMON OBJECTIONS - QUICK RESPONSES

### "Is this a scam?"
"I completely understand your concern! This is a federally-insured program backed by HUD. 
[Broker name] is fully licensed [NMLS if available]. Would you like me to send their credentials?"

### "I want to leave the house to my kids"
"That's a wonderful goal! Your heirs can keep the house by paying off the loan, 
or sell it and keep any remaining equity. [Broker name] can walk through the exact details."

### "What are the fees?"
"Great question - let me grab those specifics..." 
[Call search_knowledge while talking]
"Typically there's origination fees and mortgage insurance, but [Broker name] can break down 
your exact costs."
```

**Where:** Add new section before TOOLS

---

### 🎛️ Advanced Personality Tuning

#### **E. Add Empathy Triggers**

**For medical situations:**
```markdown
## EMPATHY TRIGGERS

When money_purpose is "medical":
- Use extra warmth: "I'm so sorry to hear about that"
- Emphasize speed: "Let's get you connected quickly"
- Acknowledge stress: "I know this must be stressful"

When timeline is "urgent":
- Prioritize booking: "Let's find the soonest available time"
- Skip optional rapport: Move to qualification faster
```

**Where:** Add after BEHAVIOR RULES section

---

#### **F. Adjust Qualification Approach**

**Current (Direct):**
```markdown
- Ask only for the next missing slot
```

**Make softer:**
```markdown
- Ask for next missing slot using conversational phrasing
- Preface with: "Just so I can help you best..." or "Real quick..."
- Never sound like a checklist
```

**Make more assertive:**
```markdown
- Ask for next missing slot directly
- No excessive pleasantries
- Get to qualification efficiently
```

**Where:** Lines 23-26 in `barbara-personality-core.md`

---

## 🔧 PART 2: TUNING THE CONVERSATION CONTROLLER

### Current Structure:
```javascript
// Phases: RAPPORT → QUALIFY → EQUITY → QA → BOOK
// Slots: 6 required fields
// Guards: isQualified(), canBook()
// Extraction: updateSlotsFromUserText()
```

---

### 🎯 Common Controller Tweaks

#### **A. Add/Remove Required Slots**

**Current slots:**
```javascript
const slots = {
  purpose: null,
  age_62_plus: null,
  primary_residence: null,
  mortgage_status: null,
  est_home_value: null,
  est_mortgage_balance: null,
};
```

**Add spouse age (for married couples):**
```javascript
const slots = {
  purpose: null,
  age_62_plus: null,
  spouse_age_62_plus: null,  // NEW
  primary_residence: null,
  mortgage_status: null,
  est_home_value: null,
  est_mortgage_balance: null,
};
```

**Update isQualified():**
```javascript
function isQualified() {
  if (slots.age_62_plus !== true) return false;
  // If they mentioned a spouse, spouse must also be 62+
  if (slots.spouse_age_62_plus === false) return false;  // NEW
  // ... rest of checks
  return true;
}
```

**Add to nextQuestionFor():**
```javascript
spouse_age_62_plus: "And how old is your spouse?",
```

**Where:** Lines 17-24, 33-40, 57-63 in `conversation-controller.js`

---

#### **B. Improve Slot Extraction Patterns**

**Current age detection:**
```javascript
if (/\b(over|older than|above)\s+(sixty[-\s]?two|62)\b/.test(t)) 
  slots.age_62_plus = true;
```

**Enhanced age detection:**
```javascript
// More variations
if (
  /\b(over|older than|above|past)\s+(sixty[-\s]?two|62)\b/.test(t) ||
  /\b(i'?m|am|yes.+)(6[2-9]|7\d|8\d)\s*(years?\s*old)?/.test(t) ||
  /\bborn in\s*(19[0-5]\d|196[0-3])\b/.test(t)  // Birth year calculation
) {
  slots.age_62_plus = true;
}
```

**Where:** Lines 92-95 in `conversation-controller.js`

---

#### **C. Adjust Booking Requirements**

**Current:**
```javascript
function canBook() {
  return isQualified() && equityPresented;
}
```

**Require Q&A completion:**
```javascript
function canBook() {
  return isQualified() && equityPresented && qaComplete;
}
```

**Skip equity presentation requirement (faster booking):**
```javascript
function canBook() {
  return isQualified();  // Book as soon as qualified
}
```

**Where:** Lines 126-128 in `conversation-controller.js`

---

#### **D. Add Smart Phase Transitions**

**Current (linear):**
```javascript
function nextPhase() {
  switch (phase) {
    case Phase.RAPPORT: phase = Phase.QUALIFY; break;
    case Phase.QUALIFY: phase = isQualified() ? Phase.EQUITY : Phase.QUALIFY; break;
    // ...
  }
}
```

**Add urgency detection (skip rapport for urgent calls):**
```javascript
function nextPhase() {
  switch (phase) {
    case Phase.RAPPORT:
      // If caller mentions "urgent" or "soon", skip to qualify faster
      if (slots.timeline === 'urgent') {
        phase = Phase.QUALIFY;
      } else {
        phase = Phase.QUALIFY;
      }
      break;
    // ...
  }
}
```

**Where:** Lines 42-53 in `conversation-controller.js`

---

#### **E. Add Timeline Slot (Urgency Tracking)**

**Add new slot:**
```javascript
const slots = {
  // ... existing slots
  timeline: null,  // 'urgent' | 'soon' | 'exploring'
};
```

**Extract timeline from speech:**
```javascript
// In updateSlotsFromUserText()
if (!slots.timeline) {
  if (/urgent|emergency|asap|right away|immediately|soon/.test(t)) {
    slots.timeline = 'urgent';
  } else if (/looking into|exploring|researching|thinking about/.test(t)) {
    slots.timeline = 'exploring';
  } else if (/next (week|month)|within|couple (weeks|months)/.test(t)) {
    slots.timeline = 'soon';
  }
}
```

**Where:** Lines 17-24, 79-141 in `conversation-controller.js`

---

## 🎨 PART 3: COMBINING PROMPT + CONTROLLER TWEAKS

### Example: Optimize for Urgent Medical Situations

#### **Step 1: Update Personality Prompt**

Add empathy section:
```markdown
## EMPATHY & URGENCY HANDLING

When caller_information shows:
- money_purpose = "medical" AND timeline = "urgent"

Behavior changes:
- Use extra warmth: "I understand this is urgent - let's get you help quickly"
- Skip small talk: Move directly to qualification after rapport
- Prioritize booking: Offer earliest available times first
- Acknowledge stress: "I know time is important here"
```

#### **Step 2: Update Controller**

Add automatic phase skipping:
```javascript
function nextPhase() {
  switch (phase) {
    case Phase.RAPPORT:
      // Fast-track urgent medical cases
      if (slots.purpose === 'medical' && slots.timeline === 'urgent') {
        phase = Phase.QUALIFY;  // Skip extended rapport
      } else {
        phase = Phase.QUALIFY;
      }
      break;
    // ...
  }
}
```

#### **Step 3: Update nudges for urgency**

```javascript
function nudgeForCurrentPhase() {
  const isUrgent = slots.timeline === 'urgent';
  
  const map = {
    [Phase.QUALIFY]: isUrgent 
      ? "Quickly gather missing qualification details - keep it brief and warm."
      : "Ask for the next missing qualification detail. Keep it to two sentences, warm and patient.",
    [Phase.BOOK]: isUrgent
      ? "Offer the EARLIEST available time first. Emphasize speed."
      : "Offer two specific times and schedule the call. Confirm phone number and offer a text reminder.",
  };
  return map[phase] || null;
}
```

**Result:** Barbara automatically adapts to urgent medical situations

---

## 🧪 PART 4: TESTING YOUR TWEAKS

### A. Test Personality Changes

**Method:** Read sample transcripts aloud
```markdown
Before: "Thanks for calling Equity Connect, this is Barbara! How can I help you today?"
After: "Hi there, this is Barbara with Equity Connect - what can I do for you?"

Does the new version sound better? More natural? Test with real seniors if possible.
```

---

### B. Test Controller Logic

**Create unit tests:**
```javascript
// test-controller.js
import { createConversationController } from './conversation-controller.js';

const controller = createConversationController();

// Test slot extraction
controller.updateSlotsFromUserText("I'm 68 years old");
console.assert(controller.slots.age_62_plus === true, "Age detection failed");

controller.updateSlotsFromUserText("I need money for surgery - it's urgent");
console.assert(controller.slots.purpose === 'medical', "Purpose detection failed");
console.assert(controller.slots.timeline === 'urgent', "Timeline detection failed");

// Test booking guard
console.assert(controller.canBook() === false, "Should not allow booking yet");

// Fill all slots
controller.updateSlotsFromUserText("I live there full time");
controller.updateSlotsFromUserText("It's paid off");
controller.updateSlotsFromUserText("Worth about 500,000");
controller.markEquityPresented();

console.assert(controller.canBook() === true, "Should allow booking now");
console.log("✅ All tests passed!");
```

**Run tests:**
```bash
node test-controller.js
```

---

### C. Test Integration with Live Calls

**Add debug logging to bridge:**
```javascript
// After each user turn
const state = controller.toJSON();
console.log('=== CONTROLLER STATE ===');
console.log(JSON.stringify(state, null, 2));

// Log booking attempts
if (toolName === 'book_appointment') {
  console.log('Booking attempt:', {
    canBook: controller.canBook(),
    missingSlot: controller.missingSlot(),
    phase: controller.phase
  });
}
```

**Monitor for:**
- ❌ Slots not extracting correctly → Improve regex patterns
- ❌ Phase transitions not working → Check phase logic
- ❌ Booking blocked incorrectly → Review canBook() logic
- ❌ Barbara sounds off → Adjust personality prompt

---

## 📊 PART 5: COMMON TUNING SCENARIOS

### Scenario 1: "Barbara is too wordy"

**Fix:**
1. Personality prompt: Change "2-3 sentences" → "1-2 sentences"
2. Add: "CRITICAL: Keep responses VERY short for seniors"
3. Test with sample calls

---

### Scenario 2: "Slot extraction misses variations"

**Fix:**
1. Controller: Improve regex in `updateSlotsFromUserText()`
2. Add more pattern variations
3. Add logging: `console.log('Extracted:', userText, '→', slots);`
4. Review logs, add missing patterns

---

### Scenario 3: "Need to collect email earlier"

**Fix:**
1. Controller: Add `email: null` to slots
2. Add to `isQualified()` check
3. Add to `nextQuestionFor()`: `email: "What's the best email for confirmation?"`
4. Add extraction pattern for email addresses

---

### Scenario 4: "Barbara skips qualification sometimes"

**Fix:**
1. Personality prompt: Add triple emphasis:
   ```markdown
   ## CRITICAL VALIDATION RULES (READ CAREFULLY)
   
   1. NEVER book until controller_state.canBook === true
   2. NEVER skip asking for missing slots
   3. ALWAYS check controller_state.missing_slot first
   
   (Repeat this 3 times in prompt for emphasis)
   ```

2. Controller: Add extra guard in bridge code:
   ```javascript
   // Block ANY tool call during QUALIFY phase if not qualified
   if (controller.phase === 'QUALIFY' && !controller.isQualified()) {
     if (toolName !== 'search_knowledge' && toolName !== 'get_lead_context') {
       return { error: 'Must complete qualification first' };
     }
   }
   ```

---

## 🎯 PART 6: OPTIMIZATION CHECKLIST

Before deploying changes, verify:

### Personality Prompt Checklist:
- [ ] Tone matches your brand
- [ ] Response length appropriate for seniors
- [ ] Empathy triggers for sensitive situations
- [ ] Clear instructions on controller_state usage
- [ ] Tool call guidance included
- [ ] Objection handling covered

### Controller Checklist:
- [ ] All required slots defined
- [ ] isQualified() checks all mandatory fields
- [ ] canBook() enforces your business rules
- [ ] Regex patterns tested with sample transcripts
- [ ] Phase transitions make logical sense
- [ ] Nudges guide model appropriately

### Integration Checklist:
- [ ] Bridge loads personality prompt
- [ ] Controller initializes on call start
- [ ] State updates after each user turn
- [ ] Booking guard blocks premature attempts
- [ ] Debug logging enabled
- [ ] Tested with inbound + outbound calls

---

## 🚀 QUICK REFERENCE: WHERE TO TWEAK WHAT

| What You Want to Change | File | Section | Lines |
|------------------------|------|---------|-------|
| **Barbara's tone/accent** | `barbara-personality-core.md` | TONE & VOICE | 8-15 |
| **Response length** | `barbara-personality-core.md` | TONE & VOICE | 8-10 |
| **Required data fields** | `conversation-controller.js` | slots definition | 17-24 |
| **Validation logic** | `conversation-controller.js` | isQualified() | 33-40 |
| **Booking requirements** | `conversation-controller.js` | canBook() | 126-128 |
| **Slot extraction patterns** | `conversation-controller.js` | updateSlotsFromUserText() | 79-141 |
| **Phase flow** | `conversation-controller.js` | nextPhase() | 42-53 |
| **Question phrasing** | `conversation-controller.js` | nextQuestionFor() | 57-63 |
| **Empathy/urgency** | `barbara-personality-core.md` | Add new section | After line 30 |
| **Objection responses** | `barbara-personality-core.md` | Add new section | Before TOOLS |

---

## 💡 PRO TIPS

1. **Start small** - Change one thing at a time, test, iterate
2. **Log everything** - Use `console.log(controller.toJSON())` liberally
3. **Test with real transcripts** - Use actual call recordings to tune patterns
4. **Version control** - Git commit before each tweak so you can rollback
5. **A/B test** - Run two versions in parallel, measure outcomes
6. **Monitor metrics** - Track qualification rate, booking rate, call duration

---

**The beauty of this system: Prompt controls TONE, Code controls LOGIC. Tune each independently!**

