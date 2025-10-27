import { createClient } from '@supabase/supabase-js'

// NUCLEAR OPTION: Hardcode the correct URL temporarily to bypass cache
const supabaseUrl = 'https://mxnqfwuhvurajrgoefyg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bnFmd3VodnVyYWpyZ29lZnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzU3OTAsImV4cCI6MjA3NTQ1MTc5MH0.QMoZAjIKkB05Vr9nM1FKbC2ke5RTvfv6zrSDU0QMuN4'

console.log('🔍 HARDCODED Supabase URL:', supabaseUrl)

// Clear any cached Supabase sessions
if (typeof window !== 'undefined') {
  Object.keys(localStorage).forEach(key => {
    if (key.includes('supabase') || key.includes('bgjtuucppvjnnphntwyg')) {
      console.log('🧹 Clearing cached key:', key)
      localStorage.removeItem(key)
    }
  })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})

