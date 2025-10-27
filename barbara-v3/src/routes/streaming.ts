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
import { setCurrentSessionId, setTranscript, clearTranscript } from '../services/transcript-store.js';

export async function streamingRoute(
  fastify: FastifyInstance,
  options: StreamingOptions
) {
  const { agentConfig, openaiApiKey, model } = options;
  const realtimeAgent = new RealtimeAgent(agentConfig);

  fastify.get('/media-stream', { websocket: true }, async (connection: WebSocket, request: any) => {
    // Log WebSocket connection
    logger.info(`${CONNECTION_MESSAGES.CLIENT_CONNECTED}`);
    
    // Generate unique session ID for this call
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setCurrentSessionId(sessionId);
    logger.info(`📝 Session ID: ${sessionId}`);
    
    // Will capture call context from SignalWire's 'start' event
    let fromPhone: string | null = null;  // Who is calling FROM
    let toPhone: string | null = null;    // Who is being called TO
    let callDirection: string = 'inbound'; // default to inbound
    let leadId: string | null = null;
    let brokerId: string | null = null;
    
    // Conversation transcript tracking (for save_interaction)
    const conversationTranscript: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }> = [];
    
    // Register transcript with store for tool access
    setTranscript(sessionId, conversationTranscript);

    // Handle disconnection
    connection.on('close', () => {
      logger.info(CONNECTION_MESSAGES.CLIENT_DISCONNECTED);
      // Cleanup transcript from store
      clearTranscript(sessionId);
      logger.info(`🧹 Cleaned up transcript for session: ${sessionId}`);
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
        model: model as OpenAIRealtimeModels,
        // Enable input audio transcription to capture both user and assistant transcripts
        turnDetection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        inputAudioTranscription: {
          model: 'whisper-1'
        }
      });
      
      // Store conversation transcript reference in session for tool access
      (session as any).conversationTranscript = conversationTranscript;

      // Listen to transport events to inject call context when available
      session.transport.on('*', (event: TransportEvent) => {
        // Handle input audio transcription events (for user transcripts)
        if (event.type === 'conversation.item.input_audio_transcription.completed') {
          const transcriptText = (event as any).transcript || (event as any).item?.content?.[0]?.text;
          if (transcriptText) {
            conversationTranscript.push({
              role: 'user',
              content: transcriptText,
              timestamp: new Date().toISOString()
            });
            logger.info(`💬 User (audio transcription): "${transcriptText}"`);
          }
        }
        
        // Handle transcription failures
        if (event.type === 'conversation.item.input_audio_transcription.failed') {
          logger.error('❌ Audio transcription failed:', event);
        }
        
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
            
            // Debug: Log the structure to understand what we're getting
            if (SERVER_CONFIG.logLevel === 'debug') {
              logger.debug('RESPONSE_DONE output:', JSON.stringify(output, null, 2));
            }
            
            // Try multiple paths to find Barbara's transcript
            let barbaraTranscript = '';
            
            // Path 1: Look for audio message with transcript
            const audioMessage = output.find((item: any) => 
              item.type === 'message' && 
              item.role === 'assistant' && 
              item.content?.some((c: any) => c.type === 'audio' && c.transcript)
            );
            
            if (audioMessage) {
              const audioContent = audioMessage.content.find((c: any) => c.type === 'audio');
              barbaraTranscript = audioContent?.transcript || '';
            }
            
            // Path 2: Try alternative structure - check for text content
            if (!barbaraTranscript) {
              const textMessage = output.find((item: any) => 
                item.type === 'message' && 
                item.role === 'assistant' && 
                item.content?.some((c: any) => c.type === 'text')
              );
              if (textMessage) {
                const textContent = textMessage.content.find((c: any) => c.type === 'text');
                barbaraTranscript = textContent?.text || '';
              }
            }
            
            // Path 3: Check if transcript is directly in output
            if (!barbaraTranscript && output.length > 0) {
              for (const item of output) {
                if (item.transcript) {
                  barbaraTranscript = item.transcript;
                  break;
                }
              }
            }
            
            // Save to conversation transcript if we found anything
            if (barbaraTranscript) {
              conversationTranscript.push({
                role: 'assistant',
                content: barbaraTranscript,
                timestamp: new Date().toISOString()
              });
              logger.info(`💬 Barbara: "${barbaraTranscript}"`);
            } else {
              // Log when we can't find transcript (only in debug mode)
              if (SERVER_CONFIG.logLevel === 'debug') {
                logger.debug('⚠️  Could not extract Barbara transcript from RESPONSE_DONE');
              }
            }
            
            logger.event('🤖', 'AI response completed');
            break;

          case EVENT_TYPES.TRANSCRIPTION_COMPLETED:
            // Extract user's transcript
            const userTranscript = (event as any).transcript || '';
            
            // Save to conversation transcript
            if (userTranscript) {
              conversationTranscript.push({
                role: 'user',
                content: userTranscript,
                timestamp: new Date().toISOString()
              });
              
              logger.info(`💬 User: "${userTranscript}"`);
            }
            
            logger.event('🎤', 'User transcription completed');
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

