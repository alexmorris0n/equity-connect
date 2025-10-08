/**
 * Test Script: Create a test lead and microsite
 * Run with: npx ts-node scripts/test-microsite.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mxnqfwuhvurajrgoefyg.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMicrositeCreation() {
  console.log('🧪 Testing microsite creation...\n');

  try {
    // Step 1: Create a test lead
    console.log('1️⃣  Creating test lead...');
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        first_name: 'Maria',
        last_name: 'Gonzalez',
        email: 'maria.gonzalez@example.com',
        phone: '(555) 123-4567',
        property_address: '123 Sunset Blvd, Hollywood, CA 90028',
        property_city: 'Los Angeles',
        property_state: 'CA',
        property_zip: '90028',
        property_value: 850000,
        estimated_equity: 425000,
        age: 68,
        source: 'Test Script',
        status: 'new'
      })
      .select()
      .single();

    if (leadError) {
      throw new Error(`Failed to create lead: ${leadError.message}`);
    }

    console.log(`✅ Test lead created: ${lead.id}`);
    console.log(`   Name: ${lead.first_name} ${lead.last_name}`);
    console.log(`   Property: ${lead.property_address}\n`);

    // Step 2: Get a persona
    console.log('2️⃣  Fetching persona...');
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', 'carlos_maria_rodriguez')
      .single();

    if (personaError || !persona) {
      throw new Error('Persona not found');
    }

    console.log(`✅ Using persona: ${persona.name}`);
    console.log(`   Heritage: ${persona.heritage}\n`);

    // Step 3: Get neighborhood
    console.log('3️⃣  Fetching neighborhood...');
    const { data: neighborhood, error: neighborhoodError } = await supabase
      .from('neighborhoods')
      .select('*')
      .eq('slug', 'hollywood')
      .single();

    if (neighborhoodError || !neighborhood) {
      throw new Error('Neighborhood not found. Run seed-neighborhoods.ts first!');
    }

    console.log(`✅ Using neighborhood: ${neighborhood.name}`);
    console.log(`   Avg Home Value: $${neighborhood.avg_home_value?.toLocaleString()}\n`);

    // Step 4: Create microsite
    console.log('4️⃣  Creating microsite...');
    const subdomain = `${neighborhood.slug}-${persona.id}`;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const micrositeUrl = `${baseUrl}/${neighborhood.slug}/${persona.id}?lead_id=${lead.id}`;

    const { data: microsite, error: micrositeError } = await supabase
      .from('microsites')
      .insert({
        lead_id: lead.id,
        subdomain: subdomain,
        full_url: micrositeUrl,
        persona: persona.name,
        neighborhood: neighborhood.name,
        persona_id: persona.id,
        neighborhood_id: neighborhood.id,
        deployment_status: 'deployed'
      })
      .select()
      .single();

    if (micrositeError) {
      throw new Error(`Failed to create microsite: ${micrositeError.message}`);
    }

    console.log(`✅ Microsite created: ${microsite.id}`);
    console.log(`   URL: ${micrositeUrl}\n`);

    // Step 5: Update lead with microsite URL
    console.log('5️⃣  Updating lead...');
    await supabase
      .from('leads')
      .update({
        microsite_url: micrositeUrl,
        assigned_persona: persona.id,
        persona_heritage: persona.heritage
      })
      .eq('id', lead.id);

    console.log(`✅ Lead updated with microsite URL\n`);

    // Summary
    console.log('🎉 Test Complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Lead ID:        ${lead.id}`);
    console.log(`Lead Name:      ${lead.first_name} ${lead.last_name}`);
    console.log(`Persona:        ${persona.name}`);
    console.log(`Neighborhood:   ${neighborhood.name}`);
    console.log(`Microsite ID:   ${microsite.id}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log('🌐 View the microsite at:');
    console.log(`   ${micrositeUrl}\n`);
    console.log('💡 Next steps:');
    console.log('   1. Start dev server: npm run dev');
    console.log('   2. Open the URL above in your browser');
    console.log('   3. Test calculator and form submission\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMicrositeCreation();

