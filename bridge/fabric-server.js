/**
 * SignalWire Fabric + OpenAI Realtime Server
 * 
 * Main entry point for the hybrid architecture:
 * - SWAIG HTTP server (port 8081) for tool calls from Fabric
 * - Fabric bridge for managing calls with OpenAI Realtime
 * - MCP servers remain unchanged (for n8n integration)
 * 
 * This replaces the old WebSocket-based bridge with production-grade Fabric infrastructure.
 */

require('dotenv').config();
const FabricBridge = require('./fabric-bridge');
const { app: swaigApp } = require('./swaig-server');
const { initSupabase } = require('./tools');
const pino = require('pino');

// Configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const SWAIG_PORT = process.env.SWAIG_PORT || 8081;
const FABRIC_PORT = process.env.FABRIC_PORT || 8080;

// Validate required environment variables
const requiredEnvVars = [
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SW_PROJECT',
  'SW_TOKEN',
  'SW_SPACE'
];

const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Initialize logger
const logger = pino({
  level: NODE_ENV === 'development' ? 'info' : 'warn',
  transport: NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

// Initialize Supabase
try {
  initSupabase();
  logger.info('✅ Supabase client initialized');
} catch (err) {
  logger.error({ err }, '❌ Failed to initialize Supabase');
  process.exit(1);
}

// Track active calls
const activeCalls = new Map();

/**
 * Initialize SignalWire Voice Client for Fabric
 */
async function initializeFabricClient() {
  try {
    const { SignalWire } = require('@signalwire/realtime-api');
    
    const client = await SignalWire({ 
      project: process.env.SW_PROJECT,
      token: process.env.SW_TOKEN
    });
    
    const voiceClient = client.voice;

    logger.info('✅ SignalWire Fabric client initialized');

    // Listen for incoming calls
    voiceClient.on('call.received', async (call) => {
      logger.info({
        callId: call.id,
        from: call.from,
        to: call.to
      }, '📞 Incoming Fabric call');

      try {
        // Answer the call
        await call.answer();
        logger.info({ callId: call.id }, '✅ Call answered');

        // Create bridge context
        const callContext = {
          call_id: call.id,
          from_phone: call.from,
          to_phone: call.to,
          context: 'inbound',
          lead_id: null, // Will be looked up by bridge
          broker_id: null
        };

        // Create and connect bridge
        const bridge = new FabricBridge(call, logger, callContext);
        activeCalls.set(call.id, bridge);

        await bridge.connect();
        logger.info({ callId: call.id }, '✅ Fabric bridge established');

      } catch (err) {
        logger.error({ err, callId: call.id }, '❌ Failed to handle incoming call');
        try {
          await call.hangup();
        } catch (hangupErr) {
          logger.error({ err: hangupErr }, '❌ Failed to hangup call');
        }
      }
    });

    // Listen for call state changes
    voiceClient.on('call.ended', (call) => {
      logger.info({ callId: call.id }, '📞 Call ended');
      activeCalls.delete(call.id);
    });

    voiceClient.on('error', (err) => {
      logger.error({ err }, '❌ Voice client error');
    });

    return voiceClient;

  } catch (err) {
    logger.error({ err }, '❌ Failed to initialize Fabric client');
    throw err;
  }
}

/**
 * Create outbound call via Fabric
 */
async function createOutboundCall(voiceClient, { to, from, lead_id, broker_id, instructions }) {
  try {
    logger.info({ to, from, lead_id }, '📞 Creating outbound Fabric call');

    const call = await voiceClient.dialPhone({
      to,
      from,
      timeout: 60
    });

    logger.info({ callId: call.id }, '✅ Outbound call created');

    // Create bridge context with custom instructions
    const callContext = {
      call_id: call.id,
      from_phone: from,
      to_phone: to,
      context: 'outbound',
      lead_id,
      broker_id,
      instructions: instructions || null
    };

    // Create and connect bridge
    const bridge = new FabricBridge(call, logger, callContext);
    activeCalls.set(call.id, bridge);

    await bridge.connect();
    logger.info({ callId: call.id }, '✅ Outbound bridge established');

    return {
      success: true,
      call_id: call.id,
      from,
      to
    };

  } catch (err) {
    logger.error({ err, to, from }, '❌ Failed to create outbound call');
    throw err;
  }
}

/**
 * Start SWAIG HTTP server
 */
function startSwaigServer() {
  return new Promise((resolve, reject) => {
    const server = swaigApp.listen(SWAIG_PORT, '0.0.0.0', (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log('\n🚀 SWAIG HTTP Server Started\n');
      console.log(`   Port: ${SWAIG_PORT}`);
      console.log(`   Health: http://localhost:${SWAIG_PORT}/healthz`);
      console.log(`   Signature: POST http://localhost:${SWAIG_PORT}/swaig`);
      console.log(`   Functions: 9 tools available\n`);
      
      resolve(server);
    });
  });
}

/**
 * Health check endpoint for Fabric service
 */
const express = require('express');
const healthApp = express();

healthApp.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Fabric Bridge',
    timestamp: new Date().toISOString(),
    activeCalls: activeCalls.size,
    environment: NODE_ENV
  });
});

healthApp.get('/api/active-calls', (req, res) => {
  const calls = Array.from(activeCalls.entries()).map(([callId, bridge]) => ({
    call_id: callId,
    lead_id: bridge.callContext.lead_id,
    broker_id: bridge.callContext.broker_id,
    duration_seconds: Math.floor((Date.now() - bridge.callStartTime) / 1000),
    context: bridge.callContext.context
  }));

  res.json({
    success: true,
    active_count: calls.length,
    calls
  });
});

/**
 * Outbound call endpoint (for n8n)
 */
healthApp.post('/api/outbound-call', express.json(), async (req, res) => {
  // Check authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false,
      message: 'Missing or invalid authorization header'
    });
  }

  const token = authHeader.substring(7);
  if (token !== process.env.BRIDGE_API_KEY) {
    return res.status(401).json({ 
      success: false,
      message: 'Invalid API key'
    });
  }

  const { to_phone, lead_id, broker_id, instructions } = req.body;

  if (!to_phone || !lead_id) {
    return res.status(400).json({ 
      success: false,
      message: 'Missing required fields: to_phone, lead_id'
    });
  }

  try {
    // Get broker phone number from Supabase
    const sb = initSupabase();
    const { data: broker } = await sb
      .from('brokers')
      .select('phone')
      .eq('id', broker_id)
      .single();

    if (!broker || !broker.phone) {
      return res.status(400).json({
        success: false,
        message: 'Broker phone number not found'
      });
    }

    const result = await createOutboundCall(global.voiceClient, {
      to: to_phone,
      from: broker.phone,
      lead_id,
      broker_id,
      instructions
    });

    res.json(result);

  } catch (err) {
    logger.error({ err, to_phone, lead_id }, '❌ Failed to create outbound call');
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

function startHealthServer() {
  return new Promise((resolve, reject) => {
    const server = healthApp.listen(FABRIC_PORT, '0.0.0.0', (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log('🚀 Fabric Bridge Server Started\n');
      console.log(`   Port: ${FABRIC_PORT}`);
      console.log(`   Health: http://localhost:${FABRIC_PORT}/healthz`);
      console.log(`   Active Calls: http://localhost:${FABRIC_PORT}/api/active-calls`);
      console.log(`   Outbound: POST http://localhost:${FABRIC_PORT}/api/outbound-call\n`);
      
      resolve(server);
    });
  });
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\n🛑 Shutting down gracefully...');
  
  // Close all active calls
  console.log(`Closing ${activeCalls.size} active calls`);
  for (const [callId, bridge] of activeCalls.entries()) {
    try {
      bridge.cleanup();
    } catch (err) {
      logger.error({ err, callId }, 'Error cleaning up call');
    }
  }
  activeCalls.clear();
  
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

/**
 * Main startup
 */
async function main() {
  try {
    console.log('\n🚀 SignalWire Fabric + OpenAI Realtime Bridge\n');
    console.log(`   Environment: ${NODE_ENV}`);
    console.log(`   SWAIG Port: ${SWAIG_PORT}`);
    console.log(`   Fabric Port: ${FABRIC_PORT}\n`);

    // Start SWAIG HTTP server
    await startSwaigServer();

    // Start health/API server
    await startHealthServer();

    // Initialize Fabric voice client
    const voiceClient = await initializeFabricClient();
    global.voiceClient = voiceClient; // Make available for outbound calls

    console.log('✅ All services running!\n');
    console.log('📋 Services:');
    console.log('   ✅ SWAIG HTTP Server (tool calls from Fabric)');
    console.log('   ✅ SignalWire Fabric Client (call management)');
    console.log('   ✅ OpenAI Realtime (conversation AI)');
    console.log('   ✅ Supabase (database)');
    console.log('   ✅ PromptLayer (logging)\n');
    console.log('📞 Ready to handle calls!\n');

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Start server
main();

