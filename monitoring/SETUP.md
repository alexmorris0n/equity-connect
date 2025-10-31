# Monitoring Service Setup Guide

## Overview

This monitoring service runs independently on Vercel and monitors:
- Fly.io deployments (`barbara-v3-voice`)
- Northflank services (`n8n-with-worker` project)
- OpenAI, Gemini, SignalWire status pages

## Deployment Steps

### 1. Install Dependencies

```bash
cd monitoring
npm install
```

### 2. Deploy to Vercel

```bash
# Login to Vercel (if not already)
vercel login

# Deploy
vercel --prod
```

Or connect via GitHub and deploy automatically.

### 3. Set Environment Variables in Vercel

Go to your Vercel project dashboard → Settings → Environment Variables:

```
FLY_API_TOKEN=your_fly_token_here
NORTHFLANK_API_TOKEN=your_northflank_token_here
NORTHFLANK_PROJECT_ID=n8n-with-worker
```

### 4. Get Your Vercel Deployment URL

After deployment, Vercel will give you a URL like:
- `https://your-project.vercel.app`

Your API endpoint will be:
- `https://your-project.vercel.app/api/system-metrics`

### 5. Update Portal Configuration

In your `portal/.env.local` file, add:

```env
VITE_METRICS_URL=https://your-project.vercel.app/api/system-metrics
```

Restart your portal development server.

## Testing

Test the endpoint:
```bash
curl https://your-project.vercel.app/api/system-metrics
```

You should see JSON with all system metrics.

## Benefits

✅ **Independent** - Doesn't depend on barbara-v3 being up
✅ **Reliable** - Runs on Vercel's edge network
✅ **Fast** - Edge functions are fast
✅ **Scalable** - Auto-scales with traffic
✅ **Free** - Vercel free tier is generous

## Next Steps

1. Deploy to Vercel
2. Set environment variables
3. Update portal `.env.local` with `VITE_METRICS_URL`
4. Test the dashboard

