/**
 * Book Appointment Tool
 * Create calendar event via Nylas and log to database
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { getSupabaseClient } from '../../services/supabase.js';
import { createCalendarEvent } from '../../services/nylas.js';
import { logger } from '../../utils/logger.js';

/**
 * Book an appointment with the broker
 * Creates Nylas calendar event, logs interaction, creates billing event
 */
export const bookAppointmentTool = realtimeTool({
  name: 'book_appointment',
  description: 'Book an appointment with the broker after checking availability. Creates calendar event and auto-sends invite to lead email. Creates interaction record and billing event.',
  parameters: z.object({
    lead_id: z.string().describe('Lead UUID'),
    broker_id: z.string().describe('Broker UUID'),
    scheduled_for: z.string().describe('Appointment date/time in ISO 8601 format (e.g., "2025-10-20T10:00:00Z")'),
    notes: z.string().nullish().describe('Any notes about the appointment or lead preferences')
  }),
  execute: async ({ lead_id, broker_id, scheduled_for, notes }) => {
    const sb = getSupabaseClient();
    const startTime = Date.now();
    
    try {
      logger.info(`📅 Booking appointment: ${scheduled_for}`);
      
      // Get broker info (including Nylas grant ID)
      const { data: broker, error: brokerError } = await sb
        .from('brokers')
        .select('contact_name, email, timezone, nylas_grant_id')
        .eq('id', broker_id)
        .single();
      
      if (brokerError || !broker) {
        logger.error('Broker not found:', brokerError);
        return JSON.stringify({ 
          success: false, 
          error: 'Broker not found',
          message: 'Unable to book appointment - broker not found.'
        });
      }
      
      if (!broker.nylas_grant_id) {
        logger.error('Broker has no Nylas grant');
        return JSON.stringify({ 
          success: false, 
          error: 'Calendar not connected',
          message: `${broker.contact_name}'s calendar is not connected. Please book manually.`
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
          message: 'Unable to book appointment - lead not found.'
        });
      }
      
      const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Lead';
      const leadEmail = lead.primary_email || null;
      
      // Parse scheduled_for to Unix timestamps
      const appointmentDate = new Date(scheduled_for);
      const startUnix = Math.floor(appointmentDate.getTime() / 1000);
      const endUnix = startUnix + 3600; // 1 hour appointment
      
      // Create calendar event via Nylas
      const nylasEventId = await createCalendarEvent(broker.nylas_grant_id, {
        title: `Reverse Mortgage Consultation - ${leadName}`,
        description: [
          `Lead: ${leadName}`,
          `Phone: ${lead.primary_phone || 'N/A'}`,
          `Email: ${leadEmail || 'N/A'}`,
          '',
          `Notes: ${notes || 'None'}`,
          '',
          'This appointment was scheduled by Barbara AI Assistant.'
        ].join('\n'),
        startTime: startUnix,
        endTime: endUnix,
        participants: leadEmail ? [
          { name: broker.contact_name, email: broker.email },
          { name: leadName, email: leadEmail }
        ] : [
          { name: broker.contact_name, email: broker.email }
        ]
      });
      
      logger.info(`✅ Nylas event created: ${nylasEventId}`);
      
      // Log interaction to Supabase
      await sb.from('interactions').insert({
        lead_id,
        broker_id,
        type: 'appointment',
        direction: 'outbound',
        content: `Appointment scheduled for ${appointmentDate.toLocaleString('en-US')}`,
        outcome: 'appointment_booked',
        metadata: {
          nylas_event_id: nylasEventId,
          scheduled_for,
          notes,
          calendar_invite_sent: !!leadEmail
        },
        created_at: new Date().toISOString()
      });
      
      // Update lead status
      await sb
        .from('leads')
        .update({ 
          status: 'appointment_set',
          last_engagement: new Date().toISOString()
        })
        .eq('id', lead_id);
      
      // Create billing event
      await sb
        .from('billing_events')
        .insert({
          broker_id,
          lead_id,
          event_type: 'appointment_set',
          amount: 50,
          status: 'pending',
          metadata: { 
            nylas_event_id: nylasEventId,
            scheduled_for 
          },
          created_at: new Date().toISOString()
        });
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Appointment booked successfully in ${duration}ms`);
      
      return JSON.stringify({
        success: true,
        event_id: nylasEventId,
        scheduled_for,
        calendar_invite_sent: !!leadEmail,
        message: leadEmail 
          ? `Appointment booked successfully for ${appointmentDate.toLocaleString('en-US')}. Calendar invite sent to ${leadEmail}.`
          : `Appointment booked successfully for ${appointmentDate.toLocaleString('en-US')} (no email for invite).`
      });
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Booking failed after ${duration}ms:`, error);
      return JSON.stringify({ 
        success: false, 
        error: error.message,
        message: 'Unable to book appointment. Please try again or book manually.'
      });
    }
  }
});

