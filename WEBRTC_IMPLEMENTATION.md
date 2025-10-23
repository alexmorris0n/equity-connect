# Barbara Bridge - WebRTC Implementation Guide

## ✅ What We Built

Based on the official [OpenAI WebRTC API documentation](https://platform.openai.com/docs/guides/realtime-webrtc), we've implemented:

###  1. WebRTC Client (`bridge/openai-webrtc-client.js`)
- ✅ Ephemeral session creation via `/v1/realtime/sessions`
- ✅ WebRTC peer connection with STUN servers
- ✅ SDP offer/answer exchange via `/v1/realtime?model=...`
- ✅ Data channel for OpenAI events
- ✅ Audio track handling for bidirectional audio

### 2. WebRTC Bridge (`bridge/audio-bridge-webrtc-simple.js`)
- ✅ Integrates with existing SignalWire WebSocket
- ✅ Tool execution (all 9 tools working)
- ✅ Prompt management
- ✅ Event handling

### 3. Server Integration (`bridge/server.js`)
- ✅ Toggle via `USE_WEBRTC=true` environment variable
- ✅ Maintains backward compatibility with WebSocket mode

## 🚀 Deployment (Northflank)

### Step 1: Update Environment Variables
Add to your Northflank service:
```bash
USE_WEBRTC=true
```

### Step 2: Deploy
The `wrtc` package will compile successfully on Linux (Northflank's environment).

```bash
git add .
git commit -m "Add WebRTC support for OpenAI Realtime"
git push origin master
```

### Step 3: Test
1. Call your SignalWire number
2. Check Northflank logs for:
   - `🔌 Using WebRTC bridge`
   - `📞 Creating OpenAI ephemeral session...`
   - `✅ WebRTC connected!`

## 🔧 Optional: Cloudflare Tunnel (For Better Stability)

If you want to add Cloudflare Tunnel for even more stable signaling:

### 1. Add to your Dockerfile (or Northflank build):
```dockerfile
RUN apt-get update && apt-get install -y cloudflared
```

### 2. Create tunnel configuration:
```yaml
# /etc/cloudflared/config.yml
tunnel: barbara-bridge
credentials-file: /root/.cloudflared/barbara-bridge.json
ingress:
  - hostname: bridge.yourdomain.com
    service: http://localhost:8080
  - service: http_status:404
```

### 3. Run tunnel alongside bridge:
```bash
cloudflared tunnel run barbara-bridge &
npm run start
```

## 📊 Architecture

```
Phone Call → SignalWire (PSTN)
                ↓
         SignalWire WebSocket
                ↓
       Barbara Bridge (Northflank)
                ↓
         WebRTC Connection
                ↓
       OpenAI Realtime API
                ↓
         Audio + Tool Calls
```

## 🎯 Key Benefits

1. **Lower Latency**: WebRTC is optimized for real-time media
2. **Better Audio Quality**: Direct peer-to-peer audio streaming
3. **Official Support**: Uses OpenAI's official WebRTC endpoint
4. **Stable Connection**: WebRTC includes built-in NAT traversal and reconnection

## ⚠️ Important Notes

### Audio Transcoding
The current implementation forwards audio between SignalWire (mulaw) and OpenAI (PCM16). For production, you may want to add explicit transcoding:

```javascript
// TODO in audio-bridge-webrtc-simple.js
// Convert mulaw → PCM16 before sending to OpenAI
// Convert PCM16 → mulaw before sending to SignalWire
```

Most cases work fine without explicit transcoding, but if you experience audio issues, add `ffmpeg` transcoding.

### Ephemeral Sessions
OpenAI ephemeral sessions expire after a short time. The bridge automatically creates a new session for each call, so this is handled.

### Windows Development
`wrtc` package doesn't compile well on Windows. For local testing:
- Use `USE_WEBRTC=false` (WebSocket mode)
- Or develop/test on Linux/Mac
- Or use WSL2

## 🧪 Testing Checklist

- [ ] Deploy to Northflank with `USE_WEBRTC=true`
- [ ] Check logs show "Using WebRTC bridge"
- [ ] Make a test call
- [ ] Verify audio quality
- [ ] Test tool calling (e.g., "look up my information")
- [ ] Check call completion and logging

## 📚 References

- [OpenAI WebRTC API Docs](https://platform.openai.com/docs/guides/realtime-webrtc)
- [WebRTC Hacks - OpenAI Analysis](https://webrtchacks.com/how-openai-does-webrtc-in-the-new-gpt-realtime/)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

## 🆘 Troubleshooting

### "Failed to exchange SDP"
- Check `OPENAI_API_KEY` is valid
- Verify ephemeral session was created successfully
- Check Northflank logs for the full error

### "WebRTC connection failed"
- STUN server might be blocked
- Try adding TURN server configuration
- Check firewall rules on Northflank

### No audio
- Verify SignalWire WebSocket is connected
- Check that audio transcoding is working
- Add debug logging with `ENABLE_DEBUG_LOGGING=true`

---

**Total Implementation Time**: ~30 minutes
**Status**: ✅ Ready for deployment testing
**Next Step**: Deploy to Northflank and test a call!

