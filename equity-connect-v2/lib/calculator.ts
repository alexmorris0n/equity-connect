/**
 * Reverse Mortgage Calculator Logic
 * Calculates estimated equity available based on age, home value, and existing mortgage
 */

export interface CalculatorInputs {
  homeValue: number;
  age: number;
  existingMortgage: number;
  zipCode?: string;
}

export interface CalculatorResults {
  estimatedEquity: number;
  lumpSum: number;
  lineOfCredit: number;
  tenurePayment: number;
  principalLimit: number;
  principalLimitFactor: number;
}

/**
 * Calculate Principal Limit Factor based on age
 * This is a simplified version - actual PLF tables are more complex
 */
function getPrincipalLimitFactor(age: number): number {
  // Simplified PLF based on age ranges
  // Real PLF tables consider interest rates, expected rates, and specific ages
  if (age < 62) return 0; // Not eligible
  if (age >= 62 && age < 65) return 0.488;
  if (age >= 65 && age < 70) return 0.515;
  if (age >= 70 && age < 75) return 0.560;
  if (age >= 75 && age < 80) return 0.608;
  if (age >= 80 && age < 85) return 0.652;
  if (age >= 85 && age < 90) return 0.689;
  return 0.720; // 90+
}

/**
 * Calculate reverse mortgage estimates
 */
export function calculateReverseMortgage(inputs: CalculatorInputs): CalculatorResults {
  const { homeValue, age, existingMortgage } = inputs;

  // Get principal limit factor
  const principalLimitFactor = getPrincipalLimitFactor(age);
  
  // Calculate principal limit (max borrowing capacity)
  const principalLimit = homeValue * principalLimitFactor;
  
  // Subtract existing mortgage and closing costs (estimated at 2% of home value)
  const closingCosts = homeValue * 0.02;
  const netAvailable = principalLimit - existingMortgage - closingCosts;
  
  // Ensure we don't return negative values
  const estimatedEquity = Math.max(0, netAvailable);
  
  // Calculate different payout options
  const lumpSum = estimatedEquity; // Full amount upfront
  const lineOfCredit = estimatedEquity; // Available as line of credit
  
  // Tenure payment (monthly for life) - simplified calculation
  // Using 300 months as life expectancy factor
  const tenurePayment = estimatedEquity / 300;
  
  return {
    estimatedEquity: Math.round(estimatedEquity),
    lumpSum: Math.round(lumpSum),
    lineOfCredit: Math.round(lineOfCredit),
    tenurePayment: Math.round(tenurePayment),
    principalLimit: Math.round(principalLimit),
    principalLimitFactor: Math.round(principalLimitFactor * 1000) / 1000
  };
}

/**
 * Validate calculator inputs
 */
export function validateInputs(inputs: CalculatorInputs): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (inputs.homeValue < 100000) {
    errors.push('Home value must be at least $100,000');
  }
  
  if (inputs.homeValue > 10000000) {
    errors.push('Home value exceeds maximum eligible amount');
  }
  
  if (inputs.age < 62) {
    errors.push('Must be at least 62 years old for reverse mortgage');
  }
  
  if (inputs.age > 120) {
    errors.push('Please enter a valid age');
  }
  
  if (inputs.existingMortgage < 0) {
    errors.push('Existing mortgage cannot be negative');
  }
  
  if (inputs.existingMortgage >= inputs.homeValue) {
    errors.push('Existing mortgage must be less than home value');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}

