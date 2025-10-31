# System Metrics Dashboard Setup Guide

Your System Analytics dashboard is now ready! This guide will help you set it up to monitor your Fly.io and Northflank deployments.

## 🎯 What's Been Added

1. **Backend API Endpoint**: `/api/system-metrics` in your bridge server
2. **Vue Dashboard**: Beautiful system analytics view in the admin portal
3. **Real-time Monitoring**: Auto-refresh every 30 seconds (toggleable)

## 📊 Features

- **Overall System Health**: Visual status indicator showing health percentage
- **AI Service Dependencies**: Monitor critical third-party AI services
  - **OpenAI Services**: Platform status + Realtime API monitoring
  - **Gemini API**: Google's AI service status and incident tracking
- **Your Infrastructure**:
  - **Fly.io Monitoring**: Track both your apps (`barbara-voice-bridge`, `barbara-v3-voice`)
  - **Northflank Monitoring**: Monitor all your Northflank services
- **Service Details**: Region, version, deployment time, health status
- **Auto-refresh**: Configurable automatic updates
- **No API tokens needed** for OpenAI and Gemini (public status pages)

## 🔧 Setup Instructions

### 1. Install Dependencies

First, install the new `axios` dependency:

```bash
npm install
```

### 2. Get API Tokens (Optional for Infrastructure Monitoring)

> **Note**: OpenAI and Gemini status monitoring works automatically - no API tokens needed! 
> These use public status pages and will show up immediately.

#### Fly.io API Token

1. Visit https://fly.io/dashboard
2. Go to **Account Settings** → **Access Tokens**
3. Click **Create Access Token**
4. Give it a name like "System Metrics Monitor"
5. Copy the token (you'll only see it once!)

#### Northflank API Token (if using Northflank)

1. Visit https://app.northflank.com
2. Go to **Settings** → **API Tokens**
3. Click **Create Token**
4. Give it a name like "System Metrics"
5. Copy the token
6. Also note your **Project ID** from your project's URL

### 3. Add Environment Variables

Add these to your `.env` file (or environment variables):

```bash
# Fly.io Monitoring
FLY_API_TOKEN=your_flyio_api_token_here

# Northflank Monitoring (optional)
NORTHFLANK_API_TOKEN=your_northflank_token_here
NORTHFLANK_PROJECT_ID=your_project_id_here
```

### 4. Portal Configuration

In your portal's `.env` file (or `.env.local`), add:

```bash
VITE_BRIDGE_URL=http://localhost:8080
# Or in production:
# VITE_BRIDGE_URL=https://your-bridge-url.fly.dev
```

### 5. Restart Your Services

```bash
# Restart the bridge server
npm start

# In the portal directory
cd portal
npm run dev
```

## 📱 Accessing the Dashboard

1. Log in to your admin portal
2. Navigate to **System Analytics** in the sidebar
3. You should see your system status!

## 🎨 Dashboard Features

### Overall Health Card
- **Status Indicator**: Green (healthy), Yellow (degraded), Red (critical)
- **Health Percentage**: Visual progress bar
- **Service Counts**: Total, healthy, and unhealthy services

### Platform Cards

Each platform (Fly.io and Northflank) shows:
- Service name and status
- Hostname/URL (for Fly.io apps)
- Region
- Version number
- Last deployment time
- Health status

### Auto-refresh Toggle
- Turn on/off automatic updates
- Default: Refresh every 30 seconds
- Manual refresh button always available

## 🚨 Troubleshooting

### "Not Configured" Warning

If you see this, it means the API token isn't set. Check:
1. Environment variables are in the `.env` file
2. You restarted the server after adding them
3. The token is valid (not expired)

### API Errors

Check the browser console and server logs for details:
```bash
# Bridge server logs will show API errors
npm start
```

### CORS Issues

If the portal can't reach the bridge API, ensure:
1. `VITE_BRIDGE_URL` is set correctly in portal
2. The bridge server is running
3. CORS is enabled (already configured in server.js)

## 🔐 Security Notes

- **Never commit API tokens** to git
- Keep your `.env` file in `.gitignore`
- Use read-only tokens when possible
- Rotate tokens periodically

## 📈 What's Monitored

### AI Service Dependencies (Always Active - No Setup Required)

#### OpenAI
- **Overall Platform Status**: Real-time OpenAI service health
- **Realtime API**: Critical for voice calls - special monitoring
- **Chat API**: Used by n8n workflows
- Pulls from: https://status.openai.com

#### Google Gemini
- **Gemini API Status**: AI service health
- **Active Incidents**: Real-time incident tracking
- **Severity Levels**: High/medium/low incident classification
- Pulls from: https://status.cloud.google.com

### Your Infrastructure (Requires API Tokens)

#### Fly.io Apps
- **barbara-voice-bridge**: Your voice bridge server
- **barbara-v3-voice**: Your Barbara V3 assistant

#### Northflank Services
- All services in your project

### Metrics Tracked
- Deployment status
- Health checks
- Region/location
- Version numbers
- Last deployment time
- Hostname/URLs
- Incident tracking (AI services)

## 🎯 Next Steps

Once set up, you can:
1. Monitor deployment health in real-time
2. Get alerts when services go down
3. Track deployment frequency
4. Verify regional distribution

## 💡 Tips

- **Bookmark the page**: Quick access to system status
- **Use auto-refresh**: Keep it running during deployments
- **Check before deploying**: Verify current system health
- **Mobile-friendly**: Access from your phone

---

## Example .env File

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Supabase
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...

# SignalWire
SW_PROJECT=...
SW_TOKEN=...
SW_SPACE=...

# System Metrics
FLY_API_TOKEN=fo1_...
NORTHFLANK_API_TOKEN=nftk_...
NORTHFLANK_PROJECT_ID=your-project-id

# Bridge URL
BRIDGE_URL=https://barbara-voice-bridge.fly.dev
```

Enjoy your new system metrics dashboard! 🎉

