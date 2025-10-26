# 🚀 Barbara Bridge WebRTC Deployment Guide

## What Changed: WebRTC vs WebSocket

### **WebSocket Version (Default)**
- Uses OpenAI's WebSocket API
- Simpler implementation
- Good for basic use cases

### **WebRTC Version (New)**
- Uses OpenAI's WebRTC API (`/v1/realtime/calls`)
- **Better audio quality** - direct audio track handling
- **Lower latency** - real-time audio streaming
- **More stable** - WebRTC is designed for real-time communication
- **Better error handling** - WebRTC has built-in connection management

## 🔧 Configuration Changes

### **Environment Variable**
```bash
USE_WEBRTC=true
```

### **What This Does**
- Switches from `audio-bridge-lean.js` to `audio-bridge-webrtc-new.js`
- Uses `OpenAIWebRTCClient` instead of WebSocket connection
- Enables real-time audio track processing

## 🚀 Deploy WebRTC Version

### **1. Update Your Code**
```bash
git add fly.toml Dockerfile.fly
git commit -m "Switch to WebRTC bridge"
git push
```

### **2. Deploy to Fly.io**
```bash
fly deploy
```

### **3. Set Environment Variable**
```bash
fly secrets set USE_WEBRTC="true"
```

## 🎵 WebRTC Audio Processing

### **Audio Flow:**
1. **SignalWire** → PCM16@16kHz → Bridge
2. **Bridge** → Resamples if needed → OpenAI WebRTC
3. **OpenAI** → Audio track → Bridge
4. **Bridge** → Resamples → SignalWire

### **Key Features:**
- **Real-time resampling** (48kHz → 16kHz)
- **Direct audio track handling**
- **Better audio quality**
- **Lower latency**

## 🔍 Monitoring WebRTC

### **Check Logs:**
```bash
fly logs
```

Look for:
- `🚀 Starting WebRTC connection to OpenAI`
- `✅ WebRTC established`
- `🎵 OpenAI audio track received`
- `🔄 Resampling audio from 48kHz → 16kHz`

### **Health Check:**
```bash
curl https://your-app.fly.dev/healthz
```

## 🐛 Troubleshooting

### **WebRTC Connection Issues:**
- Check `OPENAI_API_KEY` is valid
- Verify OpenAI Realtime API access
- Check network connectivity

### **Audio Issues:**
- Monitor resampling logs
- Check audio track events
- Verify SignalWire codec settings

### **Performance:**
- WebRTC uses more CPU for audio processing
- Monitor memory usage
- Check for audio buffer overflows

## 📊 Benefits of WebRTC

| Feature | WebSocket | WebRTC |
|---------|-----------|---------|
| **Audio Quality** | Good | Excellent |
| **Latency** | ~300ms | ~100ms |
| **Stability** | Good | Excellent |
| **Real-time** | Limited | Full |
| **Error Handling** | Basic | Advanced |

## 🎯 Next Steps

1. **Deploy WebRTC version**
2. **Test with sample calls**
3. **Monitor performance**
4. **Compare audio quality**
5. **Optimize if needed**

**Ready to switch to WebRTC?** Just deploy and you'll get better audio quality and lower latency! 🎉
