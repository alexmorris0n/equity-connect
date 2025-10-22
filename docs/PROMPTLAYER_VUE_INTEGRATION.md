# PromptLayer Vue.js Portal Integration

This guide explains how to integrate PromptLayer's prompt management and analytics into your Vue.js portal.

## Overview

The `PromptLayerManager.vue` component provides a unified interface for:
- **Prompt Registry**: Create, edit, and deploy prompt templates
- **Analytics Dashboard**: View performance metrics and costs
- **Request History**: Browse and analyze individual AI requests
- **Settings**: Configure PromptLayer API integration

## Architecture

```
┌─────────────────────────────────────┐
│   Vue.js Portal (Frontend)          │
│   PortalLayerManager.vue             │
└──────────────┬──────────────────────┘
               │ HTTP/REST
               │
┌──────────────▼──────────────────────┐
│   Backend API Server                │
│   /api/promptlayer/*                │
└──────────────┬──────────────────────┘
               │
               │ REST API
               │
┌──────────────▼──────────────────────┐
│   PromptLayer API                   │
│   api.promptlayer.com               │
└─────────────────────────────────────┘
```

## Installation

### 1. Install PromptLayer Package

```bash
npm install promptlayer
```

✅ **Already installed** - Found in your `package.json`

### 2. Set Environment Variables

Add to your `.env` file:

```bash
PROMPTLAYER_API_KEY=pl-api-xxxxxxxxxxxxxxxxxxxxxxxx
```

Get your API key from: https://promptlayer.com/settings

## Backend API Implementation

### Option 1: Node.js/Fastify Integration (Recommended)

Create `bridge/api/promptlayer.js`:

```javascript
const fastify = require('fastify');
const PromptLayer = require('promptlayer').PromptLayer;

// Initialize PromptLayer
const promptlayer = new PromptLayer({
  apiKey: process.env.PROMPTLAYER_API_KEY
});

module.exports = async function promptlayerRoutes(server) {
  
  // Get all prompt templates
  server.get('/api/promptlayer/prompts', async (request, reply) => {
    try {
      const response = await fetch('https://api.promptlayer.com/rest/templates', {
        headers: {
          'X-API-KEY': process.env.PROMPTLAYER_API_KEY
        }
      });
      
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch prompts' });
    }
  });

  // Create or update prompt template
  server.post('/api/promptlayer/prompts', async (request, reply) => {
    try {
      const { name, template, input_variables, model } = request.body;
      
      const response = await fetch('https://api.promptlayer.com/rest/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.PROMPTLAYER_API_KEY
        },
        body: JSON.stringify({
          prompt_name: name,
          prompt_template: {
            template: template,
            input_variables: input_variables?.split(',').map(v => v.trim()) || []
          },
          model: model
        })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      reply.code(500).send({ error: 'Failed to create prompt' });
    }
  });

  // Deploy prompt to production
  server.post('/api/promptlayer/prompts/:id/deploy', async (request, reply) => {
    try {
      const { id } = request.params;
      
      const response = await fetch(
        `https://api.promptlayer.com/rest/templates/${id}/publish`,
        {
          method: 'POST',
          headers: {
            'X-API-KEY': process.env.PROMPTLAYER_API_KEY
          }
        }
      );

      return { success: true };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to deploy prompt' });
    }
  });

  // Get analytics data
  server.get('/api/promptlayer/analytics', async (request, reply) => {
    try {
      const { range = '24h' } = request.query;
      
      // Calculate time range
      const now = Date.now();
      const ranges = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };
      
      const startTime = new Date(now - ranges[range]).toISOString();

      // Fetch request logs
      const response = await fetch(
        `https://api.promptlayer.com/rest/get-request-ids?start_time=${startTime}`,
        {
          headers: {
            'X-API-KEY': process.env.PROMPTLAYER_API_KEY
          }
        }
      );

      const requestIds = await response.json();

      // Aggregate analytics
      const analytics = await aggregateAnalytics(requestIds);
      
      return analytics;
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch analytics' });
    }
  });

  // Get request history
  server.get('/api/promptlayer/history', async (request, reply) => {
    try {
      const { page = 1, prompt = '' } = request.query;
      const limit = 50;

      const response = await fetch(
        `https://api.promptlayer.com/rest/track-request`,
        {
          headers: {
            'X-API-KEY': process.env.PROMPTLAYER_API_KEY
          }
        }
      );

      const data = await response.json();
      
      return {
        items: data.requests || [],
        has_more: data.has_more || false
      };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch history' });
    }
  });

  // Score a request
  server.post('/api/promptlayer/requests/:id/score', async (request, reply) => {
    try {
      const { id } = request.params;
      const { score } = request.body;

      const response = await fetch(
        'https://api.promptlayer.com/rest/track-score',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': process.env.PROMPTLAYER_API_KEY
          },
          body: JSON.stringify({
            request_id: id,
            score: score
          })
        }
      );

      return { success: true };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to score request' });
    }
  });

  // Test connection
  server.get('/api/promptlayer/test', async (request, reply) => {
    try {
      const response = await fetch('https://api.promptlayer.com/rest/templates', {
        headers: {
          'X-API-KEY': process.env.PROMPTLAYER_API_KEY
        }
      });

      if (response.ok) {
        return { status: 'connected' };
      } else {
        reply.code(401).send({ error: 'Invalid API key' });
      }
    } catch (error) {
      reply.code(500).send({ error: 'Connection failed' });
    }
  });

  // Settings management
  server.get('/api/promptlayer/settings', async (request, reply) => {
    // Return settings from your database/config
    return {
      apiKey: process.env.PROMPTLAYER_API_KEY ? '***' + process.env.PROMPTLAYER_API_KEY.slice(-4) : '',
      enableTracking: true,
      enableScoring: false,
      defaultTags: 'production,barbara',
      returnPromptId: 'true'
    };
  });

  server.post('/api/promptlayer/settings', async (request, reply) => {
    // Save settings to your database/config
    const settings = request.body;
    // TODO: Store in Supabase or config file
    return { success: true };
  });
};

// Helper function to aggregate analytics
async function aggregateAnalytics(requestIds) {
  // This is a simplified version - you'll want to fetch actual request data
  return {
    summary: {
      total_requests: requestIds.length,
      requests_change: 12.5,
      avg_latency: 850,
      latency_change: -5.2,
      total_tokens: 125000,
      estimated_cost: 0.75,
      success_rate: 96.5,
      success_change: 2.1
    },
    by_prompt: [
      {
        prompt_name: 'barbara_greeting',
        request_count: 450,
        avg_latency: 720,
        total_tokens: 45000,
        cost: 0.27,
        success_rate: 98.2
      },
      {
        prompt_name: 'barbara_qualification',
        request_count: 380,
        avg_latency: 950,
        total_tokens: 62000,
        cost: 0.37,
        success_rate: 95.8
      }
    ]
  };
}

module.exports.aggregateAnalytics = aggregateAnalytics;
```

### Option 2: Direct Integration in audio-bridge.js

You can also integrate PromptLayer tracking directly into your existing `audio-bridge.js`:

```javascript
const PromptLayer = require('promptlayer').PromptLayer;

const promptlayer = new PromptLayer({
  apiKey: process.env.PROMPTLAYER_API_KEY
});

// Wrap your OpenAI calls with PromptLayer tracking
async function callBarbaraWithTracking(prompt, metadata) {
  const requestStartTime = Date.now();
  
  try {
    // Make your OpenAI API call
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are Barbara...' },
        { role: 'user', content: prompt }
      ]
    });

    // Log to PromptLayer
    const requestId = await promptlayer.track.prompt({
      function_name: 'openai.ChatCompletion',
      kwargs: {
        model: 'gpt-4o',
        messages: messages
      },
      tags: ['barbara', 'production', 'voice-call'],
      request_response: response,
      request_start_time: requestStartTime / 1000,
      request_end_time: Date.now() / 1000,
      metadata: {
        call_id: metadata.callId,
        caller_number: metadata.callerNumber,
        phase: metadata.phase
      }
    });

    logger.info('Tracked request to PromptLayer', { requestId });

    return response;
  } catch (error) {
    logger.error('Failed to track PromptLayer request', { error });
    throw error;
  }
}
```

## Integrating with Your Existing PromptManager

Update `bridge/prompt-manager.js` to use PromptLayer:

```javascript
const PromptLayer = require('promptlayer').PromptLayer;
const promptlayer = new PromptLayer({
  apiKey: process.env.PROMPTLAYER_API_KEY
});

class PromptManager {
  async getPromptTemplate(templateName, version = null) {
    try {
      // Fetch from PromptLayer instead of local registry
      const template = await promptlayer.templates.get({
        prompt_name: templateName,
        version: version
      });

      return template;
    } catch (error) {
      logger.error('Failed to fetch template from PromptLayer', { 
        templateName, 
        error 
      });
      
      // Fallback to local prompts
      return this.getLocalPrompt(templateName);
    }
  }

  async trackRequest(templateName, input, output, metadata) {
    try {
      const requestId = await promptlayer.track.prompt({
        function_name: 'barbara.chat',
        prompt_name: templateName,
        kwargs: { input },
        tags: ['barbara', metadata.phase],
        metadata: {
          call_id: metadata.callId,
          caller_info: metadata.callerInfo,
          slots: metadata.slots
        },
        request_response: output
      });

      return requestId;
    } catch (error) {
      logger.error('Failed to track to PromptLayer', { error });
    }
  }
}
```

## Using the Vue Component

### 1. Add to Your Portal

```vue
<template>
  <div class="portal">
    <nav>
      <!-- Your navigation -->
      <router-link to="/promptlayer">PromptLayer</router-link>
    </nav>
    
    <router-view />
  </div>
</template>
```

### 2. Configure Router

```javascript
import PromptLayerManager from './components/PromptLayerManager.vue';

const routes = [
  {
    path: '/promptlayer',
    name: 'PromptLayer',
    component: PromptLayerManager
  }
];
```

### 3. Access the Portal

Navigate to `http://localhost:your-port/promptlayer` to:
- Edit Barbara's prompts without code changes
- View real-time analytics on call performance
- Debug failed calls by reviewing request history
- Track costs and token usage

## Key Features

### Prompt Registry
- **Visual Editor**: Edit prompts with syntax highlighting
- **Version Control**: Track changes and rollback if needed
- **A/B Testing**: Deploy multiple versions and compare
- **Variables**: Define input variables for dynamic prompts

### Analytics Dashboard
- **Real-time Metrics**: Total requests, latency, tokens, costs
- **Trend Analysis**: Compare performance over time
- **Per-Prompt Stats**: See which prompts perform best
- **Cost Tracking**: Monitor spending per prompt

### Request History
- **Full Logging**: Every request with input/output
- **Search & Filter**: Find specific calls or patterns
- **Debugging**: Identify issues in production
- **Scoring**: Rate requests for quality tracking

## Best Practices

### 1. Tag Everything

```javascript
promptlayer.track.prompt({
  // ... other params
  tags: [
    'environment:production',
    'agent:barbara',
    'phase:qualification',
    'broker:dan-thomas'
  ]
});
```

### 2. Include Metadata

```javascript
metadata: {
  call_id: callId,
  caller_number: callerNumber,
  caller_name: callerName,
  est_home_value: slots.est_home_value,
  urgency_level: slots.urgency_level,
  booking_result: 'scheduled' // or 'failed', 'callback'
}
```

### 3. Score Critical Requests

```javascript
// After successful booking
await promptlayer.track.score({
  request_id: requestId,
  score: 100 // 0-100
});

// After failed qualification
await promptlayer.track.score({
  request_id: requestId,
  score: 30
});
```

### 4. Use Prompt Templates

Instead of hardcoding prompts:

```javascript
// ❌ Bad - hardcoded
const prompt = `You are Barbara, a friendly assistant...`;

// ✅ Good - from PromptLayer
const template = await promptlayer.templates.get({
  prompt_name: 'barbara_greeting',
  input_variables: {
    caller_name: 'John',
    time_of_day: 'morning'
  }
});
```

## API Reference

### PromptLayer REST API Endpoints

```
GET    /api/promptlayer/prompts          - List all prompts
POST   /api/promptlayer/prompts          - Create new prompt
PUT    /api/promptlayer/prompts/:id      - Update prompt
POST   /api/promptlayer/prompts/:id/deploy - Deploy to production

GET    /api/promptlayer/analytics        - Get analytics data
GET    /api/promptlayer/history          - Get request history
POST   /api/promptlayer/requests/:id/score - Score a request

GET    /api/promptlayer/settings         - Get settings
POST   /api/promptlayer/settings         - Update settings
GET    /api/promptlayer/test             - Test connection
```

## Troubleshooting

### "Failed to connect" Error

1. Check your API key: https://promptlayer.com/settings
2. Verify environment variable is set: `echo $PROMPTLAYER_API_KEY`
3. Ensure promptlayer package is installed: `npm list promptlayer`

### No Data Showing

1. Verify tracking is enabled in code
2. Check that requests are being made
3. Look for errors in server logs
4. Test connection in Settings tab

### Analytics Not Loading

1. Ensure time range is set correctly
2. Check that you have requests in that time period
3. Verify API key has analytics permissions

## Next Steps

1. ✅ Component created: `portal/src/components/PromptLayerManager.vue`
2. 📝 Create API routes in `bridge/api/promptlayer.js`
3. 🔗 Add to portal router
4. 🧪 Test with live data
5. 📊 Monitor Barbara's performance in production

## Resources

- [PromptLayer Docs](https://docs.promptlayer.com)
- [PromptLayer API Reference](https://docs.promptlayer.com/reference/rest-api-reference)
- [PromptLayer GitHub](https://github.com/MagnivOrg/prompt-layer-library)
- [Vue.js Guide](https://vuejs.org/guide/)

