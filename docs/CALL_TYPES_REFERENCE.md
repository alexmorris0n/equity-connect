# Call Types Reference

## Overview
The Barbara Platform supports 9 different call types, each with a dedicated prompt optimized for that specific scenario.

---

## 🎯 Call Types

### **1. Inbound - Qualified** 📞
**Value:** `inbound-qualified`

**When Used:**
- Lead exists in database
- Has property/equity data
- Returning caller

**Prompt Focus:**
- Personalized greeting with lead name
- Reference previous conversation
- Quick qualification check
- Focus on next steps (appointment booking)

**Example:**
> "Hi John! Good to hear from you again. I see we talked about your property on Main Street..."

---

### **2. Inbound - Unqualified** 📞
**Value:** `inbound-unqualified`

**When Used:**
- New caller (no lead record)
- OR lead without property data
- First-time interaction

**Prompt Focus:**
- Warm welcome
- Data collection (name, property info, age)
- Basic qualification
- Education about reverse mortgages

**Example:**
> "Hi, I'm Barbara! Thanks for calling. May I get your name to start?"

---

### **3. Outbound - Warm** 📱
**Value:** `outbound-warm`

**When Used:**
- Qualified lead with equity data
- Follow-up call
- Lead has shown interest

**Prompt Focus:**
- Immediate personalization
- Reference why calling
- Assume familiarity
- Move to appointment quickly

**Example:**
> "Hi Sarah! This is Barbara from Equity Connect. I'm following up on your reverse mortgage inquiry about your home in Austin..."

---

### **4. Outbound - Cold** 📱
**Value:** `outbound-cold`

**When Used:**
- First touch outbound
- Lead not yet qualified
- Cold prospect

**Prompt Focus:**
- Soft introduction
- Permission-based ("Do you have a moment?")
- Quick value proposition
- Qualification questions

**Example:**
> "Hi, this is Barbara calling from Equity Connect. I'm reaching out to homeowners in your area about..."

---

### **5. Transfer/Handoff** 🔄
**Value:** `transfer`

**When Used:**
- Warm transfer from another agent
- Escalation from chat/email
- Internal handoff

**Prompt Focus:**
- Acknowledge transfer
- Already has context
- Skip re-qualification
- Direct to resolution

**Example:**
> "Hi! I understand you were speaking with Sarah and she transferred you to me to help with..."

---

### **6. Scheduled Callback** ⏰
**Value:** `callback`

**When Used:**
- Lead scheduled a callback
- Appointment reminder call
- Follow-up at specific time

**Prompt Focus:**
- Reference scheduled call
- Assume readiness to talk
- Move directly to purpose
- Time-efficient

**Example:**
> "Hi John! This is Barbara with your scheduled 2pm callback about your reverse mortgage consultation..."

---

### **7. Broker - Schedule Check** 📅
**Value:** `broker-schedule-check`

**When Used:**
- Broker calls the Barbara line
- Wants to check daily appointments
- Quick schedule review

**Prompt Focus:**
- Broker-specific greeting
- Quick authentication
- Read out appointments for the day
- Time slots and lead names
- Brief lead context

**Example:**
> "Hi Walter! I have your schedule for today. You have 3 appointments: 10am with Sarah Martinez regarding her property in Austin..."

---

### **8. Broker - Connect for Appointment** 🤝
**Value:** `broker-connect-appointment`

**When Used:**
- Broker calls to be connected
- For a scheduled appointment
- Warm transfer to lead

**Prompt Focus:**
- Broker authentication
- Check which appointment
- Brief lead context
- Warm introduction
- Connect call

**Example:**
> "Hi Walter! I'll connect you with John Smith for your 2pm appointment. He's expecting your call about his reverse mortgage consultation..."

---

### **9. Emergency Fallback** 🛟
**Value:** `fallback`

**When Used:**
- No other prompt matches
- System error or unknown context
- Emergency backup

**Prompt Focus:**
- Minimal, safe prompt
- Basic Barbara personality
- Gather context
- Transfer if needed

**Example:**
> "Hi, I'm Barbara! I'm here to help with reverse mortgage questions. How can I assist you today?"

---

## 🔧 Technical Implementation

### **Bridge Logic (prompt-manager.js)**

The bridge determines call type based on:

```javascript
function determineCallType(callContext) {
  const {
    context,           // 'inbound' or 'outbound'
    is_broker,         // Broker calling in
    broker_action,     // 'schedule-check' or 'connect'
    lead_id,           // Lead exists?
    has_property_data, // Has equity/property info?
    is_qualified,      // Qualification status
    is_transfer,       // Transferred call?
    is_callback        // Scheduled callback?
  } = callContext;
  
  // Broker-specific calls
  if (is_broker) {
    if (broker_action === 'schedule-check') return 'broker-schedule-check';
    if (broker_action === 'connect') return 'broker-connect-appointment';
  }
  
  // Special cases
  if (is_transfer) return 'transfer';
  if (is_callback) return 'callback';
  
  // Outbound
  if (context === 'outbound') {
    return is_qualified ? 'outbound-warm' : 'outbound-cold';
  }
  
  // Inbound
  if (context === 'inbound') {
    return (lead_id && has_property_data && is_qualified) 
      ? 'inbound-qualified' 
      : 'inbound-unqualified';
  }
  
  // Fallback
  return 'fallback';
}
```

### **Database Query**

```sql
-- Get active prompt for call type
SELECT p.*, pv.content, pv.variables
FROM prompts p
JOIN prompt_versions pv ON p.id = pv.prompt_id
WHERE p.call_type = 'inbound-qualified'
  AND p.is_active = true
  AND pv.is_active = true
LIMIT 1;
```

### **Caching Strategy**

- Cache all prompts on bridge startup
- Refresh cache every 5 minutes
- Store last fetched prompt in memory
- Fallback to cached version if database fails

---

## 📝 Prompt Creation Guidelines

When creating prompts for each call type:

1. **Use appropriate greeting style** for the context
2. **Adjust data collection** (warm leads need less)
3. **Set appropriate tone** (warm vs. cold, urgent vs. casual)
4. **Include relevant tools** for that scenario
5. **Consider time sensitivity** (callback = quick, cold = patient)
6. **Use correct variables** (broker calls need broker info)

---

## 🎭 Variable Usage by Call Type

| Call Type | Lead Variables | Broker Variables | Property Variables |
|-----------|----------------|------------------|--------------------|
| Inbound - Qualified | ✅ All | ✅ All | ✅ All |
| Inbound - Unqualified | ❌ Minimal | ❌ Generic | ❌ None |
| Outbound - Warm | ✅ All | ✅ All | ✅ All |
| Outbound - Cold | ⚠️ Basic | ⚠️ Basic | ❌ None |
| Transfer | ✅ All | ✅ All | ✅ All |
| Callback | ✅ All | ✅ All | ✅ All |
| Broker - Schedule | ❌ None | ✅ All | ❌ None |
| Broker - Connect | ✅ Current Appt | ✅ All | ✅ Current Appt |
| Fallback | ❌ None | ❌ None | ❌ None |

---

## 🚀 Next Steps

1. ✅ Database migration applied (voice + call_type columns)
2. ✅ UI updated with call type selector
3. ⏳ Create bridge database query functions
4. ⏳ Update bridge to use database prompts
5. ⏳ Implement caching strategy
6. ⏳ Create prompts for each call type
7. ⏳ Test with real calls

