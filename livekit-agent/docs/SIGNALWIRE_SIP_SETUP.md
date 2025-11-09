# SignalWire SIP Integration with Self-Hosted LiveKit

This guide covers setting up SignalWire to route phone calls to your self-hosted LiveKit SIP bridge using SWML (SignalWire Markup Language).

## Architecture

```
PSTN Call → SignalWire → SWML Webhook → LiveKit SIP Bridge → LiveKit Core → Agent Workers
```

## Prerequisites

✅ Self-hosted LiveKit stack deployed on Fly.io  
✅ LiveKit SIP bridge running (`equity-livekit-sip.fly.dev`)  
✅ API server deployed (`equity-agent-api.fly.dev`)  
✅ SignalWire account with phone numbers  
✅ `livekit-cli` installed locally  

## Step 1: Create LiveKit SIP Trunk & Dispatch Rules

This configures LiveKit to accept calls from SignalWire.

### Run the setup script:

```bash
cd livekit-agent

# Set environment variables
export LIVEKIT_URL="wss://equity-livekit-core.fly.dev"
export LIVEKIT_API_KEY="lk_prod_9f2b74d1c3a84e06b1f5c932a7c4f5dd"
export LIVEKIT_API_SECRET="b8f3c1a7d2e94f0c8b6a3d5e7c2f9140a3b5c7d9e1f2a4b6c8d0e2f3a5b7c9d1"

# Run setup
chmod +x setup-sip-trunk.sh
./setup-sip-trunk.sh
```

This creates:
- **SIP Trunk**: Accepts inbound calls from SignalWire
- **Dispatch Rule**: Routes calls to LiveKit rooms based on caller number

### Manual creation (if script fails):

<details>
<summary>Click to expand manual steps</summary>

**Create trunk config (`trunk.json`):**
```json
{
  "inbound_addresses": [],
  "inbound_numbers_regex": ".*",
  "name": "signalwire-trunk"
}
```

**Create trunk:**
```bash
livekit-cli create-sip-trunk \
  --url wss://equity-livekit-core.fly.dev \
  --api-key lk_prod_9f2b74d1c3a84e06b1f5c932a7c4f5dd \
  --api-secret b8f3c1a7d2e94f0c8b6a3d5e7c2f9140a3b5c7d9e1f2a4b6c8d0e2f3a5b7c9d1 \
  --request trunk.json
```

**Create dispatch rule (`dispatch.json`):**
```json
{
  "rule": {
    "dispatchRuleDirect": {
      "roomName": "inbound-{{ .CallerNumber }}",
      "pin": ""
    }
  },
  "trunk_ids": ["<TRUNK_ID_FROM_ABOVE>"],
  "hide_phone_number": false,
  "name": "signalwire-inbound-dispatch"
}
```

**Create dispatch rule:**
```bash
livekit-cli create-sip-dispatch-rule \
  --url wss://equity-livekit-core.fly.dev \
  --api-key lk_prod_9f2b74d1c3a84e06b1f5c932a7c4f5dd \
  --api-secret b8f3c1a7d2e94f0c8b6a3d5e7c2f9140a3b5c7d9e1f2a4b6c8d0e2f3a5b7c9d1 \
  --request dispatch.json
```

</details>

## Step 2: Configure SignalWire Phone Numbers

### For Inbound Calls:

1. Log in to [SignalWire Dashboard](https://signalwire.com/)
2. Navigate to **Phone Numbers**
3. Select a phone number
4. Under **Voice & Fax** → **Handle calls using**, select **SWML**
5. Set the SWML Script URL to:
   ```
   https://equity-agent-api.fly.dev/api/swml-inbound?to={to}&from={from}
   ```
6. Set method to **GET**
7. Click **Save**

### What happens:
1. Call arrives at SignalWire number
2. SignalWire calls your SWML webhook (`/api/swml-inbound`)
3. Webhook returns SWML script with LiveKit SIP URI
4. SignalWire connects to `sip:{to}@equity-livekit-sip.fly.dev;transport=tcp`
5. LiveKit SIP bridge accepts the call
6. Dispatch rule routes to LiveKit room `inbound-{caller_number}`
7. Agent worker joins the room and handles the call

## Step 3: Test Inbound Call

Call your SignalWire number from any phone. You should see:

**In LiveKit Core logs:**
```
INFO livekit Room created: inbound-+15551234567
```

**In LiveKit SIP logs:**
```
INFO sip Incoming INVITE from SignalWire
INFO sip Call connected to LiveKit room
```

**In Agent Worker logs:**
```
INFO livekit-agent Room joined: inbound-+15551234567
INFO livekit-agent Starting voice agent for inbound call
```

## Step 4: Outbound Calls via n8n MCP

The `@barbara-mcp` server can trigger outbound calls:

### MCP Tool Call:
```typescript
{
  "to_phone": "+15551234567",
  "lead_id": "lead-uuid",
  "broker_id": "broker-uuid"
}
```

### What happens:
1. n8n calls `/api/outbound-call` endpoint
2. API creates outbound call via SignalWire
3. SignalWire calls SWML webhook (`/api/swml-outbound`)
4. Webhook returns SWML script
5. SignalWire connects to LiveKit SIP
6. Agent joins room and starts conversation

## Step 5: Monitor Calls

### Check LiveKit SIP status:
```bash
fly logs --app equity-livekit-sip
```

### Check Agent Worker status:
```bash
fly logs --app equity-agent
```

### Check API Server status:
```bash
fly logs --app equity-agent-api
```

### View active rooms:
```bash
livekit-cli list-rooms \
  --url wss://equity-livekit-core.fly.dev \
  --api-key lk_prod_9f2b74d1c3a84e06b1f5c932a7c4f5dd \
  --api-secret b8f3c1a7d2e94f0c8b6a3d5e7c2f9140a3b5c7d9e1f2a4b6c8d0e2f3a5b7c9d1
```

## Troubleshooting

### Call doesn't connect:

1. **Check SIP bridge is running:**
   ```bash
   fly status --app equity-livekit-sip
   ```

2. **Verify SIP ports are accessible:**
   ```bash
   nc -zv equity-livekit-sip.fly.dev 5060
   ```

3. **Check LiveKit Core logs for connection errors:**
   ```bash
   fly logs --app equity-livekit-core | grep -i error
   ```

### Agent doesn't join room:

1. **Verify agent workers are running:**
   ```bash
   fly status --app equity-agent
   ```

2. **Check agent registration:**
   ```bash
   fly logs --app equity-livekit-core | grep "worker registered"
   ```

3. **Verify room was created:**
   ```bash
   livekit-cli list-rooms --url wss://equity-livekit-core.fly.dev \
     --api-key lk_prod_9f2b74d1c3a84e06b1f5c932a7c4f5dd \
     --api-secret b8f3c1a7d2e94f0c8b6a3d5e7c2f9140a3b5c7d9e1f2a4b6c8d0e2f3a5b7c9d1
   ```

### SWML webhook returns error:

1. **Test webhook directly:**
   ```bash
   curl "https://equity-agent-api.fly.dev/api/swml-inbound?to=%2B15551234567&from=%2B15559876543"
   ```

2. **Check API server logs:**
   ```bash
   fly logs --app equity-agent-api
   ```

3. **Verify LIVEKIT_SIP_DOMAIN is set:**
   ```bash
   fly secrets list --app equity-agent-api
   ```

## Configuration Reference

### Environment Variables (API Server):

```bash
LIVEKIT_SIP_DOMAIN=equity-livekit-sip.fly.dev
SIGNALWIRE_PROJECT_ID=<your-project-id>
SIGNALWIRE_TOKEN=<your-token>
SIGNALWIRE_SPACE=<your-space>.signalwire.com
```

### SIP URIs:

**LiveKit SIP Bridge:**
- `sip:{phone}@equity-livekit-sip.fly.dev:5060;transport=tcp`
- `sip:{phone}@equity-livekit-sip.fly.dev:5060;transport=udp`

**RTP (Media) Ports:**
- `60000-61000` (UDP)

## Next Steps

- ✅ SIP trunk and dispatch rules created
- ✅ SignalWire numbers configured
- ⏭️ Test inbound calls
- ⏭️ Test outbound calls via n8n
- ⏭️ Configure call recordings (MinIO → Supabase Storage)
- ⏭️ View call transcripts in admin portal

## Resources

- [LiveKit SIP Documentation](https://docs.livekit.io/sip/)
- [SignalWire SWML Documentation](https://developer.signalwire.com/sdks/reference/swml/)
- [SignalWire SIP Configuration](https://developer.signalwire.com/compatibility-api/guides/configuring-sip/)

