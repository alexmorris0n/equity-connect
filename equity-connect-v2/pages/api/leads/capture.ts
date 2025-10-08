import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

interface CaptureLeadRequest {
  name: string;
  email: string;
  phone: string;
  preferredTime?: string;
  message?: string;
  persona_id: string;
  lead_id?: string;
  form_type: 'schedule' | 'calculator';
}

/**
 * API Route: Capture lead form submissions
 * POST /api/leads/capture
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formData: CaptureLeadRequest = req.body;

    // Validate required fields
    if (!formData.name || !formData.email || !formData.phone || !formData.persona_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Split name into first and last
    const nameParts = formData.name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    let leadId = formData.lead_id;

    // If lead_id provided, update existing lead
    if (leadId) {
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          first_name: firstName,
          last_name: lastName,
          email: formData.email,
          phone: formData.phone,
          assigned_persona: formData.persona_id,
          last_engagement: new Date().toISOString(),
          interaction_count: supabase.raw('interaction_count + 1'),
          status: 'contacted',
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (updateError) {
        console.error('Error updating lead:', updateError);
      }
    } else {
      // Create new lead
      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: formData.email,
          phone: formData.phone,
          assigned_persona: formData.persona_id,
          status: 'new',
          campaign_status: 'new',
          source: 'Microsite Form',
          last_engagement: new Date().toISOString(),
          interaction_count: 1
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating lead:', createError);
        return res.status(500).json({ error: 'Failed to create lead' });
      }

      leadId = newLead.id;
    }

    // Create interaction record
    await supabase.from('interactions').insert({
      lead_id: leadId,
      type: 'email_sent',
      direction: 'inbound',
      subject: `Form Submission - ${formData.form_type}`,
      content: JSON.stringify({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        preferredTime: formData.preferredTime,
        message: formData.message,
        form_type: formData.form_type
      }),
      metadata: {
        form_type: formData.form_type,
        preferred_time: formData.preferredTime
      }
    });

    // TODO: Send confirmation email
    // TODO: Notify assigned broker
    // TODO: Add to CRM/follow-up sequence

    return res.status(200).json({ 
      success: true,
      lead_id: leadId,
      message: 'Form submitted successfully'
    });

  } catch (error) {
    console.error('Lead capture error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

