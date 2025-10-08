import React, { useState } from 'react';
import { Persona } from '../lib/supabase';

interface ScheduleSectionProps {
  persona: Persona;
  leadId?: string;
  onSchedule?: (data: any) => void;
}

export default function ScheduleSection({ persona, leadId, onSchedule }: ScheduleSectionProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    preferredTime: '',
    message: ''
  });
  
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Submit form data
      const response = await fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          persona_id: persona.id,
          lead_id: leadId,
          form_type: 'schedule'
        })
      });

      if (response.ok) {
        setSubmitted(true);
        if (onSchedule) {
          onSchedule(formData);
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div id="schedule" className="py-16 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-green-50 rounded-2xl p-12">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Thank You!
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              {persona.first_name} will contact you shortly to schedule your free consultation.
            </p>
            <p className="text-sm text-gray-500">
              Check your email for confirmation details.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="schedule" className="py-16 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Schedule Your Free Consultation
          </h2>
          <p className="text-lg text-gray-600">
            Speak with {persona.first_name} personally • No obligation • 100% confidential
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left column - Form */}
          <div className="bg-gray-50 rounded-2xl p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Time
                </label>
                <select
                  value={formData.preferredTime}
                  onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a time</option>
                  <option value="morning">Morning (9am - 12pm)</option>
                  <option value="afternoon">Afternoon (12pm - 5pm)</option>
                  <option value="evening">Evening (5pm - 7pm)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message (Optional)
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Tell us briefly about your situation..."
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 text-lg font-semibold text-white rounded-lg shadow-lg transition-all hover:scale-105 disabled:opacity-50"
                style={{ backgroundColor: persona.cultural_color_scheme }}
              >
                {loading ? 'Submitting...' : 'Schedule My Free Consultation'}
              </button>

              <p className="text-xs text-gray-500 text-center">
                By submitting, you agree to receive calls/texts. No spam, unsubscribe anytime.
              </p>
            </form>
          </div>

          {/* Right column - Benefits */}
          <div className="flex flex-col justify-center space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: persona.cultural_color_scheme + '20' }}>
                <svg className="w-6 h-6" style={{ color: persona.cultural_color_scheme }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Free Consultation</h3>
                <p className="text-gray-600">No cost, no obligation. Just honest advice.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: persona.cultural_color_scheme + '20' }}>
                <svg className="w-6 h-6" style={{ color: persona.cultural_color_scheme }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">100% Confidential</h3>
                <p className="text-gray-600">Your information is secure and private.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: persona.cultural_color_scheme + '20' }}>
                <svg className="w-6 h-6" style={{ color: persona.cultural_color_scheme }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Flexible Scheduling</h3>
                <p className="text-gray-600">We work around your schedule.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: persona.cultural_color_scheme + '20' }}>
                <svg className="w-6 h-6" style={{ color: persona.cultural_color_scheme }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {persona.primary_language === 'Spanish' ? 'Hablamos Español' : 'Clear Communication'}
                </h3>
                <p className="text-gray-600">
                  {persona.primary_language === 'Spanish' 
                    ? 'Comfortable consultation in Spanish or English' 
                    : 'We explain everything in plain language'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

