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
    
    // Debug: Log the call info passed from server
    console.log('🔍 Call info from server:', JSON.stringify(callInfo, null, 2));
    
    // Audio handling
    this.incomingAudioBuffer = [];
    this.audioContext = null;
    this.mediaStreamDestination = null;
    
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
      const sessionConfig = {
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
        tool_choice: 'auto',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16'
      };

      // Step 2: Create OpenAI WebRTC client
      this.openaiClient = new OpenAIWebRTCClient(
        process.env.OPENAI_API_KEY,
        'gpt-4o-realtime-preview-2024-12-17'
      );

      // Step 3: Set up event handlers
      this.setupEventHandlers();

      // Step 4: Create ephemeral session
      console.log('📞 Creating ephemeral session...');
      const sessionInfo = await this.openaiClient.createEphemeralSession(sessionConfig);
      this.sessionId = sessionInfo.session_id;
      console.log('✅ Session created:', this.sessionId);
      console.log('⏰ Expires at:', new Date(sessionInfo.expires_at));

      // Step 5: Establish WebRTC connection
      console.log('🔌 Establishing WebRTC connection...');
      await this.openaiClient.connectWebRTC(sessionInfo.client_secret, this.sessionId);

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

    track.onmute = () => this.logger.info('🔇 OpenAI audio track muted');
    track.onunmute = () => this.logger.info('🔊 OpenAI audio track unmuted');
    track.onended = () => this.logger.info('🔚 OpenAI audio track ended');

    // WebRTC audio handling - convert OpenAI audio back to SignalWire format
    console.log('🔊 WebRTC audio track received, setting up forwarding...');
    
    // Create audio context for processing OpenAI audio
    const audioContext = new (require('audio-context'))();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);
      
      // Convert Float32 to Int16 PCM
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
      }
      
      // Downsample from 16kHz to 8kHz and encode to μ-law
      const pcm8 = downsampleTo8k(pcm16);
      const mulawBuffer = encodeMulaw(pcm8);
      const base64Mulaw = Buffer.from(mulawBuffer).toString('base64');
      
      // Send audio back to SignalWire
      if (this.signalwireWs && this.signalwireWs.readyState === 1) {
        this.signalwireWs.send(JSON.stringify({
          event: 'media',
          streamSid: this.streamSid,
          media: {
            payload: base64Mulaw
          }
        }));
      }
    };
    
    source.connect(processor);
    processor.connect(audioContext.destination);
    
    console.log('📡 WebRTC audio track processing setup complete');
  }

  /**
   * Set up audio forwarding from SignalWire to OpenAI
   */
  setupSignalWireForwarding() {
    this.signalwireWs.on('message', (message) => {
      try {
        const msg = JSON.parse(message);

        if (msg.event === 'start') {
          this.streamSid = msg.start.streamSid;
          console.log('📞 Stream started:', this.streamSid);
          
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
          if (!this.isConnected) {
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
            const maxAmplitude = Math.max(...Array.from(pcm16).map(Math.abs));
            if (maxAmplitude > 100) { // Only log if there's actual audio
              console.log(`🎤 SignalWire audio: ${pcm16.length} samples, max amplitude: ${maxAmplitude}`);
            }

            // Send audio to OpenAI via WebRTC data channel
            if (this.openaiClient && this.openaiClient.dataChannel && this.openaiClient.dataChannel.readyState === 'open') {
              this.openaiClient.sendAudio(base64PCM);
            } else {
              console.log('⚠️ WebRTC data channel not ready, skipping audio');
            }
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
    
    // Clean up audio context (simplified)
    if (this.audioContext) {
      this.audioContext = null;
    }
    
    if (this.openaiClient) {
      this.openaiClient.close();
    }

    if (this.signalwireWs && this.signalwireWs.readyState === 1) {
      this.signalwireWs.close();
    }

    this.isConnected = false;
    this.speaking = false;
    
    console.log('✅ Bridge closed');
  }
}

module.exports = { AudioBridgeWebRTC };

