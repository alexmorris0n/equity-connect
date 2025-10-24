/**
 * WebRTC Audio Bridge - OpenAI Realtime API (WebRTC)
 * Uses unified OpenAIWebRTCClient for GA-compliant connection
 */

const WebSocket = require('ws');
const debug = require('debug')('barbara:webrtc');
const { OpenAIWebRTCClient } = require('./openai-webrtc-client'); // ✅ use unified client

class WebRTCAudioBridge {
  constructor(swSocket, logger, callContext = {}) {
    this.swSocket = swSocket;
    this.logger = logger;
    this.callContext = callContext;
    
    this.client = null; // ✅
    
    // OpenAI session state
    this.sessionConfigured = false;
    this.greetingSent = false;
    this.callSid = null;
    this.callerPhone = null;
    
    // Audio buffering
    this.audioBuffer = [];
    this.webrtcReady = false;
    this.lastCommit = 0;
    
    // Track state
    this.speaking = false;
    this.responseInProgress = false;
    this.callStartTime = Date.now();
  }

  /**
   * Initialize WebRTC connection to OpenAI
   */
  async connect() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENAI_API_KEY');
    }

    console.log('🚀 Starting WebRTC connection to OpenAI (unified)…');

    try {
      // ✅ Use the new client (already implements /v1/realtime/calls)
      this.client = new OpenAIWebRTCClient(apiKey, process.env.OPENAI_REALTIME_MODEL);

      // hook events
      this.client.onConnected = () => {
        console.log('✅ WebRTC established'); 
        this.webrtcReady = true;
        this.flushAudioBuffer();
        this.configureSession(); // still send session.update after DC opens
      };
      this.client.onMessage = (m) => this.handleOpenAIEvent(m);
      this.client.onAudioTrack = (track, stream) => {
        console.log('🎵 OpenAI audio track received (todo: stream back to SignalWire)');
        // implement server-side playback to SignalWire if needed
      };

      await this.client.connectWebRTC(); // does ephemeral+offer+POST /v1/realtime/calls
      this.setupSignalWireHandlers();

    } catch (err) {
      console.error('❌ WebRTC connection failed:', err);
      this.logger.error({ err }, 'WebRTC connection failed');
      throw err;
    }
  }

  /**
   * Set up data channel for OpenAI events
   */
  setupDataChannel() { /* handled inside OpenAIWebRTCClient */ }

  /**
   * Configure OpenAI session with Barbara's instructions
   */
  async configureSession() { // unchanged API, but send via client
    if (this.sessionConfigured) return;
    console.log('⚙️ Configuring OpenAI session...');
    const instructions = this.callContext.instructions ||
      'You are Barbara, a friendly assistant helping with reverse mortgage inquiries. Be warm and conversational.';
    this.client?.sendEvent({
      type: 'session.update',
      session: {
        modalities: ['audio','text'],
        voice: 'alloy',
        instructions,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: { type:'server_vad', threshold:0.5, prefix_padding_ms:300, silence_duration_ms:500 }
      }
    });
    this.sessionConfigured = true;
    console.log('✅ OpenAI session configuration sent');
    setTimeout(() => this.startConversation(), 1000);
  }

  /**
   * Start conversation with greeting
   */
  startConversation() {
    if (this.greetingSent) {
      console.log('⚠️ Greeting already sent, skipping');
      return;
    }
    
    console.log('💬 Starting conversation...');
    const callerPhone = this.callContext.from || 'unknown';
    
    // Send call_connected trigger
    this.client?.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: `call_connected from ${callerPhone}`
        }]
      }
    });

    // Request response
    this.client?.sendEvent({
      type: 'response.create',
      response: {
        modalities: ['audio', 'text']
      }
    });

    this.greetingSent = true;
    console.log('✅ Conversation started');
  }

  /**
   * Handle OpenAI events from data channel
   */
  handleOpenAIEvent(event) {
    debug('🤖 OpenAI event:', event.type);

    switch (event.type) {
      case 'session.created':
        console.log('✅ Session created:', event.session.id);
        break;

      case 'session.updated':
        console.log('✅ Session updated successfully');
        break;

      case 'response.audio.delta':
        // Audio is handled via the audio track, not data channel
        // This event just notifies us that audio is being sent
        debug('🎵 Audio delta event (audio sent via track)');
        break;

      case 'response.audio.done':
        this.speaking = false;
        this.responseInProgress = false;
        console.log('🔊 AI finished speaking');
        break;

      case 'response.created':
        this.responseInProgress = true;
        this.speaking = true;
        console.log('🎙️ AI started generating response');
        break;

      case 'response.done':
        console.log('✅ Response completed');
        break;

      case 'error':
        console.error('❌ OpenAI error:', event.error);
        this.logger.error({ error: event.error }, 'OpenAI session error');
        break;

      case 'input_audio_buffer.committed':
        debug('✅ Audio buffer committed');
        break;

      case 'conversation.item.created':
        debug('✅ Conversation item created');
        break;

      default:
        debug('📨 Unhandled event type:', event.type);
    }
  }

  /**
   * Handle incoming audio track from OpenAI
   */
  handleOpenAIAudioTrack(track, stream) {
    console.log('🎵 Setting up OpenAI audio track processing');
    
    // Create a MediaStreamAudioSourceNode to process the audio
    // Note: This requires Web Audio API or a Node.js equivalent
    // For server-side, you'll need to use a library like node-audio
    
    // Placeholder for now - you'll need to implement actual audio processing
    // This should:
    // 1. Receive PCM16 audio from the track
    // 2. Convert/resample if needed for SignalWire
    // 3. Send to SignalWire via sendMediaToSignalWire()
    
    this.logger.info('Audio track received but processing not yet implemented');
  }

  /**
   * Setup SignalWire WebSocket handlers
   */
  setupSignalWireHandlers() {
    this.swSocket.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());
        this.handleSignalWireEvent(msg);
      } catch (err) {
        console.error('❌ Error processing SignalWire message:', err);
        this.logger.error({ err }, 'SignalWire message error');
      }
    });

    this.swSocket.on('close', () => {
      console.log('📞 SignalWire disconnected');
      this.cleanup();
    });

    this.swSocket.on('error', (err) => {
      console.error('❌ SignalWire error:', err);
      this.logger.error({ err }, 'SignalWire socket error');
    });
  }

  /**
   * Handle SignalWire events
   */
  handleSignalWireEvent(msg) {
    switch (msg.event) {
      case 'start':
        console.log('📞 Stream started:', msg.start.streamSid);
        this.callSid = msg.start.streamSid;
        
        // Get caller phone from custom parameters
        if (msg.start.customParameters?.From) {
          this.callerPhone = msg.start.customParameters.From;
          this.callContext.from = this.callerPhone;
          console.log('📞 Caller phone:', this.callerPhone);
        }
        break;

      case 'media':
        // Convert SignalWire audio to format for OpenAI
        this.handleSignalWireAudio(msg.media);
        break;

      case 'stop':
        console.log('📞 Call ended, closing bridge');
        this.cleanup();
        break;

      default:
        debug('📨 Unhandled SignalWire event:', msg.event);
    }
  }

  /**
   * Handle incoming audio from SignalWire
   */
  handleSignalWireAudio(media) {
    if (!this.webrtcReady || !this.client || !this.client.isConnected) {
      this.audioBuffer.push(media);
      if (this.audioBuffer.length % 50 === 1) {
        console.log(`[DEBUG] 📦 Buffering audio frame (${this.audioBuffer.length}) - WebRTC not ready`);
      }
      return;
    }
    // ✅ New path: directly push PCM16@16k frames to the client
    // SignalWire already sends L16@16000h after server.xml change (see Step 2)
    try { this.client.sendAudio(media.payload); } // base64 PCM16LE
    catch (err) {
      console.error('❌ Error sending audio to OpenAI:', err);
      this.logger.error({ err }, 'Error sending audio to OpenAI');
    }
  }

  /**
   * Flush buffered audio after WebRTC connects
   */
  flushAudioBuffer() {
    if (this.audioBuffer.length > 0) {
      console.log(`✅ Flushing ${this.audioBuffer.length} buffered audio frames`);
      
      for (const media of this.audioBuffer) {
        this.handleSignalWireAudio(media);
      }
      
      this.audioBuffer = [];
      console.log('✅ Audio buffer flushed');
    }
  }

  /**
   * Send media to SignalWire
   */
  sendMediaToSignalWire(audioData) {
    if (this.swSocket?.readyState === WebSocket.OPEN) {
      this.swSocket.send(JSON.stringify({
        event: 'media',
        streamSid: this.callSid || 'unknown',
        media: {
          payload: audioData
        }
      }));
    }
  }

  /**
   * Cleanup on disconnect
   */
  cleanup() {
    console.log('🧹 Cleaning up WebRTC bridge');
    try { this.client?.closeSafely?.(); } catch {}
    this.client = null;
    if (this.swSocket && this.swSocket.readyState === WebSocket.OPEN) { try { this.swSocket.close(); } catch {} }
    this.webrtcReady = false;
    console.log('✅ Cleanup complete');
  }
}

module.exports = WebRTCAudioBridge;