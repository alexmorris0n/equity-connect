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

// Register WebSocket support
app.register(fastifyWebsocket);

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
    env: NODE_ENV
  };
  
  return reply.code(200).send(health);
});

/**
 * LaML XML Endpoint for Inbound Calls
 * SignalWire calls this when an inbound call arrives
 */
app.get('/public/inbound-xml', async (request, reply) => {
  const { From, To } = request.query || {};
  const wsUrl = BRIDGE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
  
  fastify.log.info({ From, To }, '📞 Inbound call XML requested');
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}/audiostream" codec="L16@24000h">
      <Parameter name="track" value="both_tracks" />
      <Parameter name="silenceDetection" value="false" />
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
  const { callId } = request.query;
  
  // Include callId in WebSocket URL so we can retrieve context
  const streamUrl = callId 
    ? `${wsUrl}/audiostream?callId=${callId}`
    : `${wsUrl}/audiostream`;
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" codec="L16@24000h">
      <Parameter name="track" value="both_tracks" />
      <Parameter name="silenceDetection" value="false" />
    </Stream>
  </Connect>
</Response>`;

  app.log.info({ callId }, '📞 Served outbound LaML XML');
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
 * WebSocket Audio Stream Handler
 * Handles bidirectional audio between SignalWire and OpenAI Realtime
 */
app.register(async function (fastify) {
  fastify.get('/audiostream', { websocket: true }, async (connection, req) => {
    // In @fastify/websocket, connection IS the WebSocket
    const swSocket = connection;
    const { callId } = req.query;
    
    app.log.info({ 
      callId,
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
    
    if (callId && pendingCalls.has(callId)) {
      callContext = pendingCalls.get(callId);
      app.log.info({ 
        callId, 
        lead_id: callContext.lead_id,
        hasInstructions: !!callContext.instructions 
      }, '📋 Retrieved call context from n8n');
      
      // Clean up pending call after retrieval
      pendingCalls.delete(callId);
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

