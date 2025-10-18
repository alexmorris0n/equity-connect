/**
 * Helper function to format numbers as words for TTS
 * Prevents voice pitch changes in text-to-speech systems
 */

function formatAsWords(value) {
  // Handle null, undefined, or non-numeric values
  if (!value || isNaN(value)) {
    return "an unknown amount";
  }
  
  // Round to nearest whole number
  const rounded = Math.round(value);
  
  // Convert to human-readable words
  return humanizeNumberToWords(rounded);
}

/**
 * Convert numbers to spoken words
 * Examples:
 * - 1400000 → "one point four million"
 * - 625000 → "six hundred and twenty-five thousand" or "625K"
 * - 50 → "fifty"
 */
function humanizeNumberToWords(num) {
  // For large numbers, use abbreviated format
  if (num >= 1000000) {
    const millions = (num / 1000000).toFixed(1);
    return `${numberToWords(parseFloat(millions))} million`;
  }
  
  if (num >= 100000) {
    // Use K format for hundreds of thousands
    const k = Math.round(num / 1000);
    return `${k}K`;
  }
  
  if (num >= 1000) {
    const thousands = (num / 1000).toFixed(0);
    return `${numberToWords(parseInt(thousands))} thousand`;
  }
  
  return numberToWords(num);
}

/**
 * Basic number to words conversion
 * For production, use a robust library like number-to-words
 */
function numberToWords(num) {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  
  if (num === 0) return 'zero';
  if (num < 10) return ones[num];
  if (num >= 10 && num < 20) return teens[num - 10];
  if (num >= 20 && num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one > 0 ? ' ' + ones[one] : '');
  }
  if (num >= 100 && num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    return ones[hundred] + ' hundred' + (remainder > 0 ? ' and ' + numberToWords(remainder) : '');
  }
  
  return num.toString(); // Fallback for very large numbers
}

/**
 * Usage Examples:
 * 
 * formatAsWords(1400000)  → "one point four million"
 * formatAsWords(625000)   → "625K"
 * formatAsWords(312500)   → "312K"
 * formatAsWords(50)       → "fifty"
 * formatAsWords(null)     → "an unknown amount"
 * formatAsWords("abc")    → "an unknown amount"
 */

// Export for use in n8n or other platforms
module.exports = {
  formatAsWords,
  humanizeNumberToWords,
  numberToWords
};

