/**
 * Audio Bridge - WebRTC Version
 * Bridges SignalWire WebSocket audio to OpenAI Realtime via WebRTC
 * Uses Cloudflare Tunnel for stable signaling
 */

const { OpenAIWebRTCClient } = require('./openai-webrtc-client');
const { toolDefinitions, executeTool } = require('./tools');
const { getPromptForCall, injectVariables, determinePromptName } = require('./prompt-manager');
const Speaker = require('speaker');
const { spawn } = require('child_process');

const ENABLE_DEBUG_LOGGING = process.env.ENABLE_DEBUG_LOGGING === 'true';

const debug = (...args) => {
  if (ENABLE_DEBUG_LOGGING) {
    console.log('[DEBUG]', ...args);
  }
};

class AudioBridgeWebRTC {
  constructor(signalwireWs, callInfo) {
    this.signalwireWs = signalwireWs;
    this.callInfo = callInfo;
    this.openaiClient = null;
    this.isConnected = false;
    this.audioBuffer = [];
    this.sessionId = null;
    
    // Audio playback for OpenAI responses
    this.speaker = null;
    
    console.log('🎙️ WebRTC Audio Bridge created for call:', callInfo.CallSid);
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
        tool_choice: 'auto'
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

      // Step 5: Establish WebRTC connection
      console.log('🔌 Establishing WebRTC connection...');
      await this.openaiClient.connectWebRTC(sessionInfo.client_secret);

      this.isConnected = true;
      console.log('✅ WebRTC bridge connected!');

      // Step 6: Set up SignalWire audio forwarding
      this.setupSignalWireForwarding();

    } catch (error) {
      console.error('❌ Failed to connect WebRTC bridge:', error);
      throw error;
    }
  }

  /**
   * Set up OpenAI event handlers
   */
  setupEventHandlers() {
    // Connected
    this.openaiClient.onConnected = () => {
      console.log('✅ OpenAI WebRTC connected');
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

    // Errors
    this.openaiClient.onError = (error) => {
      console.error('❌ WebRTC error:', error);
      this.handleError(error);
    };
  }

  /**
   * Handle audio track from OpenAI
   */
  handleOpenAIAudioTrack(track, stream) {
    // Convert WebRTC audio to SignalWire format
    // This is a simplified version - production needs proper transcoding
    
    console.log('🔊 Setting up audio forwarding to SignalWire...');
    
    // Use ffmpeg to convert WebRTC audio to mulaw for SignalWire
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'webm',
      '-i', 'pipe:0',
      '-acodec', 'pcm_mulaw',
      '-ar', '8000',
      '-ac', '1',
      '-f', 'mulaw',
      'pipe:1'
    ]);

    // Handle audio data from track
    const audioContext = new (require('node-web-audio-api').AudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(1024, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      // Convert to base64 and send to SignalWire
      const buffer = Buffer.from(inputData.buffer);
      const base64Audio = buffer.toString('base64');
      
      // Send to SignalWire via WebSocket
      if (this.signalwireWs && this.signalwireWs.readyState === 1) {
        this.signalwireWs.send(JSON.stringify({
          event: 'media',
          streamSid: this.callInfo.streamSid,
          media: {
            payload: base64Audio
          }
        }));
      }
    };
  }

  /**
   * Set up audio forwarding from SignalWire to OpenAI
   */
  setupSignalWireForwarding() {
    this.signalwireWs.on('message', (message) => {
      try {
        const msg = JSON.parse(message);

        if (msg.event === 'media' && msg.media?.payload) {
          // Forward audio from SignalWire to OpenAI via WebRTC
          this.openaiClient.sendAudio(msg.media.payload);
        } else if (msg.event === 'stop') {
          console.log('📞 Call ended, closing bridge');
          this.close();
        }
      } catch (error) {
        console.error('❌ Error processing SignalWire message:', error);
      }
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
        break;

      case 'conversation.item.created':
        if (event.item?.type === 'function_call') {
          console.log('🔧 Tool call:', event.item.name);
        }
        break;

      case 'response.function_call_arguments.done':
        await this.handleToolCall(event);
        break;

      case 'response.audio.delta':
        // Audio is handled via WebRTC track
        debug('🎵 Audio delta received');
        break;

      case 'response.audio_transcript.done':
        console.log('🤖 Barbara:', event.transcript);
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
      
      // Add call context
      const enrichedArgs = {
        ...args,
        callSid: this.callInfo.CallSid,
        from: this.callInfo.From,
        to: this.callInfo.To
      };

      // Execute tool
      const result = await executeTool(functionName, enrichedArgs);
      
      console.log(`✅ Tool result:`, result);

      // Send result back to OpenAI
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
          output: JSON.stringify({ error: error.message })
        }
      });
    }
  }

  /**
   * Handle errors
   */
  handleError(error) {
    console.error('❌ Bridge error:', error);
    
    // Attempt to notify caller
    if (this.signalwireWs && this.signalwireWs.readyState === 1) {
      // Could send a message to SignalWire to play error message
    }
  }

  /**
   * Close connection
   */
  close() {
    console.log('🔌 Closing WebRTC bridge...');
    
    if (this.openaiClient) {
      this.openaiClient.close();
    }

    if (this.signalwireWs && this.signalwireWs.readyState === 1) {
      this.signalwireWs.close();
    }

    this.isConnected = false;
  }
}

module.exports = { AudioBridgeWebRTC };

