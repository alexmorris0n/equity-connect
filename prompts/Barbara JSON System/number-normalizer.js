// number-normalizer.js
// Convert numbers to words for TTS (prevent digit pronunciation)
// Example: "$750,000" → "seven hundred fifty thousand dollars"

/**
 * Normalize a number to words for natural TTS
 * @param {number|string} value - Number to normalize
 * @param {Object} options - Formatting options
 * @returns {string} Number in words
 */
export function numberToWords(value, options = {}) {
  const {
    currency = false,      // Add "dollars" suffix
    approximate = false,   // Add "about" prefix
    round = false          // Round to nearest significant figure
  } = options;

  // Parse to number
  let num = typeof value === 'string' 
    ? parseFloat(value.replace(/[$,]/g, ''))
    : value;

  if (isNaN(num)) return value; // Return original if not a number

  // Round if requested
  if (round) {
    if (num >= 1000000) {
      num = Math.round(num / 100000) * 100000; // Round to nearest 100k
    } else if (num >= 100000) {
      num = Math.round(num / 10000) * 10000; // Round to nearest 10k
    } else if (num >= 10000) {
      num = Math.round(num / 1000) * 1000; // Round to nearest 1k
    }
  }

  let result = '';

  // Handle millions
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    
    if (remainder === 0) {
      result = `${numberToEnglish(millions)} million`;
    } else if (remainder >= 100000) {
      const decimal = Math.round(remainder / 100000);
      result = `${numberToEnglish(millions)} point ${decimal} million`;
    } else {
      result = `${numberToEnglish(millions)} million ${numberToEnglish(remainder)}`;
    }
  }
  // Handle hundred thousands
  else if (num >= 100000) {
    const hundredThousands = Math.floor(num / 100000);
    const remainder = num % 100000;
    
    if (remainder === 0) {
      result = `${numberToEnglish(hundredThousands)} hundred thousand`;
    } else {
      const tens = Math.floor(remainder / 1000);
      if (tens > 0) {
        result = `${numberToEnglish(hundredThousands)} hundred ${numberToEnglish(tens)} thousand`;
      } else {
        result = `${numberToEnglish(hundredThousands)} hundred thousand`;
      }
    }
  }
  // Handle thousands
  else if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    
    if (remainder === 0) {
      result = `${numberToEnglish(thousands)} thousand`;
    } else {
      result = `${numberToEnglish(thousands)} thousand ${numberToEnglish(remainder)}`;
    }
  }
  // Handle under 1000
  else {
    result = numberToEnglish(num);
  }

  // Add prefixes/suffixes
  if (approximate) result = `about ${result}`;
  if (currency) result = `${result} dollars`;

  return result;
}

/**
 * Convert number (0-999) to English words
 * @param {number} num - Number to convert
 * @returns {string} English words
 */
function numberToEnglish(num) {
  if (num === 0) return 'zero';

  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 
                 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return one > 0 ? `${tens[ten]}-${ones[one]}` : tens[ten];
  }
  if (num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    return remainder > 0 
      ? `${ones[hundred]} hundred ${numberToEnglish(remainder)}`
      : `${ones[hundred]} hundred`;
  }

  return num.toString();
}

/**
 * Normalize all numbers in a text string
 * Finds currency amounts and converts to words
 * @param {string} text - Text containing numbers
 * @returns {string} Text with numbers converted to words
 */
export function normalizeNumbersInText(text) {
  // Match currency patterns: $750,000 or 750000 or $750k
  return text.replace(/\$?\s*([0-9]{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|m|million|thousand)?/gi, 
    (match, number, suffix) => {
      let value = parseFloat(number.replace(/,/g, ''));
      
      // Apply suffix multiplier
      if (suffix) {
        const s = suffix.toLowerCase();
        if (s === 'k' || s === 'thousand') value *= 1000;
        if (s === 'm' || s === 'million') value *= 1000000;
      }

      // Convert to words
      return numberToWords(value, { 
        currency: match.includes('$'),
        approximate: true,
        round: true 
      });
    }
  );
}

/**
 * Normalize equity/mortgage values for Barbara's speech
 * Special handling for common reverse mortgage amounts
 * @param {Object} slots - Controller slots
 * @returns {Object} Slots with normalized values
 */
export function normalizeSlots(slots) {
  const normalized = { ...slots };

  // Normalize home value
  if (slots.est_home_value) {
    normalized.est_home_value_words = numberToWords(
      slots.est_home_value,
      { approximate: true, round: true }
    );
  }

  // Normalize mortgage balance
  if (slots.est_mortgage_balance) {
    normalized.est_mortgage_balance_words = numberToWords(
      slots.est_mortgage_balance,
      { approximate: true, round: true }
    );
  }

  // Calculate equity in words
  if (slots.est_home_value && slots.mortgage_status) {
    let equity = parseFloat(String(slots.est_home_value).replace(/[^0-9.]/g, ''));
    
    if (slots.mortgage_status === 'has_balance' && slots.est_mortgage_balance) {
      const balance = parseFloat(String(slots.est_mortgage_balance).replace(/[^0-9.]/g, ''));
      equity -= balance;
    }

    normalized.equity = equity;
    normalized.equity_words = numberToWords(equity, { round: true });
    
    // Calculate 50% and 60% access
    normalized.equity_50_words = numberToWords(equity * 0.5, { round: true });
    normalized.equity_60_words = numberToWords(equity * 0.6, { round: true });
  }

  return normalized;
}

/**
 * Format phone number for speech
 * Example: "650-530-0051" → "six five zero, five three zero, zero zero five one"
 * @param {string} phone - Phone number
 * @returns {string} Phone number in spoken format
 */
export function phoneToWords(phone) {
  const digits = phone.replace(/\D/g, '');
  const digitWords = {
    '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
    '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'
  };

  if (digits.length === 10) {
    const area = digits.slice(0, 3).split('').map(d => digitWords[d]).join(' ');
    const prefix = digits.slice(3, 6).split('').map(d => digitWords[d]).join(' ');
    const line = digits.slice(6).split('').map(d => digitWords[d]).join(' ');
    return `${area}, ${prefix}, ${line}`;
  }

  return digits.split('').map(d => digitWords[d] || d).join(' ');
}

/**
 * Format address for speech
 * Example: "1234 Jump Street" → "twelve thirty-four Jump Street"
 * @param {string} address - Street address
 * @returns {string} Address in spoken format
 */
export function addressToWords(address) {
  return address.replace(/^(\d+)/, (match) => {
    const num = parseInt(match);
    if (num < 100) {
      return numberToEnglish(num);
    }
    // For 4-digit numbers, split into pairs
    const str = match.padStart(4, '0');
    const first = parseInt(str.slice(0, 2));
    const second = parseInt(str.slice(2));
    return `${numberToEnglish(first)} ${numberToEnglish(second)}`;
  });
}

/**
 * Example: Prepare equity presentation for TTS
 */
export function prepareEquityPresentation(slots) {
  const normalized = normalizeSlots(slots);
  
  let presentation = '';

  if (slots.mortgage_status === 'paid_off') {
    presentation = `So to recap, you own your home free and clear, worth about ${normalized.est_home_value_words}. `;
    presentation += `That means you have approximately ${normalized.equity_words} in equity. `;
    presentation += `You could potentially access ${normalized.equity_50_words} to ${normalized.equity_60_words}.`;
  } else {
    presentation = `So to recap, your home is worth about ${normalized.est_home_value_words}, `;
    presentation += `with about ${normalized.est_mortgage_balance_words} remaining on your mortgage. `;
    presentation += `That gives you approximately ${normalized.equity_words} in equity. `;
    presentation += `You could potentially access ${normalized.equity_50_words} to ${normalized.equity_60_words}.`;
  }

  return presentation;
}

/**
 * Example usage
 */
export function exampleUsage() {
  // Convert numbers
  console.log(numberToWords(750000, { currency: true, approximate: true }));
  // → "about seven hundred fifty thousand dollars"

  console.log(numberToWords(1500000, { approximate: true, round: true }));
  // → "about one point five million"

  // Normalize text
  console.log(normalizeNumbersInText("Your home is worth $750,000"));
  // → "Your home is worth about seven hundred fifty thousand dollars"

  // Phone number
  console.log(phoneToWords("650-530-0051"));
  // → "six five zero, five three zero, zero zero five one"

  // Address
  console.log(addressToWords("1234 Jump Street"));
  // → "twelve thirty-four Jump Street"

  // Full equity presentation
  const slots = {
    mortgage_status: 'has_balance',
    est_home_value: 750000,
    est_mortgage_balance: 150000
  };
  console.log(prepareEquityPresentation(slots));
  // → Natural spoken equity presentation
}

