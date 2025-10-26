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
    
    // Will capture call context from SignalWire's 'start' event
    let fromPhone: string | null = null;  // Who is calling FROM
    let toPhone: string | null = null;    // Who is being called TO
    let callDirection: string = 'inbound'; // default to inbound
    let leadId: string | null = null;
    let brokerId: string | null = null;

    // Handle disconnection
    connection.on('close', () => {
      logger.info(CONNECTION_MESSAGES.CLIENT_DISCONNECTED);
    });

    // Handle errors
    connection.on('error', (error) => {
      logger.error(`${ERROR_MESSAGES.CONNECTION_ERROR}:`, error.message);
    });

    try {
      // Listen directly to raw WebSocket for SignalWire's 'start' event (before transport layer processes it)
      connection.addEventListener('message', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'start') {
            logger.info(`📡 SignalWire 'start' event received (RAW)`);
            
            // Extract call context from customParameters
            const customParams = data.start?.customParameters || {};
            fromPhone = customParams.From || customParams.from || null;
            toPhone = customParams.To || customParams.to || null;
            callDirection = customParams.direction || 'inbound';
            leadId = customParams.lead_id || null;
            brokerId = customParams.broker_id || null;
            
            logger.info(`📞 Call direction: ${callDirection}`);
            logger.info(`📞 From: ${fromPhone}, To: ${toPhone}`);
            
            if (leadId) {
              logger.info(`👤 Lead ID: ${leadId}`);
            }
            if (brokerId) {
              logger.info(`🏢 Broker ID: ${brokerId}`);
            }
          }
        } catch (err) {
          // Ignore parse errors (binary audio data)
        }
      });
      
      // Create SignalWire transport layer
      const signalWireTransportLayer = new SignalWireCompatibilityTransportLayer({
        signalWireWebSocket: connection,
        audioFormat: AGENT_CONFIG.audioFormat
      });

      // Create agent with default inbound instructions (will update when we detect direction from 'start' event)
      const sessionAgent = new RealtimeAgent({
        ...agentConfig,
        instructions: getInstructionsForCallType('inbound', {})
      });

      // Create session with SignalWire transport
      const session = new RealtimeSession(sessionAgent, {
        transport: signalWireTransportLayer,
        model: model as OpenAIRealtimeModels
      });

      // Listen to transport events to inject call context when available
      session.transport.on('*', (event: TransportEvent) => {
        // If we have phone numbers and haven't injected yet, inject context now
        if (fromPhone && toPhone && event.type === 'session.updated') {
          logger.info(`💉 Injecting call context into conversation`);
          
          // Determine which phone number is the lead based on call direction
          // Inbound: lead is calling us (FROM)
          // Outbound: we are calling the lead (TO)
          const leadPhone = callDirection === 'outbound' ? toPhone : fromPhone;
          
          logger.info(`📞 Lead phone number for lookup: ${leadPhone}`);
          
          // Update agent instructions based on call direction
          const updatedInstructions = getInstructionsForCallType(callDirection, {
            leadId: leadId || undefined,
            brokerId: brokerId || undefined,
            from: fromPhone,
            to: toPhone
          });
          
          logger.info(`📝 Updated prompt for ${callDirection} call`);
          
          // Inject lead phone context as system message
          const systemMessage: RealtimeClientMessage = {
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'system',
              content: [{
                type: 'input_text',
                text: `[SYSTEM] The lead's phone number is: ${leadPhone}. When using get_lead_context tool, pass this exact phone number.`
              }]
            }
          } as any;
          
          signalWireTransportLayer.sendEvent(systemMessage);
          logger.info(`✅ Lead context injected successfully`);
          
          // NOW trigger the initial AI greeting AFTER context is injected
          try {
            const responseEvent: RealtimeClientMessage = { type: 'response.create' } as RealtimeClientMessage;
            signalWireTransportLayer.sendEvent(responseEvent);
            logger.info(`👋 Triggered initial AI greeting for ${callDirection} call`);
          } catch (error) {
            logger.debug('AI greeting trigger failed (non-fatal)');
          }
          
          // Clear phones so we don't inject twice
          fromPhone = null;
          toPhone = null;
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
      
      // Note: Initial greeting will be triggered when SignalWire sends 'start' event with caller ID

    } catch (error) {
      logger.error(ERROR_MESSAGES.TRANSPORT_INIT_FAILED, error);
    }
  });
}

