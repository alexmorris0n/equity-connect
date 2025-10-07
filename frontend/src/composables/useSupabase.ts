import { createClient } from '@supabase/supabase-js'
import { ref } from 'vue'

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Composable for Supabase operations
export function useSupabase() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Generic function to handle Supabase operations
  const handleSupabaseOperation = async <T>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    try {
      loading.value = true
      error.value = null
      const result = await operation()
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred'
      console.error('Supabase operation error:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  // Lead operations
  const getLeads = async (brokerId?: string, filters?: any) => {
    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (brokerId) {
      query = query.eq('assigned_broker_id', brokerId)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.dateRange) {
      const { from, to } = filters.dateRange
      query = query.gte('created_at', from).lte('created_at', to)
    }

    if (filters?.search) {
      query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
    }

    return handleSupabaseOperation(() => query)
  }

  const getLead = async (id: string) => {
    return handleSupabaseOperation(() =>
      supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single()
    )
  }

  const updateLead = async (id: string, updates: any) => {
    return handleSupabaseOperation(() =>
      supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
    )
  }

  const createLead = async (lead: any) => {
    return handleSupabaseOperation(() =>
      supabase
        .from('leads')
        .insert(lead)
    )
  }

  // Broker operations
  const getBroker = async (id: string) => {
    return handleSupabaseOperation(() =>
      supabase
        .from('brokers')
        .select('*')
        .eq('id', id)
        .single()
    )
  }

  const updateBroker = async (id: string, updates: any) => {
    return handleSupabaseOperation(() =>
      supabase
        .from('brokers')
        .update(updates)
        .eq('id', id)
    )
  }

  // Interaction operations
  const getInteractions = async (leadId: string) => {
    return handleSupabaseOperation(() =>
      supabase
        .from('interactions')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
    )
  }

  const createInteraction = async (interaction: any) => {
    return handleSupabaseOperation(() =>
      supabase
        .from('interactions')
        .insert(interaction)
    )
  }

  // Billing operations
  const getBillingEvents = async (brokerId: string, filters?: any) => {
    let query = supabase
      .from('billing_events')
      .select('*')
      .eq('broker_id', brokerId)
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.dateRange) {
      const { from, to } = filters.dateRange
      query = query.gte('created_at', from).lte('created_at', to)
    }

    return handleSupabaseOperation(() => query)
  }

  const createBillingEvent = async (event: any) => {
    return handleSupabaseOperation(() =>
      supabase
        .from('billing_events')
        .insert(event)
    )
  }

  // Analytics operations
  const getAnalytics = async (brokerId: string, dateRange?: any) => {
    const from = dateRange?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const to = dateRange?.to || new Date().toISOString()

    return handleSupabaseOperation(async () => {
      // Get leads count
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, status, created_at')
        .eq('assigned_broker_id', brokerId)
        .gte('created_at', from)
        .lte('created_at', to)

      // Get billing events
      const { data: billingData } = await supabase
        .from('billing_events')
        .select('amount, event_type, created_at')
        .eq('broker_id', brokerId)
        .gte('created_at', from)
        .lte('created_at', to)

      // Calculate metrics
      const totalLeads = leadsData?.length || 0
      const conversions = leadsData?.filter(l => l.status === 'funded').length || 0
      const appointments = leadsData?.filter(l => l.status === 'appointment_set').length || 0
      const revenue = billingData?.reduce((sum, event) => sum + event.amount, 0) || 0

      return {
        totalLeads,
        conversions,
        appointments,
        revenue,
        conversionRate: totalLeads > 0 ? (conversions / totalLeads) * 100 : 0,
        appointmentRate: totalLeads > 0 ? (appointments / totalLeads) * 100 : 0
      }
    })
  }

  // Real-time subscriptions
  const subscribeToLeads = (brokerId: string, callback: (payload: any) => void) => {
    return supabase
      .channel('leads')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `assigned_broker_id=eq.${brokerId}`
        },
        callback
      )
      .subscribe()
  }

  const subscribeToInteractions = (leadId: string, callback: (payload: any) => void) => {
    return supabase
      .channel('interactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interactions',
          filter: `lead_id=eq.${leadId}`
        },
        callback
      )
      .subscribe()
  }

  return {
    loading,
    error,
    getLeads,
    getLead,
    updateLead,
    createLead,
    getBroker,
    updateBroker,
    getInteractions,
    createInteraction,
    getBillingEvents,
    createBillingEvent,
    getAnalytics,
    subscribeToLeads,
    subscribeToInteractions
  }
}
