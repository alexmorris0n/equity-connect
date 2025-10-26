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
    // Log WebSocket connection
    logger.info(`${CONNECTION_MESSAGES.CLIENT_CONNECTED}`);
    
    // Will capture caller ID from SignalWire's 'start' event
    let callerPhone: string | null = null;

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

      // Create agent with default inbound instructions (will update if we detect outbound)
      const sessionAgent = new RealtimeAgent({
        ...agentConfig,
        instructions: getInstructionsForCallType('inbound', {})
      });

      // Create session with SignalWire transport
      const session = new RealtimeSession(sessionAgent, {
        transport: signalWireTransportLayer,
        model: model as OpenAIRealtimeModels
      });

      // Listen to transport events to capture SignalWire's 'start' event
      session.transport.on('*', (event: TransportEvent) => {
        // Capture caller ID from SignalWire's start event
        if (event.type === 'twilio_message') {
          const twilioEvent = (event as any).twilioEvent;
          if (twilioEvent?.event === 'start') {
            // Extract caller phone from customParameters
            const customParams = twilioEvent.start?.customParameters || {};
            callerPhone = customParams.From || customParams.from || null;
            
            if (callerPhone) {
              logger.info(`📞 Captured caller ID from SignalWire: ${callerPhone}`);
              
              // Inject caller ID into conversation context immediately
              const systemMessage: RealtimeClientMessage = {
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'system',
                  content: [{
                    type: 'input_text',
                    text: `[SYSTEM] The caller's phone number is: ${callerPhone}. When using get_lead_context tool, pass this exact phone number.`
                  }]
                }
              } as any;
              
              signalWireTransportLayer.sendEvent(systemMessage);
              logger.info(`✅ Caller ID injected into conversation`);
            }
          }
        }
        
        switch (event.type) {
          case EVENT_TYPES.RESPONSE_DONE:
            // Extract Barbara's transcript from response.done
            const response = (event as any).response;
            const output = response?.output || [];
            
            // Find the audio message with transcript
            const audioMessage = output.find((item: any) => 
              item.type === 'message' && 
              item.role === 'assistant' && 
              item.content?.some((c: any) => c.type === 'audio' && c.transcript)
            );
            
            if (audioMessage) {
              const audioContent = audioMessage.content.find((c: any) => c.type === 'audio');
              const transcript = audioContent?.transcript || '';
              logger.info(`💬 Barbara: "${transcript}"`);
            }
            
            logger.event('🤖', 'AI response completed');
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
      
      // Note: Caller ID will be injected when SignalWire sends the 'start' event
      
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

