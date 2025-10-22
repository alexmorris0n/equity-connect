/**
 * Smart Prompt Manager for Barbara
 * 
 * Pulls prompts from PromptLayer based on call context:
 * - Inbound vs Outbound
 * - Lead in DB vs not in DB
 * - Qualified vs unqualified
 * 
 * Falls back to local file if PromptLayer is unavailable
 */

const fs = require('fs');
const path = require('path');
const { initPromptLayer } = require('./promptlayer-integration');

// In-memory cache for prompts (5 minute TTL)
const promptCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fallback prompt from local file
let localFallbackPrompt = null;

/**
 * Load local fallback prompt (only once)
 */
function loadLocalFallbackPrompt() {
  if (localFallbackPrompt) return localFallbackPrompt;
  
  const candidates = [
    '../prompts/old big buitifl promtp.md',
    '../prompts/BarbaraRealtimePrompt.md',
    '../prompts/Prompt31_Master.md'
  ];
  
  for (const rel of candidates) {
    try {
      const p = path.join(__dirname, rel);
      localFallbackPrompt = fs.readFileSync(p, 'utf8');
      console.log('✅ Loaded local fallback prompt:', rel, `(${localFallbackPrompt.length} chars)`);
      return localFallbackPrompt;
    } catch (err) {
      // Try next candidate
    }
  }
  
  console.warn('⚠️ No local fallback prompt found - using minimal');
  localFallbackPrompt = "You are Barbara, a warm scheduling assistant for reverse mortgage consultations.";
  return localFallbackPrompt;
}

/**
 * Determine which prompt to use based on call context
 */
function determinePromptName(callContext) {
  const { 
    context,           // 'inbound' or 'outbound'
    lead_id,          // Is lead in database?
    from_phone,       // Caller's phone
    to_phone,         // Number they called
    has_property_data // Do we have equity/property info?
  } = callContext;
  
  // Outbound calls
  if (context === 'outbound') {
    // If we have lead data, it's a warm outbound call
    if (lead_id && has_property_data) {
      return 'barbara-outbound-warm';
    }
    // Cold outbound (shouldn't happen often, but handle it)
    return 'barbara-outbound-cold';
  }
  
  // Inbound calls
  if (context === 'inbound') {
    // If lead is in DB with property data, use qualified prompt
    if (lead_id && has_property_data) {
      return 'barbara-inbound-qualified';
    }
    // Unknown caller or missing data, use unqualified (discovery) prompt
    return 'barbara-inbound-unqualified';
  }
  
  // Default fallback
  return 'barbara-fallback';
}

/**
 * Get prompt from cache or PromptLayer
 */
async function getPromptFromPromptLayer(promptName) {
  // Check cache first
  const cached = promptCache.get(promptName);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`📋 Using cached prompt: ${promptName}`);
    return cached.prompt;
  }
  
  try {
    const promptLayer = initPromptLayer();
    
    if (!promptLayer.enabled) {
      console.log('⚠️ PromptLayer disabled, using local fallback');
      return null;
    }
    
    // Fetch prompt template from PromptLayer
    const result = await promptLayer.client.templates.get(promptName, {
      // Get latest version
      label: 'production'  // or 'latest' or specific version
    });
    
    if (!result || !result.prompt_template) {
      console.warn(`⚠️ Prompt '${promptName}' not found in PromptLayer`);
      return null;
    }
    
    // Extract prompt text from template
    let promptText = '';
    
    // PromptLayer templates can be in different formats
    if (typeof result.prompt_template === 'string') {
      promptText = result.prompt_template;
    } else if (result.prompt_template.messages) {
      // Chat format - combine system + user messages
      promptText = result.prompt_template.messages
        .map(m => m.content)
        .join('\n\n');
    } else if (result.prompt_template.prompt) {
      promptText = result.prompt_template.prompt;
    }
    
    if (!promptText) {
      console.warn(`⚠️ Could not extract prompt text from '${promptName}'`);
      return null;
    }
    
    // Cache it
    promptCache.set(promptName, {
      prompt: promptText,
      timestamp: Date.now()
    });
    
    console.log(`✅ Fetched prompt from PromptLayer: ${promptName} (${promptText.length} chars)`);
    return promptText;
    
  } catch (error) {
    console.error(`❌ Failed to fetch prompt '${promptName}' from PromptLayer:`, error.message);
    return null;
  }
}

/**
 * Main function: Get the right prompt for this call
 */
async function getPromptForCall(callContext, customInstructions = null) {
  console.log('🔍 Getting prompt for call context:', {
    context: callContext.context,
    has_lead: !!callContext.lead_id,
    has_data: !!callContext.has_property_data
  });
  
  // If custom instructions provided (from n8n/MCP), use those
  if (customInstructions) {
    console.log('📝 Using custom instructions provided by caller');
    return customInstructions;
  }
  
  // Determine which prompt to use
  const promptName = determinePromptName(callContext);
  console.log(`📋 Selected prompt variant: ${promptName}`);
  
  // Try to get from PromptLayer
  let promptFromPL = await getPromptFromPromptLayer(promptName);
  
  if (!promptFromPL) {
    if (promptName !== 'barbara-fallback') {
      console.warn(`⚠️ Prompt '${promptName}' missing in PromptLayer - trying 'barbara-fallback'`);
      promptFromPL = await getPromptFromPromptLayer('barbara-fallback');
    }
  }
  
  if (promptFromPL) {
    return promptFromPL;
  }
  
  // Fallback to local file
  console.log('⚠️ PromptLayer unavailable or prompt missing, using local fallback');
  return loadLocalFallbackPrompt();
}

/**
 * Inject variables into prompt template
 * Supports Handlebars-style placeholders: {{variableName}}
 */
function injectVariables(promptTemplate, variables) {
  let prompt = promptTemplate;
  
  // Replace all {{variableName}} placeholders
  Object.keys(variables).forEach(key => {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    const value = variables[key] || '';
    prompt = prompt.replace(placeholder, value);
  });
  
  // Handle conditionals: {{#if variable}}...{{/if}}
  const conditionalRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  prompt = prompt.replace(conditionalRegex, (match, varName, content) => {
    return variables[varName] ? content : '';
  });
  
  // Handle conditionals with else: {{#if variable}}...{{else}}...{{/if}}
  const conditionalElseRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
  prompt = prompt.replace(conditionalElseRegex, (match, varName, ifContent, elseContent) => {
    return variables[varName] ? ifContent : elseContent;
  });
  
  return prompt;
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
 * Pre-warm the cache by fetching all prompt variants
 */
async function prewarmCache() {
  const variants = [
    'barbara-inbound-qualified',
    'barbara-inbound-unqualified',
    'barbara-outbound-warm',
    'barbara-outbound-cold'
  ];
  
  console.log('🔥 Pre-warming prompt cache...');
  
  for (const variant of variants) {
    await getPromptFromPromptLayer(variant);
  }
  
  console.log('✅ Prompt cache pre-warmed');
}

module.exports = {
  getPromptForCall,
  injectVariables,
  determinePromptName,
  clearCache,
  prewarmCache
};

