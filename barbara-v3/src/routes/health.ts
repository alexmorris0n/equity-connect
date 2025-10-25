/**
 * Health Check Route
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function healthRoute(fastify: FastifyInstance) {
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.send({
      status: 'healthy',
      service: 'Barbara Voice Assistant V3',
      timestamp: new Date().toISOString()
    });
  });

  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.send({
      service: 'Barbara Voice Assistant V3',
      status: 'running',
      endpoints: {
        health: '/health',
        webhook: '/incoming-call',
        stream: '/media-stream (WebSocket)'
      }
    });
  });
}

