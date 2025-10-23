/**
 * Audio Bridge - WebRTC Version (Simplified)
 * Bridges SignalWire WebSocket audio to OpenAI Realtime via WebRTC
 * Based on official OpenAI WebRTC API documentation
 */

const { OpenAIWebRTCClient } = require('./openai-webrtc-client');
const { toolDefinitions, executeTool } = require('./tools');
const { getPromptForCall, injectVariables } = require('./prompt-manager');
const {
  decodeMulaw,
  encodeMulaw,
  upsampleTo16k,
  downsampleTo8k,
  int16ToBuffer,
  bufferToInt16,
} = require('./audio-utils');

const ENABLE_DEBUG_LOGGING = process.env.ENABLE_DEBUG_LOGGING === 'true';

const debug = (...args) => {
  if (ENABLE_DEBUG_LOGGING) {
    console.log('[DEBUG]', ...args);
  }
};

class AudioBridgeWebRTC {
  constructor(signalwireWs, logger, callInfo) {
    this.signalwireWs = signalwireWs;
    this.logger = logger || console;
    this.callInfo = callInfo || {};
    this.openaiClient = null;
    this.isConnected = false;
    this.sessionId = null;
    this.streamSid = null;
    
    // Audio buffering for proper 20ms frames to SignalWire
    this._oaiToSw8kRemainder = new Int16Array(0);
    this._sentFrames = 0;
    
    // Debug: Log the call info passed from server
    if (ENABLE_DEBUG_LOGGING) {
      console.log('🔍 Call info from server:', JSON.stringify(callInfo, null, 2));
    }
    
    // Speaking flag management (prevents stuck states)
    this.speaking = false;
    this.speakingTimeout = null;
    
    this.logger.info(`🎙️ WebRTC Audio Bridge created for call: ${callInfo.CallSid || 'unknown'}`);
  }

  /**
   * Initialize and connect to OpenAI via WebRTC
   */
  async connect() {
    try {
      console.log('🚀 Starting WebRTC connection to OpenAI...');

      // Step 1: Get prompt and prepare session config
      const promptData = await getPromptForCall(this.callInfo);
      
      // Store prompt and session config for later use in session.update
      this.lastPrompt = promptData.prompt;
      this.sessionConfig = {
        voice: 'shimmer',
        instructions: promptData.prompt,
        temperature: 0.95,
        turn_detection: {
          type: 'server_vad',
          threshold: 0.35,
          prefix_padding_ms: 500,
          silence_duration_ms: 2000
        },
        tools: toolDefinitions,
        tool_choice: 'auto'
        // NOTE: input_audio_format and output_audio_format are NOT used in WebRTC mode
        // Audio format is handled by the WebRTC media track (16kHz PCM16)
      };

      // Step 2: Create OpenAI WebRTC client
    this.openaiClient = new OpenAIWebRTCClient(
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime'
    );

      // Step 3: Set up event handlers
      this.setupEventHandlers();

      // Step 4: Establish WebRTC connection (unified interface)
      console.log('🔌 Establishing WebRTC connection (unified interface)...');
      await this.openaiClient.connectWebRTC();

      console.log('✅ WebRTC bridge connected!');

      // Step 6: Set up SignalWire audio forwarding
      this.setupSignalWireForwarding();

    } catch (error) {
      console.error('❌ Failed to connect WebRTC bridge:', error);
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Set up OpenAI event handlers
   */
  setupEventHandlers() {
    // Connected
    this.openaiClient.onConnected = () => {
      console.log('✅ OpenAI WebRTC connected - audio streaming active');
      this.isConnected = true;
    };

    // Data channel messages (events from OpenAI)
    this.openaiClient.onMessage = (message) => {
      this.handleOpenAIEvent(message);
    };

    // Audio track from OpenAI
    this.openaiClient.onAudioTrack = (track, stream) => {
      console.log('🎵 Receiving audio track from OpenAI');
      this.handleOpenAIAudioTrack(track, stream);
    };

    // Data channel opened
    this.openaiClient.onDataChannelOpen = () => {
      console.log('📡 Data channel ready for events');
      
      // Send session.update to apply instructions, VAD, and tools
      // Note: voice is set during session creation, not in session.update
      console.log('📤 Sending session.update...');
      const sessionUpdate = {
        type: 'session.update',
        session: {
          type: 'realtime',  // ✅ Required field
          instructions: this.lastPrompt || this.sessionConfig.instructions,
          temperature: this.sessionConfig.temperature,
          turn_detection: this.sessionConfig.turn_detection,
          tools: this.sessionConfig.tools,
          tool_choice: this.sessionConfig.tool_choice
        }
      };
      this.openaiClient.sendEvent(sessionUpdate);
      
      // Don't start greeting yet - wait for SignalWire stream to be ready
      console.log('✅ Session configured - waiting for SignalWire stream...');
    };

    // Errors
    this.openaiClient.onError = (error) => {
      console.error('❌ WebRTC error:', error);
      this.handleError(error);
    };
  }

  /**
   * Set speaking flag with timeout protection
   */
  setSpeaking(speaking) {
    if (this.speakingTimeout) {
      clearTimeout(this.speakingTimeout);
      this.speakingTimeout = null;
    }
    
    this.speaking = speaking;
    
    if (speaking) {
      // Auto-unlock after 15 seconds to prevent stuck states
      this.speakingTimeout = setTimeout(() => {
        console.log('🚨 WATCHDOG: Speaking flag stuck for 15s - force unlocking!');
        this.speaking = false;
        this.speakingTimeout = null;
      }, 15000);
    }
  }

  /**
   * Handle audio track from OpenAI
   * This receives OpenAI's voice responses via WebRTC
   */
  handleOpenAIAudioTrack(track, stream) {
    console.log('🔊 Setting up audio forwarding from OpenAI to SignalWire...');
    
    const { nonstandard } = require('wrtc');
    const { RTCAudioSink } = nonstandard;
    const { downsampleTo8k, encodeMulaw } = require('./audio-utils');
    
    const sink = new RTCAudioSink(track);
    let gotFirstFrame = false;

    sink.ondata = ({ samples, sampleRate }) => {
      // Guard: Only send if SignalWire stream is ready
      if (!this.streamSid || !this.signalwireWs || this.signalwireWs.readyState !== 1) {
        console.log('[DEBUG] ⚠️ Dropping audio frame - SignalWire not ready');
        return;
      }

      // 1) Convert OpenAI audio to 8k PCM16 (mono) using proper resampling
      let pcm16;
      if (sampleRate === 48000) {
        // Proper 48k -> 16k decimation (every 3rd sample)
        const len16 = Math.floor(samples.length / 3);
        const tmp16 = new Int16Array(len16);
        for (let i = 0, j = 0; j < len16; i += 3, j++) tmp16[j] = samples[i];
        // 16k -> 8k using audio utils
        pcm16 = downsampleTo8k(tmp16);
      } else if (sampleRate === 24000) {
        // 24k -> 16k (every 1.5 samples, rounded)
        const len16 = Math.floor(samples.length / 1.5);
        const tmp16 = new Int16Array(len16);
        for (let i = 0, j = 0; j < len16; i += 1.5, j++) tmp16[j] = samples[Math.floor(i)];
        pcm16 = downsampleTo8k(tmp16);
      } else if (sampleRate === 16000) {
        pcm16 = downsampleTo8k(samples);
      } else if (sampleRate === 8000) {
        pcm16 = samples;
      } else {
        console.log(`⚠️ Unknown sample rate: ${sampleRate}, skipping`);
        return;
      }

      // 2) Concatenate with any leftover from last callback
      if (this._oaiToSw8kRemainder.length) {
        const merged = new Int16Array(this._oaiToSw8kRemainder.length + pcm16.length);
        merged.set(this._oaiToSw8kRemainder, 0);
        merged.set(pcm16, this._oaiToSw8kRemainder.length);
        pcm16 = merged;
        this._oaiToSw8kRemainder = new Int16Array(0);
      }

      // 3) Frame into exact 20 ms blocks (160 samples @ 8kHz)
      const FRAME = 160; // 20ms @ 8kHz = 160 samples
      const fullFrames = Math.floor(pcm16.length / FRAME);
      const used = fullFrames * FRAME;
      const leftover = pcm16.length - used;

      // 4) Send each 20 ms frame as its own WS 'media' event
      if (fullFrames > 0) {
        for (let i = 0; i < fullFrames; i++) {
          const start = i * FRAME;
          const end = start + FRAME;
          const frame16 = pcm16.slice(start, end);           // 160 samples @ 8kHz
          const ulaw   = encodeMulaw(frame16);               // 160 bytes μ-law
          const b64    = Buffer.from(ulaw).toString('base64');

          // Debug: Verify frame size
          if (ulaw.length !== 160) {
            console.warn(`⚠️ Wrong μ-law frame size: ${ulaw.length} bytes (expected 160)`);
          }

          this.signalwireWs.send(JSON.stringify({
            event: 'media',
            streamSid: this.streamSid,
            media: { payload: b64 }                           // one 20ms frame
          }));
        }
      }

      // 5) Keep remainder for next callback
      if (leftover > 0) {
        this._oaiToSw8kRemainder = pcm16.slice(used);
      }

      // Frame counting for debugging
      this._sentFrames += fullFrames;
      if (this._sentFrames % 100 === 0) {
        console.log(`➡️ Sent ${this._sentFrames} x 20ms frames to SignalWire`);
      }

      // First-frame bookkeeping
      if (!gotFirstFrame) {
        gotFirstFrame = true;
        this.setSpeaking(true);
        console.log('🎤 Started forwarding OpenAI audio to SignalWire');
      }
    };

    track.onended = () => {
      console.log('🔚 OpenAI audio track ended');
      sink.stop();
    };
    track.onmute = () => console.log('🔇 OpenAI audio track muted');
    track.onunmute = () => console.log('🔊 OpenAI audio track unmuted');
  }

  /**
   * Set up audio forwarding from SignalWire to OpenAI
   */
  setupSignalWireForwarding() {
    this.signalwireWs.on('message', (message) => {
      console.log('📨 SignalWire message received:', message.substring(0, 200) + '...');
      try {
        const msg = JSON.parse(message);

        if (msg.event === 'start') {
          this.streamSid = msg.start.streamSid;
          console.log('📞 Stream started:', this.streamSid);
          console.log('✅ SignalWire media stream ready: stream_id=' + this.streamSid);
          
          // Debug: Log the entire start event to see what SignalWire sends
          console.log('🔍 SignalWire start event:', JSON.stringify(msg, null, 2));
          
          // Extract call information from SignalWire start event
          // SignalWire sends call info in the start event, but structure may vary
          if (msg.start.callSid) {
            this.callInfo.CallSid = msg.start.callSid;
          }
          if (msg.start.from) {
            this.callInfo.From = msg.start.from;
            console.log('📞 Caller phone number from start event:', msg.start.from);
          }
          if (msg.start.to) {
            this.callInfo.To = msg.start.to;
          }

          // Now both sides are ready — kick off Barbara's greeting
          if (this.openaiClient) {
            this.openaiClient.sendEvent({ type: 'response.create' });
            console.log('✅ Greeting initiated after SignalWire start');
          }
          
          // Also check if call info is in the main message object
          if (msg.callSid && !this.callInfo.CallSid) {
            this.callInfo.CallSid = msg.callSid;
          }
          if (msg.from && !this.callInfo.From) {
            this.callInfo.From = msg.from;
            console.log('📞 Caller phone number from main object:', msg.from);
          }
          if (msg.to && !this.callInfo.To) {
            this.callInfo.To = msg.to;
          }
          
          // Check for custom parameters (SignalWire sends these in the start event)
          if (msg.start && msg.start.customParameters) {
            const params = msg.start.customParameters;
            if (params.from && !this.callInfo.From) {
              this.callInfo.From = params.from;
              console.log('📞 Caller phone number from custom parameters:', params.from);
            }
            if (params.to && !this.callInfo.To) {
              this.callInfo.To = params.to;
            }
          }
          
          // Log complete call info for debugging
          console.log('📋 Call information:', {
            CallSid: this.callInfo.CallSid,
            From: this.callInfo.From,
            To: this.callInfo.To
          });
        } else if (msg.event === 'media' && msg.media?.payload) {
          // Wait for WebRTC connection and data channel to be ready
          if (!this.isConnected || !this.openaiClient?.audioSource) {
            if (ENABLE_DEBUG_LOGGING) {
              debug('⚠️ Dropping audio frame - WebRTC not ready');
            }
            return;
          }

          try {
            // Convert SignalWire μ-law (8kHz) to PCM16 (16kHz) for OpenAI
            const mulawBuffer = Buffer.from(msg.media.payload, 'base64');
            const pcm8 = decodeMulaw(mulawBuffer);
            const pcm16 = upsampleTo16k(pcm8);
            const pcmBuffer = int16ToBuffer(pcm16);
            const base64PCM = pcmBuffer.toString('base64');

            // Debug: log audio levels to verify data is flowing
            if (ENABLE_DEBUG_LOGGING) {
              const maxAmplitude = Math.max(...Array.from(pcm16).map(Math.abs));
              if (maxAmplitude > 100) { // Only log if there's actual audio
                console.log(`🎤 SignalWire audio: ${pcm16.length} samples @ 16kHz, max amplitude: ${maxAmplitude}`);
              }
            }

            // Send audio to OpenAI via WebRTC audio track
            this.openaiClient.sendAudio(base64PCM);
          } catch (error) {
            console.error('❌ Failed to convert mulaw to PCM16:', error);
          }
        } else if (msg.event === 'stop') {
          console.log('📞 Call ended, closing bridge');
          this.close();
        }
      } catch (error) {
        console.error('❌ Error processing SignalWire message:', error);
      }
    });

    this.signalwireWs.on('close', () => {
      console.log('📞 SignalWire connection closed');
      this.close();
    });

    this.signalwireWs.on('open', () => {
      console.log('🔌 SignalWire WebSocket connected');
    });

    this.signalwireWs.on('error', (error) => {
      console.error('❌ SignalWire WebSocket error:', error);
      this.close();
    });
  }

  /**
   * Handle events from OpenAI via data channel
   */
  async handleOpenAIEvent(event) {
    debug('📨 OpenAI event:', event.type);
    console.log('[DEBUG] 📨 OpenAI event:', event.type);

    switch (event.type) {
      case 'session.created':
        console.log('✅ OpenAI session active');
        // Send initial greeting if configured
        break;

      case 'conversation.item.created':
        if (event.item?.type === 'function_call') {
          console.log('🔧 Tool call requested:', event.item.name);
        }
        break;

      case 'response.function_call_arguments.done':
        await this.handleToolCall(event);
        break;

      case 'response.output_audio.delta':
        // Audio is handled via WebRTC track
        debug('🎵 Audio delta received via WebRTC');
        break;

      case 'response.output_audio.done':
        // Audio response completed - clear speaking flag
        this.setSpeaking(false);
        console.log('✅ Response queue empty');
        break;

      case 'response.output_audio_transcript.done':
        console.log('🤖 Barbara:', event.transcript);
        break;

      case 'input_audio_buffer.speech_started':
        console.log('🎤 User started speaking');
        // Cancel current response for barge-in
        this.openaiClient.sendEvent({ type: 'response.cancel' });
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('🎤 User stopped speaking');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        console.log('👤 Caller:', event.transcript);
        break;

      case 'error':
        console.error('❌ OpenAI error:', event.error);
        break;

      default:
        debug('Other event:', event.type);
    }
  }

  /**
   * Handle tool calls from OpenAI
   */
  async handleToolCall(event) {
    const functionName = event.name;
    const callId = event.call_id;
    
    console.log(`🔧 Executing tool: ${functionName}`);

    try {
      const args = JSON.parse(event.arguments);
      
      // Add call context (use extracted call info)
      const enrichedArgs = {
        ...args,
        callSid: this.callInfo.CallSid,
        from: this.callInfo.From,
        to: this.callInfo.To
      };
      
      console.log('🔧 Tool call with context:', {
        functionName,
        callSid: this.callInfo.CallSid,
        from: this.callInfo.From,
        to: this.callInfo.To
      });

      // Execute tool
      const result = await executeTool(functionName, enrichedArgs);
      
      console.log(`✅ Tool result:`, typeof result === 'object' ? JSON.stringify(result).substring(0, 100) : result);

      // Send result back to OpenAI via data channel
      this.openaiClient.sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(result)
        }
      });

      // Trigger response generation
      this.openaiClient.sendEvent({
        type: 'response.create'
      });

    } catch (error) {
      console.error(`❌ Tool execution failed:`, error);
      
      // Send error to OpenAI
      this.openaiClient.sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify({ 
            error: error.message,
            success: false 
          })
        }
      });

      // Still trigger response so AI can acknowledge the error
      this.openaiClient.sendEvent({
        type: 'response.create'
      });
    }
  }

  /**
   * Handle errors
   */
  handleError(error) {
    console.error('❌ Bridge error:', error);
    
    // Log to monitoring service if available
    if (process.env.SENTRY_DSN) {
      // Sentry.captureException(error);
    }
    
    // Close connection on fatal errors
    if (error.message.includes('WebRTC connection failed')) {
      this.close();
    }
  }

  /**
   * Close connection
   */
  close() {
    console.log('🔌 Closing WebRTC bridge...');
    
    // Clear speaking timeout
    if (this.speakingTimeout) {
      clearTimeout(this.speakingTimeout);
      this.speakingTimeout = null;
    }
    
    if (this.openaiClient) {
      try {
        this.openaiClient.close();
      } catch (error) {
        console.error('⚠️ Error closing OpenAI client:', error);
      }
    }

    if (this.signalwireWs && this.signalwireWs.readyState === 1) {
      this.signalwireWs.removeAllListeners();
      this.signalwireWs.close();
    }

    this.isConnected = false;
    this.speaking = false;
    
    console.log('✅ Bridge closed');
  }
}

module.exports = { AudioBridgeWebRTC };

