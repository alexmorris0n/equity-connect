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

  // =================================================================
  // PROMPT VERSIONING & MANAGEMENT (NEW)
  // =================================================================

  /**
   * Authorization middleware - check if user is admin
   */
  async function requireAdmin(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send({ error: 'Authorization required' });
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return reply.code(401).send({ error: 'Invalid token' });
      }

      // Get broker info with role
      const { data: broker, error: brokerError } = await supabase
        .from('brokers')
        .select('user_role')
        .eq('user_id', user.id)
        .single();

      if (brokerError || broker?.user_role !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      request.user = user;
      request.broker = broker;
    } catch (err) {
      logger.error('Auth error:', err);
      return reply.code(401).send({ error: 'Authentication failed' });
    }
  }

  /**
   * POST /api/promptlayer/prompts/:id/versions
   * Create a new version of a prompt
   */
  server.post('/api/promptlayer/prompts/:id/versions', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params;
    const { content, change_summary, is_draft = true } = request.body;

    try {
      // Get current max version number
      const { data: versions } = await supabase
        .from('prompt_versions')
        .select('version_number')
        .eq('prompt_id', id)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

      // Extract variables from content
      const variables = extractVariables(content);

      // Create new version
      const { data: newVersion, error } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: id,
          version_number: nextVersion,
          content,
          variables,
          change_summary,
          is_draft,
          is_active: false,
          created_by: request.user.email
        })
        .select()
        .single();

      if (error) throw error;

      // Log audit trail
      await supabase.from('prompt_audit_log').insert({
        prompt_id: id,
        version_number: nextVersion,
        action: 'created',
        performed_by: request.user.email,
        change_details: { change_summary, is_draft }
      });

      reply.send(newVersion);
    } catch (error) {
      logger.error('Error creating version:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * GET /api/promptlayer/prompts/:id/versions
   * Get all versions of a prompt
   */
  server.get('/api/promptlayer/prompts/:id/versions', async (request, reply) => {
    const { id } = request.params;

    try {
      const { data, error } = await supabase
        .from('prompt_versions')
        .select('*')
        .eq('prompt_id', id)
        .order('version_number', { ascending: false });

      if (error) throw error;

      reply.send(data || []);
    } catch (error) {
      logger.error('Error fetching versions:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * POST /api/promptlayer/prompts/:id/deploy
   * Deploy a specific version to production
   */
  server.post('/api/promptlayer/prompts/:id/deploy', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params;
    const { version_number, deployment_reason } = request.body;

    try {
      // Deactivate current active version
      await supabase
        .from('prompt_versions')
        .update({ is_active: false })
        .eq('prompt_id', id)
        .eq('is_active', true);

      // Activate new version
      const { data: deployed, error } = await supabase
        .from('prompt_versions')
        .update({ is_active: true, is_draft: false })
        .eq('prompt_id', id)
        .eq('version_number', version_number)
        .select()
        .single();

      if (error) throw error;

      // Update current_version in prompts table
      await supabase
        .from('prompts')
        .update({ current_version: version_number, updated_at: new Date().toISOString() })
        .eq('id', id);

      // Log deployment
      await supabase.from('prompt_deployments').insert({
        prompt_id: id,
        version_number,
        deployed_by: request.user.email,
        deployment_reason,
        status: 'deployed'
      });

      // Log audit trail
      await supabase.from('prompt_audit_log').insert({
        prompt_id: id,
        version_number,
        action: 'deployed',
        performed_by: request.user.email,
        change_details: { deployment_reason }
      });

      reply.send(deployed);
    } catch (error) {
      logger.error('Error deploying version:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * POST /api/promptlayer/prompts/:id/rollback
   * Rollback to a previous version
   */
  server.post('/api/promptlayer/prompts/:id/rollback', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params;
    const { version_number, rollback_reason } = request.body;

    try {
      // Get current active version
      const { data: currentVersion } = await supabase
        .from('prompt_versions')
        .select('version_number')
        .eq('prompt_id', id)
        .eq('is_active', true)
        .single();

      // Deactivate current
      await supabase
        .from('prompt_versions')
        .update({ is_active: false })
        .eq('prompt_id', id)
        .eq('is_active', true);

      // Activate rollback version
      const { data: rolled, error } = await supabase
        .from('prompt_versions')
        .update({ is_active: true })
        .eq('prompt_id', id)
        .eq('version_number', version_number)
        .select()
        .single();

      if (error) throw error;

      // Update prompts table
      await supabase
        .from('prompts')
        .update({ current_version: version_number, updated_at: new Date().toISOString() })
        .eq('id', id);

      // Log deployment with rollback info
      await supabase.from('prompt_deployments').insert({
        prompt_id: id,
        version_number,
        deployed_by: request.user.email,
        deployment_reason: rollback_reason,
        rollback_from_version: currentVersion?.version_number,
        status: 'rolled_back'
      });

      // Log audit trail
      await supabase.from('prompt_audit_log').insert({
        prompt_id: id,
        version_number,
        action: 'rolled_back',
        performed_by: request.user.email,
        change_details: { rollback_reason, from_version: currentVersion?.version_number }
      });

      reply.send(rolled);
    } catch (error) {
      logger.error('Error rolling back:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * GET /api/promptlayer/prompts/:id/performance
   * Get performance metrics for a prompt and its versions
   */
  server.get('/api/promptlayer/prompts/:id/performance', async (request, reply) => {
    const { id } = request.params;

    try {
      // Get all versions with their performance data
      const { data: versions, error } = await supabase
        .from('prompt_versions')
        .select(`
          version_number,
          is_active,
          created_at,
          prompt_version_performance (
            total_calls,
            total_bookings,
            conversion_rate,
            avg_call_duration_seconds
          )
        `)
        .eq('prompt_id', id)
        .order('version_number', { ascending: false });

      if (error) throw error;

      // Get overall prompt info
      const { data: prompt } = await supabase
        .from('prompts')
        .select('name, current_version')
        .eq('id', id)
        .single();

      reply.send({
        prompt_name: prompt?.name,
        current_version: prompt?.current_version,
        versions: versions || []
      });
    } catch (error) {
      logger.error('Error fetching performance:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * POST /api/promptlayer/prompts/:id/assign
   * Assign a prompt to brokers
   */
  server.post('/api/promptlayer/prompts/:id/assign', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params;
    const { broker_ids, version_number } = request.body;

    try {
      const assignments = broker_ids.map(broker_id => ({
        broker_id,
        prompt_id: id,
        prompt_version: version_number,
        assigned_by: request.broker.id
      }));

      const { data, error } = await supabase
        .from('broker_prompt_assignments')
        .upsert(assignments, { onConflict: 'broker_id,prompt_id' })
        .select();

      if (error) throw error;

      // Log audit trail
      await supabase.from('prompt_audit_log').insert({
        prompt_id: id,
        version_number,
        action: 'assigned',
        performed_by: request.user.email,
        change_details: { broker_ids }
      });

      reply.send(data);
    } catch (error) {
      logger.error('Error assigning prompt:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * POST /api/promptlayer/prompts/:id/validate
   * Validate prompt content and variables
   */
  server.post('/api/promptlayer/prompts/:id/validate', async (request, reply) => {
    const { content } = request.body;

    try {
      const errors = [];
      const warnings = [];

      // Extract variables
      const variables = extractVariables(content);

      // Define known/required variables
      const knownVariables = [
        'leadFirstName', 'leadLastName', 'propertyCity', 'propertyState',
        'estimatedEquityWords', 'brokerName', 'companyName', 'brokerNMLS', 'brokerPhone'
      ];

      // Check for unknown variables
      variables.forEach(v => {
        if (!knownVariables.includes(v)) {
          warnings.push({
            type: 'unknown_variable',
            message: `Variable {{${v}}} is not in the known variable list`,
            variable: v
          });
        }
      });

      // Check for missing critical variables in context sections
      if (content.lead_context && !content.lead_context.includes('{{leadFirstName}}')) {
        warnings.push({
          type: 'missing_variable',
          message: 'Lead context should include {{leadFirstName}}',
          section: 'lead_context'
        });
      }

      if (content.broker_context && !content.broker_context.includes('{{brokerName}}')) {
        warnings.push({
          type: 'missing_variable',
          message: 'Broker context should include {{brokerName}}',
          section: 'broker_context'
        });
      }

      reply.send({
        valid: errors.length === 0,
        errors,
        warnings,
        variables_found: variables
      });
    } catch (error) {
      logger.error('Error validating prompt:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * POST /api/promptlayer/prompts/:id/render
   * Render a prompt with variable substitution
   */
  server.post('/api/promptlayer/prompts/:id/render', async (request, reply) => {
    const { id } = request.params;
    const { version_number, variables } = request.body;

    try {
      const { data: version, error } = await supabase
        .from('prompt_versions')
        .select('content')
        .eq('prompt_id', id)
        .eq('version_number', version_number)
        .single();

      if (error) throw error;

      const rendered = renderPromptWithVariables(version.content, variables);

      reply.send({ rendered });
    } catch (error) {
      logger.error('Error rendering prompt:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * GET /api/broker/my-prompt
   * Get broker's assigned prompt (broker-accessible)
   */
  server.get('/api/broker/my-prompt', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send({ error: 'Authorization required' });
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return reply.code(401).send({ error: 'Invalid token' });
      }

      // Get broker
      const { data: broker } = await supabase
        .from('brokers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!broker) {
        return reply.code(404).send({ error: 'Broker not found' });
      }

      // Get assigned prompt
      const { data: assignment, error: assignError } = await supabase
        .from('broker_prompt_assignments')
        .select(`
          prompt_id,
          prompt_version,
          custom_variables,
          prompts (
            name,
            description
          ),
          prompt_versions!inner (
            content,
            variables,
            is_active
          )
        `)
        .eq('broker_id', broker.id)
        .single();

      if (assignError) throw assignError;

      reply.send(assignment);
    } catch (error) {
      logger.error('Error fetching broker prompt:', error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * PUT /api/broker/my-context
   * Update broker's custom variables
   */
  server.put('/api/broker/my-context', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send({ error: 'Authorization required' });
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return reply.code(401).send({ error: 'Invalid token' });
      }

      const { data: broker } = await supabase
        .from('brokers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!broker) {
        return reply.code(404).send({ error: 'Broker not found' });
      }

      const { custom_variables } = request.body;

      // Update custom variables (RLS will ensure they can only update their own)
      const { data, error: updateError } = await supabase
        .from('broker_prompt_assignments')
        .update({ custom_variables })
        .eq('broker_id', broker.id)
        .select();

      if (updateError) throw updateError;

      reply.send(data);
    } catch (error) {
      logger.error('Error updating broker context:', error);
      reply.code(500).send({ error: error.message });
    }
  });

};

// =================================================================
// UTILITY FUNCTIONS
// =================================================================

/**
 * Extract template variables from prompt content
 */
function extractVariables(content) {
  const variables = new Set();
  const regex = /{{(\w+)}}/g;
  
  // If content is JSON/object, stringify it
  const text = typeof content === 'object' ? JSON.stringify(content) : content;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    variables.add(match[1]);
  }
  
  return Array.from(variables);
}

/**
 * Render prompt content with variable substitution
 */
function renderPromptWithVariables(content, variables) {
  const rendered = {};
  
  Object.entries(content).forEach(([section, text]) => {
    rendered[section] = text;
    
    Object.entries(variables).forEach(([key, value]) => {
      rendered[section] = rendered[section].replace(
        new RegExp(`{{${key}}}`, 'g'),
        value
      );
    });
  });
  
  return rendered;
}

