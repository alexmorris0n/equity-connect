/**
 * SPIKE: Minimal OpenAI Realtime + SignalWire WebSocket Bridge
 * 
 * Purpose: Prove audio relay works before building full production version
 * 
 * What this does:
 * 1. Serves LaML XML for SignalWire to connect
 * 2. Accepts WebSocket from SignalWire (<Stream>)
 * 3. Opens WebSocket to OpenAI Realtime API
 * 4. Relays audio bidirectionally (PCM16 @ 16kHz)
 * 
 * What this DOESN'T do (yet):
 * - Supabase tools
 * - Outbound calls
 * - Error handling
 * - Production logging
 */

require('dotenv').config();
const Fastify = require('fastify');
const fastifyWebsocket = require('@fastify/websocket');
const WebSocket = require('ws');

const app = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  }
});

// Register WebSocket support
app.register(fastifyWebsocket);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 8080;
const BRIDGE_URL = process.env.BRIDGE_URL || `http://localhost:${PORT}`;

if (!OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY in .env file');
  process.exit(1);
}

// Health check
app.get('/healthz', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// LaML XML for inbound calls
app.get('/public/inbound-xml', async (request, reply) => {
  const wsUrl = BRIDGE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}/audiostream" codec="L16@24000h" />
  </Connect>
</Response>`;
  
  reply.type('text/xml').send(xml);
  app.log.info('📞 Served inbound LaML XML');
});

// WebSocket audio bridge: SignalWire ↔ OpenAI Realtime
app.register(async function (fastify) {
  fastify.get('/audiostream', { websocket: true }, (connection, req) => {
    const swSocket = connection.socket;
    
    app.log.info('🔌 SignalWire WebSocket connected');
    
    // Connect to OpenAI Realtime API
const openaiWS = new WebSocket(
  'wss://api.openai.com/v1/realtime?model=gpt-realtime-2025-08-28',
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );
    
    let sessionConfigured = false;
    
    // OpenAI WebSocket opened
    openaiWS.on('open', () => {
      app.log.info('🤖 OpenAI Realtime connected');
      
      // Configure session with voice output
      openaiWS.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'],
          voice: 'alloy',
          instructions: 'You are Barbara, a friendly assistant helping homeowners with reverse mortgage inquiries. Speak warmly and conversationally.',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        }
      }));
      
      sessionConfigured = true;
      app.log.info('✅ OpenAI session configured');
    });
    
    // OpenAI messages (audio out → SignalWire)
    openaiWS.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString());
        
        // Log important events (not every audio chunk)
        if (event.type !== 'response.audio.delta' && event.type !== 'input_audio_buffer.speech_started') {
          app.log.info({ type: event.type }, '🤖 OpenAI event');
        }
        
        // Send audio back to SignalWire
        if (event.type === 'response.audio.delta' && event.delta) {
          swSocket.send(JSON.stringify({
            event: 'media',
            streamSid: req.headers['x-twilio-call-sid'] || 'unknown',
            media: {
              payload: event.delta
            }
          }));
        }
        
        // Log when AI starts/stops speaking
        if (event.type === 'response.audio.done') {
          app.log.info('🔊 AI finished speaking');
        }
        
      } catch (err) {
        app.log.error({ err }, '❌ Error processing OpenAI message');
      }
    });
    
    // SignalWire messages (audio in → OpenAI)
    swSocket.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());
        
        if (msg.event === 'start') {
          app.log.info({ callSid: msg.start.callSid }, '📞 Call started');
          
          // Start conversation
          if (sessionConfigured) {
            openaiWS.send(JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['audio', 'text'],
                instructions: 'Greet the caller warmly and ask how their day is going.'
              }
            }));
          }
        }
        
        if (msg.event === 'media' && msg.media?.payload) {
          // Send audio to OpenAI
          if (openaiWS.readyState === WebSocket.OPEN) {
            openaiWS.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: msg.media.payload
            }));
          }
        }
        
        if (msg.event === 'stop') {
          app.log.info('📞 Call ended by SignalWire');
          cleanup();
        }
        
      } catch (err) {
        app.log.error({ err }, '❌ Error processing SignalWire message');
      }
    });
    
    // Cleanup function
    const cleanup = () => {
      app.log.info('🧹 Cleaning up WebSocket connections');
      try {
        if (openaiWS.readyState === WebSocket.OPEN) {
          openaiWS.close();
        }
      } catch (err) {
        app.log.error({ err }, 'Error closing OpenAI WS');
      }
      
      try {
        if (swSocket.readyState === WebSocket.OPEN) {
          swSocket.close();
        }
      } catch (err) {
        app.log.error({ err }, 'Error closing SignalWire WS');
      }
    };
    
    // Handle disconnections
    swSocket.on('close', () => {
      app.log.info('📞 SignalWire disconnected');
      cleanup();
    });
    
    openaiWS.on('close', () => {
      app.log.info('🤖 OpenAI disconnected');
      cleanup();
    });
    
    openaiWS.on('error', (err) => {
      app.log.error({ err }, '❌ OpenAI WebSocket error');
      cleanup();
    });
    
    swSocket.on('error', (err) => {
      app.log.error({ err }, '❌ SignalWire WebSocket error');
      cleanup();
    });
  });
});

// Start server
app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  
  console.log('\n🚀 OpenAI Realtime Bridge (SPIKE) running!\n');
  console.log(`   Health check: http://localhost:${PORT}/healthz`);
  console.log(`   Inbound XML:  http://localhost:${PORT}/public/inbound-xml`);
  console.log(`   WebSocket:    ws://localhost:${PORT}/audiostream\n`);
  console.log('📋 Next steps:');
  console.log('   1. Expose with ngrok: ngrok http 8080');
  console.log('   2. Update SignalWire number Voice URL to: https://YOUR_NGROK_URL/public/inbound-xml');
  console.log('   3. Call your SignalWire number to test!\n');
});

