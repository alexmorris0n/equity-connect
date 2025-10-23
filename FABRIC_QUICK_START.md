# Fabric Quick Start

Get Barbara running on SignalWire Fabric in 15 minutes.

## Prerequisites

- Node.js 18+
- SignalWire account with Project ID, Token, and Space
- OpenAI API key
- Deployed bridge URL (Northflank, Railway, etc.)

## Step 1: Install Dependencies (2 min)

```bash
npm install
```

## Step 2: Configure Environment (3 min)

Create or update `.env`:

```bash
# OpenAI
OPENAI_API_KEY=sk-...
REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17
REALTIME_VOICE=shimmer

# SignalWire
SW_PROJECT=your-project-id
SW_TOKEN=your-token
SW_SPACE=your-space.signalwire.com

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhb...

# Bridge
BRIDGE_URL=https://your-bridge.northflank.dev
SWAIG_PORT=8081
FABRIC_PORT=8080

# Optional
BRIDGE_API_KEY=your-secret-key
```

## Step 3: Local Testing (5 min)

**Terminal 1: Start SWAIG server**
```bash
npm run start:swaig
```

Expected output:
```
🚀 SWAIG HTTP Server Running
   Port: 8081
   Functions: 9 tools available
✅ Ready for SignalWire Fabric calls
```

**Terminal 2: Test endpoint**
```bash
curl -X POST http://localhost:8081/swaig \
  -H "Content-Type: application/json"
```

Should return JSON array with 9 functions.

**Terminal 3: Start Fabric bridge**
```bash
npm run start:fabric
```

Expected output:
```
🚀 SignalWire Fabric + OpenAI Realtime Bridge
✅ All services running!
📞 Ready to handle calls!
```

## Step 4: Deploy to Production (3 min)

### If using Northflank:

1. Push code to git
2. Northflank will auto-deploy
3. Update `.env` on Northflank with all variables
4. Set start command: `npm run start:fabric`
5. Expose ports: 8080, 8081

### If using Railway/Render/other:

```bash
# Build
npm install --production

# Start
npm run start:fabric
```

## Step 5: Configure Fabric Resource (2 min)

After deployment, run:

```bash
npm run setup:fabric
```

This will:
1. Test your SWAIG endpoint is accessible ✅
2. Create Fabric Resource in SignalWire ✅
3. Give you a Resource ID to add to `.env` ✅

Save the Resource ID:
```bash
FABRIC_RESOURCE_ID=xxx-xxx-xxx
```

## Step 6: Link Phone Numbers (1 min)

1. Go to SignalWire Dashboard → **Phone Numbers**
2. Click your number
3. Under "When a call comes in":
   - Select **"Fabric Resource"**
   - Choose **"Barbara AI Assistant"**
4. Save

## Step 7: Test! (1 min)

Call your number. You should hear:
- Ringback tone (~2 seconds)
- Barbara greeting
- Smooth conversation with tool calls working

Check logs:
```bash
# Local
Check terminal output

# Northflank
Go to Logs tab in dashboard
```

## Verification Checklist

- [ ] SWAIG server responds to `POST /swaig`
- [ ] Fabric bridge shows "Ready to handle calls"
- [ ] Phone number linked to Fabric Resource
- [ ] Test call connects and Barbara speaks
- [ ] Tools execute (check logs for "🔧 SWAIG: ...")
- [ ] Conversation transcript saves to Supabase
- [ ] MCP servers still work (test n8n workflow)

## Troubleshooting

### "SWAIG endpoint not accessible"

```bash
# Check BRIDGE_URL is correct
echo $BRIDGE_URL

# Test locally
curl http://localhost:8081/healthz

# Test production
curl https://your-bridge.northflank.dev:8081/healthz
```

### "No audio on call"

Check logs for:
- `✅ OpenAI Realtime connected`
- `✅ Session fully configured`
- `🔵 Sending greeting trigger`

If missing, check `OPENAI_API_KEY` is valid.

### "Tools not executing"

Check SWAIG logs for tool calls:
```bash
grep "SWAIG:" logs
```

Should see:
```
🔧 SWAIG: get_lead_context
🔧 SWAIG: check_broker_availability
🔧 SWAIG: book_appointment
```

### "MCP workflows broken"

MCP servers are separate - they shouldn't be affected.

Check they're running:
```bash
docker ps | grep mcp
curl http://localhost:3000/healthz  # barbara-mcp
```

## What's Next?

### Monitor Performance
- Check call quality for 1 week
- Compare to old WebSocket bridge
- Monitor Supabase interaction logs

### Gradual Rollout
1. Test with 1 phone number
2. If stable, add 5 more numbers
3. After 1 week, migrate all numbers

### Optional Enhancements
- Add 11Labs + Deepgram stack (backup AI)
- Add custom SWAIG auth
- Set up call recording webhook
- Configure real-time monitoring

## Getting Help

**Check logs:**
```bash
# Local
tail -f logs/*.log

# Northflank
Logs tab in dashboard
```

**Common log patterns:**
- `✅` = Success
- `❌` = Error
- `🔧` = Tool call
- `🤖` = OpenAI event
- `📞` = Call event

**Need support?**
- Review `FABRIC_MIGRATION_GUIDE.md`
- Check SignalWire dashboard for call logs
- Test SWAIG endpoint directly
- Verify environment variables

## Success Criteria

You're done when:
- ✅ Test call completes successfully
- ✅ Barbara responds naturally
- ✅ Tools execute (visible in logs)
- ✅ Transcript saves to Supabase
- ✅ MCP workflows still work in n8n
- ✅ No error messages in logs

**Total time: ~15 minutes** (plus testing)

Congratulations! Barbara is now running on production-grade SignalWire Fabric! 🎉

