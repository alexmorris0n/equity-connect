/**
 * Number Formatter Utilities
 * 
 * Converts numbers to words to prevent TTS pitch changes in OpenAI Realtime.
 * Per Barbara's prompt: "NEVER say digits" - causes voice pitch variations.
 */

/**
 * Convert number to words (0-999)
 * @param {number} num - Number to convert
 * @returns {string} - Number in words
 */
function numberToWords(num) {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  
  if (num === 0) return 'zero';
  if (num < 10) return ones[num];
  if (num >= 10 && num < 20) return teens[num - 10];
  if (num >= 20 && num < 100) {
    return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
  }
  if (num >= 100 && num < 1000) {
    return ones[Math.floor(num / 100)] + ' hundred' + (num % 100 !== 0 ? ' ' + numberToWords(num % 100) : '');
  }
  return num.toString();
}

/**
 * Format currency amount as words
 * Examples:
 *   750000 → "seven hundred fifty thousand"
 *   1500000 → "one point five million"
 *   2500000 → "two point five million"
 * 
 * @param {number} amount - Dollar amount
 * @returns {string} - Amount in words
 */
function formatCurrency(amount) {
  if (!amount || isNaN(amount)) return 'zero';
  
  const absAmount = Math.abs(amount);
  
  // Handle millions (simplified format for TTS)
  if (absAmount >= 1000000) {
    const millions = absAmount / 1000000;
    if (millions % 1 === 0) {
      return numberToWords(millions) + ' million';
    }
    // Use decimal notation for clarity
    const wholeMil = Math.floor(millions);
    const decimal = Math.round((millions - wholeMil) * 10);
    if (decimal === 0) {
      return numberToWords(wholeMil) + ' million';
    }
    return numberToWords(wholeMil) + ' point ' + numberToWords(decimal) + ' million';
  }
  
  // Handle thousands
  if (absAmount >= 1000) {
    const thousands = absAmount / 1000;
    if (thousands % 1 === 0) {
      return numberToWords(thousands) + ' thousand';
    }
    // Use "K" notation for round numbers
    const wholeK = Math.floor(thousands);
    const remainder = absAmount % 1000;
    if (remainder === 0) {
      return numberToWords(wholeK) + ' thousand';
    }
    // For non-round, use full words
    const hundreds = Math.floor(remainder / 100);
    if (hundreds > 0 && remainder % 100 === 0) {
      return numberToWords(wholeK) + ' thousand ' + numberToWords(hundreds) + ' hundred';
    }
    return numberToWords(wholeK) + ' thousand ' + numberToWords(remainder);
  }
  
  // Handle regular numbers
  return numberToWords(absAmount);
}

/**
 * Format phone number for natural speech
 * Example: "+14155556565" → "four one five, five five five, six five six five"
 * 
 * @param {string} phone - Phone number in E.164 or any format
 * @returns {string} - Phone number grouped for speech
 */
function formatPhone(phone) {
  if (!phone) return '';
  
  // Strip everything except digits
  const digits = phone.replace(/\D/g, '');
  
  // For US numbers (10 or 11 digits)
  if (digits.length === 10 || digits.length === 11) {
    const start = digits.length === 11 ? 1 : 0; // Skip country code if present
    const area = digits.slice(start, start + 3);
    const prefix = digits.slice(start + 3, start + 6);
    const line = digits.slice(start + 6);
    
    return `${digitGroupToWords(area)}, ${digitGroupToWords(prefix)}, ${digitGroupToWords(line)}`;
  }
  
  // For other lengths, just group every 3-4 digits
  return digitGroupToWords(digits);
}

/**
 * Convert digit group to individual words
 * Example: "415" → "four one five"
 */
function digitGroupToWords(digitStr) {
  const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  return digitStr.split('').map(d => ones[parseInt(d)]).join(' ');
}

/**
 * Format percentage as words
 * Example: 50 → "fifty percent"
 * 
 * @param {number} percent - Percentage value
 * @returns {string} - Percentage in words
 */
function formatPercent(percent) {
  if (!percent || isNaN(percent)) return 'zero percent';
  return numberToWords(Math.round(percent)) + ' percent';
}

/**
 * Format address for natural speech
 * Example: "1234 Jump Off St" → "twelve thirty-four Jump Off Street"
 * 
 * @param {string} address - Street address
 * @returns {string} - Address formatted for speech
 */
function formatAddress(address) {
  if (!address) return '';
  
  // Replace common abbreviations
  let formatted = address
    .replace(/\bSt\.?\b/gi, 'Street')
    .replace(/\bAve\.?\b/gi, 'Avenue')
    .replace(/\bBlvd\.?\b/gi, 'Boulevard')
    .replace(/\bDr\.?\b/gi, 'Drive')
    .replace(/\bRd\.?\b/gi, 'Road')
    .replace(/\bLn\.?\b/gi, 'Lane')
    .replace(/\bCt\.?\b/gi, 'Court')
    .replace(/\bPl\.?\b/gi, 'Place');
  
  // Convert leading numbers to words
  formatted = formatted.replace(/^(\d+)\s/, (match, num) => {
    const n = parseInt(num);
    if (n < 10000) {
      return numberToWords(n) + ' ';
    }
    // For large numbers, break into groups
    const thousands = Math.floor(n / 1000);
    const remainder = n % 1000;
    if (remainder === 0) {
      return numberToWords(thousands) + ' thousand ';
    }
    return numberToWords(thousands) + ' ' + numberToWords(remainder) + ' ';
  });
  
  return formatted;
}

/**
 * Calculate and format equity range (50-60%)
 * Returns object with formatted strings
 * 
 * @param {number} equity - Total equity amount
 * @returns {object} - {min, max, range}
 */
function formatEquityRange(equity) {
  if (!equity || isNaN(equity)) {
    return {
      equity: 'zero',
      min: 'zero',
      max: 'zero',
      range: 'zero to zero'
    };
  }
  
  const min = Math.round(equity * 0.5);
  const max = Math.round(equity * 0.6);
  
  return {
    equity: formatCurrency(equity),
    min: formatCurrency(min),
    max: formatCurrency(max),
    range: `${formatCurrency(min)} to ${formatCurrency(max)}`
  };
}

/**
 * Format variable values for OpenAI Realtime session
 * Converts all numbers to words to prevent TTS issues
 * 
 * @param {object} lead - Lead data from Supabase
 * @param {object} broker - Broker data from Supabase
 * @returns {object} - Formatted context variables
 */
function formatCallContext(lead, broker) {
  const context = {
    leadName: lead.first_name || 'there',
    leadFullName: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'the homeowner',
    brokerFullName: broker?.contact_name || 'your advisor',
    brokerFirstName: broker?.contact_name?.split(' ')[0] || 'your advisor',
    personaFirstName: '', // Deprecated per schema
    propertyCity: lead.property_city || '',
    propertyAddress: lead.property_address ? formatAddress(lead.property_address) : '',
    homeValueWords: '',
    mortgageBalanceWords: '',
    equityWords: '',
    potentialAccessRange: ''
  };
  
  // Format financial numbers
  if (lead.property_value) {
    context.homeValueWords = formatCurrency(lead.property_value);
  }
  
  // Calculate equity if we have home value
  if (lead.property_value) {
    const mortgageBalance = lead.mortgage_balance || 0;
    const equity = lead.property_value - mortgageBalance;
    
    if (mortgageBalance > 0) {
      context.mortgageBalanceWords = formatCurrency(mortgageBalance);
    } else {
      context.mortgageBalanceWords = 'paid off';
    }
    
    const equityRange = formatEquityRange(equity);
    context.equityWords = equityRange.equity;
    context.potentialAccessRange = equityRange.range;
  }
  
  return context;
}

module.exports = {
  formatCurrency,
  formatPhone,
  formatPercent,
  formatAddress,
  formatEquityRange,
  formatCallContext,
  numberToWords
};

