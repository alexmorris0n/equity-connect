// config-generator.js
// Generates Barbara personality prompt and controller settings from Vue.js UI config

/**
 * Generate personality prompt from UI configuration
 * @param {Object} config - Configuration from Vue UI
 * @returns {string} Generated personality prompt
 */
export function generatePersonalityPrompt(config) {
  const { personality } = config;
  
  // Response length mapping
  const responseLengthMap = {
    brief: '1-2 sentences maximum per response',
    normal: '2-3 sentences maximum per response',
    conversational: '2-4 sentences per response'
  };
  
  // Tone style mapping
  const toneStyleMap = {
    professional: `- Warm and professional (minimal accent)
- Use expressions like: "Wonderful!" "I understand" "That makes sense"
- Friendly but not overly casual`,
    warm: `- Warm and friendly with light Southern charm
- Use expressions like: "That's great!" "I appreciate that" "Wonderful to hear"
- Conversational and caring`,
    southern: `- Bubbly and upbeat with Southern warmth
- Use expressions like: ${personality.expressions || 'Oh my goodness!, That\'s wonderful!, I just love that!'}
- Warm drawl, patient and caring`
  };
  
  const prompt = `# BARBARA - PERSONALITY CORE (CACHED)

You are Barbara, a 45-year-old African American scheduling assistant with a warm, bubbly personality${personality.toneStyle === 'southern' ? ' and slight Southern accent' : ''}. You help seniors explore reverse mortgage options and book appointments with licensed advisors.

## TONE & VOICE
- Warm, patient, naturally conversational
${toneStyleMap[personality.toneStyle]}
- Professional but never stiff or robotic
- ${responseLengthMap[personality.responseLength]}
- Speak numbers naturally: "seven hundred fifty thousand" not "750,000"

${personality.enableEmpathy ? `## EMPATHY & URGENCY HANDLING

When caller_information shows:
- money_purpose = "medical" AND timeline = "urgent"

Behavior changes:
- Use extra warmth: "I understand this is urgent - let's get you help quickly"
- Skip small talk: Move directly to qualification after rapport
- Prioritize booking: Offer earliest available times first
- Acknowledge stress: "I know time is important here"

` : ''}## CONVERSATION FLOW
You follow a structured **controller_state** JSON object that tells you:
- **Current phase**: RAPPORT → QUALIFY → EQUITY → QA → BOOK
- **Required slots**: ${getRequiredSlotsList(config)}
- **What's missing**: Ask for the next missing slot only
- **Booking guard**: Never book until \`canBook: true\`

## BEHAVIOR RULES
1. **Ask only for the next missing slot** - Check \`controller_state.slots\` first
2. **Never skip qualification** - Equity presentation requires all slots filled
3. **Never book prematurely** - Check \`canBook: true\` before calling \`book_appointment\`
4. **Use caller_information** - Reference lead name, broker, property, previous context
5. **Keep responses SHORT** - Seniors need clarity, not rambling

## CALLER INFORMATION
Dynamic data is injected in \`caller_information\` object:
- Lead details (name, property, equity)
- Broker details (name, company, phone)
- Previous call context (money_purpose, objections, timeline)
- Email engagement (campaign, persona sender)

**Use what's provided. If missing, ask naturally.**

## TOOLS
- \`search_knowledge\` - Answer complex questions about reverse mortgages
- \`check_broker_availability\` - Find appointment slots
- \`book_appointment\` - Schedule (only when canBook=true)
- \`save_interaction\` - Log call summary and metadata

**Remember**: You enforce warmth and tone. The controller enforces structure and compliance.
`;

  return prompt;
}

/**
 * Generate controller configuration from UI settings
 * @param {Object} config - Configuration from Vue UI
 * @returns {Object} Controller configuration object
 */
export function generateControllerConfig(config) {
  const { validation, extraction, advanced } = config;
  
  return {
    // Validation settings
    validation: {
      requireQA: validation.requireQA,
      requireEquity: validation.requireEquity,
      requireEmail: validation.requireEmail,
      requireSpouseAge: validation.requireSpouseAge
    },
    
    // Extraction settings
    extraction: {
      method: extraction.method,
      llmModel: extraction.llmModel,
      confidenceThreshold: parseFloat(extraction.confidence)
    },
    
    // Advanced settings
    advanced: {
      phaseMode: advanced.phaseMode,
      sessionTimeout: parseInt(advanced.sessionTimeout),
      logging: {
        controllerState: advanced.logControllerState,
        slotExtraction: advanced.logSlotExtraction,
        bookingAttempts: advanced.logBookingAttempts
      }
    }
  };
}

/**
 * Generate TTS configuration
 * @param {Object} config - Configuration from Vue UI
 * @returns {Object} TTS configuration
 */
export function generateTTSConfig(config) {
  const { tts } = config;
  
  return {
    voice: tts.voice,
    normalizeNumbers: tts.normalizeNumbers,
    options: {
      approximate: tts.useApproximations,
      round: tts.smartRounding
    }
  };
}

/**
 * Generate canBook() function based on requirements
 * @param {Object} config - Configuration from Vue UI
 * @returns {string} JavaScript function code
 */
export function generateCanBookFunction(config) {
  const { validation } = config;
  
  const conditions = ['isQualified()'];
  
  if (validation.requireEquity) {
    conditions.push('equityPresented');
  }
  
  if (validation.requireQA) {
    conditions.push('qaComplete');
  }
  
  return `function canBook() {
  return ${conditions.join(' && ')};
}`;
}

/**
 * Get list of required slots for prompt
 * @param {Object} config - Configuration from Vue UI
 * @returns {string} Comma-separated list
 */
function getRequiredSlotsList(config) {
  const slots = ['purpose', 'age_62_plus', 'primary_residence', 'mortgage_status', 'est_home_value'];
  
  if (config.validation.requireEmail) {
    slots.push('email');
  }
  
  if (config.validation.requireSpouseAge) {
    slots.push('spouse_age_62_plus');
  }
  
  return slots.join(', ');
}

/**
 * Generate complete configuration package
 * @param {Object} uiConfig - Configuration from Vue UI
 * @returns {Object} Complete configuration package
 */
export function generateCompleteConfig(uiConfig) {
  return {
    personalityPrompt: generatePersonalityPrompt(uiConfig),
    controllerConfig: generateControllerConfig(uiConfig),
    ttsConfig: generateTTSConfig(uiConfig),
    canBookFunction: generateCanBookFunction(uiConfig),
    metadata: {
      generated: new Date().toISOString(),
      version: '1.0.0'
    }
  };
}

/**
 * Example: API endpoint handler
 */
export async function handleConfigUpdate(req, res) {
  const uiConfig = req.body;
  
  // Generate files
  const completeConfig = generateCompleteConfig(uiConfig);
  
  // Save to database
  await saveConfigToDatabase({
    config: uiConfig,
    generated: completeConfig,
    userId: req.user.id,
    timestamp: new Date()
  });
  
  // Optionally: Write files to disk
  // await writeConfigFiles(completeConfig);
  
  res.json({
    success: true,
    config: completeConfig,
    message: 'Configuration updated successfully'
  });
}

/**
 * Save configuration to Supabase
 */
async function saveConfigToDatabase(data) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  const { error } = await supabase
    .from('barbara_configurations')
    .upsert({
      user_id: data.userId,
      ui_config: data.config,
      generated_config: data.generated,
      created_at: data.timestamp,
      is_active: true
    });
  
  if (error) throw error;
}

/**
 * Load active configuration
 */
export async function loadActiveConfig(userId) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  const { data, error } = await supabase
    .from('barbara_configurations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();
  
  if (error) throw error;
  return data;
}

