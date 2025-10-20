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

// Debug logging control
const ENABLE_DEBUG_LOGGING = process.env.ENABLE_DEBUG_LOGGING === 'true';

// Debug logger - only logs if debug enabled
const debug = (...args) => {
  if (ENABLE_DEBUG_LOGGING) {
    console.log(...args);
  }
};

// Load Barbara's hybrid system prompt (handles both inbound and outbound)
const BARBARA_HYBRID_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/BarbaraRealtimePrompt'),
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
    this.callerPhone = null;  // Populated from SignalWire start event
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
    debug('🔵 setupOpenAIHandlers called, socket exists:', !!this.openaiSocket);
    
    this.openaiSocket.on('open', async () => {
      console.log('🤖 OpenAI Realtime connected!'); // Always log important events
      this.logger.info('🤖 OpenAI Realtime connected');
      
      // Configure session (async - waits for lead lookup on inbound)
      await this.configureSession();
      
      // Trigger greeting based on call type
      // Inbound: 1.5 seconds (gives people time to say "Hello?")
      // Outbound: 1 second (faster response after they pick up)
      const isInbound = !this.callContext.instructions;
      const greetingDelay = isInbound ? 1500 : 1000;
      
      setTimeout(() => {
        debug(`🔵 Triggering initial response after ${greetingDelay}ms (${isInbound ? 'inbound' : 'outbound'})...`);
        this.startConversation();
      }, greetingDelay);
      
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
    debug('🔵 setupSignalWireHandlers called, socket exists:', !!this.swSocket, 'has .on?:', typeof this.swSocket?.on);
    
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
   * Personalize prompt with context after getting caller phone (for inbound)
   */
  async personalizePromptWithContext() {
    debug('🔄 Personalizing prompt with caller context');
    
    try {
      const { prompt, variables } = await this.lookupAndBuildPrompt();
      
      // Update session with personalized prompt
      debug('📤 Sending session update with personalized prompt');
      this.openaiSocket.send(JSON.stringify({
        type: 'session.update',
        session: {
          instructions: prompt
        }
      }));
      
      debug('✅ Session updated with personalized prompt', {
        hasName: !!variables.leadFirstName,
        hasCity: !!variables.propertyCity
      });
      
    } catch (err) {
      console.error('❌ Failed to personalize prompt:', err);
      throw err;
    }
  }

  /**
   * Look up lead context and build personalized prompt
   */
  async lookupAndBuildPrompt() {
    // Extract caller phone from SignalWire metadata
    const callerPhone = this.extractCallerPhone();
    
    if (!callerPhone) {
      debug('⚠️  No caller phone found, using minimal prompt');
      return {
        prompt: this.buildPromptFromTemplate({ callContext: 'inbound' }),
        variables: { callContext: 'inbound' }
      };
    }
    
    debug('📞 Looking up lead context for:', callerPhone);
    
    try {
      // Look up lead from database
      const result = await executeTool('get_lead_context', { phone: callerPhone });
      
      // Build variables object from lead context
      const variables = {
        // Call context
        callContext: 'inbound',
        
        // Lead info
        leadFirstName: result?.raw?.first_name || '',
        leadLastName: result?.raw?.last_name || '',
        leadFullName: result?.raw?.first_name 
          ? `${result.raw.first_name} ${result.raw.last_name || ''}`.trim() 
          : '',
        leadEmail: result?.raw?.primary_email || '',
        leadPhone: callerPhone,
        
        // Property info
        propertyAddress: result?.raw?.property_address || '',
        propertyCity: result?.raw?.property_city || '',
        propertyState: result?.raw?.property_state || '',
        propertyZipcode: result?.raw?.property_zip || '',
        propertyValue: result?.raw?.property_value || '',
        propertyValueWords: result?.raw?.property_value ? this.numberToWords(result.raw.property_value) : '',
        mortgageBalanceWords: result?.raw?.mortgage_balance ? this.numberToWords(result.raw.mortgage_balance) : '',
        
        // Equity
        estimatedEquity: result?.raw?.estimated_equity || '',
        estimatedEquityWords: result?.raw?.estimated_equity ? this.numberToWords(result.raw.estimated_equity) : '',
        equity50Percent: result?.raw?.estimated_equity ? Math.floor(result.raw.estimated_equity * 0.5) : '',
        equity50FormattedWords: result?.raw?.estimated_equity ? this.numberToWords(Math.floor(result.raw.estimated_equity * 0.5)) : '',
        equity60Percent: result?.raw?.estimated_equity ? Math.floor(result.raw.estimated_equity * 0.6) : '',
        equity60FormattedWords: result?.raw?.estimated_equity ? this.numberToWords(Math.floor(result.raw.estimated_equity * 0.6)) : '',
        
        // Broker info
        brokerCompany: result?.broker?.company_name || '',
        brokerFullName: result?.broker?.contact_name || '',
        brokerFirstName: result?.broker?.contact_name ? result.broker.contact_name.split(' ')[0] : '',
        brokerNmls: result?.broker?.nmls_number || '',
        brokerPhone: result?.broker?.phone || '',
        brokerDisplay: result?.broker?.contact_name 
          ? `${result.broker.contact_name}, NMLS ${result.broker.nmls_number || 'licensed'}`
          : '',
        
        // Persona - empty for inbound (they called us)
        personaSenderName: '',
        personaFirstName: '',
        campaignArchetype: '',
        personaAssignment: ''
      };
      
      debug('✅ Lead context retrieved:', {
        found: result?.found,
        name: variables.leadFirstName,
        city: variables.propertyCity,
        broker: variables.brokerFirstName
      });
      
      // Build prompt from template with variables
      const prompt = this.buildPromptFromTemplate(variables);
      
      return { prompt, variables };
      
    } catch (err) {
      console.error('❌ Failed to lookup lead context:', err);
      // Return minimal prompt on error
      return {
        prompt: this.buildPromptFromTemplate({ callContext: 'inbound' }),
        variables: { callContext: 'inbound' }
      };
    }
  }
  
  /**
   * Extract caller phone from SignalWire metadata
   */
  extractCallerPhone() {
    // Outbound: use to_phone from context
    if (this.callContext.to_phone) {
      return this.callContext.to_phone;
    }
    
    // Inbound: use from context (populated by SignalWire start event)
    if (this.callContext.from) {
      return this.callContext.from;
    }
    
    // Use stored caller phone
    if (this.callerPhone) {
      return this.callerPhone;
    }
    
    return null;
  }
  
  /**
   * Build prompt from template by replacing variables
   */
  buildPromptFromTemplate(variables) {
    let prompt = BARBARA_HYBRID_PROMPT;
    
    // Process {{#if}} conditionals - removes handlebars syntax
    const conditionalRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    prompt = prompt.replace(conditionalRegex, (match, varName, content) => {
      return variables[varName] ? content : '';
    });
    
    // Process {{#if}}...{{else}}...{{/if}} conditionals
    const conditionalElseRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
    prompt = prompt.replace(conditionalElseRegex, (match, varName, ifContent, elseContent) => {
      return variables[varName] ? ifContent : elseContent;
    });
    
    // Replace all {{variable}} placeholders
    Object.keys(variables).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = variables[key] || '';
      prompt = prompt.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });
    
    return prompt;
  }
  
  /**
   * Convert number to words (for natural speech)
   */
  numberToWords(value) {
    if (!value || value === 0) return 'zero';
    
    const num = parseInt(value);
    
    // Handle millions
    if (num >= 1000000) {
      const millions = num / 1000000;
      if (millions === Math.floor(millions)) {
        return `${millions === 1 ? 'one' : millions} million`;
      } else {
        return `${millions.toFixed(1)} million`;
      }
    }
    
    // Handle thousands
    if (num >= 1000) {
      const thousands = num / 1000;
      if (thousands === Math.floor(thousands)) {
        return `${this.numberWord(thousands)} thousand`;
      } else {
        return `${thousands.toFixed(0)} thousand`;
      }
    }
    
    return this.numberWord(num);
  }
  
  /**
   * Convert single numbers to words (1-999)
   */
  numberWord(num) {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const tenPart = Math.floor(num / 10);
      const onePart = num % 10;
      return tens[tenPart] + (onePart > 0 ? ' ' + ones[onePart] : '');
    }
    
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    return ones[hundreds] + ' hundred' + (remainder > 0 ? ' ' + this.numberWord(remainder) : '');
  }

  /**
   * Configure OpenAI Realtime session
   * Note: Now looks up lead context for inbound calls to personalize prompt
   */
  async configureSession() {
    debug('🔵 configureSession() called');
    
    let instructions;
    
    if (this.callContext.instructions) {
      // n8n/Barbara MCP sent fully customized prompt (outbound calls)
      instructions = this.callContext.instructions;
      debug('🔵 Using custom instructions from n8n/MCP (outbound)');
    } else {
      // Inbound call - look up lead context and process template
      debug('🔵 Inbound call - looking up lead context to personalize prompt');
      
      try {
        const leadContext = await this.lookupAndBuildPrompt();
        instructions = leadContext.prompt;
        debug('🔵 Built personalized inbound prompt', {
          hasName: !!leadContext.variables.leadFirstName,
          hasCity: !!leadContext.variables.propertyCity,
          promptLength: instructions.length
        });
      } catch (err) {
        console.error('❌ Failed to build personalized prompt, using minimal:', err);
        // Fallback to minimal prompt
        instructions = this.buildPromptFromTemplate({ callContext: 'inbound' });
      }
    }
    
    debug('🔵 Instructions length:', instructions.length, 'Custom:', !!this.callContext.instructions);
    
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        voice: 'sage',
        instructions: instructions,  // Static prompt (cacheable)
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
    
    debug('🔵 Sending session.update to OpenAI...');
    debug('🔵 Session config:', JSON.stringify(sessionConfig).substring(0, 500));
    
    this.openaiSocket.send(JSON.stringify(sessionConfig));
    this.sessionConfigured = true;
    
    debug('✅ Session configuration sent!');
    
    const hasCustomInstructions = !!this.callContext.instructions;
    this.logger.info({ 
      customInstructions: hasCustomInstructions,
      instructionsLength: instructions.length 
    }, '✅ OpenAI session configured with cacheable prompt');
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
        
        // Handle rate limit errors specifically
        if (event.error?.code === 'rate_limit_exceeded') {
          console.error('🚨 RATE LIMIT EXCEEDED - Too many calls to OpenAI API');
          this.logger.error('🚨 Rate limit exceeded - check OpenAI account tier and usage');
          // Gracefully end the call
          this.cleanup();
        }
        break;
    }
  }

  /**
   * Handle SignalWire events
   */
  handleSignalWireEvent(msg) {
    // Only log important events (not media frames)
    if (msg.event !== 'media') {
      debug('📞 SignalWire event:', msg.event);
    }
    
    switch (msg.event) {
      case 'start':
        this.callSid = msg.start.callSid;
        
        // Extract caller phone from SignalWire customParameters
        const cp = msg.start?.customParameters || {};
        if (cp.from) {
          this.callContext.from = cp.from;
          this.callerPhone = cp.from;
          debug('📞 Caller phone extracted:', cp.from);
        }
        if (cp.to) {
          this.callContext.to = cp.to;
        }
        
        console.log('📞 Call started, CallSid:', this.callSid); // Always log call start
        this.logger.info({ callSid: this.callSid, from: this.callContext.from }, '📞 Call started');
        
        // For INBOUND calls without custom instructions, personalize prompt now that we have phone
        if (!this.callContext.instructions && this.callerPhone && this.sessionConfigured) {
          debug('🔄 Personalizing prompt now that we have caller phone');
          this.personalizePromptWithContext().then(() => {
            debug('✅ Prompt personalized, adding 500ms delay before greeting (inbound)');
            // Extra delay for inbound calls to give caller time to say "Hello?"
            setTimeout(() => {
              debug('🔵 Triggering greeting after personalization delay');
              this.startConversation();
            }, 500);
          }).catch(err => {
            console.error('❌ Failed to personalize prompt:', err);
            setTimeout(() => {
              this.startConversation();
            }, 500); // Continue with delay anyway
          });
        } else if (this.sessionConfigured) {
          // Outbound or already personalized - just start
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
    debug('🔊 Sending audio to SignalWire, length:', audioData?.length, 'callSid:', this.callSid);
    
    if (this.swSocket.readyState === WebSocket.OPEN) {
      this.swSocket.send(JSON.stringify({
        event: 'media',
        streamSid: this.callSid || 'unknown',
        media: {
          payload: audioData
        }
      }));
      debug('✅ Audio sent to SignalWire');
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
            type: 'text',
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
    const callerPhone = this.callContext.from;
    const signalwireNumber = this.callContext.to;
    
    if (!callerPhone) {
      console.log('⚠️ No caller phone available - skipping lead lookup');
      return;
    }
    
    // Store caller phone for booking/logging
    this.callerPhone = callerPhone;
    
    console.log('🔍 Force-calling get_lead_context for phone:', callerPhone);
    console.log('📞 SignalWire number called:', signalwireNumber);
    this.logger.info({ callerPhone, signalwireNumber }, '🔍 Forcing lead context lookup');
    
    try {
      const { executeTool, initSupabase } = require('./tools');
      
      // First, look up which broker owns this SignalWire number
      let assignedBrokerId = null;
      let assignedBrokerName = null;
      const DEFAULT_BROKER_ID = '6a3c5ed5-664a-4e13-b019-99fe8db74174'; // Walter - fallback
      const DEFAULT_BROKER_NAME = 'Walter';
      
      if (signalwireNumber) {
        const sb = initSupabase();
        
        try {
          const { data: swNumber, error: swError } = await sb
            .from('signalwire_phone_numbers')
            .select('assigned_broker_company')
            .eq('number', signalwireNumber)
            .single();
          
          if (swError) {
            console.log('⚠️ SignalWire number not found in database, using default broker');
            assignedBrokerId = DEFAULT_BROKER_ID;
            assignedBrokerName = DEFAULT_BROKER_NAME;
          } else if (swNumber?.assigned_broker_company) {
            const { data: broker, error: brokerError } = await sb
              .from('brokers')
              .select('id, contact_name')
              .eq('company_name', swNumber.assigned_broker_company)
              .eq('status', 'active')
              .single();
            
            if (brokerError || !broker) {
              console.log('⚠️ Broker not found for company, using default');
              assignedBrokerId = DEFAULT_BROKER_ID;
              assignedBrokerName = DEFAULT_BROKER_NAME;
            } else {
              assignedBrokerId = broker.id;
              assignedBrokerName = broker.contact_name.split(' ')[0]; // First name only
              console.log('🏢 Broker assigned by SignalWire number:', assignedBrokerName);
              this.logger.info({ brokerId: assignedBrokerId, brokerName: assignedBrokerName }, '🏢 Broker assigned by phone number');
            }
          }
        } catch (err) {
          console.error('❌ Broker lookup error, using default:', err.message);
          assignedBrokerId = DEFAULT_BROKER_ID;
          assignedBrokerName = DEFAULT_BROKER_NAME;
        }
      } else {
        // No SignalWire number available, use default
        console.log('⚠️ No SignalWire number in context, using default broker');
        assignedBrokerId = DEFAULT_BROKER_ID;
        assignedBrokerName = DEFAULT_BROKER_NAME;
      }
      
      // Now look up the lead
      const result = await executeTool('get_lead_context', { phone: callerPhone });
      
      console.log('✅ Lead context retrieved:', JSON.stringify(result).substring(0, 200));
      this.logger.info({ result }, '✅ Lead context retrieved');
      
      // Build silent system message with real data
      let contextMessage = 'CALLER INFORMATION (use this real data, do not make up names or details):\n';
      
      if (result?.found) {
        // RETURNING CALLER - Use their existing data
        contextMessage += `- First name: ${result.raw?.first_name || 'Unknown'}\n`;
        contextMessage += `- Last name: ${result.raw?.last_name || 'Unknown'}\n`;
        contextMessage += `- Phone: ${callerPhone}\n`;
        contextMessage += `- City: ${result.raw?.property_city || 'Unknown'}\n`;
        contextMessage += `- Status: ${result.raw?.status || 'new'}\n`;
        
        // Use lead's assigned broker if they have one, otherwise use SignalWire number's broker
        const finalBrokerId = result.broker_id || assignedBrokerId;
        const finalBrokerName = result.broker_id 
          ? (result.context?.match(/broker.*?([A-Z][a-z]+)/i)?.[1] || assignedBrokerName)
          : assignedBrokerName;
        
        if (finalBrokerId) {
          contextMessage += `- Assigned broker first name: ${finalBrokerName}\n`;
          contextMessage += `- Broker ID for booking: ${finalBrokerId}\n`;
          this.callContext.broker_id = finalBrokerId;
        }
        
        contextMessage += '\nCRITICAL: This is a RETURNING CALLER. Use their real name and city. Follow the STATUS flow in your instructions.';
        
        // Store lead ID and phone for tool calls
        this.callContext.lead_id = result.lead_id;
        this.callContext.caller_phone = callerPhone;
      } else {
        // NEW CALLER - Create minimal lead record and use SignalWire number's broker
        contextMessage += '- Status: NEW CALLER (not in database)\n';
        contextMessage += `- Phone: ${callerPhone}\n`;
        
        if (assignedBrokerId) {
          contextMessage += `- Assigned broker: ${assignedBrokerName}\n`;
          contextMessage += `- Broker ID for booking: ${assignedBrokerId}\n`;
          this.callContext.broker_id = assignedBrokerId;
        }
        
        contextMessage += '\nThis is a first-time caller. Ask for their name and continue with Step 1. When booking, use the broker ID above.';
        
        // Store phone for creating lead record later
        this.callContext.caller_phone = callerPhone;
        this.callContext.is_new_lead = true;
      }
      
      // Inject as silent system message
      this.openaiSocket.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [{
            type: 'text',
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
          type: 'text',
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
    debug('🔵 startConversation() called, OpenAI ready:', this.openaiSocket?.readyState === WebSocket.OPEN, 'Already sent?', this.greetingSent);
    
    // Prevent duplicate greeting triggers
    if (this.greetingSent) {
      debug('⚠️ Greeting already sent, skipping duplicate call');
      return;
    }
    
    if (this.openaiSocket?.readyState === WebSocket.OPEN) {
      debug('🔵 Waiting 500ms before greeting to avoid cutting into connection audio...');
      
      // Wait 500ms to let the call connection settle before Barbara speaks
      setTimeout(() => {
        debug('🔵 Sending call_connected trigger to force Barbara to speak first');

        // Step 1: Create a conversation item that triggers Barbara's greeting
        // Include caller's phone number so she can auto-lookup
        const callerPhone = this.callContext.from || 'unknown';
        debug('🔵 Caller phone:', callerPhone);
        
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

