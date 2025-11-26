import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

const user = ref(null)
const userProfile = ref(null)
const broker = ref(null)
const loading = ref(false)
let initialized = false
let initPromise = null

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => userProfile.value?.role === 'admin')
  const isBroker = computed(() => userProfile.value?.role === 'broker')

  async function checkAuth() {
    if (loading.value) return // Prevent concurrent calls
    
    loading.value = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        user.value = session.user
        
        // Fetch user profile from user_profiles table
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
        
        if (profileError) {
          console.error('❌ User profile query error:', profileError)
          userProfile.value = null
        } else {
          console.log('✅ User profile loaded:', profileData)
          userProfile.value = profileData
        }
        
        // Get broker info if user is a broker
        if (profileData?.role === 'broker' && profileData?.broker_id) {
          const { data: brokerData, error: brokerError } = await supabase
            .from('brokers')
            .select('*')
            .eq('id', profileData.broker_id)
            .single()
          
          if (brokerError) {
            console.error('❌ Broker query error:', brokerError)
          } else {
            console.log('✅ Broker data loaded:', brokerData)
          }
          
          broker.value = brokerData
        } else {
          broker.value = null
        }
      } else {
        user.value = null
        userProfile.value = null
        broker.value = null
      }
    } catch (error) {
      console.error('Auth check error:', error)
      user.value = null
      userProfile.value = null
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
        
        // Fetch user profile from user_profiles table
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .single()
        
        userProfile.value = profileData
        
        // Get broker info if user is a broker
        if (profileData?.role === 'broker' && profileData?.broker_id) {
          const { data: brokerData } = await supabase
            .from('brokers')
            .select('*')
            .eq('id', profileData.broker_id)
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
      userProfile.value = null
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
        userProfile.value = null
        broker.value = null
      }
    })
  }

  return {
    user,
    userProfile,
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

