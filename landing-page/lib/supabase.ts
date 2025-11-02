import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://mxnqfwuhvurajrgoefyg.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bnFmd3VodnVyYWpyZ29lZnlnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg3NTc5MCwiZXhwIjoyMDc1NDUxNzkwfQ.fy5jKDCKo1nLiMEtEDeeJm9ijHj_iUf_vDeyqCFqNj4'

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Key is missing. Calculator features may not work.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

