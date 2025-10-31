# ✨ Service Dependencies Monitoring - OpenAI, Gemini & SignalWire

## 🎉 What's New

Your System Metrics dashboard now monitors **all critical third-party service dependencies**:

### 🤖 OpenAI Status Monitoring
- **Real-time platform health** from status.openai.com
- **Realtime API** - Specially highlighted as "Critical" (powers your voice calls!)
- **Chat API** - Used in n8n workflows
- **No API token required** - Uses public status page

### 🌟 Google Gemini Monitoring
- **Gemini API status** from Google Cloud
- **Active incident tracking** - Know when there are issues
- **Severity levels** - High/medium/low classification
- **Incident descriptions** - What's actually happening
- **No API token required** - Uses public status page

### 📞 SignalWire Monitoring (NEW!)
- **Platform status** from status.signalwire.com
- **Voice/Calling services** - Critical for phone calls!
- **Media streaming** - WebSocket/stream status
- **API status** - SignalWire API health
- **No API token required** - Uses public status page

## 🎯 Why This Matters

### For Barbara Voice Calls
Your voice assistant depends on **TWO critical services**:

**OpenAI Realtime API** (AI Processing):
- 🚨 See OpenAI outages immediately
- 🔴 Realtime API shows operational status
- ⚠️ Know if AI is the problem

**SignalWire** (Phone Infrastructure):
- 📞 Voice/Calling services for PSTN
- 🌊 Media streaming for audio
- 🔌 API connectivity status
- 🚨 Know if phone calls are failing due to SignalWire

### For n8n Workflows
Your workflows use both OpenAI and Gemini:
- 📊 See if AI services are causing workflow issues
- 🔍 Troubleshoot faster when things go wrong
- ✅ Verify services before deploying changes

### Complete Call Stack Visibility
Now you can identify exactly where problems are:
1. **SignalWire down** → Phone calls can't connect
2. **OpenAI Realtime down** → Calls connect but no AI
3. **Both operational** → Issue is in your code

## 📸 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Overall System Status                                       │
│  (Shows if dependencies have issues)                         │
└─────────────────────────────────────────────────────────────┘

┌────────────────── Service Dependencies ─────────────────────┐
│                                                              │
│  ┌───── OpenAI ─────┐  ┌─── Gemini ───┐  ┌─ SignalWire ──┐│
│  │ ✨ Platform      │  │ ✨ Gemini API │  │ 📞 Platform   ││
│  │    [Operational] │  │  [Operational]│  │  [Operational]││
│  │                  │  │               │  │               ││
│  │ ⚡ Realtime API  │  │ (Incidents if │  │ 📞 Voice      ││
│  │    [Critical]    │  │  any)         │  │    [Critical] ││
│  │    [Operational] │  │               │  │               ││
│  │                  │  │               │  │ 🌊 Streaming  ││
│  │ 💬 Chat API      │  │               │  │               ││
│  │    [Operational] │  │               │  │ 🔌 API        ││
│  └──────────────────┘  └───────────────┘  └───────────────┘│
└─────────────────────────────────────────────────────────────┘

┌───────────────────── Your Infrastructure ───────────────────┐
│  (Fly.io and Northflank - same as before)                   │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 How It Works

### OpenAI Monitoring
1. **Fetches** from `https://status.openai.com/api/v2/status.json`
2. **Parses** component statuses (Realtime API, Chat API, etc.)
3. **Displays** operational status with color coding:
   - 🟢 Green = Operational
   - 🔴 Red = Degraded/Issues

### Gemini Monitoring
1. **Fetches** from `https://status.cloud.google.com/incidents.json`
2. **Filters** for AI/Gemini related incidents
3. **Shows** active incidents with severity
4. **Displays** incident count and descriptions

### SignalWire Monitoring
1. **Fetches** from `https://status.signalwire.com/api/v2/status.json`
2. **Parses** component statuses (Voice, Streaming, API)
3. **Highlights** Voice services as "Critical" (phone calls!)
4. **Displays** operational status with color coding:
   - 🟢 Green = Operational
   - 🔴 Red = Degraded/Issues

## 🎨 Visual Features

### Critical Service Highlighting
**Two services** are marked as "Critical" for voice calls:

**OpenAI Realtime API**:
- 🏷️ **"Critical" badge** (blue) - AI processing
- ⚡ **Sparkles icon** - Easy to spot
- 🔴 **Red border** if down - Impossible to miss

**SignalWire Voice/Calling**:
- 🏷️ **"Critical" badge** (red) - Phone infrastructure
- 📞 **Phone icon** - Clearly indicates telephony
- 🔴 **Red border** if down - Critical alert

### Incident Alerts
When Gemini has issues:
- ⚠️ **Warning icons** on incidents
- 📝 **Incident descriptions** shown
- 🎯 **Severity badges** (high/medium/low)
- 🔗 **Link to status page** for details

## 📊 API Response Examples

### OpenAI - All Good
```json
{
  "dependencies": {
    "openai": {
      "available": true,
      "overallStatus": "operational",
      "services": [
        {
          "name": "OpenAI Platform",
          "status": "none",
          "operational": true,
          "statusPage": "https://status.openai.com"
        },
        {
          "name": "Realtime API",
          "status": "operational",
          "operational": true
        }
      ]
    }
  }
}
```

### Gemini - Has Incident
```json
{
  "dependencies": {
    "gemini": {
      "available": true,
      "overallStatus": "degraded",
      "activeIncidents": 1,
      "services": [
        {
          "name": "Gemini API",
          "status": "degraded",
          "operational": false,
          "activeIncidents": 1
        },
        {
          "name": "Vertex AI",
          "status": "incident",
          "description": "Elevated error rates",
          "severity": "medium"
        }
      ]
    }
  }
}
```

## ✅ What You Get

### Immediate Benefits
1. **Proactive Awareness**: Know about AI outages before users report them
2. **Faster Troubleshooting**: Distinguish between your issues and vendor issues
3. **Peace of Mind**: See that critical services are running
4. **No Setup**: Works immediately - no API tokens needed

### Long-term Benefits
1. **Service Reliability Tracking**: See how often OpenAI/Gemini have issues
2. **Incident History**: Track when problems occurred
3. **Deployment Decisions**: Check service health before deploying
4. **SLA Awareness**: Know if vendors meet their uptime promises

## 🔍 Usage Examples

### Scenario 1: Voice Calls Failing
**Before**: "Why aren't calls working? Is it our code?"
**Now**: 
1. Check dashboard
2. See: 🔴 Realtime API - Degraded
3. Know: OpenAI outage, not our fault
4. Action: Wait for OpenAI to fix it

### Scenario 2: n8n Workflow Errors
**Before**: "Gemini API throwing errors, check the code?"
**Now**:
1. Check dashboard
2. See: ⚠️ Gemini - 2 active incidents
3. Know: Google having issues
4. Action: Wait or switch to fallback

### Scenario 3: Pre-deployment Check
**Before**: Deploy and hope for the best
**Now**:
1. Check dashboard
2. See: ✅ All AI services operational
3. Know: Good time to deploy
4. Action: Deploy with confidence

## 🎯 Key Features

### Auto-Refresh
- ✅ Updates every 30 seconds
- ✅ No page reload needed
- ✅ Toggle on/off as needed

### Status Links
- 🔗 Click to visit official status pages
- 🔗 Get detailed incident information
- 🔗 See historical data

### Color Coding
- 🟢 **Green**: Everything operational
- 🟡 **Yellow**: Degraded performance
- 🔴 **Red**: Service down / Major incident

## 📝 Technical Details

### Backend (`bridge/api/system-metrics.js`)
```javascript
// New functions added:
- getOpenAIStatus()  // Fetches OpenAI component statuses
- getGeminiStatus()  // Fetches Google Cloud incidents
```

### Frontend (`portal/src/views/admin/SystemAnalytics.vue`)
```vue
<!-- New sections added: -->
- AI Service Dependencies grid
- OpenAI Services card
- Google Gemini card
- Critical service highlighting
- Incident display
```

### Data Flow
```
Dashboard -> Bridge API -> Public Status APIs -> Dashboard
  (30s)       /api/system-metrics    (OpenAI/Google)    (Display)
```

## 🆚 Comparison

### Infrastructure Monitoring
- **Requires**: API tokens (Fly.io, Northflank)
- **Monitors**: Your deployments
- **Control**: You can fix issues
- **Setup**: Manual configuration

### AI Services Monitoring
- **Requires**: Nothing! ✨
- **Monitors**: Third-party dependencies
- **Control**: Wait for vendor to fix
- **Setup**: Automatic - works immediately

## 💡 Pro Tips

1. **Check Before Calling Support**: See if it's an OpenAI/Gemini outage first
2. **Monitor During Peak Hours**: Watch for degraded performance
3. **Screenshot Incidents**: Document vendor outages for records
4. **Set Expectations**: Tell users if AI services are having issues

## 🎊 Bottom Line

You now have **complete visibility** into all your service dependencies:

### Critical for Voice Calls
✅ **SignalWire Voice** - Phone infrastructure (PSTN)  
✅ **SignalWire Streaming** - Audio/media transport  
✅ **OpenAI Realtime API** - AI voice processing  

### AI & Workflows
✅ **OpenAI Chat API** - Used in n8n workflows  
✅ **Google Gemini** - AI processing  

### System Features
✅ **Real-time Updates** - Auto-refresh every 30s  
✅ **Zero Configuration** - Works immediately  
✅ **No Cost** - Uses public status APIs  
✅ **Complete Call Stack** - See entire dependency chain  

**Your dashboard now monitors the ENTIRE voice call stack!** 🚀📞

---

Check it out: Login → Admin Portal → System Analytics 🎯

