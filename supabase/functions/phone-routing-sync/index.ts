import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Max-Age': '86400',
}

type PhoneNumberRow = {
  id: string
  phone_number: string
  signalwire_sid: string
  current_route: 'signalwire' | 'livekit'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    // Env for SignalWire
    const SIGNALWIRE_SPACE = Deno.env.get('SIGNALWIRE_SPACE')
    const SIGNALWIRE_PROJECT_ID = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const SIGNALWIRE_API_TOKEN =
      Deno.env.get('SIGNALWIRE_API_TOKEN') || Deno.env.get('SIGNALWIRE_TOKEN')

    if (!SIGNALWIRE_SPACE || !SIGNALWIRE_PROJECT_ID || !SIGNALWIRE_API_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, synced: 0, message: 'SignalWire credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Env for Supabase (service role)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ success: false, synced: 0, message: 'Supabase service credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Load existing numbers from DB
    const { data: rows, error } = await supabase
      .from('phone_numbers')
      .select('id, phone_number, signalwire_sid, current_route')
      .eq('is_active', true)

    if (error) {
      return new Response(
        JSON.stringify({ success: false, synced: 0, message: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = 'Basic ' + btoa(`${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`)
    const apiBase = `https://${SIGNALWIRE_SPACE}/api/laml/2010-04-01/Accounts/${SIGNALWIRE_PROJECT_ID}`

    let updated = 0
    // Fetch each number's current routing and update DB
    for (const row of (rows || []) as PhoneNumberRow[]) {
      const detailUrl = `${apiBase}/IncomingPhoneNumbers/${row.signalwire_sid}.json`
      const resp = await fetch(detailUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader
        }
      })

      if (!resp.ok) {
        // skip but continue others
        continue
      }

      const sw = await resp.json()
      // Normalize fields (SignalWire may return camel or snake)
      const callHandler = sw.CallHandler || sw.call_handler || ''
      const voiceUrl = sw.VoiceUrl || sw.voice_url || ''
      const relayScriptId = sw.CallRelayScriptId || sw.call_relay_script_id || ''

      // Decide route
      let detectedRoute: 'signalwire' | 'livekit' = 'signalwire'
      if (callHandler && (callHandler.includes('relay') || callHandler === 'relay_script')) {
        detectedRoute = 'livekit'
      } else if (voiceUrl) {
        detectedRoute = 'signalwire'
      }

      // Update DB if changed or always bump last_synced_at
      const { error: upErr } = await supabase
        .from('phone_numbers')
        .update({
          current_route: detectedRoute,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', row.id)

      if (!upErr) updated += 1
    }

    return new Response(
      JSON.stringify({ success: true, synced: updated, message: 'Sync complete' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, synced: 0, message: err?.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


