# 🔌 How to Connect SWAIG Bridge to SignalWire

**Your SWAIG Bridge URL:** `https://barbara-swaig.fly.dev/agent/barbara`

---

## ✅ **Step 1: Verify Your Bridge is Running**

```bash
# Check if it's deployed
curl https://barbara-swaig.fly.dev/healthz

# Should return: {"status":"healthy","agent":"barbara-swaig"}
```

---

## 📞 **Step 2: Configure SignalWire Phone Number**

### **Go to SignalWire Dashboard:**

1. **Login:** https://reversebot.signalwire.com (your space)
2. **Click:** "Phone Numbers" in left sidebar
3. **Click:** Your phone number (e.g., `+14244851544`)

### **Configure Voice Settings:**

1. **Find:** "Voice & Fax" section
2. **Set:** "Accept Incoming Calls" → **"Voice Calls"**
3. **Set:** "Handle Calls Using" → **"SWML Script / Webhook"**
4. **Enter URL:** `https://barbara-swaig.fly.dev/agent/barbara`
5. **Set Method:** **POST** (not GET)
6. **Click:** "Save" button

### **Visual Guide:**

```
SignalWire Dashboard → Phone Numbers → [Your Number]
  ↓
Voice & Fax Tab
  ↓
Accept Incoming: Voice Calls
Handle Calls Using: SWML Script / Webhook
Request URL: https://barbara-swaig.fly.dev/agent/barbara
HTTP Method: POST
  ↓
[Save]
```

---

## 🧪 **Step 3: Test It**

1. **Call your SignalWire number** from your phone
2. **Wait 2-3 seconds** (agent is loading)
3. **Barbara should answer** with greeting

### **If It Doesn't Work:**

**Check Fly.io logs:**
```bash
fly logs -a barbara-swaig
```

**Check SignalWire logs:**
- Dashboard → Logs → Calls
- Look for errors or webhook failures

---

## 🔍 **What SignalWire Sends:**

When a call comes in, SignalWire will POST to your bridge:

```json
{
  "From": "+16505300051",
  "To": "+14244851544",
  "CallSid": "CA123...",
  "Direction": "inbound"
}
```

Your bridge extracts the phone number and generates SWML with your prompt + functions.

---

## ✅ **That's It!**

Once configured, every call to your SignalWire number will:
1. Hit your bridge at `/agent/barbara`
2. Load lead context from database
3. Generate SWML with prompt + SWAIG functions
4. SignalWire executes the SWML
5. Functions call back to `/functions/{function_name}`

---

## 🐛 **Troubleshooting**

### **"Call connects but no answer"**
- Check Fly.io logs: `fly logs -a barbara-swaig`
- Verify URL is correct in SignalWire dashboard
- Make sure method is POST, not GET

### **"500 Error"**
- Check if PUBLIC_URL is set: `fly secrets list -a barbara-swaig`
- Should be: `PUBLIC_URL=barbara-swaig.fly.dev`

### **"Agent doesn't speak"**
- Check API keys are set (OpenAI, Deepgram, ElevenLabs)
- Check logs for API errors

---

**Need help?** Check logs first, then we can debug together.

