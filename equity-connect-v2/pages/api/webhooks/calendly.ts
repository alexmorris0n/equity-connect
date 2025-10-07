import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Verify Calendly webhook signature
function verifySignature(body: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook signature
    const signature = req.headers['calendly-webhook-signature'] as string;
    const secret = process.env.CALENDLY_WEBHOOK_SECRET!;
    
    if (!verifySignature(JSON.stringify(req.body), signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, payload } = req.body;

    console.log(`Calendly webhook: ${event}`);

    // Handle different Calendly events
    switch (event) {
      case 'invitee.created':
        await handleAppointmentBooked(payload);
        break;
      case 'invitee.canceled':
        await handleAppointmentCanceled(payload);
        break;
      case 'invitee.rescheduled':
        await handleAppointmentRescheduled(payload);
        break;
      default:
        console.log(`Unknown Calendly event: ${event}`);
    }

    res.status(200).json({ success: true, event });

  } catch (error) {
    console.error('Calendly webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function handleAppointmentBooked(payload: any) {
  const { invitee, event_type } = payload;
  
  console.log(`Appointment booked: ${invitee.email}`);
  
  // Find lead by email
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('email', invitee.email)
    .limit(1);
  
  if (leads && leads.length > 0) {
    const lead = leads[0];
    
    // Update lead status to appointment_set
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        status: 'appointment_set',
        last_engagement: new Date().toISOString(),
        calendly_event_id: event_type.uuid,
        appointment_scheduled_at: event_type.start_time,
        updated_at: new Date().toISOString()
      })
      .eq('id', lead.id);

    if (updateError) {
      console.error('Error updating lead:', updateError);
      return;
    }
    
    // Create interaction record
    const { error: interactionError } = await supabase
      .from('interactions')
      .insert({
        lead_id: lead.id,
        broker_id: lead.assigned_broker_id,
        type: 'appointment',
        direction: 'inbound',
        subject: 'Appointment Booked',
        scheduled_for: event_type.start_time,
        meeting_link: event_type.location?.join_url || '',
        outcome: 'appointment_booked',
        metadata: {
          calendly_event_id: event_type.uuid,
          event_type_name: event_type.name,
          invitee_data: invitee,
          location: event_type.location
        },
        created_at: new Date().toISOString()
      });

    if (interactionError) {
      console.error('Error creating interaction:', interactionError);
    }
    
    // Create billing event for appointment booking
    const { error: billingError } = await supabase
      .from('billing_events')
      .insert({
        broker_id: lead.assigned_broker_id,
        lead_id: lead.id,
        event_type: 'appointment_set',
        amount: 150.00, // Configurable rate for appointments
        status: 'pending',
        metadata: {
          calendly_event_id: event_type.uuid,
          scheduled_time: event_type.start_time
        },
        created_at: new Date().toISOString()
      });

    if (billingError) {
      console.error('Error creating billing event:', billingError);
    }

    // Log pipeline event
    await supabase.from('pipeline_events').insert({
      event_type: 'appointment_booked',
      event_data: {
        lead_id: lead.id,
        broker_id: lead.assigned_broker_id,
        email: invitee.email,
        scheduled_time: event_type.start_time,
        calendly_event_id: event_type.uuid
      },
      created_at: new Date().toISOString()
    });
    
    console.log(`Successfully processed appointment booking for lead ${lead.id}`);
  } else {
    console.log(`No lead found for email: ${invitee.email}`);
  }
}

async function handleAppointmentCanceled(payload: any) {
  const { invitee, event_type } = payload;
  
  console.log(`Appointment canceled: ${invitee.email}`);
  
  // Find lead by email
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('email', invitee.email)
    .limit(1);
  
  if (leads && leads.length > 0) {
    const lead = leads[0];
    
    // Update lead status back to replied
    await supabase
      .from('leads')
      .update({
        status: 'replied',
        last_engagement: new Date().toISOString(),
        appointment_scheduled_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', lead.id);
    
    // Log the cancellation
    await supabase.from('interactions').insert({
      lead_id: lead.id,
      broker_id: lead.assigned_broker_id,
      type: 'appointment',
      direction: 'inbound',
      subject: 'Appointment Canceled',
      outcome: 'canceled',
      metadata: {
        calendly_event_id: event_type.uuid,
        canceled_at: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    });

    // Reverse billing event if it exists
    const { data: billingEvents } = await supabase
      .from('billing_events')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('event_type', 'appointment_set')
      .eq('status', 'pending');

    if (billingEvents && billingEvents.length > 0) {
      await supabase
        .from('billing_events')
        .update({ status: 'reversed', reversed_at: new Date().toISOString() })
        .eq('id', billingEvents[0].id);
    }
    
    console.log(`Successfully processed appointment cancellation for lead ${lead.id}`);
  }
}

async function handleAppointmentRescheduled(payload: any) {
  const { invitee, event_type } = payload;
  
  console.log(`Appointment rescheduled: ${invitee.email}`);
  
  // Find lead by email
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('email', invitee.email)
    .limit(1);
  
  if (leads && leads.length > 0) {
    const lead = leads[0];
    
    // Update appointment time
    await supabase
      .from('leads')
      .update({
        appointment_scheduled_at: event_type.start_time,
        last_engagement: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', lead.id);
    
    // Log the reschedule
    await supabase.from('interactions').insert({
      lead_id: lead.id,
      broker_id: lead.assigned_broker_id,
      type: 'appointment',
      direction: 'inbound',
      subject: 'Appointment Rescheduled',
      scheduled_for: event_type.start_time,
      outcome: 'rescheduled',
      metadata: {
        calendly_event_id: event_type.uuid,
        new_time: event_type.start_time
      },
      created_at: new Date().toISOString()
    });
    
    console.log(`Successfully processed appointment reschedule for lead ${lead.id}`);
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
