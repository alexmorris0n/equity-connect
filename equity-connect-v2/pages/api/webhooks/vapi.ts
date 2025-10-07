import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Verify HMAC signature
function verifySignature(body: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expectedSignature}`),
    Buffer.from(signature)
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook signature
    const signature = req.headers['x-vapi-signature'] as string;
    const secret = process.env.VAPI_WEBHOOK_SECRET!;
    
    if (!verifySignature(JSON.stringify(req.body), signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { type, call, phoneNumber, transcript } = req.body;

    console.log(`VAPI webhook: ${type} for ${phoneNumber?.number}`);

    // Handle different VAPI event types
    switch (type) {
      case 'call-start':
        await handleCallStart(call, phoneNumber);
        break;
      case 'call-end':
        await handleCallEnd(call, phoneNumber, transcript);
        break;
      case 'speech-update':
        await handleSpeechUpdate(call, req.body.speech);
        break;
      default:
        console.log(`Unknown VAPI event type: ${type}`);
    }

    res.status(200).json({ success: true, type });

  } catch (error) {
    console.error('VAPI webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function handleCallStart(call: any, phoneNumber: any) {
  console.log(`VAPI call started: ${call.id} to ${phoneNumber.number}`);
  
  // Log call start event
  await supabase.from('pipeline_events').insert({
    event_type: 'call_started',
    event_data: {
      call_id: call.id,
      phone_number: phoneNumber.number,
      start_time: new Date().toISOString()
    },
    created_at: new Date().toISOString()
  });
}

async function handleCallEnd(call: any, phoneNumber: any, transcript?: string) {
  console.log(`VAPI call ended: ${call.id}, duration: ${call.duration}s`);
  
  // Find lead by phone number
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
      
      // Check for positive indicators in transcript
      if (transcript) {
        const lowerTranscript = transcript.toLowerCase();
        if (lowerTranscript.includes('interested') || 
            lowerTranscript.includes('yes') || 
            lowerTranscript.includes('tell me more')) {
          outcome = 'positive';
          newStatus = 'qualified';
        }
      }
    }
    
    // Create interaction record
    await supabase.from('interactions').insert({
      lead_id: lead.id,
      broker_id: lead.assigned_broker_id,
      type: 'ai_call',
      direction: 'outbound',
      duration_seconds: call.duration,
      outcome,
      content: transcript || '',
      metadata: {
        call_id: call.id,
        vapi_data: call,
        phone_number: phoneNumber.number
      },
      created_at: new Date().toISOString()
    });
    
    // Update lead status
    await supabase
      .from('leads')
      .update({
        status: newStatus,
        last_contact: new Date().toISOString(),
        interaction_count: lead.interaction_count + 1,
        vapi_call_id: call.id,
        call_outcome: outcome,
        updated_at: new Date().toISOString()
      })
      .eq('id', lead.id);

    // If positive outcome, create billing event
    if (outcome === 'positive') {
      await supabase.from('billing_events').insert({
        broker_id: lead.assigned_broker_id,
        lead_id: lead.id,
        event_type: 'qualified_lead',
        amount: 50.00, // Configurable rate for qualified leads
        status: 'pending',
        created_at: new Date().toISOString()
      });
    }
  }
}

async function handleSpeechUpdate(call: any, speech: any) {
  // Process real-time speech for consent detection
  const transcript = speech.transcript.toLowerCase();
  
  if (transcript.includes('yes') || 
      transcript.includes('interested') || 
      transcript.includes('tell me more')) {
    console.log(`Positive response detected in call ${call.id}`);
    
    await supabase.from('pipeline_events').insert({
      event_type: 'positive_response',
      event_data: {
        call_id: call.id,
        transcript: speech.transcript,
        confidence: speech.confidence,
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
