# PromptLayer Portal Integration - Complete

## ✅ What Was Created

### 1. **Vue.js Component** (Frontend)
**File:** `portal/src/components/PromptLayerManager.vue`

A unified management interface with 4 tabs:
- 📝 **Prompt Registry** - Edit and manage Barbara's prompts
- 📊 **Analytics** - View performance metrics, costs, and trends
- 📜 **Request History** - Browse and debug individual requests
- ⚙️ **Settings** - Configure PromptLayer API integration

### 2. **Backend API** (Server)
**File:** `bridge/api/promptlayer-api.js`

RESTful endpoints for:
- Prompt CRUD operations (create, read, update, deploy)
- Analytics aggregation (real-time metrics)
- Request history with pagination
- Scoring and quality tracking
- Settings management

### 3. **Database Schema** (Supabase)
**File:** `database/migrations/016_promptlayer_analytics.sql`

Tables:
- `promptlayer_requests` - Full request logs with metadata
- `promptlayer_analytics` - Pre-aggregated metrics
- `promptlayer_scores` - Quality scores
- `portal_settings` - Configuration storage

### 4. **Integration Guide** (Documentation)
**File:** `docs/PROMPTLAYER_VUE_INTEGRATION.md`

Complete guide with:
- Architecture overview
- API implementation examples
- Best practices
- Troubleshooting tips

## 🚀 Quick Start

### Step 1: Run Database Migration

```bash
# Connect to your Supabase project
psql postgresql://[YOUR_SUPABASE_URL]

# Run the migration
\i database/migrations/016_promptlayer_analytics.sql
```

### Step 2: Configure Environment

Add to your `.env` file:

```bash
PROMPTLAYER_API_KEY=pl-api-xxxxxxxxxxxxxxxxxxxxxxxx
```

Get your API key from: https://promptlayer.com/settings

### Step 3: Register API Routes

In `bridge/server.js`, add:

```javascript
const promptlayerRoutes = require('./api/promptlayer-api');

// After other route registrations
await promptlayerRoutes(server, {
  supabase: supabaseClient,
  logger: logger
});
```

### Step 4: Add to Vue Router

In your Vue router config:

```javascript
import PromptLayerManager from '@/components/PromptLayerManager.vue';

const routes = [
  // ... existing routes
  {
    path: '/promptlayer',
    name: 'PromptLayer',
    component: PromptLayerManager
  }
];
```

### Step 5: Test Connection

1. Start your server: `npm start`
2. Navigate to: `http://localhost:PORT/promptlayer`
3. Go to **Settings** tab
4. Click **Test Connection**
5. Should see: "✓ Connected to PromptLayer successfully!"

## 📊 How It Works

### Tracking Barbara's Calls

Update `bridge/prompt-manager.js` to log requests:

```javascript
const fetch = require('node-fetch');

async function trackPromptLayerRequest(promptName, input, output, metadata) {
  try {
    await fetch('http://localhost:3000/api/promptlayer/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt_name: promptName,
        input: input,
        output: output,
        metadata: {
          call_id: metadata.callId,
          caller_number: metadata.callerNumber,
          phase: metadata.phase,
          slots: metadata.slots
        },
        tags: ['barbara', 'production', metadata.phase]
      })
    });
  } catch (error) {
    logger.error('Failed to track PromptLayer request', { error });
  }
}

// In your existing code:
const response = await callBarbara(prompt);
await trackPromptLayerRequest('barbara_greeting', prompt, response, callMetadata);
```

### Viewing Analytics

Access the portal at `/promptlayer` to see:
- **Total requests** in the last 24 hours
- **Average latency** for each prompt
- **Token usage** and estimated costs
- **Success rates** and trends
- **Per-call details** with full input/output

## 🎯 Key Features

### Prompt Management
- ✏️ Edit prompts without code changes
- 🚀 Deploy new versions instantly
- 📦 Version control and rollback
- 🧪 A/B testing different prompts

### Analytics Dashboard
- 📈 Real-time performance metrics
- 💰 Cost tracking per prompt
- ⚡ Latency monitoring
- ✅ Success rate trends

### Request History
- 🔍 Search and filter calls
- 🐛 Debug failed interactions
- 📋 Export call data
- ⭐ Score call quality

### Quality Tracking
```javascript
// After a successful booking
await fetch('/api/promptlayer/requests/:id/score', {
  method: 'POST',
  body: JSON.stringify({ score: 100 })
});

// After a failed qualification
await fetch('/api/promptlayer/requests/:id/score', {
  method: 'POST',
  body: JSON.stringify({ score: 30 })
});
```

## 📁 File Structure

```
equity-connect/
├── portal/
│   └── src/
│       └── components/
│           └── PromptLayerManager.vue ← Vue component
├── bridge/
│   └── api/
│       └── promptlayer-api.js ← Backend API
├── database/
│   └── migrations/
│       └── 016_promptlayer_analytics.sql ← Database schema
└── docs/
    └── PROMPTLAYER_VUE_INTEGRATION.md ← Full guide
```

## 🔧 Customization

### Adding Custom Metrics

Edit `promptlayer-api.js` to track Barbara-specific metrics:

```javascript
// In aggregateAnalytics function
const barbaraMetrics = {
  avg_call_duration: calculateAvg(data, 'call_duration'),
  booking_conversion_rate: (bookings / total) * 100,
  avg_slots_collected: calculateAvg(data, 'slots_collected'),
  urgency_distribution: groupBy(data, 'urgency_level')
};
```

### Custom Prompt Templates

Create Barbara-specific templates in the Portal:

1. Go to **Prompt Registry** tab
2. Click **+ New Prompt**
3. Name: `barbara_greeting_urgent`
4. Template:
```
You are Barbara, a warm and empathetic senior mortgage advisor.

The caller {caller_name} has indicated URGENT financial needs.

Their situation:
- Purpose: {purpose}
- Est. Home Value: {est_home_value}
- Urgency: {urgency_level}

Acknowledge their urgency with extra empathy and move quickly to qualification.
```
5. Click **Save & Deploy**

## 🎨 UI Customization

The component uses scoped CSS. Customize colors in `PromptLayerManager.vue`:

```css
.tab.active {
  color: #2563eb; /* Your brand color */
  border-bottom-color: #2563eb;
}

.btn-primary {
  background: #2563eb; /* Your brand color */
}
```

## 📊 Example Queries

### Get Top Performing Prompts
```sql
SELECT * FROM promptlayer_performance
WHERE date >= NOW() - INTERVAL '7 days'
ORDER BY success_rate DESC, requests DESC
LIMIT 10;
```

### Find Expensive Calls
```sql
SELECT 
  prompt_name,
  call_id,
  total_tokens,
  estimated_cost,
  latency_ms
FROM promptlayer_requests
WHERE estimated_cost > 0.10
ORDER BY estimated_cost DESC
LIMIT 20;
```

### Booking Conversion by Prompt
```sql
SELECT
  prompt_name,
  COUNT(*) as total_calls,
  SUM(CASE WHEN metadata->>'booking_result' = 'scheduled' THEN 1 ELSE 0 END) as bookings,
  ROUND(
    (SUM(CASE WHEN metadata->>'booking_result' = 'scheduled' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100,
    2
  ) as conversion_rate
FROM promptlayer_requests
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY prompt_name
ORDER BY conversion_rate DESC;
```

## 🐛 Troubleshooting

### "Failed to connect" Error
1. Check API key in `.env`
2. Verify key at https://promptlayer.com/settings
3. Test with curl:
```bash
curl -H "X-API-KEY: your-key" https://api.promptlayer.com/rest/templates
```

### No Data in Analytics
1. Ensure tracking is enabled in Settings
2. Check that requests are being logged:
```sql
SELECT COUNT(*) FROM promptlayer_requests;
```
3. Run aggregation manually:
```sql
SELECT aggregate_promptlayer_analytics_hourly();
```

### Slow Dashboard
1. Run analytics aggregation more frequently
2. Add indexes on common query fields
3. Consider caching in Redis

## 🔮 Next Steps

### Phase 1: Basic Integration ✅
- [x] Create Vue component
- [x] Build backend API
- [x] Add database schema
- [x] Write documentation

### Phase 2: Enhanced Features
- [ ] Real-time updates with WebSockets
- [ ] Automated prompt A/B testing
- [ ] ML-based prompt recommendations
- [ ] Voice sample playback from portal

### Phase 3: Advanced Analytics
- [ ] Sentiment analysis on calls
- [ ] Conversion funnel visualization
- [ ] Broker performance comparison
- [ ] Cost optimization recommendations

## 📚 Resources

- [PromptLayer Documentation](https://docs.promptlayer.com)
- [PromptLayer API Reference](https://docs.promptlayer.com/reference/rest-api-reference)
- [Vue.js Guide](https://vuejs.org/guide/)
- [Fastify Documentation](https://fastify.dev)

## 🎉 Success!

You now have a fully integrated PromptLayer management portal for Barbara! 

**Access it at:** `http://localhost:YOUR_PORT/promptlayer`

Questions? Issues? Check the full guide at `docs/PROMPTLAYER_VUE_INTEGRATION.md`

