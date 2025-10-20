# BARBARA 3-PROMPT SYSTEM - QUICK REFERENCE

**OpenAI Realtime API Optimized | Last Updated: Oct 20, 2025**

---

## 📁 FILES

| File | Purpose | Size | Use Case |
|------|---------|------|----------|
| `barbara-main-prompt.md` | Shared foundation | ~6,500 tokens | ALL calls |
| `barbara-inbound-addendum.md` | Inbound-specific | ~1,800 tokens | Lead calls Barbara |
| `barbara-outbound-addendum.md` | Outbound-specific | ~2,300 tokens | Barbara calls lead |
| `barbara-implementation-guide.md` | Integration guide | - | How to use in bridge |

---

## 🎯 WHEN TO USE WHICH PROMPT

### INBOUND (Lead Calls Barbara)
```
Main Prompt + Inbound Addendum
```
**Scenarios:**
- Lead dials SignalWire number directly
- Instant callback from microsite button
- Returning caller (called before, calling again)

**Key Behaviors:**
- Greet warmly: "Thanks for calling [broker company], this is Barbara!"
- Move fast - they're warm/hot
- Less rapport-building needed
- Capture intent quickly: "What brought you to call today?"

---

### OUTBOUND (Barbara Calls Lead)
```
Main Prompt + Outbound Addendum
```
**Scenarios:**
- Email reply with phone number
- Cold email follow-up
- Scheduled callback

**Key Behaviors:**
- **WAIT FOR "HELLO?"** before speaking
- Greet with email reference: "Hi [name], this is Barbara from [broker company]. [Persona] sent you an email about..."
- Build trust FIRST - these are cold leads
- Ask permission: "Do you have a quick moment?"
- Reference campaign archetype (No More Payments, Cash Unlocked, High Equity)

---

## 🔧 REALTIME API OPTIMIZATIONS

### What Changed from Original Prompt?

❌ **REMOVED:**
- TTS pronunciation workarounds (numbers as words)
- Excessive formatting instructions
- Synchronous tool call patterns

✅ **ADDED:**
- Realtime API awareness section
- VAD (Voice Activity Detection) handling
- Event-driven tool execution patterns
- Speech-to-speech native instructions
- "Wait for Hello?" protocol (outbound)

✅ **IMPROVED:**
- Interruption handling (VAD auto-pauses)
- Tool narration while executing
- Natural conversation flow
- Silence handling (3-4 second patience)

---

## 💬 SUPABASE DATA INJECTION

**This system message is injected automatically at the START of every call from Supabase database.**

### What Gets Injected:

**Always Available:**
- Call direction (inbound/outbound)
- Call type, caller type
- Broker data (name, company, NMLS, phone, ID)

**Usually Available:**
- Lead name, phone, property address
- Estimated value & equity
- Mortgage status
- Age (if PropertyRadar had it)

**Sometimes Available:**
- Email campaign archetype (no_more_payments, cash_unlocked, high_equity_special)
- Persona sender name (Linda, David, Sarah)
- Email opens/clicks
- Previous call context (money purpose, objections, timeline, key details)

### Natural Fallback Pattern:

**If data is marked "Not Available":**
- ✅ Use natural conversational fallback
- ❌ Don't make up information

**Examples:**
- No name? → "Hi there!" instead of "Hi [name]!"
- No campaign? → "We sent you information..." (generic)
- No previous context? → Ask: "What brings you to us today?"
- No age? → Ask: "How old are you?"

**See the full injection template:** `barbara-supabase-injection-template.md`

---

## 🛠️ IMPLEMENTATION CHECKLIST

- [ ] Copy 3 prompt files to `bridge/prompts/`
- [ ] Implement `buildCallerInfo()` function
- [ ] Load prompts at bridge server startup
- [ ] Update session creation logic (Main + Addendum)
- [ ] Inject CALLER INFORMATION as first system message
- [ ] Test inbound calls (dial SignalWire number)
- [ ] Test outbound calls (trigger via n8n)
- [ ] Validate CALLER INFORMATION accuracy
- [ ] Monitor VAD behavior in logs
- [ ] Deploy to Northflank
- [ ] Run parallel testing (Vapi vs Bridge)
- [ ] Migrate all numbers, disable Vapi

---

## 📊 KEY METRICS TO TRACK

### Inbound Calls
- **Qualification rate:** 80%+ (most should qualify)
- **Appointment booking rate:** 40%+ (they're warm)
- **Time to appointment:** <5 minutes

### Outbound Calls
- **Contact rate:** 30-40% (many voicemails)
- **Qualification rate:** 50%+ (of those who answer)
- **Appointment booking rate:** 15-25% (cold leads)
- **Time to appointment:** 5-8 minutes (need trust-building)

---

## 🚨 COMMON ISSUES & FIXES

### Issue: Barbara speaks too early on outbound
**Fix:** Verify "Wait for Hello?" protocol is in outbound addendum. VAD may trigger on background noise.

### Issue: Barbara doesn't reference previous call context
**Fix:** Verify CALLER INFORMATION includes `last_call_context` with metadata from `save_interaction`.

### Issue: Barbara repeats questions already answered
**Fix:** Ensure CALLER INFORMATION has complete lead data. Barbara should check before asking.

### Issue: Tools execute but Barbara doesn't narrate
**Fix:** Review "Tool Calls - Event-Driven Flow" section. Barbara should speak WHILE tools execute.

### Issue: Barbara sounds robotic
**Fix:** Emphasize "Variety" section in main prompt. Use natural Southern expressions.

---

## 🎤 VOICE OPTIMIZATION NOTES

### OpenAI Realtime API Specifics
- **Codec:** PCM16 @ 24kHz (or 16kHz)
- **Latency:** <300ms end-to-end
- **Interruption:** VAD handles automatically
- **Voice:** `alloy` (or your preferred OpenAI voice)
- **Turn detection:** Threshold 0.5, silence 200ms

### What Barbara Should Sound Like
- **Warm and bubbly** (Southern accent)
- **Natural pacing** (not rushed)
- **2-3 sentences max** per turn
- **Conversational** (not scripted)
- **Empathetic** with seniors

---

## 📞 CALL FLOW REFERENCE

### INBOUND
1. SignalWire receives call
2. Bridge detects inbound
3. Lookup lead by phone number
4. Build CALLER INFORMATION
5. Load Main + Inbound prompts
6. Inject CALLER INFORMATION
7. Barbara greets: "Thanks for calling!"
8. Qualify + Book + Save interaction

### OUTBOUND
1. n8n triggers call
2. Bridge receives trigger
3. Lookup lead + broker data
4. Build CALLER INFORMATION
5. Load Main + Outbound prompts
6. Place SignalWire call
7. **Wait for "Hello?"**
8. Barbara greets with email reference
9. Ask permission + Build trust
10. Qualify + Book + Save interaction

---

## 🔗 TOOL CALL REFERENCE

### Available Tools (7 Total)
1. **get_lead_context** - Lookup lead by phone
2. **search_knowledge** - Search 80-chunk KB
3. **check_consent_dnc** - Verify calling permissions
4. **update_lead_info** - Save data during call
5. **check_broker_availability** - Calendar lookup
6. **book_appointment** - Schedule + create billing event
7. **save_interaction** - Log transcript, outcome, metadata

### Tool Call Pattern
```javascript
// Barbara narrates WHILE tool executes
"Let me check what's available..." [tool running in background]
// Result arrives
"Okay! I see Tuesday at 10 or Thursday at 2..."
```

---

## 💾 SAVE INTERACTION METADATA

**Always capture at end of call:**

```javascript
{
  money_purpose: "medical" | "home_repair" | "debt_consolidation" | "help_family" | "other",
  specific_need: "Husband needs heart surgery - $75k",
  amount_needed: 75000,
  timeline: "urgent" | "1-3_months" | "3-6_months" | "exploring",
  objections: ["fees_concern", "spouse_approval"],
  questions_asked: ["Can I leave house to kids?"],
  key_details: ["Retiring in 6 months", "Wife name is Mary"]
}
```

**This powers LAST CALL CONTEXT on future calls!**

---

## 📚 ADDITIONAL RESOURCES

- **Implementation Guide:** `barbara-implementation-guide.md`
- **Main Prompt:** `barbara-main-prompt.md`
- **Inbound Addendum:** `barbara-inbound-addendum.md`
- **Outbound Addendum:** `barbara-outbound-addendum.md`
- **Master Production Plan:** `MASTER_PRODUCTION_PLAN.md`
- **Voice Bridge Docs:** `VOICE_BRIDGE_DEPLOYMENT.md`

---

**QUICK START:** Load Main + Addendum based on call direction → Inject CALLER INFORMATION → Let Barbara do her thing! 🚀
