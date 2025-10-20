// Supabase Edge Function: Generate Nylas OAuth URL
// Endpoint: /functions/v1/nylas-auth-url

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get broker_id for this user
    const { data: broker, error: brokerError } = await supabaseClient
      .from('brokers')
      .select('id, contact_name')
      .eq('user_id', user.id)
      .single();

    if (brokerError || !broker) {
      return new Response(
        JSON.stringify({ error: 'Broker not found for this user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate Nylas OAuth URL
    const nylasClientId = Deno.env.get('NYLAS_CLIENT_ID');
    const redirectUri = Deno.env.get('NYLAS_REDIRECT_URI') || 
                        'https://portal.equityconnect.com/calendar/callback';

    if (!nylasClientId) {
      throw new Error('NYLAS_CLIENT_ID not configured');
    }

    const authUrl = new URL('https://api.us.nylas.com/v3/connect/auth');
    authUrl.searchParams.set('client_id', nylasClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', broker.id); // Pass broker_id as state
    authUrl.searchParams.set('access_type', 'offline'); // Get refresh token
    authUrl.searchParams.set('provider', 'auto'); // Let user choose provider

    return new Response(
      JSON.stringify({
        auth_url: authUrl.toString(),
        broker_id: broker.id,
        broker_name: broker.contact_name
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error generating Nylas auth URL:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

