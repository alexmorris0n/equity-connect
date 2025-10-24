const fetch = require('node-fetch');
const { RTCPeerConnection, RTCSessionDescription, nonstandard } = require('wrtc');
const { RTCAudioSource } = nonstandard;

// Patch D: Wait for ICE gathering to complete (or end-of-candidates)
function waitForIceGatheringComplete(pc, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!pc) {
      console.error('❌ Peer connection is null during ICE gathering');
      return resolve('null');
    }
    
    if (pc.iceGatheringState === 'complete') return resolve('complete');

    let done = false;
    const finish = (label) => {
      if (done) return;
      done = true;
      if (pc) {
        pc.removeEventListener('icegatheringstatechange', onState);
        pc.removeEventListener('icecandidate', onCand);
      }
      resolve(label || (pc ? pc.iceGatheringState : 'null'));
    };
    const onState = () => {
      if (!pc) {
        console.error('❌ Peer connection became null during ICE gathering');
        return finish('null');
      }
      if (pc.iceGatheringState === 'complete') finish('complete');
    };
    const onCand = (e) => { 
      if (!pc) {
        console.error('❌ Peer connection became null during ICE candidate');
        return finish('null');
      }
      if (!e.candidate) finish('end-of-candidates'); 
    };

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

  async connectWebRTC({ signal } = {}) {
    console.log('🔌 Establishing WebRTC connection (unified interface)...');
    
    // ----- lifecycle guards -----
    if (signal?.aborted) throw new Error('aborted');
    signal?.addEventListener('abort', () => { try { this.closeSafely?.(); } catch {} });

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
    this.dataChannel.onclose = () => console.log('📡 Data channel closed');
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

    this.dataChannel.onerror = (error) => {
      console.error('❌ Data channel error:', error);
      console.log('📡 Data channel ready state:', this.dataChannel.readyState);
    };

    // Log data channel state immediately after creation
    console.log('📡 Data channel created, ready state:', this.dataChannel.readyState);

    // ----- Ensure audio m-line exists -----
    this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
    
    // Create audio source and track for sending audio to OpenAI
    this.audioSource = new RTCAudioSource();
    this.audioTrack = this.audioSource.createTrack();
    
    // Add the audio track to the peer connection (sendrecv for bidirectional)
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

    // ----- Complete ICE (non-trickle) with small timeout -----
    if (this.peerConnection.iceGatheringState !== 'complete') {
      await new Promise((resolve) => {
        const to = setTimeout(resolve, 2500);
        const onchg = () => {
          if (this.peerConnection?.iceGatheringState === 'complete') {
            this.peerConnection.removeEventListener('icegatheringstatechange', onchg);
            clearTimeout(to);
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
    await this.peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
  }

  async postOfferToOpenAI(offerSdp) {
    // Create ephemeral session first
    const sessionResponse = await this.createEphemeralSession();
    const clientSecret = sessionResponse.client_secret.value;
    
    console.log('🔑 Ephemeral session created');
    
    // POST SDP to OpenAI
    const base = 'https://api.openai.com/v1/realtime/calls';
    const FormData = require('form-data');
    const fd = new FormData();
    fd.append('sdp', offerSdp);
    
    const sessionConfig = {
      type: 'realtime',
      model: this.model,
      audio: { output: { voice: 'marin' } }
    };
    fd.append('session', JSON.stringify(sessionConfig));

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
      throw new Error(`Realtime calls failed ${res.status}: ${bodyText}`);
    }
    
    return await res.text();
  }

  closeSafely() {
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
    if (!this.audioSource || !this.audioTrack) {
      console.log('⚠️ Audio source not ready');
      return;
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
    
    console.log('🔍 Connection state after ICE gathering:', this.peerConnection.connectionState);
    console.log('🔍 ICE connection state after gathering:', this.peerConnection.iceConnectionState);

    // CRITICAL: Guard against null localDescription
    if (!this.peerConnection || !this.peerConnection.localDescription) {
      throw new Error('Peer connection not ready: localDescription is null');
    }
    
    console.log('🔍 Peer connection state before SDP access:', this.peerConnection.connectionState);
    console.log('🔍 ICE connection state:', this.peerConnection.iceConnectionState);
    console.log('🔍 ICE gathering state:', this.peerConnection.iceGatheringState);
    
    const sdpToPost = this.peerConnection.localDescription.sdp;
    if (!sdpToPost || !/m=audio/.test(sdpToPost)) {
      throw new Error('Local SDP missing or has no audio m-line');
    }

    // Preflight validation to prevent mystery 400s
    if (!/m=audio /.test(sdpToPost)) throw new Error('Local SDP missing audio m= line');
    if (/a=ice-options:/.test(sdpToPost)) console.warn('⚠️ ice-options line still present');
    if (!/a=rtpmap:111 opus\/48000\/2/.test(sdpToPost)) console.warn('⚠️ opus rtpmap missing');
    if (!/a=fmtp:111/.test(sdpToPost)) console.warn('⚠️ opus fmtp missing');
    
    // 1. Insert end-of-candidates INSIDE the audio section (not at the end)
    sdpToPost = insertEndOfCandidatesInAudio(sdpToPost);
    
    // 2. Normalize CRLF and guarantee double-CRLF termination
    sdpToPost = sdpToPost.replace(/\r?\n/g, '\r\n');
    if (!sdpToPost.endsWith('\r\n\r\n')) {
      if (!sdpToPost.endsWith('\r\n')) sdpToPost += '\r\n';
      sdpToPost += '\r\n';
    }
    
    // 3. CRITICAL: Guarantee the datachannel m=application section exists
    if (!/m=application.*webrtc-datachannel/.test(sdpToPost)) {
      console.log('⚠️ No datachannel in SDP — injecting manually');
      const injectBlock = `
m=application 9 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 0.0.0.0
a=setup:actpass
a=mid:data
a=sctp-port:5000
a=max-message-size:262144
`;
      sdpToPost += injectBlock;
    }
    
    // 4. Add CBR=0 for mid-call bitrate adaptation (some stacks like it)
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

    // 5. CRITICAL: Validate and inject data channel section if missing
    console.log('🔍 Validating SDP for data channel section...');
    const hasDataChannel = /m=application.*webrtc-datachannel/.test(sdpToPost);
    console.log('🔍 Data channel section present:', hasDataChannel);
    
    if (!hasDataChannel) {
      console.log('⚠️ No datachannel in SDP — injecting manually.');
      
      // Extract ICE credentials from existing SDP
      const iceUfrag = sdpToPost.match(/a=ice-ufrag:([^\r\n]+)/)?.[1] || 'uFrag';
      const icePwd = sdpToPost.match(/a=ice-pwd:([^\r\n]+)/)?.[1] || 'pw';
      const fingerprint = sdpToPost.match(/a=fingerprint:sha-256 ([^\r\n]+)/)?.[1] || 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';
      
      console.log('🔍 Extracted ICE credentials - ufrag:', iceUfrag, 'pwd:', icePwd ? 'present' : 'missing');
      
      // Inject data channel section
      const dataChannelSection = `
m=application 9 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 0.0.0.0
a=ice-ufrag:${iceUfrag}
a=ice-pwd:${icePwd}
a=fingerprint:sha-256 ${fingerprint}
a=setup:actpass
a=mid:1
a=sctp-port:5000
a=max-message-size:262144`;
      
      sdpToPost += dataChannelSection;
      console.log('✅ Data channel section injected');
    } else {
      console.log('✅ Data channel section already present');
    }

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
    const sdpExchangeStartTime = Date.now();
    const answerSdp = await postSdpOnce();
    const sdpExchangeTime = Date.now() - sdpExchangeStartTime;
    console.log('✅ SDP exchange successful with unified interface in', sdpExchangeTime, 'ms');

    // 4) Set remote description
    console.log('✅ Received SDP answer from OpenAI, length:', answerSdp.length);
    console.log('🔍 Answer SDP preview:', answerSdp.substring(0, 100) + '...');
    
    const remoteDescStartTime = Date.now();
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp
      })
    );
    const remoteDescTime = Date.now() - remoteDescStartTime;
    console.log('✅ Remote description set in', remoteDescTime, 'ms');

    // Data channel is already created before the offer

    console.log('✅ WebRTC connection established - waiting for connection state...');
    console.log('🔍 Current connection state:', this.peerConnection.connectionState);
    console.log('🔍 Current ICE connection state:', this.peerConnection.iceConnectionState);
    console.log('🔍 Current ICE gathering state:', this.peerConnection.iceGatheringState);
    console.log('🔍 Data channel ready state:', this.dataChannel.readyState);
  }

  sendAudio(base64Audio) {
    if (!this.audioSource || !this.audioTrack) {
      console.log('⚠️ Audio source not ready');
      return;
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
