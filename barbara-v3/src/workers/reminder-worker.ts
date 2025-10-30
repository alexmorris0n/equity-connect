import { SMS_CONFIG } from '../config.js';
import { getSupabaseClient } from '../services/supabase.js';
import { sendSmsMessage } from '../services/signalwire.js';
import { logSmsInteraction } from '../services/sms-conversation.js';
import { logger } from '../utils/logger.js';

interface AppointmentRecord {
  id: string;
  lead_id: string;
  broker_id: string | null;
  scheduled_for: string | null;
  metadata: any;
  leads?: (
    | {
        first_name: string | null;
        last_name: string | null;
        primary_phone: string | null;
        property_city: string | null;
        property_state: string | null;
      }
    | Array<{
        first_name: string | null;
        last_name: string | null;
        primary_phone: string | null;
        property_city: string | null;
        property_state: string | null;
      }>
  ) | null;
  brokers?: (
    | {
        contact_name: string | null;
        company_name: string | null;
      }
    | Array<{
        contact_name: string | null;
        company_name: string | null;
      }>
  ) | null;
}

function formatReminderMessage(
  leadName: string,
  brokerName: string,
  appointmentDate: Date,
  city?: string | null
): string {
  const friendlyDate = appointmentDate.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const cityLine = city ? ` Hope things are well in ${city}.` : '';

  return `Hi ${leadName || 'there'}, it’s ${SMS_CONFIG.personaName} from Walter’s office. Just confirming your appointment with ${brokerName} on ${friendlyDate}.${cityLine} Bring your property tax bill if you have it handy, but no worries if not. See you soon!`;
}

async function fetchAppointmentsToRemind(): Promise<AppointmentRecord[]> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Query appointments with scheduled_for in the time window
  // Note: We filter by top-level scheduled_for, but will check metadata as fallback in processing
  const { data, error } = await supabase
    .from('interactions')
    .select(`
      id,
      lead_id,
      broker_id,
      scheduled_for,
      metadata,
      leads:leads!inner(
        first_name,
        last_name,
        primary_phone,
        property_city,
        property_state
      ),
      brokers:brokers!left(
        contact_name,
        company_name
      )
    `)
    .eq('type', 'appointment')
    .or('metadata->>sms_reminder_sent_at.is.null,metadata->>sms_reminder_sent_at.eq.""');

  if (error) {
    logger.error('Failed to fetch appointments for reminders:', error);
    return [];
  }

  // Filter appointments to those in the reminder window (next 24 hours)
  // Check both top-level scheduled_for and metadata.scheduled_for for backward compatibility
  const filtered = (data || []).filter((apt) => {
    const scheduledFor = apt.scheduled_for || apt.metadata?.scheduled_for;
    if (!scheduledFor) return false;
    
    const aptDate = new Date(scheduledFor);
    return aptDate > now && aptDate <= windowEnd;
  });

  return filtered as AppointmentRecord[];
}

async function markReminderSent(appointmentId: string, metadata: any) {
  const supabase = getSupabaseClient();
  const updatedMetadata = {
    ...metadata,
    sms_reminder_sent_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('interactions')
    .update({ metadata: updatedMetadata })
    .eq('id', appointmentId);

  if (error) {
    logger.error(`Failed to mark reminder sent for interaction ${appointmentId}:`, error);
  }
}

async function runReminderSweep() {
  logger.section('📅 SMS Reminder Worker', [
    'Searching for upcoming appointments that need reminders...'
  ]);

  const appointments = await fetchAppointmentsToRemind();

  if (appointments.length === 0) {
    logger.info('No reminders to send at this time.');
    return;
  }

  logger.info(`Found ${appointments.length} appointment(s) needing reminders.`);

  for (const appointment of appointments) {
    try {
      const leadRecord = appointment.leads;
      const lead = Array.isArray(leadRecord) ? leadRecord[0] : leadRecord;
      if (!lead?.primary_phone) {
        logger.warn(`Skipping appointment ${appointment.id} - lead has no phone number.`);
        continue;
      }

      // Check both top-level scheduled_for (new appointments) and metadata.scheduled_for (legacy)
      const scheduledFor = appointment.scheduled_for || appointment.metadata?.scheduled_for;
      if (!scheduledFor) {
        logger.warn(`Skipping appointment ${appointment.id} - missing scheduled_for.`);
        continue;
      }

      const appointmentDate = new Date(scheduledFor);
      const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'there';
      const brokerRecord = appointment.brokers;
      const broker = Array.isArray(brokerRecord) ? brokerRecord[0] : brokerRecord;
      const brokerName = broker?.contact_name || 'our team';

      const messageBody = formatReminderMessage(
        leadName,
        brokerName,
        appointmentDate,
        lead.property_city
      );

      const smsResponse = await sendSmsMessage({
        to: lead.primary_phone,
        from: SMS_CONFIG.fromNumber || appointment.metadata?.signalwire_number || appointment.metadata?.assigned_number || '',
        body: messageBody,
        statusCallback: SMS_CONFIG.statusCallbackUrl,
        metadata: {
          appointment_id: appointment.id,
          reminder_type: 'pre_appointment'
        }
      });

      await logSmsInteraction({
        leadId: appointment.lead_id,
        brokerId: appointment.broker_id ?? undefined,
        body: messageBody,
        direction: 'outbound',
        type: 'sms_sent',
        metadata: {
          reminder_type: 'pre_appointment',
          appointment_id: appointment.id,
          scheduled_for: scheduledFor,
          signalwire_response: smsResponse
        }
      });

      await markReminderSent(appointment.id, appointment.metadata);
      logger.info(`Reminder sent for appointment ${appointment.id}`);
    } catch (error) {
      logger.error(`Failed to process reminder for appointment ${appointment.id}:`, error);
    }
  }
}

runReminderSweep()
  .then(() => {
    logger.info('Reminder worker run complete.');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Reminder worker encountered an error:', error);
    process.exit(1);
  });


