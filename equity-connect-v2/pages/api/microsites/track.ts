import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

interface TrackEventRequest {
  micrositeId: string;
  event: 'page_view' | 'calculator_completed' | 'form_submitted';
  data?: any;
}

/**
 * API Route: Track microsite events and analytics
 * POST /api/microsites/track
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { micrositeId, event, data }: TrackEventRequest = req.body;

    if (!micrositeId || !event) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch current microsite data
    const { data: microsite, error: fetchError } = await supabase
      .from('microsites')
      .select('*')
      .eq('id', micrositeId)
      .single();

    if (fetchError || !microsite) {
      return res.status(404).json({ error: 'Microsite not found' });
    }

    // Update analytics based on event type
    let updateData: any = {
      updated_at: new Date().toISOString()
    };

    switch (event) {
      case 'page_view':
        updateData.visits = microsite.visits + 1;
        // Could track unique visitors with cookies/IP tracking
        break;

      case 'calculator_completed':
        updateData.calculator_completions = microsite.calculator_completions + 1;
        break;

      case 'form_submitted':
        updateData.form_submissions = microsite.form_submissions + 1;
        
        // Create interaction record
        if (microsite.lead_id) {
          await supabase.from('interactions').insert({
            lead_id: microsite.lead_id,
            type: 'email_sent', // or appropriate type
            direction: 'inbound',
            subject: 'Form Submission from Microsite',
            content: JSON.stringify(data),
            metadata: { microsite_id: micrositeId, event }
          });

          // Update lead engagement
          await supabase
            .from('leads')
            .update({
              last_engagement: new Date().toISOString(),
              interaction_count: supabase.raw('interaction_count + 1')
            })
            .eq('id', microsite.lead_id);
        }
        break;
    }

    // Update microsite analytics
    const { error: updateError } = await supabase
      .from('microsites')
      .update(updateData)
      .eq('id', micrositeId);

    if (updateError) {
      console.error('Error updating microsite:', updateError);
      return res.status(500).json({ error: 'Failed to track event' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Tracking error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

