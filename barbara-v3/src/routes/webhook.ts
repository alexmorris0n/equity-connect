/**
 * SignalWire Webhook Route
 * Returns cXML to stream call audio to WebSocket
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WEBHOOK_MESSAGES, AUDIO_FORMAT, SIGNALWIRE_CODECS } from '../constants.js';
import { AGENT_CONFIG } from '../config.js';

export async function webhookRoute(fastify: FastifyInstance) {
  fastify.all('/incoming-call', async (request: FastifyRequest, reply: FastifyReply) => {
    // Construct WebSocket URL from request headers
    const host = request.headers.host || 'localhost';
    const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
    const websocketUrl = `${protocol}://${host}/media-stream`;

    // Get codec attribute based on configured audio format
    const codec = AGENT_CONFIG.audioFormat === AUDIO_FORMAT.PCM16
      ? SIGNALWIRE_CODECS.PCM16
      : SIGNALWIRE_CODECS.G711_ULAW;
    const codecAttribute = codec ? ` codec="${codec}"` : '';

    console.log(`📞 Incoming call - Audio: ${AGENT_CONFIG.audioFormat}, Codec: ${codec || 'default'}`);

    // Generate cXML response
    const cXMLResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>${WEBHOOK_MESSAGES.CONNECTING}</Say>
      <Connect>
        <Stream url="${websocketUrl}"${codecAttribute} />
      </Connect>
    </Response>`;

    reply.type('text/xml').send(cXMLResponse);
  });
}

