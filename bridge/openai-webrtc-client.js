const fetch = require('node-fetch');
const { RTCPeerConnection, RTCSessionDescription, nonstandard } = require('wrtc');
const { RTCAudioSource } = nonstandard;

class OpenAIWebRTCClient {
  constructor(apiKey, model = 'gpt-realtime') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://api.openai.com';
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
    try {
      console.log('📞 Creating OpenAI ephemeral session...');
      this.sessionCreatedAt = Date.now(); // Track when session was created
      
      const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session: { type: 'realtime' }
        })
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} creating client secret: ${text}`);
      }

      const data = await response.json();

      // ✅ Accept multiple possible response shapes (defensive parsing)
      const secret =
        (data?.client_secret && typeof data.client_secret === 'string' && data.client_secret) ||
        (data?.client_secret?.value && typeof data.client_secret.value === 'string' && data.client_secret.value) ||
        (data?.value && typeof data.value === 'string' && data.value) ||
        (data?.secret && typeof data.secret === 'string' && data.secret) ||
        null;

      const sessionId = data?.session?.id || data?.session_id || null;
      const expiresAt = data?.client_secret?.expires_at || data?.expires_at || null;

      if (!secret) {
        const keys = data && typeof data === 'object' ? Object.keys(data) : [];
        throw new Error(
          `Missing client_secret in response. Available keys: [${keys.join(', ')}]`
        );
      }

      console.log('✅ Ephemeral session created');
      console.log('🔑 Client secret:', secret ? 'present' : 'missing');
      if (sessionId) console.log('🆔 Session ID:', sessionId);
      
      return {
        clientSecret: secret,
        sessionId: sessionId,
        expiresAt: expiresAt
      };
    } catch (err) {
      console.error(`❌ Failed to create ephemeral session: ${err.message}`);
      throw err;
    }
  }

  async connectWebRTC(clientSecret, sessionId) {
    console.log('🔌 Establishing WebRTC connection...');
    this.sessionId = sessionId;
    
    // 0) Sanity check: must be an ek_ token
    if (!clientSecret || !/^ek_/.test(clientSecret)) {
      throw new Error('Missing/invalid ephemeral client secret (expected ek_*)');
    }
    
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

    // 1) Create offer with explicit audio configuration
    console.log('📤 Creating SDP offer...');
    const offer = await this.peerConnection.createOffer({ 
      offerToReceiveAudio: true, 
      offerToReceiveVideo: false 
    });
    await this.peerConnection.setLocalDescription(offer);

    // 2) Wait for ICE gathering to complete (or timeout) so SDP isn't empty
    await new Promise((resolve) => {
      if (this.peerConnection.iceGatheringState === 'complete') return resolve();
      const done = () => {
        if (this.peerConnection.iceGatheringState === 'complete') {
          this.peerConnection.removeEventListener('icegatheringstatechange', done);
          resolve();
        }
      };
      this.peerConnection.addEventListener('icegatheringstatechange', done);
      setTimeout(() => { 
        this.peerConnection.removeEventListener('icegatheringstatechange', done); 
        resolve(); 
      }, 5000); // Increased timeout to 5s for better ICE gathering
    });

    const localSdp = this.peerConnection.localDescription?.sdp || '';
    if (!localSdp || !/m=audio/.test(localSdp)) {
      throw new Error('Local SDP missing or has no audio m-line');
    }

    console.log('📤 Sending SDP offer to OpenAI...');
    console.log('🔍 SDP offer length:', localSdp.length);
    console.log('🔍 SDP offer preview:', localSdp.substring(0, 200) + '...');
    console.log('🔍 ICE gathering state:', this.peerConnection.iceGatheringState);
    console.log('🔍 Client secret prefix:', clientSecret.substring(0, 10) + '...');
    console.log('🔍 Model:', this.model);
    console.log('🔍 Ephemeral age (ms):', Date.now() - this.sessionCreatedAt);
    
    // 3) POST SDP to Realtime (SDP flow)
    const url = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(this.model)}`;
    console.log('🔍 URL:', url);
    
    // Log the full SDP for debugging
    console.log('🔍 Full SDP offer:');
    console.log(localSdp);
    
    // Retry logic for SDP POST with exponential backoff
    const trySdpPost = async () => {
      let delay = 250;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          console.log(`🔄 SDP attempt ${attempt}/5...`);
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              // ✅ must be the ephemeral ek_* here, NOT your server sk_*
              'Authorization': `Bearer ${clientSecret}`,
              'Content-Type': 'application/sdp',
              'OpenAI-Beta': 'realtime=v1'
            },
            body: localSdp
          });

          const bodyText = await res.text();
          console.log('🔍 Response status:', res.status);
          console.log('🔍 Response headers:', Object.fromEntries(res.headers.entries()));
          console.log('🔍 Response body:', bodyText.substring(0, 500));
          
          if (res.ok) {
            console.log(`✅ SDP exchange successful on attempt ${attempt}`);
            return bodyText;
          }
          
          // Retry only on 5xx; bail fast on 4xx (auth, etc.)
          if (res.status < 500) {
            throw new Error(`Failed to exchange SDP: ${res.status} - ${bodyText || '<no body>'}`);
          }
          
          console.warn(`⚠️ SDP attempt ${attempt} got ${res.status}; retrying in ${delay}ms...`);
        } catch (e) {
          // Network or CF edge hiccup: retry
          if (attempt === 5) throw e;
          console.warn(`⚠️ SDP attempt ${attempt} error: ${e.message}; retrying in ${delay}ms...`);
        }
        
        if (attempt < 5) {
          const jitter = Math.round(delay * (0.7 + Math.random() * 0.6));
          await new Promise(r => setTimeout(r, jitter));
          delay *= 2;
        }
      }
    };
    
    const bodyText = await trySdpPost();

    // 4) Set remote description
    const answerSdp = bodyText; // API returns SDP answer as plain text
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
