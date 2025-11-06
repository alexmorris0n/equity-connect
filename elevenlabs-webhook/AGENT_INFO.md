# Barbara - ElevenLabs Agent Info

## Agent Details

**Agent ID:** `agent_4101k9d99r1vfg3vtnbbc8gkdy99`  
**Agent Name:** Barbara - Equity Connect  
**Created:** November 6, 2025

**Webhook URL:** `https://barbara-elevenlabs-webhook.fly.dev/personalize`  
**Tools URL:** `https://barbara-elevenlabs-webhook.fly.dev/tools/*`

---

## ✅ What's Deployed

1. ✅ Personalization webhook (loads Supabase prompts)
2. ✅ 5 tool endpoints (lead lookup, KB search, availability, booking, updates)
3. ✅ Agent created via API
4. ✅ Webhook configured to call on every call

---

## 🚧 Next Steps (Manual Configuration Required)

### Step 1: Configure SIP Trunk in ElevenLabs

1. Go to: https://elevenlabs.io/app/agents/phone-numbers
2. Click: "Import from SIP Trunk"
3. **You'll need SignalWire SIP credentials:**
   - SIP Domain: `your-space.dapp.signalwire.com`
   - Username: (from SignalWire dashboard)
   - Password: (from SignalWire dashboard)
4. Once imported, **assign the number to agent:** `agent_4101k9d99r1vfg3vtnbbc8gkdy99`

### Step 2: Configure SignalWire to Route to ElevenLabs

1. In SignalWire Dashboard → SIP → Endpoints
2. Create new SIP endpoint
3. **You'll need ElevenLabs SIP details** (from ElevenLabs dashboard after Step 1)
4. Point your test phone number to this SIP endpoint

### Step 3: Test Call

1. Call your SignalWire test number
2. Expected flow:
   - SignalWire → SIP trunk → ElevenLabs Agent
   - ElevenLabs calls webhook
   - Webhook loads prompt from Supabase
   - Barbara speaks!

3. Monitor:
   - ElevenLabs: https://elevenlabs.io/app/agents/conversations
   - Webhook logs: `fly logs --app barbara-elevenlabs-webhook`

---

## 🎯 How It Works

```
Caller dials SignalWire number
    ↓
SignalWire routes via SIP to ElevenLabs
    ↓
ElevenLabs Agent Platform receives call
    ↓
Calls your webhook: /personalize
    ↓
Webhook queries Supabase for active prompt
    ↓
Loads prompt for call_type (inbound-qualified/unqualified/unknown)
    ↓
Injects 28 variables (lead name, property, broker info)
    ↓
Returns personalized prompt to ElevenLabs
    ↓
Barbara speaks with ElevenLabs voice
    ↓
During conversation, calls your tools as needed
```

---

## 📊 Monitoring

**ElevenLabs Dashboard:**
- Live conversations: https://elevenlabs.io/app/agents/conversations
- Analytics: https://elevenlabs.io/app/agents/analytics
- Usage/billing: https://elevenlabs.io/app/usage

**Webhook Logs:**
```bash
fly logs --app barbara-elevenlabs-webhook
```

**Troubleshooting:**
```bash
# Test webhook directly
curl https://barbara-elevenlabs-webhook.fly.dev/health

# Test personalization
curl -X POST https://barbara-elevenlabs-webhook.fly.dev/personalize \
  -H "Content-Type: application/json" \
  -d '{"caller_id": "+14155551234", "agent_id": "agent_4101k9d99r1vfg3vtnbbc8gkdy99", "called_number": "+14244851544", "call_sid": "test"}'

# Test lead lookup
curl -X POST https://barbara-elevenlabs-webhook.fly.dev/tools/lookup_lead \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+14155551234"}'
```

---

## 🎤 Voice Configuration

**Current:** Default ElevenLabs conversational voice

**To change voice:**
1. Go to: https://elevenlabs.io/app/voice-library
2. Find a voice you like
3. Copy the voice_id (e.g., `21m00Tcm4TlvDq8ikWAM`)
4. Update agent in dashboard or recreate with new voice_id

---

## 💰 Cost Estimate

At your scale (105,000 min/month):
- **ElevenLabs:** $0.08/min = $8,400/month
- **SignalWire PSTN:** ~$1,050/month
- **Total:** ~$9,450/month = **$113,400/year**

**vs Barbara V3:** $64,260/year  
**Difference:** +$49,140/year for best voice quality

---

## Your Portal (UNCHANGED!)

**PromptManagement.vue still works!**

1. Edit prompts in portal
2. Portal saves to Supabase
3. Next call → webhook loads new prompt
4. Zero code changes needed!

**All 28 variables work:**
- `{{leadFirstName}}`, `{{propertyCity}}`, `{{estimatedEquity}}`, etc.
- Webhook injects them automatically

---

## Next Steps Summary

1. ⚠️ **Configure SIP trunk** (ElevenLabs + SignalWire dashboards)
2. ⚠️ **Test call** (verify end-to-end works)
3. ⚠️ **Compare voice quality** (vs Barbara V3)
4. ⚠️ **Get Walter's feedback**
5. ⚠️ **Decide:** Keep or rollback

**You can run both systems in parallel!** Route different numbers to test.

