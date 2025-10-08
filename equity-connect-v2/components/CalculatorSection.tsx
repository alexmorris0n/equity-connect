import React, { useState } from 'react';
import { calculateReverseMortgage, validateInputs, formatCurrency, CalculatorInputs } from '../lib/calculator';
import { Persona } from '../lib/supabase';

interface CalculatorSectionProps {
  persona: Persona;
  defaultValues?: Partial<CalculatorInputs>;
  onCalculate?: (results: any) => void;
}

export default function CalculatorSection({ persona, defaultValues, onCalculate }: CalculatorSectionProps) {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    homeValue: defaultValues?.homeValue || 500000,
    age: defaultValues?.age || 70,
    existingMortgage: defaultValues?.existingMortgage || 0,
    zipCode: defaultValues?.zipCode || ''
  });
  
  const [results, setResults] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleCalculate = () => {
    const validation = validateInputs(inputs);
    
    if (!validation.valid) {
      setErrors(validation.errors);
      setShowResults(false);
      return;
    }
    
    setErrors([]);
    const calculatedResults = calculateReverseMortgage(inputs);
    setResults(calculatedResults);
    setShowResults(true);
    
    if (onCalculate) {
      onCalculate(calculatedResults);
    }
  };

  return (
    <div id="calculator" className="py-16 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Calculate Your Available Equity
          </h2>
          <p className="text-lg text-gray-600">
            Get an instant estimate of how much tax-free cash you can access from your home
          </p>
        </div>

        <div className="bg-gray-50 rounded-2xl shadow-lg p-8">
          {/* Calculator inputs */}
          <div className="space-y-6 mb-8">
            {/* Home Value */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Home Value
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
                <input
                  type="number"
                  value={inputs.homeValue}
                  onChange={(e) => setInputs({ ...inputs, homeValue: parseInt(e.target.value) || 0 })}
                  className="w-full pl-8 pr-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="500000"
                />
              </div>
            </div>

            {/* Age */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Age (Must be 62+)
              </label>
              <input
                type="number"
                value={inputs.age}
                onChange={(e) => setInputs({ ...inputs, age: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="70"
              />
            </div>

            {/* Existing Mortgage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Existing Mortgage Balance (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
                <input
                  type="number"
                  value={inputs.existingMortgage}
                  onChange={(e) => setInputs({ ...inputs, existingMortgage: parseInt(e.target.value) || 0 })}
                  className="w-full pl-8 pr-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Zip Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ZIP Code
              </label>
              <input
                type="text"
                value={inputs.zipCode}
                onChange={(e) => setInputs({ ...inputs, zipCode: e.target.value })}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="90210"
                maxLength={5}
              />
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <ul className="list-disc list-inside text-red-700">
                {errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Calculate button */}
          <button
            onClick={handleCalculate}
            className="w-full py-4 text-lg font-semibold text-white rounded-lg shadow-lg transition-all hover:scale-105"
            style={{ backgroundColor: persona.cultural_color_scheme }}
          >
            Calculate My Equity
          </button>

          {/* Results */}
          {showResults && results && (
            <div className="mt-8 p-6 bg-white rounded-lg border-2 border-green-200">
              <div className="text-center mb-6">
                <p className="text-sm text-gray-600 mb-2">Estimated Equity Available</p>
                <p className="text-5xl font-bold text-green-600">
                  {formatCurrency(results.estimatedEquity)}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Lump Sum</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatCurrency(results.lumpSum)}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Line of Credit</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatCurrency(results.lineOfCredit)}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Monthly Payment</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatCurrency(results.tenurePayment)}
                  </p>
                </div>
              </div>

              <div className="mt-6 text-center">
                <a 
                  href="#schedule" 
                  className="inline-flex items-center justify-center px-6 py-3 text-white font-semibold rounded-lg transition-all hover:scale-105"
                  style={{ backgroundColor: persona.cultural_color_scheme }}
                >
                  Schedule Your Free Consultation
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>

              <p className="mt-4 text-xs text-gray-500 text-center">
                * This is an estimate only. Actual amounts may vary based on current interest rates and home appraisal.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

