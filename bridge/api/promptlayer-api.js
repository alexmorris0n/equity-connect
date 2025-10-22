/**
 * PromptLayer API Routes for Equity Connect Portal
 * 
 * Provides REST endpoints for managing prompts, analytics, and request history
 * Integrates with PromptLayer API and Supabase for persistence
 */

const fetch = require('node-fetch');

const PROMPTLAYER_API_BASE = 'https://api.promptlayer.com/rest';

/**
 * Register PromptLayer routes with Fastify server
 * @param {FastifyInstance} server 
 * @param {Object} options - { supabase, logger }
 */
module.exports = async function promptlayerRoutes(server, options) {
  const { supabase, logger } = options;
  const apiKey = process.env.PROMPTLAYER_API_KEY;

  // Middleware to check API key
  const checkApiKey = async (request, reply) => {
    if (!apiKey) {
      reply.code(500).send({ error: 'PromptLayer API key not configured' });
      return false;
    }
    return true;
  };

  // =================================================================
  // PROMPT TEMPLATE MANAGEMENT
  // =================================================================

  /**
   * GET /api/promptlayer/prompts
   * List all prompt templates
   */
  server.get('/api/promptlayer/prompts', async (request, reply) => {
    if (!await checkApiKey(request, reply)) return;

    try {
      const response = await fetch(`${PROMPTLAYER_API_BASE}/templates`, {
        headers: {
          'X-API-KEY': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`PromptLayer API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        items: data.items || [],
        total: data.total || 0
      };
    } catch (error) {
      logger.error('Failed to fetch prompts from PromptLayer', { error });
      reply.code(500).send({ error: 'Failed to fetch prompts' });
    }
  });

  /**
   * POST /api/promptlayer/prompts
   * Create a new prompt template
   */
  server.post('/api/promptlayer/prompts', async (request, reply) => {
    if (!await checkApiKey(request, reply)) return;

    try {
      const { name, template, input_variables, model, metadata } = request.body;

      const response = await fetch(`${PROMPTLAYER_API_BASE}/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey
        },
        body: JSON.stringify({
          prompt_name: name,
          prompt_template: {
            template: template,
            input_variables: typeof input_variables === 'string' 
              ? input_variables.split(',').map(v => v.trim())
              : input_variables || []
          },
          model: model || 'gpt-4o-mini',
          metadata: metadata || {}
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`PromptLayer API error: ${error}`);
      }

      const data = await response.json();
      
      logger.info('Created prompt template', { name, id: data.id });
      
      return data;
    } catch (error) {
      logger.error('Failed to create prompt template', { error });
      reply.code(500).send({ error: error.message || 'Failed to create prompt' });
    }
  });

  /**
   * PUT /api/promptlayer/prompts/:id
   * Update an existing prompt template
   */
  server.put('/api/promptlayer/prompts/:id', async (request, reply) => {
    if (!await checkApiKey(request, reply)) return;

    try {
      const { id } = request.params;
      const { name, template, input_variables, model } = request.body;

      const response = await fetch(`${PROMPTLAYER_API_BASE}/templates/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey
        },
        body: JSON.stringify({
          prompt_name: name,
          prompt_template: {
            template: template,
            input_variables: typeof input_variables === 'string'
              ? input_variables.split(',').map(v => v.trim())
              : input_variables || []
          },
          model: model
        })
      });

      if (!response.ok) {
        throw new Error(`PromptLayer API error: ${response.status}`);
      }

      const data = await response.json();
      
      logger.info('Updated prompt template', { id, name });
      
      return data;
    } catch (error) {
      logger.error('Failed to update prompt template', { error });
      reply.code(500).send({ error: 'Failed to update prompt' });
    }
  });

  /**
   * POST /api/promptlayer/prompts/:id/deploy
   * Publish prompt template to production
   */
  server.post('/api/promptlayer/prompts/:id/deploy', async (request, reply) => {
    if (!await checkApiKey(request, reply)) return;

    try {
      const { id } = request.params;

      const response = await fetch(
        `${PROMPTLAYER_API_BASE}/templates/${id}/publish`,
        {
          method: 'POST',
          headers: {
            'X-API-KEY': apiKey
          }
        }
      );

      if (!response.ok) {
        throw new Error(`PromptLayer API error: ${response.status}`);
      }

      logger.info('Deployed prompt template', { id });
      
      return { success: true, id };
    } catch (error) {
      logger.error('Failed to deploy prompt template', { error });
      reply.code(500).send({ error: 'Failed to deploy prompt' });
    }
  });

  // =================================================================
  // ANALYTICS & METRICS
  // =================================================================

  /**
   * GET /api/promptlayer/analytics
   * Get aggregated analytics data
   */
  server.get('/api/promptlayer/analytics', async (request, reply) => {
    if (!await checkApiKey(request, reply)) return;

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

      // Fetch request IDs from PromptLayer
      const response = await fetch(
        `${PROMPTLAYER_API_BASE}/get-request-ids?start_time=${startTime}`,
        {
          headers: {
            'X-API-KEY': apiKey
          }
        }
      );

      if (!response.ok) {
        throw new Error(`PromptLayer API error: ${response.status}`);
      }

      const requestIds = await response.json();

      // Fetch detailed analytics from Supabase (where we store extra metadata)
      const { data: supabaseAnalytics } = await supabase
        .from('promptlayer_analytics')
        .select('*')
        .gte('created_at', startTime);

      // Aggregate analytics
      const analytics = aggregateAnalytics(requestIds, supabaseAnalytics || []);
      
      return analytics;
    } catch (error) {
      logger.error('Failed to fetch analytics', { error });
      reply.code(500).send({ error: 'Failed to fetch analytics' });
    }
  });

  // =================================================================
  // REQUEST HISTORY
  // =================================================================

  /**
   * GET /api/promptlayer/history
   * Get request history with pagination
   */
  server.get('/api/promptlayer/history', async (request, reply) => {
    if (!await checkApiKey(request, reply)) return;

    try {
      const { page = 1, limit = 50, prompt = '' } = request.query;
      const offset = (page - 1) * limit;

      // Fetch from Supabase for faster queries with our metadata
      let query = supabase
        .from('promptlayer_requests')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (prompt) {
        query = query.eq('prompt_name', prompt);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      return {
        items: data || [],
        total: count,
        page: parseInt(page),
        has_more: offset + limit < count
      };
    } catch (error) {
      logger.error('Failed to fetch request history', { error });
      reply.code(500).send({ error: 'Failed to fetch history' });
    }
  });

  /**
   * POST /api/promptlayer/requests/:id/score
   * Add a score to a request
   */
  server.post('/api/promptlayer/requests/:id/score', async (request, reply) => {
    if (!await checkApiKey(request, reply)) return;

    try {
      const { id } = request.params;
      const { score, name = 'quality' } = request.body;

      if (score < 0 || score > 100) {
        reply.code(400).send({ error: 'Score must be between 0 and 100' });
        return;
      }

      const response = await fetch(`${PROMPTLAYER_API_BASE}/track-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey
        },
        body: JSON.stringify({
          request_id: id,
          score: score,
          score_name: name
        })
      });

      if (!response.ok) {
        throw new Error(`PromptLayer API error: ${response.status}`);
      }

      logger.info('Scored request', { requestId: id, score });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to score request', { error });
      reply.code(500).send({ error: 'Failed to score request' });
    }
  });

  // =================================================================
  // SETTINGS & CONFIGURATION
  // =================================================================

  /**
   * GET /api/promptlayer/settings
   * Get PromptLayer settings
   */
  server.get('/api/promptlayer/settings', async (request, reply) => {
    try {
      // Fetch settings from Supabase
      const { data, error } = await supabase
        .from('portal_settings')
        .select('settings')
        .eq('key', 'promptlayer')
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        throw error;
      }

      const settings = data?.settings || {
        enableTracking: true,
        enableScoring: false,
        defaultTags: 'production,barbara',
        returnPromptId: 'true'
      };

      // Mask API key for security
      settings.apiKey = apiKey 
        ? '***' + apiKey.slice(-4) 
        : '';

      return settings;
    } catch (error) {
      logger.error('Failed to fetch settings', { error });
      reply.code(500).send({ error: 'Failed to fetch settings' });
    }
  });

  /**
   * POST /api/promptlayer/settings
   * Update PromptLayer settings
   */
  server.post('/api/promptlayer/settings', async (request, reply) => {
    try {
      const settings = request.body;

      // Don't store API key in database - use env var
      delete settings.apiKey;

      // Save to Supabase
      const { error } = await supabase
        .from('portal_settings')
        .upsert({
          key: 'promptlayer',
          settings: settings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      logger.info('Updated PromptLayer settings', { settings });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to save settings', { error });
      reply.code(500).send({ error: 'Failed to save settings' });
    }
  });

  /**
   * GET /api/promptlayer/test
   * Test PromptLayer API connection
   */
  server.get('/api/promptlayer/test', async (request, reply) => {
    try {
      if (!apiKey) {
        reply.code(500).send({ 
          error: 'API key not configured',
          status: 'error' 
        });
        return;
      }

      const response = await fetch(`${PROMPTLAYER_API_BASE}/templates?limit=1`, {
        headers: {
          'X-API-KEY': apiKey
        }
      });

      if (response.ok) {
        return { 
          status: 'connected',
          message: 'Successfully connected to PromptLayer'
        };
      } else if (response.status === 401) {
        reply.code(401).send({ 
          error: 'Invalid API key',
          status: 'error'
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      logger.error('PromptLayer connection test failed', { error });
      reply.code(500).send({ 
        error: error.message,
        status: 'error'
      });
    }
  });

  logger.info('PromptLayer API routes registered');
};

// =================================================================
// HELPER FUNCTIONS
// =================================================================

/**
 * Aggregate analytics from request data
 */
function aggregateAnalytics(requestIds, supabaseData) {
  const total = requestIds.length;
  
  if (total === 0) {
    return {
      summary: {
        total_requests: 0,
        requests_change: 0,
        avg_latency: 0,
        latency_change: 0,
        total_tokens: 0,
        estimated_cost: 0,
        success_rate: 0,
        success_change: 0
      },
      by_prompt: []
    };
  }

  // Calculate aggregate metrics from Supabase data
  const latencies = supabaseData.map(r => r.latency_ms || 0);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;
  
  const totalTokens = supabaseData.reduce((sum, r) => sum + (r.total_tokens || 0), 0);
  const successCount = supabaseData.filter(r => r.status === 'success').length;
  const successRate = (successCount / total) * 100;

  // Estimate cost (rough approximation)
  const estimatedCost = (totalTokens / 1000) * 0.006; // ~$0.006 per 1K tokens avg

  // Group by prompt name
  const byPrompt = {};
  supabaseData.forEach(req => {
    const name = req.prompt_name || 'unknown';
    if (!byPrompt[name]) {
      byPrompt[name] = {
        prompt_name: name,
        request_count: 0,
        total_latency: 0,
        total_tokens: 0,
        success_count: 0
      };
    }
    
    byPrompt[name].request_count++;
    byPrompt[name].total_latency += req.latency_ms || 0;
    byPrompt[name].total_tokens += req.total_tokens || 0;
    if (req.status === 'success') byPrompt[name].success_count++;
  });

  const promptStats = Object.values(byPrompt).map(p => ({
    prompt_name: p.prompt_name,
    request_count: p.request_count,
    avg_latency: Math.round(p.total_latency / p.request_count),
    total_tokens: p.total_tokens,
    cost: (p.total_tokens / 1000) * 0.006,
    success_rate: Math.round((p.success_count / p.request_count) * 100)
  }));

  return {
    summary: {
      total_requests: total,
      requests_change: 0, // Would need historical data for this
      avg_latency: Math.round(avgLatency),
      latency_change: 0, // Would need historical data
      total_tokens: totalTokens,
      estimated_cost: estimatedCost,
      success_rate: Math.round(successRate * 10) / 10,
      success_change: 0 // Would need historical data
    },
    by_prompt: promptStats.sort((a, b) => b.request_count - a.request_count)
  };
}

module.exports.aggregateAnalytics = aggregateAnalytics;

