// conversation-controller.js
// Drop-in orchestration for OpenAI Realtime x SignalWire bridge
// Goal: bulletproof qualification → equity → Q&A → booking, with senior-friendly tone

export function createConversationController({ lead = {}, broker = {}, timezone = 'America/Los_Angeles' } = {}) {
  // --- PHASES ---------------------------------------------------------------
  const Phase = Object.freeze({
    RAPPORT: 'RAPPORT',
    QUALIFY: 'QUALIFY',
    EQUITY: 'EQUITY',
    QA: 'QA',
    BOOK: 'BOOK',
    END: 'END',
  });

  // --- SLOTS (authoritative) ------------------------------------------------
  const slots = {
    purpose: null,                 // string
    age_62_plus: null,             // true|false
    primary_residence: null,       // true|false
    mortgage_status: null,         // 'paid_off' | 'has_balance'
    est_home_value: null,          // number|string (ballpark)
    est_mortgage_balance: null,    // number|string (required iff has_balance)
  };

  // internal flags
  let phase = Phase.RAPPORT;
  let equityPresented = false; // set true when recap+equity spoken
  let qaComplete = false;      // set true when user says no more questions

  // --- HELPERS --------------------------------------------------------------
  function isQualified() {
    if (slots.age_62_plus !== true) return false;
    if (slots.primary_residence !== true) return false;
    if (!slots.purpose) return false;
    if (!slots.mortgage_status) return false;
    if (!slots.est_home_value) return false;
    if (slots.mortgage_status === 'has_balance' && !slots.est_mortgage_balance) return false;
    return true;
  }

  function nextPhase() {
    switch (phase) {
      case Phase.RAPPORT:
        phase = Phase.QUALIFY; break;
      case Phase.QUALIFY:
        phase = isQualified() ? Phase.EQUITY : Phase.QUALIFY; break;
      case Phase.EQUITY:
        phase = Phase.QA; break;
      case Phase.QA:
        phase = Phase.BOOK; break;
      default: break;
    }
    return phase;
  }

  function missingSlot() {
    if (!slots.purpose) return 'purpose';
    if (slots.age_62_plus === null) return 'age_62_plus';
    if (slots.primary_residence === null) return 'primary_residence';
    if (!slots.mortgage_status) return 'mortgage_status';
    if (!slots.est_home_value) return 'est_home_value';
    if (slots.mortgage_status === 'has_balance' && !slots.est_mortgage_balance) return 'est_mortgage_balance';
    return null;
  }

  function nextQuestionFor(slot) {
    const q = {
      purpose: "What would you like to use the money for?",
      age_62_plus: "And are you sixty-two or older?",
      primary_residence: "Is this your primary residence — do you live there full time?",
      mortgage_status: "Is your home paid off, or do you still have a mortgage?",
      est_home_value: "About how much do you think your home is worth — just a ballpark is fine.",
      est_mortgage_balance: "And about how much do you still owe on the mortgage? A rough estimate is perfectly fine.",
    };
    return q[slot] || null;
  }

  // Simple extractor (rule-based); can be augmented by LLM tool results
  function updateSlotsFromUserText(userText = '') {
    const t = String(userText).toLowerCase();

    // purpose (basic intents)
    if (!slots.purpose) {
      if (/medical|surgery|hospital|meds?|doctor|health|care/.test(t)) slots.purpose = 'medical';
      else if (/repair|roof|hvac|renovat|fix|plumb|electric/.test(t)) slots.purpose = 'home_repair';
      else if (/debt|credit card|loan|bills|pay off|consolidat/.test(t)) slots.purpose = 'debt_consolidation';
      else if (/family|kids|grandkid|tuition|help my (son|daughter)|child/.test(t)) slots.purpose = 'help_family';
      else if (/travel|vacation|retire|living|bills|day.to.day/.test(t)) slots.purpose = 'other';
    }

    // age
    if (slots.age_62_plus === null) {
      if (/\b(over|older than|above)\s+(sixty[-\s]?two|62)\b|\b(i'?m|am|yes.+)(6[2-9]|7\d|8\d)\b/.test(t)) slots.age_62_plus = true;
      if (/\b(under|younger than|below)\s+(sixty[-\s]?two|62)\b|\b(i'?m|am)\s+([1-5]?\d|6[01])\b/.test(t)) slots.age_62_plus = false;
      if (/\byes\b/i.test(t) && /\b(62|sixty.two|older)\b/.test(t)) slots.age_62_plus = true;
    }

    // residence
    if (slots.primary_residence === null) {
      if (/primary residence|live here|we live there|full.time|yes.+(live|residence)/.test(t)) slots.primary_residence = true;
      if (/rental|investment property|we don'?t live there|tenant|vacation home/.test(t)) slots.primary_residence = false;
    }

    // mortgage status
    if (!slots.mortgage_status) {
      if (/paid off|free and clear|no mortgage|own it outright/.test(t)) slots.mortgage_status = 'paid_off';
      if (/(have a|still have a|with a|got a) mortgage|we still owe|balance remaining|paying on it/.test(t)) slots.mortgage_status = 'has_balance';
    }

    // rough numbers (very permissive; keep first seen)
    const moneyMatches = [...t.matchAll(/\$?\s*([0-9]{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|thousand|m|million)?/gi)];
    if (moneyMatches.length > 0 && !slots.est_home_value) {
      const match = moneyMatches[0];
      let value = parseFloat(match[1].replace(/,/g, ''));
      if (match[2]) {
        const multiplier = match[2].toLowerCase();
        if (multiplier === 'k' || multiplier === 'thousand') value *= 1000;
        if (multiplier === 'm' || multiplier === 'million') value *= 1000000;
      }
      if (value > 50000) { // Assume it's home value if > 50k
        slots.est_home_value = value;
      }
    }

    // mortgage balance (look for words around owe/balance)
    if (slots.mortgage_status === 'has_balance' && !slots.est_mortgage_balance) {
      const balMatch = t.match(/(owe|balance|left|remaining)\s*(of|is|about|around)?\s*\$?\s*([0-9]{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|thousand|m|million)?/i);
      if (balMatch) {
        let value = parseFloat(balMatch[3].replace(/,/g, ''));
        if (balMatch[4]) {
          const multiplier = balMatch[4].toLowerCase();
          if (multiplier === 'k' || multiplier === 'thousand') value *= 1000;
          if (multiplier === 'm' || multiplier === 'million') value *= 1000000;
        }
        slots.est_mortgage_balance = value;
      }
    }
  }

  // Markers from model-side events
  function markEquityPresented() { equityPresented = true; }
  function markQaComplete() { qaComplete = true; }

  // Booking guard
  function canBook() {
    return isQualified() && equityPresented; // QA encouraged by prompt; enforce if you prefer: && qaComplete
  }

  // Gentle nudge message for the model at each phase
  function nudgeForCurrentPhase() {
    const map = {
      [Phase.QUALIFY]: "Ask for the next missing qualification detail. Keep it to two sentences, warm and patient.",
      [Phase.EQUITY]: "Recap their situation and present equity in words. Two sentences max.",
      [Phase.QA]: "Ask if they have any questions before scheduling. Keep answers short and kind.",
      [Phase.BOOK]: "Offer two specific times and schedule the call. Confirm phone number and offer a text reminder.",
    };
    return map[phase] || null;
  }

  // Get JSON representation for metadata
  function toJSON() {
    return {
      phase,
      slots: { ...slots },
      equityPresented,
      qaComplete,
      canBook: canBook(),
      missing_slot: missingSlot(),
      next_question: nextQuestionFor(missingSlot())
    };
  }

  // Public controller API used by the bridge
  return {
    Phase,
    get phase() { return phase; },
    get slots() { return { ...slots }; },
    isQualified,
    canBook,
    nextPhase,
    missingSlot,
    nextQuestionFor,
    updateSlotsFromUserText,
    markEquityPresented,
    markQaComplete,
    nudgeForCurrentPhase,
    toJSON,
  };
}

