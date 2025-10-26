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
    // Extract caller information from SignalWire webhook
    const queryParams = request.query || {};
    const bodyParams = request.body || {};
    const params: any = { ...queryParams, ...bodyParams };
    const { From, To, CallSid } = params;
    
    console.log(`📞 Incoming call from ${From} to ${To} (CallSid: ${CallSid})`);
    
    // Construct WebSocket URL from request headers (no query params - SignalWire rejects them)
    const host = request.headers.host || 'localhost';
    const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
    const websocketUrl = `${protocol}://${host}/media-stream`;

    // Get codec attribute based on configured audio format
    const codec = AGENT_CONFIG.audioFormat === AUDIO_FORMAT.PCM16
      ? SIGNALWIRE_CODECS.PCM16
      : SIGNALWIRE_CODECS.G711_ULAW;
    const codecAttribute = codec ? ` codec="${codec}"` : '';

    console.log(`📞 Incoming call - Audio: ${AGENT_CONFIG.audioFormat}, Codec: ${codec || 'default'}`);

    // Generate cXML response with caller ID in customParameters
    // The 4-second pause allows time for caller ID capture and natural ringback
    const cXMLResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Pause length="4"/>
      <Connect>
        <Stream url="${websocketUrl}"${codecAttribute}>
          <Parameter name="From" value="${From || ''}" />
          <Parameter name="To" value="${To || ''}" />
          <Parameter name="CallSid" value="${CallSid || ''}" />
        </Stream>
      </Connect>
    </Response>`;

    reply.type('text/xml').send(cXMLResponse);
  });
  
  // Outbound calls (Barbara calls a lead)
  fastify.all('/outbound-call', async (request: FastifyRequest, reply: FastifyReply) => {
    // SignalWire sends data in query params for GET, body for POST
    const queryParams: any = request.query || {};
    const bodyParams: any = request.body || {};
    const params = { ...queryParams, ...bodyParams };
    
    const { From, To, CallSid, call_id, lead_id, broker_id } = params;
    
    // Log the outbound call
    console.log(`📞 OUTBOUND call from ${From} to ${To} (CallSid: ${CallSid || call_id})`);
    
    // Construct clean WebSocket URL (no query params - SignalWire rejects them)
    const host = request.headers.host || 'localhost';
    const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
    const websocketUrl = `${protocol}://${host}/media-stream`;

    // Get codec attribute
    const codec = AGENT_CONFIG.audioFormat === AUDIO_FORMAT.PCM16
      ? SIGNALWIRE_CODECS.PCM16
      : SIGNALWIRE_CODECS.G711_ULAW;
    const codecAttribute = codec ? ` codec="${codec}"` : '';

    console.log(`📞 Outbound call - Audio: ${AGENT_CONFIG.audioFormat}, Codec: ${codec || 'default'}`);

    // Generate cXML response with call context in customParameters
    // Pass direction, lead_id, broker_id via Parameter tags
    const cXMLResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="${websocketUrl}"${codecAttribute}>
          <Parameter name="direction" value="outbound" />
          <Parameter name="From" value="${From || ''}" />
          <Parameter name="To" value="${To || ''}" />
          <Parameter name="CallSid" value="${CallSid || call_id || ''}" />
          <Parameter name="lead_id" value="${lead_id || ''}" />
          <Parameter name="broker_id" value="${broker_id || ''}" />
        </Stream>
      </Connect>
    </Response>`;

    reply.type('text/xml').send(cXMLResponse);
  });
}

