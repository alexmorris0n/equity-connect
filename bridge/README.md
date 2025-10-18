# OpenAI Realtime Voice Bridge

Production-ready WebSocket bridge connecting SignalWire PSTN calls to OpenAI Realtime API with Supabase integration.

## Features

✅ **Inbound PSTN calls** - SignalWire → OpenAI Realtime  
✅ **Outbound calls** - n8n → Bridge → SignalWire → OpenAI  
✅ **Bidirectional audio** - PCM16 @ 16kHz streaming  
✅ **Supabase tools** - Lead lookup, appointments, consent checks  
✅ **Barbara AI assistant** - Realtime-optimized prompt  
✅ **Production-ready** - Docker, health checks, monitoring  

---

## Architecture

```
Inbound Flow:
Caller → SignalWire Number → LaML XML → <Connect><Stream wss://bridge/audiostream>
                                              ↕ PCM16 Audio
                                         Audio Bridge (Node.js)
                                              ↕
                                         OpenAI Realtime API
                                              ↕ Tool Calls
                                         Supabase (leads, appointments)

Outbound Flow:
n8n → POST /start-call → SignalWire REST → Dials lead → LaML → Same stream path
```

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp env.template .env
```

Edit `.env` and add your credentials:

```bash
OPENAI_API_KEY=sk-proj-xxxxx
SW_PROJECT=your_project_id
SW_TOKEN=your_auth_token
SW_SPACE=your_space.signalwire.com
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...
BRIDGE_URL=http://localhost:8080
```

### 3. Run Locally

```bash
npm start
```

Server starts on `http://localhost:8080`

### 4. Expose with ngrok (for testing)

```bash
ngrok http 8080
```

Get your public URL: `https://abc123.ngrok-free.app`

### 5. Configure SignalWire

Point your SignalWire phone number Voice URL to:

```
https://abc123.ngrok-free.app/public/inbound-xml
```

Method: `GET`

### 6. Test!

Call your SignalWire number → Barbara answers!

---

## Deployment to Northflank

### 1. Create New Service

- Go to Northflank dashboard
- Create new service → Combined (build + runtime)
- Connect to your GitHub repo
- Select `equity-connect` directory

### 2. Configure Build

- **Dockerfile path**: `Dockerfile`
- **Build context**: `.` (root)

### 3. Set Environment Variables

In Northflank service settings → Environment:

```
OPENAI_API_KEY=sk-proj-xxxxx
SW_PROJECT=your_project
SW_TOKEN=your_token
SW_SPACE=your_space.signalwire.com
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...
NODE_ENV=production
PORT=8080
BRIDGE_URL=https://your-service-abc123.northflank.app
```

**Note:** `BRIDGE_URL` is your Northflank service public URL (get this after first deploy)

### 4. Deploy

- Click "Deploy"
- Wait for build (~2-3 min)
- Get your public URL from Northflank

### 5. Update SignalWire

Point SignalWire Voice URL to:

```
https://your-service-abc123.northflank.app/public/inbound-xml
```

### 6. Test Production

Call your SignalWire number → Production bridge handles it!

---

## API Endpoints

### `GET /healthz`

Health check endpoint (for Northflank monitoring)

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-18T...",
  "uptime": 12345,
  "activeCalls": 2,
  "memory": {...}
}
```

### `GET /public/inbound-xml`

LaML XML for inbound calls (SignalWire webhook)

**Returns:** XML with `<Connect><Stream>` directive

### `GET /public/outbound-xml`

LaML XML for outbound calls (when lead answers)

**Returns:** XML with `<Connect><Stream>` directive

### `POST /start-call`

Place outbound call via n8n

**Request Body:**
```json
{
  "to": "+14155556565",
  "from": "+14155551234",
  "lead_id": "uuid-here",
  "broker_id": "uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "callSid": "CA1234...",
  "status": "queued"
}
```

### `ws://[host]/audiostream`

WebSocket endpoint for SignalWire `<Stream>` connections

Handles bidirectional audio + tool execution

---

## Supabase Tools

Barbara can call these tools during conversations:

### 1. `get_lead_context`

Query lead data by phone number

**Parameters:** `{ phone: "+14155556565" }`

**Returns:** Lead info, broker details, formatted for voice

### 2. `check_consent_dnc`

Verify lead has consent and not on DNC

**Parameters:** `{ lead_id: "uuid" }`

**Returns:** `{ can_call: true/false, has_consent: bool, is_dnc: bool }`

### 3. `update_lead_info`

Update lead data collected during call

**Parameters:** `{ lead_id, last_name, property_value, age, ... }`

**Returns:** `{ success: true, updated_fields: [...] }`

### 4. `book_appointment`

Schedule appointment with broker

**Parameters:** `{ lead_id, broker_id, scheduled_for: ISO8601, notes }`

**Returns:** `{ success: true, appointment_id }`

Creates interaction, updates lead status, creates billing event

### 5. `save_interaction`

Log call details at end

**Parameters:** `{ lead_id, broker_id, duration_seconds, outcome, content }`

**Returns:** `{ success: true, interaction_id }`

---

## Number Formatting

All numbers converted to words to prevent TTS pitch issues:

- `750000` → "seven hundred fifty thousand"
- `1500000` → "one point five million"
- `50%` → "fifty percent"
- `+14155556565` → "four one five, five five five, six five six five"

See `bridge/utils/number-formatter.js`

---

## File Structure

```
equity-connect/
├── bridge/
│   ├── server.js              # Main Fastify server
│   ├── audio-bridge.js        # WebSocket handler
│   ├── tools.js               # Supabase tool definitions
│   ├── signalwire-client.js   # REST API wrapper
│   ├── spike.js               # Test spike (legacy)
│   └── utils/
│       └── number-formatter.js
├── prompts/
│   └── BarbaraVapiPrompt_V2_Realtime_Optimized
├── package.json
├── Dockerfile
├── .dockerignore
└── env.template
```

---

## Monitoring & Debugging

### Check Health

```bash
curl https://your-bridge.northflank.app/healthz
```

### View Logs (Northflank)

Dashboard → Your Service → Logs tab

Look for:
- `🔌 WebSocket connected` - Call started
- `🤖 OpenAI Realtime connected` - AI ready
- `✅ OpenAI session configured` - Ready to talk
- `🔧 Tool called` - Barbara using tools
- `📞 Call ended` - Call completed

### Common Issues

**No audio on call:**
- Check OpenAI API key is valid
- Verify `BRIDGE_URL` is correct (https, not http)
- Check SignalWire Voice URL points to bridge

**Tools not working:**
- Verify `SUPABASE_SERVICE_KEY` (not anon key)
- Check Supabase tables exist (leads, brokers, interactions)
- Review tool execution logs

**Calls dropping:**
- Check Northflank service is running
- Verify WebSocket timeout settings
- Review memory usage (healthz endpoint)

---

## Testing

### Local Test (Spike)

```bash
npm run spike
```

Minimal test server without tools (proves audio works)

### Production Test

1. Point one SignalWire number to bridge
2. Call it from your phone
3. Barbara should greet you
4. Test conversation flow
5. Check Supabase for logged interactions

---

## n8n Integration

### Outbound Call Workflow

HTTP Request node:

```
POST https://your-bridge.northflank.app/start-call

Headers:
  Content-Type: application/json

Body:
{
  "to": "{{$json.phone}}",
  "from": "{{$json.assigned_number}}",
  "lead_id": "{{$json.id}}",
  "broker_id": "{{$json.broker_id}}"
}
```

Response includes `callSid` for tracking

---

## Cost Analysis

**Per-minute costs:**
- SignalWire PSTN: ~$0.01
- SignalWire streaming: ~$0.003
- OpenAI Realtime: ~$0.04

**Total: ~$0.053/min**

**7-minute call: ~$0.37**

Compare to Vapi: ~$0.70 (47% savings)

---

## Performance

**Recommended Northflank sizing:**
- 1 vCPU / 1-2 GB RAM
- Handles ~10-20 concurrent calls
- Auto-scale horizontally if needed

**Latency:**
- WebSocket setup: ~2 seconds
- Audio relay: <300ms
- Tool execution: ~500ms (Supabase queries)

---

## Security

✅ Service role key for Supabase (not anon key)  
✅ Environment variables (not hardcoded)  
✅ HTTPS/WSS only in production  
✅ Non-root Docker user  
✅ Health check exposed, no admin endpoints  

---

## Migration from Vapi

### Testing Phase

1. Deploy bridge to Northflank
2. Point ONE test SignalWire number to bridge
3. Keep other numbers on Vapi
4. Compare call quality side-by-side
5. Test all tools work (lead lookup, booking, etc.)

### Cutover

1. Update n8n workflows → use bridge `/start-call`
2. Point all SignalWire numbers → bridge inbound XML
3. Monitor first 50 calls closely
4. Disable Vapi after successful validation

---

## Support

**Logs:** Check Northflank service logs  
**Database:** Query Supabase `interactions` table  
**Health:** `GET /healthz` endpoint  

---

## License

MIT - Part of Equity Connect platform

