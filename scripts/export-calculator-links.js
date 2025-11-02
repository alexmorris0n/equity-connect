/**
 * Export Calculator Links for Instantly
 * 
 * This script exports all leads with their personalized calculator links
 * in a format ready for Instantly CSV upload
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Your domain for calculator links
const CALCULATOR_BASE_URL = 'https://equityconnect.com/calculator'

async function exportForInstantly() {
  console.log('📊 Fetching leads with calculator tokens...\n')

  // Query leads with tokens
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
      property_zip,
      property_value,
      estimated_equity,
      calculator_tokens (
        token,
        expires_at
      )
    `)
    .not('primary_email', 'is', null)
    .neq('primary_email', '')

  if (error) {
    console.error('❌ Error fetching leads:', error)
    process.exit(1)
  }

  console.log(`✅ Found ${leads.length} leads with emails\n`)

  // Format for Instantly CSV
  const csvRows = []
  
  // Header row (Instantly format)
  csvRows.push([
    'email',
    'firstName',
    'lastName',
    'calculatorLink',
    'propertyAddress',
    'propertyCity',
    'propertyState',
    'propertyValue',
    'estimatedEquity'
  ].join(','))

  let validLeads = 0
  let missingTokens = 0

  leads.forEach(lead => {
    // Check if lead has a valid token
    if (!lead.calculator_tokens || lead.calculator_tokens.length === 0) {
      missingTokens++
      return
    }

    const token = lead.calculator_tokens[0].token
    const expiresAt = new Date(lead.calculator_tokens[0].expires_at)
    
    // Skip expired tokens
    if (expiresAt < new Date()) {
      return
    }

    const calculatorLink = `${CALCULATOR_BASE_URL}?t=${token}`
    
    // Format values (escape commas and quotes)
    const formatValue = (val) => {
      if (val === null || val === undefined) return ''
      const str = String(val)
      // Escape quotes and wrap in quotes if contains comma
      if (str.includes(',') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    csvRows.push([
      formatValue(lead.primary_email),
      formatValue(lead.first_name),
      formatValue(lead.last_name),
      formatValue(calculatorLink),
      formatValue(lead.property_address),
      formatValue(lead.property_city),
      formatValue(lead.property_state),
      formatValue(lead.property_value),
      formatValue(lead.estimated_equity)
    ].join(','))

    validLeads++
  })

  // Write CSV file
  const outputPath = path.join(__dirname, '..', 'instantly-calculator-links.csv')
  fs.writeFileSync(outputPath, csvRows.join('\n'))

  console.log('✅ Export Summary:')
  console.log(`   - Total leads: ${leads.length}`)
  console.log(`   - Valid calculator links: ${validLeads}`)
  console.log(`   - Missing tokens: ${missingTokens}`)
  console.log(`\n📄 CSV saved to: ${outputPath}\n`)
  console.log('📤 Next steps:')
  console.log('   1. Go to Instantly.ai')
  console.log('   2. Upload this CSV to your campaign')
  console.log('   3. Use {{calculatorLink}} in your email template')
  console.log('   4. Use {{firstName}}, {{propertyAddress}}, etc.\n')
}

exportForInstantly().catch(console.error)

