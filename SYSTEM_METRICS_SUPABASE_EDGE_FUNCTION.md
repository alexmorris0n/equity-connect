# System Metrics - Supabase Edge Function Deployment

## ✅ Completed

### 1. **Deployed to Supabase Edge Functions**
The system monitoring service has been successfully deployed as a Supabase Edge Function instead of Vercel.

- **Function Name**: `system-metrics`
- **Endpoint**: `https://mxnqfwuhvurajrgoefyg.supabase.co/functions/v1/system-metrics`
- **Status**: ACTIVE (Version 2)
- **Runtime**: Deno (Edge Runtime)

### 2. **Removed Vercel Monitoring Directory**
The temporary `monitoring/` directory created for Vercel has been removed.

### 3. **Updated Portal**
The `SystemAnalytics.vue` component now points to the Supabase Edge Function:
- Default URL: `https://mxnqfwuhvurajrgoefyg.supabase.co/functions/v1/system-metrics`
- Can be overridden with `VITE_METRICS_URL` in `.env.local` if needed

### 4. **Removed from barbara-v3**
All monitoring code has been removed from the barbara-v3 bridge to reduce load.

## 📋 What the Edge Function Monitors

### Infrastructure:
- **Fly.io**: barbara-v3-voice app status, machine health, deployment info
- **Northflank**: n8n services, runtime status, health checks, replica counts

### AI Service Dependencies:
- **OpenAI**: Platform status, Realtime API, Chat API
- **Google Gemini**: Gemini API, active incidents
- **SignalWire**: Voice/Calling, Messaging/SMS, AI Services, API/Dashboard

## 🔐 Required Environment Variables (Supabase Secrets)

You need to set these secrets in your Supabase project:

```bash
# Fly.io API Token
FLY_API_TOKEN=your_fly_token_here

# Northflank credentials
NORTHFLANK_API_TOKEN=your_northflank_token_here
NORTHFLANK_PROJECT_ID=n8n-with-worker
```

## 🚀 Setting Supabase Secrets

You can set these via the Supabase Dashboard or using the Supabase CLI:

```bash
# Using Supabase CLI
supabase secrets set FLY_API_TOKEN=your_token_here
supabase secrets set NORTHFLANK_API_TOKEN=your_token_here
supabase secrets set NORTHFLANK_PROJECT_ID=n8n-with-worker
```

Or via Supabase Dashboard:
1. Go to https://supabase.com/dashboard/project/mxnqfwuhvurajrgoefyg/settings/functions
2. Navigate to Edge Functions → system-metrics → Secrets
3. Add the environment variables

## 📊 API Response Format

```json
{
  "success": true,
  "metrics": {
    "overall": {
      "status": "healthy",
      "healthPercentage": 100,
      "totalServices": 2,
      "healthyServices": 2,
      "unhealthyServices": 0,
      "thirdPartyIssues": []
    },
    "infrastructure": {
      "flyio": { ... },
      "northflank": { ... }
    },
    "dependencies": {
      "openai": { ... },
      "gemini": { ... },
      "signalwire": { ... }
    },
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```

## 🔄 Next Steps

1. Set the environment variables in Supabase (see above)
2. Test the endpoint in your browser or with curl:
   ```bash
   curl https://mxnqfwuhvurajrgoefyg.supabase.co/functions/v1/system-metrics
   ```
3. Verify the portal dashboard displays correctly
4. Commit the changes to git

## 📝 Git Changes to Commit

- **Modified**: `portal/src/views/admin/SystemAnalytics.vue` (updated to use Supabase endpoint)
- **Added**: `supabase/functions/system-metrics/` (new Edge Function)
- **Deleted**: `monitoring/` (Vercel version removed)

## 🎯 Benefits of Supabase Edge Functions

1. **Integrated**: Part of your existing Supabase infrastructure
2. **Fast**: Runs on Deno Deploy global edge network
3. **Secure**: Secrets management built-in
4. **No Extra Cost**: Included in your Supabase plan
5. **Easy Management**: Deploy via CLI or API
6. **Auto-scaling**: Handles traffic automatically
7. **CORS Enabled**: Pre-configured for cross-origin requests

## 🔧 Troubleshooting

If you get errors:
1. Check that environment variables are set in Supabase
2. Verify the Edge Function is deployed and active
3. Check browser console for CORS or network errors
4. Test the endpoint directly with curl to see raw response

