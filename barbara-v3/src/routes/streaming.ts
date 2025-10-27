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
import { setCurrentSessionId, setTranscript, clearTranscript, setPromptMetadata, getCurrentPromptMetadata } from '../services/transcript-store.js';

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
    let promptVersionId: string | null = null; // Track prompt version for evaluation
    let promptVersionNumber: number | null = null;
    let promptCallType: string | null = null;
    
    // Conversation transcript tracking (for save_interaction)
    const conversationTranscript: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
      itemId?: string;
      responseId?: string;
    }> = [];
    
    // Per-turn accumulator buffers (for delta streaming)
    const userTurnCache = new Map<string, string>();
    const botTurnCache = new Map<string, string>();
    
    // Register transcript with store for tool access
    setTranscript(sessionId, conversationTranscript);

    // Track if save_interaction was already called
    let interactionSaved = false;

    // Handle disconnection
    connection.on('close', async () => {
      logger.info(CONNECTION_MESSAGES.CLIENT_DISCONNECTED);
      
      // If Barbara didn't call save_interaction before disconnect, save it now
      if (!interactionSaved && conversationTranscript.length > 0) {
        logger.warn(`⚠️ Call ended without save_interaction - user likely hung up abruptly`);
        logger.info(`📊 Auto-saving interaction and triggering evaluation for ${conversationTranscript.length} messages`);
        
        // Import required services
        const { getSupabaseClient } = await import('../services/supabase.js');
        const { evaluateCall } = await import('../services/call-evaluation.service.js');
        const promptMeta = getCurrentPromptMetadata();
        
        try {
          const sb = getSupabaseClient();
          
          // Determine call duration (rough estimate from transcript timestamps)
          const firstMessage = conversationTranscript[0];
          const lastMessage = conversationTranscript[conversationTranscript.length - 1];
          let durationSeconds = null;
          if (firstMessage?.timestamp && lastMessage?.timestamp) {
            const start = new Date(firstMessage.timestamp).getTime();
            const end = new Date(lastMessage.timestamp).getTime();
            durationSeconds = Math.round((end - start) / 1000);
          }
          
          // Build interaction metadata
          const interactionMetadata = {
            ai_agent: 'barbara',
            version: '3.0',
            conversation_transcript: conversationTranscript,
            prompt_version_id: promptMeta?.prompt_version_id || null,
            prompt_version_number: promptMeta?.prompt_version_number || null,
            prompt_call_type: promptMeta?.prompt_call_type || null,
            prompt_source: promptMeta?.prompt_source || 'unknown',
            auto_saved: true, // Flag to indicate this was auto-saved on disconnect
            disconnect_reason: 'user_hangup_before_save_interaction',
            saved_at: new Date().toISOString()
          };
          
          // Save interaction to Supabase
          const { data, error } = await sb
            .from('interactions')
            .insert({
              lead_id: leadId || null,
              broker_id: brokerId || null,
              type: 'ai_call',
              direction: callDirection || 'inbound',
              content: `Auto-saved: Call ended abruptly after ${conversationTranscript.length} messages (${durationSeconds}s)`,
              duration_seconds: durationSeconds,
              outcome: 'negative', // Assume negative if they hung up early
              metadata: interactionMetadata,
              created_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (error) {
            logger.error('Failed to auto-save interaction on disconnect:', error);
          } else {
            logger.info(`✅ Auto-saved interaction: ${data.id}`);
            
            // Trigger evaluation in background
            const promptVersion = promptMeta?.prompt_version_id 
              ? `${promptMeta.prompt_call_type}-v${promptMeta.prompt_version_number}` 
              : 'hardcoded';
            
            evaluateCall(data.id, conversationTranscript, promptVersion)
              .catch(evalError => {
                logger.error('Failed to evaluate auto-saved call:', evalError);
              });
            
            logger.info(`📊 Triggered evaluation for abrupt disconnect (interaction: ${data.id})`);
          }
        } catch (error) {
          logger.error('Error in disconnect auto-save handler:', error);
        }
      }
      
      // Cleanup transcript from store
      clearTranscript(sessionId);
      logger.info(`🧹 Cleaned up transcript for session: ${sessionId}`);
    });

    // Handle errors
    connection.on('error', (error) => {
      logger.error(`${ERROR_MESSAGES.CONNECTION_ERROR}:`, error.message);
    });

    try {
      // Create SignalWire transport layer first
      const signalWireTransportLayer = new SignalWireCompatibilityTransportLayer({
        signalWireWebSocket: connection,
        audioFormat: AGENT_CONFIG.audioFormat
      });

      // Wait for the 'start' event to get call context BEFORE creating session
      const startEventPromise = new Promise<any>((resolve) => {
        connection.addEventListener('message', (event: any) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'start') {
              resolve(data);
            }
          } catch (err) {
            // Ignore parse errors (binary audio data)
          }
        });
      });

      // Wait up to 2 seconds for start event (should arrive in ~50ms)
      const startData = await Promise.race([
        startEventPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
      ]);

      if (startData) {
        logger.info(`📡 SignalWire 'start' event received`);
        
        // Extract call context from customParameters
        const customParams = startData.start?.customParameters || {};
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
      } else {
        logger.warn(`⚠️ No 'start' event received within 2s, defaulting to inbound`);
      }

      // NOW load the correct prompt based on call direction
      logger.info(`📝 Loading prompt for ${callDirection} call`);
      const promptMetadata = await getInstructionsForCallType(callDirection, {
        leadId: leadId || undefined,
        brokerId: brokerId || undefined,
        from: fromPhone || undefined,
        to: toPhone || undefined
      });

      // Store prompt metadata for evaluation tracking
      promptVersionId = promptMetadata.prompt_version_id || null;
      promptVersionNumber = promptMetadata.version_number || null;
      promptCallType = promptMetadata.call_type;
      
      // Save to transcript store so save_interaction can access it
      setPromptMetadata(sessionId, {
        prompt_version_id: promptMetadata.prompt_version_id || null,
        prompt_version_number: promptMetadata.version_number || null,
        prompt_call_type: promptMetadata.call_type,
        prompt_source: promptMetadata.source
      });
      
      logger.info(`✅ Loaded prompt: ${promptCallType} v${promptVersionNumber || 'hardcoded'} (${promptMetadata.source})`);
      logger.info(`🎙️ Voice: ${promptMetadata.voice || 'shimmer'}`);
      logger.info(`🎛️ VAD: threshold=${promptMetadata.vad_threshold || 0.5}, padding=${promptMetadata.vad_prefix_padding_ms || 300}ms, silence=${promptMetadata.vad_silence_duration_ms || 500}ms`);

      // Create agent with the CORRECT prompt loaded from the start
      const sessionAgent = new RealtimeAgent({
        ...agentConfig,
        instructions: promptMetadata.prompt,
        voice: promptMetadata.voice || 'shimmer'
      });

      // Create session with SignalWire transport
      const session = new RealtimeSession(sessionAgent, {
        transport: signalWireTransportLayer,
        model: model as OpenAIRealtimeModels
      });
      
      // Store conversation transcript reference in session for tool access
      (session as any).conversationTranscript = conversationTranscript;

      // Listen to transport events to inject call context when available
      session.transport.on('*', async (event: TransportEvent) => {
        // Filter out noisy media events to prevent log flooding
        const eventData = event as any;
        if (eventData.message?.type === 'twilio_message' && eventData.message?.event === 'media') {
          return; // Skip logging raw audio chunks
        }
        
        // ---- USER (Caller) transcript events ----
        if (event.type === 'conversation.item.input_audio_transcription.completed') {
          const itemId = (event as any).item_id || (event as any).item?.id;
          const transcriptText = (event as any).transcript || (event as any).item?.content?.[0]?.transcript || '';
          
          if (transcriptText) {
            conversationTranscript.push({
              role: 'user',
              content: transcriptText,
              timestamp: new Date().toISOString(),
              itemId
            });
            // ✅ ALWAYS log user transcript (important)
            logger.info(`💬 User: "${transcriptText}"`);
          }
        }
        
        // ---- BARBARA (Assistant) transcript events ----
        // Accumulate deltas as they stream in (NO LOGGING - too noisy)
        if (event.type === 'response.output_audio_transcript.delta') {
          const responseId = (event as any).response_id;
          const delta = (event as any).delta || '';
          if (responseId && delta) {
            botTurnCache.set(responseId, (botTurnCache.get(responseId) || '') + delta);
          }
        }
        
        // Finalize on done (LOG ONLY THE COMPLETE TEXT)
        if (event.type === 'response.output_audio_transcript.done') {
          const responseId = (event as any).response_id;
          if (responseId) {
            const fullText = (botTurnCache.get(responseId) || '').trim();
            botTurnCache.delete(responseId);
            
            if (fullText) {
              conversationTranscript.push({
                role: 'assistant',
                content: fullText,
                timestamp: new Date().toISOString(),
                responseId
              });
              // ✅ ALWAYS log Barbara's complete response (important)
              logger.info(`🤖 Barbara: "${fullText}"`);
            }
          }
        }
        
        // ---- Fallback for non-TTS text-only responses ----
        if (event.type === 'response.output_text.delta') {
          const responseId = (event as any).response_id;
          const delta = (event as any).delta || '';
          if (responseId && delta) {
            botTurnCache.set(responseId, (botTurnCache.get(responseId) || '') + delta);
          }
        }
        
        if (event.type === 'response.output_text.done') {
          const responseId = (event as any).response_id;
          if (responseId) {
            const fullText = (botTurnCache.get(responseId) || '').trim();
            botTurnCache.delete(responseId);
            
            if (fullText) {
              conversationTranscript.push({
                role: 'assistant',
                content: fullText,
                timestamp: new Date().toISOString(),
                responseId
              });
              logger.info(`🤖 Barbara (text): "${fullText}"`);
            }
          }
        }
        
        // ---- Handle interruptions (barge-in) ----
        if (event.type === 'response.cancelled') {
          const responseId = (event as any).response_id;
          if (responseId) {
            botTurnCache.delete(responseId);
            logger.info('🚫 User interrupted Barbara');
          }
        }
        
        // Handle transcription failures (important to know)
        if (event.type === 'conversation.item.input_audio_transcription.failed') {
          logger.error('❌ Audio transcription failed:', event);
        }
        
        // Enable input audio transcription after session is connected
        if (event.type === 'session.created' || event.type === 'session.updated') {
          // Send session update to enable transcription and VAD with settings from prompt
          const updateEvent: RealtimeClientMessage = {
            type: 'session.update',
            session: {
              turn_detection: {
                type: 'server_vad',
                threshold: promptMetadata.vad_threshold || 0.5,
                prefix_padding_ms: promptMetadata.vad_prefix_padding_ms || 300,
                silence_duration_ms: promptMetadata.vad_silence_duration_ms || 500
              },
              input_audio_transcription: {
                model: 'whisper-1'
              }
            }
          } as any;
          
          signalWireTransportLayer.sendEvent(updateEvent);
          logger.info('✅ Enabled input audio transcription + server VAD');
        }
        
        // If we have phone numbers and haven't injected yet, inject context now
        if (fromPhone && toPhone && event.type === 'session.updated') {
          logger.info(`💉 Injecting call context into conversation`);
          
          // Determine which phone number is the lead based on call direction
          // Inbound: lead is calling us (FROM)
          // Outbound: we are calling the lead (TO)
          const leadPhone = callDirection === 'outbound' ? toPhone : fromPhone;
          
          logger.info(`📞 Lead phone number for lookup: ${leadPhone}`);
          
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
        }
        
        switch (event.type) {
          case EVENT_TYPES.RESPONSE_DONE:
            logger.event('✅', 'AI response completed');
            break;

          case EVENT_TYPES.TRANSCRIPTION_COMPLETED:
            // Handled above in dedicated event listener
            logger.event('🎤', 'User transcription completed');
            break;

          default:
            // All other events are silently handled or ignored
            // We already log what matters: user transcripts, Barbara responses, errors
            break;
        }
      });

      // Listen to session events for tool calls
      session.on('agent_tool_start', (context, agent, tool, details) => {
        logger.event('🔧', 'Tool call started', details);
        
        // Track if save_interaction is called (check tool name from details or tool object)
        const toolName = (details as any)?.name || (details as any)?.toolCall?.name || tool?.name;
        if (toolName === 'save_interaction') {
          interactionSaved = true;
          logger.info('✅ save_interaction called - evaluation will be triggered by tool');
        }
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

