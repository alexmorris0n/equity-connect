/**
 * Update Existing Instantly Leads with Calculator Links
 * 
 * Uses Instantly API v2 to update leads with calculatorLink custom variable
 * API Docs: https://developer.instantly.ai/api/v2/lead/patchlead
 */

const { createClient } = require('@supabase/supabase-js')
const fetch = require('node-fetch')
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const instantlyApiKey = 'NTFjMDIzMWMtOTY0NS00NmMzLTk5MmEtZWM4OGI3ODIxMzZkOnVVdGdQcExvUnJRWA=='

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const CALCULATOR_BASE_URL = 'https://equityconnect.com/calculator'
const INSTANTLY_API_BASE = 'https://api.instantly.ai/api/v2'

async function updateInstantlyLeads() {
  console.log('📊 Fetching leads with calculator tokens...\n')

  // Get all active leads with calculator tokens
  const { data: leads, error } = await supabase
    .from('leads')
    .select(`
      id,
      primary_email,
      first_name,
      last_name,
      property_address,
      property_city,
      property_state,
      property_value,
      estimated_equity,
      calculator_tokens (
        token,
        expires_at
      )
    `)
    .not('primary_email', 'is', null)
    .neq('primary_email', '')
    .eq('campaign_status', 'active')

  if (error) {
    console.error('❌ Error fetching leads:', error)
    process.exit(1)
  }

  console.log(`✅ Found ${leads.length} active leads\n`)

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const lead of leads) {
    // Skip if no token
    if (!lead.calculator_tokens || lead.calculator_tokens.length === 0) {
      console.log(`⚠️  Skipping ${lead.primary_email} - no token`)
      skipped++
      continue
    }

    const token = lead.calculator_tokens[0].token
    const expiresAt = new Date(lead.calculator_tokens[0].expires_at)
    
    // Skip expired
    if (expiresAt < new Date()) {
      console.log(`⚠️  Skipping ${lead.primary_email} - token expired`)
      skipped++
      continue
    }

    const calculatorLink = `${CALCULATOR_BASE_URL}?t=${token}`

    try {
      // Step 1: Find the lead in Instantly by email
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
      
      if (!listData.data || listData.data.length === 0) {
        console.log(`⚠️  Skipping ${lead.primary_email} - not found in Instantly`)
        skipped++
        continue
      }

      const instantlyLeadId = listData.data[0].id

      // Step 2: Update the lead with calculator link
      const patchResponse = await fetch(`${INSTANTLY_API_BASE}/leads/${instantlyLeadId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${instantlyApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payload: {
            calculatorLink: calculatorLink,
            propertyAddress: lead.property_address || '',
            propertyCity: lead.property_city || '',
            propertyState: lead.property_state || '',
            propertyValue: lead.property_value?.toString() || '',
            estimatedEquity: lead.estimated_equity?.toString() || ''
          }
        })
      })

      if (!patchResponse.ok) {
        const errorData = await patchResponse.json()
        console.error(`❌ Error updating ${lead.primary_email}:`, errorData)
        errors++
        continue
      }

      console.log(`✅ Updated ${lead.primary_email} - ${calculatorLink}`)
      updated++

      // Rate limit: 1 request per 200ms (2 API calls per lead)
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (err) {
      console.error(`❌ Error updating ${lead.primary_email}:`, err.message)
      errors++
    }
  }

  console.log('\n📊 Update Summary:')
  console.log(`   - Total leads: ${leads.length}`)
  console.log(`   - Updated: ${updated}`)
  console.log(`   - Skipped: ${skipped}`)
  console.log(`   - Errors: ${errors}`)
  console.log('\n✅ Done! Calculator links added to Instantly leads.\n')
}

updateInstantlyLeads().catch(console.error)

