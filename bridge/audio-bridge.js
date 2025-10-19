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
    this.lastResponseAt = 0;
    this.userSpeaking = false;
    this.autoResumeInterval = null;
    this.responseInProgress = false;  // Track if Barbara is currently responding
    this.greetingSent = false;  // Prevent duplicate greeting triggers
    this.currentResponseTranscript = '';  // Track Barbara's current response transcript for logging
    this.awaitingUser = false;  // Track if Barbara asked a question and is waiting for answer
    this.nudgedOnce = false;  // Track if we've nudged the user once already
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

    this.openaiSocket = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-realtime-2025-08-28',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );

    this.setupOpenAIHandlers();
    this.setupSignalWireHandlers();
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
      
      // Start auto-resume monitor to prevent Barbara from dying out
      this.startAutoResumeMonitor();
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
        voice: 'sage',
        instructions: instructions,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        temperature: 0.75,  // Warmer, more natural conversation (up from 0.6)
        max_response_output_tokens: 150,  // Allow full greeting + one sentence response
        turn_detection: {
          type: 'server_vad',
          threshold: 0.65,  // Higher threshold to ignore background TV/radio noise
          prefix_padding_ms: 400,  // Slightly more padding to catch full start of speech
          silence_duration_ms: 2000  // Tightened from 2500ms - don't mistake silence for user finished
        },
        tools: toolDefinitions,
        tool_choice: 'auto'
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
    // Only log important events (skip frequent audio frames)
    const audioEvents = ['response.audio.delta', 'input_audio_buffer.speech_started', 'input_audio_buffer.speech_stopped', 'input_audio_buffer.committed'];
    
    if (!audioEvents.includes(event.type)) {
      console.log('🤖 OpenAI event:', event.type);
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
      
      case 'response.created':
        // Response generation started
        this.responseInProgress = true;
        console.log('🎙️ Response generation started');
        break;
      
      case 'response.output_item.done':
        // Barbara finished speaking an item (could be mid-response)
        this.lastResponseAt = Date.now();
        console.log('✅ Output item completed, tracking for auto-resume');
        break;
      
      case 'response.done':
      case 'response.completed':
        // Track when Barbara finished speaking
        this.lastResponseAt = Date.now();
        this.responseInProgress = false;  // Response fully completed
        console.log('✅ Response completed, tracking for auto-resume');
        break;
      
      case 'response.interrupted':
        // Barbara was interrupted - mark response as no longer in progress
        this.responseInProgress = false;
        console.log('⚠️ Response interrupted, VAD will handle resume');
        // Don't reset lastResponseAt here - let auto-resume work after VAD timeout
        break;
      
      case 'input_audio_buffer.speech_started':
        // User started speaking - cancel Barbara's in-progress response if any
        this.userSpeaking = true;
        this.awaitingUser = false;  // User is now speaking, no longer waiting
        this.nudgedOnce = false;  // Reset nudge since user responded
        console.log('👤 User started speaking');
        
        // If Barbara is currently responding, cancel it so she doesn't talk over the user
        if (this.responseInProgress) {
          console.log('⚠️ User interrupted - canceling Barbara\'s response');
          this.openaiSocket.send(JSON.stringify({
            type: 'response.cancel'
          }));
          this.responseInProgress = false;
        }
        break;
      
      case 'input_audio_buffer.speech_stopped':
        // User stopped speaking
        this.userSpeaking = false;
        console.log('👤 User stopped speaking');
        break;

      case 'response.function_call_arguments.done':
        // Execute tool call
        await this.handleToolCall(event);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // Log user's input transcription
        const userTranscript = event.transcript;
        console.log('👤 User said:', userTranscript);
        this.logger.info({ transcript: userTranscript, item_id: event.item_id }, '👤 User transcription');
        
        // TODO: Save to database for quality monitoring
        // await this.saveTranscript('user', userTranscript, event.item_id);
        break;
      
      case 'response.audio_transcript.delta':
        // Barbara's speech is being transcribed in real-time (streaming)
        if (!this.currentResponseTranscript) {
          this.currentResponseTranscript = '';
        }
        this.currentResponseTranscript += event.delta;
        break;
      
      case 'response.audio_transcript.done':
        // Barbara finished speaking - log complete transcript
        const barbaraTranscript = this.currentResponseTranscript || event.transcript || '';
        if (barbaraTranscript) {
          console.log('🤖 Barbara said:', barbaraTranscript);
          this.logger.info({ transcript: barbaraTranscript, response_id: event.response_id }, '🤖 Barbara transcription');
          
          // Check if Barbara asked a question (ended with ?)
          this.awaitingUser = /\?\s*$/.test(barbaraTranscript.trim());
          this.nudgedOnce = false;  // Reset nudge flag for this new question
          
          // TODO: Save to database for quality monitoring
          // await this.saveTranscript('assistant', barbaraTranscript, event.response_id);
        }
        this.currentResponseTranscript = '';  // Reset for next response
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
    // Only log important events (not media frames)
    if (msg.event !== 'media') {
      console.log('📞 SignalWire event:', msg.event);
    }
    
    switch (msg.event) {
      case 'start':
        this.callSid = msg.start.callSid;
        
        // Extract caller phone from SignalWire customParameters
        const cp = msg.start?.customParameters || {};
        if (cp.from) {
          this.callContext.from = cp.from;
          console.log('📞 Caller phone extracted:', cp.from);
        }
        if (cp.to) {
          this.callContext.to = cp.to;
        }
        
        console.log('📞 Call started, CallSid:', this.callSid);
        this.logger.info({ callSid: this.callSid, from: this.callContext.from }, '📞 Call started');
        
        // Trigger initial greeting
        if (this.sessionConfigured) {
          this.startConversation();
        }
        break;

      case 'media':
        // Send audio to OpenAI (silent - happens every 20ms)
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
   * Start auto-resume monitor to prevent Barbara from dying out
   */
  startAutoResumeMonitor() {
    // Check every 500ms if we need to nudge (but never auto-continue)
    this.autoResumeInterval = setInterval(() => {
      const idleTime = Date.now() - this.lastResponseAt;
      
      // If Barbara asked a question and user hasn't responded in 8 seconds
      // Give ONE gentle nudge, then stop (don't auto-progress through script)
      if (idleTime > 8000 && !this.userSpeaking && this.lastResponseAt > 0 && !this.responseInProgress) {
        // Only nudge if Barbara asked a question and we haven't nudged yet
        if (this.awaitingUser && !this.nudgedOnce) {
          console.log('🔔 User silent after question - sending gentle nudge');
          
          // Send a gentle "Take your time" nudge
          this.openaiSocket.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'assistant',
              content: [{
                type: 'input_text',
                text: 'Take your time.'
              }]
            }
          }));
          
          this.nudgedOnce = true;  // Only nudge once per question
          this.lastResponseAt = Date.now();  // Reset timer
          console.log('✅ Gentle nudge sent - will not auto-continue');
        }
        // If not awaiting user, do nothing (don't auto-progress)
      }
    }, 500);
    
    console.log('✅ Auto-nudge monitor started (8s threshold - one nudge per question, no auto-continue)');
  }
  
  /**
   * Resume conversation after interruption or unexpected silence
   */
  resumeConversation() {
    // Guard: Don't send response.create if one is already in progress
    if (this.responseInProgress) {
      console.log('⚠️ Cannot resume - response already in progress');
      return;
    }
    
    if (this.openaiSocket?.readyState === WebSocket.OPEN) {
      console.log('🔄 Sending response.create to resume conversation');
      this.openaiSocket.send(JSON.stringify({
        type: 'response.create'
      }));
      this.responseInProgress = true;  // Mark response as starting
    }
  }

  /**
   * Force lead context lookup and inject as system message
   * This guarantees Barbara has real data before her second turn
   */
  async forceLeadContextLookup() {
    const phone = this.callContext.from;
    
    if (!phone) {
      console.log('⚠️ No caller phone available - skipping lead lookup');
      return;
    }
    
    console.log('🔍 Force-calling get_lead_context for phone:', phone);
    this.logger.info({ phone }, '🔍 Forcing lead context lookup');
    
    try {
      const { executeTool } = require('./tools');
      const result = await executeTool('get_lead_context', { phone });
      
      console.log('✅ Lead context retrieved:', JSON.stringify(result).substring(0, 200));
      this.logger.info({ result }, '✅ Lead context retrieved');
      
      // Build silent system message with real data
      let contextMessage = 'CALLER INFORMATION (use this real data, do not make up names or details):\n';
      
      if (result?.found) {
        contextMessage += `- First name: ${result.raw?.first_name || 'Unknown'}\n`;
        contextMessage += `- Last name: ${result.raw?.last_name || 'Unknown'}\n`;
        contextMessage += `- City: ${result.raw?.property_city || 'Unknown'}\n`;
        contextMessage += `- Status: ${result.raw?.status || 'new'}\n`;
        
        if (result.broker_id) {
          // Extract broker first name from context or fetch it
          const brokerMatch = result.context?.match(/broker.*?([A-Z][a-z]+)/i);
          const brokerName = brokerMatch ? brokerMatch[1] : 'Unknown';
          contextMessage += `- Assigned broker first name: ${brokerName}\n`;
        }
        
        contextMessage += '\nCRITICAL: This is a RETURNING CALLER. Use their real name and city. Follow the STATUS flow in your instructions.';
        
        // Store IDs for later tool calls
        this.callContext.lead_id = result.lead_id;
        this.callContext.broker_id = result.broker_id;
      } else {
        contextMessage += '- Status: NEW CALLER (not in database)\n';
        contextMessage += '\nThis is a first-time caller. Ask for their name and continue with Step 1.';
      }
      
      // Inject as silent system message
      this.openaiSocket.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [{
            type: 'input_text',
            text: contextMessage
          }]
        }
      }));
      
      console.log('💉 Lead context injected into conversation');
      this.logger.info('💉 Lead context injected successfully');
      
    } catch (err) {
      console.error('❌ Force lead lookup failed:', err.message);
      this.logger.error({ err }, '❌ Force lead lookup failed');
      
      // Inject fallback message
      this.openaiSocket.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [{
            type: 'input_text',
            text: 'Lead data unavailable. Treat as new caller - ask for their name.'
          }]
        }
      }));
    }
  }

  /**
   * Start conversation with initial greeting
   */
  startConversation() {
    console.log('🔵 startConversation() called, OpenAI ready:', this.openaiSocket?.readyState === WebSocket.OPEN, 'Already sent?', this.greetingSent);
    
    // Prevent duplicate greeting triggers
    if (this.greetingSent) {
      console.log('⚠️ Greeting already sent, skipping duplicate call');
      return;
    }
    
    if (this.openaiSocket?.readyState === WebSocket.OPEN) {
      console.log('🔵 Waiting 500ms before greeting to avoid cutting into connection audio...');
      
      // Wait 500ms to let the call connection settle before Barbara speaks
      setTimeout(() => {
        console.log('🔵 Sending call_connected trigger to force Barbara to speak first');

        // Step 1: Create a conversation item that triggers Barbara's greeting
        // Include caller's phone number so she can auto-lookup
        const callerPhone = this.callContext.from || 'unknown';
        console.log('🔵 Caller phone:', callerPhone);
        
        this.openaiSocket.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{
              type: 'input_text',
              text: `call_connected from ${callerPhone}`  // Include phone so Barbara can lookup
            }]
          }
        }));
        
        console.log('✅ Step 1: conversation.item.create sent (call_connected trigger)');

        // Step 2: Request response generation (this makes Barbara actually speak)
        this.openaiSocket.send(JSON.stringify({
          type: 'response.create'
        }));
        
        this.greetingSent = true;  // Mark greeting as sent
        this.responseInProgress = true;  // Track that response is starting
        console.log('✅ Step 2: response.create sent (Barbara should now speak!)');
        this.logger.info('🎯 Conversation started with explicit greeting trigger');
        
        // Step 3: Force lead lookup in parallel so context is ready for turn 2
        setTimeout(() => this.forceLeadContextLookup(), 50);
      }, 500);
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
      this.logger.error({ err, function: name, args: argsJson }, '❌ Tool execution failed');
      
      // Generate graceful fallback message based on tool type
      let fallbackMessage = '';
      switch (name) {
        case 'get_lead_context':
          fallbackMessage = 'I was unable to pull up your information right now, but that\'s okay - we can still help you!';
          break;
        case 'search_knowledge':
          fallbackMessage = 'I\'m having a little trouble accessing that information right now. Let me connect you with one of our specialists who can answer that for you.';
          break;
        case 'check_broker_availability':
        case 'book_appointment':
          fallbackMessage = 'I\'m having trouble accessing the calendar right now. Let me have one of our specialists call you back to schedule that. What\'s the best number to reach you?';
          break;
        case 'update_lead_info':
        case 'save_interaction':
          fallbackMessage = 'Got it - I\'ve made a note of that.';
          break;
        default:
          fallbackMessage = 'I\'m having a little trouble with that right now, but I can still help you!';
      }
      
      // Send graceful error message to OpenAI
      this.openaiSocket.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id,
          output: JSON.stringify({ 
            error: err.message,
            fallback_message: fallbackMessage
          })
        }
      }));
      
      // Continue response so Barbara can speak the fallback
      this.openaiSocket.send(JSON.stringify({
        type: 'response.create'
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
    
    // Clear auto-resume interval
    if (this.autoResumeInterval) {
      clearInterval(this.autoResumeInterval);
      this.autoResumeInterval = null;
      console.log('✅ Auto-resume monitor stopped');
    }
    
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

