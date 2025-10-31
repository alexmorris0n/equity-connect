# System Metrics Monitoring Service

Independent monitoring service deployed on Vercel for tracking system health across multiple platforms.

## What It Monitors

- **Fly.io**: `barbara-v3-voice` app status
- **Northflank**: Services in your `n8n-with-worker` project
- **OpenAI**: Realtime API + Chat API status
- **Google Gemini**: AI service status + incidents
- **SignalWire**: Voice/Messaging/AI services via RSS feed

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variables in Vercel:**
   - `FLY_API_TOKEN` - Your Fly.io API token
   - `NORTHFLANK_API_TOKEN` - Your Northflank API token
   - `NORTHFLANK_PROJECT_ID` - Your Northflank project ID (e.g., `n8n-with-worker`)

3. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

## API Endpoint

- **GET** `/api/system-metrics`
- **CORS**: Enabled for all origins
- **Response**: JSON with system metrics

## Response Format

```json
{
  "success": true,
  "metrics": {
    "overall": {
      "status": "healthy",
      "healthPercentage": 100,
      "totalServices": 5,
      "healthyServices": 5,
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
    "timestamp": "2025-10-31T..."
  }
}
```

## Development

```bash
# Local development
npm run dev

# Build TypeScript
npm run build
```

## Deployment

The service is designed to run independently on Vercel, separate from your main application infrastructure.

