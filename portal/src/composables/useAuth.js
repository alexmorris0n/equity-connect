import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

const user = ref(null)
const broker = ref(null)
const loading = ref(false)
let initialized = false
let initPromise = null

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.app_metadata?.user_role === 'admin')
  const isBroker = computed(() => user.value?.app_metadata?.user_role === 'broker')

  async function checkAuth() {
    if (loading.value) return // Prevent concurrent calls
    
    loading.value = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        user.value = session.user
        
        // Only get broker info if user is a broker (not admin)
        if (session.user.app_metadata?.user_role === 'broker') {
          const { data: brokerData, error: brokerError } = await supabase
            .from('brokers')
            .select('*')
            .eq('user_id', session.user.id)
            .single()
          
          if (brokerError) {
            console.error('❌ Broker query error:', brokerError)
            console.log('User ID:', session.user.id)
            console.log('User email:', session.user.email)
          } else {
            console.log('✅ Broker data loaded:', brokerData)
          }
          
          broker.value = brokerData
        } else {
          broker.value = null
        }
      } else {
        user.value = null
        broker.value = null
      }
    } catch (error) {
      console.error('Auth check error:', error)
      user.value = null
      broker.value = null
    } finally {
      loading.value = false
    }
  }

  async function signIn(email, password) {
    loading.value = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (!error && data?.user) {
        user.value = data.user
        
        // Only get broker info if user is a broker (not admin)
        if (data.user.app_metadata?.user_role === 'broker') {
          const { data: brokerData } = await supabase
            .from('brokers')
            .select('*')
            .eq('user_id', data.user.id)
            .single()
          
          broker.value = brokerData
        } else {
          broker.value = null
        }
      }
      
      return { data, error }
    } catch (error) {
      return { data: null, error }
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      user.value = null
      broker.value = null
    }
    return { error }
  }

  // Wait for initial auth check to complete
  async function waitForInit() {
    if (initPromise) {
      await initPromise
    }
    return true
  }

  // Initialize only once
  if (!initialized) {
    initialized = true
    
    // Create initialization promise that resolves when session is loaded
    initPromise = (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          user.value = session.user
          await checkAuth()
        }
      } catch (error) {
        console.error('Initial auth check failed:', error)
      }
    })()
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        user.value = session.user
        checkAuth()
      } else if (event === 'USER_UPDATED' && session) {
        // Update user when metadata changes
        user.value = session.user
      } else if (event === 'SIGNED_OUT') {
        user.value = null
        broker.value = null
      }
    })
  }

  return {
    user,
    broker,
    loading,
    isAuthenticated,
    isAdmin,
    isBroker,
    signIn,
    signOut,
    checkAuth,
    waitForInit
  }
}

