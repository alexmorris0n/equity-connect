/**
 * Audio Bridge Handler
 * 
 * Manages WebSocket connections between SignalWire and OpenAI Realtime API.
 * Handles bidirectional audio streaming (PCM16 @ 16kHz) and tool execution.
 */

const WebSocket = require('ws');
const { toolDefinitions, executeTool } = require('./tools');
const fs = require('fs');
const path = require('path');

// Load Barbara's system prompts
const BARBARA_INBOUND_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/BarbaraInboundPrompt'),
  'utf8'
);

const BARBARA_OUTBOUND_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/BarbaraVapiPrompt_V2_Realtime_Optimized'),
  'utf8'
);

/**
 * Create and manage audio bridge for a single call
 */
class AudioBridge {
  constructor(signalWireSocket, logger, callContext = {}) {
    this.swSocket = signalWireSocket;
    this.logger = logger;
    this.callContext = callContext; // { lead_id, broker_id, from, to, instructions }
    this.openaiSocket = null;
    this.sessionConfigured = false;
    this.callStartTime = Date.now();
    this.callSid = null;
  }

  /**
   * Initialize OpenAI Realtime connection
   */
  async connect() {
    console.log('🔵 AudioBridge.connect() called');
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ Missing OPENAI_API_KEY');
      throw new Error('Missing OPENAI_API_KEY');
    }

    console.log('🔵 Creating OpenAI WebSocket connection...');
    this.openaiSocket = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );

    console.log('🔵 Setting up OpenAI handlers...');
    this.setupOpenAIHandlers();
    console.log('🔵 Setting up SignalWire handlers...');
    this.setupSignalWireHandlers();
    console.log('🔵 AudioBridge.connect() complete');
  }

  /**
   * Setup OpenAI WebSocket event handlers
   */
  setupOpenAIHandlers() {
    console.log('🔵 setupOpenAIHandlers called, socket exists:', !!this.openaiSocket);
    
    this.openaiSocket.on('open', () => {
      console.log('🤖 OpenAI Realtime connected!');
      this.logger.info('🤖 OpenAI Realtime connected');
      this.configureSession();
      
      // Trigger immediate greeting for inbound calls
      setTimeout(() => {
        console.log('🔵 Triggering initial response after 1 second...');
        this.startConversation();
      }, 1000);
    });

    this.openaiSocket.on('message', async (data) => {
      try {
        const event = JSON.parse(data.toString());
        console.log('📨 Raw OpenAI event type:', event.type);
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
   * Setup SignalWire WebSocket event handlers
   */
  setupSignalWireHandlers() {
    console.log('🔵 setupSignalWireHandlers called, socket exists:', !!this.swSocket, 'has .on?:', typeof this.swSocket?.on);
    
    this.swSocket.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());
        this.handleSignalWireEvent(msg);
      } catch (err) {
        this.logger.error({ err }, 'Error processing SignalWire message');
      }
    });

    this.swSocket.on('close', () => {
      this.logger.info('📞 SignalWire disconnected');
      this.cleanup();
    });

    this.swSocket.on('error', (err) => {
      this.logger.error({ err }, '❌ SignalWire WebSocket error');
      this.cleanup();
    });
  }

  /**
   * Configure OpenAI Realtime session
   */
  configureSession() {
    console.log('🔵 configureSession() called');
    
    // Use custom instructions from n8n if provided
    // Otherwise use inbound prompt (for when people call us)
    // n8n will send full outbound prompt when making calls
    const instructions = this.callContext.instructions || BARBARA_INBOUND_PROMPT;
    console.log('🔵 Instructions length:', instructions.length, 'Custom:', !!this.callContext.instructions);
    
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        voice: 'alloy',
        instructions: instructions,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1500  // Increased for seniors who pause to think
        }
        // TEMPORARILY REMOVED: tools cause static per OpenAI forum issue
        // Will add back after confirming audio works
        // tools: toolDefinitions,
        // tool_choice: 'auto'
      }
    };

    console.log('🔵 Sending session.update to OpenAI...');
    console.log('🔵 Session config:', JSON.stringify(sessionConfig).substring(0, 500));
    
    this.openaiSocket.send(JSON.stringify(sessionConfig));
    this.sessionConfigured = true;
    
    console.log('✅ Session configuration sent!');
    
    const hasCustomInstructions = !!this.callContext.instructions;
    this.logger.info({ 
      customInstructions: hasCustomInstructions,
      instructionsLength: instructions.length 
    }, '✅ OpenAI session configured');
  }

  /**
   * Handle OpenAI events
   */
  async handleOpenAIEvent(event) {
    // Log ALL events for debugging (including audio)
    console.log('🤖 OpenAI event:', event.type);
    
    // Log important events (skip frequent audio chunks)
    if (!['response.audio.delta', 'input_audio_buffer.speech_started', 'input_audio_buffer.speech_stopped'].includes(event.type)) {
      this.logger.info({ type: event.type }, '🤖 OpenAI event');
    }

    switch (event.type) {
      case 'session.created':
        this.logger.info({ session: event.session.id }, 'Session created');
        break;

      case 'session.updated':
        this.logger.info('Session updated successfully');
        break;

      case 'response.audio.delta':
        // Send audio back to SignalWire
        if (event.delta) {
          this.sendMediaToSignalWire(event.delta);
        }
        break;

      case 'response.audio.done':
        this.logger.info('🔊 AI finished speaking');
        break;

      case 'response.function_call_arguments.done':
        // Execute tool call
        await this.handleToolCall(event);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.logger.info({ transcript: event.transcript }, '👤 User said');
        break;

      case 'error':
        console.error('❌ OpenAI error event:', JSON.stringify(event.error));
        this.logger.error({ error: event.error }, '❌ OpenAI error');
        break;
    }
  }

  /**
   * Handle SignalWire events
   */
  handleSignalWireEvent(msg) {
    console.log('📞 SignalWire event:', msg.event);
    
    switch (msg.event) {
      case 'start':
        this.callSid = msg.start.callSid;
        console.log('📞 Call started, CallSid:', this.callSid);
        this.logger.info({ callSid: this.callSid }, '📞 Call started');
        
        // Trigger initial greeting
        if (this.sessionConfigured) {
          this.startConversation();
        }
        break;

      case 'media':
        // Send audio to OpenAI
        if (msg.media?.payload && this.openaiSocket?.readyState === WebSocket.OPEN) {
          this.openaiSocket.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: msg.media.payload
          }));
        }
        break;

      case 'stop':
        this.logger.info('📞 Call ended by SignalWire');
        this.saveCallSummary();
        this.cleanup();
        break;
    }
  }

  /**
   * Send media (audio) to SignalWire
   */
  sendMediaToSignalWire(audioData) {
    console.log('🔊 Sending audio to SignalWire, length:', audioData?.length, 'callSid:', this.callSid, 'socketOpen:', this.swSocket.readyState === WebSocket.OPEN);
    
    if (this.swSocket.readyState === WebSocket.OPEN) {
      this.swSocket.send(JSON.stringify({
        event: 'media',
        streamSid: this.callSid || 'unknown',
        media: {
          payload: audioData
        }
      }));
      console.log('✅ Audio sent to SignalWire');
    } else {
      console.error('❌ Cannot send audio - SignalWire socket not open, state:', this.swSocket.readyState);
    }
  }

  /**
   * Start conversation with initial greeting
   */
  startConversation() {
    console.log('🔵 startConversation() called, OpenAI ready:', this.openaiSocket?.readyState === WebSocket.OPEN);
    
    if (this.openaiSocket?.readyState === WebSocket.OPEN) {
      // Inject call context if available
      let contextPrompt = 'Greet the caller warmly and say hello.';
      
      if (this.callContext.leadName) {
        contextPrompt = `The caller is ${this.callContext.leadName}. Greet them warmly and confirm their identity.`;
      }

      console.log('🔵 Sending response.create with prompt:', contextPrompt);

      this.openaiSocket.send(JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['audio', 'text'],
          instructions: contextPrompt
        }
      }));
      
      console.log('✅ Conversation trigger sent!');
      this.logger.info('🎯 Conversation started');
    } else {
      console.error('❌ Cannot start conversation - OpenAI socket not ready');
    }
  }

  /**
   * Handle tool calls from OpenAI
   */
  async handleToolCall(event) {
    const { call_id, name, arguments: argsJson } = event;
    
    this.logger.info({ function: name, call_id }, '🔧 Tool called');
    
    try {
      const args = JSON.parse(argsJson);
      const result = await executeTool(name, args);
      
      this.logger.info({ function: name, result }, '✅ Tool executed');
      
      // Send result back to OpenAI
      this.openaiSocket.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id,
          output: JSON.stringify(result)
        }
      }));
      
      // Continue response
      this.openaiSocket.send(JSON.stringify({
        type: 'response.create'
      }));
      
    } catch (err) {
      this.logger.error({ err, function: name }, '❌ Tool execution failed');
      
      // Send error to OpenAI
      this.openaiSocket.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id,
          output: JSON.stringify({ error: err.message })
        }
      }));
    }
  }

  /**
   * Save call summary when call ends
   */
  async saveCallSummary() {
    const durationSeconds = Math.floor((Date.now() - this.callStartTime) / 1000);
    
    this.logger.info({ 
      callSid: this.callSid,
      duration: durationSeconds 
    }, '💾 Saving call summary');
    
    // Tool will be called by OpenAI if needed, but we can also save basic log
    // This is a fallback in case the tool wasn't called
    if (this.callContext.lead_id) {
      try {
        await executeTool('save_interaction', {
          lead_id: this.callContext.lead_id,
          broker_id: this.callContext.broker_id,
          duration_seconds: durationSeconds,
          outcome: 'neutral', // Will be updated by actual tool call if made
          content: `Call completed. Duration: ${durationSeconds}s`
        });
      } catch (err) {
        this.logger.error({ err }, 'Failed to save interaction fallback');
      }
    }
  }

  /**
   * Cleanup connections
   */
  cleanup() {
    this.logger.info('🧹 Cleaning up audio bridge');
    
    try {
      if (this.openaiSocket && this.openaiSocket.readyState === WebSocket.OPEN) {
        this.openaiSocket.close();
      }
    } catch (err) {
      this.logger.error({ err }, 'Error closing OpenAI socket');
    }
    
    try {
      if (this.swSocket && this.swSocket.readyState === WebSocket.OPEN) {
        this.swSocket.close();
      }
    } catch (err) {
      this.logger.error({ err }, 'Error closing SignalWire socket');
    }
  }
}

module.exports = AudioBridge;

