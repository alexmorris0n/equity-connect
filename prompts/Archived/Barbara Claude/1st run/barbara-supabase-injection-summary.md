# BARBARA PROMPTS - SUPABASE INJECTION ARCHITECTURE

**Updated: October 20, 2025**

---

## 🎯 WHAT CHANGED

You correctly identified that we need to make the prompts **explicitly aware** that dynamic data is injected from Supabase at call start, NOT stored in the base prompt.

### Before:
❌ Prompts said "WAIT FOR CALLER INFORMATION" (vague)
❌ No clear guidance on fallback behavior
❌ Assumed all data would always be available

### After:
✅ Prompts say "DYNAMIC DATA INJECTION FROM SUPABASE" (explicit)
✅ Clear natural fallback patterns for missing data
✅ "Use only what's provided" principle throughout
✅ Examples of natural conversational fallbacks

---

## 📁 UPDATED FILES

All prompts have been updated to reflect this architecture:

1. **[Main Prompt](computer:///mnt/user-data/outputs/barbara-main-prompt.md)**
   - New section: "IMPORTANT: DYNAMIC DATA INJECTION"
   - Updated section: "CALLER CONTEXT - AUTOMATIC SUPABASE INJECTION"
   - Emphasis on natural fallbacks throughout

2. **[Inbound Addendum](computer:///mnt/user-data/outputs/barbara-inbound-addendum.md)**
   - New section: "INBOUND CALLER DATA (SUPABASE INJECTION)"
   - Natural fallback examples for missing name, email engagement, etc.

3. **[Outbound Addendum](computer:///mnt/user-data/outputs/barbara-outbound-addendum.md)**
   - New section: "OUTBOUND CALLER DATA (SUPABASE INJECTION)"
   - Campaign archetype fallbacks
   - Persona sender fallbacks

4. **[Supabase Injection Template](computer:///mnt/user-data/outputs/barbara-supabase-injection-template.md)** ✨ NEW
   - Complete template showing exact format
   - 3 example injections (outbound with full context, inbound returning caller, inbound minimal data)
   - Implementation notes for building injections

5. **[Quick Reference](computer:///mnt/user-data/outputs/barbara-quick-reference.md)**
   - Updated to reflect Supabase injection pattern

6. **[Implementation Guide](computer:///mnt/user-data/outputs/barbara-implementation-guide.md)**
   - Still accurate (buildCallerInfo function aligns with new template)

---

## 🔑 KEY PRINCIPLES

### 1. Supabase is Source of Truth
**At call start, a system message is injected with ALL available data from Supabase.**

What's included:
- Lead data (name, property, equity, age)
- Broker data (name, company, NMLS, phone)
- Email engagement (campaign, persona, opens, clicks)
- Call history (previous calls, outcomes, duration)
- Last call context (money purpose, objections, questions, key details)

### 2. Natural Fallback Pattern
**If a field is marked "Not Available", Barbara uses natural conversational fallbacks.**

Examples:
| Missing Data | Fallback Behavior |
|--------------|-------------------|
| Name | "Hi there!" instead of "Hi [name]!" |
| Campaign archetype | "We sent you information..." (generic) |
| Persona sender | "We reached out..." (no specific name) |
| Previous context | Ask: "What brings you to us today?" |
| Age | Ask: "How old are you?" |
| Home value | Ask: "What do you think it's worth?" |

### 3. "Use Only What's Provided"
**Barbara NEVER makes up information.**

✅ DO:
- Check injection for data availability
- Use what's there naturally
- Ask conversationally for missing info
- Reference previous context when available

❌ DON'T:
- Assume data that's marked "Not Available"
- Make up campaign details
- Invent previous conversations
- Ask questions already answered (check injection first!)

---

## 📋 INJECTION FORMAT

### Template Structure:

```markdown
# DYNAMIC CALL CONTEXT - READ THIS FIRST

## CALL METADATA
- Direction (inbound/outbound)
- Caller type (NEW_CALLER, RETURNING_CALLER, BROKER)

## LEAD INFORMATION
- Name (or "Not Available")
- Phone (always available)
- Property address, city, state
- Estimated value & equity (or "Not Available")
- Mortgage status (or "Unknown")
- Age (or "Not Available")

## BROKER INFORMATION
- Broker name, company, NMLS (always available)
- Broker phone (for voicemail scripts)
- Broker ID (for tool calls)

## EMAIL CAMPAIGN CONTEXT
- Campaign archetype (or "Not Available")
- Persona sender name (or "Not Available")
- Email opens/clicks (or "None")

## CALL HISTORY
- Previous calls count
- Last call date
- Average duration

## LAST CALL CONTEXT
- Money purpose (medical, home_repair, etc.)
- Specific need description
- Amount needed
- Timeline
- Objections raised
- Questions asked
- Key details to remember

## OPENING INSTRUCTIONS
- Exact recommended greeting for this call
- Next steps based on available data
```

**See full template with 3 complete examples:** `barbara-supabase-injection-template.md`

---

## 💻 IMPLEMENTATION IN BRIDGE

### 1. Query Supabase at Call Start

```javascript
const leadData = await supabase
  .from('leads')
  .select(`
    *,
    broker:brokers(*),
    call_history:interactions(*)
  `)
  .eq('primary_phone', phoneNumber)
  .single();
```

### 2. Build Injection Text

```javascript
const injection = buildSupabaseInjection({
  direction: 'inbound', // or 'outbound'
  lead: leadData,
  broker: leadData.broker,
  callHistory: leadData.call_history,
  emailEngagement: {
    campaign_archetype: leadData.campaign_archetype,
    persona_sender_name: leadData.persona_sender_name,
    email_opens: leadData.email_opens,
    email_clicks: leadData.email_clicks
  },
  lastCallContext: lastCall?.metadata
});
```

### 3. Inject as First System Message

```javascript
await openai.conversation.item.create({
  type: 'message',
  role: 'system',
  content: [{ 
    type: 'input_text', 
    text: injection 
  }]
});
```

### 4. Barbara Reads and Uses It

Barbara's prompt explicitly tells her:
- This injection is her ONLY source of dynamic data
- She must check for "Not Available" markers
- She should use natural fallbacks when data is missing
- She should NEVER ask questions already answered (check injection first)

---

## 🧪 TESTING STRATEGY

### Test Case 1: Full Data Available
- Lead with name, property, equity
- Campaign archetype + persona sender
- Previous call with context
- **Expected:** Barbara uses all context naturally

### Test Case 2: Minimal Data
- Unknown lead (no name)
- No email engagement
- First call
- **Expected:** Barbara uses fallbacks ("Hi there!", asks all qualification questions)

### Test Case 3: Returning Caller
- Lead called before
- Previous call had objections
- Money purpose was medical
- **Expected:** Barbara references previous conversation: "I know you mentioned medical expenses last time..."

### Test Case 4: Email Campaign Context
- Campaign: "no_more_payments"
- Persona: "Linda"
- Opens: 3, Clicks: 1
- **Expected:** Barbara says: "Hi [name], Linda sent you an email about eliminating your mortgage payment..."

### Test Case 5: Missing Campaign Data (Outbound)
- No campaign archetype
- No persona sender
- **Expected:** Barbara uses generic: "We sent you information about reverse mortgage options..."

---

## ✅ BENEFITS OF THIS ARCHITECTURE

1. **Explicit expectations:** Barbara knows data comes from Supabase injection
2. **Graceful degradation:** Natural fallbacks when data missing
3. **Consistent behavior:** Same pattern across all 3 prompts
4. **Easy debugging:** Check injection text to see what Barbara sees
5. **Flexible:** Works with full context OR minimal data
6. **Production-ready:** Handles edge cases (unknown caller, no email engagement, etc.)

---

## 🔄 MIGRATION FROM OLD PROMPTS

**Old approach:**
- Generic "CALLER INFORMATION" section
- No guidance on missing data
- Assumed all fields always present

**New approach:**
- Explicit "SUPABASE DATA INJECTION" section
- Natural fallback patterns throughout
- "Use only what's provided" principle
- Clear examples of graceful degradation

**Migration steps:**
1. ✅ Update all 3 prompts (already done)
2. ✅ Create injection template (already done)
3. ⏳ Update bridge to use new injection format
4. ⏳ Test with various data availability scenarios
5. ⏳ Deploy to production

---

## 📚 FILE SUMMARY

| File | Purpose | Status |
|------|---------|--------|
| `barbara-main-prompt.md` | Shared foundation | ✅ Updated |
| `barbara-inbound-addendum.md` | Inbound-specific | ✅ Updated |
| `barbara-outbound-addendum.md` | Outbound-specific | ✅ Updated |
| `barbara-supabase-injection-template.md` | Injection format & examples | ✅ New |
| `barbara-implementation-guide.md` | How to implement in bridge | ✅ Still accurate |
| `barbara-quick-reference.md` | Quick lookup guide | ✅ Updated |

---

## 🚀 NEXT STEPS

1. Review updated prompts
2. Test injection template with your Supabase schema
3. Update bridge `buildCallerInfo()` to match new template format
4. Test edge cases (minimal data, returning caller, etc.)
5. Deploy to Northflank
6. Monitor real calls for fallback behavior

---

**You now have a robust, production-ready prompt system that gracefully handles any data availability scenario!** 🎉

**Key quote to remember:**
> "Dynamic variables (lead, broker, property, last call context) are injected automatically from Supabase at call start. If unavailable, use natural fallback phrasing."

This is now explicitly stated in all 3 prompts and demonstrated in the injection template.
