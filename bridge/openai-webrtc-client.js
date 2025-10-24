const fetch = require('node-fetch');
const { RTCPeerConnection, RTCSessionDescription, nonstandard } = require('wrtc');
const { RTCAudioSource } = nonstandard;

class OpenAIWebRTCClient {
  constructor(apiKey, model = process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-12-17') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://api.openai.com';
    this.peerConnection = null;
    this.dataChannel = null;
    this.sessionConfig = null;
    this.audioSource = null;
    this.audioTrack = null;
    this.isConnected = false;
    this.isClosing = false;
    this.isConnecting = false; // ✅ Prevent duplicate connections
    
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

  async connectWebRTC({ signal } = {}) {
    // ✅ Prevent duplicate connections
    if (this.isConnecting) {
      console.log('⚠️ Connection already in progress, skipping');
      return;
    }
    if (this.isConnected) {
      console.log('⚠️ Already connected, skipping');
      return;
    }
    
    this.isConnecting = true;
    console.log('🔌 Establishing WebRTC connection (unified interface)...');
    
    // ✅ Add connection timeout to prevent 20+ minute delays
    const connectionTimeout = setTimeout(() => {
      if (this.isConnecting && !this.isConnected) {
        console.log('⚠️ WebRTC connection timeout (10s) - forcing close');
        this.closeSafely();
      }
    }, 10000); // 10 second timeout
    
    try {
      // ----- lifecycle guards -----
      if (signal?.aborted) throw new Error('aborted');
      signal?.addEventListener('abort', () => { try { this.closeSafely?.(); } catch {} });

      this.isClosing = false;

    // ----- PC setup -----
    this.peerConnection = new RTCPeerConnection({
      bundlePolicy: 'max-bundle',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
    });

    console.log('📡 RTCPeerConnection created');

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate:', event.candidate.type);
      } else {
        console.log('🧊 ICE candidate gathering complete');
      }
    };
    
    this.peerConnection.onicecandidateerror = (e) => {
      console.error('❌ ICE candidate error', e);
    };

    this.peerConnection.oniceconnectionstatechange = () =>
      console.log('🧊 pc.iceConnectionState =', this.peerConnection?.iceConnectionState);
    this.peerConnection.onicegatheringstatechange = () =>
      console.log('🧊 pc.iceGatheringState =', this.peerConnection?.iceGatheringState);

    this.peerConnection.ontrack = (event) => {
      // Only handle audio tracks
      if (event.track.kind === 'audio') {
        console.log('🎵 Received audio track from OpenAI');
        if (this.onAudioTrack) {
          this.onAudioTrack(event.track, event.streams[0]);
        }
      }
    };

    // Helpful logs
    this.peerConnection.onconnectionstatechange = () => {
      const st = this.peerConnection?.connectionState;
      console.log('🔗 pc.connectionState =', st);
      if (st === 'connected' && !this.isConnected) {
        console.log('✅ WebRTC connection established (optimistic stream start)');
        this.isConnected = true;
        clearTimeout(connectionTimeout); // ✅ Clear timeout on success
        this.onConnected?.();           // flush your prebuffer here
      }
    };

    // ----- Data channel (pre-negotiated) before offer -----
    // This ensures an m=application webrtc-datachannel in the OFFER automatically.
    this.dataChannel = this.peerConnection.createDataChannel('oai-events', {
      negotiated: true,
      id: 0,
      ordered: true,
    });

    this.dataChannel.onopen = () => {
      console.log('📡 Data channel open (oai-events)');
      // You can also mark isConnected here if you prefer waiting for DC:
      // if (!this.isConnected) { this.isConnected = true; this.onConnected?.(); }
      this.onDataChannelOpen?.();
    };
    this.dataChannel.onclose = () => {
      console.log('📡 Data channel closed');
      try { console.log('📡 Data channel ready state:', this.dataChannel?.readyState); } catch {}
    };
    this.dataChannel.onerror = (e) => console.error('📡 Data channel error', e);

    this.dataChannel.onmessage = (event) => {
      try {
        const dataStr = typeof event.data === 'string' ? event.data : event.data.toString();
        const message = JSON.parse(dataStr);
        console.log('📨 Data channel message received:', message.type || 'unknown');
        if (this.onMessage) this.onMessage(message);
      } catch (err) {
        console.error('❌ Failed to parse data channel message:', err);
      }
    };

    // Log data channel state immediately after creation
    console.log('📡 Data channel created, ready state:', this.dataChannel.readyState);

    // ----- Create audio source and track for sending audio to OpenAI -----
    this.audioSource = new RTCAudioSource();
    this.audioTrack = this.audioSource.createTrack();
    
    // Add the audio track to the peer connection (this creates the audio m-line)
    this.peerConnection.addTrack(this.audioTrack);
    console.log('🎤 Added audio track to WebRTC connection');

    // ----- Build OFFER with Opus preferred BEFORE setLocalDescription -----
    const preferOpus = (sdp) => {
      const lines = sdp.split('\n');
      const mIdx = lines.findIndex(l => l.startsWith('m=audio'));
      if (mIdx === -1) return sdp;
      const opus = lines.find(l => /^a=rtpmap:\d+\s+opus\/48000/i.test(l));
      if (!opus) return sdp;
      const pt = opus.match(/^a=rtpmap:(\d+)/i)?.[1];
      if (!pt) return sdp;
      const parts = lines[mIdx].trim().split(' ');
      const head = parts.slice(0, 3);
      const payloads = parts.slice(3).filter(p => p !== pt);
      lines[mIdx] = [...head, pt, ...payloads].join(' ');
      return lines.join('\n');
    };

    console.log('📤 Creating SDP offer…');
    let offer = await this.peerConnection.createOffer();
    offer = { type: 'offer', sdp: preferOpus(offer.sdp) };
    console.log('📤 SDP offer created');
    
    await this.peerConnection.setLocalDescription(offer);

    // Guard against null localDescription after teardown
    if (!this.peerConnection || !this.peerConnection.localDescription) {
      throw new Error('Peer connection not ready: localDescription is null');
    }

    // ----- Complete ICE (non-trickle) with small timeout -----
    if (this.peerConnection.iceGatheringState !== 'complete') {
      console.log('⏳ Waiting for ICE gathering (max 800ms)...');
      await new Promise((resolve) => {
        const to = setTimeout(() => {
          console.log('⚠️ ICE gathering timeout - proceeding anyway');
          resolve();
        }, 800); // ✅ Reduced from 2500ms to 800ms
        const onchg = () => {
          if (this.peerConnection?.iceGatheringState === 'complete') {
            this.peerConnection.removeEventListener('icegatheringstatechange', onchg);
            clearTimeout(to);
            console.log('✅ ICE gathering completed early');
            resolve();
          }
        };
        this.peerConnection.addEventListener('icegatheringstatechange', onchg);
      });
    }

    const offerSdp = this.peerConnection.localDescription.sdp;
    console.log('📤 Sending SDP offer (len=%d)…', offerSdp?.length ?? -1);

    // ----- POST offer to OpenAI (your existing HTTP function) -----
    const answerSdp = await this.postOfferToOpenAI(offerSdp); // implement/keep your version
    if (!answerSdp) throw new Error('Empty SDP answer from OpenAI');

    console.log('📥 Received SDP answer (len=%d)', answerSdp.length);

    // ----- Set ANSWER -----
    if (!this.peerConnection || this.isClosing) {
      console.log('⚠️ Connection closed/closing before answer received - ignoring SDP answer');
      return;
    }
    
    try {
      await this.peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    } catch (error) {
      if (this.isClosing) {
        console.log('⚠️ Connection closing during setRemoteDescription - ignoring error');
        return;
      }
      throw error;
    }
    
    console.log('✅ SDP exchange complete');
    
    } catch (error) {
      // ✅ Always reset connecting flag on error
      this.isConnecting = false;
      clearTimeout(connectionTimeout);
      console.error('❌ WebRTC connection failed:', error);
      throw error;
    } finally {
      // ✅ Clear timeout on completion (success or failure)
      clearTimeout(connectionTimeout);
    }
  }

  async postOfferToOpenAI(offerSdp) {
    // Create ephemeral session first
    const { clientSecret } = await this.createEphemeralSession();
    
    console.log('🔑 Ephemeral session created');
    
    // POST SDP to OpenAI
    const base = 'https://api.openai.com/v1/realtime/calls';
    const FormData = require('form-data');
    const fd = new FormData();
    fd.append('sdp', offerSdp);
    
    const sessionConfig = {
      type: 'realtime',
      model: this.model,
      voice: 'alloy',
      turn_detection: { type: 'server_vad' }
    };
    fd.append('session', JSON.stringify(sessionConfig));

    console.log('📤 Posting session config:', JSON.stringify(sessionConfig));
    
    const res = await fetch(base, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clientSecret}`,
        ...fd.getHeaders()
      },
      body: fd
    });

    if (!res.ok) {
      const bodyText = await res.text();
      console.error('❌ OpenAI rejected session config:', bodyText);
      throw new Error(`Realtime calls failed ${res.status}: ${bodyText}`);
    }
    
    console.log('📥 OpenAI accepted session config');
    
    return await res.text();
  }

  closeSafely() {
    this.isClosing = true;
    this.isConnecting = false; // ✅ Reset connecting flag
    try { this.dataChannel?.close(); } catch {}
    try {
      this.peerConnection?.getSenders()?.forEach(s => { try { s.track?.stop(); } catch {} });
    } catch {}
    try { this.peerConnection?.close(); } catch {}
    this.dataChannel = null;
    this.peerConnection = null;
    this.isConnected = false;
  }

  sendAudio(base64Audio) {
    if (!this.audioSource || !this.audioTrack || this.isClosing) {
      return; // Silent fail - no need to log every frame
    }

    try {
      // 16-bit PCM mono @16kHz
      const buf = Buffer.from(base64Audio, 'base64');
      const in16 = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);

      // prepend any remainder from last call
      let samples;
      if (this._pcmRemainder.length) {
        samples = new Int16Array(this._pcmRemainder.length + in16.length);
        samples.set(this._pcmRemainder, 0);
        samples.set(in16, this._pcmRemainder.length);
        this._pcmRemainder = new Int16Array(0);
      } else {
        samples = in16;
      }

      const FRAME = 160; // 10ms @16kHz
      const fullFrames = Math.floor(samples.length / FRAME);

      for (let i = 0; i < fullFrames; i++) {
        // 1) Take a clean copy so the view is exactly 160 samples (320 bytes)
        const start = i * FRAME;
        const end = start + FRAME;
        const frameI16 = samples.slice(start, end); // copies 160 Int16s

        // 2) Convert to a Buffer whose byteLength is exactly 320
        const frameBuf = Buffer.from(frameI16.buffer, frameI16.byteOffset, frameI16.byteLength);

        // 3) Derive numberOfFrames from what we're actually sending
        const n = frameI16.length; // should be 160

        // Optional sanity guard (logs once if something goes off)
        if (frameBuf.byteLength !== n * 2) {
          console.warn(`⚠️ Frame size mismatch: bytes=${frameBuf.byteLength}, samples=${n}`);
          continue;
        }

        this.audioSource.onData({
          // Pass a Buffer; wrtc is strict about .byteLength
          samples: frameBuf,
          sampleRate: 16000,
          bitsPerSample: 16,
          channelCount: 1,
          numberOfFrames: n
        });
      }

      // store any tail for next call
      const used = fullFrames * FRAME;
      if (samples.length > used) {
        this._pcmRemainder = samples.subarray(used).slice();
      }
    } catch (error) {
      console.error('❌ Failed to send audio frame:', error);
    }
  }

  sendEvent(event) {
    if (this.dataChannel && this.dataChannel.readyState === 'open' && !this.isClosing) {
      this.dataChannel.send(JSON.stringify(event));
    } else {
      // Silent fail for events during closing
    }
  }

  close() {
    this.isClosing = true;
    this.isConnecting = false; // ✅ Reset connecting flag
    
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
        this.peerConnection.onconnectionstatechange = null; // ← detach
        this.peerConnection.close();
      } catch (error) {
        console.error('⚠️ Error closing peer connection:', error);
      }
      this.peerConnection = null;
    }
  }
}

module.exports = { OpenAIWebRTCClient };