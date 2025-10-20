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

// Load Barbara's original "big beautiful prompt" (Prompt31_Master)
const BARBARA_HYBRID_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/Archived/old big buitifl promtp.md'),
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
    this.gracefulShutdown = false;  // Track if we're in graceful shutdown mode
    this.gracefulShutdownTimer = null;  // Timeout for graceful shutdown
    this.sessionConfigTimeout = null;  // Timeout to ensure session gets configured (fallback)
    
    // Rate limiting and response queue management
    this.responseQueue = [];  // Queue for pending response.create calls
    this.backoffUntil = 0;  // Timestamp when we can send again (rate limit backoff)
    this.speaking = false;  // Track if Barbara is currently speaking (single-flight)
    
    // Heartbeat to keep sockets alive
    this.heartbeatInterval = null;  // Ping both sockets every 15s to prevent timeout
    
    // Audio buffer accounting (PCM16 @ 16kHz)
    this.bufferedAudioBytes = 0;  // Bytes accumulated since last commit
    this.lastAudioAppendAt = 0;  // Timestamp of last append
    this.audioCommitInterval = null;  // Interval for checking if commit needed
    this.hasAppendedSinceLastCommit = false;  // Track if new audio appended since last commit
    this.commitLockedUntil = 0;  // Cooldown after buffer clear to prevent empty commits
    
    // Additional tracking
    this._lastSampleAt = 0;  // Track last audio sample during backoff
    this._lastEmptyEnqueue = 0;  // Track last empty enqueue for dedupe
    this._lastAudioSentAt = 0;  // Track last audio sent to SignalWire for throttling
    this.firstAudioLogged = false;  // Track first audio for perf metrics
    
    // Barge-in protection (prevent false cancels from noise)
    this.userSpeechSince = 0;  // When user started speaking
    this.cancelDebounceTimer = null;  // Debounce timer for barge-in
    
    // Audio tail padding (prevent telephony buffer clip)
    this.ttsOutBuf = Buffer.alloc(0);  // Output jitter buffer for smooth playback
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
      
      // Start heartbeat (only after socket is open)
      // Audio commits will start when first audio is received
      this.startHeartbeat();
      
      // OUTBOUND calls: Configure immediately (we have all context from n8n)
      if (this.callContext.instructions) {
        console.log('🔵 Outbound call - configuring session with provided context');
        await this.configureSession();
        this.startAutoResumeMonitor();
        
        // Start conversation after 1s delay
        setTimeout(() => {
          debug('🔵 Triggering outbound greeting');
          this.startConversation();
        }, 1000);
      }
      // INBOUND calls: WAIT for SignalWire 'start' event to get caller phone
      // Then lookup lead, THEN configure session with their context
      else {
        console.log('🔵 Inbound call - waiting for caller phone from SignalWire start event');
        console.log('⏰ Will configure session after getting phone (max 3s wait)');
        
        // FALLBACK: If SignalWire doesn't send phone within 3 seconds, configure with generic prompt
        this.sessionConfigTimeout = setTimeout(() => {
          if (!this.sessionConfigured) {
            console.log('⏰ Timeout - no caller phone received, using generic greeting');
            this.callContext.instructions = this.buildPromptFromTemplate({ 
              callContext: 'inbound',
              isNewCaller: true,
              leadFirstName: '',
              brokerFirstName: 'one of our advisors'
            });
            this.configureSession().then(() => {
              this.startAutoResumeMonitor();
              setTimeout(() => this.startConversation(), 500);
            }).catch(err => {
              console.error('❌ Failed to configure session in timeout fallback:', err);
            });
          }
        }, 3000); // 3 second timeout
      }
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

    // Heartbeat and audio commits will be started in 'open' handler
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
      console.log('⚠️ WARNING: No caller phone found, using minimal prompt');
      return {
        prompt: this.buildPromptFromTemplate({ callContext: 'inbound' }),
        variables: { callContext: 'inbound' }
      };
    }
    
    console.log('📞 Looking up lead context for:', callerPhone);
    
    try {
      // Look up lead from database
      const result = await executeTool('get_lead_context', { phone: callerPhone });
      
      // Check if lead was found
      if (!result || !result.found || result.error) {
        console.log('⚠️ Lead not found in database - treating as new caller');
        console.log('📝 Will create new lead record during call with phone:', callerPhone);
        
        // Return new caller prompt (friendly, collect info during call)
        return {
          prompt: this.buildPromptFromTemplate({ 
            callContext: 'inbound',
            leadPhone: callerPhone,
            isNewCaller: true 
          }),
          variables: { 
            callContext: 'inbound',
            leadPhone: callerPhone,
            isNewCaller: true,
            leadFirstName: '',
            leadLastName: '',
            propertyCity: '',
            brokerFirstName: 'one of our advisors'
          }
        };
      }
      
      // Build variables object from lead context
      const variables = {
        // Call context
        callContext: 'inbound',
        signalwireNumber: this.callContext.to || '',  // The SignalWire number that was called
        
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
      
      console.log('✅ Lead context retrieved:', {
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
      console.error('❌ Error stack:', err.stack);
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
    
    // 1) Process {{#if ...}}...{{else}}...{{/if}} conditionals FIRST (avoids swallowing)
    const conditionalElseRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
    prompt = prompt.replace(conditionalElseRegex, (match, varName, ifContent, elseContent) => {
      return variables[varName] ? ifContent : elseContent;
    });
    
    // 2) Then process simple {{#if}} conditionals
    const conditionalRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    prompt = prompt.replace(conditionalRegex, (match, varName, content) => {
      return variables[varName] ? content : '';
    });
    
    // 3) Replace all {{variable}} placeholders in single pass
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
      
      // Prefer natural phrasing: "one point three million" vs "1.3 million"
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
        voice: process.env.REALTIME_VOICE || 'alloy',  // Fallback if 'sage' not available
        instructions: instructions,  // Static prompt (cacheable)
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        temperature: 0.75,  // Warmer, more natural conversation (up from 0.6)
        max_response_output_tokens: 200,  // Increased from 100 - was cutting off mid-sentence
        turn_detection: {
          type: 'server_vad',
          threshold: 0.8,  // High but not max - catches speech, reduces phone handling triggers
          prefix_padding_ms: 300,  // Standard padding
          silence_duration_ms: 600  // Balanced for seniors who trail off
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
    // Debug log all OpenAI events (very noisy - only enable when debugging)
    debug('🤖 OpenAI event:', event.type);

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
          // Log first audio out for performance metrics
          if (!this.firstAudioLogged) {
            const firstAudioMs = Date.now() - this.callStartTime;
            console.log(`🎯 First audio out: ${firstAudioMs}ms from call start`);
            this.firstAudioLogged = true;
          }
          this.sendMediaToSignalWire(event.delta);
        }
        break;

      case 'response.audio.done':
        // Mark not speaking
        this.speaking = false;
        this.responseInProgress = false;
        
        // Add 150ms silence tail to prevent telephony buffer clip
        // SignalWire's buffer may cut off last 100-200ms without padding
        const silenceTail = Buffer.alloc(4800).toString('base64'); // 150ms @ 16kHz PCM16
        
        setTimeout(() => {
          if (this.swSocket?.readyState === WebSocket.OPEN) {
            this.swSocket.send(JSON.stringify({
              event: 'media',
              streamSid: this.callSid || 'unknown',
              media: {
                payload: silenceTail
              }
            }));
            debug('🔇 Sent 150ms silence tail to prevent clip');
          }
          
          // Now drain queue after tail is sent
          this.drainResponseQueue();
        }, 50); // Small delay to ensure last audio chunk is sent first
        
        this.logger.info('🔊 AI finished speaking');
        break;
      
      case 'response.created':
        // Response generation started
        this.responseInProgress = true;
        this.speaking = true;  // Mark as speaking for single-flight enforcement
        debug('🎙️ Response generation started');
        break;
      
      case 'response.output_item.done':
        // Barbara finished speaking an item (could be mid-response)
        this.lastResponseAt = Date.now();
        debug('✅ Output item completed, tracking for auto-resume');
        break;
      
      case 'response.done':
      case 'response.completed':
        // Track when Barbara finished speaking
        this.lastResponseAt = Date.now();
        this.responseInProgress = false;  // Response fully completed
        this.speaking = false;  // No longer speaking - ready for next response
        debug('✅ Response completed, tracking for auto-resume');
        
        // Drain queued responses (single-flight pattern)
        this.drainResponseQueue();
        
        // If in graceful shutdown, cleanup now that response is done
        if (this.gracefulShutdown) {
          this.logger.info('✅ Response completed during graceful shutdown - cleaning up now');
          this.cleanup();
        }
        break;
      
      case 'response.interrupted':
      case 'response.canceled':      // ✅ US spelling (CRITICAL - this is what OpenAI sends!)
      case 'response.cancelled':     // UK spelling (keep just in case)
      case 'response.truncated':     // Sometimes used when cut short
        // Barbara was interrupted - mark response as no longer in progress
        this.responseInProgress = false;
        this.speaking = false;  // No longer speaking - ready for next response
        console.log(`⚠️ Response stopped early: ${event.type}`);
        
        // Clear input audio buffer to avoid stale audio
        if (this.openaiSocket?.readyState === WebSocket.OPEN) {
          this.openaiSocket.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
          debug('🧹 Cleared input audio buffer after interruption');
          
          // Prevent empty commit right after clear
          this.bufferedAudioBytes = 0;
          this.hasAppendedSinceLastCommit = false;
          this.commitLockedUntil = Date.now() + 600;  // 600ms cooldown
        }
        
        // Drain queued responses (this is CRITICAL - prevents permanent silence!)
        this.drainResponseQueue();
        break;
      
      case 'input_audio_buffer.speech_started':
        // User started speaking
        this.userSpeaking = true;
        this.awaitingUser = false;
        this.nudgedOnce = false;
        this.userSpeechSince = Date.now();
        debug('👤 User started speaking');
        
        // VAPI-style barge-in: require 600ms of speech (≈2-3 words) before canceling
        // This prevents mouse clicks, coughs, single syllables from interrupting
        if (this.responseInProgress && !this.cancelDebounceTimer) {
          this.cancelDebounceTimer = setTimeout(() => {
            const speechDuration = Date.now() - (this.userSpeechSince || Date.now());
            
            // Only cancel if user spoke for at least 600ms (real speech, not noise)
            if (this.responseInProgress && speechDuration >= 600) {
              debug('⚠️ Real barge-in detected (600ms speech) - canceling Barbara');
              this.openaiSocket.send(JSON.stringify({
                type: 'response.cancel'
              }));
              this.responseInProgress = false;
              
              // Clear audio buffer
              this.openaiSocket.send(JSON.stringify({
                type: 'input_audio_buffer.clear'
              }));
              this.bufferedAudioBytes = 0;
              this.hasAppendedSinceLastCommit = false;
              this.commitLockedUntil = Date.now() + 600;
            } else {
              debug('⚠️ Short noise detected (<600ms) - NOT canceling Barbara');
            }
            this.cancelDebounceTimer = null;
          }, 620); // Wait 620ms to measure speech duration
        }
        break;
      
      case 'input_audio_buffer.speech_stopped':
        // User stopped speaking
        this.userSpeaking = false;
        this.userSpeechSince = 0;
        
        // Clear debounce timer if speech stopped before reaching 600ms threshold
        if (this.cancelDebounceTimer) {
          clearTimeout(this.cancelDebounceTimer);
          this.cancelDebounceTimer = null;
          debug('⏹️ Speech stopped before 600ms - cancel timer cleared');
        }
        
        debug('👤 User stopped speaking');
        
        // If Barbara was interrupted but user said nothing (false positive from noise),
        // resume her response after brief delay
        if (!this.responseInProgress && this.lastResponseAt > 0) {
          const timeSinceLastResponse = Date.now() - this.lastResponseAt;
          // If less than 2 seconds since Barbara last spoke, she was likely interrupted mid-thought
          if (timeSinceLastResponse < 2000 && this.currentResponseTranscript) {
            debug('🔄 False interruption detected - resuming Barbara with context');
            setTimeout(() => {
              if (!this.userSpeaking && !this.responseInProgress) {
                // Resume with context of what she was saying
                this.resumeWithContext();
              }
            }, 500);  // Wait 500ms to ensure user is really done
          }
        }
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

      case 'rate_limits.updated':
        // CRITICAL: Pass the full event so tolerant parser can read either shape
        this.handleRateLimits(event);
        break;

      case 'error':
        const errorCode = event.error?.code;
        
        // Downgrade empty buffer commits to warning (non-fatal, expected occasionally)
        if (errorCode === 'input_audio_buffer_commit_empty') {
          this.logger.warn({ error: event.error }, '⚠️ Commit skipped (empty buffer)');
          break;
        }
        
        console.error('❌ OpenAI error event:', JSON.stringify(event.error));
        this.logger.error({ error: event.error }, '❌ OpenAI error');
        
        // Handle rate limit errors specifically
        if (errorCode === 'rate_limit_exceeded') {
          console.error('🚨 RATE LIMIT EXCEEDED - Too many calls to OpenAI API');
          this.logger.error('🚨 Rate limit exceeded - check OpenAI account tier and usage');
          // Gracefully end the call
          this.cleanup();
        }
        break;

      default:
        // Log unhandled events for debugging
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
          console.log('📞 Caller phone extracted:', cp.from); // Always log - critical for debugging
        } else {
          console.log('⚠️ WARNING: No caller phone in customParameters!', { customParameters: cp });
        }
        if (cp.to) {
          this.callContext.to = cp.to;
          console.log('📞 SignalWire number called:', cp.to);
        }
        
        console.log('📞 Call started, CallSid:', this.callSid); // Always log call start
        this.logger.info({ callSid: this.callSid, from: this.callContext.from }, '📞 Call started');
        
        // For INBOUND calls: Send quick ack while configureSession() does the lookup
        if (!this.callContext.instructions && this.callerPhone) {
          // Send quick acknowledgment to buy time for lookup
          try {
            this.sendQuickAcknowledgment();
          } catch (e) {
            debug('⚠️ Quick ack failed (non-fatal):', e);
          }
          
          // NOTE: forceLeadContextLookup() REMOVED - it was racing with configureSession()
          // and injecting conflicting "not found" messages. configureSession() now handles
          // the lookup properly using the tool, which is faster and more reliable.
        }
        
        // For INBOUND calls: NOW we have caller phone - configure session with their context
        if (!this.callContext.instructions && this.callerPhone && !this.sessionConfigured) {
          console.log('🔄 Inbound call - configuring session with caller context:', this.callerPhone);
          
          // Clear the timeout - we got the phone in time!
          if (this.sessionConfigTimeout) {
            clearTimeout(this.sessionConfigTimeout);
            this.sessionConfigTimeout = null;
          }
          
          // WAIT for OpenAI socket to be fully open before configuring
          const waitForOpen = () => new Promise((resolve) => {
            if (this.openaiSocket?.readyState === WebSocket.OPEN) {
              resolve();
            } else {
              const checkInterval = setInterval(() => {
                if (this.openaiSocket?.readyState === WebSocket.OPEN) {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 50); // Check every 50ms
              
              // Timeout after 3 seconds
              setTimeout(() => {
                clearInterval(checkInterval);
                resolve(); // Continue anyway
              }, 3000);
            }
          });
          
          try {
            // Wait for socket to be ready
            await waitForOpen();
            console.log('✅ OpenAI socket ready - configuring session');
            
            // Configure session with personalized prompt (includes lead lookup)
            await this.configureSession();
            this.startAutoResumeMonitor();
            
            // Inject caller-specific greeting instructions BEFORE starting conversation
            await this.injectCallerGreeting();
            
            // Wait brief moment for session to be ready, then trigger greeting
            setTimeout(() => {
              console.log('🔵 Session configured with personalized context - triggering greeting');
              this.startConversation();
            }, 500);
            
          } catch (err) {
            console.error('❌ Failed to configure session with lead context:', err);
            console.error('❌ Error details:', err.message);
            // Fallback: configure with minimal prompt
            this.callContext.instructions = this.buildPromptFromTemplate({ callContext: 'inbound' });
            await waitForOpen();
            await this.configureSession();
            this.startAutoResumeMonitor();
            setTimeout(() => this.startConversation(), 500);
          }
        } 
        // Outbound calls already configured in 'open' handler
        else if (this.sessionConfigured && this.callContext.instructions) {
          debug('🔵 Outbound call - greeting already triggered');
        }
        break;

      case 'media':
        // Send audio to OpenAI (silent - happens every 20ms)
        // Skip if in graceful shutdown - call has ended
        if (this.gracefulShutdown) {
          return;
        }

        // ⛔ BACKPRESSURE: Sample audio lightly during backoff (keeps VAD alive)
        // Don't drop ALL frames or barge-in detection will fail
        if (!this.canSend()) {
          const now = Date.now();
          this._lastSampleAt = this._lastSampleAt || 0;
          if (now - this._lastSampleAt < 200) return;  // Sample ~5 fps during backoff
          this._lastSampleAt = now;
          debug('⏳ Sampling audio during backoff (keep VAD alive)');
        }
        
        if (msg.media?.payload && this.openaiSocket?.readyState === WebSocket.OPEN) {
          this.openaiSocket.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: msg.media.payload
          }));
          
          // Account for bytes to ensure ≥100ms before commit
          try {
            const bytes = Buffer.from(msg.media.payload, 'base64').length;
            this.bufferedAudioBytes += bytes;
            this.lastAudioAppendAt = Date.now();
            this.hasAppendedSinceLastCommit = true;  // Flag that we have new audio
            
            // DISABLED: Auto-commits still causing issues despite all guards
            // Server VAD works WITHOUT explicit commits
            // if (!this.audioCommitInterval) {
            //   this.startAudioCommitInterval();
            // }
          } catch (err) {
            debug('⚠️ Failed to count audio bytes:', err);
          }
        }
        break;

      case 'stop':
        this.logger.info('📞 Call ended by SignalWire - starting graceful shutdown');
        
        // Cancel any in-progress response so OpenAI stops generating
        try {
          if (this.openaiSocket?.readyState === WebSocket.OPEN) {
            this.openaiSocket.send(JSON.stringify({ type: 'response.cancel' }));
          }
        } catch (err) {
          debug('⚠️ Error canceling response:', err);
        }
        
        this.saveCallSummary();
        this.startGracefulShutdown();
        break;
    }
  }

  /**
   * Send media (audio) to SignalWire
   */
  sendMediaToSignalWire(audioData) {
    debug('🔊 Sending audio to SignalWire, length:', audioData?.length, 'callSid:', this.callSid);
    
    // During graceful shutdown, silently drop audio instead of logging errors
    if (this.gracefulShutdown && this.swSocket.readyState !== WebSocket.OPEN) {
      debug('🔇 Graceful shutdown - dropping audio chunk');
      return;
    }
    
    if (this.swSocket.readyState === WebSocket.OPEN) {
      // Add 30ms delay between chunks to prevent SignalWire buffer overflow
      // This gives SignalWire time to play audio before receiving more
      const now = Date.now();
      const timeSinceLastSend = now - (this._lastAudioSentAt || 0);
      const minDelay = 30; // 30ms throttle (increased from 10ms to prevent dropouts)
      
      if (timeSinceLastSend < minDelay) {
        // Too fast - wait a bit
        setTimeout(() => {
          if (this.swSocket.readyState === WebSocket.OPEN) {
            this.swSocket.send(JSON.stringify({
              event: 'media',
              streamSid: this.callSid || 'unknown',
              media: {
                payload: audioData
              }
            }));
            this._lastAudioSentAt = Date.now();
            debug('✅ Audio sent to SignalWire (throttled)');
          }
        }, minDelay - timeSinceLastSend);
      } else {
        // Send immediately
        this.swSocket.send(JSON.stringify({
          event: 'media',
          streamSid: this.callSid || 'unknown',
          media: {
            payload: audioData
          }
        }));
        this._lastAudioSentAt = now;
        debug('✅ Audio sent to SignalWire');
      }
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
          debug('🔔 User silent after question - sending gentle nudge');
          
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
          debug('✅ Gentle nudge sent - will not auto-continue');
        }
        // If not awaiting user, do nothing (don't auto-progress)
      }
    }, 500);
    
    debug('✅ Auto-nudge monitor started (8s threshold - one nudge per question, no auto-continue)');
  }
  
  /**
   * Handle rate limits from OpenAI
   * Backs off when limits are hit to prevent Barbara from going silent
   * Tolerant parser - handles both event.rate_limits and event.metrics
   */
  handleRateLimits(rateLimitsOrEvent) {
    // Handle both array and object formats
    const metrics = Array.isArray(rateLimitsOrEvent)
      ? rateLimitsOrEvent
      : (rateLimitsOrEvent?.metrics || rateLimitsOrEvent?.rate_limits || []);

    if (!metrics.length) return;

    const throttled = metrics.filter(m => Number(m.remaining) <= 0);
    
    if (throttled.length > 0) {
      const maxReset = Math.max(...throttled.map(m => Number(m.reset_seconds) || 1));
      this.backoffUntil = Date.now() + Math.ceil(maxReset * 1000);
      
      console.log('⏳ RATE LIMIT HIT - backing off for', maxReset, 'seconds');
      throttled.forEach(m => {
        console.log(`   - ${m.name}: ${m.remaining}/${m.limit} remaining, resets in ${m.reset_seconds}s`);
      });
      this.logger.warn({ throttled, backoffMs: maxReset * 1000 }, '⏳ Rate limit backoff');
    } else {
      debug('📊 Rate limits OK:', metrics.map(m => `${m.name}: ${m.remaining}/${m.limit}`).join(', '));
    }
  }

  /**
   * Check if we can send to OpenAI (not in backoff period)
   * Stricter check - considers socket state and shutdown
   */
  canSend() {
    return (
      !this.gracefulShutdown &&
      this.openaiSocket?.readyState === WebSocket.OPEN &&
      Date.now() >= this.backoffUntil
    );
  }

  /**
   * Enqueue a response.create call (single-flight pattern)
   */
  enqueueResponse(payload = {}) {
    // Don't enqueue during graceful shutdown
    if (this.gracefulShutdown) {
      debug('⚠️ Graceful shutdown - not enqueueing response');
      return;
    }
    
    // Collapse consecutive empty payloads within 300ms (prevent storms)
    const now = Date.now();
    if (!payload || Object.keys(payload).length === 0) {
      if (this._lastEmptyEnqueue && now - this._lastEmptyEnqueue < 300) {
        debug('⚠️ Deduping empty enqueue - too recent');
        return;
      }
      this._lastEmptyEnqueue = now;
    }
    
    debug('📥 Enqueueing response:', JSON.stringify(payload).substring(0, 100));
    this.responseQueue.push(payload);
    this.drainResponseQueue();
  }

  /**
   * Drain response queue (single-flight - only one response at a time)
   */
  drainResponseQueue() {
    // Don't start new response if one is already in progress
    if (this.speaking || this.responseInProgress) {
      debug('⏸️ Cannot drain queue - already speaking');
      return;
    }

    // Don't send if in rate limit backoff period
    if (!this.canSend()) {
      const waitMs = this.backoffUntil - Date.now();
      debug(`⏳ In backoff period - waiting ${waitMs}ms before sending`);
      
      // Retry after backoff expires
      setTimeout(() => this.drainResponseQueue(), waitMs + 100);
      return;
    }

    // Get next item from queue
    const next = this.responseQueue.shift();
    if (!next) {
      debug('✅ Response queue empty');
      return;
    }

    // Send response.create
    debug('🔄 Draining queue - sending response.create');
    if (this.openaiSocket?.readyState === WebSocket.OPEN) {
      this.openaiSocket.send(JSON.stringify({
        type: 'response.create',
        response: next
      }));
      this.speaking = true;
      this.responseInProgress = true;
    }
  }

  /**
   * Resume conversation after interruption or unexpected silence
   */
  resumeConversation() {
    // Use queue system instead of direct send
    this.enqueueResponse({});
  }

  /**
   * Resume conversation with context of what Barbara was saying
   * Used when false interruption happens - helps her continue her thought
   */
  resumeWithContext() {
    if (this.openaiSocket?.readyState === WebSocket.OPEN) {
      const lastThought = this.currentResponseTranscript.trim();
      debug('🔄 Resuming Barbara with context:', lastThought);
      
      // Tell Barbara to continue where she left off
      this.openaiSocket.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [{
            type: 'input_text',
            text: `You were interrupted mid-sentence. You were saying: "${lastThought}". Continue from where you left off - don't start over. Just finish your thought naturally.`
          }]
        }
      }));
      
      // Use queue system for response.create
      this.enqueueResponse({});
    }
  }

  /**
   * Send quick acknowledgment for inbound calls while we look up lead context
   * Says "Equity Connect, give me one second please" to buy time
   */
  sendQuickAcknowledgment() {
    if (this.openaiSocket?.readyState === WebSocket.OPEN && !this.greetingSent) {
      setTimeout(() => {
        debug('🔵 Sending quick acknowledgment before lead lookup');
        
        // Inject the exact acknowledgment we want Barbara to say
        this.openaiSocket.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'system',
            content: [{
              type: 'input_text',
              text: 'INBOUND CALL CONNECTED: Say exactly: "Equity Connect, give me one second please." Then wait for lead context to be injected.'
            }]
          }
        }));
        
        // Trigger Barbara to speak the acknowledgment using queue system
        this.enqueueResponse({});
        
        debug('✅ Quick acknowledgment enqueued - Barbara will say "Equity Connect, give me one second please"');
        // Don't mark greetingSent = true yet - this is just the acknowledgment
      }, 500); // Small delay to let call connection settle
    }
  }

  /**
   * Inject caller-specific greeting instructions
   * Called BEFORE startConversation() to tell Barbara exactly how to greet this caller
   */
  async injectCallerGreeting() {
    const callerPhone = this.callContext.from;
    
    if (!callerPhone) {
      console.log('⚠️ No caller phone - injecting generic greeting');
      this.openaiSocket.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [{
            type: 'input_text',
            text: 'CALLER INFORMATION: New caller (phone unknown). YOUR GREETING: "Hi! Thanks for calling. Who do I have the pleasure of speaking with?"'
          }]
        }
      }));
      return;
    }
    
    try {
      const { executeTool } = require('./tools');
      const result = await executeTool('get_lead_context', { phone: callerPhone });
      
      if (!result || !result.found) {
        // New caller
        console.log('💬 Injecting NEW CALLER greeting');
        this.openaiSocket.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'system',
            content: [{
              type: 'input_text',
              text: `CALLER INFORMATION:
Phone: ${callerPhone}
Caller Type: NEW CALLER (first time calling)

YOUR GREETING: "Hi! Thanks for calling. Who do I have the pleasure of speaking with?"`
            }]
          }
        }));
      } else {
        // Returning caller
        const firstName = result?.raw?.first_name || 'there';
        const city = result?.raw?.property_city || '';
        console.log(`💬 Injecting RETURNING CALLER greeting for: ${firstName}`);
        
        this.openaiSocket.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'system',
            content: [{
              type: 'input_text',
              text: `CALLER INFORMATION:
Name: ${firstName}
Phone: ${callerPhone}
City: ${city}
Caller Type: RETURNING CALLER

YOUR GREETING: "Hi ${firstName}! Thanks for calling back${city ? ` about your property in ${city}` : ''}. What can I help you with today?"`
            }]
          }
        }));
      }
    } catch (err) {
      console.error('❌ Failed to inject caller greeting:', err);
      // Fallback to generic
      this.openaiSocket.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [{
            type: 'input_text',
            text: 'CALLER INFORMATION: Unknown caller. YOUR GREETING: "Hi! Thanks for calling. Who do I have the pleasure of speaking with?"'
          }]
        }
      }));
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
    
    debug('🔍 Force-calling get_lead_context for phone:', callerPhone);
    debug('📞 SignalWire number called:', signalwireNumber);
    
    try {
      const { executeTool, initSupabase } = require('./tools');
      
      // First, look up which broker owns this SignalWire number
      let assignedBrokerId = null;
      let assignedBrokerName = null;
      let assignedBrokerData = null;
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
              .select('id, contact_name, company_name, nmls_number, phone, email, timezone')
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
              assignedBrokerData = broker; // Store full broker details
              debug('🏢 Broker assigned by SignalWire number:', assignedBrokerName);
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
      
      // Use super lookup function - gets EVERYTHING in one call
      const sb = initSupabase();
      const { data: contextData, error: contextError } = await sb.rpc('lookup_caller_complete_context', {
        caller_phone: callerPhone
      });
      
      if (contextError) {
        console.error('❌ Super lookup failed:', contextError);
        throw contextError;
      }
      
      debug('✅ Complete context retrieved:', JSON.stringify(contextData).substring(0, 300));
      
      const callerType = contextData?.caller_type;
      const isBrokerCalling = callerType === 'broker';
      const isLeadCalling = callerType === 'lead';
      
      // Build silent system message with real data
      // Determine call type
      const isInbound = !this.callContext.instructions;
      const callTypeInstructions = isInbound 
        ? `CALL TYPE: INBOUND

Your first words were: "Equity Connect, give me one second please"
Now greet the caller based on who they are (see below).

SCREENING DETECTION: If you heard "Google", "screening", or "RoboKiller" before this message, acknowledge it briefly.`
        : `CALL TYPE: OUTBOUND (You called them)

WAIT FOR PICKUP: Listen for "Hello?" before speaking your first words.
SCREENING DETECTION: If you hear "Google", "screening", or "RoboKiller", wait 5 seconds then say: "This is Barbara calling regarding their reverse mortgage inquiry."
OPENING: "Hi, is this [their name from below]?" or "Hi there!"`;

      let contextMessage = `${callTypeInstructions}

---

CALLER INFORMATION:
`;
      
      if (isBrokerCalling && contextData?.broker) {
        // BROKER is calling their own number
        const broker = contextData.broker;
        contextMessage += `Caller Type: BROKER\n\n`;
        contextMessage += `YOUR GREETING:\n`;
        contextMessage += `"Hi ${broker.contact_name.split(' ')[0]}! This is your Equity Connect line. Are you testing the system or did you need something?"\n\n`;
        contextMessage += `BROKER DATA:\n`;
        contextMessage += `- Name: ${broker.contact_name}\n`;
        contextMessage += `- Company: ${broker.company_name}\n`;
        contextMessage += `- NMLS: ${broker.nmls_number || 'N/A'}\n`;
        contextMessage += `- Phone: ${callerPhone}\n`;
        
        // Store broker info
        this.callContext.broker_id = broker.id;
        this.callContext.is_broker_calling = true;
      } else if (isLeadCalling && contextData?.lead) {
        // RETURNING CALLER - Use complete context from super lookup
        const lead = contextData.lead;
        const broker = contextData.broker;
        const lastInt = contextData.last_interaction;
        const emailCtx = contextData.email_context;
        const callHist = contextData.call_history;
        
        contextMessage += `Caller Type: RETURNING CALLER\n\n`;
        
        // Determine conversation flow based on lead status
        const leadStatus = lead.status || 'new';
        let flowInstructions = '';
        
        if (leadStatus === 'qualified') {
          // Already qualified - skip to booking
          flowInstructions = `CONVERSATION FLOW FOR THIS CALL:
Skip qualification (already done last time). Start here:

YOUR GREETING:
"Hi ${lead.first_name}! I know we qualified you last time. Are you ready to schedule with ${broker?.contact_name?.split(' ')[0] || 'your advisor'}?"

NEXT STEPS:
- If yes → Jump straight to "Book the Appointment"
- If they have questions first → "Of course! What would you like to know?" → Answer → Then book
- If not ready → "No problem! Take your time. Call us back when you're ready."
`;
        }
        else if (leadStatus === 'appointment_set') {
          // Has existing appointment
          flowInstructions = `CONVERSATION FLOW FOR THIS CALL:
They already have an appointment scheduled.

YOUR GREETING:
"Hi ${lead.first_name}! I see you have an appointment with ${broker?.contact_name?.split(' ')[0] || 'your advisor'} coming up. What can I help you with?"

LISTEN FOR:
- Reschedule: Check new availability with check_broker_availability → Book new time → Cancel old
- Cancel: "I understand. Let me cancel that for you. Would you like to reschedule for a different time?"
- Questions: Answer their questions about the upcoming appointment
- Confirm details: "Your appointment is [date/time]. [Broker] will call you then."
`;
        }
        else if (leadStatus === 'showed') {
          // Already met with broker
          flowInstructions = `CONVERSATION FLOW FOR THIS CALL:
They already met with the broker.

YOUR GREETING:
"Hi ${lead.first_name}! How was your meeting with ${broker?.contact_name?.split(' ')[0] || 'your advisor'}?"

NEXT STEPS:
- Listen to their feedback
- Answer questions about next steps or application
- Do NOT try to qualify them again
- Help with whatever they need
`;
        }
        else if (leadStatus === 'do_not_contact' || leadStatus === 'closed_lost') {
          // Should not be calling them (only if inbound)
          flowInstructions = `CONVERSATION FLOW FOR THIS CALL:
Lead requested no contact or is closed_lost.

YOUR GREETING:
"Hi! Thanks for calling. How can I help you today?"

IMPORTANT:
- Be polite and helpful
- Answer questions if they ask
- Do NOT push for appointment
- Let them lead the conversation
`;
        }
        else {
          // Default: new, contacted, replied - full qualification needed
          flowInstructions = `CONVERSATION FLOW FOR THIS CALL:
Full qualification flow needed.

YOUR GREETING:
"Hi ${lead.first_name || 'there'}! Thanks for calling back`;
          if (lead.property_city) {
            flowInstructions += ` about your property in ${lead.property_city}`;
          }
          flowInstructions += `."`;
          if (lastInt && lastInt.context && lastInt.context.money_purpose) {
            flowInstructions += ` Then reference: "I know you mentioned needing help with ${lastInt.context.money_purpose} last time. Is that still the situation?"`;
          }
          
          flowInstructions += `

CONVERSATION GOALS (in order):
1. Build Rapport First (may be quick if they remember you)
2. Get Permission to Qualify
3. Gather Missing Information (check CALLER INFORMATION - some may be pre-filled)
4. Calculate & Present Equity
5. Answer Their Questions
6. Book the Appointment
`;
        }
        
        contextMessage += flowInstructions + '\n\n';
        
        // Basic lead info
        contextMessage += `LEAD DETAILS:\n`;
        contextMessage += `- First name: ${lead.first_name || 'Unknown'}\n`;
        contextMessage += `- Last name: ${lead.last_name || 'Unknown'}\n`;
        contextMessage += `- Email: ${lead.primary_email || 'Not provided'}\n`;
        contextMessage += `- Phone: ${callerPhone}\n`;
        contextMessage += `- City: ${lead.property_city || 'Unknown'}\n`;
        contextMessage += `- Property address: ${lead.property_address || 'Not provided'}\n`;
        contextMessage += `- Property value: ${lead.property_value || 'Unknown'}\n`;
        contextMessage += `- Estimated equity: ${lead.estimated_equity || 'Unknown'}\n`;
        contextMessage += `- Status: ${lead.status || 'new'}\n`;
        
        // Broker info
        if (broker) {
          contextMessage += `\nASSIGNED BROKER:\n`;
          contextMessage += `- First name: ${broker.contact_name.split(' ')[0]}\n`;
          contextMessage += `- Full name: ${broker.contact_name}\n`;
          contextMessage += `- Company: ${broker.company_name}\n`;
          contextMessage += `- NMLS: ${broker.nmls_number || 'licensed'}\n`;
          contextMessage += `- Phone: ${broker.phone}\n`;
          contextMessage += `- Broker ID for booking: ${broker.id}\n`;
          this.callContext.broker_id = broker.id;
        } else if (assignedBrokerId) {
          // Fallback to SignalWire number's broker
          contextMessage += `\nASSIGNED BROKER:\n`;
          contextMessage += `- Broker ID for booking: ${assignedBrokerId}\n`;
          this.callContext.broker_id = assignedBrokerId;
        }
        
        // Previous interaction context
        if (lastInt && lastInt.context) {
          contextMessage += `\nLAST CALL CONTEXT:\n`;
          contextMessage += `- Date: ${new Date(lastInt.date).toLocaleDateString()}\n`;
          contextMessage += `- Outcome: ${lastInt.outcome}\n`;
          if (lastInt.context.money_purpose) {
            contextMessage += `- Purpose: ${lastInt.context.money_purpose}\n`;
          }
          if (lastInt.context.specific_need) {
            contextMessage += `- Specific need: ${lastInt.context.specific_need}\n`;
          }
          if (lastInt.context.objections && lastInt.context.objections.length > 0) {
            contextMessage += `- Previous objections: ${lastInt.context.objections.join(', ')}\n`;
          }
        }
        
        // Email engagement
        if (emailCtx && emailCtx.engaged) {
          contextMessage += `\nEMAIL ENGAGEMENT:\n`;
          contextMessage += `- Opens: ${emailCtx.total_opens}, Clicks: ${emailCtx.total_clicks}\n`;
          if (emailCtx.last_clicked_subject) {
            contextMessage += `- Last clicked: "${emailCtx.last_clicked_subject}"\n`;
          }
          if (emailCtx.campaign_archetype) {
            contextMessage += `- Campaign: ${emailCtx.campaign_archetype}\n`;
          }
        }
        
        // Call history
        if (callHist && callHist.total_calls > 0) {
          contextMessage += `\nCALL HISTORY:\n`;
          contextMessage += `- Total calls: ${callHist.total_calls}\n`;
          contextMessage += `- Avg duration: ${callHist.avg_duration_seconds}s\n`;
        }
        
        // Store lead ID and phone for tool calls
        this.callContext.lead_id = lead.id;
        this.callContext.caller_phone = callerPhone;
      } else {
        // NEW CALLER - Create minimal lead record and use SignalWire number's broker
        contextMessage += `Caller Type: NEW CALLER (not in database)\n\n`;
        contextMessage += `YOUR GREETING FOR THIS CALL:\n`;
        contextMessage += `"Hi! Thanks for calling. Who do I have the pleasure of speaking with?"\n`;
        contextMessage += `After they give their name, ask: "Great to meet you, [name]! What can I help you with today?"\n\n`;
        
        contextMessage += `WHAT WE KNOW:\n`;
        contextMessage += `- Phone: ${callerPhone}\n`;
        contextMessage += `- Status: First-time caller\n`;
        
        if (assignedBrokerId && assignedBrokerData) {
          contextMessage += `\nASSIGNED BROKER (based on the number they called):\n`;
          contextMessage += `- First name: ${assignedBrokerName}\n`;
          contextMessage += `- Full name: ${assignedBrokerData.contact_name || 'Unknown'}\n`;
          contextMessage += `- Company: ${assignedBrokerData.company_name || 'Unknown'}\n`;
          contextMessage += `- NMLS: ${assignedBrokerData.nmls_number || 'licensed'}\n`;
          contextMessage += `- Phone: ${assignedBrokerData.phone || 'N/A'}\n`;
          contextMessage += `- Broker ID for booking: ${assignedBrokerId}\n`;
          this.callContext.broker_id = assignedBrokerId;
        } else if (assignedBrokerId) {
          // Fallback if we only have ID and name
          contextMessage += `\nASSIGNED BROKER:\n`;
          contextMessage += `- First name: ${assignedBrokerName}\n`;
          contextMessage += `- Broker ID for booking: ${assignedBrokerId}\n`;
          this.callContext.broker_id = assignedBrokerId;
        }
        
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
            type: 'input_text',
            text: contextMessage
          }]
        }
      }));
      
      debug('💉 Lead context injected into conversation');
      
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
        
        debug('✅ Step 1: conversation.item.create sent (call_connected trigger)');

        // Step 2: Request response generation using queue system (single-flight)
        this.greetingSent = true;  // Mark greeting as sent before enqueueing
        this.enqueueResponse({});
        debug('✅ Step 2: response.create enqueued (Barbara should now speak!)');
      }, 500);
    } else {
      console.error('❌ Cannot start conversation - OpenAI socket not ready');
    }
  }

  /**
   * Wrap promise with timeout to prevent stalls
   */
  withTimeout(promise, ms = 2500) {
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
    
    this.logger.info({ function: name, call_id }, '🔧 Tool called');
    
    try {
      // Parse args safely
      let args = {};
      try {
        args = JSON.parse(argsJson || '{}');
      } catch (parseErr) {
        console.error('⚠️ Failed to parse tool args, using empty:', parseErr);
        args = {};
      }
      
      // Execute with timeout to prevent stalls
      const result = await this.withTimeout(executeTool(name, args));
      
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
      
      // Continue response using queue system (single-flight)
      this.enqueueResponse({});
      
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
      
      // Continue response so Barbara can speak the fallback (use queue)
      this.enqueueResponse({});
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
   * Start heartbeat to keep both sockets alive
   * Sends ping every 15s to prevent idle timeout
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
    }, 15000); // 15 second interval

    debug('💓 Heartbeat started - pinging every 15s');
  }

  /**
   * Start audio commit interval
   * Only commits when buffer has ≥100ms of audio to avoid empty buffer errors
   */
  startAudioCommitInterval() {
    this.audioCommitInterval = setInterval(() => {
      if (this.gracefulShutdown) return;
      if (this.openaiSocket?.readyState !== WebSocket.OPEN) return;
      if (Date.now() < this.commitLockedUntil) return;  // Cooldown after buffer clear
      if (!this.hasAppendedSinceLastCommit) return;  // Nothing new to commit

      // Need at least 100ms of PCM16@16kHz before committing: 16k * 2 bytes * 0.1s = 3,200 bytes
      const BYTES_REQUIRED = 3200;

      // Also require the last append to be recent (avoid committing long after stream stops)
      const appendIsRecent = Date.now() - this.lastAudioAppendAt < 750;

      if (this.bufferedAudioBytes >= BYTES_REQUIRED && appendIsRecent) {
        this.openaiSocket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        debug(`🎤 Audio buffer committed (~${Math.round(this.bufferedAudioBytes / 32)}ms)`);
        this.bufferedAudioBytes = 0; // Reset accounting after commit
        this.hasAppendedSinceLastCommit = false;  // Wait for new audio before next commit
      } else {
        debug('🛑 Skip commit: not enough buffered audio yet');
      }
    }, 200); // 200ms check interval

    debug('✅ Audio commit interval started (200ms check, ≥100ms audio required)');
  }

  /**
   * Start graceful shutdown - let OpenAI finish current response before closing
   */
  startGracefulShutdown() {
    if (this.gracefulShutdown) {
      debug('⚠️ Graceful shutdown already in progress');
      return;
    }
    
    this.gracefulShutdown = true;
    this.logger.info('⏳ Graceful shutdown started - waiting for OpenAI to finish response');
    
    // If Barbara is currently speaking, wait for response to complete
    if (this.responseInProgress) {
      debug('🗣️ Barbara is speaking - waiting for response.done event');
      // Set a timeout in case response.done never comes
      this.gracefulShutdownTimer = setTimeout(() => {
        this.logger.warn('⏰ Graceful shutdown timeout - forcing cleanup');
        this.cleanup();
      }, 7000); // 7 second max wait (seniors can have long syllables)
    } else {
      // No response in progress, cleanup immediately
      debug('✅ No response in progress - cleaning up immediately');
      this.cleanup();
    }
  }

  /**
   * Cleanup connections
   */
  cleanup() {
    if (this.gracefulShutdownTimer) {
      clearTimeout(this.gracefulShutdownTimer);
      this.gracefulShutdownTimer = null;
    }
    
    if (this.sessionConfigTimeout) {
      clearTimeout(this.sessionConfigTimeout);
      this.sessionConfigTimeout = null;
    }
    
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      debug('✅ Heartbeat stopped');
    }

    // Clear audio commit interval
    if (this.audioCommitInterval) {
      clearInterval(this.audioCommitInterval);
      this.audioCommitInterval = null;
      debug('✅ Audio commit interval stopped');
    }
    
    // Reset audio accounting
    this.bufferedAudioBytes = 0;
    this.lastAudioAppendAt = 0;
    this.hasAppendedSinceLastCommit = false;
    this.commitLockedUntil = 0;
    
    this.logger.info('🧹 Cleaning up audio bridge');
    
    // Clear auto-resume interval
    if (this.autoResumeInterval) {
      clearInterval(this.autoResumeInterval);
      this.autoResumeInterval = null;
      debug('✅ Auto-resume monitor stopped');
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

