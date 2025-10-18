# Microsite Instant Call Flow

**Use Case:** Lead fills microsite form → Barbara calls in 10 seconds

---

## 🔥 Why This Converts at 40%+

### Traditional Lead Gen (5-10% conversion):
1. Lead fills form → "Thanks, we'll call you"
2. 2 days pass → Lead forgets
3. Cold call → "Who is this?"
4. Low conversion

### Instant Call Flow (40%+ conversion):
1. Lead fills form → "Call Me Now" button
2. Clicks button → "Calling you in 10 seconds..."
3. Phone rings → They EXPECT it
4. Barbara: "You just checked your eligibility..."
5. **HIGH conversion** (hot lead, explicit consent, context-aware)

---

## 🏗️ Architecture

```
Microsite Form
    ↓
Validates (age 62+, equity estimate)
    ↓
Shows "Call Me Now" button
    ↓
User clicks → POST to n8n webhook
    ↓
n8n Workflow:
  1. Create lead in Supabase
  2. Build HOT LEAD prompt (different from email)
  3. POST to bridge /start-call
    ↓
Bridge → SignalWire → Dials lead
    ↓
10 seconds later: Phone rings
    ↓
Barbara: "Hi! You just requested this call..."
```

**Same bridge as email flows. Different prompt = different outcome.**

---

## 📝 Microsite Form Code

### Frontend (Next.js/Vercel)

```javascript
// pages/calculator.js or components/EligibilityForm.js

const [formData, setFormData] = useState({});
const [showCallButton, setShowCallButton] = useState(false);
const [calling, setCalling] = useState(false);
const [countdown, setCountdown] = useState(null);

const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Instant validation
  const age = parseInt(formData.age);
  const equity = parseInt(formData.estimatedEquity);
  
  if (age < 62) {
    return showError("Reverse mortgages require age 62+");
  }
  
  if (equity < 100000) {
    return showError("Minimum $100k equity typically required");
  }
  
  // They qualify! Show call button
  setShowCallButton(true);
  showSuccess("Great news! You likely qualify. Want to speak with Barbara right now?");
};

const triggerInstantCall = async () => {
  setCalling(true);
  setCountdown(10);
  
  // Countdown timer
  const timer = setInterval(() => {
    setCountdown(prev => {
      if (prev <= 1) {
        clearInterval(timer);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  
  try {
    // Call n8n webhook
    const response = await fetch('/api/trigger-instant-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'microsite',
        subdomain: window.location.hostname.split('.')[0],
        lead_data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
          age: formData.age,
          property_address: formData.address,
          property_city: formData.city,
          property_state: formData.state,
          estimated_equity: formData.estimatedEquity,
          consent: true,
          consent_method: 'microsite_call_me_now',
          ip_address: window.userIP, // From IP detection
          user_agent: navigator.userAgent
        },
        utm_params: {
          source: window.utm_source,
          medium: window.utm_medium,
          campaign: window.utm_campaign
        }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showSuccess(`📞 Barbara is calling ${formData.phone} RIGHT NOW!`);
    }
  } catch (err) {
    showError("Failed to initiate call. Please try again.");
    setCalling(false);
  }
};

// UI
return (
  <div>
    {!showCallButton ? (
      <form onSubmit={handleSubmit}>
        {/* Form fields */}
        <button type="submit">Check My Eligibility</button>
      </form>
    ) : (
      <div className="instant-call-widget">
        <h2>✅ You Qualify!</h2>
        <p>Estimated available equity: ${formatCurrency(formData.estimatedEquity)}</p>
        
        {!calling ? (
          <button 
            className="call-now-btn"
            onClick={triggerInstantCall}
          >
            📞 Call Me Now
          </button>
        ) : (
          <div className="calling-status">
            <h3>📞 Barbara is calling you now!</h3>
            <div className="countdown">{countdown}</div>
            <p>Answer your phone: {formData.phone}</p>
            <p className="hint">
              From: (424) 485-1544<br/>
              Barbara already has your info!
            </p>
          </div>
        )}
      </div>
    )}
  </div>
);
```

### Backend API Route (Vercel Edge Function)

```javascript
// pages/api/trigger-instant-call.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { lead_data, source, subdomain, utm_params } = req.body;
  
  // Call n8n webhook
  const n8nResponse = await fetch(
    'https://n8n.instaroute.com/webhook/microsite-instant-call',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source,
        subdomain,
        lead_data,
        utm_params,
        timestamp: new Date().toISOString(),
        call_immediately: true
      })
    }
  );
  
  const data = await n8nResponse.json();
  
  return res.status(200).json({
    success: true,
    call_sid: data.call_sid,
    estimated_call_time: '10 seconds'
  });
}
```

---

## 🔀 n8n Workflow: "Microsite Instant Call"

### Node 1: Webhook Trigger

**Webhook:** `/webhook/microsite-instant-call`  
**Method:** POST

Receives:
```json
{
  "source": "microsite",
  "subdomain": "hollywood",
  "lead_data": {
    "first_name": "John",
    "last_name": "Smith",
    "phone": "+14155556565",
    "age": 68,
    "property_address": "1234 Hollywood Blvd",
    "estimated_equity": 450000,
    "consent": true,
    "consent_method": "microsite_call_me_now"
  },
  "call_immediately": true
}
```

### Node 2: Determine Broker (Code Node)

```javascript
// Assign broker based on subdomain/territory
const subdomainToBroker = {
  'hollywood': 'walter-uuid',
  'beverlyhills': 'walter-uuid',
  'pasadena': 'maria-uuid',
  'default': 'walter-uuid'
};

const brokerId = subdomainToBroker[$json.subdomain] || subdomainToBroker.default;

return { 
  broker_id: brokerId,
  lead_data: $json.lead_data 
};
```

### Node 3: Create Lead in Supabase

**Supabase Insert**  
**Table:** `leads`

```json
{
  "first_name": "{{$json.lead_data.first_name}}",
  "last_name": "{{$json.lead_data.last_name}}",
  "primary_phone": "{{$json.lead_data.phone}}",
  "age": "{{$json.lead_data.age}}",
  "property_address": "{{$json.lead_data.property_address}}",
  "estimated_equity": "{{$json.lead_data.estimated_equity}}",
  "source": "microsite",
  "consent": true,
  "consent_method": "microsite_call_me_now",
  "assigned_broker_id": "{{$json.broker_id}}",
  "status": "hot_lead",
  "lead_score": 85,
  "created_at": "={{$now}}"
}
```

Returns: `lead_id`

### Node 4: Get Broker Data

**Supabase Query**  
**Table:** `brokers`  
**Filter:** `id = {{$json.broker_id}}`

Returns: Broker info (name, company, phone)

### Node 5: Build HOT LEAD Instructions (Code Node)

```javascript
const lead = $('Create Lead in Supabase').item.json;
const broker = $('Get Broker Data').item.json;

// HOT LEAD PROMPT (Different from email!)
const HOT_LEAD_PROMPT = `You are Barbara, a warm reverse mortgage specialist.

CRITICAL CONTEXT: This lead just clicked "Call Me Now" on our website 10 SECONDS AGO.
- They are EXPECTING this call RIGHT NOW
- They have their phone in their hand
- They JUST self-qualified (age 62+, sufficient equity)
- They gave EXPLICIT consent by clicking the button
- They are in ACTIVE RESEARCH MODE

DO NOT waste time with:
❌ "Is this a good time?" (YES - they just requested the call)
❌ "Did you reach out about reverse mortgages?" (YES - 10 seconds ago!)
❌ Long introductions

DO immediately:
✅ Acknowledge they just requested the call
✅ Reference the equity amount they saw
✅ Ask about their WHY
✅ Build on their momentum
✅ Book appointment THIS CALL (they're HOT)

OPENING (say this FIRST):
"Hi ${lead.first_name}! This is Barbara from ${broker.company_name}. You just checked your eligibility on our website - I'm calling right now like you requested!"

THEN immediately:
"So I see you could potentially access around ${formatCurrency(lead.estimated_equity)} from your home equity. What got you interested in looking into this today?"

CONVERSATION STYLE:
- Fast-paced (they're engaged NOW)
- Confident (they already qualified themselves)
- Action-oriented (book appointment)
- Maximum 3-5 minutes
- GOAL: Book appointment before they cool off

CLOSE RATE TARGET: 40%+

Lead just provided:
- Name: ${lead.first_name} ${lead.last_name}
- Phone: ${lead.primary_phone}
- Age: ${lead.age}
- Property: ${lead.property_address}
- Estimated equity: ${formatCurrency(lead.estimated_equity)}
- Source: Microsite (they found YOU)
- Consent: EXPLICIT (clicked "Call Me Now" button)
- Timestamp: Just now (10 seconds ago)

Broker:
- Name: ${broker.contact_name}
- Company: ${broker.company_name}
- NMLS: ${broker.nmls_number}

YOUR TOOLS:
- update_lead_info: Save any missing data
- book_appointment: Schedule consultation (USE THIS CALL!)
- save_interaction: Log outcome

Remember: They are HOT RIGHT NOW. Strike while iron is hot. This is your best chance to book them.`;

// Format currency helper
function formatCurrency(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + ' million dollars';
  }
  return Math.round(num / 1000) + ' thousand dollars';
}

return {
  instructions: HOT_LEAD_PROMPT,
  to: lead.primary_phone,
  from: broker.outbound_phone_number,
  lead_id: lead.id,
  broker_id: broker.id
};
```

### Node 6: Start Instant Call

**HTTP Request**  
**Method:** POST  
**URL:** `https://voice-bridge.northflank.app/start-call`

**Body:**
```json
{
  "to": "{{$json.to}}",
  "from": "{{$json.from}}",
  "lead_id": "{{$json.lead_id}}",
  "broker_id": "{{$json.broker_id}}",
  "instructions": "{{$json.instructions}}"
}
```

### Node 7: Log Call Initiated

**Supabase Insert**  
**Table:** `interactions`

```json
{
  "lead_id": "{{$json.lead_id}}",
  "broker_id": "{{$json.broker_id}}",
  "type": "ai_call",
  "direction": "outbound",
  "subject": "Microsite Instant Call",
  "metadata": {
    "source": "microsite_instant",
    "call_sid": "{{$node['Start Instant Call'].json.callSid}}",
    "seconds_since_form": 10
  }
}
```

---

## 📊 Expected Performance

### Microsite Hot Leads vs Email Warm Leads

| Metric | Email Leads | Microsite Instant |
|--------|-------------|-------------------|
| **Answer Rate** | 40-50% | **90%+** (expecting call) |
| **Conversation Length** | 7-10 min | **3-5 min** (get to point) |
| **Appointment Booking** | 15-20% | **40-50%** (hot & ready) |
| **Show Rate** | 60% | **80%+** (higher commitment) |
| **Cost per Appointment** | $15-20 | **$8-12** (higher conversion) |

**Why microsite converts better:**
- ✅ Zero time delay (strike while hot)
- ✅ Explicit consent (they clicked button)
- ✅ Self-qualified (they checked eligibility)
- ✅ Context-aware (Barbara has their data)
- ✅ Expected call (no surprise)

---

## 🎯 Microsite UX Best Practices

### Before Call Button:
```
╔════════════════════════════════════╗
║  ✅ Great News!                    ║
║  You Likely Qualify                ║
║                                    ║
║  Based on your information:        ║
║  • Age: 68 ✓                       ║
║  • Estimated Equity: $450,000 ✓    ║
║                                    ║
║  You could potentially access:     ║
║  💰 $225,000 - $270,000            ║
║                                    ║
║  Want to know your exact options?  ║
║                                    ║
║  [📞 Call Me Right Now]            ║
║                                    ║
║  Barbara can explain your options  ║
║  in 3 minutes (no obligation)      ║
╚════════════════════════════════════╝
```

### During Call (Countdown):
```
╔════════════════════════════════════╗
║  📞 Barbara is calling you now!    ║
║                                    ║
║  Answer your phone in:             ║
║        【  7 seconds  】           ║
║                                    ║
║  Calling: (415) 555-6565          ║
║  From: (424) 485-1544             ║
║                                    ║
║  💡 Tip: Barbara already has:      ║
║  • Your property info              ║
║  • Your estimated equity           ║
║  • Your qualification status       ║
║                                    ║
║  Just answer and ask questions!    ║
╚════════════════════════════════════╝
```

---

## 🧪 A/B Testing Ideas

### Test 1: Immediate vs 5-Minute Delay

**A:** Call instantly (10 seconds)  
**B:** "Barbara will call in 5 minutes"

**Hypothesis:** Instant converts higher (strike while hot)

### Test 2: Prompt Variations

**A:** Professional Barbara (efficient, direct)  
**B:** Warm Barbara (grandmotherly, patient)

**Hypothesis:** Professional converts better for microsite (they're ready for business)

### Test 3: Opening Lines

**A:** "You just checked your eligibility..."  
**B:** "You requested a call about your $450k equity..."  
**C:** "Perfect timing! Let's talk about your options..."

**Measure:** Conversation length, appointment booking rate

---

## 💰 ROI Calculation

### Assumptions:
- 100 microsite forms/month
- 90% answer rate (expecting call)
- 45% book appointment
- 75% show rate
- $3,000 commission per funded deal
- 20% funding rate

### Monthly Results:
- 100 forms → 90 calls answered
- 90 calls → 40 appointments booked
- 40 appointments → 30 show up
- 30 consultations → 6 funded deals
- **6 deals × $3,000 = $18,000 revenue**

### Cost:
- OpenAI + SignalWire: ~$35 (100 calls × $0.35)
- **ROI: 514x** 🚀

**vs Traditional 2-day delayed callback:**
- Same 100 forms
- 40% answer rate (they forgot)
- 15% booking rate
- Result: ~1-2 funded deals
- **Revenue: $3-6k** (vs $18k with instant)

---

## 🚀 Implementation Timeline

### Week 1: Deploy Bridge
- ✅ Bridge on Northflank
- ✅ Email → call flow working
- Test with manual triggers

### Week 2: Build Microsite Integration
- Add "Call Me Now" button to existing microsites
- Create n8n "Microsite Instant Call" workflow
- Test with your own phone

### Week 3: Pilot Launch
- Enable on 1-2 microsites
- Monitor conversion rates
- Optimize Barbara's hot lead prompt

### Week 4: Full Rollout
- Enable on all microsites
- A/B test variations
- **Scale to 500+ instant calls/month**

---

## 🔑 Key Differences from Email Flow

| Aspect | Email Flow | Microsite Instant |
|--------|------------|-------------------|
| **Lead Temperature** | Warm | 🔥 HOT |
| **Timing** | 1-3 days later | 10 seconds |
| **Expectation** | Cold call | Expected call |
| **Context** | Limited | Full (they just provided) |
| **Consent** | Email reply | Explicit button click |
| **Barbara's Tone** | Build rapport first | Jump to business |
| **Call Length** | 7-10 min | 3-5 min |
| **Close Rate** | 15-20% | 40-50% |
| **Bridge Code** | ✅ Same | ✅ Same |
| **n8n Workflow** | Different | Different |
| **Barbara Prompt** | Different | Different |

**Same infrastructure. Different outcomes.**

---

## ✅ Ready to Deploy

**The bridge supports this TODAY.**

No code changes needed. Just:
1. Build microsite form with "Call Me Now" button
2. Create n8n workflow (from this guide)
3. Configure webhook endpoints
4. Test with your phone
5. **Launch** 🚀

---

**This is how you get 40% conversion rates while competitors get 5%.** 💰

**But first: Deploy the bridge tomorrow.** 😏

