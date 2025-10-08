/**
 * Seed Script: Add sample neighborhoods to the database
 * Run with: npx ts-node scripts/seed-neighborhoods.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mxnqfwuhvurajrgoefyg.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const sampleNeighborhoods = [
  {
    name: 'Hollywood',
    slug: 'hollywood',
    city: 'Los Angeles',
    state: 'CA',
    zip_codes: ['90028', '90038', '90046'],
    lat: 34.0928,
    lng: -118.3287,
    avg_home_value: 950000,
    appreciation_rate: 8.5,
    avg_equity_available: 480000,
    families_helped: 127,
    landmarks: [
      { name: 'Hollywood Sign', distance: '2 miles', type: 'landmark' },
      { name: 'Hollywood Bowl', distance: '1.5 miles', type: 'entertainment' },
      { name: 'Sunset Boulevard', distance: '0.5 miles', type: 'shopping' }
    ],
    demographics: {
      median_age: 68,
      home_ownership_rate: 72,
      cultural_diversity: 'high'
    },
    cultural_highlights: ['Historic theaters', 'Entertainment district', 'Diverse dining']
  },
  {
    name: 'Beverly Hills',
    slug: 'beverly-hills',
    city: 'Beverly Hills',
    state: 'CA',
    zip_codes: ['90210', '90211', '90212'],
    lat: 34.0736,
    lng: -118.4004,
    avg_home_value: 2500000,
    appreciation_rate: 10.2,
    avg_equity_available: 1250000,
    families_helped: 89,
    landmarks: [
      { name: 'Rodeo Drive', distance: '0.3 miles', type: 'shopping' },
      { name: 'Beverly Gardens Park', distance: '0.8 miles', type: 'park' },
      { name: 'Greystone Mansion', distance: '1.2 miles', type: 'landmark' }
    ],
    demographics: {
      median_age: 70,
      home_ownership_rate: 85,
      cultural_diversity: 'medium'
    },
    cultural_highlights: ['Luxury shopping', 'Fine dining', 'Upscale community']
  },
  {
    name: 'Santa Monica',
    slug: 'santa-monica',
    city: 'Santa Monica',
    state: 'CA',
    zip_codes: ['90401', '90402', '90403', '90404'],
    lat: 34.0195,
    lng: -118.4912,
    avg_home_value: 1400000,
    appreciation_rate: 9.1,
    avg_equity_available: 680000,
    families_helped: 156,
    landmarks: [
      { name: 'Santa Monica Pier', distance: '1 mile', type: 'entertainment' },
      { name: 'Third Street Promenade', distance: '0.7 miles', type: 'shopping' },
      { name: 'Palisades Park', distance: '0.9 miles', type: 'park' }
    ],
    demographics: {
      median_age: 67,
      home_ownership_rate: 68,
      cultural_diversity: 'high'
    },
    cultural_highlights: ['Beach lifestyle', 'Health-conscious community', 'Arts & culture']
  },
  {
    name: 'Pasadena',
    slug: 'pasadena',
    city: 'Pasadena',
    state: 'CA',
    zip_codes: ['91101', '91103', '91104', '91105'],
    lat: 34.1478,
    lng: -118.1445,
    avg_home_value: 850000,
    appreciation_rate: 7.8,
    avg_equity_available: 425000,
    families_helped: 203,
    landmarks: [
      { name: 'Rose Bowl', distance: '2 miles', type: 'sports' },
      { name: 'Old Pasadena', distance: '0.5 miles', type: 'shopping' },
      { name: 'Huntington Library', distance: '3 miles', type: 'cultural' }
    ],
    demographics: {
      median_age: 69,
      home_ownership_rate: 75,
      cultural_diversity: 'very high'
    },
    cultural_highlights: ['Historic district', 'Cultural institutions', 'Diverse community']
  },
  {
    name: 'Long Beach',
    slug: 'long-beach',
    city: 'Long Beach',
    state: 'CA',
    zip_codes: ['90802', '90803', '90804', '90805'],
    lat: 33.7701,
    lng: -118.1937,
    avg_home_value: 720000,
    appreciation_rate: 8.9,
    avg_equity_available: 380000,
    families_helped: 178,
    landmarks: [
      { name: 'Queen Mary', distance: '2 miles', type: 'landmark' },
      { name: 'Aquarium of the Pacific', distance: '1.5 miles', type: 'entertainment' },
      { name: 'Belmont Shore', distance: '1 mile', type: 'beach' }
    ],
    demographics: {
      median_age: 66,
      home_ownership_rate: 65,
      cultural_diversity: 'very high'
    },
    cultural_highlights: ['Waterfront living', 'Multi-cultural', 'Active lifestyle']
  }
];

async function seedNeighborhoods() {
  console.log('🌱 Seeding neighborhoods...');

  try {
    // Insert neighborhoods
    const { data, error } = await supabase
      .from('neighborhoods')
      .upsert(sampleNeighborhoods, { 
        onConflict: 'slug',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('❌ Error seeding neighborhoods:', error);
      throw error;
    }

    console.log(`✅ Successfully seeded ${data?.length || 0} neighborhoods:`);
    data?.forEach(n => {
      console.log(`   - ${n.name}, ${n.state} (${n.slug})`);
    });

    // Display some stats
    const { data: stats } = await supabase
      .from('neighborhoods')
      .select('id, name, families_helped, avg_home_value')
      .eq('active', true);

    console.log('\n📊 Neighborhood Stats:');
    stats?.forEach(s => {
      const avgValue = new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        maximumFractionDigits: 0 
      }).format(s.avg_home_value);
      console.log(`   ${s.name}: ${s.families_helped} families helped, avg value ${avgValue}`);
    });

    console.log('\n✅ Seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seed function
seedNeighborhoods();

