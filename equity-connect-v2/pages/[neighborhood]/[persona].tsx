import React from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { supabase, Persona, Neighborhood, Lead } from '../../lib/supabase';
import HeroSection from '../../components/HeroSection';
import CalculatorSection from '../../components/CalculatorSection';
import TrustSection from '../../components/TrustSection';
import ScheduleSection from '../../components/ScheduleSection';

interface MicrositPageProps {
  persona: Persona;
  neighborhood: Neighborhood;
  lead?: Lead | null;
  micrositeId?: string;
}

export default function MicrositePage({ persona, neighborhood, lead, micrositeId }: MicrositPageProps) {
  // Track page view
  React.useEffect(() => {
    if (micrositeId) {
      fetch('/api/microsites/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ micrositeId, event: 'page_view' })
      });
    }
  }, [micrositeId]);

  const avgEquity = neighborhood.avg_equity_available 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(neighborhood.avg_equity_available)
    : '$450,000';

  const seoTitle = `${persona.name} - ${neighborhood.name} Reverse Mortgage Specialist`;
  const seoDescription = `Unlock up to ${avgEquity} from your ${neighborhood.name} home. Trusted by ${neighborhood.families_helped || 'dozens of'} families since 2020.`;

  return (
    <>
      <Head>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Open Graph */}
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:type" content="website" />
        {persona.og_image_url && <meta property="og:image" content={persona.og_image_url} />}
        
        {/* Keywords */}
        <meta name="keywords" content={`reverse mortgage, ${neighborhood.name}, home equity, ${persona.heritage} families, ${persona.first_name}`} />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen">
        {/* Hero Section */}
        <HeroSection 
          persona={persona} 
          neighborhood={neighborhood}
          leadFirstName={lead?.first_name || undefined}
        />

        {/* Trust Section */}
        <TrustSection persona={persona} />

        {/* Calculator Section */}
        <CalculatorSection 
          persona={persona}
          defaultValues={{
            homeValue: lead?.property_value || neighborhood.avg_home_value || 500000,
            age: lead?.age || 70,
            existingMortgage: 0,
            zipCode: lead?.property_zip || neighborhood.zip_codes?.[0] || ''
          }}
          onCalculate={(results) => {
            if (micrositeId) {
              fetch('/api/microsites/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ micrositeId, event: 'calculator_completed', data: results })
              });
            }
          }}
        />

        {/* Schedule Section */}
        <ScheduleSection 
          persona={persona}
          leadId={lead?.id}
          onSchedule={(data) => {
            if (micrositeId) {
              fetch('/api/microsites/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ micrositeId, event: 'form_submitted', data })
              });
            }
          }}
        />

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-xl font-bold mb-4">{persona.name}</h3>
                <p className="text-gray-400">
                  Helping {neighborhood.name} families unlock their home equity since 2010
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Contact</h4>
                <p className="text-gray-400">Licensed Reverse Mortgage Specialist</p>
                <p className="text-gray-400">NMLS #123456</p>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Legal</h4>
                <p className="text-sm text-gray-400">
                  Reverse mortgages are complex products with important considerations. 
                  Please consult with a licensed professional before making any decisions.
                </p>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
              <p>&copy; {new Date().getFullYear()} Equity Connect. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { neighborhood: neighborhoodSlug, persona: personaId } = context.query;
  const { lead_id } = context.query; // Optional lead_id from URL params

  try {
    // Fetch persona
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .eq('active', true)
      .single();

    if (personaError || !persona) {
      return { notFound: true };
    }

    // Fetch neighborhood
    const { data: neighborhood, error: neighborhoodError } = await supabase
      .from('neighborhoods')
      .select('*')
      .eq('slug', neighborhoodSlug)
      .eq('active', true)
      .single();

    if (neighborhoodError || !neighborhood) {
      return { notFound: true };
    }

    // Optionally fetch lead data if lead_id is provided
    let lead = null;
    if (lead_id) {
      const { data: leadData } = await supabase
        .from('leads')
        .select('*')
        .eq('id', lead_id)
        .single();
      
      lead = leadData;
    }

    // Check if microsite record exists, if not create it
    let micrositeId = null;
    const { data: existingMicrosite } = await supabase
      .from('microsites')
      .select('id')
      .eq('persona_id', personaId)
      .eq('neighborhood_id', neighborhood.id)
      .maybeSingle();

    if (existingMicrosite) {
      micrositeId = existingMicrosite.id;
    }

    return {
      props: {
        persona,
        neighborhood,
        lead,
        micrositeId
      }
    };
  } catch (error) {
    console.error('Error fetching microsite data:', error);
    return { notFound: true };
  }
};

