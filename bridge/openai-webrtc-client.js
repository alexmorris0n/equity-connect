const fetch = require('node-fetch');
const { RTCPeerConnection, RTCSessionDescription, nonstandard } = require('wrtc');
const { RTCAudioSource } = nonstandard;

// Patch D: Wait for ICE gathering to complete (or end-of-candidates)
function waitForIceGatheringComplete(pc, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve('complete');

    let done = false;
    const finish = (label) => {
      if (done) return;
      done = true;
      pc.removeEventListener('icegatheringstatechange', onState);
      pc.removeEventListener('icecandidate', onCand);
      resolve(label || pc.iceGatheringState);
    };
    const onState = () => (pc.iceGatheringState === 'complete') && finish('complete');
    const onCand = (e) => { if (!e.candidate) finish('end-of-candidates'); };

    pc.addEventListener('icegatheringstatechange', onState);
    pc.addEventListener('icecandidate', onCand);
    setTimeout(() => finish('timeout'), timeoutMs);
  });
}

// Fix 1: Put a=end-of-candidates inside the audio m-section
function insertEndOfCandidatesInAudio(sdp) {
  // Find the audio m-section [m=audio ... up to next m= or end]
  return sdp.replace(/(m=audio[\s\S]*?)(\r?\n)(?=m=|$)/, (full, audioBlock, tailNewline) => {
    // If audio block already has end-of-candidates, keep as is
    if (/\r?\na=end-of-candidates(?:\r?\n|$)/m.test(audioBlock)) return full;
    // Append end-of-candidates at the end of the audio block
    const fixed = audioBlock.replace(/\s*$/, '') + '\r\na=end-of-candidates';
    return fixed + tailNewline;
  });
}

// Fix 2: Normalize CRLF and guarantee final CRLF
function normalizeSdpCrLf(sdp) {
  // Convert to CRLF
  let out = sdp.replace(/\r?\n/g, '\r\n');
  // Collapse accidental double blank lines that can appear during munging
  out = out.replace(/(\r\n){3,}/g, '\r\n\r\n');
  // Ensure SDP ends with a single CRLF
  if (!out.endsWith('\r\n')) out += '\r\n';
  return out;
}

class OpenAIWebRTCClient {
  constructor(apiKey, model = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime') {
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

    this._pcmRemainder = new Int16Array(0); // carryover between frames
  }

  async createEphemeralSession(sessionConfig) {
    try {
    console.log('📞 Creating OpenAI ephemeral session...');
      this.sessionCreatedAt = Date.now(); // Track when session was created
    
      const url = 'https://api.openai.com/v1/realtime/client_secrets';
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1',
      };

      const postClientSecret = async (payload, label) => {
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
        const text = await res.text();
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} creating client secret (${label}): ${text}`);
        }
        let data;
        try { data = JSON.parse(text); } catch { throw new Error(`Invalid JSON from client_secrets (${label}): ${text}`); }
        return data;
      };

      // 1) Preferred: minimal session wrapper (type + model only)
      try {
        const data = await postClientSecret({
          session: { type: 'realtime', model: this.model }   // ✅ minimal, no voice/modalities here
        }, 'session.model');
        
        // ✅ Accept multiple possible response shapes (defensive parsing)
        const secret =
          (data?.client_secret && typeof data.client_secret === 'string' && data.client_secret) ||
          (data?.client_secret?.value && typeof data.client_secret.value === 'string' && data.client_secret.value) ||
          (data?.value && typeof data.value === 'string' && data.value) ||
          (data?.secret && typeof data.secret === 'string' && data.secret) ||
          null;

        const sessionId = data?.session?.id || data?.session_id || null;
        
        // Fix expires_at parsing (handle seconds vs milliseconds)
        const expiresAtRaw = data?.client_secret?.expires_at || data?.expires_at || null;
        let expiresAt = null;
        if (typeof expiresAtRaw === 'number') {
          // If it looks like seconds, convert to ms
          expiresAt = expiresAtRaw < 10_000_000_000 ? expiresAtRaw * 1000 : expiresAtRaw;
        } else if (typeof expiresAtRaw === 'string') {
          // ISO string
          expiresAt = Date.parse(expiresAtRaw);
        }

        if (!secret) {
          const keys = data && typeof data === 'object' ? Object.keys(data) : [];
          throw new Error(
            `Missing client_secret in response. Available keys: [${keys.join(', ')}]`
          );
        }

        console.log('✅ Ephemeral session created');
        console.log('🔑 Client secret:', secret ? 'present' : 'missing');
        if (sessionId) console.log('🆔 Session ID:', sessionId);
        if (expiresAt) console.log('⏰ Expires at:', new Date(expiresAt).toISOString());
        console.log('🔍 Session bound model:', this.model);
        
        return {
          clientSecret: secret,
          sessionId: sessionId,
          expiresAt: expiresAt
        };
      } catch (e) {
        // If server doesn't like the session wrapper, fall back to top-level model
        if (!/session\.voice|unknown parameter|session\./i.test(String(e.message))) throw e;
        console.warn('⚠️ session.* rejected; retrying with top-level model', e.message);
      }

      // 2) Fallback: top-level model
      const data = await postClientSecret({
        model: this.model                                // ✅ top-level
        // optional: expires_in_seconds: 60
      }, 'model');
      
      // ✅ Accept multiple possible response shapes (defensive parsing)
      const secret =
        (data?.client_secret && typeof data.client_secret === 'string' && data.client_secret) ||
        (data?.client_secret?.value && typeof data.client_secret.value === 'string' && data.client_secret.value) ||
        (data?.value && typeof data.value === 'string' && data.value) ||
        (data?.secret && typeof data.secret === 'string' && data.secret) ||
        null;

      const sessionId = data?.session?.id || data?.session_id || null;
      
      // Fix expires_at parsing (handle seconds vs milliseconds)
      const expiresAtRaw = data?.client_secret?.expires_at || data?.expires_at || null;
      let expiresAt = null;
      if (typeof expiresAtRaw === 'number') {
        // If it looks like seconds, convert to ms
        expiresAt = expiresAtRaw < 10_000_000_000 ? expiresAtRaw * 1000 : expiresAtRaw;
      } else if (typeof expiresAtRaw === 'string') {
        // ISO string
        expiresAt = Date.parse(expiresAtRaw);
      }

      if (!secret) {
        const keys = data && typeof data === 'object' ? Object.keys(data) : [];
        throw new Error(
          `Missing client_secret in response. Available keys: [${keys.join(', ')}]`
        );
      }

      console.log('✅ Ephemeral session created (top-level model)');
      console.log('🔑 Client secret:', secret ? 'present' : 'missing');
      if (sessionId) console.log('🆔 Session ID:', sessionId);
      if (expiresAt) console.log('⏰ Expires at:', new Date(expiresAt).toISOString());
      console.log('🔍 Session bound model:', this.model);
    
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

  async connectWebRTC() {
    console.log('🔌 Establishing WebRTC connection (unified interface)...');
    
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' }
    ];

    this.peerConnection = new RTCPeerConnection({
      iceServers: iceServers,
      bundlePolicy: 'max-bundle'
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

    // Set up data channel for events (BEFORE createOffer)
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

    // 1.5) Munge SDP to Opus-only for better compatibility
    let sdp = this.peerConnection.localDescription.sdp;
    
    // Keep only opus (payload 111); strip others from the m=audio line
    sdp = sdp.replace(
      /(m=audio \d+ UDP\/TLS\/RTP\/SAVPF) .*\r\n/,
      (_, head) => `${head} 111\r\n`
    );

    // Remove fmtp/rtpmap lines for removed codecs
    sdp = sdp
      .split('\r\n')
      .filter(line => !/^a=(rtpmap|fmtp):(?!(111)\b)/.test(line))
      .join('\r\n');

    // Patch E: Remove ALL "a=ice-options:*" lines anywhere in the SDP
    sdp = sdp.replace(/^a=ice-options:.*\r?\n/gm, '');
    
    // Sanity check for remaining trickle lines
    if (/\na=ice-options:/m.test(sdp)) {
      console.warn('⚠️ SDP still contains ice-options after munging');
    }

    // Patch F: Make Opus explicitly mono (minimal parameters)
    sdp = sdp.replace(
      /a=fmtp:111 minptime=10;useinbandfec=1/g,
      'a=fmtp:111 minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0'
    );
    
    // Add ptime for better compatibility
    if (!sdp.includes('a=ptime:')) {
      sdp = sdp.replace(/(a=fmtp:111[^\r\n]*)/, '$1\r\na=ptime:20');
    }

    await this.peerConnection.setLocalDescription({ type: 'offer', sdp });
    console.log('🎵 SDP munged to Opus-only for better compatibility');

    // Patch D: Wait for ICE gathering to complete (or end-of-candidates)
    const gatherState = await waitForIceGatheringComplete(this.peerConnection, 5000);
    console.log(`🔍 ICE gathering final state: ${gatherState}`);

    const localSdp = this.peerConnection.localDescription?.sdp || '';
    if (!localSdp || !/m=audio/.test(localSdp)) {
      throw new Error('Local SDP missing or has no audio m-line');
    }

    // Preflight validation to prevent mystery 400s
    if (!/m=audio /.test(localSdp)) throw new Error('Local SDP missing audio m= line');
    if (/a=ice-options:/.test(localSdp)) console.warn('⚠️ ice-options line still present');
    if (!/a=rtpmap:111 opus\/48000\/2/.test(localSdp)) console.warn('⚠️ opus rtpmap missing');
    if (!/a=fmtp:111/.test(localSdp)) console.warn('⚠️ opus fmtp missing');

    // Final SDP preparation for maximum compatibility
    let sdpToPost = localSdp;
    
    // 1. Insert end-of-candidates INSIDE the audio section (not at the end)
    sdpToPost = insertEndOfCandidatesInAudio(sdpToPost);
    
    // 2. Normalize CRLF and guarantee double-CRLF termination
    sdpToPost = sdpToPost.replace(/\r?\n/g, '\r\n');
    if (!sdpToPost.endsWith('\r\n\r\n')) {
      if (!sdpToPost.endsWith('\r\n')) sdpToPost += '\r\n';
      sdpToPost += '\r\n';
    }
    
    // 3. Add CBR=0 for mid-call bitrate adaptation (some stacks like it)
    sdpToPost = sdpToPost.replace(/a=fmtp:111 [^\r\n]*/g,
      'a=fmtp:111 minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;maxaveragebitrate=20000;cbr=0');

    // 4. Enhanced sanity checks
    if (!/^v=0\r\n/.test(sdpToPost)) console.warn('⚠️ SDP does not start with v=0');
    if (/a=ice-options:/m.test(sdpToPost)) console.warn('⚠️ Trickle still present');
    if (!/m=audio .* 111(?:\r\n|$)/.test(sdpToPost)) console.warn('⚠️ Not Opus-only');
    if (!/m=application.*webrtc-datachannel/.test(sdpToPost)) console.warn('⚠️ Missing data channel section');
    if (!sdpToPost.endsWith('\r\n\r\n')) console.warn('⚠️ SDP missing double-CRLF termination');
    if (sdpToPost.includes('\n') && !sdpToPost.includes('\r\n')) console.warn('⚠️ SDP not normalized to CRLF');
    if (/^"/.test(sdpToPost) || sdpToPost.includes('\\n')) console.warn('⚠️ SDP looks JSON-escaped');

    // 5. Quick verification log (hex tail - should end with 0d0a0d0a)
    const tail = Buffer.from(sdpToPost.slice(-8), 'utf8');
    console.log('🔎 SDP tail hex (last 8 chars):', tail.toString('hex'));

    console.log('📤 Sending SDP offer to OpenAI...');
    console.log('🔍 SDP offer length:', sdpToPost.length);
    console.log('🔍 SDP offer preview:', sdpToPost.substring(0, 200) + '...');
    console.log('🔍 ICE gathering state:', this.peerConnection.iceGatheringState);
    console.log('🔍 Model:', this.model);
    
    // SDP sanity checks
    console.log('🔍 SDP type check:', offer.type);
    console.log('🔍 SDP tail hex (last 12 chars):', Buffer.from(sdpToPost.slice(-12)).toString('hex'));
    if (!sdpToPost.endsWith('\r\n\r\n')) {
      console.warn('⚠️ SDP does not end with \\r\\n\\r\\n');
    }
    
    // 3) POST SDP to Realtime (session is now model-bound)
    const base = 'https://api.openai.com/v1/realtime/calls';

    const postSdpOnce = async () => {
      const FormData = require('form-data');
      const fd = new FormData();
      fd.append('sdp', sdpToPost);
      
      // Try minimal session first (common gotcha fix)
      const sessionConfig = {
        type: 'realtime',
        model: this.model,
        audio: { output: { voice: 'marin' } }
      };
      
      console.log('🔍 Session config:', JSON.stringify(sessionConfig, null, 2));
      fd.append('session', JSON.stringify(sessionConfig));

      console.log('🔍 URL:', base);
      console.log('🔍 Auth key prefix:', this.apiKey.substring(0, 6) + '...');
      console.log('🔍 Model:', this.model);
      console.log('🔍 Full SDP offer:\n' + sdpToPost);

      const res = await fetch(base, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...fd.getHeaders()
        },
        body: fd
      });

      const xrid = res.headers.get('x-request-id');
      console.log('🔍 Response status:', res.status, 'req:', xrid);
      
      if (!res.ok) {
        const bodyText = await res.text();
        console.log('🔍 Response body (raw):', bodyText);
        throw new Error(`Realtime calls failed ${res.status} (req ${xrid})\n${bodyText}`);
      }
      
      const answerSdp = await res.text();
      console.log('🔍 Answer SDP length:', answerSdp.length);
      console.log('🔍 Answer SDP preview:', answerSdp.substring(0, 60) + '...');
      return answerSdp;
    };

    console.log('🔄 Trying SDP exchange with unified interface...');
    const answerSdp = await postSdpOnce();
    console.log('✅ SDP exchange successful with unified interface');

    // 4) Set remote description
    console.log('✅ Received SDP answer from OpenAI, length:', answerSdp.length);
    
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp
      })
    );

    // Data channel is already created before the offer

    console.log('✅ WebRTC connection established - waiting for connection state...');
  }

  sendAudio(base64Audio) {
    if (!this.audioSource || !this.audioTrack) {
      console.log('⚠️ Audio source not ready');
      return;
    }

    try {
      // Decode base64 PCM16 (mono, 16kHz)
      const pcmBuffer = Buffer.from(base64Audio, 'base64');
      const incoming = new Int16Array(
        pcmBuffer.buffer,
        pcmBuffer.byteOffset,
        pcmBuffer.length / 2
      );

      // Concatenate remainder + incoming
      let combined;
      if (this._pcmRemainder.length) {
        combined = new Int16Array(this._pcmRemainder.length + incoming.length);
        combined.set(this._pcmRemainder, 0);
        combined.set(incoming, this._pcmRemainder.length);
      } else {
        combined = incoming;
      }

      // Send in 10ms chunks (160 samples @ 16kHz)
      const FRAME = 160;
      const fullFrames = Math.floor(combined.length / FRAME);
      for (let i = 0; i < fullFrames; i++) {
        const start = i * FRAME;
        const end = start + FRAME;
        const slice = combined.subarray(start, end);

        this.audioSource.onData({
          samples: slice,
          sampleRate: 16000,
          bitsPerSample: 16,
          channelCount: 1,
          numberOfFrames: FRAME
        });
      }

      // Keep any leftover < 160 for the next call
      const leftoverStart = fullFrames * FRAME;
      if (leftoverStart < combined.length) {
        this._pcmRemainder = combined.subarray(leftoverStart);
      } else {
        this._pcmRemainder = new Int16Array(0);
      }
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
