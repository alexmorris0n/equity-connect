/**
 * SignalWire Fabric Bridge
 * 
 * Connects SignalWire Fabric (stable SIP/RTP telephony) to OpenAI Realtime API.
 * Replaces the unstable WebSocket-based bridge with production-grade infrastructure.
 * 
 * Architecture:
 * - SignalWire Fabric handles PSTN (inbound/outbound calls via SIP)
 * - OpenAI Realtime handles conversation AI (same as before)
 * - SWAIG endpoints handle tool calls (instead of direct MCP)
 * - Supabase, PromptLayer, Nylas remain unchanged
 */

const WebSocket = require('ws');
const { Voice } = require('@signalwire/realtime-api');
const { getPromptForCall, injectVariables, determinePromptName } = require('./prompt-manager');
const { initSupabase } = require('./tools');
const fs = require('fs');
const path = require('path');

// Debug logging control
const ENABLE_DEBUG_LOGGING = process.env.ENABLE_DEBUG_LOGGING === 'true';

const debug = (...args) => {
  if (ENABLE_DEBUG_LOGGING) {
    console.log(...args);
  }
};

// Safe prompt loader with fallback
let BARBARA_PROMPT = '';
function loadPromptSafe() {
  if (BARBARA_PROMPT) return BARBARA_PROMPT;
  
  const candidates = [
    '../prompts/old big buitifl promtp.md',
    '../prompts/Prompt31_Master.md',
    '../prompts/BarbaraRealtimePrompt.md',
    '../prompts/Archived/BarbaraRealtimePrompt.md'
  ];
  
  for (const rel of candidates) {
    try {
      const p = path.join(__dirname, rel);
      BARBARA_PROMPT = fs.readFileSync(p, 'utf8');
      console.log('📝 Loaded prompt:', rel, 'length:', BARBARA_PROMPT.length);
      return BARBARA_PROMPT;
    } catch (err) {
      // Try next candidate
    }
  }
  
  console.warn('⚠️ No prompt file found - using minimal fallback');
  BARBARA_PROMPT = "You are Barbara, a warm scheduling assistant. Keep responses short and friendly.";
  return BARBARA_PROMPT;
}

/**
 * Fabric Bridge - Connects Fabric calls to OpenAI Realtime
 */
class FabricBridge {
  constructor(fabricCall, logger, callContext = {}) {
    this.fabricCall = fabricCall; // SignalWire Voice Call object
    this.logger = logger;
    this.callContext = callContext;
    this.openaiSocket = null;
    this.sessionConfigured = false;
    this.callStartTime = Date.now();
    this.greetingSent = false;
    
    // Transcript tracking for database storage
    this.conversationTranscript = [];
    
    // Track which prompt was used for PromptLayer logging
    this.promptName = null;
    this.promptSource = null;
    
    // Broker timezone for dynamic time injection
    this.brokerTimezone = null;
    
    // Simple speaking flag
    this.speaking = false;
    
    // Heartbeat to keep OpenAI socket alive
    this.heartbeatInterval = null;
  }

  /**
   * Initialize OpenAI Realtime connection
   */
  async connect() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ Missing OPENAI_API_KEY');
      throw new Error('Missing OPENAI_API_KEY');
    }

    const realtimeModel = process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-12-17';
    
    this.openaiSocket = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(realtimeModel)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );
    
    console.log('🤖 Connecting to OpenAI Realtime:', realtimeModel);

    this.setupOpenAIHandlers();
    this.setupFabricHandlers();
  }

  /**
   * Setup OpenAI WebSocket event handlers
   */
  setupOpenAIHandlers() {
    this.openaiSocket.on('open', async () => {
      console.log('🤖 OpenAI Realtime connected!');
      this.logger.info('🤖 OpenAI Realtime connected');
      
      this.startHeartbeat();
      
      // Configure session with call context
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.configureSession();
      
      // Wait for session.updated event before greeting
    });

    this.openaiSocket.on('message', async (data) => {
      try {
        const event = JSON.parse(data.toString());
        await this.handleOpenAIEvent(event);
      } catch (err) {
        console.error('❌ Error processing OpenAI message:', err);
        this.logger.error({ err }, 'Error processing OpenAI message');
      }
    });

    this.openaiSocket.on('error', (err) => {
      console.error('❌ OpenAI WebSocket error:', err);
      this.logger.error({ err }, '❌ OpenAI WebSocket error');
      this.cleanup();
    });

    this.openaiSocket.on('close', () => {
      this.logger.info('🤖 OpenAI disconnected');
      this.cleanup();
    });
  }

  /**
   * Setup SignalWire Fabric event handlers
   */
  setupFabricHandlers() {
    // Listen for audio from Fabric
    this.fabricCall.on('audio', (audioData) => {
      // Forward audio to OpenAI
      if (this.openaiSocket?.readyState === WebSocket.OPEN) {
        this.openaiSocket.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: audioData.toString('base64')
        }));
      }
    });

    // Handle call state changes
    this.fabricCall.on('ended', () => {
      this.logger.info('📞 Fabric call ended');
      this.saveCallSummary();
      this.cleanup();
    });

    this.fabricCall.on('error', (err) => {
      this.logger.error({ err }, '❌ Fabric call error');
      this.cleanup();
    });
  }

  /**
   * Configure OpenAI Realtime session
   */
  async configureSession() {
    debug('🔵 configureSession() called');
    
    let instructions;
    let promptSource = 'unknown';

    // Get call context and build prompt
    const promptCallContext = {
      context: this.callContext.context || 'inbound',
      lead_id: this.callContext.lead_id,
      from_phone: this.callContext.from_phone,
      to_phone: this.callContext.to_phone,
      has_property_data: false,
      is_qualified: false
    };

    try {
      console.log('🍰 Fetching prompt from PromptLayer');
      
      const promptTemplate = await getPromptForCall(
        promptCallContext,
        this.callContext.instructions,
        {} // Variables will be injected inside getPromptForCall
      );

      if (!promptTemplate || promptTemplate.length === 0) {
        throw new Error('PromptLayer returned empty prompt');
      }

      instructions = promptTemplate;
      promptSource = 'promptlayer';
      this.promptName = determinePromptName(promptCallContext);
      this.promptSource = promptSource;
      
      console.log(`🍰 Successfully built prompt from PromptLayer (${instructions.length} chars)`);
      
    } catch (promptLayerError) {
      console.error('❌ PromptLayer fetch failed:', promptLayerError.message);
      console.warn('⚠️ Falling back to local prompt file');
      
      instructions = loadPromptSafe();
      promptSource = 'local_file';
      this.promptName = 'local-fallback-prompt';
      this.promptSource = promptSource;
    }

    console.log('📋 Final prompt details:', {
      source: promptSource,
      length: instructions.length,
      preview: instructions.substring(0, 150).replace(/\n/g, ' ')
    });
    
    // Prepend current time
    const currentTime = new Date().toISOString();
    const timeInstruction = `Current time is ${currentTime}. Use this as 'now' for scheduling.\n\n`;
    const finalInstructions = timeInstruction + instructions;
    
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        voice: process.env.REALTIME_VOICE || 'shimmer',
        instructions: finalInstructions,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        temperature: 0.95,
        max_response_output_tokens: 'inf',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.35,
          prefix_padding_ms: 500,
          silence_duration_ms: 2000
        },
        // Note: tools are handled via SWAIG, not OpenAI function calling
        tools: [],
        tool_choice: 'none'
      }
    };
    
    if (!this.openaiSocket || this.openaiSocket.readyState !== WebSocket.OPEN) {
      throw new Error('Cannot configure session - OpenAI socket not ready');
    }
    
    this.openaiSocket.send(JSON.stringify(sessionConfig));
    this.sessionConfigured = true;
    
    this.logger.info({ 
      promptSource,
      instructionsLength: instructions.length 
    }, '✅ OpenAI session configured');
  }

  /**
   * Handle OpenAI events
   */
  async handleOpenAIEvent(event) {
    debug('🤖 OpenAI event:', event.type);

    switch (event.type) {
      case 'session.created':
        this.logger.info({ session: event.session.id }, 'Session created');
        break;

      case 'session.updated':
        this.logger.info('Session updated successfully');
        console.log('✅ Session fully configured - ready to start conversation');
        
        // Start conversation after session is ready
        if (!this.greetingSent) {
          setTimeout(() => this.startConversation(), 500);
        }
        break;

      case 'response.audio.delta':
        if (event.delta) {
          this.sendAudioToFabric(event.delta);
        }
        break;

      case 'response.audio.done':
        this.speaking = false;
        this.logger.info('🔊 AI finished speaking');
        break;
      
      case 'response.created':
        this.speaking = true;
        debug('🎙️ Response generation started');
        break;
      
      case 'conversation.item.input_audio_transcription.completed':
        const userTranscript = event.transcript;
        console.log('👤 User said:', userTranscript);
        
        if (userTranscript) {
          this.conversationTranscript.push({
            role: 'user',
            text: userTranscript,
            timestamp: new Date().toISOString()
          });
        }
        break;
      
      case 'response.audio_transcript.done':
        const barbaraTranscript = event.transcript || '';
        if (barbaraTranscript) {
          console.log('🤖 Barbara said:', barbaraTranscript);
          
          this.conversationTranscript.push({
            role: 'assistant',
            text: barbaraTranscript,
            timestamp: new Date().toISOString()
          });
        }
        break;

      case 'error':
        console.error('❌ OpenAI error event:', JSON.stringify(event.error));
        this.logger.error({ error: event.error }, '❌ OpenAI error');
        this.speaking = false;
        break;

      default:
        if (!event.type.includes('delta') && !event.type.includes('transcript')) {
          debug('⚠️ Unhandled OpenAI event:', event.type);
        }
        break;
    }
  }

  /**
   * Send audio to SignalWire Fabric
   */
  sendAudioToFabric(audioBase64) {
    try {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      
      // Send to Fabric call (SDK handles encoding)
      this.fabricCall.sendAudio(audioBuffer);
      
      debug(`✅ Audio sent to Fabric (${audioBuffer.length} bytes)`);
    } catch (err) {
      console.error('❌ Failed to send audio to Fabric:', err.message);
    }
  }

  /**
   * Start conversation with initial greeting
   */
  startConversation() {
    debug('🔵 startConversation() called');
    
    if (this.greetingSent) {
      debug('⚠️ Greeting already sent');
      return;
    }
    
    if (this.openaiSocket?.readyState === WebSocket.OPEN) {
      setTimeout(() => {
        debug('🔵 Sending greeting trigger');

        const callerPhone = this.callContext.from_phone || 'unknown';
        
        this.openaiSocket.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{
              type: 'input_text',
              text: `call_connected from ${callerPhone}`
            }]
          }
        }));
        
        this.greetingSent = true;
        
        if (!this.speaking) {
          this.speaking = true;
          this.openaiSocket.send(JSON.stringify({
            type: 'response.create',
            response: {}
          }));
          debug('✅ Greeting response triggered');
        }
      }, 500);
    }
  }

  /**
   * Save call summary when call ends
   */
  async saveCallSummary() {
    const durationSeconds = Math.floor((Date.now() - this.callStartTime) / 1000);
    
    this.logger.info({ 
      duration: durationSeconds 
    }, '💾 Saving call summary');
    
    if (this.callContext.lead_id) {
      try {
        const { executeTool } = require('./tools');
        
        const lastMessages = this.conversationTranscript.slice(-3).map(t => t.text.toLowerCase()).join(' ');
        let outcome = 'neutral';
        
        if (lastMessages.includes('booked') || lastMessages.includes('scheduled')) {
          outcome = 'appointment_booked';
        } else if (lastMessages.includes('follow up') || lastMessages.includes('call back')) {
          outcome = 'follow_up_needed';
        } else if (lastMessages.includes('not interested')) {
          outcome = 'not_interested';
        }
        
        const metadata = {
          prompt_version: this.promptName || 'unknown',
          prompt_source: this.promptSource || 'unknown',
          call_duration_seconds: durationSeconds,
          message_count: this.conversationTranscript.length
        };
        
        await executeTool('save_interaction', {
          lead_id: this.callContext.lead_id,
          broker_id: this.callContext.broker_id,
          duration_seconds: durationSeconds,
          outcome: outcome,
          content: `Call transcript with ${this.conversationTranscript.length} messages`,
          transcript: this.conversationTranscript,
          metadata: metadata
        });
        
        console.log('✅ Interaction saved');
        
      } catch (err) {
        console.error('❌ Failed to save interaction:', err.message);
      }
    }
  }

  /**
   * Start heartbeat to keep OpenAI socket alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      try {
        if (this.openaiSocket?.readyState === WebSocket.OPEN) {
          this.openaiSocket.ping?.();
          debug('💓 OpenAI heartbeat sent');
        }
      } catch (err) {
        debug('⚠️ OpenAI ping failed:', err);
      }
    }, 15000);

    debug('💓 Heartbeat started');
  }

  /**
   * Cleanup connections
   */
  cleanup() {
    this.speaking = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      debug('✅ Heartbeat stopped');
    }
    
    this.logger.info('🧹 Cleaning up Fabric bridge');
    
    try {
      if (this.openaiSocket && this.openaiSocket.readyState === WebSocket.OPEN) {
        this.openaiSocket.close();
      }
    } catch (err) {
      this.logger.error({ err }, 'Error closing OpenAI socket');
    }
    
    try {
      if (this.fabricCall) {
        this.fabricCall.hangup?.();
      }
    } catch (err) {
      this.logger.error({ err }, 'Error hanging up Fabric call');
    }
  }
}

module.exports = FabricBridge;

