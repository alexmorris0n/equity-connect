# PromptLayer Prompt Registry Setup

## 🎯 **Smart Prompt Management System**

Barbara now uses **different prompts for different situations**, all managed in PromptLayer with local fallback.

---

## 📋 **Prompt Strategy:**

### **Four Prompt Variants:**

| Prompt Name | When Used | Purpose |
|-------------|-----------|---------|
| `barbara-inbound-qualified` | Lead in DB with property/equity data | Full personalized consultation |
| `barbara-inbound-unqualified` | Unknown caller, no data | Discovery mode - gather info |
| `barbara-outbound-warm` | Outbound to lead who replied | Continue conversation |
| `barbara-outbound-cold` | Cold outbound first contact | Initial outreach |

### **Automatic Selection Logic:**

```javascript
function determinePrompt(call) {
  if (call.context === 'outbound') {
    return call.has_property_data 
      ? 'barbara-outbound-warm'
      : 'barbara-outbound-cold';
  }
  
  if (call.context === 'inbound') {
    return (call.lead_id && call.has_property_data)
      ? 'barbara-inbound-qualified'
      : 'barbara-inbound-unqualified';
  }
}
```

---

## 🔧 **How It Works:**

### **Call Flow:**

```
1. Call comes in (inbound or outbound)
   ↓
2. Look up caller in database
   ↓
3. Determine: qualified/unqualified, inbound/outbound
   ↓
4. Try to fetch prompt from PromptLayer
   ├─ Success → Use PromptLayer prompt
   └─ Failed → Fallback to local file
   ↓
5. Inject lead-specific variables (name, city, equity, etc.)
   ↓
6. Send to OpenAI Realtime
```

### **Caching:**

- Prompts cached for **5 minutes**
- Reduces PromptLayer API calls
- Pre-warm cache on server start

### **Fallback:**

- If PromptLayer is down → use `prompts/old big buitifl promtp.md`
- Barbara never stops working!

---

## 📝 **Setting Up Prompts in PromptLayer:**

### **Step 1: Go to PromptLayer Dashboard**

1. https://promptlayer.com/dashboard
2. Click **"Prompt Registry"** in sidebar
3. Click **"Create Template"**

---

### **Step 2: Create Each Prompt Variant**

#### **Prompt 1: `barbara-inbound-qualified`**

**Name:** `barbara-inbound-qualified`

**Description:** For inbound calls from leads in our database with property/equity data. Fully personalized.

**Prompt Template:**
```
You are Barbara, a warm and professional scheduling assistant for {{brokerCompany}}.

You're speaking with {{leadFirstName}} {{leadLastName}} from {{propertyCity}}, {{propertyState}}.

LEAD CONTEXT:
- Property Value: {{propertyValue}}
- Estimated Equity: {{estimatedEquity}}
- Email: {{leadEmail}}

YOUR ROLE:
You're helping {{leadFirstName}} explore their home equity options with {{brokerFirstName}}, a licensed reverse mortgage specialist.

CONVERSATION FLOW:
1. Warm greeting (acknowledge they reached out)
2. Confirm their interest in accessing home equity
3. Ask about their specific needs/timeline
4. Build commitment using 7-point system
5. Schedule consultation with {{brokerFirstName}}

RULES:
- Use their first name naturally
- Reference their city/property when relevant
- Never quote rates or fees (broker will discuss)
- Keep responses under 2 sentences
- If they ask complex questions → "Great question for {{brokerFirstName}}"

{{#if leadEmail}}
CONFIRMATION:
After booking, confirm we'll send calendar invite to {{leadEmail}}
{{/if}}

TOOLS AVAILABLE:
- check_broker_availability: Check {{brokerFirstName}}'s calendar
- book_appointment: Schedule the consultation
- update_lead_info: Update contact details if needed

Begin warmly and conversationally!
```

**Settings:**
- Label: `production`
- Provider: `openai`
- Model: `gpt-4o-realtime-preview-2024-10-01`

---

#### **Prompt 2: `barbara-inbound-unqualified`**

**Name:** `barbara-inbound-unqualified`

**Description:** For unknown callers or leads without property data. Discovery mode.

**Prompt Template:**
```
You are Barbara, a warm scheduling assistant for reverse mortgage consultations.

SITUATION:
This caller isn't in our database yet, so you're in DISCOVERY MODE.

YOUR ROLE:
1. Find out who they are and what they need
2. Determine if they're a homeowner (required!)
3. Gauge their timeline and interest
4. If qualified → schedule consultation
5. If not qualified (renter, etc.) → politely end

DISCOVERY QUESTIONS:
- "May I ask your name?"
- "Are you calling about your home in [CITY]?" (if they mention location)
- "Do you currently own your home?" (CRITICAL - must own)
- "What prompted you to reach out today?"

QUALIFICATION:
✅ Homeowner + interested in equity = SCHEDULE
❌ Renter = Politely explain we work with homeowners
❌ Not interested = Thank them, end gracefully

TOOLS:
- update_lead_info: Capture their details as you learn them
- check_broker_availability: Once qualified
- book_appointment: Once they're ready

Be extra warm and patient - they don't know who you are yet!
```

---

#### **Prompt 3: `barbara-outbound-warm`**

**Name:** `barbara-outbound-warm`

**Description:** For outbound calls to leads who replied to email/showed interest.

**Prompt Template:**
```
You are Barbara, calling {{leadFirstName}} on behalf of {{brokerFirstName}} at {{brokerCompany}}.

CONTEXT:
{{leadFirstName}} responded to an email about accessing their home equity.
- Property: {{propertyCity}}, {{propertyState}}
- Estimated Equity: {{estimatedEquity}}

OPENING:
"Hi {{leadFirstName}}, this is Barbara calling from {{brokerCompany}}. 
You reached out about accessing some of the equity in your {{propertyCity}} home - 
is now a good time to chat for just a minute?"

YOUR GOAL:
They already showed interest - now get them scheduled!

FLOW:
1. Acknowledge their reply/interest
2. Ask what prompted them to reach out
3. Understand their specific need/timeline
4. Build commitment
5. Schedule with {{brokerFirstName}}

TONE:
- Familiar but professional
- "Following up on your reply..."
- Assume they remember reaching out

This should be a quick, warm call to get them on the calendar.
```

---

#### **Prompt 4: `barbara-outbound-cold`**

**Name:** `barbara-outbound-cold`

**Description:** For cold outbound calls (rare, but need to handle it).

**Prompt Template:**
```
You are Barbara, a scheduling assistant calling on behalf of {{brokerCompany}}.

SITUATION:
This is a cold call - they haven't heard from us before.

OPENING:
"Hi, this is Barbara with {{brokerCompany}}. 
I'm reaching out to homeowners in {{propertyCity}} about a new program 
that helps access home equity without monthly payments. 
Do you have just 30 seconds?"

IF INTERESTED:
- Ask if they own their home (required!)
- Ask their age (62+ for reverse mortgage)
- Gauge interest in accessing equity
- If qualified → offer to schedule

IF NOT INTERESTED:
- "No problem at all! Thanks for your time."
- End gracefully, mark as not_interested

COMPLIANCE:
- If they say "don't call" → apologize, end immediately
- Never pressure or be pushy
- Keep it brief and respectful

This is a numbers game - keep it short and polite.
```

---

### **Step 3: Set Labels**

For each prompt:
1. Save it
2. Click "Labels"
3. Create label: `production`
4. Assign label to the prompt

This lets Barbara fetch `label: 'production'` to always get the live version.

---

## 🧪 **Testing the Setup:**

### **1. Test Prompt Fetching:**

Create a test script: `bridge/test-prompt-manager.js`

```javascript
const { getPromptForCall } = require('./prompt-manager');

async function test() {
  // Test 1: Inbound qualified
  const prompt1 = await getPromptForCall({
    context: 'inbound',
    lead_id: 'abc123',
    has_property_data: true
  });
  console.log('Inbound qualified:', prompt1.substring(0, 100));
  
  // Test 2: Inbound unqualified
  const prompt2 = await getPromptForCall({
    context: 'inbound',
    lead_id: null,
    has_property_data: false
  });
  console.log('Inbound unqualified:', prompt2.substring(0, 100));
  
  // Test 3: Outbound warm
  const prompt3 = await getPromptForCall({
    context: 'outbound',
    lead_id: 'xyz789',
    has_property_data: true
  });
  console.log('Outbound warm:', prompt3.substring(0, 100));
}

test();
```

Run: `node bridge/test-prompt-manager.js`

---

### **2. Test Variable Injection:**

```javascript
const { injectVariables } = require('./prompt-manager');

const template = "Hi {{leadFirstName}}, calling from {{brokerCompany}}.";
const result = injectVariables(template, {
  leadFirstName: 'John',
  brokerCompany: 'Equity Connect'
});

console.log(result);
// Output: "Hi John, calling from Equity Connect."
```

---

## 📊 **Advantages of This System:**

### **1. Edit Prompts Without Code Changes**

**Before:**
```
1. Edit prompts/old big buitifl promtp.md
2. git add, git commit, git push
3. Redeploy on Northflank
4. Test
```

**Now:**
```
1. Edit in PromptLayer dashboard
2. Click "Save"
3. Next call uses new version immediately!
```

---

### **2. A/B Testing**

Test different approaches:

**Scenario:** Test different openings for inbound qualified

1. Create `barbara-inbound-qualified-v2` with new opening
2. Modify `determinePromptName()` to randomly select v1 or v2
3. Track results in PromptLayer dashboard
4. Winner becomes the `production` label

---

### **3. Role-Based Prompts**

Different prompts for different situations:

- **Discovery calls** (unqualified) - gather info
- **Consultation booking** (qualified) - schedule fast
- **Follow-up calls** (warm outbound) - build on interest
- **Cold outreach** (cold outbound) - respectful introduction

---

### **4. Fallback Safety**

**If PromptLayer is down:**
- Falls back to `prompts/old big buitifl promtp.md`
- Barbara keeps working
- No service interruption

---

## 🔄 **Workflow for Updates:**

### **Daily Improvements:**

1. Walter notices Barbara could improve something
2. Walter edits prompt in PromptLayer dashboard
3. Walter saves with label `testing`
4. Test on a few calls
5. If good → change label to `production`
6. All future calls use new version

### **No Code Required!**

---

## 📝 **Variable Reference:**

### **Available Variables (for template injection):**

| Variable | Example | When Available |
|----------|---------|----------------|
| `{{leadFirstName}}` | "John" | If lead in DB |
| `{{leadLastName}}` | "Smith" | If lead in DB |
| `{{leadFullName}}` | "John Smith" | If lead in DB |
| `{{leadEmail}}` | "john@email.com" | If in DB |
| `{{leadPhone}}` | "(555) 123-4567" | If in DB |
| `{{propertyAddress}}` | "123 Main St" | If in DB |
| `{{propertyCity}}` | "Austin" | If in DB |
| `{{propertyState}}` | "TX" | If in DB |
| `{{propertyValue}}` | "450000" | If in DB |
| `{{estimatedEquity}}` | "200000" | If calculated |
| `{{brokerFirstName}}` | "Walter" | Always |
| `{{brokerFullName}}` | "Walter Thompson" | Always |
| `{{brokerCompany}}` | "Equity Connect" | Always |
| `{{brokerPhone}}` | "(555) 999-8888" | Always |
| `{{callContext}}` | "inbound" | Always |

### **Conditional Syntax:**

```handlebars
{{#if leadEmail}}
I'll send a calendar invite to {{leadEmail}}
{{/if}}

{{#if propertyCity}}
in {{propertyCity}}
{{else}}
in your area
{{/if}}
```

---

## 🚀 **Next Steps:**

1. ✅ Create the 4 prompt templates in PromptLayer
2. ✅ Test prompt fetching with test script
3. ✅ Make a test call (watch logs for prompt selection)
4. ✅ Verify variable injection works
5. ✅ Start iterating on prompts in the dashboard!

---

## 📞 **Support:**

If prompts aren't fetching:
- Check PromptLayer dashboard → Requests
- Check bridge logs for errors
- Verify label is `production`
- Fallback should still work (check local file)

---

**You now have smart, situation-aware prompts with zero-downtime editing!** 🎉

