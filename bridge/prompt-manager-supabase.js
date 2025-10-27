/**
 * Supabase-based Prompt Manager for Barbara
 * 
 * Fetches prompts from Supabase based on call_type:
 * - inbound-qualified
 * - inbound-unqualified
 * - outbound-warm
 * - outbound-cold
 * - transfer
 * - callback
 * - broker-schedule-check
 * - broker-connect-appointment
 * - fallback
 * 
 * Each prompt is stored as JSONB with 9 sections that are assembled into final prompt
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase client (requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars)
let supabase = null;

function initSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required');
    }
    
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase client initialized for prompt manager');
  }
  return supabase;
}

// In-memory cache for prompts (5 minute TTL)
const promptCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Determine which call_type to use based on call context
 */
function determineCallType(callContext) {
  const { 
    context,           // 'inbound' or 'outbound'
    call_type,         // Explicit call type if provided
    lead_id,          // Is lead in database?
    is_qualified,     // Is lead qualified?
    is_transfer,      // Is this a transfer?
    is_callback,      // Is this a scheduled callback?
    is_broker         // Is caller a broker?
  } = callContext;
  
  console.log('🔍 Call type determination:', {
    context,
    call_type,
    lead_id: !!lead_id,
    is_qualified,
    is_transfer,
    is_callback,
    is_broker
  });
  
  // If explicit call_type provided, use it
  if (call_type) {
    console.log(`📞 Using explicit call_type: ${call_type}`);
    return call_type;
  }
  
  // Broker calls
  if (is_broker) {
    // Determine if they're checking schedule or connecting for appointment
    // This would need additional context from the call
    return 'broker-schedule-check'; // Default broker call type
  }
  
  // Transfer scenarios
  if (is_transfer) {
    return 'transfer';
  }
  
  // Scheduled callbacks
  if (is_callback) {
    return 'callback';
  }
  
  // Outbound calls
  if (context === 'outbound') {
    return is_qualified ? 'outbound-warm' : 'outbound-cold';
  }
  
  // Inbound calls
  if (context === 'inbound') {
    return is_qualified ? 'inbound-qualified' : 'inbound-unqualified';
  }
  
  // Default fallback
  console.warn('⚠️ No matching call type found, using fallback');
  return 'fallback';
}

/**
 * Fetch prompt from Supabase by call_type
 */
async function fetchPromptFromSupabase(callType) {
  try {
    const db = initSupabase();
    
    console.log(`📥 Fetching prompt for call_type: ${callType}`);
    
    // Get the active prompt for this call type
    const { data: prompt, error: promptError } = await db
      .from('prompts')
      .select('id, name, voice, call_type')
      .eq('call_type', callType)
      .eq('is_active', true)
      .maybeSingle();
    
    if (promptError) throw promptError;
    
    if (!prompt) {
      console.warn(`⚠️ No active prompt found for call_type: ${callType}`);
      return null;
    }
    
    console.log(`📋 Found prompt: ${prompt.name} (voice: ${prompt.voice})`);
    
    // Get the active version of this prompt
    const { data: version, error: versionError } = await db
      .from('prompt_versions')
      .select('content, version_number, change_summary')
      .eq('prompt_id', prompt.id)
      .eq('is_active', true)
      .maybeSingle();
    
    if (versionError) throw versionError;
    
    if (!version) {
      console.warn(`⚠️ No active version found for prompt: ${prompt.name}`);
      return null;
    }
    
    console.log(`📋 Using version ${version.version_number}: ${version.change_summary}`);
    
    return {
      ...prompt,
      content: version.content,
      version_number: version.version_number
    };
    
  } catch (error) {
    console.error(`❌ Failed to fetch prompt from Supabase:`, error.message);
    return null;
  }
}

/**
 * Assemble the final prompt from the 9 JSONB sections
 * 
 * Sections:
 * 1. role - Role & Objective
 * 2. personality - Personality & Tone
 * 3. context - Context variables
 * 4. pronunciation - Reference Pronunciations
 * 5. tools - Available tools
 * 6. instructions - Instructions & Rules
 * 7. conversation_flow - Conversation Flow
 * 8. output_format - Output Format
 * 9. safety - Safety & Escalation
 */
function assemblePrompt(promptContent) {
  const sections = [];
  
  // Order matters - this is how GPT will read the prompt
  const sectionOrder = [
    { key: 'role', heading: '# ROLE & OBJECTIVE' },
    { key: 'personality', heading: '# PERSONALITY & TONE' },
    { key: 'context', heading: '# CONTEXT VARIABLES' },
    { key: 'pronunciation', heading: '# REFERENCE PRONUNCIATIONS' },
    { key: 'tools', heading: '# AVAILABLE TOOLS' },
    { key: 'instructions', heading: '# INSTRUCTIONS & RULES' },
    { key: 'conversation_flow', heading: '# CONVERSATION FLOW' },
    { key: 'output_format', heading: '# OUTPUT FORMAT' },
    { key: 'safety', heading: '# SAFETY & ESCALATION' }
  ];
  
  for (const { key, heading } of sectionOrder) {
    const content = promptContent[key];
    if (content && content.trim()) {
      sections.push(`${heading}\n\n${content.trim()}`);
    }
  }
  
  const assembled = sections.join('\n\n---\n\n');
  console.log(`📋 Assembled prompt: ${assembled.length} characters, ${sections.length} sections`);
  
  return assembled;
}

/**
 * Get prompt from cache or Supabase
 */
async function getPromptFromSupabase(callType, variables = {}) {
  // Check cache first
  const cached = promptCache.get(callType);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`📋 Using cached prompt for call_type: ${callType}`);
    return {
      prompt: injectVariables(cached.assembledPrompt, variables),
      voice: cached.voice,
      promptName: cached.name
    };
  }
  
  // Fetch from Supabase
  const promptData = await fetchPromptFromSupabase(callType);
  if (!promptData) {
    return null;
  }
  
  // Assemble the prompt from JSONB sections
  const assembledPrompt = assemblePrompt(promptData.content);
  
  // Cache the assembled prompt
  promptCache.set(callType, {
    assembledPrompt,
    voice: promptData.voice,
    name: promptData.name,
    timestamp: Date.now()
  });
  
  // Inject variables and return
  return {
    prompt: injectVariables(assembledPrompt, variables),
    voice: promptData.voice,
    promptName: promptData.name
  };
}

/**
 * Main function: Get the right prompt for this call
 */
async function getPromptForCall(callContext, customInstructions = null, variables = {}) {
  console.log('🔍 Getting prompt for call context:', {
    context: callContext.context,
    call_type: callContext.call_type,
    has_lead: !!callContext.lead_id,
    is_qualified: callContext.is_qualified
  });
  
  // If custom instructions provided (from n8n/MCP), use those
  if (customInstructions) {
    console.log('📝 Using custom instructions provided by caller');
    return {
      prompt: customInstructions,
      voice: 'alloy', // Default voice
      promptName: 'custom-instructions'
    };
  }
  
  // Determine which call type to use
  const callType = determineCallType(callContext);
  console.log(`📞 Selected call_type: ${callType}`);
  
  // Try to get from Supabase
  const result = await getPromptFromSupabase(callType, variables);
  
  if (result) {
    return result;
  }
  
  // No prompt found in Supabase - use minimal emergency prompt
  console.error(`❌ No prompt found in Supabase for call_type '${callType}' - using minimal emergency prompt`);
  return {
    prompt: "You are Barbara, a warm and professional scheduling assistant for reverse mortgage consultations. Keep responses brief and friendly. Ask questions to understand their needs and help schedule a consultation.",
    voice: 'alloy',
    promptName: 'emergency-fallback'
  };
}

/**
 * Inject variables into prompt template
 * Supports Handlebars-style placeholders: {{variableName}}
 */
function injectVariables(promptTemplate, variables) {
  try {
    let prompt = promptTemplate;
    
    // Add default values for common variables that might be missing
    const enrichedVariables = {
      ...variables,
      // Broker info
      brokerCompany: variables.brokerCompany || 'Equity Connect',
      brokerFirstName: variables.brokerFirstName || 'one of our advisors',
      brokerFullName: variables.brokerFullName || 'one of our advisors',
      brokerLastName: variables.brokerLastName || '',
      brokerPhone: variables.brokerPhone || '',
      // Lead info
      leadFirstName: variables.leadFirstName || '',
      leadLastName: variables.leadLastName || '',
      leadFullName: variables.leadFullName || '',
      leadEmail: variables.leadEmail || '',
      leadPhone: variables.leadPhone || '',
      leadAge: variables.leadAge || '',
      // Property info
      propertyAddress: variables.propertyAddress || '',
      propertyCity: variables.propertyCity || '',
      propertyState: variables.propertyState || '',
      propertyZipcode: variables.propertyZipcode || '',
      propertyValue: variables.propertyValue || '',
      propertyValueWords: variables.propertyValueWords || '',
      mortgageBalance: variables.mortgageBalance || '',
      mortgageBalanceWords: variables.mortgageBalanceWords || '',
      estimatedEquity: variables.estimatedEquity || '',
      estimatedEquityWords: variables.estimatedEquityWords || '',
      ownerOccupied: variables.ownerOccupied || '',
      // Equity calculations
      equity50Percent: variables.equity50Percent || '',
      equity50FormattedWords: variables.equity50FormattedWords || '',
      equity60Percent: variables.equity60Percent || '',
      equity60FormattedWords: variables.equity60FormattedWords || '',
      // Context
      callContext: variables.callContext || variables.context || 'inbound'
    };
    
    // Replace all {{variableName}} placeholders
    Object.keys(enrichedVariables).forEach(key => {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const value = enrichedVariables[key] || '';
      prompt = prompt.replace(placeholder, value);
    });
    
    // Replace any remaining {{variables}} with empty string
    prompt = prompt.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      console.log(`⚠️ Variable {{${varName}}} not provided - replacing with empty string`);
      return '';
    });
    
    return prompt;
    
  } catch (error) {
    console.error('❌ Variable injection failed (using template as-is):', error.message);
    return promptTemplate;
  }
}

/**
 * Clear the prompt cache (useful for testing or manual refresh)
 */
function clearCache() {
  const count = promptCache.size;
  promptCache.clear();
  console.log(`🗑️ Cleared ${count} cached prompts`);
}

/**
 * Pre-warm the cache by loading all call types
 */
async function prewarmCache() {
  const callTypes = [
    'inbound-qualified',
    'inbound-unqualified',
    'outbound-warm',
    'outbound-cold',
    'transfer',
    'callback',
    'broker-schedule-check',
    'broker-connect-appointment',
    'fallback'
  ];
  
  console.log('🔥 Pre-warming prompt cache from Supabase...');
  
  for (const callType of callTypes) {
    await getPromptFromSupabase(callType);
  }
  
  console.log(`✅ Prompt cache pre-warmed with ${promptCache.size} prompts`);
}

module.exports = {
  getPromptForCall,
  injectVariables,
  determineCallType,
  clearCache,
  prewarmCache,
  initSupabase
};

