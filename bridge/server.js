/**
 * OpenAI Realtime Voice Bridge - Main Server
 * 
 * Production server for handling SignalWire PSTN calls via OpenAI Realtime API.
 * 
 * Features:
 * - Inbound call handling via SignalWire <Stream>
 * - Outbound call placement via n8n
 * - Supabase tool integration (lead lookup, appointments, etc.)
 * - Audio relay between SignalWire and OpenAI Realtime
 */

require('dotenv').config();
const Fastify = require('fastify');
const fastifyWebsocket = require('@fastify/websocket');
const fastifyFormbody = require('@fastify/formbody');
const AudioBridge = require('./audio-bridge');
const SignalWireClient = require('./signalwire-client');
const { initSupabase } = require('./tools');

// Configuration
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';
const BRIDGE_URL = process.env.BRIDGE_URL || `http://localhost:${PORT}`;
const SW_PROJECT = process.env.SW_PROJECT;
const SW_TOKEN = process.env.SW_TOKEN;
const SW_SPACE = process.env.SW_SPACE;

// Validate required environment variables
const requiredEnvVars = ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Initialize Fastify
const app = Fastify({
  logger: {
    level: NODE_ENV === 'development' ? 'info' : 'warn',
    transport: NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined
  }
});

// Register plugins
app.register(fastifyWebsocket);
app.register(fastifyFormbody); // Parse application/x-www-form-urlencoded from SignalWire

// Initialize SignalWire client (if credentials provided)
let signalwire = null;
if (SW_PROJECT && SW_TOKEN && SW_SPACE) {
  signalwire = new SignalWireClient(SW_PROJECT, SW_TOKEN, SW_SPACE);
  app.log.info('✅ SignalWire client initialized');
} else {
  app.log.warn('⚠️  SignalWire credentials not provided - outbound calls disabled');
}

// Initialize Supabase
try {
  initSupabase();
  app.log.info('✅ Supabase client initialized');
} catch (err) {
  app.log.error({ err }, '❌ Failed to initialize Supabase');
  process.exit(1);
}

// Track active calls and pending outbound calls
const activeCalls = new Map();
const pendingCalls = new Map(); // Store call context from n8n

/**
 * Health Check Endpoint
 */
app.get('/healthz', async (request, reply) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeCalls: activeCalls.size,
    memory: process.memoryUsage(),
    env: NODE_ENV,
    signalwire: {
      configured: !!signalwire,
      hasProject: !!SW_PROJECT,
      hasToken: !!SW_TOKEN,
      hasSpace: !!SW_SPACE
    }
  };
  
  return reply.code(200).send(health);
});

/**
 * Active Calls Intelligence API
 * Returns real-time metrics for dashboard
 */
app.get('/api/active-calls', async (request, reply) => {
  try {
    const { getActiveCalls } = require('./api/active-calls');
    const calls = await getActiveCalls();
    
    return reply.code(200).send({
      success: true,
      active_count: calls.length,
      calls: calls
    });
  } catch (err) {
    app.log.error({ err }, 'Error getting active calls');
    return reply.code(500).send({
      success: false,
      error: err.message
    });
  }
});

/**
 * LaML XML Endpoint for Inbound Calls
 * SignalWire calls this when an inbound call arrives
 */
app.get('/public/inbound-xml', async (request, reply) => {
  const { From, To } = request.query || {};
  const wsUrl = BRIDGE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
  
  app.log.info({ From, To }, '📞 Inbound call XML requested');
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}/audiostream" codec="L16@24000h">
      <Parameter name="track" value="both_tracks" />
      ${From ? `<Parameter name="from" value="${From}" />` : ''}
      ${To ? `<Parameter name="to" value="${To}" />` : ''}
    </Stream>
  </Connect>
</Response>`;

  app.log.info('📞 Served inbound LaML XML');
  return reply.type('text/xml').send(xml);
});

/**
 * LaML XML Endpoint for Outbound Calls
 * SignalWire calls this when an outbound call answers
 */
app.get('/public/outbound-xml', async (request, reply) => {
  const wsUrl = BRIDGE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
  const { call_id, From, To } = request.query;
  
  app.log.info({ call_id, from: From, to: To }, '📞 Outbound call LaML requested (GET)');
  
  // Use exact same format as working inbound (minimal parameters only)
  const safeCallId = call_id || '';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}/audiostream?context=outbound&amp;call_id=${safeCallId}" codec="L16@24000h">
      <Parameter name="track" value="both_tracks" />
      <Parameter name="silenceDetection" value="false" />
    </Stream>
  </Connect>
</Response>`;
  
  return reply.type('text/xml').send(xml);
});

app.post('/public/outbound-xml', async (request, reply) => {
  const wsUrl = BRIDGE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
  
  // SignalWire sends call_id in query, From/To in POST body
  const { call_id } = request.query;
  const { From, To } = request.body || {};
  
  app.log.info({ call_id, from: From, to: To, body: request.body }, '📞 Outbound call LaML requested (POST)');
  
  // Return LaML XML for bidirectional streaming (minimal - match inbound exactly)
  const safeCallId = call_id || '';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}/audiostream?context=outbound&amp;call_id=${safeCallId}" codec="L16@24000h">
      <Parameter name="track" value="both_tracks" />
      <Parameter name="silenceDetection" value="false" />
    </Stream>
  </Connect>
</Response>`;
  
  return reply.type('text/xml').send(xml);
});

/**
 * Outbound Call Endpoint (for n8n)
 * POST /start-call
 * Body: { to, from, lead_id, broker_id, instructions }
 */
app.post('/start-call', async (request, reply) => {
  if (!signalwire) {
    return reply.code(503).send({ 
      error: 'SignalWire not configured',
      message: 'Outbound calls require SW_PROJECT, SW_TOKEN, and SW_SPACE' 
    });
  }

  const { to, from, lead_id, broker_id, instructions } = request.body;

  // Validate inputs
  if (!to || !from) {
    return reply.code(400).send({ 
      error: 'Missing required fields',
      required: ['to', 'from'],
      optional: ['lead_id', 'broker_id', 'instructions']
    });
  }

  try {
    // Generate unique call ID for tracking
    const crypto = require('crypto');
    const callId = crypto.randomUUID();
    
    // Store call context for when WebSocket connects
    pendingCalls.set(callId, {
      to,
      from,
      lead_id,
      broker_id,
      instructions: instructions || null, // Custom Barbara prompt from n8n
      created_at: Date.now()
    });
    
    // Clean up old pending calls (older than 5 minutes)
    const fiveMinAgo = Date.now() - (5 * 60 * 1000);
    for (const [id, data] of pendingCalls.entries()) {
      if (data.created_at < fiveMinAgo) {
        pendingCalls.delete(id);
        app.log.warn({ callId: id }, 'Cleaned up stale pending call');
      }
    }

    // Log outbound call request to Supabase
    if (lead_id) {
      const { executeTool } = require('./tools');
      await executeTool('save_interaction', {
        lead_id,
        broker_id,
        outcome: 'neutral',
        content: 'Outbound call initiated'
      });
    }

    // Place call via SignalWire (include callId in URL)
    const call = await signalwire.createCall({
      to,
      from,
      url: `${BRIDGE_URL}/public/outbound-xml?callId=${callId}`,
      statusCallback: `${BRIDGE_URL}/call-status` // Optional webhook
    });

    app.log.info({ 
      callSid: call.sid, 
      callId, 
      to, 
      from,
      hasInstructions: !!instructions 
    }, '📞 Outbound call placed');

    // Also store by SignalWire CallSid for status callbacks
    activeCalls.set(call.sid, { callId, lead_id, broker_id, to, from });

    return reply.send({
      success: true,
      callSid: call.sid,
      callId,
      to,
      from,
      status: call.status
    });

  } catch (err) {
    app.log.error({ err, to, from }, '❌ Failed to place outbound call');
    return reply.code(500).send({
      error: 'Failed to place call',
      message: err.message
    });
  }
});

/**
 * MCP Outbound Call Endpoint
 * POST /api/outbound-call
 * Body: { to_phone, lead_id, broker_id }
 */
app.post('/api/outbound-call', async (request, reply) => {
  if (!signalwire) {
    return reply.code(200).send({ 
      success: false,
      message: 'SignalWire not configured - outbound calls disabled'
    });
  }

  // Check authentication
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ 
      success: false,
      message: 'Missing or invalid authorization header'
    });
  }

  const token = authHeader.substring(7);
  if (token !== process.env.BRIDGE_API_KEY) {
    return reply.code(401).send({ 
      success: false,
      message: 'Invalid API key'
    });
  }

  const { to_phone, lead_id, broker_id, instructions, lead_context } = request.body;

  // Validate inputs
  if (!to_phone || !lead_id) {
    return reply.code(200).send({ 
      success: false,
      message: 'Missing required fields: to_phone, lead_id'
    });
  }

  try {
    // Import utilities
    const { normalizeToE164 } = require('./utils/number-formatter');
    const { executeTool } = require('./tools');

    // Normalize phone number to E.164
    const normalizedPhone = normalizeToE164(to_phone);
    app.log.info({ to_phone, normalizedPhone }, 'Phone normalization');
    if (!normalizedPhone) {
      return reply.code(200).send({ 
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Use provided lead context OR look up from database
    let leadRecord;
    if (lead_context && lead_context.broker) {
      // Use provided context from n8n (more efficient)
      leadRecord = lead_context;
      app.log.info({ source: 'provided' }, 'Using provided lead context from n8n');
    } else {
      // Fallback: Look up lead context from database
      const leadContext = await executeTool('get_lead_context', { phone: normalizedPhone });
      app.log.info({ leadContext }, 'Lead context lookup result (fallback)');
      if (!leadContext || !leadContext.found) {
        return reply.code(200).send({ 
          success: false,
          message: 'Lead not found in database'
        });
      }
      leadRecord = leadContext;
    }

    app.log.info({ broker_id }, 'Lead record and broker_id');
    const assignedBrokerId = broker_id || leadRecord.broker_id;

    // Select SignalWire number for the broker
    const sb = require('./tools').initSupabase();
    const { data: signalwireNumbers, error: numberError } = await sb
      .from('signalwire_phone_numbers')
      .select('*')
      .eq('assigned_broker_company', leadRecord.broker?.company_name)
      .eq('status', 'active')
      .limit(1);

    if (numberError) {
      app.log.error({ numberError }, 'Failed to query SignalWire numbers');
      return reply.code(200).send({ 
        success: false,
        message: 'Failed to find broker phone number'
      });
    }

    let selectedNumber;
    if (signalwireNumbers && signalwireNumbers.length > 0) {
      selectedNumber = signalwireNumbers[0];
    } else {
      // Fallback to default Equity Connect number
      const { data: defaultNumbers } = await sb
        .from('signalwire_phone_numbers')
        .select('*')
        .eq('assigned_broker_company', 'Equity Connect')
        .eq('status', 'active')
        .limit(1);
      
      if (defaultNumbers && defaultNumbers.length > 0) {
        selectedNumber = defaultNumbers[0];
      } else {
        return reply.code(200).send({ 
          success: false,
          message: 'No available phone numbers for outbound calls'
        });
      }
    }

    // Generate unique call ID for tracking
    const crypto = require('crypto');
    const callId = crypto.randomUUID();
    
    // Inject SignalWire number into custom instructions
    let finalInstructions = instructions;
    if (instructions) {
      // Replace {{signalwireNumber}} placeholder with actual number
      finalInstructions = instructions.replace(/\{\{signalwireNumber\}\}/g, selectedNumber.number);
    }
    
    // Store call context for when WebSocket connects
            pendingCalls.set(callId, {
              lead_id: leadRecord.lead_id,
              lead_name: leadRecord.raw.first_name,
              lead_city: leadRecord.raw.property_city,
              broker_id: assignedBrokerId,
              to_phone: normalizedPhone,
              from_phone: selectedNumber.number,
              signalwire_number: selectedNumber.number,  // Track which number is being used
              context: 'outbound',
              instructions: finalInstructions || null  // Custom Barbara prompt with injected number
            });

    // Clean up old pending calls (older than 5 minutes)
    const fiveMinAgo = Date.now() - (5 * 60 * 1000);
    for (const [id, data] of pendingCalls.entries()) {
      if (data.created_at && data.created_at < fiveMinAgo) {
        pendingCalls.delete(id);
        app.log.warn({ callId: id }, 'Cleaned up stale pending call');
      }
    }

    // Create SignalWire call
    const call = await signalwire.createCall({
      to: normalizedPhone,
      from: selectedNumber.number,
      url: `${BRIDGE_URL}/public/outbound-xml?call_id=${callId}`,
      statusCallback: `${BRIDGE_URL}/api/call-status`,
      resourceId: '2a75dd38-4f1a-4670-8776-1d13c3b25985' // Barbara Outbound resource ID
    });

    // Store by SignalWire CallSid for status callbacks
    activeCalls.set(call.sid, { 
      callId, 
      lead_id: leadRecord.id, 
      broker_id: assignedBrokerId, 
      to: normalizedPhone, 
      from: selectedNumber.number 
    });

    app.log.info({ 
      callSid: call.sid, 
      callId, 
      to: normalizedPhone, 
      from: selectedNumber.number,
      lead_id: leadRecord.lead_id,
      broker_id: assignedBrokerId
    }, '📞 MCP outbound call created');

    return reply.code(200).send({
      success: true,
      message: `✅ Call created successfully`,
      call_id: call.sid,
      internal_id: callId,
      from: selectedNumber.number,
      to: normalizedPhone
    });

  } catch (err) {
    app.log.error({ err, to_phone, lead_id, broker_id }, '❌ Failed to create MCP outbound call');
    return reply.code(200).send({
      success: false,
      message: `Failed to create call: ${err.message}`
    });
  }
});

/**
 * Call Status Webhook (optional)
 * SignalWire posts call status updates here
 */
app.post('/call-status', async (request, reply) => {
  const { CallSid, CallStatus, Duration } = request.body;
  
  app.log.info({ CallSid, CallStatus, Duration }, '📊 Call status update');
  
  // Clean up call context when call completes
  if (['completed', 'failed', 'busy', 'no-answer'].includes(CallStatus)) {
    activeCalls.delete(CallSid);
  }
  
  return reply.send({ received: true });
});

/**
 * API Call Status Webhook (for MCP integration)
 * SignalWire posts call status updates here
 */
app.post('/api/call-status', async (request, reply) => {
  const { CallSid, CallStatus, Duration, From, To } = request.body;
  
  app.log.info({ CallSid, CallStatus, Duration, From, To }, '📊 API Call status update');
  
  // Clean up call context when call completes
  if (['completed', 'failed', 'busy', 'no-answer'].includes(CallStatus)) {
    activeCalls.delete(CallSid);
    
    // Check if this call was on a tracking number (for billing)
    const sb = require('./tools').initSupabase();
    
    try {
      // Query for tracking number assignment
      const { data: assignment, error: assignmentError } = await sb
        .from('signalwire_phone_numbers')
        .select(`
          *,
          lead:leads!currently_assigned_to(*),
          broker:brokers!assigned_broker_id(*)
        `)
        .eq('number', To)
        .eq('assignment_status', 'assigned_for_tracking')
        .single();
      
      if (assignment && !assignmentError) {
        // This is a tracked call! Log for billing
        const direction = From === assignment.broker?.phone ? 'broker_to_lead' : 'lead_to_broker';
        
        app.log.info({
          tracking_number: To,
          direction,
          duration: Duration,
          billable: Duration > 300
        }, '💰 BILLING: Tracked call on assigned number');
        
        // Log to billing_call_logs
        await sb.from('billing_call_logs').insert({
          lead_id: assignment.currently_assigned_to,
          broker_id: assignment.assigned_broker_id,
          tracking_number: To,
          caller_number: From,
          direction: direction,
          duration_seconds: Duration || 0,
          call_sid: CallSid,
          call_status: CallStatus,
          appointment_datetime: assignment.appointment_scheduled_at,
          campaign_id: assignment.lead?.campaign_id,
          campaign_archetype: assignment.lead?.campaign_archetype,
          created_at: new Date().toISOString()
        });
        
        // Update lead status if call completed successfully
        if (CallStatus === 'completed' && Duration > 300) {
          await sb.from('leads').update({
            status: 'appointment_completed',
            last_engagement: new Date().toISOString()
          }).eq('id', assignment.currently_assigned_to);
          
          app.log.info({ lead_id: assignment.currently_assigned_to }, '✅ Appointment verified (call > 5 min)');
        }
      }
    } catch (err) {
      app.log.error({ err, To }, 'Error checking tracking number assignment');
    }
    
    // Regular interaction logging
    const callContext = activeCalls.get(CallSid);
    if (callContext && callContext.lead_id) {
      try {
        const { executeTool } = require('./tools');
        await executeTool('save_interaction', {
          lead_id: callContext.lead_id,
          broker_id: callContext.broker_id,
          outcome: CallStatus === 'completed' ? 'positive' : 'neutral',
          content: `Call ${CallStatus}${Duration ? ` (${Duration}s)` : ''}`
        });
      } catch (err) {
        app.log.error({ err, CallSid }, 'Failed to update lead status');
      }
    }
  }
  
  return reply.send({ received: true });
});

/**
 * WebSocket Audio Stream Handler
 * Handles bidirectional audio between SignalWire and OpenAI Realtime
 */
app.register(async function (fastify) {
  // Legacy endpoint for existing inbound calls
  fastify.get('/audiostream', { websocket: true }, async (connection, req) => {
    // In @fastify/websocket, connection IS the WebSocket
    const swSocket = connection;
    const { callId, call_id, context } = req.query;
    
    // Support both callId (legacy n8n) and call_id (MCP)
    const actualCallId = call_id || callId;
    
    app.log.info({ 
      callId: actualCallId,
      context,
      hasSocket: !!swSocket,
      socketType: typeof swSocket,
      hasOn: typeof swSocket?.on
    }, '🔌 WebSocket connected from SignalWire');
    
    // Verify socket exists and has event methods
    if (!swSocket || typeof swSocket.on !== 'function') {
      app.log.error({ 
        hasSocket: !!swSocket,
        socketKeys: swSocket ? Object.keys(swSocket).slice(0, 10) : []
      }, '❌ WebSocket connection invalid');
      return;
    }
    
    // Get call context from pending calls if this is an outbound call
    let callContext = {};
    
    if (actualCallId && pendingCalls.has(actualCallId)) {
      callContext = pendingCalls.get(actualCallId);
      app.log.info({ 
        callId: actualCallId, 
        lead_id: callContext.lead_id,
        hasInstructions: !!callContext.instructions 
      }, '📋 Retrieved call context');
      
      // Clean up pending call after retrieval
      pendingCalls.delete(actualCallId);
    } else {
      app.log.info('📞 Inbound call - will fetch context via tools');
    }
    
    // Create audio bridge with context (includes custom instructions if provided)
    const bridge = new AudioBridge(swSocket, app.log, callContext);
    
    try {
      await bridge.connect();
      app.log.info('✅ Audio bridge established');
    } catch (err) {
      app.log.error({ err }, '❌ Failed to establish audio bridge');
      if (swSocket && typeof swSocket.close === 'function') {
        swSocket.close();
      }
    }
  });

  // New endpoint for MCP outbound calls
  fastify.get('/ws', { websocket: true }, async (connection, req) => {
    // In @fastify/websocket, connection IS the WebSocket
    const swSocket = connection;
    const { context, call_id } = req.query;
    
    app.log.info({ 
      context,
      call_id,
      hasSocket: !!swSocket,
      socketType: typeof swSocket,
      hasOn: typeof swSocket?.on
    }, '🔌 WebSocket connected from SignalWire');
    
    // Verify socket exists and has event methods
    if (!swSocket || typeof swSocket.on !== 'function') {
      app.log.error({ 
        hasSocket: !!swSocket,
        socketKeys: swSocket ? Object.keys(swSocket).slice(0, 10) : []
      }, '❌ WebSocket connection invalid');
      return;
    }
    
    // Get call context from pending calls if this is an outbound call
    let callContext = {};
    
    if (context === 'outbound' && call_id && pendingCalls.has(call_id)) {
      const storedContext = pendingCalls.get(call_id);
      callContext = {
        ...storedContext,
        context: 'outbound'
      };
      
      app.log.info({ 
        call_id, 
        lead_id: callContext.lead_id,
        broker_id: callContext.broker_id
      }, '📋 Retrieved outbound call context');
      
      // Clean up pending call after retrieval
      pendingCalls.delete(call_id);
    } else {
      app.log.info('📞 Inbound call - will fetch context via tools');
    }
    
    // Create audio bridge with context
    const bridge = new AudioBridge(swSocket, app.log, callContext);
    
    try {
      await bridge.connect();
      app.log.info('✅ Audio bridge established');
    } catch (err) {
      app.log.error({ err }, '❌ Failed to establish audio bridge');
      if (swSocket && typeof swSocket.close === 'function') {
        swSocket.close();
      }
    }
  });
});

/**
 * Root endpoint (informational)
 */
app.get('/', async (request, reply) => {
  return {
    service: 'OpenAI Realtime Voice Bridge',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/healthz',
      inbound_xml: '/public/inbound-xml',
      outbound_xml: '/public/outbound-xml',
      start_call: 'POST /start-call',
      websocket: 'ws://[host]/audiostream'
    },
    features: [
      'Inbound PSTN calls via SignalWire',
      'Outbound call placement',
      'OpenAI Realtime voice AI',
      'Supabase integration',
      'Lead management tools'
    ]
  };
});

/**
 * Graceful shutdown
 */
const shutdown = async () => {
  app.log.info('🛑 Shutting down gracefully...');
  
  // Close all active bridges
  app.log.info(`Closing ${activeCalls.size} active calls`);
  activeCalls.clear();
  
  // Close server
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

/**
 * Start Server
 */
app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  
  console.log('\n🚀 OpenAI Realtime Voice Bridge - PRODUCTION\n');
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Health:      http://localhost:${PORT}/healthz`);
  console.log(`   Inbound XML: ${BRIDGE_URL}/public/inbound-xml`);
  console.log(`   Outbound:    POST ${BRIDGE_URL}/start-call`);
  console.log(`   WebSocket:   ws://localhost:${PORT}/audiostream\n`);
  console.log('📋 Ready to handle calls!\n');
  console.log('   Features:');
  console.log('   ✅ SignalWire PSTN integration');
  console.log('   ✅ OpenAI Realtime voice AI');
  console.log('   ✅ Supabase tools (lead lookup, appointments)');
  console.log('   ✅ Bidirectional audio streaming\n');
});

