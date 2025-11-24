# CONCISE Solutions - No Bloat

## 1. ✅ Identity Confirmation (GREET Node)

### Current Issue
Prompt says "if name in context" - making it optional. Barbara skipped it.

### Minimal Fix
```yaml
# Just change line 9 from:
"2. Name Verification (if name in context):"

# To:
"2. Name Verification (REQUIRED):"
```

**Full update:**
```
1. Greet: "Hi! Equity Connect, this is Barbara. How are you today?"
2. Name Verification (REQUIRED):
   Ask: "Just to confirm, is this [Name]?"
   If YES → continue
   If NO → Call mark_wrong_person
3. Continue to intent capture
```

---

## 2. ✅ Double-Question Fix (ANSWER Node)

### Minimal Fix
```yaml
# Current line 5:
"5. Check: 'Does that help? What else comes to mind?'"

# Split into:
"5. Ask: 'Does that help?'
6. Wait for response
7. If YES: 'What else comes to mind?'"
```

That's it. No bloat.

---

## 3. ✅ Fee Routing Fix (ANSWER Node)

### Minimal Fix - Add ONE Section

Insert this BEFORE the calculation triggers:
```yaml
KEY DISTINCTION:
- "What kind/type of fees" = Stay in ANSWER
- "How much can I get" = Route to QUOTE

If asking about TYPES/KINDS of things → ANSWER
If asking about AMOUNTS for THEIR property → QUOTE
```

No long list. Just the key distinction.

---

## 4. ⚠️ Settings in Vue (NOT direct DB)

### YOU'RE RIGHT - These should be in UI

Looking at the code, I see:
- **SignalWire tab exists** ✅ (line 222-390 in Verticals.vue)
- **BUT** - No agent parameter settings exposed

### What's Missing from SignalWire Tab:

```typescript
signalwireConfig needs:
  - end_of_speech_timeout: 2500  // Currently NOT in UI
  - attention_timeout: 10000      // Currently NOT in UI  
  - transparent_barge: true       // Currently NOT in UI
```

### Recommendation

**Add "Agent Behavior" section to SignalWire tab:**

```vue
<!-- Add after TTS Parameters section (line 382) -->
<div class="config-section" style="margin-top: 24px;">
  <h4>Agent Behavior</h4>
  
  <div class="form-group">
    <label>End of Speech Timeout (ms)</label>
    <input type="number" v-model.number="signalwireConfig.end_of_speech_timeout" 
           min="1000" max="5000" step="100" />
    <small>How long to wait for silence before considering speech ended (1000-5000ms)</small>
  </div>

  <div class="form-group">
    <label>Attention Timeout (ms)</label>
    <input type="number" v-model.number="signalwireConfig.attention_timeout" 
           min="5000" max="60000" step="1000" />
    <small>How long to wait before prompting inactive user (5000-60000ms)</small>
  </div>

  <div class="form-group">
    <label>
      <input type="checkbox" v-model="signalwireConfig.transparent_barge" />
      Transparent Barge
    </label>
    <small>Allow caller to interrupt without AI responding immediately</small>
  </div>
</div>
```

### Where to Add
File: `portal/src/views/admin/Verticals.vue`
Location: After line 382 (after TTS Parameters section)

---

## Summary

### Prompt Changes (Minimal)
1. **GREET**: Change "if name in context" → "REQUIRED"
2. **ANSWER**: Split double-question into 2 steps
3. **ANSWER**: Add 2-line distinction about fee questions

### UI Changes (New)
Add 3 settings to SignalWire tab:
- End of Speech Timeout
- Attention Timeout  
- Transparent Barge

**No bloat. Just the essentials.** ✨

