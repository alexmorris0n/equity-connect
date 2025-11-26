import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Request received:', req.method);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Getting auth header...');
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } }
    );

    console.log('Getting user...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError) {
      console.log('User error:', userError.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: ' + userError.message }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    if (!user) {
      console.log('No user found');
      return new Response(JSON.stringify({ error: 'Unauthorized: No user' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    console.log('User authenticated:', user.id);

    let brokerId: string | null = null;
    let brokerName: string | null = null;
    
    // Try to get broker_id from body
    if (req.method === 'POST') {
      try {
        const text = await req.text();
        console.log('Request body:', text);
        if (text) {
          const body = JSON.parse(text);
          brokerId = body.broker_id || null;
          console.log('Broker ID from body:', brokerId);
        }
      } catch (e) {
        console.log('Error parsing body:', e);
      }
    }

    if (brokerId) {
      console.log('Looking up broker by ID:', brokerId);
      const { data: broker, error: brokerError } = await supabaseClient
        .from('brokers').select('id, contact_name').eq('id', brokerId).single();
      if (brokerError || !broker) {
        console.log('Broker not found by ID');
        return new Response(JSON.stringify({ error: 'Broker not found' }), 
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      brokerName = broker.contact_name;
    } else {
      console.log('Looking up broker by user_id:', user.id);
      const { data: broker, error: brokerError } = await supabaseClient
        .from('brokers').select('id, contact_name').eq('user_id', user.id).single();
      if (brokerError || !broker) {
        console.log('Broker not found by user_id');
        return new Response(JSON.stringify({ error: 'Broker not found for this user' }), 
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      brokerId = broker.id;
      brokerName = broker.contact_name;
    }

    console.log('Found broker:', brokerId, brokerName);

    const nylasClientId = Deno.env.get('NYLAS_CLIENT_ID');
    const redirectUri = Deno.env.get('NYLAS_REDIRECT_URI') || 'https://mxnqfwuhvurajrgoefyg.supabase.co/functions/v1/nylas-callback';
    
    console.log('NYLAS_CLIENT_ID present:', !!nylasClientId);
    console.log('Redirect URI:', redirectUri);
    
    if (!nylasClientId) {
      return new Response(JSON.stringify({ error: 'NYLAS_CLIENT_ID not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const authUrl = new URL('https://api.us.nylas.com/v3/connect/auth');
    authUrl.searchParams.set('client_id', nylasClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', brokerId!);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('provider', 'auto');

    console.log('Generated auth URL');

    return new Response(JSON.stringify({ auth_url: authUrl.toString(), broker_id: brokerId, broker_name: brokerName }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Caught error:', error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
