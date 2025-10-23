/**
 * OpenAI Realtime API WebRTC Client (Node.js)
 * Uses ephemeral sessions + WebRTC for better audio quality and stability
 */

const fetch = require('node-fetch');
const { RTCPeerConnection, RTCSessionDescription } = require('wrtc');

class OpenAIWebRTCClient {
  constructor(apiKey, model = 'gpt-4o-realtime-preview-2024-12-17') {
    this.apiKey = apiKey;
    this.model = model;
    this.peerConnection = null;
    this.dataChannel = null;
    this.sessionConfig = null;
    
    // Event handlers
    this.onMessage = null;
    this.onAudioTrack = null;
    this.onConnected = null;
    this.onDataChannelOpen = null;
    this.onError = null;
  }

  /**
   * Step 1: Create ephemeral session via REST API
   * Returns client_secret for WebRTC connection
   */
  async createEphemeralSession(sessionConfig) {
    console.log('📞 Creating OpenAI ephemeral session...');
    
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        voice: sessionConfig.voice || 'shimmer',
        instructions: sessionConfig.instructions,
        modalities: ['audio', 'text'],
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        temperature: sessionConfig.temperature || 0.95,
        turn_detection: sessionConfig.turn_detection || {
          type: 'server_vad',
          threshold: 0.35,
          prefix_padding_ms: 500,
          silence_duration_ms: 2000
        },
        tools: sessionConfig.tools || [],
        tool_choice: sessionConfig.tool_choice || 'auto'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create ephemeral session: ${error}`);
    }

    const session = await response.json();
    console.log('✅ Ephemeral session created:', session.id);
    
    return {
      client_secret: session.client_secret.value,
      session_id: session.id,
      expires_at: session.client_secret.expires_at
    };
  }

  /**
   * Step 2: Connect via WebRTC using client_secret
   */
  async connectWebRTC(clientSecret) {
    console.log('🔌 Establishing WebRTC connection...');
    
    // Configure ICE servers (using public STUN)
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];

    // Create RTCPeerConnection
    this.peerConnection = new RTCPeerConnection({
      iceServers: iceServers,
      iceCandidatePoolSize: 10
    });

    console.log('📡 RTCPeerConnection created');

    // Set up event handlers
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate:', event.candidate.type);
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('🎵 Received audio track');
      if (this.onAudioTrack) {
        this.onAudioTrack(event.track, event.streams[0]);
      }
    });

    this.peerConnection.onconnectionstatechange = () => {
      console.log('🔌 Connection state:', this.peerConnection.connectionState);
      if (this.peerConnection.connectionState === 'connected') {
        console.log('✅ WebRTC connected!');
        if (this.onConnected) this.onConnected();
      } else if (this.peerConnection.connectionState === 'failed') {
        console.error('❌ WebRTC connection failed');
        if (this.onError) this.onError(new Error('WebRTC connection failed'));
      }
    };

    // Create data channel for events (like WebSocket messages)
    this.dataChannel = this.peerConnection.createDataChannel('oai-events', {
      ordered: true
    });

    this.dataChannel.onopen = () => {
      console.log('📡 Data channel opened');
      if (this.onDataChannelOpen) this.onDataChannelOpen();
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (this.onMessage) this.onMessage(message);
      } catch (err) {
        console.error('❌ Failed to parse data channel message:', err);
      }
    };

    // Add a transceiver for bidirectional audio (send and receive)
    this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

    // Create offer
    console.log('📤 Creating SDP offer...');
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering to complete
    await this.waitForICEGathering();

    // Send offer to OpenAI and get answer (per official OpenAI docs)
    console.log('📤 Sending SDP offer to OpenAI...');
    const answerResponse = await fetch(`https://api.openai.com/v1/realtime?model=${this.model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clientSecret}`,
        'Content-Type': 'application/sdp'
      },
      body: this.peerConnection.localDescription.sdp
    });

    if (!answerResponse.ok) {
      throw new Error(`Failed to exchange SDP: ${await answerResponse.text()}`);
    }

    const answerSdp = await answerResponse.text();
    
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp
      })
    );

    console.log('✅ WebRTC connection established');
  }

  /**
   * Wait for ICE gathering to complete
   */
  waitForICEGathering() {
    return new Promise((resolve) => {
      if (this.peerConnection.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (this.peerConnection.iceGatheringState === 'complete') {
            this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        this.peerConnection.addEventListener('icegatheringstatechange', checkState);
      }
    });
  }

  /**
   * Send event via data channel
   */
  sendEvent(event) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(event));
    } else {
      console.error('❌ Data channel not open');
    }
  }

  /**
   * Send audio data
   */
  sendAudio(audioBase64) {
    this.sendEvent({
      type: 'input_audio_buffer.append',
      audio: audioBase64
    });
  }

  /**
   * Close connection
   */
  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
  }
}

module.exports = { OpenAIWebRTCClient };

