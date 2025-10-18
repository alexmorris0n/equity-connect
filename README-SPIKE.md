# OpenAI Realtime Bridge - SPIKE TEST

**Purpose:** Minimal proof-of-concept to verify SignalWire ↔ OpenAI Realtime audio streaming works.

This is a **30-minute test** - if it works, we'll build the full production version tomorrow with:
- Supabase tool integration
- Outbound calls
- Full error handling
- Production deployment

---

## What This Spike Does

✅ Accepts inbound calls from SignalWire  
✅ Streams audio bidirectionally (PCM16 @ 16kHz)  
✅ OpenAI Realtime responds with voice (Barbara greeting)  
❌ No Supabase tools yet  
❌ No outbound calls yet  
❌ No production error handling  

---

## Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy template
cp .env.template .env

# Edit .env and add your OpenAI API key
# Get it from: https://platform.openai.com/api-keys
```

Your `.env` should look like:
```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
PORT=8080
NODE_ENV=development
BRIDGE_URL=http://localhost:8080
```

### 3. Start the Bridge

```bash
npm run spike
```

You should see:
```
🚀 OpenAI Realtime Bridge (SPIKE) running!

   Health check: http://localhost:8080/healthz
   Inbound XML:  http://localhost:8080/public/inbound-xml
   WebSocket:    ws://localhost:8080/audiostream
```

---

## Testing Options

### Option A: Local Testing with ngrok (Recommended)

**1. Install ngrok:**
```bash
# Windows (if you don't have it)
choco install ngrok
# or download from https://ngrok.com/download
```

**2. Expose your local server:**
```bash
ngrok http 8080
```

You'll get a URL like: `https://abc123.ngrok-free.app`

**3. Update SignalWire:**
- Go to SignalWire Dashboard → Phone Numbers
- Select a test number
- Set **Voice URL** to: `https://abc123.ngrok-free.app/public/inbound-xml`
- Set **Method** to: `GET`
- Save

**4. Make a test call:**
- Call your SignalWire number from your phone
- You should hear Barbara greet you!

**Expected behavior:**
1. Call connects
2. ~2 second delay (WebSocket setup)
3. Barbara says: "Hi! How is your day going?"
4. You can talk to her

**Watch the terminal logs** - you'll see:
```
📞 SignalWire WebSocket connected
🤖 OpenAI Realtime connected
✅ OpenAI session configured
📞 Call started
🔊 AI finished speaking
```

---

### Option B: Deploy to Northflank (Production Test)

If you want to skip ngrok and test directly in Northflank:

**1. Create new service:**
- Go to Northflank → Your project
- Create new service → Combined (build + runtime)
- Connect to this repo
- Set build: Dockerfile (we'll create one if needed)
- Or just use: `node bridge/spike.js`

**2. Set environment variables:**
```
OPENAI_API_KEY=sk-proj-xxxxx
PORT=8080
BRIDGE_URL=https://YOUR_SERVICE_URL.northflank.app
```

**3. Deploy and get public URL**

**4. Point SignalWire to your Northflank URL**

---

## Troubleshooting

### "Missing OPENAI_API_KEY"
- Make sure you copied `.env.template` to `.env`
- Add your OpenAI API key from https://platform.openai.com/api-keys

### "SignalWire not connecting"
- Check ngrok is running (`ngrok http 8080`)
- Verify SignalWire Voice URL matches your ngrok URL
- Check SignalWire logs in dashboard

### "No audio / silence"
- Check OpenAI API key is valid
- Check terminal logs for WebSocket errors
- OpenAI Realtime API might have rate limits on free tier

### "Call connects but no greeting"
- Check terminal logs for `✅ OpenAI session configured`
- Might be a delay in OpenAI response (30s timeout)

---

## What to Check For

### ✅ **SUCCESS** looks like:

1. **Terminal shows:**
   ```
   📞 SignalWire WebSocket connected
   🤖 OpenAI Realtime connected
   ✅ OpenAI session configured
   📞 Call started
   🤖 OpenAI event: response.audio.delta
   🔊 AI finished speaking
   ```

2. **You hear:**
   - Barbara's voice greeting you
   - Natural conversation
   - Response to your questions

3. **This confirms:**
   - ✅ SignalWire `<Stream>` works
   - ✅ OpenAI Realtime WebSocket works
   - ✅ Audio relay is bidirectional
   - ✅ Voice output works

### ❌ **FAILURE** looks like:

- Call connects but silence
- WebSocket errors in logs
- OpenAI authentication errors
- No audio streaming

If you see failures, paste the terminal logs and we'll debug!

---

## Next Steps (If Spike Works)

### Tomorrow we'll build the full version with:

1. **Supabase Tools** (~1 hour)
   - `get_lead_context` - Query lead by phone
   - `book_appointment` - Save appointment to DB
   - `save_interaction` - Log call details
   - `check_consent_dnc` - Verify calling permissions
   - `update_lead_info` - Update lead data

2. **Outbound Calls** (~30 min)
   - `/start-call` endpoint for n8n
   - SignalWire REST API integration
   - Per-call context injection

3. **Production Hardening** (~1 hour)
   - Error handling & retry logic
   - Session management & cleanup
   - Health checks & monitoring
   - Structured logging (Pino)
   - Dockerfile for Northflank

4. **Full Deployment** (~30 min)
   - Deploy to Northflank
   - Update n8n workflows
   - Point SignalWire numbers
   - Validate with test calls

**Total time: ~3 hours** (vs. 2 weeks debugging Vapi issues)

---

## Cost During Testing

**This spike costs:**
- OpenAI Realtime: ~$0.06/minute of audio
- SignalWire: ~$0.01/minute PSTN

**Per test call (5 min):** ~$0.35

**Budget:** $10 should cover 25+ test calls

---

## Questions?

- Check terminal logs first
- Verify `.env` has your OpenAI key
- Confirm ngrok is exposing port 8080
- Check SignalWire Voice URL is correct

**If it works tonight**, we know the approach is viable and can build the full version tomorrow with confidence! 🚀

