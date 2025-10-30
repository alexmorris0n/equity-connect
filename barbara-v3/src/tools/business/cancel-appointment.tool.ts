/**
 * Cancel Appointment Tool
 * Cancel an existing calendar appointment via Nylas
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { getSupabaseClient } from '../../services/supabase.js';
import { cancelCalendarEvent } from '../../services/nylas.js';
import { logger } from '../../utils/logger.js';

/**
 * Cancel an existing appointment
 * Removes Nylas calendar event and updates database records
 */
export const cancelAppointmentTool = realtimeTool({
  name: 'cancel_appointment',
  description: 'Cancel an existing appointment. Removes calendar event from broker\'s calendar and notifies all participants.',
  parameters: z.object({
    lead_id: z.string().describe('Lead UUID')
  }),
  execute: async ({ lead_id }) => {
    const sb = getSupabaseClient();
    const startTime = Date.now();
    
    try {
      logger.info(`🗑️ Canceling appointment for lead: ${lead_id}`);
      
      // Find most recent appointment for this lead
      const { data: appointment, error: appointmentError } = await sb
        .from('interactions')
        .select('*')
        .eq('lead_id', lead_id)
        .eq('type', 'appointment')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (appointmentError || !appointment) {
        logger.error('No appointment found:', appointmentError);
        return JSON.stringify({
          success: false,
          error: 'No appointment found',
          message: 'I couldn\'t find an existing appointment to cancel. Would you like to book a new one instead?'
        });
      }
      
      // Check if already cancelled
      if (appointment.outcome === 'cancelled') {
        return JSON.stringify({
          success: false,
          error: 'Already cancelled',
          message: 'This appointment has already been cancelled.'
        });
      }
      
      const nylasEventId = appointment.metadata?.nylas_event_id;
      const brokerId = appointment.broker_id;
      
      if (!nylasEventId) {
        logger.error('No Nylas event ID found in appointment metadata');
        return JSON.stringify({
          success: false,
          error: 'Missing event ID',
          message: 'Unable to cancel appointment - missing calendar event reference.'
        });
      }
      
      // Get broker info (including Nylas grant ID)
      const { data: broker, error: brokerError } = await sb
        .from('brokers')
        .select('contact_name, nylas_grant_id')
        .eq('id', brokerId)
        .single();
      
      if (brokerError || !broker) {
        logger.error('Broker not found:', brokerError);
        return JSON.stringify({
          success: false,
          error: 'Broker not found',
          message: 'Unable to cancel appointment - broker not found.'
        });
      }
      
      if (!broker.nylas_grant_id) {
        logger.error('Broker has no Nylas grant');
        return JSON.stringify({
          success: false,
          error: 'Calendar not connected',
          message: `Unable to cancel appointment - ${broker.contact_name}'s calendar is not connected.`
        });
      }
      
      // Cancel event via Nylas
      await cancelCalendarEvent(broker.nylas_grant_id, nylasEventId);
      logger.info(`✅ Nylas event cancelled: ${nylasEventId}`);
      
      // Update existing interaction record
      const { error: updateError } = await sb
        .from('interactions')
        .update({
          outcome: 'cancelled',
          metadata: {
            ...appointment.metadata,
            cancelled_at: new Date().toISOString()
          }
        })
        .eq('id', appointment.id);
      
      if (updateError) {
        logger.error('❌ Failed to update appointment record:', updateError);
        // Don't fail - calendar is cancelled which is most important
      }
      
      // Create new interaction documenting the cancellation
      const { error: interactionError } = await sb.from('interactions').insert({
        lead_id,
        broker_id: brokerId,
        type: 'note',
        direction: 'inbound',
        content: `Appointment cancelled by lead`,
        outcome: 'cancelled',
        metadata: {
          original_appointment_id: appointment.id,
          original_scheduled_for: appointment.scheduled_for,
          cancelled_via: 'barbara_ai'
        },
        created_at: new Date().toISOString()
      });
      
      if (interactionError) {
        logger.error('❌ Failed to create cancellation record:', interactionError);
        // Don't fail - calendar is cancelled which is most important
      }
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Appointment cancelled successfully in ${duration}ms`);
      
      const appointmentDate = new Date(appointment.scheduled_for || '');
      return JSON.stringify({
        success: true,
        cancelled_appointment: {
          scheduled_for: appointment.scheduled_for,
          broker_name: broker.contact_name
        },
        message: `Appointment cancelled successfully. ${broker.contact_name} has been notified and the event has been removed from the calendar.`
      });
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Cancellation failed after ${duration}ms:`, error);
      return JSON.stringify({
        success: false,
        error: error.message,
        message: 'Unable to cancel appointment. Please try again or contact us directly.'
      });
    }
  }
});

