/**
 * SignalWire Webhook Route
 * Returns cXML to stream call audio to WebSocket
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WEBHOOK_MESSAGES, AUDIO_FORMAT, SIGNALWIRE_CODECS } from '../constants.js';
import { AGENT_CONFIG } from '../config.js';

export async function webhookRoute(fastify: FastifyInstance) {
  // Inbound calls (caller dials Barbara's SignalWire number)
  fastify.all('/incoming-call', async (request: FastifyRequest, reply: FastifyReply) => {
    const params: any = request.query || request.body || {};
    const { From, To, CallSid } = params;
    
    // Construct WebSocket URL with context
    const host = request.headers.host || 'localhost';
    const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
    const websocketUrl = `${protocol}://${host}/media-stream?direction=inbound&from=${From || ''}&to=${To || ''}&callsid=${CallSid || ''}`;

    // Get codec attribute based on configured audio format
    const codec = AGENT_CONFIG.audioFormat === AUDIO_FORMAT.PCM16
      ? SIGNALWIRE_CODECS.PCM16
      : SIGNALWIRE_CODECS.G711_ULAW;
    const codecAttribute = codec ? ` codec="${codec}"` : '';

    console.log(`📞 INBOUND call from ${From} - Audio: ${AGENT_CONFIG.audioFormat}, Codec: ${codec || 'default'}`);

    // Generate cXML response (no <Say> - Barbara will answer naturally)
    const cXMLResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="${websocketUrl}"${codecAttribute} />
      </Connect>
    </Response>`;

    reply.type('text/xml').send(cXMLResponse);
  });
  
  // Outbound calls (Barbara calls a lead)
  fastify.all('/outbound-call', async (request: FastifyRequest, reply: FastifyReply) => {
    const params: any = request.query || request.body || {};
    const { From, To, CallSid, call_id, lead_id, broker_id } = params;
    
    // Construct WebSocket URL with context
    const host = request.headers.host || 'localhost';
    const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
    const websocketUrl = `${protocol}://${host}/media-stream?direction=outbound&from=${From || ''}&to=${To || ''}&callsid=${CallSid || call_id || ''}&lead_id=${lead_id || ''}&broker_id=${broker_id || ''}`;

    // Get codec attribute
    const codec = AGENT_CONFIG.audioFormat === AUDIO_FORMAT.PCM16
      ? SIGNALWIRE_CODECS.PCM16
      : SIGNALWIRE_CODECS.G711_ULAW;
    const codecAttribute = codec ? ` codec="${codec}"` : '';

    console.log(`📞 OUTBOUND call to ${To} - Audio: ${AGENT_CONFIG.audioFormat}, Codec: ${codec || 'default'}`);

    // Generate cXML response (no <Say> - wait for caller to answer)
    const cXMLResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="${websocketUrl}"${codecAttribute} />
      </Connect>
    </Response>`;

    reply.type('text/xml').send(cXMLResponse);
  });
}

