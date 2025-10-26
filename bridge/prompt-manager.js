/**
 * Smart Prompt Manager for Barbara
 * 
 * Uses local Production Prompts folder based on call context:
 * - Inbound vs Outbound
 * - Lead in DB vs not in DB
 * - Qualified vs unqualified
 * 
 * Loads from prompts/Production Prompts/ folder
 */

const fs = require('fs');
const path = require('path');

// In-memory cache for prompts (5 minute TTL)
const promptCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Production prompts directory
const PROMPTS_DIR = path.join(__dirname, '..', 'prompts', 'Production Prompts');

/**
 * Load prompt from local Production Prompts folder
 */
function loadLocalPrompt(promptName) {
  try {
    const promptPath = path.join(PROMPTS_DIR, `${promptName}.md`);
    
    if (!fs.existsSync(promptPath)) {
      console.warn(`⚠️ Prompt file not found: ${promptPath}`);
      return null;
    }
    
    const promptText = fs.readFileSync(promptPath, 'utf8');
    console.log(`📋 Loaded local prompt: ${promptName} (${promptText.length} chars)`);
    return promptText;
    
  } catch (err) {
    console.error(`❌ Failed to load prompt '${promptName}':`, err.message);
    return null;
  }
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
    has_property_data, // Do we have equity/property info?
    is_qualified      // New flag indicating qualification status
  } = callContext;
  
  console.log('🔍 Prompt selection debug:', {
    context,
    lead_id: !!lead_id,
    has_property_data,
    is_qualified,
    from_phone,
    to_phone
  });
  
  // Simple logic: qualified = qualified, not qualified = not qualified
  
  // Outbound calls
  if (context === 'outbound') {
    return is_qualified ? 'barbara-outbound-warm' : 'barbara-outbound-cold';
  }
  
  // Inbound calls
  if (context === 'inbound') {
    return is_qualified ? 'barbara-inbound-qualified' : 'barbara-inbound-unqualified';
  }
  
  // Default fallback
  return 'barbara-fallback';
}

/**
 * Get prompt from cache or local file
 */
async function getPromptFromLocal(promptName, variables = {}) {
  // Check cache first
  const cached = promptCache.get(promptName);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`📋 Using cached prompt: ${promptName}`);
    return injectVariables(cached.prompt, variables);
  }
  
  // Load from local file
  const promptText = loadLocalPrompt(promptName);
  if (!promptText) {
    return null;
  }
  
  // Cache in memory
  promptCache.set(promptName, {
    prompt: promptText,
    timestamp: Date.now()
  });
  
  // Inject variables and return
  const injectedPrompt = injectVariables(promptText, variables);
  console.log(`📋 Loaded local prompt: ${promptName} (${injectedPrompt.length} chars)`);
  return injectedPrompt;
}

/**
 * Main function: Get the right prompt for this call
 */
async function getPromptForCall(callContext, customInstructions = null, variables = {}) {
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
  
  // Try to get from local files
  let promptFromLocal = await getPromptFromLocal(promptName, variables);
  
  if (promptFromLocal) {
    return promptFromLocal;
  }
  
  // No local prompt found - use minimal emergency prompt
  console.error(`❌ No local prompt found for '${promptName}' - using minimal emergency prompt`);
  return "You are Barbara, a warm and professional scheduling assistant for reverse mortgage consultations. Keep responses brief and friendly. Ask questions to understand their needs and help schedule a consultation.";
}

/**
 * Inject variables into prompt template
 * Supports Handlebars-style placeholders: {{variableName}}
 * 
 * THIS FUNCTION MUST NEVER THROW - it's critical for resilience
 */
function injectVariables(promptTemplate, variables) {
  try {
    let prompt = promptTemplate;
    
    // Add default values for common PromptLayer variables that might be missing
    const enrichedVariables = {
      ...variables,
      user_question: variables.user_question || '',  // Remove this placeholder if present
      user: variables.user || variables.leadFirstName || '',
      context: variables.context || variables.callContext || 'inbound',
      
      // PromptLayer template variables (provide defaults to prevent missing variable errors)
      brokerCompany: variables.brokerCompany || 'Equity Connect',
      brokerFirstName: variables.brokerFirstName || 'one of our advisors',
      brokerFullName: variables.brokerFullName || 'one of our advisors',
      brokerLastName: variables.brokerLastName || '',
      brokerPhone: variables.brokerPhone || '',
      broker_first_name: variables.broker_first_name || variables.brokerFirstName || 'one of our advisors',
      callContext: variables.callContext || 'inbound',
      equity50FormattedWords: variables.equity50FormattedWords || '',
      equity50Percent: variables.equity50Percent || '',
      equity60FormattedWords: variables.equity60FormattedWords || '',
      equity60Percent: variables.equity60Percent || '',
      estimatedEquity: variables.estimatedEquity || '',
      estimatedEquityWords: variables.estimatedEquityWords || '',
      leadAge: variables.leadAge || '',
      leadEmail: variables.leadEmail || '',
      leadFirstName: variables.leadFirstName || '',
      leadFullName: variables.leadFullName || '',
      leadLastName: variables.leadLastName || '',
      leadPhone: variables.leadPhone || '',
      mortgageBalance: variables.mortgageBalance || '',
      mortgageBalanceWords: variables.mortgageBalanceWords || '',
      ownerOccupied: variables.ownerOccupied || '',
      propertyAddress: variables.propertyAddress || '',
      propertyCity: variables.propertyCity || '',
      propertyState: variables.propertyState || '',
      propertyValue: variables.propertyValue || '',
      propertyValueWords: variables.propertyValueWords || '',
      propertyZipcode: variables.propertyZipcode || ''
    };
    
    // Replace all {{variableName}} placeholders
    // If a variable is missing, replace with empty string (don't break the prompt)
    Object.keys(enrichedVariables).forEach(key => {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const value = enrichedVariables[key] || '';
      prompt = prompt.replace(placeholder, value);
    });
    
    // Also replace any remaining {{variables}} that weren't in enrichedVariables
    // This ensures we don't send unfilled placeholders to OpenAI
    prompt = prompt.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      console.log(`⚠️ Variable {{${varName}}} not provided - replacing with empty string`);
      return '';
    });
    
    // Handle conditionals: {{#if variable}}...{{/if}}
    const conditionalRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    prompt = prompt.replace(conditionalRegex, (match, varName, content) => {
      return enrichedVariables[varName] ? content : '';
    });
    
    // Handle conditionals with else: {{#if variable}}...{{else}}...{{/if}}
    const conditionalElseRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
    prompt = prompt.replace(conditionalElseRegex, (match, varName, ifContent, elseContent) => {
      return enrichedVariables[varName] ? ifContent : elseContent;
    });
    
    return prompt;
    
  } catch (error) {
    // If variable injection somehow fails, return the template as-is
    // Better to have a prompt with unfilled variables than no prompt at all
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
 * Pre-warm the cache by loading all prompt variants
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
    await getPromptFromLocal(variant);
  }
  
  console.log('✅ Prompt cache pre-warmed');
}

/**
 * Diagnostic: List all available prompts from local folder
 */
async function listAllPrompts() {
  try {
    console.log('🔍 Listing all available prompts from local folder...');
    
    if (!fs.existsSync(PROMPTS_DIR)) {
      console.log('⚠️ Production Prompts directory not found');
      return [];
    }
    
    const files = fs.readdirSync(PROMPTS_DIR);
    const promptFiles = files.filter(file => file.endsWith('.md'));
    
    if (promptFiles.length === 0) {
      console.log('⚠️ No .md prompt files found in Production Prompts directory');
      return [];
    }
    
    console.log(`✅ Found ${promptFiles.length} prompt files:`);
    promptFiles.forEach((file, index) => {
      const promptName = file.replace('.md', '');
      console.log(`   ${index + 1}. ${promptName}`);
    });
    
    return promptFiles.map(file => ({ name: file.replace('.md', '') }));
    
  } catch (error) {
    console.error('❌ Failed to list prompts:', error.message);
    return [];
  }
}

module.exports = {
  getPromptForCall,
  injectVariables,
  determinePromptName,
  clearCache,
  prewarmCache,
  listAllPrompts
};

