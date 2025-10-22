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

// Disk cache directory for PromptLayer templates
const CACHE_DIR = path.join(__dirname, '.promptlayer-cache');

// Ensure cache directory exists
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('⚠️ Could not create PromptLayer cache directory:', err.message);
}

/**
 * Save PromptLayer template to disk cache
 */
function saveToDiskCache(promptName, promptText) {
  try {
    const cachePath = path.join(CACHE_DIR, `${promptName}.txt`);
    fs.writeFileSync(cachePath, promptText, 'utf8');
    console.log(`🍰 Cached PromptLayer template to disk: ${promptName}`);
  } catch (err) {
    console.warn(`⚠️ Failed to cache template ${promptName}:`, err.message);
  }
}

/**
 * Load PromptLayer template from disk cache
 */
function loadFromDiskCache(promptName) {
  try {
    const cachePath = path.join(CACHE_DIR, `${promptName}.txt`);
    if (fs.existsSync(cachePath)) {
      const cached = fs.readFileSync(cachePath, 'utf8');
      console.log(`🍰 Loaded cached PromptLayer template: ${promptName} (${cached.length} chars)`);
      return cached;
    }
  } catch (err) {
    console.warn(`⚠️ Failed to load cached template ${promptName}:`, err.message);
  }
  return null;
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
  
  // Outbound calls
  if (context === 'outbound') {
    if (is_qualified || (lead_id && has_property_data)) {
      return 'barbara-outbound-warm';
    }
    return 'barbara-outbound-cold';
  }
  
  // Inbound calls
  if (context === 'inbound') {
    if (is_qualified || (lead_id && has_property_data)) {
      return 'barbara-inbound-qualified';
    }
    return 'barbara-inbound-unqualified';
  }
  
  // Default fallback
  return 'barbara-fallback';
}

/**
 * Get prompt from cache or PromptLayer
 */
async function getPromptFromPromptLayer(promptName, variables = {}) {
  // Check cache first
  const cached = promptCache.get(promptName);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`📋 Using cached prompt: ${promptName}`);
    return injectVariables(cached.prompt, variables);
  }
  
  try {
    const promptLayer = initPromptLayer();
    
    if (!promptLayer.enabled) {
      console.log('⚠️ PromptLayer disabled, using local fallback');
      return null;
    }
    
    // Try fetching prompt template from PromptLayer
    // First attempt: no label (gets latest version)
    let result = null;
    try {
      console.log(`🍰 Fetching prompt from PromptLayer: ${promptName} (latest version)`);
      result = await promptLayer.client.templates.get(promptName);
    } catch (firstAttemptError) {
      // If that fails, try with "prod" label
      try {
        console.log(`🔍 First attempt failed, trying with label: "prod"`);
        result = await promptLayer.client.templates.get(promptName, {
          label: 'prod'
        });
      } catch (secondAttemptError) {
        console.warn(`⚠️ Prompt '${promptName}' not found in PromptLayer`);
        console.warn(`   Error (no label): ${firstAttemptError.message}`);
        console.warn(`   Error (prod label): ${secondAttemptError.message}`);
        return null;
      }
    }
    
    if (!result || !result.prompt_template) {
      console.warn(`⚠️ Prompt '${promptName}' returned empty from PromptLayer`);
      console.log('   Full response:', JSON.stringify(result).substring(0, 500));
      return null;
    }
    
    // DEBUG: Log the full response structure
    console.log(`🔍 DEBUG - Full PromptLayer response for ${promptName}:`, {
      keys: Object.keys(result),
      prompt_template_type: typeof result.prompt_template,
      prompt_template_keys: typeof result.prompt_template === 'object' ? Object.keys(result.prompt_template) : 'N/A',
      prompt_template_value: typeof result.prompt_template === 'string' ? result.prompt_template.substring(0, 100) : result.prompt_template
    });
    
    // Extract prompt text from template
    let promptText = '';
    
    // PromptLayer templates can be in different formats
    // Format 1: content array with text blocks (current PromptLayer format)
    if (result.prompt_template?.content && Array.isArray(result.prompt_template.content)) {
      promptText = result.prompt_template.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
    }
    // Format 2: Direct string
    else if (typeof result.prompt_template === 'string') {
      promptText = result.prompt_template;
    }
    // Format 3: Chat format - extract ONLY system message for Realtime API
    else if (result.prompt_template?.messages && Array.isArray(result.prompt_template.messages)) {
      console.log(`🔍 DEBUG - Extracting from messages array (${result.prompt_template.messages.length} messages)`);
      
      // For Realtime API, we only want the system message
      // User messages with {{user_question}} are for chat completion API, not realtime
      const systemMessages = result.prompt_template.messages.filter(m => m.role === 'system');
      
      if (systemMessages.length === 0) {
        console.warn('⚠️ No system message found in PromptLayer template - falling back to concatenating all messages');
        // Fallback: concatenate all messages
        promptText = result.prompt_template.messages
          .map((m, i) => {
            let content = '';
            
            if (typeof m.content === 'string') {
              content = m.content;
            } else if (Array.isArray(m.content)) {
              content = m.content
                .filter(c => c.type === 'text' || typeof c === 'string')
                .map(c => typeof c === 'string' ? c : c.text)
                .join('\n');
            } else if (typeof m.content === 'object' && m.content) {
              content = m.content.text || JSON.stringify(m.content);
            }
            
            console.log(`   Message ${i} (role: ${m.role}): ${content.substring(0, 50)}...`);
            return content;
          })
          .join('\n\n');
      } else {
        // Extract only system messages
        promptText = systemMessages
          .map((m, i) => {
            let content = '';
            
            if (typeof m.content === 'string') {
              content = m.content;
            } else if (Array.isArray(m.content)) {
              content = m.content
                .filter(c => c.type === 'text' || typeof c === 'string')
                .map(c => typeof c === 'string' ? c : c.text)
                .join('\n');
            } else if (typeof m.content === 'object' && m.content) {
              content = m.content.text || JSON.stringify(m.content);
            }
            
            console.log(`   System Message ${i}: ${content.substring(0, 50)}...`);
            return content;
          })
          .join('\n\n');
        
        console.log(`✅ Extracted ${systemMessages.length} system message(s), ignoring ${result.prompt_template.messages.length - systemMessages.length} user/assistant messages`);
      }
    }
    // Format 4: Plain prompt field
    else if (result.prompt_template?.prompt) {
      promptText = result.prompt_template.prompt;
    }
    // Format 5: system_prompt field
    else if (result.prompt_template?.system_prompt) {
      promptText = result.prompt_template.system_prompt;
    }
    // Format 6: template field
    else if (result.prompt_template?.template) {
      promptText = result.prompt_template.template;
    }
    // Format 7: content field
    else if (result.prompt_template?.content && typeof result.prompt_template.content === 'string') {
      promptText = result.prompt_template.content;
    }
    
    if (!promptText) {
      console.warn(`⚠️ Could not extract prompt text from '${promptName}'`);
      console.warn(`   Available keys in prompt_template:`, Object.keys(result.prompt_template || {}));
      console.warn(`   Full structure:`, JSON.stringify(result.prompt_template).substring(0, 200));
      return null;
    }
    
    // Cache in memory
    promptCache.set(promptName, {
      prompt: promptText,
      timestamp: Date.now()
    });
    
    // Inject variables BEFORE returning (fixes PromptLayer validation)
    const injectedPrompt = injectVariables(promptText, variables);
    
    // Cache to disk for fallback
    saveToDiskCache(promptName, injectedPrompt);
    
    console.log(`🍰 Fetched prompt from PromptLayer: ${promptName} (${injectedPrompt.length} chars)`);
    return injectedPrompt;
    
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
  
  // Try to get from PromptLayer with variables injected
  let promptFromPL = await getPromptFromPromptLayer(promptName, variables);
  
  if (promptFromPL) {
    return promptFromPL;
  }
  
  // PromptLayer failed - try disk cache
  console.warn(`⚠️ PromptLayer unavailable for '${promptName}', trying disk cache...`);
  const cachedPrompt = loadFromDiskCache(promptName);
  
  if (cachedPrompt) {
    console.log(`🍰 Using cached PromptLayer template: ${promptName}`);
    return cachedPrompt;
  }
  
  // No cache - use minimal emergency prompt
  console.error(`❌ No cached template for '${promptName}' - using minimal emergency prompt`);
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
      leadEmail: variables.leadEmail || '',
      leadFirstName: variables.leadFirstName || '',
      leadFullName: variables.leadFullName || '',
      leadLastName: variables.leadLastName || '',
      leadPhone: variables.leadPhone || '',
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

/**
 * Diagnostic: List all available prompts from PromptLayer
 */
async function listAllPrompts() {
  try {
    const promptLayer = initPromptLayer();
    
    if (!promptLayer.enabled) {
      console.log('⚠️ PromptLayer disabled (no API key)');
      return [];
    }
    
    console.log('🔍 Fetching all available prompts from PromptLayer...');
    const allPrompts = await promptLayer.client.templates.all();
    
    if (!allPrompts || allPrompts.length === 0) {
      console.log('⚠️ No prompts found in PromptLayer');
      return [];
    }
    
    console.log(`✅ Found ${allPrompts.length} prompts:`);
    allPrompts.forEach((prompt, index) => {
      console.log(`   ${index + 1}. ${prompt.name || prompt.id}`);
      if (prompt.release_labels) {
        console.log(`      Labels: ${prompt.release_labels.join(', ')}`);
      }
      if (prompt.version) {
        console.log(`      Version: ${prompt.version}`);
      }
    });
    
    return allPrompts;
    
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

