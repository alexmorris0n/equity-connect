/**
 * Phone Number Routing API
 * Manages SignalWire phone number routing between webhook and SWML script
 */

import { supabase } from '@/lib/supabase'

export interface PhoneNumber {
  id: string
  phone_number: string
  signalwire_sid: string
  label: string | null
  current_route: 'signalwire' | 'livekit'
  vertical: string | null
  is_active: boolean
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface RoutingConfig {
  livekit_swml_script_id: string
  signalwire_webhook_url: string
  signalwire_swml_script_id?: string
}

/**
 * Fetch routing configuration
 */
export async function getRoutingConfig(): Promise<RoutingConfig> {
  const { data, error } = await supabase
    .from('phone_routing_config')
    .select('key, value')
    .in('key', ['livekit_swml_script_id', 'signalwire_webhook_url', 'signalwire_swml_script_id'])

  if (error) {
    console.error('Error fetching routing config:', error)
    throw error
  }

  const config: any = {}
  data?.forEach(item => {
    config[item.key] = item.value
  })

  return config as RoutingConfig
}

/**
 * Fetch all phone numbers
 */
export async function listPhoneNumbers(): Promise<PhoneNumber[]> {
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .order('phone_number', { ascending: true })

  if (error) {
    console.error('Error fetching phone numbers:', error)
    throw error
  }

  return data || []
}

/**
 * Update phone number routing
 * This will:
 * 1. Determine routing method (webhook vs SWML script)
 * 2. Call SignalWire API to update the number
 * 3. Update the database
 */
export async function updatePhoneRouting(
  phoneNumberId: string,
  newRoute: 'signalwire' | 'livekit'
): Promise<{ success: boolean; message: string }> {
  try {
    // Step 1: Get current phone number config
    const { data: phoneNumber, error: fetchError } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('id', phoneNumberId)
      .single()

    if (fetchError || !phoneNumber) {
      throw new Error('Phone number not found')
    }

    // Step 2: Get routing config
    const config = await getRoutingConfig()

    // Step 3: Call Supabase Edge Function via supabase-js (handles auth headers)
    const anonKey =
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bnFmd3VodnVyYWpyZ29lZnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzU3OTAsImV4cCI6MjA3NTQ1MTc5MH0.QMoZAjIKkB05Vr9nM1FKbC2ke5RTvfv6zrSDU0QMuN4'

    const { data: invokeData, error: invokeError } = await (supabase as any).functions.invoke(
      'phone-routing-update',
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`
        },
        body: {
          signalwire_sid: phoneNumber.signalwire_sid,
          phone_number: phoneNumber.phone_number,
          route_type: newRoute,
          webhook_url: config.signalwire_webhook_url,
          swml_script_id: config.livekit_swml_script_id,
          signalwire_swml_script_id: config.signalwire_swml_script_id
        }
      }
    )
    if (invokeError || !invokeData?.success) {
      throw new Error(invokeError?.message || invokeData?.message || 'Failed to update SignalWire')
    }

    // Step 4: Update database
    const { error: updateError } = await supabase
      .from('phone_numbers')
      .update({
        current_route: newRoute,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', phoneNumberId)

    if (updateError) {
      throw new Error('Database update failed: ' + updateError.message)
    }

    return {
      success: true,
      message: `Routing updated to ${newRoute === 'livekit' ? 'LiveKit (SWML Script)' : 'SignalWire (Webhook)'}`
    }
  } catch (error) {
    console.error('Error updating phone routing:', error)
    return {
      success: false,
      message: error.message || 'Failed to update routing'
    }
  }
}

/**
 * Sync phone numbers from SignalWire
 * Fetches current numbers from SignalWire and updates database
 */
export async function syncPhoneNumbersFromSignalWire(): Promise<{
  success: boolean
  synced: number
  message: string
}> {
  try {
    const anonKey =
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bnFmd3VodnVyYWpyZ29lZnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzU3OTAsImV4cCI6MjA3NTQ1MTc5MH0.QMoZAjIKkB05Vr9nM1FKbC2ke5RTvfv6zrSDU0QMuN4'
    const { data, error } = await (supabase as any).functions.invoke(
      'phone-routing-sync',
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`
        },
        body: {}
      }
    )
    if (error || data?.success === false) {
      throw new Error(error?.message || data?.message || 'Sync failed')
    }
    return {
      success: true,
      synced: data?.synced ?? 0,
      message: data?.message || 'Sync complete'
    }
  } catch (error: any) {
    return {
      success: false,
      synced: 0,
      message: error?.message || 'Sync failed'
    }
  }
}

