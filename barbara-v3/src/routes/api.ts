/**
 * API Routes
 * REST endpoints for n8n/MCP integration
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { placeOutboundCall } from '../services/signalwire.js';
import { getSystemMetrics } from '../services/system-metrics.js';
import { logger } from '../utils/logger.js';

interface TriggerCallBody {
  to_phone: string;
  from_phone?: string;
  lead_id?: string;
  broker_id?: string;
}

export async function apiRoutes(fastify: FastifyInstance) {
  
  /**
   * POST /api/trigger-call
   * Trigger an outbound call from n8n/barbara-mcp
   */
  fastify.post('/api/trigger-call', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as TriggerCallBody;
    const { to_phone, from_phone, lead_id, broker_id } = body;

    // Validate required fields
    if (!to_phone) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required field: to_phone'
      });
    }

    try {
      logger.info(`📞 API: Trigger call to ${to_phone} for lead ${lead_id || 'unknown'}`);

      // Get Barbara's webhook URL
      const host = request.headers.host || 'barbara-v3-voice.fly.dev';
      const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const webhookUrl = `${protocol}://${host}/outbound-call`;

      // Select phone number from pool
      let fromPhone = from_phone;
      
      if (!fromPhone && broker_id) {
        // Get number from Supabase pool for this broker
        const { getSupabaseClient } = await import('../services/supabase.js');
        const sb = getSupabaseClient();
        
        // Try to get broker's assigned numbers first
        const { data: brokerNumbers } = await sb
          .from('signalwire_phone_numbers')
          .select('*')
          .eq('assigned_broker_id', broker_id)
          .eq('status', 'active')
          .limit(1);
        
        if (brokerNumbers && brokerNumbers.length > 0) {
          fromPhone = brokerNumbers[0].number;
          logger.info(`📱 Using broker's number: ${fromPhone}`);
        } else {
          // Fallback to Equity Connect pool
          const { data: defaultNumbers } = await sb
            .from('signalwire_phone_numbers')
            .select('*')
            .eq('assigned_broker_company', 'Equity Connect')
            .eq('status', 'active')
            .limit(1);
          
          if (defaultNumbers && defaultNumbers.length > 0) {
            fromPhone = defaultNumbers[0].number;
            logger.info(`📱 Using Equity Connect number: ${fromPhone}`);
          } else {
            fromPhone = process.env.DEFAULT_FROM_NUMBER || '+14244851544';
            logger.warn(`⚠️  Using fallback number: ${fromPhone}`);
          }
        }
      } else if (!fromPhone) {
        fromPhone = process.env.DEFAULT_FROM_NUMBER || '+14244851544';
      }

      // Ensure we have a from number
      if (!fromPhone) {
        throw new Error('No available phone number to place call from');
      }

      // Place call via SignalWire
      const callSid = await placeOutboundCall({
        to: to_phone,
        from: fromPhone,
        webhookUrl,
        leadId: lead_id,
        brokerId: broker_id
      });

      return reply.code(200).send({
        success: true,
        call_sid: callSid,
        from: fromPhone,
        to: to_phone,
        message: 'Call placed successfully'
      });

    } catch (error: any) {
      logger.error('Failed to trigger call:', error);
      return reply.code(500).send({
        success: false,
        error: error.message,
        message: 'Failed to place call'
      });
    }
  });

  /**
   * POST /api/outbound-call
   * Legacy endpoint (compatible with Bridge V1 / barbara-mcp)
   */
  fastify.post('/api/outbound-call', async (request: FastifyRequest, reply: FastifyReply) => {
    // Forward to /api/trigger-call for compatibility
    const body = request.body as TriggerCallBody;
    const { to_phone, from_phone, lead_id, broker_id } = body;

    if (!to_phone) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required field: to_phone'
      });
    }

    try {
      const host = request.headers.host || 'barbara-v3-voice.fly.dev';
      const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const webhookUrl = `${protocol}://${host}/outbound-call`;
      const fromPhone = from_phone || process.env.DEFAULT_FROM_NUMBER || '+14244851544';

      const callSid = await placeOutboundCall({
        to: to_phone,
        from: fromPhone,
        webhookUrl,
        leadId: lead_id,
        brokerId: broker_id
      });

      return reply.code(200).send({
        success: true,
        call_sid: callSid,
        from: fromPhone,
        to: to_phone
      });

    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/health
   * API health check
   */
  fastify.get('/api/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'healthy',
      service: 'barbara-v3-api',
      timestamp: new Date().toISOString()
    });
  });

  /**
   * GET /api/system-metrics
   * System metrics for monitoring dashboard
   * Returns status of OpenAI, Gemini, SignalWire, Fly.io, Northflank
   */
  fastify.get('/api/system-metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await getSystemMetrics();
      
      return reply.send({
        success: true,
        metrics: metrics
      });
    } catch (error: any) {
      logger.error('Error getting system metrics:', error);
      return reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  });
}

