/**
 * Audio Bridge Handler (LEAN VERSION)
 * 
 * Stripped down to ONLY fixes for actual reported bugs:
 * 1. Tool timeouts (10-20s) - was 2.5s
 * 2. Token limit removed - was 400, caused mid-sentence cutoffs
 * 3. lead_id/broker_id persistence - was getting lost
 * 4. No audio throttle - was 50ms gaps causing choppiness
 * 5. Basic heartbeat + graceful shutdown
 * 
 * REMOVED all defensive/hypothetical guards:
 * - Response queue system
 * - Watchdog
 * - Soft-finalize timer
 * - Barge-in debounce
 * - Auto-nudge/VAD recovery
 * - Audio commit machinery
 * - Duplicate prompt injection paths
 */

const WebSocket = require('ws');
const { toolDefinitions, executeTool } = require('./tools');
const { getPromptForCall, injectVariables, determinePromptName } = require('./prompt-manager');
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
let BARBARA_HYBRID_PROMPT = '';
function loadPromptSafe() {
  if (BARBARA_HYBRID_PROMPT) return BARBARA_HYBRID_PROMPT;
  
  const candidates = [
    '../prompts/old big buitifl promtp.md',
    '../prompts/Prompt31_Master.md',
    '../prompts/BarbaraRealtimePrompt.md',
    '../prompts/Archived/BarbaraRealtimePrompt.md'
  ];
  
  for (const rel of candidates) {
    try {
      const p = path.join(__dirname, rel);
      BARBARA_HYBRID_PROMPT = fs.readFileSync(p, 'utf8');
      console.log('📝 Loaded prompt:', rel, 'length:', BARBARA_HYBRID_PROMPT.length);
      return BARBARA_HYBRID_PROMPT;
    } catch (err) {
      // Try next candidate
    }
  }
  
  console.warn('⚠️ No prompt file found - using minimal fallback');
  BARBARA_HYBRID_PROMPT = "You are Barbara, a warm scheduling assistant. Keep responses short and friendly.";
  return BARBARA_HYBRID_PROMPT;
}

/**
 * Audio Bridge - Lean Version
 */
class AudioBridge {
  constructor(signalWireSocket, logger, callContext = {}) {
    this.swSocket = signalWireSocket;
    this.logger = logger;
    this.callContext = callContext;
    this.openaiSocket = null;
    this.sessionConfigured = false;
    this.callStartTime = Date.now();
    this.callSid = null;
    this.callerPhone = null;
    this.greetingSent = false;
    
    // Transcript tracking for database storage
    this.conversationTranscript = [];
    
    // Track which prompt was used for PromptLayer logging
    this.promptName = null;
    this.promptSource = null;
    
    // Simple speaking flag (no complex queue)
    this.speaking = false;
    
    // Heartbeat to keep sockets alive
    this.heartbeatInterval = null;
    
    // Track pending audio sends to ensure completion
    this.pendingAudioSends = [];
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
    this.setupSignalWireHandlers();
  }

  /**
   * Setup OpenAI WebSocket event handlers
   */
  setupOpenAIHandlers() {
    this.openaiSocket.on('open', async () => {
      console.log('🤖 OpenAI Realtime connected!');
      this.logger.info('🤖 OpenAI Realtime connected');
      
      this.startHeartbeat();
      
      // OUTBOUND: Configure immediately
      if (this.callContext.instructions) {
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.configureSession();
        setTimeout(() => this.startConversation(), 1000);
      }
      // INBOUND: Wait for SignalWire 'start' event
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
    this.swSocket.on('message', (message) => {
      try {
        // Check if binary frame (Buffer) vs JSON string
        if (Buffer.isBuffer(message) && message.length > 0 && message[0] !== 0x7b) {
          console.warn('⚠️ SignalWire sent BINARY frame - not implemented!', message.length, 'bytes');
          this.logger.warn({ length: message.length }, '⚠️ Binary frame received - dropping');
          return;
        }
        
        const msg = JSON.parse(message.toString());
        this.handleSignalWireEvent(msg);
      } catch (err) {
        console.error('❌ Failed to parse SignalWire message:', err.message);
        this.logger.error({ err, messagePreview: message.toString().substring(0, 100) }, 'Error processing SignalWire message');
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
   * Look up lead context and build personalized prompt
   */
  async lookupAndBuildPrompt() {
    const callerPhone = this.extractCallerPhone();
    if (!callerPhone) {
      console.log('⚠️ WARNING: No caller phone found, using minimal prompt');
      const prompt = this.buildPromptFromTemplate({ callContext: 'inbound' });
      return {
        prompt,
        variables: { callContext: 'inbound' },
        lead_id: null,
        broker_id: null,
        context: 'inbound'
      };
    }

    console.log('📞 Looking up lead context for:', callerPhone);

    try {
      const result = await executeTool('get_lead_context', { phone: callerPhone });

      if (!result || !result.found || result.error) {
        console.log('⚠️ Lead not found in database - treating as new caller');
        const prompt = this.buildPromptFromTemplate({
          callContext: 'inbound',
          leadPhone: callerPhone,
          isNewCaller: true
        });
        return {
          prompt,
          variables: {
            callContext: 'inbound',
            leadPhone: callerPhone,
            isNewCaller: true,
            leadFirstName: '',
            brokerFirstName: 'one of our advisors'
          },
          lead_id: null,
          broker_id: null,
          context: 'inbound'
        };
      }

      // Calculate property and equity values with formatting
      const propertyValueRaw = result?.property_value ?? result?.raw?.property_value ?? null;
      const propertyValueNumber = propertyValueRaw !== null && propertyValueRaw !== undefined && propertyValueRaw !== ''
        ? Number(propertyValueRaw)
        : null;
      const propertyValueFormatted = propertyValueNumber !== null && !Number.isNaN(propertyValueNumber)
        ? Math.round(propertyValueNumber).toLocaleString('en-US')
        : '';
      const propertyValueWords = propertyValueNumber !== null && !Number.isNaN(propertyValueNumber)
        ? this.numberToWords(Math.round(propertyValueNumber))
        : '';

      const equityRaw = result?.estimated_equity ?? result?.raw?.estimated_equity ?? null;
      const estimatedEquityNumber = equityRaw !== null && equityRaw !== undefined && equityRaw !== ''
        ? Number(equityRaw)
        : null;
      const estimatedEquityFormatted = estimatedEquityNumber !== null && !Number.isNaN(estimatedEquityNumber)
        ? Math.round(estimatedEquityNumber).toLocaleString('en-US')
        : '';
      const estimatedEquityWords = estimatedEquityNumber !== null && !Number.isNaN(estimatedEquityNumber)
        ? this.numberToWords(Math.round(estimatedEquityNumber))
        : '';

      const mortgageRaw = result?.raw?.mortgage_balance ?? null;
      const mortgageBalanceNumber = mortgageRaw !== null && mortgageRaw !== undefined && mortgageRaw !== ''
        ? Number(mortgageRaw)
        : null;
      const mortgageBalanceWords = mortgageBalanceNumber !== null && !Number.isNaN(mortgageBalanceNumber)
        ? this.numberToWords(Math.round(mortgageBalanceNumber))
        : '';

      const qualifiedFlag = result?.qualified === true || result?.raw?.qualified === true || result?.status === 'qualified';

      // Build complete variables object with all property/equity data
      const variables = {
        callContext: 'inbound',
        signalwireNumber: this.callContext.to || '',
        leadFirstName: result?.raw?.first_name || '',
        leadLastName: result?.raw?.last_name || '',
        leadFullName: result?.raw?.first_name
          ? `${result.raw.first_name} ${result.raw.last_name || ''}`.trim()
          : '',
        leadEmail: result?.raw?.primary_email || '',
        leadPhone: callerPhone,
        propertyAddress: result?.raw?.property_address || '',
        propertyCity: result?.raw?.property_city || '',
        propertyState: result?.raw?.property_state || '',
        propertyZipcode: result?.raw?.property_zip || '',
        propertyValue: propertyValueFormatted,
        propertyValueWords,
        estimatedEquity: estimatedEquityFormatted,
        estimatedEquityWords,
        equity50Percent: estimatedEquityNumber !== null && !Number.isNaN(estimatedEquityNumber) ? Math.floor(estimatedEquityNumber * 0.5) : '',
        equity50FormattedWords: estimatedEquityNumber !== null && !Number.isNaN(estimatedEquityNumber) ? this.numberToWords(Math.floor(estimatedEquityNumber * 0.5)) : '',
        equity60Percent: estimatedEquityNumber !== null && !Number.isNaN(estimatedEquityNumber) ? Math.floor(estimatedEquityNumber * 0.6) : '',
        equity60FormattedWords: estimatedEquityNumber !== null && !Number.isNaN(estimatedEquityNumber) ? this.numberToWords(Math.floor(estimatedEquityNumber * 0.6)) : '',
        mortgageBalanceWords,
        qualified: qualifiedFlag,
        leadStatus: result?.status || '',
        brokerCompany: result?.broker?.company_name || '',
        brokerFullName: result?.broker?.contact_name || '',
        brokerFirstName: result?.broker?.contact_name ? result.broker.contact_name.split(' ')[0] : '',
        brokerNmls: result?.broker?.nmls_number || '',
        brokerPhone: result?.broker?.phone || '',
        brokerDisplay: result?.broker?.contact_name
          ? `${result.broker.contact_name}, NMLS ${result.broker.nmls_number || 'licensed'}`
          : '',
        personaSenderName: '',
        personaFirstName: '',
        campaignArchetype: '',
        personaAssignment: '',
        preferredLanguage: result?.raw?.preferred_language || 'en'
      };

      console.log('✅ Lead context retrieved:', {
        found: result?.found,
        name: variables.leadFirstName,
        city: variables.propertyCity,
        broker: variables.brokerFirstName,
        qualified: qualifiedFlag
      });

      const prompt = this.buildPromptFromTemplate(variables);

      return {
        prompt,
        variables,
        propertyValueNumber,
        estimatedEquityNumber,
        mortgageBalanceNumber,
        qualifiedFlag,
        lead_id: result.lead_id,
        broker_id: result.broker_id,
        leadStatus: result.status || '',
        context: this.callContext.context || 'inbound'
      };

    } catch (err) {
      console.error('❌ Failed to lookup lead context:', err);
      console.error('❌ Error stack:', err.stack);
      const prompt = this.buildPromptFromTemplate({ callContext: 'inbound' });
      return {
        prompt,
        variables: { callContext: 'inbound' },
        propertyValueNumber: null,
        estimatedEquityNumber: null,
        mortgageBalanceNumber: null,
        qualifiedFlag: false,
        lead_id: null,
        broker_id: null,
        leadStatus: '',
        context: this.callContext.context || 'inbound'
      };
    }
  }
  
  /**
   * Extract caller phone from SignalWire metadata
   */
  extractCallerPhone() {
    if (this.callContext.to_phone) return this.callContext.to_phone;
    if (this.callContext.from) return this.callContext.from;
    if (this.callerPhone) return this.callerPhone;
    return null;
  }
  
  /**
   * Build prompt from template by replacing variables
   */
  buildPromptFromTemplate(variables) {
    let prompt = loadPromptSafe();
    
    // Process {{#if ...}}...{{else}}...{{/if}} conditionals
    const conditionalElseRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
    prompt = prompt.replace(conditionalElseRegex, (match, varName, ifContent, elseContent) => {
      return variables[varName] ? ifContent : elseContent;
    });
    
    // Process simple {{#if}} conditionals
    const conditionalRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    prompt = prompt.replace(conditionalRegex, (match, varName, content) => {
      return variables[varName] ? content : '';
    });
    
    // Replace all {{variable}} placeholders
    prompt = prompt.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] ?? '');
    
    return prompt;
  }
  
  /**
   * Convert number to words (for natural speech)
   */
  numberToWords(value) {
    if (value === null || value === undefined) return '';
    
    // Clean input - remove commas, dollar signs, etc.
    const cleaned = String(value).replace(/[^\d.]/g, '');
    const num = Math.floor(Number(cleaned));
    
    if (!Number.isFinite(num) || num < 0) return '';
    if (num === 0) return 'zero';

    // Handle millions
    if (num >= 1_000_000) {
      const m = num / 1_000_000;
      const whole = Math.floor(m);
      const frac = m - whole;
      
      return frac === 0
        ? `${this.numberWord(whole)} million`
        : `${m.toFixed(1)} million`;
    }
    
    // Handle thousands
    if (num >= 1_000) {
      const thousands = Math.floor(num / 1_000);
      const remainder = num % 1_000;
      return remainder
        ? `${this.numberWord(thousands)} thousand ${this.numberWord(remainder)}`
        : `${this.numberWord(thousands)} thousand`;
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
   * Configure OpenAI Realtime session (SINGLE SOURCE OF TRUTH)
   */
  async configureSession() {
    debug('🔵 configureSession() called');
    
    let instructions;
    let promptSource = 'unknown';

    // Step 1: Get lead context and build variables
    let variables = {};
    let promptCallContext = {
      context: this.callContext.context || 'inbound',
      lead_id: this.callContext.lead_id,
      from_phone: this.callerPhone,
      to_phone: this.callContext.to_phone,
      has_property_data: false,
      is_qualified: false
    };

    try {
      const promptBuildResult = await this.lookupAndBuildPrompt();

      if (promptBuildResult && promptBuildResult.variables) {
        variables = promptBuildResult.variables;
        
        // CRITICAL: Update callContext with lead_id from lookup result
        if (promptBuildResult.lead_id) {
          this.callContext.lead_id = promptBuildResult.lead_id;
        }
        if (promptBuildResult.broker_id) {
          this.callContext.broker_id = promptBuildResult.broker_id;
        }

        promptCallContext = {
          context: this.callContext.context || 'inbound',
          lead_id: this.callContext.lead_id,
          from_phone: this.callerPhone,
          to_phone: this.callContext.to_phone,
          has_property_data: false,
          is_qualified: false
        };
        
        console.log('✅ Lead context retrieved:', {
          lead_id: promptCallContext.lead_id,
          variables_count: Object.keys(variables).length
        });
      } else {
        console.warn('⚠️ lookupAndBuildPrompt returned empty - using minimal context');
        variables = { callContext: 'inbound' };
      }
    } catch (err) {
      console.error('❌ Failed to lookup lead context:', err.message);
      variables = { callContext: 'inbound' };
    }

    // Step 2: Try to get prompt from PromptLayer
    try {
      console.log('🍰 Fetching prompt from PromptLayer with context:', promptCallContext);
      
      const promptTemplate = await getPromptForCall(
        promptCallContext,
        this.callContext.instructions
      );

      if (!promptTemplate || promptTemplate.length === 0) {
        throw new Error('PromptLayer returned empty prompt');
      }

      instructions = injectVariables(promptTemplate, variables);
      promptSource = 'promptlayer';
      this.promptName = determinePromptName(promptCallContext);
      this.promptSource = promptSource;
      
      console.log(`🍰 Successfully built prompt from PromptLayer (${instructions.length} chars)`);
      
    } catch (promptLayerError) {
      console.error('❌ PromptLayer fetch failed:', promptLayerError.message);
      console.warn('⚠️ Falling back to local prompt file');
      
      try {
        const cachedPrompt = await getPromptForCall(promptCallContext);
        instructions = injectVariables(cachedPrompt, variables);
        promptSource = 'cached_promptlayer';
        this.promptName = determinePromptName(promptCallContext);
        this.promptSource = promptSource;
        console.log(`🍰 Using cached PromptLayer template (${instructions.length} chars)`);
      } catch (fallbackError) {
        instructions = "You are Barbara, a warm scheduling assistant. Keep responses short and friendly.";
        promptSource = 'minimal_emergency';
        this.promptName = 'minimal-emergency-prompt';
        this.promptSource = promptSource;
        console.warn('⚠️ Using emergency minimal prompt');
      }
    }

    console.log('📋 Final prompt details:', {
      source: promptSource,
      length: instructions.length,
      preview: instructions.substring(0, 150).replace(/\n/g, ' ')
    });
    
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        voice: process.env.REALTIME_VOICE || 'alloy',
        instructions: instructions,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        temperature: 0.75,
        max_response_output_tokens: 'inf',  // FIX #1: No artificial limit
        turn_detection: {
          type: 'server_vad',
          threshold: 0.80,
          prefix_padding_ms: 200,
          silence_duration_ms: 700
        },
        tools: toolDefinitions,
        tool_choice: 'auto'
      }
    };
    
    if (!this.openaiSocket || this.openaiSocket.readyState !== WebSocket.OPEN) {
      const currentState = this.openaiSocket?.readyState;
      throw new Error(`Cannot configure session - OpenAI socket not ready (state: ${currentState})`);
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
        break;

      case 'response.audio.delta':
        if (event.delta) {
          const sendPromise = this.sendMediaToSignalWire(event.delta);
          if (sendPromise instanceof Promise) {
            this.pendingAudioSends.push(sendPromise);
          }
        }
        break;

      case 'response.audio.done':
        // Wait for all pending audio chunks to finish
        if (this.pendingAudioSends && this.pendingAudioSends.length > 0) {
          debug(`⏳ Waiting for ${this.pendingAudioSends.length} pending audio chunks...`);
          await Promise.race([
            Promise.all(this.pendingAudioSends),
            new Promise(resolve => setTimeout(resolve, 30000))
          ]);
          this.pendingAudioSends = [];
          debug('✅ All pending audio chunks sent');
        }
        
        this.speaking = false;
        
        // Add 300ms silence tail to prevent telephony buffer clip
        const silenceTail = Buffer.alloc(9600).toString('base64'); // 300ms @ 16kHz PCM16
        
        setTimeout(() => {
          if (this.swSocket?.readyState === WebSocket.OPEN) {
            this.swSocket.send(JSON.stringify({
              event: 'media',
              streamSid: this.callSid || 'unknown',
              media: { payload: silenceTail }
            }));
            debug('🔇 Sent 300ms silence tail');
          }
        }, 100);
        
        this.logger.info('🔊 AI finished speaking');
        break;
      
      case 'response.created':
        this.speaking = true;
        debug('🎙️ Response generation started');
        break;
      
      case 'response.done':
      case 'response.completed':
        this.speaking = false;
        debug('✅ Response completed');
        break;
      
      case 'response.canceled':
      case 'response.cancelled':
      case 'response.interrupted':
        this.speaking = false;
        console.log(`⚠️ Response stopped: ${event.type}`);
        break;
      
      case 'input_audio_buffer.speech_started':
        debug('👤 User started speaking');
        break;
      
      case 'input_audio_buffer.speech_stopped':
        debug('👤 User stopped speaking');
        break;

      case 'response.function_call_arguments.done':
        await this.handleToolCall(event);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        const userTranscript = event.transcript;
        console.log('👤 User said:', userTranscript);
        this.logger.info({ transcript: userTranscript }, '👤 User transcription');
        
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
          this.logger.info({ transcript: barbaraTranscript }, '🤖 Barbara transcription');
          
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
        this.speaking = false; // Unlock on error
        break;

      default:
        if (!event.type.includes('delta') && !event.type.includes('transcript')) {
          debug('⚠️ Unhandled OpenAI event:', event.type);
        }
        break;
    }
  }

  /**
   * Handle SignalWire events
   */
  async handleSignalWireEvent(msg) {
    if (msg.event !== 'media') {
      debug('📞 SignalWire event:', msg.event);
    }
    
    switch (msg.event) {
      case 'start':
        this.callSid = msg.start.callSid;
        
        const cp = msg.start?.customParameters || {};
        if (cp.from) {
          this.callContext.from = cp.from;
          this.callerPhone = cp.from;
          console.log('📞 Caller phone extracted:', cp.from);
        }
        if (cp.to) {
          this.callContext.to = cp.to;
          console.log('📞 SignalWire number called:', cp.to);
        }
        
        console.log('📞 Call started, CallSid:', this.callSid);
        this.logger.info({ callSid: this.callSid, from: this.callContext.from }, '📞 Call started');
        
        // INBOUND: Configure session with caller context
        if (!this.callContext.instructions && this.callerPhone && !this.sessionConfigured) {
          console.log('🔄 Inbound call - configuring session with caller context');
          
          // Wait for OpenAI socket to be open
          const waitForOpen = () => new Promise((resolve, reject) => {
            if (this.openaiSocket?.readyState === WebSocket.OPEN) {
              resolve();
              return;
            }
            
            const checkInterval = setInterval(() => {
              if (this.openaiSocket?.readyState === WebSocket.OPEN) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 50);
            
            setTimeout(() => {
              clearInterval(checkInterval);
              reject(new Error('OpenAI socket timeout'));
            }, 5000);
          });
          
          try {
            await waitForOpen();
            await this.configureSession();
            setTimeout(() => this.startConversation(), 500);
          } catch (err) {
            console.error('❌ Failed to configure session:', err);
            this.cleanup();
          }
        }
        break;

      case 'media':
        // Track incoming media for diagnostics
        if (!this._lastInputAudioAt) {
          this._lastInputAudioAt = 0;
          this._inputAudioCount = 0;
        }
        this._inputAudioCount++;
        this._lastInputAudioAt = Date.now();
        
        // Log periodically to confirm audio is flowing (every 5 seconds)
        if (!this._lastInputAudioLog || Date.now() - this._lastInputAudioLog > 5000) {
          console.log(`📊 Input audio flowing: ${this._inputAudioCount} packets, last: ${new Date(this._lastInputAudioAt).toISOString()}`);
          this._lastInputAudioLog = Date.now();
        }
        
        if (msg.media?.payload && this.openaiSocket?.readyState === WebSocket.OPEN) {
          this.openaiSocket.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: msg.media.payload
          }));
        }
        break;

      case 'stop':
        this.logger.info('📞 Call ended by SignalWire');
        
        // Cancel any in-progress response
        try {
          if (this.openaiSocket?.readyState === WebSocket.OPEN) {
            this.openaiSocket.send(JSON.stringify({ type: 'response.cancel' }));
          }
        } catch (err) {
          debug('⚠️ Error canceling response:', err);
        }
        
        this.saveCallSummary();
        this.cleanup();
        break;
    }
  }

  /**
   * Send media (audio) to SignalWire
   * FIX #4: No artificial throttle (removed 50ms gaps)
   */
  async sendMediaToSignalWire(audioData) {
    if (this.swSocket.readyState !== WebSocket.OPEN) {
      console.error('❌ Cannot send audio - SignalWire socket not open');
      return;
    }
    
    const audioBuffer = Buffer.from(audioData, 'base64');
    const maxChunkSize = 6400; // FIX #3: 200ms @ 16kHz PCM16 (was 9600 for 24kHz)
    
    if (audioBuffer.length > maxChunkSize) {
      debug(`📦 Splitting large chunk (${audioBuffer.length} bytes)`);
      
      for (let offset = 0; offset < audioBuffer.length; offset += maxChunkSize) {
        const chunk = audioBuffer.slice(offset, offset + maxChunkSize);
        await this.sendSingleChunk(chunk.toString('base64'));
      }
    } else {
      await this.sendSingleChunk(audioData);
    }
  }
  
  /**
   * Send a single audio chunk (no throttle, just buffer check)
   */
  async sendSingleChunk(audioData) {
    if (this.swSocket.readyState === WebSocket.OPEN) {
      try {
        // Check buffer before sending to prevent overflow
        while (this.swSocket.bufferedAmount > 19200) {
          debug(`⏸️ WebSocket buffer full, waiting...`);
          await new Promise(r => setTimeout(r, 20));
        }
        
        this.swSocket.send(JSON.stringify({
          event: 'media',
          streamSid: this.callSid || 'unknown',
          media: { payload: audioData }
        }));
        debug(`✅ Audio sent to SignalWire`);
      } catch (err) {
        console.error(`❌ Failed to send audio chunk:`, err.message);
      }
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

        const callerPhone = this.callContext.from || 'unknown';
        
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
        
        // Simple response.create (no queue)
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
   * Wrap promise with timeout
   * FIX #2: Tool-specific timeouts (10-20s instead of 2.5s)
   */
  withTimeout(promise, ms = 10000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Tool execution timeout')), ms))
    ]);
  }

  /**
   * Handle tool calls from OpenAI
   */
  async handleToolCall(event) {
    const { call_id, name, arguments: argsJson } = event;
    
    console.log('🔧 Tool called:', name);
    this.logger.info({ function: name, call_id }, '🔧 Tool called');
    
    if (!this.openaiSocket || this.openaiSocket.readyState !== WebSocket.OPEN) {
      console.error('❌ Cannot execute tool - socket closed');
      return;
    }
    
    try {
      let args = {};
      try {
        args = JSON.parse(argsJson || '{}');
      } catch (parseErr) {
        console.error('⚠️ Failed to parse tool args:', parseErr);
        args = {};
      }
      
      // Inject prompt version for PromptLayer logging
      if (name === 'save_interaction' && args.metadata) {
        args.metadata.prompt_version = this.promptName || 'unknown';
        args.metadata.prompt_source = this.promptSource || 'unknown';
      }
      
      // FIX #2: Tool-specific timeouts
      let timeoutMs = 10000; // Default: 10s
      if (name === 'search_knowledge') timeoutMs = 20000;  // 20s for vector search
      if (name === 'check_broker_availability') timeoutMs = 15000;  // 15s for Nylas
      if (name === 'book_appointment') timeoutMs = 15000;  // 15s for Nylas
      
      console.log(`⏱️ Executing ${name} with ${timeoutMs/1000}s timeout...`);
      const result = await this.withTimeout(executeTool(name, args), timeoutMs);
      
      console.log('✅ Tool executed:', name);
      this.logger.info({ function: name, result }, '✅ Tool executed');
      
      if (this.openaiSocket.readyState !== WebSocket.OPEN) {
        console.error('❌ Socket closed during tool execution');
        return;
      }
      
      this.openaiSocket.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id,
          output: JSON.stringify(result)
        }
      }));
      
      // Continue response (simple - no queue)
      if (!this.speaking) {
        this.speaking = true;
        this.openaiSocket.send(JSON.stringify({
          type: 'response.create',
          response: {}
        }));
      }
      
    } catch (err) {
      console.error('❌ Tool execution failed:', name, err.message);
      this.logger.error({ err, function: name }, '❌ Tool execution failed');
      
      let fallbackMessage = 'I\'m having a little trouble with that right now, but I can still help you!';
      if (name === 'search_knowledge') {
        fallbackMessage = 'Let me connect you with a specialist who can answer that.';
      } else if (name === 'check_broker_availability' || name === 'book_appointment') {
        fallbackMessage = 'Let me have someone call you back to schedule that.';
      }
      
      if (this.openaiSocket.readyState !== WebSocket.OPEN) return;
      
      try {
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
        
        if (!this.speaking) {
          this.speaking = true;
          this.openaiSocket.send(JSON.stringify({
            type: 'response.create',
            response: {}
          }));
        }
      } catch (sendErr) {
        console.error('❌ Failed to send error response:', sendErr);
      }
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
    
    if (this.callContext.lead_id) {
      try {
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
        
        console.log('✅ Interaction saved to PromptLayer');
        
      } catch (err) {
        console.error('❌ Failed to save interaction:', err.message);
      }
    } else {
      console.warn('⚠️ No lead_id - skipping interaction save');
    }
  }

  /**
   * Start heartbeat to keep sockets alive
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

      try {
        if (this.swSocket?.readyState === WebSocket.OPEN) {
          this.swSocket.ping?.();
          debug('💓 SignalWire heartbeat sent');
        }
      } catch (err) {
        debug('⚠️ SignalWire ping failed:', err);
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

