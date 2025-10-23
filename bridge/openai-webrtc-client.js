const fetch = require('node-fetch');
const { RTCPeerConnection, RTCSessionDescription } = require('wrtc');

class OpenAIWebRTCClient {
  constructor(apiKey, model = 'gpt-4o-realtime-preview-2024-12-17') {
    this.apiKey = apiKey;
    this.model = model;
    this.peerConnection = null;
    this.dataChannel = null;
    this.sessionConfig = null;
    
    this.onMessage = null;
    this.onAudioTrack = null;
    this.onConnected = null;
    this.onDataChannelOpen = null;
    this.onError = null;
  }

  async createEphemeralSession(sessionConfig) {
    console.log('📞 Creating OpenAI ephemeral session...');
    
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: this.model,
          audio: {
            output: { voice: sessionConfig.voice || 'shimmer' }
          },
          instructions: sessionConfig.instructions,
          turn_detection: sessionConfig.turn_detection || {
            type: 'server_vad',
            threshold: 0.35,
            prefix_padding_ms: 500,
            silence_duration_ms: 2000
          },
          tools: sessionConfig.tools || [],
          tool_choice: sessionConfig.tool_choice || 'auto'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create ephemeral session: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Ephemeral session created:', data.value);
    
    return {
      client_secret: data.value,
      session_id: data.value, // Use the client secret as session ID for now
      expires_at: data.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24h
    };
  }

  async connectWebRTC(clientSecret, sessionId) {
    console.log('🔌 Establishing WebRTC connection...');
    this.sessionId = sessionId;
    
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' }
    ];

    this.peerConnection = new RTCPeerConnection({
      iceServers: iceServers
    });

    console.log('📡 RTCPeerConnection created');

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate:', event.candidate.type);
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('🎵 Received audio track from OpenAI');
      if (this.onAudioTrack) {
        this.onAudioTrack(event.track, event.streams[0]);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('🔌 Connection state:', this.peerConnection.connectionState);
      if (this.peerConnection.connectionState === 'connected') {
        console.log('✅ WebRTC connected!');
        if (this.onConnected) this.onConnected();
      } else if (this.peerConnection.connectionState === 'failed') {
        console.error('❌ WebRTC connection failed');
        if (this.onError) this.onError(new Error('WebRTC connection failed'));
      } else if (this.peerConnection.connectionState === 'disconnected') {
        console.warn('⚠️ WebRTC disconnected');
      }
    };

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

    this.dataChannel.onerror = (error) => {
      console.error('❌ Data channel error:', error);
    };

    this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

    console.log('📤 Creating SDP offer...');
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    await this.waitForICEGathering();

    console.log('📤 Sending SDP offer to OpenAI...');
    const answerResponse = await fetch(`https://api.openai.com/v1/realtime/calls`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clientSecret}`,
        'Content-Type': 'application/sdp'
      },
      body: this.peerConnection.localDescription.sdp
    });

    if (!answerResponse.ok) {
      const errorText = await answerResponse.text();
      throw new Error(`Failed to exchange SDP: ${answerResponse.status} - ${errorText}`);
    }

    const answerSdp = await answerResponse.text();
    
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp
      })
    );

    console.log('✅ WebRTC connection established - waiting for connection state...');
  }

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

  sendEvent(event) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(event));
    } else {
      console.error('❌ Data channel not open');
    }
  }

  sendAudio(audioBase64) {
    this.sendEvent({
      type: 'input_audio_buffer.append',
      audio: audioBase64
    });
  }

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
