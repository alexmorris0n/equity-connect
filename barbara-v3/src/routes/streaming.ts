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
import { getInstructionsForCallType } from '../services/prompts.js';

export async function streamingRoute(
  fastify: FastifyInstance,
  options: StreamingOptions
) {
  const { agentConfig, openaiApiKey, model } = options;
  const realtimeAgent = new RealtimeAgent(agentConfig);

  fastify.get('/media-stream', { websocket: true }, async (connection: WebSocket, request: any) => {
    // For now, default to inbound (we'll add direction detection later)
    const direction = 'inbound';
    
    logger.info(`${CONNECTION_MESSAGES.CLIENT_CONNECTED}`);

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

      // Create agent with dynamic instructions based on call direction
      const sessionAgent = new RealtimeAgent({
        ...agentConfig,
        instructions: getInstructionsForCallType(direction, {})
      });

      // Create session with SignalWire transport
      const session = new RealtimeSession(sessionAgent, {
        transport: signalWireTransportLayer,
        model: model as OpenAIRealtimeModels
      });

      // Capture caller ID from SignalWire start event
      let callerPhone = '';
      
      // Listen to transport events
      session.transport.on('*', (event: TransportEvent) => {
        // Capture SignalWire stream start metadata
        if (event.type === 'twilio_message' && (event as any).message?.event === 'start') {
          const startData = (event as any).message?.start;
          if (startData?.customParameters) {
            callerPhone = startData.customParameters.From || '';
            logger.info(`📞 Caller ID captured: ${callerPhone}`);
            
            // Inject caller phone into session context
            if (callerPhone) {
              // Add system message with caller phone
              const systemMessage: RealtimeClientMessage = {
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'system',
                  content: [{
                    type: 'input_text',
                    text: `[SYSTEM] The caller's phone number is: ${callerPhone}. When using get_lead_context tool, pass this phone number.`
                  }]
                }
              } as any;
              
              signalWireTransportLayer.sendEvent(systemMessage);
              logger.info(`✅ Injected caller ID into conversation: ${callerPhone}`);
            }
          }
        }
        
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

      // TODO: Inject caller ID into conversation context
      // For now, Barbara will need to ask or we'll add metadata injection
      
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

