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
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook signature
    const signature = req.headers['x-instantly-signature'] as string;
    const secret = process.env.INSTANTLY_WEBHOOK_SECRET!;
    
    if (!verifySignature(JSON.stringify(req.body), signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event_type, lead_email, campaign_id, sequence_step, timestamp } = req.body;

    // Log the webhook event
    console.log(`Instantly webhook: ${event_type} for ${lead_email}`);

    // Update lead in Supabase
    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .update({
        last_engagement: new Date().toISOString(),
        campaign_status: event_type,
        updated_at: new Date().toISOString()
      })
      .eq('email', lead_email)
      .select();

    if (leadError) {
      console.error('Error updating lead:', leadError);
      return res.status(500).json({ error: 'Failed to update lead' });
    }

    // Create interaction record
    if (leadData && leadData.length > 0) {
      const lead = leadData[0];
      
      const { error: interactionError } = await supabase
        .from('interactions')
        .insert({
          lead_id: lead.id,
          broker_id: lead.assigned_broker_id,
          type: 'email_' + event_type.replace('email_', ''),
          direction: 'outbound',
          subject: `Email ${event_type}`,
          metadata: {
            campaign_id,
            sequence_step,
            timestamp,
            platform: 'instantly'
          },
          created_at: new Date().toISOString()
        });

      if (interactionError) {
        console.error('Error creating interaction:', interactionError);
      }
    }

    // Log to pipeline events for analytics
    const { error: eventError } = await supabase
      .from('pipeline_events')
      .insert({
        event_type: 'email_engagement',
        event_data: {
          email: lead_email,
          engagement_type: event_type,
          campaign_id,
          sequence_step,
          timestamp
        },
        created_at: new Date().toISOString()
      });

    if (eventError) {
      console.error('Error logging pipeline event:', eventError);
    }

    // Return success response
    res.status(200).json({ 
      success: true, 
      message: `Processed ${event_type} for ${lead_email}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Instantly webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Increase body size limit for webhook data
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
