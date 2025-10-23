const fetch = require('node-fetch');
const { RTCPeerConnection, RTCSessionDescription, nonstandard } = require('wrtc');
const { RTCAudioSource } = nonstandard;

class OpenAIWebRTCClient {
  constructor(apiKey, model = 'gpt-4o-realtime-preview-2024-12-17') {
    this.apiKey = apiKey;
    this.model = model;
    this.peerConnection = null;
    this.dataChannel = null;
    this.sessionConfig = null;
    this.audioSource = null;
    this.audioTrack = null;
    
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
          model: this.model
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create ephemeral session: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Ephemeral session created');
    console.log('🔑 Client secret:', data.client_secret?.value ? 'present' : 'missing');
    console.log('🆔 Session ID:', data.session?.id || 'unknown');
    
    return {
      client_secret: data.client_secret.value,
      session_id: data.session.id,
      expires_at: data.client_secret.expires_at
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
      // Only handle audio tracks
      if (event.track.kind === 'audio') {
        console.log('🎵 Received audio track from OpenAI');
        if (this.onAudioTrack) {
          this.onAudioTrack(event.track, event.streams[0]);
        }
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

    // Set up data channel for events
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

    // Create audio source and track for sending audio to OpenAI
    this.audioSource = new RTCAudioSource();
    this.audioTrack = this.audioSource.createTrack();
    
    // Add the audio track to the peer connection (sendrecv for bidirectional)
    this.peerConnection.addTrack(this.audioTrack);
    console.log('🎤 Added audio track to WebRTC connection');

    console.log('📤 Creating SDP offer...');
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    await this.waitForICEGathering();

    console.log('📤 Sending SDP offer to OpenAI...');
    console.log('🔍 SDP offer length:', this.peerConnection.localDescription.sdp.length);
    console.log('🔍 SDP offer preview:', this.peerConnection.localDescription.sdp.substring(0, 200) + '...');
    console.log('🔍 ICE gathering state:', this.peerConnection.iceGatheringState);
    
    // Send SDP to OpenAI Realtime API endpoint
    const answerResponse = await fetch(`https://api.openai.com/v1/realtime?model=${this.model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clientSecret}`,
        'Content-Type': 'application/sdp'
      },
      body: this.peerConnection.localDescription.sdp
    });

    if (!answerResponse.ok) {
      const errorText = await answerResponse.text();
      console.error('❌ SDP exchange failed:', answerResponse.status, errorText);
      throw new Error(`Failed to exchange SDP: ${answerResponse.status} - ${errorText}`);
    }

    const answerSdp = await answerResponse.text();
    console.log('✅ Received SDP answer from OpenAI, length:', answerSdp.length);
    
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp
      })
    );

    console.log('✅ WebRTC connection established - waiting for connection state...');
  }

  sendAudio(base64Audio) {
    if (!this.audioSource || !this.audioTrack) {
      console.log('⚠️ Audio source not ready');
      return;
    }

    try {
      // Decode base64 PCM16 audio
      const pcmBuffer = Buffer.from(base64Audio, 'base64');
      const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
      
      // Push audio frame to the RTC audio source
      this.audioSource.onData({
        samples: samples,
        sampleRate: 16000, // OpenAI expects 16kHz
        bitsPerSample: 16,
        channelCount: 1,
        numberOfFrames: samples.length
      });
      
      // console.log('📤 Sent audio frame to OpenAI:', samples.length, 'samples');
    } catch (error) {
      console.error('❌ Failed to send audio frame:', error);
    }
  }

  waitForICEGathering() {
    return new Promise((resolve) => {
      if (this.peerConnection.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (this.peerConnection.iceGatheringState === 'complete') {
            this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
            console.log('✅ ICE gathering complete');
            resolve();
          }
        };
        this.peerConnection.addEventListener('icegatheringstatechange', checkState);
        
        // Add timeout to prevent hanging
        setTimeout(() => {
          console.log('⚠️ ICE gathering timeout after 5s');
          console.log('🔍 ICE connection state:', this.peerConnection.iceConnectionState);
          console.log('🔍 ICE gathering state:', this.peerConnection.iceGatheringState);
          this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }, 5000);
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

  close() {
    if (this.audioTrack) {
      this.audioTrack.stop();
      this.audioTrack = null;
    }
    if (this.audioSource) {
      this.audioSource = null;
    }
    if (this.dataChannel) {
      try {
        if (this.dataChannel.readyState === 'open') {
          this.dataChannel.close();
        }
      } catch (error) {
        console.error('⚠️ Error closing data channel:', error);
      }
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (error) {
        console.error('⚠️ Error closing peer connection:', error);
      }
      this.peerConnection = null;
    }
  }
}

module.exports = { OpenAIWebRTCClient };
