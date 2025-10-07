// Consent API utilities
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VUE_APP_SUPABASE_URL!,
  process.env.VUE_APP_SUPABASE_ANON_KEY!
)

// Verify consent token
export async function verifyConsentToken(token: string) {
  try {
    // In production, verify HMAC signature
    const response = await fetch('/api/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    
    if (response.ok) {
      return await response.json()
    }
    throw new Error('Token verification failed')
  } catch (error) {
    console.error('Token verification error:', error)
    throw error
  }
}

// Submit consent form
export async function submitConsent(consentData: {
  lead_id: string
  consent: boolean
  method: string
  first_name: string
  last_name: string
  email: string
  phone: string
  ip_address?: string
  user_agent: string
  token_hash?: string
  utm_campaign?: string
  utm_source?: string
  utm_medium?: string
}) {
  try {
    const response = await fetch('/api/consent-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(consentData)
    })
    
    if (response.ok) {
      return await response.json()
    }
    throw new Error('Consent submission failed')
  } catch (error) {
    console.error('Consent submission error:', error)
    throw error
  }
}

// Get lead data by ID
export async function getLeadData(leadId: string) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Lead data fetch error:', error)
    throw error
  }
}

// Get broker data by ID
export async function getBrokerData(brokerId: string) {
  try {
    const { data, error } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', brokerId)
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Broker data fetch error:', error)
    throw error
  }
}
