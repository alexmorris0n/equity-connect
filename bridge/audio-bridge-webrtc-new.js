/**
 * WebRTC Audio Bridge - OpenAI Realtime API (WebRTC)
 * Replaces the old WebSocket-based audio-bridge.js
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
      const tokenResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1'
        },
        body: JSON.stringify({
          model: process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'alloy'
        })
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Failed to get ephemeral token: ${error}`);
      }

      const { client_secret } = await tokenResponse.json();
      console.log('✅ Got ephemeral token from OpenAI');

      // Step 2: Create RTCPeerConnection
      this.pc = new RTCPeerConnection();
      
      // Step 3: Set up data channel for messages
      this.dataChannel = this.pc.createDataChannel('oai-events');
      this.setupDataChannel();

      // Step 4: Add audio track (for sending audio to OpenAI)
      const audioTransceiver = this.pc.addTransceiver('audio', {
        direction: 'sendrecv'
      });
      this.audioSender = audioTransceiver.sender;

      // Step 5: Handle incoming audio from OpenAI
      this.pc.ontrack = (event) => {
        console.log('🎵 Receiving audio track from OpenAI');
        const stream = event.streams[0];
        const reader = stream.getAudioTracks()[0];
        
        // Process incoming audio and send to SignalWire
        this.handleOpenAIAudio(reader);
      };

      // Step 6: Create offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // Step 7: Send offer to OpenAI and get answer
      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime/calls`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${client_secret.value}`,
          'Content-Type': 'application/sdp',
          'OpenAI-Beta': 'realtime=v1'
        },
        body: offer.sdp
      });

      if (!sdpResponse.ok) {
        const error = await sdpResponse.text();
        throw new Error(`Failed to exchange SDP: ${error}`);
      }

      const answerSdp = await sdpResponse.text();
      
      // Step 8: Set remote description (answer from OpenAI)
      await this.pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });

      console.log('✅ WebRTC connection established!');
      this.webrtcReady = true;

      // Step 9: Flush buffered audio
      this.flushAudioBuffer();

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
      console.log('📡 Data channel opened');
      
      // Configure session
      this.configureSession();
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleOpenAIEvent(message);
      } catch (err) {
        console.error('❌ Error parsing data channel message:', err);
      }
    };

    this.dataChannel.onerror = (err) => {
      console.error('❌ Data channel error:', err);
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

    // Get instructions from callContext or use default
    const instructions = this.callContext.instructions || 
      'You are Barbara, a friendly assistant helping with reverse mortgage inquiries.';

    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        voice: 'alloy',
        instructions: instructions,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
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
    console.log('✅ OpenAI session configured');

    // Start conversation after brief delay
    setTimeout(() => {
      this.startConversation();
    }, 1000);
  }

  /**
   * Start conversation with greeting
   */
  startConversation() {
    if (this.greetingSent) return;
    
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
      response: {}
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
        console.log('✅ Session created');
        break;

      case 'session.updated':
        console.log('✅ Session updated');
        break;

      case 'response.audio.delta':
        // Audio handled via ontrack, but we can log here
        debug('🎵 Audio delta received');
        break;

      case 'response.audio.done':
        this.speaking = false;
        this.responseInProgress = false;
        console.log('🔊 AI finished speaking');
        break;

      case 'response.created':
        this.responseInProgress = true;
        this.speaking = true;
        break;

      case 'error':
        console.error('❌ OpenAI error:', event.error);
        break;
    }
  }

  /**
   * Handle incoming audio from OpenAI and send to SignalWire
   */
  handleOpenAIAudio(audioTrack) {
    // This would use Web Audio API to process the audio track
    // and convert to SignalWire's format
    // For now, this is a placeholder - you'll need to implement
    // the audio processing based on your specific needs
    console.log('🎵 Processing OpenAI audio track');
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
      }
    });

    this.swSocket.on('close', () => {
      console.log('📞 SignalWire disconnected');
      this.cleanup();
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
          console.log('📞 Caller phone:', this.callerPhone);
        }
        break;

      case 'media':
        // Convert SignalWire audio to format for OpenAI
        this.handleSignalWireAudio(msg.media);
        break;

      case 'stop':
        console.log('📞 Call ended');
        this.cleanup();
        break;
    }
  }

  /**
   * Handle incoming audio from SignalWire
   */
  handleSignalWireAudio(media) {
    if (!this.webrtcReady) {
      // Buffer audio until WebRTC is ready
      this.audioBuffer.push(media);
      if (this.audioBuffer.length % 50 === 1) {
        console.log(`[DEBUG] 📦 Buffering audio frame (${this.audioBuffer.length}/50) - WebRTC not ready`);
      }
      return;
    }

    // Convert base64 audio to PCM16 and send to OpenAI
    const audioData = Buffer.from(media.payload, 'base64');
    
    // Send via data channel (input_audio_buffer.append)
    this.dataChannel.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: audioData.toString('base64')
    }));

    // Commit buffer periodically
    if (Date.now() - this.lastCommit > 200) {
      this.dataChannel.send(JSON.stringify({
        type: 'input_audio_buffer.commit'
      }));
      this.lastCommit = Date.now();
    }
  }

  /**
   * Flush buffered audio after WebRTC connects
   */
  flushAudioBuffer() {
    if (this.audioBuffer.length > 0) {
      console.log(`✅ WebRTC ready - flushing ${this.audioBuffer.length} buffered frames`);
      
      for (const media of this.audioBuffer) {
        this.handleSignalWireAudio(media);
      }
      
      this.audioBuffer = [];
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
    
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    if (this.swSocket) {
      this.swSocket.close();
      this.swSocket = null;
    }
  }
}

module.exports = WebRTCAudioBridge;
