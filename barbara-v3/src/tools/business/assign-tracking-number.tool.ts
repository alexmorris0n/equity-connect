/**
 * Assign Tracking Number Tool
 * Link SignalWire number to lead/broker pair for call tracking and billing
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { getSupabaseClient } from '../../services/supabase.js';
import { logger } from '../../utils/logger.js';

/**
 * Assign tracking number for lead/broker pair
 * CALL THIS IMMEDIATELY AFTER booking an appointment
 * Enables call tracking for billing verification
 */
export const assignTrackingNumberTool = realtimeTool({
  name: 'assign_tracking_number',
  description: 'Assign the current SignalWire number to this lead/broker pair for call tracking. CALL THIS IMMEDIATELY AFTER booking an appointment. This allows us to track all future calls between broker and lead for billing verification.',
  parameters: z.object({
    lead_id: z.string().describe('Lead UUID'),
    broker_id: z.string().describe('Broker UUID'),
    signalwire_number: z.string().describe('The SignalWire number Barbara is calling from (e.g., "+14244851544")'),
    appointment_datetime: z.string().describe('Appointment date/time in ISO 8601 format (e.g., "2025-10-22T10:00:00Z")')
  }),
  execute: async ({ lead_id, broker_id, signalwire_number, appointment_datetime }) => {
    const sb = getSupabaseClient();
    
    try {
      logger.info(`📞 Assigning tracking number: ${signalwire_number}`);
      
      // Call the database function
      const { data, error } = await sb.rpc('assign_tracking_number', {
        p_lead_id: lead_id,
        p_broker_id: broker_id,
        p_signalwire_number: signalwire_number,
        p_appointment_datetime: appointment_datetime
      });
      
      if (error) {
        logger.error('Failed to assign tracking number:', error);
        return JSON.stringify({
          success: false,
          error: error.message,
          message: 'Failed to assign tracking number.'
        });
      }
      
      logger.info(`✅ Tracking number assigned: ${signalwire_number} → Lead ${lead_id}`);
      
      return JSON.stringify({
        success: true,
        number: signalwire_number,
        lead_id: lead_id,
        broker_id: broker_id,
        release_at: data?.release_at,
        message: `Tracking number ${signalwire_number} assigned successfully. All future calls will be logged for billing.`
      });
      
    } catch (error: any) {
      logger.error('Error assigning tracking number:', error);
      return JSON.stringify({
        success: false,
        error: error.message,
        message: 'Error assigning tracking number.'
      });
    }
  }
});

