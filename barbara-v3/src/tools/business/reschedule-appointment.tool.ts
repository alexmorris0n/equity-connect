/**
 * Reschedule Appointment Tool
 * Update an existing calendar appointment to a new time via Nylas
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { getSupabaseClient } from '../../services/supabase.js';
import { updateCalendarEvent } from '../../services/nylas.js';
import { logger } from '../../utils/logger.js';

/**
 * Reschedule an existing appointment to a new time
 * Updates Nylas calendar event and database records
 */
export const rescheduleAppointmentTool = realtimeTool({
  name: 'reschedule_appointment',
  description: 'Reschedule an existing appointment to a new time. Updates calendar event and sends updated invites to all participants.',
  parameters: z.object({
    lead_id: z.string().describe('Lead UUID'),
    new_scheduled_for: z.string().describe('New appointment date/time in ISO 8601 format (e.g., "2025-10-22T10:00:00Z")')
  }),
  execute: async ({ lead_id, new_scheduled_for }) => {
    const sb = getSupabaseClient();
    const startTime = Date.now();
    
    try {
      logger.info(`📅 Rescheduling appointment for lead: ${lead_id} to ${new_scheduled_for}`);
      
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
          message: 'I couldn\'t find an existing appointment to reschedule. Would you like to book a new one instead?'
        });
      }
      
      // Check if already cancelled
      if (appointment.outcome === 'cancelled') {
        return JSON.stringify({
          success: false,
          error: 'Appointment cancelled',
          message: 'This appointment has been cancelled. Would you like to book a new appointment instead?'
        });
      }
      
      const nylasEventId = appointment.metadata?.nylas_event_id;
      const brokerId = appointment.broker_id;
      const oldScheduledFor = appointment.scheduled_for;
      
      if (!nylasEventId) {
        logger.error('No Nylas event ID found in appointment metadata');
        return JSON.stringify({
          success: false,
          error: 'Missing event ID',
          message: 'Unable to reschedule appointment - missing calendar event reference.'
        });
      }
      
      // Get broker info (including Nylas grant ID)
      const { data: broker, error: brokerError } = await sb
        .from('brokers')
        .select('contact_name, email, nylas_grant_id')
        .eq('id', brokerId)
        .single();
      
      if (brokerError || !broker) {
        logger.error('Broker not found:', brokerError);
        return JSON.stringify({
          success: false,
          error: 'Broker not found',
          message: 'Unable to reschedule appointment - broker not found.'
        });
      }
      
      if (!broker.nylas_grant_id) {
        logger.error('Broker has no Nylas grant');
        return JSON.stringify({
          success: false,
          error: 'Calendar not connected',
          message: `Unable to reschedule appointment - ${broker.contact_name}'s calendar is not connected.`
        });
      }
      
      // Get lead info for calendar event
      const { data: lead } = await sb
        .from('leads')
        .select('first_name, last_name, primary_phone, primary_email')
        .eq('id', lead_id)
        .single();
      
      if (!lead) {
        return JSON.stringify({
          success: false,
          error: 'Lead not found',
          message: 'Unable to reschedule appointment - lead not found.'
        });
      }
      
      const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Lead';
      const leadEmail = lead.primary_email || null;
      
      // Parse new scheduled time to Unix timestamps
      const newAppointmentDate = new Date(new_scheduled_for);
      const newStartUnix = Math.floor(newAppointmentDate.getTime() / 1000);
      const newEndUnix = newStartUnix + 3600; // 1 hour appointment
      
      // Update event via Nylas
      await updateCalendarEvent(broker.nylas_grant_id, nylasEventId, {
        title: `Reverse Mortgage Consultation - ${leadName}`,
        description: [
          `Lead: ${leadName}`,
          `Phone: ${lead.primary_phone || 'N/A'}`,
          `Email: ${leadEmail || 'N/A'}`,
          '',
          `Notes: ${appointment.metadata?.notes || 'None'}`,
          '',
          'This appointment was rescheduled by Barbara AI Assistant.'
        ].join('\n'),
        startTime: newStartUnix,
        endTime: newEndUnix,
        participants: leadEmail ? [
          { name: broker.contact_name, email: broker.email },
          { name: leadName, email: leadEmail }
        ] : [
          { name: broker.contact_name, email: broker.email }
        ]
      });
      
      logger.info(`✅ Nylas event rescheduled: ${nylasEventId}`);
      
      // Update existing interaction record
      const { error: updateError } = await sb
        .from('interactions')
        .update({
          scheduled_for: new_scheduled_for,
          metadata: {
            ...appointment.metadata,
            rescheduled_at: new Date().toISOString(),
            original_scheduled_for: oldScheduledFor
          }
        })
        .eq('id', appointment.id);
      
      if (updateError) {
        logger.error('❌ Failed to update appointment record:', updateError);
        // Don't fail - calendar is updated which is most important
      }
      
      // Create new interaction documenting the reschedule
      const { error: interactionError } = await sb.from('interactions').insert({
        lead_id,
        broker_id: brokerId,
        type: 'note',
        direction: 'inbound',
        content: `Appointment rescheduled from ${new Date(oldScheduledFor || '').toLocaleString('en-US')} to ${newAppointmentDate.toLocaleString('en-US')}`,
        outcome: 'appointment_rescheduled',
        metadata: {
          original_appointment_id: appointment.id,
          old_scheduled_for: oldScheduledFor,
          new_scheduled_for: new_scheduled_for,
          rescheduled_via: 'barbara_ai'
        },
        created_at: new Date().toISOString()
      });
      
      if (interactionError) {
        logger.error('❌ Failed to create reschedule record:', interactionError);
        // Don't fail - calendar is updated which is most important
      }
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Appointment rescheduled successfully in ${duration}ms`);
      
      return JSON.stringify({
        success: true,
        old_scheduled_for: oldScheduledFor,
        new_scheduled_for: new_scheduled_for,
        calendar_invite_sent: !!leadEmail,
        message: leadEmail
          ? `Appointment rescheduled successfully to ${newAppointmentDate.toLocaleString('en-US')}. Updated calendar invites sent to you and ${broker.contact_name}.`
          : `Appointment rescheduled successfully to ${newAppointmentDate.toLocaleString('en-US')}. ${broker.contact_name} has been notified.`
      });
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Reschedule failed after ${duration}ms:`, error);
      return JSON.stringify({
        success: false,
        error: error.message,
        message: 'Unable to reschedule appointment. Please try again or contact us directly.'
      });
    }
  }
});

