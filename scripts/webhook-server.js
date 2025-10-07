/**
 * Equity Connect - Webhook Server
 * Handles webhooks from Instantly, VAPI, Calendly, and SignalWire
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.raw({ type: 'application/octet-stream' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// HMAC verification function
function verifyHMAC(body, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expectedSignature}`),
    Buffer.from(signature)
  );
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Instantly webhook handler
app.post('/webhooks/instantly', async (req, res) => {
  try {
    const signature = req.headers['x-instantly-signature'];
    const secret = process.env.INSTANTLY_WEBHOOK_SECRET;
    
    if (!verifyHMAC(JSON.stringify(req.body), signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const { event_type, lead_email, campaign_id, sequence_step } = req.body;
    
    // Update lead in database
    const { data, error } = await supabase
      .from('leads')
      .update({
        last_engagement: new Date().toISOString(),
        campaign_status: event_type
      })
      .eq('email', lead_email);
    
    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database update failed' });
    }
    
    // Log event
    await supabase.from('pipeline_events').insert({
      event_type: 'email_engagement',
      event_data: {
        email: lead_email,
        engagement_type: event_type,
        campaign_id,
        sequence_step
      },
      created_at: new Date().toISOString()
    });
    
    console.log(`Instantly webhook processed: ${event_type} for ${lead_email}`);
    res.json({ success: true });
    
  } catch (error) {
    console.error('Instantly webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// VAPI webhook handler
app.post('/webhooks/vapi', async (req, res) => {
  try {
    const signature = req.headers['x-vapi-signature'];
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    
    if (!verifyHMAC(JSON.stringify(req.body), signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const { type, call, phoneNumber } = req.body;
    
    // Process different VAPI events
    switch (type) {
      case 'call-start':
        await handleCallStart(call, phoneNumber);
        break;
      case 'call-end':
        await handleCallEnd(call, phoneNumber);
        break;
      case 'speech-update':
        await handleSpeechUpdate(call, req.body.speech);
        break;
      default:
        console.log(`Unknown VAPI event type: ${type}`);
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('VAPI webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Calendly webhook handler
app.post('/webhooks/calendly', async (req, res) => {
  try {
    const signature = req.headers['calendly-webhook-signature'];
    const secret = process.env.CALENDLY_WEBHOOK_SECRET;
    
    if (!verifyHMAC(JSON.stringify(req.body), signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const { event, payload } = req.body;
    
    if (event === 'invitee.created') {
      await handleAppointmentBooked(payload);
    } else if (event === 'invitee.canceled') {
      await handleAppointmentCanceled(payload);
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Calendly webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SignalWire webhook handler
app.post('/webhooks/signalwire', async (req, res) => {
  try {
    const { CallStatus, From, To, CallSid, Duration } = req.body;
    
    // Log call outcome
    await supabase.from('interactions').insert({
      type: 'ai_call',
      direction: 'outbound',
      duration_seconds: parseInt(Duration) || 0,
      metadata: {
        call_sid: CallSid,
        from: From,
        to: To,
        status: CallStatus
      },
      created_at: new Date().toISOString()
    });
    
    // Update lead based on phone number
    if (CallStatus === 'completed' && Duration > 30) {
      await supabase
        .from('leads')
        .update({
          last_contact: new Date().toISOString(),
          status: 'contacted'
        })
        .eq('phone', To);
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('SignalWire webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
async function handleCallStart(call, phoneNumber) {
  console.log(`VAPI call started: ${call.id} to ${phoneNumber.number}`);
  
  await supabase.from('pipeline_events').insert({
    event_type: 'call_started',
    event_data: {
      call_id: call.id,
      phone_number: phoneNumber.number,
      start_time: new Date().toISOString()
    }
  });
}

async function handleCallEnd(call, phoneNumber) {
  console.log(`VAPI call ended: ${call.id}, duration: ${call.duration}s`);
  
  // Update lead status based on call outcome
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('phone', phoneNumber.number)
    .limit(1);
  
  if (leads && leads.length > 0) {
    const lead = leads[0];
    
    // Determine outcome based on call duration and transcript
    let outcome = 'no_response';
    let newStatus = lead.status;
    
    if (call.duration > 30) {
      outcome = 'positive';
      newStatus = 'contacted';
    }
    
    // Create interaction record
    await supabase.from('interactions').insert({
      lead_id: lead.id,
      broker_id: lead.assigned_broker_id,
      type: 'ai_call',
      direction: 'outbound',
      duration_seconds: call.duration,
      outcome,
      content: call.transcript || '',
      metadata: {
        call_id: call.id,
        vapi_data: call
      },
      created_at: new Date().toISOString()
    });
    
    // Update lead
    await supabase
      .from('leads')
      .update({
        status: newStatus,
        last_contact: new Date().toISOString(),
        interaction_count: lead.interaction_count + 1
      })
      .eq('id', lead.id);
  }
}

async function handleSpeechUpdate(call, speech) {
  // Process real-time speech for consent detection
  const transcript = speech.transcript.toLowerCase();
  
  if (transcript.includes('yes') || transcript.includes('interested')) {
    console.log(`Positive response detected in call ${call.id}`);
    
    await supabase.from('pipeline_events').insert({
      event_type: 'positive_response',
      event_data: {
        call_id: call.id,
        transcript: speech.transcript,
        confidence: speech.confidence
      }
    });
  }
}

async function handleAppointmentBooked(payload) {
  const { invitee, event_type } = payload;
  
  // Find lead by email
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('email', invitee.email)
    .limit(1);
  
  if (leads && leads.length > 0) {
    const lead = leads[0];
    
    // Update lead status
    await supabase
      .from('leads')
      .update({
        status: 'appointment_set',
        last_engagement: new Date().toISOString()
      })
      .eq('id', lead.id);
    
    // Create interaction record
    await supabase.from('interactions').insert({
      lead_id: lead.id,
      broker_id: lead.assigned_broker_id,
      type: 'appointment',
      direction: 'inbound',
      subject: 'Appointment Booked',
      scheduled_for: event_type.start_time,
      meeting_link: event_type.location.join_url,
      outcome: 'appointment_booked',
      created_at: new Date().toISOString()
    });
    
    // Create billing event
    await supabase.from('billing_events').insert({
      broker_id: lead.assigned_broker_id,
      lead_id: lead.id,
      event_type: 'appointment_set',
      amount: 150.00, // Configurable rate
      status: 'pending',
      created_at: new Date().toISOString()
    });
    
    console.log(`Appointment booked for lead ${lead.id}`);
  }
}

async function handleAppointmentCanceled(payload) {
  const { invitee } = payload;
  
  // Find and update lead
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('email', invitee.email)
    .limit(1);
  
  if (leads && leads.length > 0) {
    const lead = leads[0];
    
    await supabase
      .from('leads')
      .update({
        status: 'replied',
        last_engagement: new Date().toISOString()
      })
      .eq('id', lead.id);
    
    console.log(`Appointment canceled for lead ${lead.id}`);
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
