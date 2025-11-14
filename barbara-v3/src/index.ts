/**
 * Barbara Voice Assistant V3
 * 
 * ⚠️ DEPRECATED: This service is deprecated. The active agent is now `equity_connect/agent/barbara_agent.py`
 * using SignalWire SDK's native agent framework. This file is kept for historical reference only.
 * 
 * SignalWire + OpenAI Realtime API Integration
 * 
 * Flow:
 * 1. Phone call → SignalWire webhook (/incoming-call)
 * 2. Return cXML with <Stream> instruction
 * 3. SignalWire connects to WebSocket (/media-stream)
 * 4. Audio forwarded to OpenAI Realtime API via TwilioRealtimeTransportLayer
 * 5. AI responses stream back to caller in real-time
 */

import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import formbody from '@fastify/formbody';
import cors from '@fastify/cors';
import type { RealtimeAgentConfiguration } from '@openai/agents/realtime';
import { OPENAI_API_KEY, SERVER_CONFIG, AGENT_CONFIG } from './config.js';
import { allTools } from './tools/index.js';
import { webhookRoute } from './routes/webhook.js';
import { streamingRoute } from './routes/streaming.js';
import { healthRoute } from './routes/health.js';
import { apiRoutes } from './routes/api.js';
import { smsRoute } from './routes/sms.js';
import { logger } from './utils/logger.js';
import { CONNECTION_MESSAGES } from './constants.js';

// ============================================================================
// AI Agent Configuration
// ============================================================================

const agentConfig: RealtimeAgentConfiguration = {
  name: AGENT_CONFIG.name,
  instructions: AGENT_CONFIG.instructions,
  tools: allTools,
  voice: AGENT_CONFIG.voice,
};

// ============================================================================
// Server Setup
// ============================================================================

async function createServer() {
  const fastify = Fastify({
    logger: false // Using custom logger
  });

  // Register plugins
  await fastify.register(cors, {
    origin: true, // Allow all origins in development (configure for production)
    credentials: true
  });
  await fastify.register(formbody);
  await fastify.register(websocket);

  // Register routes
  await fastify.register(healthRoute);
  await fastify.register(webhookRoute);
  await fastify.register(apiRoutes);
  await fastify.register(smsRoute);
  await fastify.register(async (scopedFastify) => {
    await streamingRoute(scopedFastify, {
      agentConfig,
      openaiApiKey: OPENAI_API_KEY,
      model: AGENT_CONFIG.model
    });
  });

  return fastify;
}

// ============================================================================
// Server Startup
// ============================================================================

async function startServer() {
  let fastify: FastifyInstance | undefined;

  try {
    fastify = await createServer();

    await fastify.listen({
      port: SERVER_CONFIG.port,
      host: SERVER_CONFIG.host
    });

    logger.section(CONNECTION_MESSAGES.SERVER_STARTED, [
      `📡 Server: http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`,
      `🏥 Health: http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}/health`,
      `🔊 Audio: ${AGENT_CONFIG.audioFormat} (${AGENT_CONFIG.audioFormat === 'pcm16' ? '24kHz HD' : '8kHz telephony'})`,
      `🎙️  Voice: ${AGENT_CONFIG.voice}`,
      `🤖 Model: ${AGENT_CONFIG.model}`,
      CONNECTION_MESSAGES.SERVER_READY
    ]);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info(`\n${CONNECTION_MESSAGES.SHUTTING_DOWN}`);
      try {
        if (fastify) {
          await fastify.close();
        }
        logger.info(CONNECTION_MESSAGES.SERVER_CLOSED);
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start Barbara!
startServer();

