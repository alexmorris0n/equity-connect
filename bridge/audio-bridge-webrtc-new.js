/**
 * WebRTC Audio Bridge - OpenAI Realtime API (WebRTC)
 * Corrected version with proper SDP exchange
 */

const { RTCPeerConnection } = require('wrtc');
const WebSocket = require('ws');
const debug = require('debug')('barbara:webrtc');

class WebRTCAudioBridge {
  constructor(swSocket, logger, callContext = {}) {
    this.swSocket = swSocket;
    this.logger = logger;
    this.callContext = callContext;
    
    // WebRTC components
    this.pc = null;
    this.dataChannel = null;
    this.audioSender = null;
    
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

    console.log('🚀 Starting WebRTC connection to OpenAI...');

    try {
      // Step 1: Get ephemeral token from OpenAI
      const model = process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-12-17';
      
      const tokenResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1'
        },
        body: JSON.stringify({
          model: model,
          voice: 'alloy'
        })
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Failed to get ephemeral token: ${error}`);
      }

      const tokenData = await tokenResponse.json();
      const ephemeralKey = tokenData.client_secret.value;
      console.log('✅ Got ephemeral token from OpenAI');

      // Step 2: Create RTCPeerConnection with proper configuration
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });
      
      console.log('📡 RTCPeerConnection created');

      // Step 3: Set up data channel for messages
      this.dataChannel = this.pc.createDataChannel('oai-events', {
        ordered: true
      });
      this.setupDataChannel();
      console.log('📡 Data channel created');

      // Step 4: Add audio transceiver (bidirectional)
      this.pc.addTransceiver('audio', {
        direction: 'sendrecv'
      });
      console.log('🎵 Audio transceiver added');

      // Step 5: Handle incoming audio from OpenAI
      this.pc.ontrack = (event) => {
        console.log('🎵 Receiving audio track from OpenAI');
        if (event.track.kind === 'audio') {
          this.handleOpenAIAudioTrack(event.track, event.streams[0]);
        }
      };

      // Step 6: Monitor ICE connection state
      this.pc.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', this.pc.iceConnectionState);
        if (this.pc.iceConnectionState === 'connected' || 
            this.pc.iceConnectionState === 'completed') {
          console.log('✅ WebRTC peer connection established!');
        } else if (this.pc.iceConnectionState === 'failed' || 
                   this.pc.iceConnectionState === 'disconnected') {
          console.error('❌ WebRTC connection failed or disconnected');
        }
      };

      // Step 7: Create offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      console.log('📤 Created and set local SDP offer');

      // Step 8: Send offer to OpenAI and get answer
      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
          'OpenAI-Beta': 'realtime=v1'
        },
        body: offer.sdp
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        const status = sdpResponse.status;
        console.error(`❌ SDP exchange failed: ${status} ${sdpResponse.statusText}`);
        console.error(`Response body: ${errorText}`);
        throw new Error(`Failed to exchange SDP (${status}): ${errorText}`);
      }

      const answerSdp = await sdpResponse.text();
      console.log('📥 Received SDP answer from OpenAI');
      
      // Step 9: Set remote description (answer from OpenAI)
      await this.pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });
      console.log('✅ Set remote SDP answer');

      // WebRTC is now establishing - we'll mark as ready when data channel opens
      console.log('⏳ Waiting for data channel to open...');

      // Step 10: Set up SignalWire handlers
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
  setupDataChannel() {
    this.dataChannel.onopen = () => {
      console.log('📡 Data channel opened - connection ready!');
      this.webrtcReady = true;
      
      // Flush any buffered audio
      this.flushAudioBuffer();
      
      // Configure session
      this.configureSession();
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleOpenAIEvent(message);
      } catch (err) {
        console.error('❌ Error parsing data channel message:', err);
        this.logger.error({ err, data: event.data }, 'Data channel message parse error');
      }
    };

    this.dataChannel.onerror = (err) => {
      console.error('❌ Data channel error:', err);
      this.logger.error({ err }, 'Data channel error');
    };

    this.dataChannel.onclose = () => {
      console.log('📡 Data channel closed');
      this.cleanup();
    };
  }

  /**
   * Configure OpenAI session with Barbara's instructions
   */
  async configureSession() {
    if (this.sessionConfigured) return;

    console.log('⚙️ Configuring OpenAI session...');

    // Get instructions from callContext or use default
    const instructions = this.callContext.instructions || 
      'You are Barbara, a friendly assistant helping with reverse mortgage inquiries. Be warm and conversational.';

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
          silence_duration_ms: 500
        }
      }
    };

    this.dataChannel.send(JSON.stringify(sessionConfig));
    this.sessionConfigured = true;
    console.log('✅ OpenAI session configuration sent');

    // Start conversation after brief delay
    setTimeout(() => {
      this.startConversation();
    }, 1000);
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
    this.dataChannel.send(JSON.stringify({
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

    // Request response
    this.dataChannel.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['audio', 'text']
      }
    }));

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
    if (!this.webrtcReady || !this.dataChannel || this.dataChannel.readyState !== 'open') {
      // Buffer audio until WebRTC is ready
      this.audioBuffer.push(media);
      if (this.audioBuffer.length % 50 === 1) {
        console.log(`[DEBUG] 📦 Buffering audio frame (${this.audioBuffer.length}) - WebRTC not ready`);
      }
      return;
    }

    // Convert base64 audio to buffer
    const audioData = Buffer.from(media.payload, 'base64');
    
    // Send via data channel (input_audio_buffer.append)
    try {
      this.dataChannel.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioData.toString('base64')
      }));

      // Commit buffer periodically (every 200ms)
      const now = Date.now();
      if (now - this.lastCommit > 200) {
        this.dataChannel.send(JSON.stringify({
          type: 'input_audio_buffer.commit'
        }));
        this.lastCommit = now;
        debug('🎤 Audio buffer committed');
      }
    } catch (err) {
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
    
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.close();
      } catch (err) {
        debug('Error closing data channel:', err);
      }
      this.dataChannel = null;
    }
    
    if (this.pc && this.pc.connectionState !== 'closed') {
      try {
        this.pc.close();
      } catch (err) {
        debug('Error closing peer connection:', err);
      }
      this.pc = null;
    }
    
    if (this.swSocket && this.swSocket.readyState === WebSocket.OPEN) {
      try {
        this.swSocket.close();
      } catch (err) {
        debug('Error closing SignalWire socket:', err);
      }
      this.swSocket = null;
    }

    this.webrtcReady = false;
    console.log('✅ Cleanup complete');
  }
}

module.exports = WebRTCAudioBridge;
