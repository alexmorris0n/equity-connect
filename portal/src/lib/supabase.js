import { createClient } from '@supabase/supabase-js'

// FORCE the correct URL - bypassing all env variables for debugging
const supabaseUrl = 'https://mxnqfwuhvurajrgoefyg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bnFmd3VodnVyYWpyZ29lZnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzU3OTAsImV4cCI6MjA3NTQ1MTc5MH0.QMoZAjIKkB05Vr9nM1FKbC2ke5RTvfv6zrSDU0QMuN4'

console.log('🔍 ENV VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('✅ HARDCODED Using:', supabaseUrl)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
    storageKey: 'sb-auth-token',
    detectSessionInUrl: true,
  }
})

