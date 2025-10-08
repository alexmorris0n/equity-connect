import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

interface CreateMicrositeRequest {
  lead_id: string;
  persona_id: string;
  neighborhood_slug: string;
}

interface CreateMicrositeResponse {
  success: boolean;
  microsite_url?: string;
  microsite_id?: string;
  error?: string;
}

/**
 * API Route: Create a new microsite for a lead
 * POST /api/microsites/create
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateMicrositeResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { lead_id, persona_id, neighborhood_slug }: CreateMicrositeRequest = req.body;

    // Validate required fields
    if (!lead_id || !persona_id || !neighborhood_slug) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: lead_id, persona_id, neighborhood_slug' 
      });
    }

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Fetch persona
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', persona_id)
      .eq('active', true)
      .single();

    if (personaError || !persona) {
      return res.status(404).json({ success: false, error: 'Persona not found' });
    }

    // Fetch neighborhood
    const { data: neighborhood, error: neighborhoodError } = await supabase
      .from('neighborhoods')
      .select('*')
      .eq('slug', neighborhood_slug)
      .eq('active', true)
      .single();

    if (neighborhoodError || !neighborhood) {
      return res.status(404).json({ success: false, error: 'Neighborhood not found' });
    }

    // Check if microsite already exists
    const { data: existingMicrosite } = await supabase
      .from('microsites')
      .select('*')
      .eq('lead_id', lead_id)
      .eq('persona_id', persona_id)
      .eq('neighborhood_id', neighborhood.id)
      .maybeSingle();

    if (existingMicrosite) {
      // Return existing microsite
      return res.status(200).json({
        success: true,
        microsite_url: existingMicrosite.full_url,
        microsite_id: existingMicrosite.id
      });
    }

    // Generate subdomain (neighborhood-persona)
    const subdomain = `${neighborhood_slug}-${persona_id}`;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://equityconnect.com';
    const full_url = `${baseUrl}/${neighborhood_slug}/${persona_id}?lead_id=${lead_id}`;

    // Create microsite record
    const { data: newMicrosite, error: createError } = await supabase
      .from('microsites')
      .insert({
        lead_id: lead_id,
        subdomain: subdomain,
        full_url: full_url,
        persona: persona.name,
        neighborhood: neighborhood.name,
        persona_id: persona_id,
        neighborhood_id: neighborhood.id,
        deployment_status: 'deployed'
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating microsite:', createError);
      return res.status(500).json({ success: false, error: 'Failed to create microsite' });
    }

    // Update lead with microsite URL and assigned persona
    await supabase
      .from('leads')
      .update({
        microsite_url: full_url,
        assigned_persona: persona_id,
        persona_heritage: persona.heritage,
        updated_at: new Date().toISOString()
      })
      .eq('id', lead_id);

    return res.status(201).json({
      success: true,
      microsite_url: full_url,
      microsite_id: newMicrosite.id
    });

  } catch (error) {
    console.error('Microsite creation error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

