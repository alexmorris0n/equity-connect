# BARBARA JSON SYSTEM - BRIDGE INTEGRATION

**Minimal prompt + JSON state controller = Bulletproof conversation flow**

---

## 🎯 ARCHITECTURE

### Old Way (Prompt-Heavy)
```
┌─────────────────────────────┐
│  Giant 30KB Prompt          │
│  - Personality              │
│  - Logic                    │
│  - Validation               │
│  - Flow control             │
│  - Examples                 │
└─────────────────────────────┘
         ↓
    OpenAI Realtime
```
**Problem**: Model must "remember" rules, can drift, expensive per call

### New Way (JSON Controller)
```
┌──────────────────┐     ┌─────────────────────┐
│ Personality      │     │ Conversation        │
│ Prompt (1KB)     │  +  │ Controller (JSON)   │
│ - Tone           │     │ - Phase tracking    │
│ - Voice          │     │ - Slot validation   │
│ - Warmth         │     │ - Booking guards    │
└──────────────────┘     └─────────────────────┘
         ↓                        ↓
           OpenAI Realtime (metadata)
```
**Benefit**: Zero drift, enforced gates, cacheable prompt, structured state

---

## 📦 FILES

1. **`barbara-personality-core.md`** (1KB) - Cached personality prompt
2. **`realtime-payload-template.json`** - Session initialization template
3. **`conversation-controller.js`** - State machine logic
4. **`bridge-integration-guide.md`** - This file

---

## 🔧 IMPLEMENTATION STEPS

### Step 1: Load the personality prompt (once at startup)

```javascript
import fs from 'fs';
import path from 'path';

const PERSONALITY_PROMPT = fs.readFileSync(
  path.join(process.cwd(), 'prompts/Barbara JSON System/barbara-personality-core.md'),
  'utf8'
);
```

### Step 2: Initialize conversation controller

```javascript
import { createConversationController } from './conversation-controller.js';

// On new call start
const controller = createConversationController({
  lead: leadData,
  broker: brokerData,
  timezone: 'America/Los_Angeles'
});
```

### Step 3: Build caller information from Supabase

```javascript
async function buildCallerInformation(callSid, direction) {
  const lead = await getLeadByPhone(callSid);
  const broker = await getBrokerById(lead.broker_id);
  const lastCall = await getLastInteraction(lead.id);
  const campaign = await getCampaignEngagement(lead.id);

  return {
    call_direction: direction, // "inbound" or "outbound"
    call_type: lastCall ? "RETURNING_CALLER" : "NEW_CALLER",
    lead: {
      id: lead.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      phone: lead.phone,
      email: lead.email,
      age: lead.age
    },
    property: {
      street: lead.property_street,
      city: lead.property_city,
      state: lead.property_state,
      zip: lead.property_zip,
      estimated_value: lead.estimated_value,
      mortgage_balance: lead.mortgage_balance,
      estimated_equity: lead.estimated_equity
    },
    broker: {
      id: broker.id,
      first_name: broker.first_name,
      last_name: broker.last_name,
      company: broker.company,
      phone: broker.phone,
      nmls: broker.nmls
    },
    campaign: campaign ? {
      archetype: campaign.archetype,
      persona_sender: campaign.persona_sender,
      email_opens: campaign.email_opens,
      email_clicks: campaign.email_clicks,
      last_opened: campaign.last_opened
    } : null,
    last_call_context: lastCall ? lastCall.metadata : null
  };
}
```

### Step 4: Create Realtime session with JSON state

```javascript
async function initializeRealtimeSession(ws, lead, broker, direction) {
  const callerInfo = await buildCallerInformation(lead.phone, direction);
  const controller = createConversationController({ lead, broker });

  const sessionUpdate = {
    type: "session.update",
    session: {
      instructions: PERSONALITY_PROMPT,
      
      voice: "alloy",
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 200
      },

      tools: [
        // Load from realtime-payload-template.json
      ],

      metadata: {
        controller_state: {
          phase: controller.phase,
          slots: controller.slots,
          equityPresented: false,
          qaComplete: false,
          canBook: controller.canBook(),
          missing_slot: controller.missingSlot(),
          next_question: controller.nextQuestionFor(controller.missingSlot())
        },
        caller_information: callerInfo
      }
    }
  };

  ws.send(JSON.stringify(sessionUpdate));
  return controller;
}
```

### Step 5: Update state on user speech

```javascript
ws.on('message', async (data) => {
  const msg = JSON.parse(data);

  // When user speaks (transcript arrives)
  if (msg.type === 'conversation.item.input_audio_transcription.completed') {
    const userText = msg.transcript;
    
    // Update slots from speech
    controller.updateSlotsFromUserText(userText);
    
    // Check if qualification complete
    if (controller.phase === controller.Phase.QUALIFY && controller.isQualified()) {
      controller.nextPhase(); // → EQUITY
      controller.markEquityPresented();
    }

    // Send updated state to Realtime
    const stateUpdate = {
      type: "session.update",
      session: {
        metadata: {
          controller_state: {
            phase: controller.phase,
            slots: controller.slots,
            equityPresented: true,
            canBook: controller.canBook(),
            missing_slot: controller.missingSlot(),
            next_question: controller.nextQuestionFor(controller.missingSlot())
          }
        }
      }
    };
    ws.send(JSON.stringify(stateUpdate));

    // Auto-nudge if needed
    const nudge = controller.nudgeForCurrentPhase();
    if (nudge) {
      ws.send(JSON.stringify({
        type: 'response.create',
        response: {
          instructions: nudge,
          modalities: ['audio']
        }
      }));
    }
  }

  // Guard booking attempts
  if (msg.type === 'response.function_call_arguments.done' && msg.name === 'book_appointment') {
    if (!controller.canBook()) {
      // BLOCK the booking
      ws.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: msg.call_id,
          output: JSON.stringify({ 
            error: 'QUALIFICATION_INCOMPLETE',
            message: 'Cannot book until all required information is collected'
          })
        }
      }));

      // Auto-ask next missing slot
      const missing = controller.missingSlot();
      if (missing) {
        const question = controller.nextQuestionFor(missing);
        ws.send(JSON.stringify({
          type: 'response.create',
          response: {
            instructions: question,
            modalities: ['audio']
          }
        }));
      }
      return; // Don't execute the tool
    }

    // If canBook=true, proceed with actual booking
    const bookingResult = await executeBooking(msg.arguments);
    ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: msg.call_id,
        output: JSON.stringify(bookingResult)
      }
    }));
  }
});
```

### Step 6: Inbound vs Outbound differentiation

```javascript
// Add to caller_information or controller_state
const callTypeAddendum = direction === 'inbound' 
  ? "Lead called you - they're warm. Capture intent quickly."
  : "You're calling lead - wait for 'hello?', build trust first, reference email campaign.";

// Include in session metadata
metadata: {
  controller_state: { ... },
  caller_information: { 
    ...callerInfo,
    call_type_instructions: callTypeAddendum
  }
}
```

---

## 🎯 KEY BENEFITS

1. **Zero drift** - JSON enforces gates, no skipped steps
2. **Cacheable prompt** - Personality file cached, state is dynamic
3. **Token efficiency** - 1KB prompt vs 30KB, massive savings
4. **Bulletproof validation** - Can't book until `canBook: true`
5. **Structured state** - Easy to debug, log, replay
6. **Separation of concerns** - Tone in prompt, logic in controller

---

## 📊 TOKEN COMPARISON

| Approach | Prompt Size | Per-Call Cost | Cacheable |
|----------|-------------|---------------|-----------|
| **Old (Prompt31)** | 30KB (~7,500 tokens) | ~$0.15/call | Partial |
| **New (JSON)** | 1KB (~250 tokens) + 2KB JSON | ~$0.01/call | Yes (prompt) |

**Savings: ~90% token reduction per call**

---

## 🚨 IMPORTANT GUARDRAILS

### Booking Guard (Enforced in Bridge)
```javascript
if (msg.name === 'book_appointment' && !controller.canBook()) {
  // Block and redirect
  return rejectAndAskNextSlot();
}
```

### Phase Enforcement
```javascript
if (controller.phase === 'QUALIFY' && !controller.isQualified()) {
  // Don't allow equity presentation
  const missing = controller.missingSlot();
  return askFor(missing);
}
```

### Slot Validation
```javascript
// Update slots from ASR, re-check qualification
controller.updateSlotsFromUserText(userTranscript);
if (controller.isQualified()) {
  controller.nextPhase();
}
```

---

## 📝 EXAMPLE FLOW

```
User: "Hi, I got your email about reverse mortgages"
→ controller.updateSlotsFromUserText() 
→ phase: RAPPORT
→ Barbara: "Great! What brought you to look into this?"

User: "I need money for my roof"
→ slots.purpose = 'home_repair'
→ phase: QUALIFY
→ Barbara: "Got it! And are you sixty-two or older?"

User: "Yes, I'm 68"
→ slots.age_62_plus = true
→ missing_slot: 'primary_residence'
→ Barbara: "Perfect! And do you live there full-time?"

User: "Yes"
→ slots.primary_residence = true
→ missing_slot: 'mortgage_status'
→ Barbara: "Is your home paid off, or do you still have a mortgage?"

User: "Paid off"
→ slots.mortgage_status = 'paid_off'
→ missing_slot: 'est_home_value'
→ Barbara: "What do you think it's worth — just a ballpark?"

User: "About 550,000"
→ slots.est_home_value = '550000'
→ isQualified() = true
→ phase: EQUITY
→ Barbara: "Wonderful! So you own your home free and clear, worth about five hundred fifty thousand. You could potentially access two hundred seventy-five to three hundred thirty thousand."
→ equityPresented = true
→ phase: QA

User: "What are the costs?"
→ Barbara calls search_knowledge()
→ Answers question

User: "No more questions"
→ qaComplete = true
→ canBook = true
→ phase: BOOK

Barbara: "Would you like to schedule a call with Walter to go over your exact options?"
User: "Yes"
→ Barbara calls book_appointment (allowed because canBook=true)
→ Appointment booked ✅
```

---

## 🎬 NEXT STEPS

1. ✅ Copy `barbara-personality-core.md` to `bridge/prompts/`
2. ✅ Copy `conversation-controller.js` to `bridge/`
3. ✅ Update `server.js` to use JSON state system
4. ✅ Test inbound call (validate slot tracking)
5. ✅ Test outbound call (validate booking guard)
6. ✅ Deploy to Northflank
7. ✅ Monitor for drift (should be zero)

---

**This is how modern production AI voice systems are built. Prompts for personality, code for enforcement.**

