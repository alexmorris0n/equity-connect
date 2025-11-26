// Supabase Edge Function: Handle Nylas OAuth Callback
// Endpoint: /functions/v1/nylas-callback

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

  // Parse URL params outside try block so they're accessible in catch
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const broker_id = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  try {

    // Check for OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      const errorRedirect = broker_id 
        ? `https://app.barbarpro.com/brokers/${broker_id}?calendar_error=${encodeURIComponent(error)}`
        : `https://app.barbarpro.com/dashboard?calendar_error=${encodeURIComponent(error)}`;
      return Response.redirect(errorRedirect);
    }

    if (!code || !broker_id) {
      return new Response(
        JSON.stringify({ error: 'Missing code or state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange authorization code for grant
    const nylasClientId = Deno.env.get('NYLAS_CLIENT_ID');
    const nylasClientSecret = Deno.env.get('NYLAS_CLIENT_SECRET');
    const nylasApiKey = Deno.env.get('NYLAS_API_KEY');
    const redirectUri = Deno.env.get('NYLAS_REDIRECT_URI') || 
                        'https://mxnqfwuhvurajrgoefyg.supabase.co/functions/v1/nylas-callback';

    if (!nylasClientId || !nylasClientSecret || !nylasApiKey) {
      throw new Error('Nylas credentials not configured');
    }

    console.log('Exchanging code for grant...');
    
    const tokenResponse = await fetch('https://api.us.nylas.com/v3/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nylasApiKey}`
      },
      body: JSON.stringify({
        client_id: nylasClientId,
        client_secret: nylasClientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Nylas token exchange failed:', errorText);
      throw new Error(`Failed to exchange code: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful, grant_id:', tokenData.grant_id);

    // Get grant details to find provider
    const grantResponse = await fetch(
      `https://api.us.nylas.com/v3/grants/${tokenData.grant_id}`,
      {
        headers: {
          'Authorization': `Bearer ${nylasApiKey}`
        }
      }
    );

    if (!grantResponse.ok) {
      const errorText = await grantResponse.text();
      console.error('Failed to fetch grant details:', errorText);
      throw new Error(`Failed to fetch grant: ${errorText}`);
    }

    const grantData = await grantResponse.json();
    const provider = grantData.provider; // 'google', 'microsoft', 'icloud', etc.

    console.log('Grant details fetched, provider:', provider);

    // Update broker record in Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role to update
    );

    const { error: updateError } = await supabaseClient
      .from('brokers')
      .update({
        nylas_grant_id: tokenData.grant_id,
        calendar_provider: provider,
        calendar_synced_at: new Date().toISOString()
      })
      .eq('id', broker_id);

    if (updateError) {
      console.error('Failed to update broker:', updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log('Broker calendar synced successfully:', broker_id);

    // Redirect back to broker detail page with success
    return Response.redirect(
      `https://app.barbarpro.com/brokers/${broker_id}?calendar_synced=true`
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorRedirect = broker_id 
      ? `https://app.barbarpro.com/brokers/${broker_id}?calendar_error=${encodeURIComponent(error.message)}`
      : `https://app.barbarpro.com/dashboard?calendar_error=${encodeURIComponent(error.message)}`;
    return Response.redirect(errorRedirect);
  }
});

