# Prompt Variables Reference

## Currently Available Variables

These variables are currently injected by the bridge's `injectVariables()` function and can be used in prompts:

### **Lead Information**
| Variable | Description | Example |
|----------|-------------|---------|
| `{{leadFirstName}}` | Lead's first name | "John" |
| `{{leadLastName}}` | Lead's last name | "Smith" |
| `{{leadFullName}}` | Lead's full name | "John Smith" |
| `{{leadEmail}}` | Lead's email address | "john@email.com" |
| `{{leadPhone}}` | Lead's phone number | "(555) 123-4567" |
| `{{leadAge}}` | Lead's age | "65" |

### **Property Information**
| Variable | Description | Example |
|----------|-------------|---------|
| `{{propertyAddress}}` | Full street address | "123 Main St" |
| `{{propertyCity}}` | City | "Los Angeles" |
| `{{propertyState}}` | State | "CA" |
| `{{propertyZipcode}}` | ZIP code | "90210" |
| `{{propertyValue}}` | Property value (numeric) | "500000" |
| `{{propertyValueWords}}` | Property value in words | "five hundred thousand" |
| `{{mortgageBalance}}` | Mortgage balance (numeric) | "150000" |
| `{{mortgageBalanceWords}}` | Mortgage balance in words | "one hundred fifty thousand" |
| `{{ownerOccupied}}` | Is property owner-occupied | "true" or "false" |

### **Equity Calculations**
| Variable | Description | Example |
|----------|-------------|---------|
| `{{estimatedEquity}}` | Estimated equity (numeric) | "350000" |
| `{{estimatedEquityWords}}` | Estimated equity in words | "three hundred fifty thousand" |
| `{{equity50Percent}}` | 50% of property value | "250000" |
| `{{equity50FormattedWords}}` | 50% in words | "two hundred fifty thousand" |
| `{{equity60Percent}}` | 60% of property value | "300000" |
| `{{equity60FormattedWords}}` | 60% in words | "three hundred thousand" |

### **Broker Information**
| Variable | Description | Example |
|----------|-------------|---------|
| `{{brokerFirstName}}` | Broker's first name | "Sarah" |
| `{{brokerLastName}}` | Broker's last name | "Johnson" |
| `{{brokerFullName}}` | Broker's full name | "Sarah Johnson" |
| `{{brokerCompany}}` | Broker's company name | "Equity Connect" |
| `{{brokerPhone}}` | Broker's phone number | "(555) 987-6543" |

### **Call Context**
| Variable | Description | Example |
|----------|-------------|---------|
| `{{callContext}}` | Call direction/type | "inbound" or "outbound" |

---

## ⚠️ Variables NOT Yet Available

These variables are used in prompts but are NOT currently injected by the bridge. They will appear as empty strings until implemented:

### **Appointment Variables** (for broker prompts)
- `{{appointmentId}}` - Unique appointment ID
- `{{appointmentTime}}` - Scheduled appointment time
- `{{appointmentStatus}}` - Current status (scheduled, in-progress, completed)
- `{{appointmentPurpose}}` - Purpose/topic of appointment
- `{{day}}` - Day for booking confirmation ("Monday")
- `{{time}}` - Time for booking confirmation ("3 PM")

### **Transfer Variables** (for transfer prompt)
- `{{transferReason}}` - Why the call was transferred
- `{{transferFrom}}` - Who transferred the call
- `{{transferNotes}}` - Notes from previous agent

### **Callback Variables** (for callback prompt)
- `{{callbackReason}}` - Reason for scheduled callback
- `{{scheduledTime}}` - When callback was scheduled
- `{{priorContext}}` - What was discussed in prior call

### **Broker-Facing Variables**
- `{{requestedDate}}` - Date broker is requesting schedule for
- `{{appointments}}` - List of appointments
- `{{clientFirstName}}` - Lead's first name (from broker perspective)
- `{{clientLastName}}` - Lead's last name (from broker perspective)
- `{{clientPhone}}` - Lead's phone (from broker perspective)

### **Call Routing Variables**
- `{{callerType}}` - "lead", "broker", "returning"
- `{{callDirection}}` - "inbound" or "outbound"

---

## How to Use Variables in Prompts

### **Basic Usage**
Just wrap the variable name in double curly braces:

```
Hi {{leadFirstName}}, this is Barbara from {{brokerCompany}}.
```

Becomes:
```
Hi John, this is Barbara from Equity Connect.
```

### **In Conversation Flows**
```
GREETING:
→ "Hi {{leadFirstName}}, how are you today?"
→ "I see you're in {{propertyCity}}, {{propertyState}}—lovely area!"
```

### **For Numbers**
Always use the `Words` version for spoken numbers:

❌ **Wrong:** "Your equity is about {{estimatedEquity}}"
✅ **Right:** "Your equity is about {{estimatedEquityWords}}"

### **Missing Variables**
If a variable is not provided, it will be replaced with an empty string:

```
"Hi {{leadFirstName}}" → "Hi " (if name is missing)
```

So always handle potentially missing variables gracefully:

✅ **Good:** "Hi there! What's your name?" (if leadFirstName might be empty)
❌ **Bad:** "Hi {{leadFirstName}}, welcome back!" (awkward if name is empty)

---

## Adding New Variables

To add a new variable to the system:

### **1. Update Bridge Variable Injection**

In `bridge/prompt-manager-supabase.js`, add to `enrichedVariables`:

```javascript
const enrichedVariables = {
  ...variables,
  // ... existing variables ...
  
  // NEW: Add your variable here
  appointmentTime: variables.appointmentTime || '',
  appointmentStatus: variables.appointmentStatus || '',
};
```

### **2. Pass Variable from Call Context**

When calling `getPromptForCall`, include the variable:

```javascript
const variables = {
  leadFirstName: lead.first_name,
  leadEmail: lead.email,
  
  // NEW: Pass your variable
  appointmentTime: appointment.scheduled_time,
  appointmentStatus: appointment.status
};

const { prompt } = await getPromptForCall(callContext, null, variables);
```

### **3. Use in Prompts**

Now you can use `{{appointmentTime}}` and `{{appointmentStatus}}` in your prompts!

---

## Best Practices

### ✅ **DO:**
- Use variables consistently across all prompts
- Provide defaults for missing variables in bridge code
- Use `Words` versions for spoken numbers
- Handle potentially missing variables gracefully in prompt text

### ❌ **DON'T:**
- Reference variables that don't exist (they'll appear as empty strings)
- Use numeric variables for spoken text (use `Words` versions)
- Assume variables are always present
- Hardcode values that should be dynamic

---

## Quick Reference

**Most Common Variables:**
```
Lead: {{leadFirstName}}, {{leadEmail}}, {{leadPhone}}
Property: {{propertyCity}}, {{propertyState}}, {{estimatedEquityWords}}
Broker: {{brokerFirstName}}, {{brokerCompany}}
```

**For Spoken Numbers:**
```
{{estimatedEquityWords}} ← Use this for voice
{{propertyValueWords}}   ← Use this for voice
{{mortgageBalanceWords}} ← Use this for voice
```

**Always Available:**
```
{{brokerCompany}} → Defaults to "Equity Connect"
{{brokerFirstName}} → Defaults to "one of our advisors"
```

