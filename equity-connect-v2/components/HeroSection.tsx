import React from 'react';
import { Persona, Neighborhood } from '../lib/supabase';

interface HeroSectionProps {
  persona: Persona;
  neighborhood: Neighborhood;
  leadFirstName?: string;
}

export default function HeroSection({ persona, neighborhood, leadFirstName }: HeroSectionProps) {
  const avgEquity = neighborhood.avg_equity_available 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(neighborhood.avg_equity_available)
    : '$450,000';

  return (
    <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{ 
          backgroundImage: 'radial-gradient(circle at 1px 1px, gray 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left column - Text content */}
          <div>
            {leadFirstName && (
              <div className="inline-block px-4 py-2 bg-blue-50 rounded-full mb-6">
                <p className="text-sm font-medium text-blue-700">
                  👋 Hi {leadFirstName}, this page was created just for you!
                </p>
              </div>
            )}
            
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              {persona.first_name} Helps {neighborhood.name} Homeowners Access Tax-Free Cash
            </h1>
            
            <p className="text-xl text-gray-600 mb-8">
              Trusted by <span className="font-semibold text-gray-900">{neighborhood.families_helped || 'dozens of'}</span> families in your neighborhood. 
              Unlock up to {avgEquity} from your home without monthly payments.
            </p>

            {/* Trust signals */}
            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
                <span className="text-2xl">⭐</span>
                <span className="text-sm font-medium">{persona.google_rating || '4.9/5'} Rating</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
                <span className="text-2xl">👥</span>
                <span className="text-sm font-medium">{persona.testimonial_count}+ Happy Families</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
                <span className="text-2xl">🏆</span>
                <span className="text-sm font-medium">{persona.years_in_business} Experience</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="#calculator" 
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white rounded-lg shadow-lg transition-all hover:scale-105"
                style={{ backgroundColor: persona.cultural_color_scheme }}
              >
                Calculate Your Equity
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
              <a 
                href="#schedule" 
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg shadow-sm hover:border-gray-400 transition-all"
              >
                Schedule a Call
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Right column - Persona image */}
          <div className="relative">
            <div className="relative z-10">
              {persona.professional_image_url ? (
                <img 
                  src={persona.professional_image_url} 
                  alt={persona.name}
                  className="rounded-2xl shadow-2xl"
                />
              ) : (
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-2xl p-12 text-center text-white">
                  <div className="text-8xl mb-4">👤</div>
                  <h3 className="text-3xl font-bold mb-2">{persona.name}</h3>
                  <p className="text-xl opacity-90">{persona.heritage} Specialist</p>
                </div>
              )}
            </div>
            
            {/* Decorative elements */}
            <div 
              className="absolute -bottom-4 -right-4 w-72 h-72 rounded-full opacity-20 blur-3xl"
              style={{ backgroundColor: persona.cultural_color_scheme }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

