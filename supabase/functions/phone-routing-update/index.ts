import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const {
      signalwire_sid,
      phone_number,
      route_type,
      webhook_url,
      swml_script_id,
      signalwire_swml_script_id
    } = await req.json()

    // Validate required fields
    if (!signalwire_sid || !route_type) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get SignalWire credentials from environment
    const SIGNALWIRE_SPACE = Deno.env.get('SIGNALWIRE_SPACE')
    const SIGNALWIRE_PROJECT_ID = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    // Accept both names for flexibility
    const SIGNALWIRE_API_TOKEN =
      Deno.env.get('SIGNALWIRE_API_TOKEN') || Deno.env.get('SIGNALWIRE_TOKEN')

    if (!SIGNALWIRE_SPACE || !SIGNALWIRE_PROJECT_ID || !SIGNALWIRE_API_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, message: 'SignalWire credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build SignalWire API URL
    const apiUrl = `https://${SIGNALWIRE_SPACE}/api/laml/2010-04-01/Accounts/${SIGNALWIRE_PROJECT_ID}/IncomingPhoneNumbers/${signalwire_sid}.json`

    // Prepare update payload based on route type (use snake_case per SignalWire API)
    let updatePayload: Record<string, string>

    if (route_type === 'signalwire') {
      // Prefer routing to SWML script by SID if provided; otherwise fall back to webhook URL
      if (signalwire_swml_script_id) {
        updatePayload = {
          call_handler: 'laml_script',
          laml_script_sid: signalwire_swml_script_id
        }
      } else if (webhook_url) {
        updatePayload = {
          voice_url: webhook_url,
          voice_method: 'POST',
          call_handler: 'laml_webhooks'
        }
      } else {
        return new Response(
          JSON.stringify({ success: false, message: 'Missing signalwire_swml_script_id or webhook_url' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else if (route_type === 'livekit') {
      // Route to SWML script
      updatePayload = {
        call_handler: 'laml_script',
        laml_script_sid: swml_script_id,
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid route type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call SignalWire API
    const authHeader = 'Basic ' + btoa(`${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`)
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(updatePayload).toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SignalWire API error:', errorText)
      return new Response(
        JSON.stringify({
          success: false,
          message: `SignalWire API error: ${response.statusText}`,
          details: errorText
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await response.json()

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Phone routing updated successfully',
        signalwire_response: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in phone-routing-update:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

