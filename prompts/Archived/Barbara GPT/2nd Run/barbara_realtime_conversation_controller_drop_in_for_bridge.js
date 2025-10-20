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
      if (/medical|surgery|hospital|meds?/.test(t)) slots.purpose = 'medical';
      else if (/repair|roof|hvac|renovat|fix/.test(t)) slots.purpose = 'home_repair';
      else if (/debt|credit card|loan|bills/.test(t)) slots.purpose = 'debt_consolidation';
      else if (/family|kids|grandkid|tuition|help my (son|daughter)/.test(t)) slots.purpose = 'help_family';
    }

    // age
    if (slots.age_62_plus === null) {
      if (/\b(over|older than)\s+(sixty[-\s]?two|62)\b|\b(i'?m|am)\s+(6[2-9]|7\d|8\d)\b/.test(t)) slots.age_62_plus = true;
      if (/\b(under|younger than)\s+(sixty[-\s]?two|62)\b|\b(i'?m|am)\s+(5\d|[1-5]?\d)\b/.test(t)) slots.age_62_plus = false;
    }

    // residence
    if (slots.primary_residence === null) {
      if (/primary residence|live here|we live there full time|we live here/.test(t)) slots.primary_residence = true;
      if (/rental|investment property|we don'?t live there|tenant/.test(t)) slots.primary_residence = false;
    }

    // mortgage status
    if (!slots.mortgage_status) {
      if (/paid off|free and clear/.test(t)) slots.mortgage_status = 'paid_off';
      if (/(have a|still have a|with a) mortgage|we still owe|balance remaining/.test(t)) slots.mortgage_status = 'has_balance';
    }

    // rough numbers (very permissive; keep first seen)
    const money = t.match(/\$?([0-9][\d,\.]*)(\s*(k|m|million|thousand))?/);
    if (money && !slots.est_home_value) {
      slots.est_home_value = money[0];
    }

    // mortgage balance (look for words around owe/balance)
    if (slots.mortgage_status === 'has_balance' && !slots.est_mortgage_balance) {
      const bal = t.match(/(owe|balance|left)\s*(of|is|about|around)?\s*\$?([0-9][\d,\.]*)(\s*(k|m|million|thousand))?/);
      if (bal) slots.est_mortgage_balance = bal[0];
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
  };
}

// --- WS wiring sketch (example usage) --------------------------------------
// In your bridge session handler:
// import { createConversationController } from './conversation-controller.js';
// const ctl = createConversationController({ lead, broker, timezone });
//
// On user ASR transcript:
// ctl.updateSlotsFromUserText(userText);
// if (ctl.phase === ctl.Phase.RAPPORT) ctl.nextPhase();
// if (ctl.phase === ctl.Phase.QUALIFY && ctl.isQualified()) {
//   ctl.nextPhase(); // → EQUITY
//   ws.send(JSON.stringify({ type: 'response.create', response: { instructions: ctl.nudgeForCurrentPhase(), modalities: ['audio'] } }));
// } else if (ctl.phase === ctl.Phase.QUALIFY) {
//   const need = ctl.missingSlot();
//   if (need) {
//     const q = ctl.nextQuestionFor(need);
//     ws.send(JSON.stringify({ type: 'response.create', response: { instructions: q, modalities: ['audio'] } }));
//   }
// }
//
// When your TTS/agent recaps & presents equity, call ctl.markEquityPresented();
// When user says "no more questions", call ctl.markQaComplete();
//
// Guard booking calls:
// if (msg.type === 'response.function_call' && msg.name === 'book_appointment' && !ctl.canBook()) {
//   ws.send(JSON.stringify({ type: 'response.function_call_result', response_id: msg.response_id, output: { error: 'QUALIFICATION_INCOMPLETE' } }));
//   ws.send(JSON.stringify({ type: 'response.create', response: { instructions: 'Let’s grab one more detail first.', modalities: ['audio'] } }));
//   // Auto-ask next missing slot
//   const need = ctl.missingSlot();
//   if (need) {
//     const q = ctl.nextQuestionFor(need);
//     ws.send(JSON.stringify({ type: 'response.create', response: { instructions: q, modalities: ['audio'] } }));
//   }
// }
