import React from 'react';
import { Persona } from '../lib/supabase';

interface TrustSectionProps {
  persona: Persona;
}

export default function TrustSection({ persona }: TrustSectionProps) {
  return (
    <div className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Why Families Trust {persona.first_name}
          </h2>
          <p className="text-lg text-gray-600">
            Licensed, certified, and committed to helping families like yours
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Licenses & Credentials */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Licensed & Insured</h3>
            <p className="text-sm text-gray-600">
              NMLS Licensed • CA DRE Certified
            </p>
          </div>

          {/* Experience */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{persona.years_in_business}</h3>
            <p className="text-sm text-gray-600">
              Helping families access home equity
            </p>
          </div>

          {/* Community */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Community Member</h3>
            <p className="text-sm text-gray-600">
              {persona.cultural_organization || 'Active in local community'}
            </p>
          </div>

          {/* Reviews */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{persona.google_rating}</h3>
            <p className="text-sm text-gray-600">
              {persona.testimonial_count}+ happy families helped
            </p>
          </div>
        </div>

        {/* Trust builders */}
        {persona.trust_builders && persona.trust_builders.length > 0 && (
          <div className="mt-12 max-w-3xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full" style={{ backgroundColor: persona.cultural_color_scheme + '20' }}>
                    <div className="w-12 h-12 flex items-center justify-center text-2xl">💬</div>
                  </div>
                </div>
                <div>
                  <blockquote className="text-gray-700 italic mb-4">
                    "{persona.trust_builders[0]}"
                  </blockquote>
                  <p className="font-semibold text-gray-900">— {persona.name}</p>
                  <p className="text-sm text-gray-600">{persona.heritage} Reverse Mortgage Specialist</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

