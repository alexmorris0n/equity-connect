/**
 * Real-time Audio Streaming Route
 * WebSocket endpoint for SignalWire ↔ OpenAI bridge
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import {
  RealtimeAgent,
  RealtimeSession,
  type OpenAIRealtimeModels,
  type RealtimeClientMessage,
  type TransportEvent
} from '@openai/agents/realtime';
import { SignalWireCompatibilityTransportLayer } from '../transports/SignalWireCompatibilityTransportLayer.js';
import { logger } from '../utils/logger.js';
import { CONNECTION_MESSAGES, ERROR_MESSAGES, EVENT_TYPES } from '../constants.js';
import type { StreamingOptions } from '../types/index.js';
import { AGENT_CONFIG, SERVER_CONFIG } from '../config.js';

export async function streamingRoute(
  fastify: FastifyInstance,
  options: StreamingOptions
) {
  const { agentConfig, openaiApiKey, model } = options;
  const realtimeAgent = new RealtimeAgent(agentConfig);

  fastify.get('/media-stream', { websocket: true }, async (connection: WebSocket) => {
    logger.info(CONNECTION_MESSAGES.CLIENT_CONNECTED);

    // Handle disconnection
    connection.on('close', () => {
      logger.info(CONNECTION_MESSAGES.CLIENT_DISCONNECTED);
    });

    // Handle errors
    connection.on('error', (error) => {
      logger.error(`${ERROR_MESSAGES.CONNECTION_ERROR}:`, error.message);
    });

    try {
      // Create SignalWire transport layer
      const signalWireTransportLayer = new SignalWireCompatibilityTransportLayer({
        signalWireWebSocket: connection,
        audioFormat: AGENT_CONFIG.audioFormat
      });

      // Create session with SignalWire transport
      const session = new RealtimeSession(realtimeAgent, {
        transport: signalWireTransportLayer,
        model: model as OpenAIRealtimeModels
      });

      // Listen to transport events
      session.transport.on('*', (event: TransportEvent) => {
        switch (event.type) {
          case EVENT_TYPES.RESPONSE_DONE:
            logger.event('🤖', 'AI response completed', event);
            break;

          case EVENT_TYPES.TRANSCRIPTION_COMPLETED:
            logger.event('🎤', 'User transcription completed', event);
            break;

          default:
            // Only log raw transport events in debug mode
            if (SERVER_CONFIG.logLevel === 'debug') {
              logger.debug('Transport event:', event);
            }
        }
      });

      // Listen to session events for tool calls
      session.on('agent_tool_start', (context, agent, tool, details) => {
        logger.event('🔧', 'Tool call started', details);
      });

      session.on('agent_tool_end', (context, agent, tool, result, details) => {
        logger.event('✅', 'Tool call completed', details);
      });

      // Handle errors
      session.on('error', (error: { type: 'error'; error: unknown }) => {
        logger.error(ERROR_MESSAGES.SESSION_ERROR, error);
      });

      // Connect to OpenAI Realtime API
      await session.connect({
        apiKey: openaiApiKey
      });

      logger.info('✅ OpenAI Realtime API connected');

      // Trigger initial AI greeting
      try {
        const responseEvent: RealtimeClientMessage = { type: 'response.create' } as RealtimeClientMessage;
        signalWireTransportLayer.sendEvent(responseEvent);
        logger.info('👋 Triggered initial AI greeting');
      } catch (error) {
        logger.debug('AI greeting trigger failed (non-fatal)');
      }

    } catch (error) {
      logger.error(ERROR_MESSAGES.TRANSPORT_INIT_FAILED, error);
    }
  });
}

