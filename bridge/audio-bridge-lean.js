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
    
    // Broker timezone for dynamic time injection
    this.brokerTimezone = null;
    
    // Simple speaking flag (no complex queue)
    this.speaking = false;
    
    // Ringback tone control
    this.ringbackInterval = null;
    this.isPlayingRingback = false;
    
    // Heartbeat to keep sockets alive
    this.heartbeatInterval = null;
    
    // Track pending audio sends to ensure completion
    this.pendingAudioSends = [];
    
    // Media starvation detection (SignalWire idle timeout is ~10s)
    this.mediaStarvationTimer = null;
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

    const realtimeModel = process.env.REALTIME_MODEL || 'gpt-realtime-2025-08-28';
    
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
        setTimeout(() => this.startConversation(), 500);
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
        // Check if binary frame (raw PCM) vs JSON string
        if (Buffer.isBuffer(message) && message.length > 0 && message[0] !== 0x7b) {
          // SignalWire sent raw binary audio - convert to base64 and forward
          if (!this._binaryFrameWarned) {
            console.warn('⚠️ SignalWire switched to BINARY frames - handling as raw audio');
            this._binaryFrameWarned = true;
          }
          
          // Track media flow
          if (!this._lastInputAudioAt) {
            this._lastInputAudioAt = 0;
            this._inputAudioCount = 0;
          }
          this._inputAudioCount++;
          this._lastInputAudioAt = Date.now();
          
          if (!this._lastInputAudioLog || Date.now() - this._lastInputAudioLog > 5000) {
            console.log(`📊 Input audio flowing (BINARY): ${this._inputAudioCount} packets, last: ${new Date(this._lastInputAudioAt).toISOString()}`);
            this._lastInputAudioLog = Date.now();
          }
          
          // Forward raw binary as base64 to OpenAI
          if (this.openaiSocket?.readyState === WebSocket.OPEN) {
            this.openaiSocket.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: message.toString('base64')
            }));
          }
          return;
        }
        
        // Standard JSON message
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
          broker_timezone: null,
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

      // Simple: qualified = status is 'qualified' or beyond
      const qualifiedFlag = result?.status === 'qualified' 
        || result?.status === 'appointment_set' 
        || result?.status === 'showed' 
        || result?.status === 'application' 
        || result?.status === 'funded';

      console.log('🔍 Qualification:', {
        status: result?.status,
        qualified: qualifiedFlag
      });

      // Build complete variables object with all property/equity data
      const mortgageBalanceFormatted = mortgageBalanceNumber !== null && !Number.isNaN(mortgageBalanceNumber)
        ? Math.round(mortgageBalanceNumber).toLocaleString('en-US')
        : '';
      
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
        leadAge: result?.raw?.age || '',
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
        mortgageBalance: mortgageBalanceFormatted,
        mortgageBalanceWords,
        ownerOccupied: result?.raw?.owner_occupied ? 'yes' : 'no',
        qualified: qualifiedFlag,
        leadStatus: result?.status || '',
        brokerCompany: result?.broker?.company_name || '',
        brokerFullName: result?.broker?.contact_name || '',
        brokerFirstName: result?.broker?.contact_name ? result.broker.contact_name.split(' ')[0] : '',
        brokerLastName: result?.broker?.contact_name ? result.broker.contact_name.split(' ').slice(1).join(' ') : '',
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
        broker_timezone: result.broker?.timezone || 'America/Los_Angeles',
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
        broker_timezone: 'America/Los_Angeles',
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
   * Play ringback tone while loading prompt/context
   * Generates classic North American ringback: 2 seconds on, 4 seconds off
   * Plays for up to 2 full rings (~12 seconds) or until session is ready
   */
  playRingbackTone() {
    if (this.isPlayingRingback) return;
    
    this.isPlayingRingback = true;
    let phase = 0;
    let ringCount = 0;
    const MAX_RINGS = 2; // Maximum 2 rings before auto-stopping
    
    // Generate a simple 440Hz + 480Hz dual-tone (typical ringback)
    const generateRingTone = (durationMs, sampleRate = 24000) => {
      const numSamples = Math.floor((sampleRate * durationMs) / 1000);
      const buffer = Buffer.alloc(numSamples * 2); // 16-bit samples
      
      for (let i = 0; i < numSamples; i++) {
        // Mix 440Hz and 480Hz tones
        const t = i / sampleRate;
        const sample = Math.sin(2 * Math.PI * 440 * t) * 0.3 + 
                      Math.sin(2 * Math.PI * 480 * t) * 0.3;
        const value = Math.floor(sample * 32767); // Convert to 16-bit
        buffer.writeInt16LE(value, i * 2);
      }
      
      return buffer.toString('base64');
    };
    
    // Ringback pattern: 2 seconds of tone, 4 seconds of silence, repeat
    const ringTone = generateRingTone(2000); // 2 second tone
    
    this.ringbackInterval = setInterval(() => {
      if (!this.swSocket || this.swSocket.readyState !== WebSocket.OPEN) {
        this.stopRingbackTone();
        return;
      }
      
      if (phase === 0) {
        // Send ring tone
        this.swSocket.send(JSON.stringify({
          event: 'media',
          streamSid: this.swSocket._streamSid,
          media: {
            payload: ringTone
          }
        }));
        phase = 1;
        ringCount++;
        
        // Stop after 2 rings if session isn't ready yet
        if (ringCount >= MAX_RINGS) {
          console.log('📞 Maximum 2 rings reached - stopping ringback');
          this.stopRingbackTone();
        }
      } else {
        // Silent phase (no audio sent)
        phase = 0;
      }
    }, 2000); // Check every 2 seconds
    
    console.log('📞 Ringback tone started (max 2 rings)');
  }

  /**
   * Stop ringback tone (when Barbara starts speaking)
   */
  stopRingbackTone() {
    if (this.ringbackInterval) {
      clearInterval(this.ringbackInterval);
      this.ringbackInterval = null;
      this.isPlayingRingback = false;
      console.log('📞 Ringback tone stopped');
    }
  }

  /**
   * Get current time formatted in broker's local timezone (ISO 8601)
   * Returns format: "2025-10-22T20:42:00-07:00"
   */
  getCurrentTimeForBroker() {
    const timezone = this.brokerTimezone || 'America/Los_Angeles'; // Default to Pacific
    
    try {
      const now = new Date();
      
      // Format date/time in broker's timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const parts = formatter.formatToParts(now);
      const year = parts.find(p => p.type === 'year').value;
      const month = parts.find(p => p.type === 'month').value;
      const day = parts.find(p => p.type === 'day').value;
      const hour = parts.find(p => p.type === 'hour').value;
      const minute = parts.find(p => p.type === 'minute').value;
      const second = parts.find(p => p.type === 'second').value;
      
      // Calculate timezone offset in ISO 8601 format (-07:00)
      const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const offsetMinutes = (tzDate - utcDate) / 60000; // Difference in minutes
      const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
      const offsetMins = Math.abs(offsetMinutes) % 60;
      const offsetSign = offsetMinutes >= 0 ? '+' : '-';
      const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;
      
      // ISO 8601 format: 2025-10-22T20:42:00-07:00
      return `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetString}`;
      
    } catch (err) {
      console.warn(`⚠️ Failed to format time for timezone ${timezone}:`, err.message);
      // Fallback to UTC ISO format
      return new Date().toISOString();
    }
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
        
        const { propertyValueNumber, estimatedEquityNumber, qualifiedFlag } = promptBuildResult;
        const hasPropertyData = (propertyValueNumber !== null && !Number.isNaN(propertyValueNumber))
          || (estimatedEquityNumber !== null && !Number.isNaN(estimatedEquityNumber));
        
        // CRITICAL: Update callContext with lead_id from lookup result
        if (promptBuildResult.lead_id) {
          this.callContext.lead_id = promptBuildResult.lead_id;
        }
        if (promptBuildResult.broker_id) {
          this.callContext.broker_id = promptBuildResult.broker_id;
        }
        
        // Store broker timezone for dynamic time injection
        if (promptBuildResult.broker_timezone) {
          this.brokerTimezone = promptBuildResult.broker_timezone;
          console.log(`🕐 Broker timezone set: ${this.brokerTimezone}`);
        }

        promptCallContext = {
          context: this.callContext.context || 'inbound',
          lead_id: this.callContext.lead_id,
          from_phone: this.callerPhone,
          to_phone: this.callContext.to_phone,
          has_property_data: hasPropertyData,
          is_qualified: qualifiedFlag
        };
        
        console.log('✅ Lead context retrieved:', {
          lead_id: promptCallContext.lead_id,
          has_data: hasPropertyData,
          qualified: qualifiedFlag,
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
        this.callContext.instructions,
        variables  // Pass variables for injection INSIDE getPromptForCall
      );

      if (!promptTemplate || promptTemplate.length === 0) {
        throw new Error('PromptLayer returned empty prompt');
      }

      instructions = promptTemplate;  // Already injected inside getPromptForCall
      promptSource = 'promptlayer';
      this.promptName = determinePromptName(promptCallContext);
      this.promptSource = promptSource;
      
      console.log(`🍰 Successfully built prompt from PromptLayer (${instructions.length} chars)`);
      
    } catch (promptLayerError) {
      console.error('❌ PromptLayer fetch failed:', promptLayerError.message);
      console.warn('⚠️ Falling back to local prompt file');
      
      try {
        const cachedPrompt = await getPromptForCall(promptCallContext, null, variables);
        instructions = cachedPrompt;  // Already injected inside getPromptForCall
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
    
    // Prepend current time in broker's timezone
    const currentTime = this.getCurrentTimeForBroker();
    const timeInstruction = `Current time is ${currentTime}. Use this as 'now' for scheduling and time-related discussions.\n\n`;
    const finalInstructions = timeInstruction + instructions;
    
    console.log(`🕐 Current time injected: ${currentTime} (timezone: ${this.brokerTimezone || 'America/Los_Angeles'})`);
    
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        voice: process.env.REALTIME_VOICE || 'shimmer',  // Shimmer = most natural, warm female voice
        instructions: finalInstructions,
        // DO NOT set input_audio_format or output_audio_format for SIP/WebRTC
        // Per OpenAI Staff (juberti): "don't set format, it's not needed when using WebRTC/SIP"
        // Setting these causes audio bugs with SignalWire gateway
        input_audio_transcription: {
          model: 'whisper-1'
        },
        temperature: 0.95,  // HIGH temp = natural speech patterns, filler words, human-like variation
        max_response_output_tokens: 'inf',  // No artificial limit - let prompt control response length
        turn_detection: {
          type: 'server_vad',
          threshold: 0.35,  // Relaxed threshold - less aggressive interruption
          prefix_padding_ms: 500,  // More context before speech starts
          silence_duration_ms: 2500  // 2.5 seconds - extra time for seniors to process and respond
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
        console.log('✅ Session fully configured - ready to start conversation');
        
        // Stop ringback tone - Barbara is about to speak
        this.stopRingbackTone();
        
        // Now that session is fully configured, start the conversation
        // 500ms delay to ensure session is fully applied
        if (!this.greetingSent) {
          setTimeout(() => this.startConversation(), 500);
        }
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
        
        // Add 100ms silence tail to prevent telephony buffer clip (less dead air = more conversational)
        const silenceTail = Buffer.alloc(3200).toString('base64'); // 100ms @ 16kHz PCM16
        
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
        
        // Log SignalWire media format (CRITICAL for debugging silent audio)
        const mediaFormat = msg.start?.mediaFormat || msg.start?.media_format;
        const sampleRate = msg.start?.sampleRate || msg.start?.sample_rate;
        console.log('🎙️ SignalWire Stream Started:', {
          callSid: this.callSid,
          mediaFormat: mediaFormat || 'unknown',
          sampleRate: sampleRate || 'unknown',
          streamSid: msg.start?.streamSid
        });
        
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
          console.log('📞 Playing ringback while loading prompt and context...');
          
          // Play ringback tone to caller while we build the session
          // This makes it sound like the phone is ringing
          this.playRingbackTone();
          
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
            // Don't start conversation yet - wait for session.updated event
            // Ringback will stop when Barbara starts speaking
          } catch (err) {
            console.error('❌ Failed to configure session:', err);
            this.stopRingbackTone();
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
        
        // Reset starvation timer (SignalWire stops sending if idle >10s)
        if (this.mediaStarvationTimer) {
          clearTimeout(this.mediaStarvationTimer);
        }
        this.mediaStarvationTimer = setTimeout(() => {
          console.warn('⚠️ MEDIA STARVATION: No audio from SignalWire for 12 seconds - connection may be dead');
          console.warn('⚠️ Last media at:', new Date(this._lastInputAudioAt).toISOString());
          console.warn('⚠️ Total packets received:', this._inputAudioCount);
        }, 12000);
        
        // Log periodically to confirm audio is flowing (every 5 seconds)
        if (!this._lastInputAudioLog || Date.now() - this._lastInputAudioLog > 5000) {
          console.log(`📊 Input audio flowing: ${this._inputAudioCount} packets, last: ${new Date(this._lastInputAudioAt).toISOString()}`);
          this._lastInputAudioLog = Date.now();
        }
        
        // Extract audio payload from various SignalWire JSON structures
        // - Standard: msg.media.payload
        // - Legacy: msg.rawEvent.media.payload
        // - Alternative: msg.payload.audio
        const audioPayload = msg.media?.payload 
          || msg.rawEvent?.media?.payload 
          || msg.payload?.audio;
        
        if (audioPayload && this.openaiSocket?.readyState === WebSocket.OPEN) {
          this.openaiSocket.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: audioPayload
          }));
        } else if (!audioPayload && this._inputAudioCount < 10) {
          // Warn on unrecognized structure (first 10 frames only) - means SignalWire changed format again
          console.warn('⚠️ Media event with UNRECOGNIZED structure (audio in new location?):', JSON.stringify(msg).substring(0, 200));
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
    const maxChunkSize = 1280; // 40ms @ 16kHz PCM16 - reduces playback offset and improves timing accuracy
    
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
   * Send 50ms silence primer to warm up RTP session (prevents clipping)
   */
  sendSilencePrimer() {
    if (this.swSocket?.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Generate 50ms of silence @ 24kHz, 16-bit PCM
    const sampleRate = 24000;
    const durationMs = 50;
    const numSamples = Math.floor((sampleRate * durationMs) / 1000);
    const silenceBuffer = Buffer.alloc(numSamples * 2); // All zeros = silence
    
    debug('🔇 Sending 50ms silence primer to warm up RTP session');
    
    this.swSocket.send(JSON.stringify({
      event: 'media',
      media: {
        payload: silenceBuffer.toString('base64')
      }
    }));
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
      // Send 50ms silence primer to warm up RTP session (prevents start clipping)
      this.sendSilencePrimer();
      
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
    
    // Stop ringback tone if still playing
    this.stopRingbackTone();
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      debug('✅ Heartbeat stopped');
    }
    
    if (this.mediaStarvationTimer) {
      clearTimeout(this.mediaStarvationTimer);
      this.mediaStarvationTimer = null;
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

