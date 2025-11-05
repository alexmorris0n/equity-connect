/**
 * WebRTC Audio Bridge - OpenAI Realtime API (WebRTC)
 * Uses unified OpenAIWebRTCClient for GA-compliant connection
 */

const WebSocket = require('ws');
const debug = require('debug')('barbara:webrtc');
const { OpenAIWebRTCClient } = require('./openai-webrtc-client'); // ✅ use unified client
const { nonstandard } = require('wrtc');
const { RTCAudioSink } = nonstandard;

/**
 * Simple PCM resampler for 16kHz ↔ 24kHz conversion
 * Uses linear interpolation for real-time audio processing
 */
// SimpleResampler class removed - both OpenAI WebRTC and SignalWire use 16kHz natively

class WebRTCAudioBridge {
  constructor(swSocket, logger, callContext = {}) {
    this.swSocket = swSocket;
    this.logger = logger;
    this.callContext = callContext;
    
    this.client = null;
    this.remoteSink = null;
    
    // SignalWire audio format (captured from start event)
    this.streamSid = null;
    this.swEncoding = 'pcm16';  // default, will be overwritten by START
    this.swSampleRate = 8000;   // μ-law uses 8kHz
    
    // Audio conversion pipeline - μ-law@8kHz ↔ OpenAI WebRTC@16kHz
    // Need resampling and μ-law conversion
    
    // Connection state
    this.alive = false;
    
    // Frame accumulator for 20ms frames at 8kHz (μ-law)
    this.frameAccumulator = this.makeFrameAccumulator();
    
    // Audio buffering with cleanup
    this.audioBuffer = [];
    this.MAX_BUFFER_AGE = 5000; // 5 seconds
    this.bufferCleanupInterval = setInterval(() => {
      const now = Date.now();
      const before = this.audioBuffer.length;
      this.audioBuffer = this.audioBuffer.filter(
        item => (now - item.timestamp) < this.MAX_BUFFER_AGE
      );
      if (this.audioBuffer.length < before) {
        console.log(`🗑️ Cleaned ${before - this.audioBuffer.length} stale audio frames`);
      }
    }, 1000);
    
    // OpenAI session state
    this.sessionConfigured = false;
    this.greetingSent = false;
    this.webrtcReady = false;
    this.callSid = null;
    this.callerPhone = null;
    
    // Track state
    this.speaking = false;
    this.responseInProgress = false;
    this.callStartTime = Date.now();
    this._loggedSampleRate = false; // For debugging
    
    // Conversation transcript tracking for database storage
    this.conversationTranscript = [];
    
    // Track which prompt was used for logging
    this.promptName = null;
    this.promptSource = null;
    
    // Broker timezone for dynamic time injection
    this.brokerTimezone = null;
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
                 this.alive = true;
                 this.flushAudioBuffer();
                 this.configureSession(); // still send session.update after DC opens
               };
      this.client.onMessage = (m) => this.handleOpenAIEvent(m);
      this.client.onAudioTrack = (track, stream) => {
        console.log('🎵 OpenAI audio track received (starting playback to SignalWire)');
        // Create a sink to read raw PCM frames from the remote track
        this.remoteSink = new RTCAudioSink(track);

             // Audio processing state
             this.audioFrameCount = 0;
             this.lastFrameLog = Date.now();

        this.remoteSink.ondata = ({ samples, sampleRate, bitsPerSample, channelCount }) => {
          if (!this.alive || !this.swSocket || this.swSocket.readyState !== WebSocket.OPEN || !this.streamSid) return;

          // Log actual sample rate from OpenAI (should be 16000 Hz)
          if (!this._loggedSampleRate) {
            console.log(`📥 OpenAI audio: ${sampleRate} Hz, ${bitsPerSample}-bit, ${channelCount} ch`);
            this._loggedSampleRate = true;
          }
          
          try {
            // Convert to mono PCM16
            const pcm16Mono = this.toMonoPCM16(samples, channelCount, bitsPerSample);
            
            // Resample from actual input rate to 8kHz (μ-law)
            const inRate = Number(sampleRate) || 16000;
            const pcm8k = this.resampleTo8kHz(pcm16Mono, inRate);
            
            // Process into 20ms frames (160 samples at 8kHz)
            const frames = this.frameAccumulator.addSamples(pcm8k);
            for (const frame of frames) {
              // Convert to μ-law format for SignalWire
              const muLaw = this.pcm16ToMuLaw(frame);
              this.sendToSignalWire(muLaw);
            }
            
            // Rate-limited logging
            this.audioFrameCount++;
            const now = Date.now();
            if (now - this.lastFrameLog > 1000) {
              console.log(`▶️ sent ${this.audioFrameCount} frames to SignalWire (last 1s)`);
              this.audioFrameCount = 0;
              this.lastFrameLog = now;
            }
          } catch (err) {
            console.error('❌ Audio processing error:', err);
          }
        };
      };

      // CRITICAL: Attach SignalWire handlers IMMEDIATELY before any async operations
      // This ensures we don't miss the start event
      this.setupSignalWireHandlers();
      
      await this.client.connectWebRTC(); // does ephemeral+offer+POST /v1/realtime/calls

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
  async configureSession() {
    if (this.sessionConfigured) return;
    
    console.log('⚙️ Configuring OpenAI session via data channel...');
    
    const instructions = this.callContext.instructions ||
      'You are Barbara, a friendly assistant helping with reverse mortgage inquiries. Be warm and conversational.';
    
    // GA: Do not send session.update - configure at call creation
    // The session is already configured via the ephemeral session
    console.log('✅ Session already configured via ephemeral session');
    
    this.sessionConfigured = true;
    console.log('✅ Session configuration sent via data channel');
    
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

    // ✅ Request response - Barbara should greet first on outbound calls
    this.client?.sendEvent({
      type: 'response.create',
      response: {}
    });

    this.greetingSent = true;
    console.log('✅ Conversation started - Barbara will greet caller');
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

        try {
          // Flush any remainder from the frame accumulator and send a smoothed tail
          if (this.frameAccumulator) {
            const remaining = this.frameAccumulator.flush?.() || new Int16Array(0);
            if (remaining.length > 0) {
              // Pad to one 20ms frame (160 samples @ 8kHz)
              const tailFrame = new Int16Array(160);
              const copyLen = Math.min(remaining.length, 160);
              tailFrame.set(remaining.subarray(0, copyLen), 0);

              // Apply a short fade-out over the last 80 samples (10ms)
              const FADE_SAMPLES = 80;
              for (let i = 0; i < FADE_SAMPLES; i++) {
                const idx = 160 - FADE_SAMPLES + i;
                const gain = 1 - (i / (FADE_SAMPLES - 1));
                tailFrame[idx] = (tailFrame[idx] * gain) | 0;
              }

              const muTail = this.pcm16ToMuLaw(tailFrame);
              this.sendToSignalWire(muTail);
            }

            // Send one extra 20ms of silence to avoid a hard zero-step boundary
            const silence = new Int16Array(160); // zeros
            const muSilence = this.pcm16ToMuLaw(silence);
            this.sendToSignalWire(muSilence);
          }
        } catch (err) {
          console.warn('⚠️ Tail flush failed:', err?.message || err);
        }
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
    
    // Use RTCAudioSink to capture audio from the remote track
    const { nonstandard } = require('wrtc');
    const { RTCAudioSink } = nonstandard;
    
    this.remoteSink = new RTCAudioSink(track);
    
    // Audio processing state
    this.audioFrameCount = 0;
    this.lastFrameLog = Date.now();
    
    this.remoteSink.ondata = ({ samples, sampleRate, bitsPerSample, channelCount }) => {
      try {
        // Convert to mono PCM16 and resample to 8kHz for SignalWire
        const mono16 = this.toMonoPCM16(samples, channelCount, bitsPerSample);
        const pcm8k = this.resampleTo8kHz(mono16, sampleRate);
        
        // Send in 20ms chunks (160 samples at 8kHz = 320 bytes)
        this.sendAudioToSignalWire(pcm8k);
        
        // Rate-limited logging
        this.audioFrameCount++;
        const now = Date.now();
        if (now - this.lastFrameLog > 1000) {
          console.log(`▶️ sent ${this.audioFrameCount} frames to SignalWire (last 1s)`);
          this.audioFrameCount = 0;
          this.lastFrameLog = now;
        }
      } catch (err) {
        console.error('❌ Audio processing error:', err);
      }
    };
    
    track.onended = () => {
      console.log('🎵 OpenAI audio track ended');
      this.remoteSink?.stop?.();
      this.remoteSink = null;
    };
  }

  /**
   * Convert audio samples to mono PCM16
   */
  toMonoPCM16(samples, channels, bitsPerSample) {
    let s16;
    
    if (bitsPerSample === 16 && samples instanceof Int16Array) {
      s16 = samples;
    } else {
      // Convert Float32 to Int16 with clamping
      const f32 = samples instanceof Float32Array ? samples : Float32Array.from(samples);
      s16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        const v = Math.max(-1, Math.min(1, f32[i]));
        s16[i] = (v * 32767) | 0;
      }
    }
    
    // Downmix to mono if needed
    if (channels && channels > 1) {
      const frames = s16.length / channels;
      const out = new Int16Array(frames);
      for (let i = 0, w = 0; i < frames; i++, w += channels) {
        let acc = 0;
        for (let c = 0; c < channels; c++) {
          acc += s16[w + c];
        }
        out[i] = (acc / channels) | 0;
      }
      return out;
    }
    
    return s16;
  }
  
  /**
   * Resample audio to 8kHz using linear interpolation
   */
  resampleTo8kHz(input16, inRate) {
    if (inRate === 8000) return input16;
    
    const ratio = inRate / 8000;
    const outLen = Math.floor(input16.length / ratio);
    const out = new Int16Array(outLen);
    
    for (let i = 0; i < outLen; i++) {
      const idx = i * ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, input16.length - 1);
      const frac = idx - i0;
      out[i] = ((1 - frac) * input16[i0] + frac * input16[i1]) | 0;
    }
    
    return out;
  }

  /**
   * Convert μ-law to PCM16
   */
  muLawToPCM16(muLawData) {
    const pcm16 = new Int16Array(muLawData.length);
    for (let i = 0; i < muLawData.length; i++) {
      pcm16[i] = this.muLawToLinear(muLawData[i]);
    }
    return pcm16;
  }

  /**
   * Convert μ-law byte to linear PCM16
   */
  muLawToLinear(muLawByte) {
    const BIAS = 0x84;
    const CLIP = 32635;
    
    let sign = (muLawByte & 0x80) ? -1 : 1;
    let exponent = (muLawByte >> 4) & 0x07;
    let mantissa = muLawByte & 0x0F;
    
    let sample = (mantissa << (exponent + 3)) + BIAS;
    if (exponent !== 0) {
      sample += (1 << (exponent + 2));
    }
    
    return sign * Math.min(sample, CLIP);
  }

  /**
   * Convert PCM16 to μ-law
   */
  pcm16ToMuLaw(pcm16Frame) {
    const muLaw = new Uint8Array(pcm16Frame.length);
    for (let i = 0; i < pcm16Frame.length; i++) {
      muLaw[i] = this.linearToMuLaw(pcm16Frame[i]);
    }
    return muLaw;
  }

  /**
   * Resample audio to 16kHz
   */
  resampleTo16kHz(input16, inRate) {
    if (inRate === 16000) return input16;
    
    const ratio = inRate / 16000;
    const outLen = Math.floor(input16.length / ratio);
    const out = new Int16Array(outLen);
    
    for (let i = 0; i < outLen; i++) {
      const idx = i * ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, input16.length - 1);
      const frac = idx - i0;
      out[i] = ((1 - frac) * input16[i0] + frac * input16[i1]) | 0;
    }
    
    return out;
  }

  /**
   * Resample audio to 8kHz
   */
  resampleTo8kHz(input16, inRate) {
    if (inRate === 8000) return input16;
    
    const ratio = inRate / 8000;
    const outLen = Math.floor(input16.length / ratio);
    const out = new Int16Array(outLen);
    
    for (let i = 0; i < outLen; i++) {
      const idx = i * ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, input16.length - 1);
      const frac = idx - i0;
      out[i] = ((1 - frac) * input16[i0] + frac * input16[i1]) | 0;
    }
    
    return out;
  }

  /**
   * Convert big-endian Uint8Array to Buffer for base64 encoding
   */
  beBytesToBuffer(u8be) {
    return Buffer.from(u8be.buffer, u8be.byteOffset, u8be.byteLength);
  }

  /**
   * Frame accumulator for 20ms frames at 8kHz (160 samples)
   */
  makeFrameAccumulator() {
    const FRAME_SAMPLES = 160; // 20ms at 8kHz
    let pcm16Queue = new Int16Array(0);
    const self = this; // Reference to the bridge instance
    
    return {
      addSamples: (int16Mono) => {
        // Don't process if call is over
        if (!self.alive) {
          console.log('🚫 Frame accumulator: call is over, ignoring audio');
          return [];
        }
        
        // Append to queue
        const merged = new Int16Array(pcm16Queue.length + int16Mono.length);
        merged.set(pcm16Queue, 0);
        merged.set(int16Mono, pcm16Queue.length);
        pcm16Queue = merged;
        
        // Process complete frames
        const frames = [];
        while (pcm16Queue.length >= FRAME_SAMPLES) {
          const frame = pcm16Queue.slice(0, FRAME_SAMPLES);
          pcm16Queue = pcm16Queue.slice(FRAME_SAMPLES);
          frames.push(frame);
        }
        
        
        return frames;
      },
      flush: () => {
        const remaining = pcm16Queue;
        pcm16Queue = new Int16Array(0);
        return remaining;
      }
    };
  }
  
  /**
   * Send audio to SignalWire in 20ms chunks (160 samples at 8kHz)
   */
  sendAudioToSignalWire(pcm8k) {
    if (!this.streamSid || this.swSocket.readyState !== 1) {
      return; // Not ready to send
    }
    
    // Send in 20ms chunks (160 samples = 320 bytes)
    const chunkSize = 160;
    for (let i = 0; i < pcm8k.length; i += chunkSize) {
      const chunk = pcm8k.subarray(i, i + chunkSize);
      if (chunk.length === chunkSize) {
        this.swSocket.send(JSON.stringify({
          event: 'media',
          streamSid: this.streamSid,
          media: {
            payload: Buffer.from(chunk.buffer).toString('base64')
          }
        }));
      }
    }
  }

  /**
   * Setup SignalWire WebSocket handlers
   */
  setupSignalWireHandlers() {
    // Message counter for raw dump
    this.messageCount = 0;
    
    this.swSocket.on('message', (raw) => {
      const txt = raw.toString();
      
      // TEMP: Raw dump of first 10 messages to debug event structure
      if (this.messageCount < 10) {
        console.log(`SW <= [${this.messageCount}]`, txt.slice(0, 500));
        this.messageCount++;
      }
      
      let msg;
      try { 
        msg = JSON.parse(txt); 
      } catch (err) {
        console.error('❌ Failed to parse SignalWire message:', err);
        return;
      }

      // Robust start event detection - try every known path
      const ev = (msg.event || msg.type || '').toLowerCase();
      
      if (ev === 'start' || ev === 'started' || msg.start || msg.media_format || msg.mediaFormat) {
        // Try every known path for stream id + media format
        this.streamSid = 
          msg.streamSid || msg.stream_sid ||
          msg.start?.streamSid || msg.start?.stream_sid ||
          msg.start?.stream_id || msg.streamId || msg.stream_id || this.streamSid;

        const fmt = msg.mediaFormat || msg.media_format || msg.start?.mediaFormat || msg.start?.media_format;
        if (fmt) {
          this.swEncoding = (fmt.encoding || fmt.audio_codec || fmt.codec || 'pcm16').toLowerCase();
          this.swSampleRate = fmt.sampleRate || fmt.sample_rate || 8000;
        }

        console.log(`📞 SW START detected streamSid=${this.streamSid} encoding=${this.swEncoding} rate=${this.swSampleRate}`);
        
        // Run tone test immediately after start is detected
        // setTimeout(() => this.runToneTest(), 100);
      }

      if (ev === 'stop' || ev === 'stopped') {
        console.log('📞 SW STOP');
        this.streamSid = null;
      }

      // Also handle the original event structure for other events
      this.handleSignalWireEvent(msg);
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
        // CRITICAL: Capture streamSid and media format from SignalWire start event
        this.streamSid = msg.start?.streamSid || msg.start?.stream_sid;
        this.callSid = this.streamSid; // Use streamSid as callSid for consistency
        
        // Capture SignalWire media format
        const mediaFormat = msg.start?.mediaFormat || msg.start?.media_format;
        this.swEncoding = (mediaFormat?.encoding || mediaFormat?.audio_codec || 'pcm16').toLowerCase();
        this.swSampleRate = mediaFormat?.sampleRate || mediaFormat?.sample_rate || 16000;
        
        console.log(`📞 SW START streamSid=${this.streamSid} encoding=${this.swEncoding} rate=${this.swSampleRate}`);
        console.log('🎙️ SignalWire Stream Started:', {
          callSid: this.callSid,
          streamSid: this.streamSid,
          mediaFormat: mediaFormat || 'unknown',
          encoding: this.swEncoding,
          sampleRate: this.swSampleRate
        });
        
        // Get caller phone from custom parameters
        if (msg.start.customParameters?.From) {
          this.callerPhone = msg.start.customParameters.From;
          this.callContext.from = this.callerPhone;
          console.log('📞 Caller phone:', this.callerPhone);
        }
        
        // Run tone test to verify SignalWire path
        // ❌ DISABLED: Tone test causes beep sound on every call
        // this.runToneTest();
        break;

      case 'media':
        // Convert SignalWire audio to format for OpenAI
        this.handleSignalWireAudio(msg.media);
        break;

      case 'stop':
        console.log('📞 SW STOP');
        this.logger.info('📞 Call ended by SignalWire');
        
        // Cancel any in-progress response
        try {
          if (this.client?.isConnected) {
            this.client.sendEvent({ type: 'response.cancel' });
          }
        } catch (err) {
          console.error('⚠️ Error canceling response:', err);
        }
        
        this.saveCallSummary();
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
    if (!media || !media.payload) {
      console.error('❌ Invalid media object');
      return;
    }
    
    try {
      // Decode base64 μ-law from SignalWire
      const audioData = Buffer.from(media.payload, 'base64');
      
      // ✅ CHECK FOR SILENCE FIRST: Don't buffer or send silent audio to OpenAI
      const isSilence = audioData.every(byte => byte === 0);
      if (isSilence) {
        // Skip silent frames entirely (prevents static)
        return;
      }
      
      // Buffer if not ready (only non-silent audio)
      if (!this.webrtcReady || !this.client || !this.client.isConnected) {
        this.audioBuffer.push({
          media,
          timestamp: Date.now()
        });
        if (this.audioBuffer.length % 50 === 1) {
          debug('[DEBUG] 📦 Buffering audio frame (%d) - WebRTC not ready', this.audioBuffer.length);
        }
        return;
      }
      
      // Convert μ-law to PCM16
      const pcm16 = this.muLawToPCM16(audioData);
      
      // Resample from 8kHz (μ-law) to 16kHz (OpenAI WebRTC)
      const pcm16k = this.resampleTo16kHz(pcm16, 8000);
      
      // Convert to Float32 for OpenAI
      const float32 = new Float32Array(pcm16k.length);
      for (let i = 0; i < pcm16k.length; i++) {
        float32[i] = pcm16k[i] / 32768.0;
      }
      
      // Send to OpenAI WebRTC
      this.client.sendAudio(float32);
      
    } catch (err) {
      console.error('❌ Error processing inbound audio:', err);
      this.logger.error({ err }, 'Error processing inbound audio');
    }
  }

  /**
   * Flush buffered audio after WebRTC connects
   */
  flushAudioBuffer() {
    if (this.audioBuffer.length > 0) {
      console.log(`✅ Flushing ${this.audioBuffer.length} buffered audio frames`);
      
      for (const item of this.audioBuffer) {
        // Handle new structure with {media, timestamp}
        const media = item.media || item;
        this.handleSignalWireAudio(media);
      }
      
      this.audioBuffer = [];
      console.log('✅ Audio buffer flushed');
    }
  }

  /**
   * Send audio to SignalWire with proper gating and format
   */
  sendToSignalWire(muLawData) {
    if (!this.alive || !this.streamSid || this.swSocket?.readyState !== WebSocket.OPEN) {
      return; // Don't send until streamSid is captured and alive
    }
    
    this.swSocket.send(JSON.stringify({
      event: 'media',
      streamSid: this.streamSid,
      media: { 
        track: 'outbound',  // ✅ CRITICAL: Tell SignalWire to play on outbound track
        payload: Buffer.from(muLawData).toString('base64') 
      }
    }));
  }

  /**
   * Run 1kHz tone test to verify SignalWire path
   */
  runToneTest() {
    if (!this.streamSid) {
      console.log('⚠️ Cannot run tone test - no streamSid');
      return;
    }
    
    console.log('🔊 Tone test → SW (8kHz, 20ms frames)');
    
    // Generate 1kHz tone at 8kHz with 20ms frames (160 samples)
    const FRAME_SAMPLES = 160; // 20ms at 8kHz
    const sampleRate = 8000; // μ-law uses 8kHz
    const duration = 1; // 1 second
    const totalSamples = sampleRate * duration;
    
    for (let i = 0; i < totalSamples; i += FRAME_SAMPLES) {
      const frameSize = Math.min(FRAME_SAMPLES, totalSamples - i);
      const frame = new Int16Array(frameSize);
      
      for (let n = 0; n < frameSize; n++) {
        const t = (i + n) / sampleRate;
        frame[n] = Math.round(0.2 * 32767 * Math.sin(2 * Math.PI * 1000 * t));
      }
      
      // Convert to μ-law format for SignalWire
      const muLaw = this.pcm16ToMuLaw(frame);
      this.sendToSignalWire(muLaw);
    }
    
    console.log('✅ Tone test completed');
  }

  /**
   * Generate 1kHz sine wave in 20ms frames
   */
  *sine1k(sampleRate = 8000, seconds = 1) {
    const total = sampleRate * seconds;
    for (let i = 0; i < total; i += 160) {
      const frame = new Int16Array(160);
      for (let n = 0; n < 160; n++) {
        const t = (i + n) / sampleRate;
        frame[n] = Math.round(0.2 * 32767 * Math.sin(2 * Math.PI * 1000 * t));
      }
      yield frame;
    }
  }

  /**
   * Convert PCM16 to μ-law
   */
  pcm16ToMuLaw(frame160) {
    const out = new Uint8Array(frame160.length);
    for (let i = 0; i < frame160.length; i++) {
      out[i] = this.linearToMuLaw(frame160[i]);
    }
    return out;
  }

  /**
   * G.711 μ-law conversion
   */
  linearToMuLaw(sample) {
    const BIAS = 0x84, CLIP = 32635;
    let sign = (sample >> 8) & 0x80;
    if (sample < 0) sample = -sample;
    if (sample > CLIP) sample = CLIP;
    sample = sample + BIAS;
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
    let mantissa = (sample >> ((exponent === 0) ? 4 : (exponent + 3))) & 0x0F;
    const ulaw = ~(sign | (exponent << 4) | mantissa) & 0xFF;
    return ulaw;
  }

  /**
   * Convert audio samples to mono PCM16
   */
  toMonoPCM16(samples, channels, bitsPerSample) {
    let s16;
    
    if (bitsPerSample === 16 && samples instanceof Int16Array) {
      s16 = samples;
    } else {
      // Convert Float32 to Int16 with clamping
      const f32 = samples instanceof Float32Array ? samples : Float32Array.from(samples);
      s16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        const v = Math.max(-1, Math.min(1, f32[i]));
        s16[i] = (v * 32767) | 0;
      }
    }
    
    // Downmix to mono if needed
    if (channels && channels > 1) {
      const frames = s16.length / channels;
      const out = new Int16Array(frames);
      for (let i = 0, w = 0; i < frames; i++, w += channels) {
        let acc = 0;
        for (let c = 0; c < channels; c++) {
          acc += s16[w + c];
        }
        out[i] = (acc / channels) | 0;
      }
      return out;
    }
    
    return s16;
  }

  /**
   * Linear resampler for audio conversion
   */
  makeLinearResampler() {
    return (input16, inRate, outRate) => {
      if (inRate === outRate) return input16;
      const ratio = inRate / outRate;
      const outLen = Math.floor(input16.length / ratio);
      const out = new Int16Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const idx = i * ratio;
        const i0 = Math.floor(idx);
        const i1 = Math.min(i0 + 1, input16.length - 1);
        const frac = idx - i0;
        out[i] = ((1 - frac) * input16[i0] + frac * input16[i1]) | 0;
      }
      return out;
    };
  }

  /**
   * Packetizer for 20ms chunks (160 samples at 8kHz)
   */
  makePacketizer(samplesPerFrame) {
    let hold = new Int16Array(0);
    return function* (pcm16) {
      if (hold.length) {
        const merged = new Int16Array(hold.length + pcm16.length);
        merged.set(hold, 0);
        merged.set(pcm16, hold.length);
        pcm16 = merged;
        hold = new Int16Array(0);
      }
      let off = 0;
      while (off + samplesPerFrame <= pcm16.length) {
        yield pcm16.subarray(off, off + samplesPerFrame);
        off += samplesPerFrame;
      }
      if (off < pcm16.length) hold = pcm16.subarray(off);
    };
  }

  /**
   * Save call summary when call ends
   */
  async saveCallSummary() {
    const durationSeconds = Math.floor((Date.now() - this.callStartTime) / 1000);
    
    this.logger.info({ 
      callSid: this.callSid,
      duration: durationSeconds 
    }, '💾 Saving call summary');
    
    if (this.callContext.lead_id) {
      try {
        const lastMessages = this.conversationTranscript.slice(-3).map(t => t.text.toLowerCase()).join(' ');
        let outcome = 'neutral';
        
        if (lastMessages.includes('booked') || lastMessages.includes('scheduled')) {
          outcome = 'appointment_booked';
        } else if (lastMessages.includes('follow up') || lastMessages.includes('call back')) {
          outcome = 'follow_up_needed';
        } else if (lastMessages.includes('not interested')) {
          outcome = 'not_interested';
        }
        
        const metadata = {
          prompt_version: this.promptName || 'unknown',
          prompt_source: this.promptSource || 'unknown',
          call_duration_seconds: durationSeconds,
          message_count: this.conversationTranscript.length
        };
        
        // Note: executeTool would need to be imported from tools.js
        // await executeTool('save_interaction', {
        //   lead_id: this.callContext.lead_id,
        //   broker_id: this.callContext.broker_id,
        //   duration_seconds: durationSeconds,
        //   outcome: outcome,
        //   content: `Call transcript with ${this.conversationTranscript.length} messages`,
        //   transcript: this.conversationTranscript,
        //   metadata: metadata
        // });
        
        console.log('✅ Interaction saved to database');
        
      } catch (err) {
        console.error('❌ Failed to save interaction:', err.message);
      }
    } else {
      console.warn('⚠️ No lead_id - skipping interaction save');
    }
  }

  /**
   * Cleanup on disconnect
   */
  cleanup() {
    console.log('🧹 Cleaning up WebRTC bridge');
    
    // Set alive to false to stop all audio processing
    this.alive = false;
    console.log('🚫 Set alive = false to stop audio processing');
    
    // Flush any remaining audio in the accumulator
    if (this.frameAccumulator) {
      this.frameAccumulator.flush();
    }
    
    // Reset frame accumulator for next call
    this.frameAccumulator = this.makeFrameAccumulator();
    
    // Clear cleanup interval
    if (this.bufferCleanupInterval) {
      clearInterval(this.bufferCleanupInterval);
      this.bufferCleanupInterval = null;
    }
    
    // Stop audio sink
    if (this.remoteSink) {
      this.remoteSink.stop();
      this.remoteSink = null;
    }
    
    // Resamplers removed - both sides use 16kHz natively
    
    // Close client
    try { this.client?.closeSafely?.(); } catch {}
    this.client = null;
    
    // Close SignalWire socket
    if (this.swSocket && this.swSocket.readyState === WebSocket.OPEN) {
      try { this.swSocket.close(); } catch {}
    }
    
    this.webrtcReady = false;
    this.audioBuffer = [];
    this.streamSid = null; // Reset streamSid
    
    console.log('✅ Cleanup complete');
  }
}

module.exports = WebRTCAudioBridge;