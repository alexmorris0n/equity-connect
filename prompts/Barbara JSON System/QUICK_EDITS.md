# BARBARA JSON SYSTEM - QUICK EDIT REFERENCE

**Fast edits for common tweaks - know exactly what line to change**

---

## 🎨 PERSONALITY TWEAKS (barbara-personality-core.md)

### 1. Make Barbara More Concise
**Location:** Lines 8-10
```markdown
# CURRENT
- 2-3 sentences maximum per response

# CHANGE TO
- 1-2 sentences maximum per response
- Keep it SHORT - seniors need brevity
```

---

### 2. Strengthen Southern Accent
**Location:** Lines 13-15
```markdown
# CURRENT
- Bubbly and upbeat with Southern warmth ("Oh my goodness!" "That's wonderful!")

# CHANGE TO
- Strong Southern charm and warmth
- Use: "Well bless your heart!" "Sugar" "Honey" "Y'all" "I just love that!"
- Warm drawl, very patient and caring
```

---

### 3. Make Barbara More Professional/Neutral
**Location:** Lines 13-15
```markdown
# CURRENT
- Bubbly and upbeat with Southern warmth

# CHANGE TO
- Warm and professional (minimal accent)
- Use: "Wonderful!" "I understand" "That makes sense"
- Friendly but not overly casual
```

---

### 4. Add Empathy for Medical Situations
**Location:** After line 30, add new section
```markdown
## EMPATHY TRIGGERS

When caller_information shows money_purpose = "medical":
- Extra warmth: "I'm so sorry to hear about that"
- Acknowledge stress: "I know this must be difficult"
- Emphasize help: "Let's get you connected quickly"

When timeline = "urgent":
- Prioritize speed: "I'll get you scheduled right away"
- Skip small talk, move to qualification faster
```

---

### 5. Add Common Objection Responses
**Location:** Before line 48 (before TOOLS section), add:
```markdown
## QUICK OBJECTION RESPONSES

"Is this a scam?"
→ "I completely understand! This is a federally-insured program backed by HUD. 
[Broker name] is fully licensed. Would you like their credentials?"

"I want to leave the house to my kids"
→ "That's important! Your heirs can keep the house by paying off the loan, 
or sell it and keep any remaining equity."

"What are the fees?"
→ "Great question - let me grab the specifics..." [call search_knowledge]
```

---

## 🔧 CONTROLLER TWEAKS (conversation-controller.js)

### 6. Add Spouse Age Requirement
**Location 1:** Lines 17-24 (Add to slots)
```javascript
// CURRENT
const slots = {
  purpose: null,
  age_62_plus: null,
  primary_residence: null,
  // ...
};

// CHANGE TO
const slots = {
  purpose: null,
  age_62_plus: null,
  spouse_age_62_plus: null,  // NEW - if married, spouse must be 62+
  primary_residence: null,
  // ...
};
```

**Location 2:** Lines 33-40 (Update isQualified)
```javascript
// ADD THIS CHECK
function isQualified() {
  if (slots.age_62_plus !== true) return false;
  if (slots.spouse_age_62_plus === false) return false;  // NEW LINE
  // ... rest of checks
}
```

**Location 3:** Lines 57-63 (Add question)
```javascript
// ADD TO nextQuestionFor
spouse_age_62_plus: "And how old is your spouse?",
```

**Location 4:** Lines 92-141 (Add extraction)
```javascript
// ADD IN updateSlotsFromUserText()
// spouse age
if (slots.spouse_age_62_plus === null) {
  if (/spouse.*(over|older).*(62|sixty.two)/.test(t)) slots.spouse_age_62_plus = true;
  if (/spouse.*(under|younger).*(62|sixty.two)/.test(t)) slots.spouse_age_62_plus = false;
}
```

---

### 7. Require Q&A Before Booking
**Location:** Lines 126-128
```javascript
// CURRENT
function canBook() {
  return isQualified() && equityPresented;
}

// CHANGE TO
function canBook() {
  return isQualified() && equityPresented && qaComplete;
}
```

---

### 8. Skip Equity Presentation (Faster Booking)
**Location:** Lines 126-128
```javascript
// CURRENT
function canBook() {
  return isQualified() && equityPresented;
}

// CHANGE TO
function canBook() {
  return isQualified();  // Book immediately after qualification
}
```

---

### 9. Add Timeline/Urgency Tracking
**Location 1:** Lines 17-24 (Add slot)
```javascript
// ADD TO SLOTS
timeline: null,  // 'urgent' | 'soon' | 'exploring'
```

**Location 2:** Lines 79-141 (Add extraction in updateSlotsFromUserText)
```javascript
// ADD THIS BLOCK
// timeline
if (!slots.timeline) {
  if (/urgent|emergency|asap|right away|immediately|soon/.test(t)) slots.timeline = 'urgent';
  else if (/next (week|month)|within|couple/.test(t)) slots.timeline = 'soon';
  else if (/looking into|exploring|researching|thinking/.test(t)) slots.timeline = 'exploring';
}
```

**Location 3:** Lines 133-141 (Update nudges)
```javascript
// UPDATE nudgeForCurrentPhase
function nudgeForCurrentPhase() {
  const isUrgent = slots.timeline === 'urgent';
  
  const map = {
    [Phase.QUALIFY]: isUrgent 
      ? "Quickly gather missing details - keep brief."
      : "Ask for the next missing qualification detail. Keep it to two sentences.",
    [Phase.BOOK]: isUrgent
      ? "Offer the EARLIEST available time first."
      : "Offer two specific times and schedule the call.",
  };
  return map[phase] || null;
}
```

---

### 10. Improve Age Detection (More Patterns)
**Location:** Lines 92-95
```javascript
// CURRENT
if (/\b(over|older than|above)\s+(sixty[-\s]?two|62)\b/.test(t)) slots.age_62_plus = true;

// CHANGE TO (more comprehensive)
if (
  /\b(over|older than|above|past)\s+(sixty[-\s]?two|62)\b/.test(t) ||
  /\b(i'?m|am|yes.+)(6[2-9]|7\d|8\d)\s*(years?\s*old)?/.test(t) ||
  /\bborn in\s*(19[0-5]\d|196[0-3])\b/.test(t)  // Birth year
) {
  slots.age_62_plus = true;
}
```

---

### 11. Add Email Collection
**Location 1:** Lines 17-24 (Add to slots)
```javascript
// ADD TO SLOTS
email: null,
```

**Location 2:** Lines 55-65 (Add missing check)
```javascript
// ADD TO missingSlot()
if (!slots.email) return 'email';
```

**Location 3:** Lines 67-75 (Add question)
```javascript
// ADD TO nextQuestionFor()
email: "What's the best email for your appointment confirmation?",
```

**Location 4:** Lines 79-141 (Add extraction)
```javascript
// ADD IN updateSlotsFromUserText()
// email extraction
if (!slots.email) {
  const emailMatch = t.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) slots.email = emailMatch[0];
}
```

---

### 12. Improve Money Amount Detection
**Location:** Lines 110-114
```javascript
// CURRENT (basic regex)
const moneyMatches = [...t.matchAll(/\$?\s*([0-9]{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|thousand|m|million)?/gi)];

// CHANGE TO (more robust)
const moneyMatches = [...t.matchAll(/\$?\s*([0-9]{1,3}(?:[,\s]\d{3})*(?:\.\d+)?)\s*(k|thousand|m|million|hundred\s*thousand)?/gi)];
if (moneyMatches.length > 0 && !slots.est_home_value) {
  const match = moneyMatches[0];
  let value = parseFloat(match[1].replace(/[,\s]/g, ''));
  if (match[2]) {
    const mult = match[2].toLowerCase();
    if (mult.includes('k') || mult.includes('thousand')) value *= 1000;
    if (mult.includes('m') || mult.includes('million')) value *= 1000000;
    if (mult.includes('hundred thousand')) value *= 100000;
  }
  if (value > 50000) slots.est_home_value = value;
}
```

---

## 🎯 COMMON COMBINATIONS

### Make Barbara Fast & Direct (for high-intent leads)
1. **Personality:** Reduce to 1-2 sentences (lines 8-10)
2. **Personality:** More professional tone (lines 13-15)
3. **Controller:** Skip equity requirement - `canBook() = isQualified()` (lines 126-128)
4. **Result:** Qualification → Book immediately

---

### Make Barbara Warm & Thorough (for cold leads)
1. **Personality:** Keep 2-3 sentences (lines 8-10)
2. **Personality:** Strong Southern warmth (lines 13-15)
3. **Controller:** Require Q&A - `canBook() = ... && qaComplete` (lines 126-128)
4. **Personality:** Add empathy section (after line 30)
5. **Result:** Build trust, answer all questions, then book

---

### Optimize for Medical/Urgent Situations
1. **Controller:** Add timeline tracking (lines 17-24, 79-141)
2. **Personality:** Add empathy triggers (after line 30)
3. **Controller:** Update nudges for urgency (lines 133-141)
4. **Result:** Fast-track urgent cases, maintain warmth

---

## 📊 TESTING YOUR CHANGES

### After Each Edit:

**1. Syntax Check**
```bash
# For JS changes
node -c conversation-controller.js

# Should output nothing (no errors)
```

**2. Logic Test**
```javascript
// test-quick.js
import { createConversationController } from './conversation-controller.js';

const c = createConversationController();
c.updateSlotsFromUserText("I'm 68, need money for surgery urgently");

console.log('Slots:', c.slots);
console.log('Qualified:', c.isQualified());
console.log('Can book:', c.canBook());
```

**3. Integration Test**
- Start bridge with changes
- Make test call
- Check logs for controller state
- Verify Barbara's behavior matches your intent

---

## 🚨 BEFORE YOU DEPLOY

### Pre-Deployment Checklist:
- [ ] Backed up original files
- [ ] Tested changes locally
- [ ] Verified no syntax errors
- [ ] Made test inbound call
- [ ] Made test outbound call
- [ ] Checked debug logs
- [ ] Verified booking still works
- [ ] Verified booking guard still blocks when incomplete

---

## 🔄 ROLLBACK PLAN

If something breaks:

```bash
# Git rollback (if you committed before changes)
git checkout HEAD -- prompts/Barbara\ JSON\ System/

# Or restore from backup
cp backup/barbara-personality-core.md prompts/Barbara\ JSON\ System/
cp backup/conversation-controller.js prompts/Barbara\ JSON\ System/
```

---

## 💡 GOLDEN RULE

**ONE CHANGE AT A TIME**

1. Make ONE edit
2. Test it
3. Verify it works
4. Commit to git
5. Move to next edit

Don't change 10 things and wonder which one broke it!

---

**Happy tuning! 🎯**

