/**
 * Fix Calculator Links - Replace full URLs with just tokens
 * 
 * This fixes the ~11 leads that got the full calculatorLink URL
 * and replaces it with just the calculatorToken
 */

const { createClient } = require('@supabase/supabase-js')

// Hardcoded credentials
const supabaseUrl = 'https://mxnqfwuhvurajrgoefyg.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bnFmd3VodnVyYWpyZ29lZnlnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg3NTc5MCwiZXhwIjoyMDc1NDUxNzkwfQ.fy5jKDCKo1nLiMEtEDeeJm9ijHj_iUf_vDeyqCFqNj4'
const instantlyApiKey = 'NTFjMDIzMWMtOTY0NS00NmMzLTk5MmEtZWM4OGI3ODIxMzZkOnVVdGdQcExvUnJRWA=='

const supabase = createClient(supabaseUrl, supabaseKey)
const INSTANTLY_API_BASE = 'https://api.instantly.ai/api/v2'

// The 11 leads that were already updated with full URLs
const leadsToFix = [
  'DRSUSAN@STANFORD.EDU',
  'CHECKMAIL531@GMAIL.COM',
  'HANNAHFAITHBENNETT@GMAIL.COM',
  'JAMESMORRONE@GMAIL.COM',
  '4155701091',
  'MICHAELMISERLIAN@GMAIL.COM',
  'FATFREE13@YAHOO.COM',
  'JODITOPITZ@GMAIL.COM',
  'CLAUDIACALIGAL@AOL.COM',
  'IAALONSO@YAHOO.COM',
  'CHARMT@MSN.COM'
]

async function fixCalculatorLinks() {
  console.log('🔧 Fixing calculator links to use tokens only...\n')

  // Get these leads from Supabase
  const { data: leads, error } = await supabase
    .from('leads')
    .select(`
      id,
      primary_email,
      calculator_tokens (
        token
      )
    `)
    .in('primary_email', leadsToFix)

  if (error) {
    console.error('❌ Error fetching leads:', error)
    process.exit(1)
  }

  console.log(`✅ Found ${leads.length} leads to fix\n`)

  let fixed = 0
  let errors = 0

  for (const lead of leads) {
    if (!lead.calculator_tokens || lead.calculator_tokens.length === 0) {
      console.log(`⚠️  Skipping ${lead.primary_email} - no token`)
      continue
    }

    const token = lead.calculator_tokens[0].token

    try {
      // Step 1: Find the lead in Instantly
      const listResponse = await fetch(`${INSTANTLY_API_BASE}/leads/list`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${instantlyApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: lead.primary_email
        })
      })

      const listData = await listResponse.json()
      
      if (!listData.items || listData.items.length === 0) {
        console.log(`⚠️  Skipping ${lead.primary_email} - not found in Instantly`)
        continue
      }

      const instantlyLeadId = listData.items[0].id

      // Step 2: Update with just the token (remove calculatorLink, add calculatorToken)
      const patchResponse = await fetch(`${INSTANTLY_API_BASE}/leads/${instantlyLeadId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${instantlyApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payload: {
            calculatorLink: null,  // Remove old full URL
            calculatorToken: token  // Add just the token
          }
        })
      })

      if (!patchResponse.ok) {
        const errorData = await patchResponse.json()
        console.error(`❌ Error fixing ${lead.primary_email}:`, errorData)
        errors++
        continue
      }

      console.log(`✅ Fixed ${lead.primary_email} - token: ${token}`)
      fixed++

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (err) {
      console.error(`❌ Error fixing ${lead.primary_email}:`, err.message)
      errors++
    }
  }

  console.log('\n📊 Fix Summary:')
  console.log(`   - Leads to fix: ${leads.length}`)
  console.log(`   - Fixed: ${fixed}`)
  console.log(`   - Errors: ${errors}`)
  console.log('\n✅ Done! Now run update-instantly-calculator-links.js for the rest.\n')
}

fixCalculatorLinks().catch(console.error)

