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
    
    // Capture caller ID from the FIRST SignalWire message (before transport processes it)
    let callerPhone = '';
    let startEventCaptured = false;
    
    // Listen to RAW WebSocket messages BEFORE transport layer
    connection.on('message', (data: any) => {
      if (startEventCaptured) return; // Only process once
      
      try {
        const message = JSON.parse(data.toString());
        
        // Look for start event
        if (message.event === 'start') {
          logger.info(`📞 RAW start event:`, JSON.stringify(message, null, 2));
          
          // Try to extract caller ID from various possible locations
          callerPhone = message.start?.customParameters?.From
                     || message.customParameters?.From
                     || message.start?.callSid?.from
                     || message.start?.from
                     || message.from
                     || '';
          
          if (callerPhone) {
            logger.info(`✅ Caller ID extracted from start event: ${callerPhone}`);
          } else {
            logger.warn(`⚠️  Start event found but no caller ID!`, message);
          }
          
          startEventCaptured = true;
        }
      } catch (e) {
        // Ignore parse errors (binary audio data)
      }
    });

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
        // DEBUG: Log ALL twilio_message events to see what SignalWire sends
        if (event.type === 'twilio_message') {
          const msg = (event as any).message;
          logger.debug(`🔍 SignalWire message:`, JSON.stringify(msg, null, 2));
          
          // Capture SignalWire stream start metadata
          if (msg?.event === 'start') {
            logger.info(`📞 Stream start event received:`, msg.start);
            
            // Try both customParameters and direct properties
            const startData = msg.start;
            callerPhone = startData?.customParameters?.From 
                       || startData?.callSid?.from 
                       || startData?.from 
                       || '';
            
            if (callerPhone) {
              logger.info(`📞 Caller ID captured: ${callerPhone}`);
              
              // Inject caller phone into session context
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
            } else {
              logger.warn(`⚠️  No caller ID found in start event!`);
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

      // Wait a moment for start event to be captured
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Inject caller ID if we captured it
      if (callerPhone) {
        logger.info(`💉 Injecting caller ID into conversation: ${callerPhone}`);
        
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
        logger.info(`✅ Caller ID injected: ${callerPhone}`);
      } else {
        logger.warn(`⚠️  No caller ID captured - Barbara will need to ask`);
      }
      
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

