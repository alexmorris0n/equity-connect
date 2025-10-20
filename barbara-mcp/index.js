import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load hybrid prompt template (handles both inbound and outbound)
const HYBRID_PROMPT_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '../prompts/BarbaraRealtimePrompt'),
  'utf8'
);

// Initialize Fastify for HTTP streaming transport
const app = fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  }
});

// Register CORS
await app.register(cors, {
  origin: true,
  credentials: true
});

// Environment variables
const BRIDGE_URL = process.env.BRIDGE_URL || 'https://bridge.northflank.app';
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;

if (!BRIDGE_API_KEY) {
  app.log.error('BRIDGE_API_KEY environment variable is required');
  process.exit(1);
}

/**
 * Convert number to words (for Barbara to speak naturally)
 * Examples: 1500000 -> "one point five million", 750000 -> "seven hundred fifty thousand"
 */
function numberToWords(value) {
  if (!value || value === 0) return 'zero';
  
  const num = parseInt(value);
  
  // Handle millions
  if (num >= 1000000) {
    const millions = num / 1000000;
    if (millions === Math.floor(millions)) {
      return `${millions === 1 ? 'one' : millions} million`;
    } else {
      return `${millions.toFixed(1)} million`;
    }
  }
  
  // Handle thousands
  if (num >= 1000) {
    const thousands = num / 1000;
    if (thousands === Math.floor(thousands)) {
      return `${numberWord(thousands)} thousand`;
    } else {
      return `${thousands.toFixed(0)} thousand`;
    }
  }
  
  return numberWord(num);
}

/**
 * Convert single numbers to words (1-999)
 */
function numberWord(num) {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const tenPart = Math.floor(num / 10);
    const onePart = num % 10;
    return tens[tenPart] + (onePart > 0 ? ' ' + ones[onePart] : '');
  }
  
  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;
  return ones[hundreds] + ' hundred' + (remainder > 0 ? ' ' + numberWord(remainder) : '');
}

/**
 * Build customized prompt by replacing handlebars-style placeholders
 */
function buildCustomPrompt(variables) {
  let prompt = HYBRID_PROMPT_TEMPLATE;
  
  // Helper to safely replace placeholders
  const replace = (key, value) => {
    const placeholder = `{{${key}}}`;
    const safeValue = value || '';
    prompt = prompt.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), safeValue);
  };
  
  // Handle handlebars conditionals (simple implementation)
  // {{#if propertyCity}}...{{/if}}
  const conditionalRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  prompt = prompt.replace(conditionalRegex, (match, varName, content) => {
    return variables[varName] ? content : '';
  });
  
  // {{#if personaFirstName}}...{{else}}...{{/if}}
  const conditionalElseRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
  prompt = prompt.replace(conditionalElseRegex, (match, varName, ifContent, elseContent) => {
    return variables[varName] ? ifContent : elseContent;
  });
  
  // Replace all variable placeholders
  Object.keys(variables).forEach(key => {
    replace(key, variables[key]);
  });
  
  return prompt;
}

/**
 * Extract first name from full name
 */
function extractFirstName(fullName) {
  if (!fullName) return '';
  return fullName.split(' ')[0];
}

// Tool definitions
const tools = [
  {
    name: 'create_outbound_call',
    description: 'Create an outbound call to a lead using Barbara AI voice assistant with full personalization',
    inputSchema: {
      type: 'object',
      properties: {
        // Required fields
        to_phone: {
          type: 'string',
          description: 'Phone number to call (will be normalized to E.164 format)'
        },
        lead_id: {
          type: 'string',
          description: 'Lead ID from the database'
        },
        
        // Optional broker
        broker_id: {
          type: 'string',
          description: 'Optional broker ID (if not provided, will use lead\'s assigned broker)'
        },
        
        // Lead information (27 variables for customization)
        lead_first_name: { type: 'string', description: 'Lead first name' },
        lead_last_name: { type: 'string', description: 'Lead last name' },
        lead_full_name: { type: 'string', description: 'Lead full name' },
        lead_email: { type: 'string', description: 'Lead email address' },
        lead_phone: { type: 'string', description: 'Lead phone number' },
        
        // Property information
        property_address: { type: 'string', description: 'Property street address' },
        property_city: { type: 'string', description: 'Property city' },
        property_state: { type: 'string', description: 'Property state' },
        property_zipcode: { type: 'string', description: 'Property ZIP code' },
        property_value: { type: 'string', description: 'Property value (numeric)' },
        property_value_formatted: { type: 'string', description: 'Property value formatted (e.g., "1.2M")' },
        
        // Equity calculations
        estimated_equity: { type: 'string', description: 'Estimated equity (numeric)' },
        estimated_equity_formatted: { type: 'string', description: 'Estimated equity formatted (e.g., "1M")' },
        equity_50_percent: { type: 'string', description: '50% of equity (numeric)' },
        equity_50_formatted: { type: 'string', description: '50% equity formatted (e.g., "500K")' },
        equity_60_percent: { type: 'string', description: '60% of equity (numeric)' },
        equity_60_formatted: { type: 'string', description: '60% equity formatted (e.g., "600K")' },
        
        // Campaign and persona
        campaign_archetype: { type: 'string', description: 'Campaign archetype' },
        persona_assignment: { type: 'string', description: 'Assigned persona type' },
        persona_sender_name: { type: 'string', description: 'Persona full name (e.g., "Carlos Rodriguez")' },
        
        // Broker information
        broker_company: { type: 'string', description: 'Broker company name' },
        broker_full_name: { type: 'string', description: 'Broker full name' },
        broker_nmls: { type: 'string', description: 'Broker NMLS number' },
        broker_phone: { type: 'string', description: 'Broker phone number' },
        broker_display: { type: 'string', description: 'Broker display name with NMLS' },
        
        // Call context
        call_context: { type: 'string', description: 'Call context (always "outbound" for this tool)' }
      },
      required: ['to_phone', 'lead_id']
    }
  }
];

// Tool execution function
async function executeTool(name, args) {
  switch (name) {
    case 'create_outbound_call': {
      const { to_phone, lead_id, broker_id, ...variables } = args;
      
      app.log.info({ to_phone, lead_id, broker_id, hasVariables: Object.keys(variables).length }, '📞 Creating outbound call');
      
      try {
        // Extract first names for Barbara's use
        const brokerFirstName = extractFirstName(variables.broker_full_name);
        const personaFirstName = extractFirstName(variables.persona_sender_name);
        
        // Convert numeric values to words for speech
        const propertyValueWords = variables.property_value ? numberToWords(variables.property_value) : '';
        const estimatedEquityWords = variables.estimated_equity ? numberToWords(variables.estimated_equity) : '';
        const equity50Words = variables.equity_50_percent ? numberToWords(variables.equity_50_percent) : '';
        const equity60Words = variables.equity_60_percent ? numberToWords(variables.equity_60_percent) : '';
        
        // Build complete variables object for prompt injection
        const promptVariables = {
          // Lead info
          leadFirstName: variables.lead_first_name || '',
          leadLastName: variables.lead_last_name || '',
          leadFullName: variables.lead_full_name || '',
          leadEmail: variables.lead_email || '',
          leadPhone: variables.lead_phone || to_phone,
          
          // Property info
          propertyAddress: variables.property_address || '',
          propertyCity: variables.property_city || '',
          propertyState: variables.property_state || '',
          propertyZipcode: variables.property_zipcode || '',
          propertyValue: variables.property_value || '',
          propertyValueWords: propertyValueWords,
          mortgageBalanceWords: variables.mortgage_balance ? numberToWords(variables.mortgage_balance) : '',
          
          // Equity
          estimatedEquity: variables.estimated_equity || '',
          estimatedEquityWords: estimatedEquityWords,
          equity50Percent: variables.equity_50_percent || '',
          equity50FormattedWords: equity50Words,
          equity60Percent: variables.equity_60_percent || '',
          equity60FormattedWords: equity60Words,
          
          // Campaign
          campaignArchetype: variables.campaign_archetype || 'direct',
          personaAssignment: variables.persona_assignment || 'general',
          personaSenderName: variables.persona_sender_name || '',
          personaFirstName: personaFirstName,
          
          // Broker
          brokerCompany: variables.broker_company || '',
          brokerFullName: variables.broker_full_name || '',
          brokerFirstName: brokerFirstName,
          brokerNmls: variables.broker_nmls || '',
          brokerPhone: variables.broker_phone || '',
          brokerDisplay: variables.broker_display || '',
          
          // Context - CRITICAL: determines inbound vs outbound flow
          callContext: variables.call_context || 'outbound'
        };
        
        // Build customized prompt
        const customizedPrompt = buildCustomPrompt(promptVariables);
        
        app.log.info({ 
          promptLength: customizedPrompt.length,
          hasCity: !!promptVariables.propertyCity,
          hasPersona: !!promptVariables.personaFirstName 
        }, '📝 Built customized prompt');
        
        // Call the bridge API with customized prompt
        const response = await fetch(`${BRIDGE_URL}/api/outbound-call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BRIDGE_API_KEY}`
          },
          body: JSON.stringify({
            to_phone,
            lead_id,
            broker_id,
            instructions: customizedPrompt  // Pass customized prompt to bridge
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          app.log.info({ result }, '✅ Call created successfully');
          return {
            content: [
              {
                type: 'text',
                text: `✅ Call created successfully!\n\n` +
                      `📞 Call ID: ${result.call_id}\n` +
                      `📱 From: ${result.from}\n` +
                      `📱 To: ${result.to}\n` +
                      `👤 Lead: ${promptVariables.leadFirstName} ${promptVariables.leadLastName}\n` +
                      `🏢 Broker: ${promptVariables.brokerFirstName}\n` +
                      `💬 Message: ${result.message}`
              }
            ]
          };
        } else {
          app.log.error({ result }, '❌ Call creation failed');
          return {
            content: [
              {
                type: 'text',
                text: `❌ Call creation failed: ${result.message}`
              }
            ],
            isError: true
          };
        }
      } catch (error) {
        app.log.error({ error }, '❌ Bridge API error');
        return {
          content: [
            {
              type: 'text',
              text: `❌ Bridge API error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Health check endpoint
app.get('/health', async (request, reply) => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

// MCP endpoint for n8n
app.post('/mcp', async (request, reply) => {
  const { id = null, jsonrpc = '2.0', method, params = {} } = request.body || {};

  app.log.info({ method, params, id }, '🔧 MCP request received');

  const respond = (payload) => {
    return reply.send({ jsonrpc: '2.0', id, ...payload });
  };

  try {
    switch (method) {
      case 'initialize': {
        return respond({
          result: {
            protocolVersion: '2025-03-26',
            capabilities: {
              tools: {
                list: true,
                call: true
              }
            },
            serverInfo: {
              name: 'barbara-mcp',
              version: '2.0.0'
            }
          }
        });
      }

      case 'tools/list': {
        return respond({
          result: {
            tools: tools.map(tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema
            }))
          }
        });
      }

      case 'tools/call': {
        const { name, arguments: args } = params;
        if (!name) {
          return respond({
            error: {
              code: -32602,
              message: 'Missing tool name in request'
            }
          });
        }

        const toolResult = await executeTool(name, args || {});
        return respond({ result: toolResult });
      }

      default:
        return respond({
          error: {
            code: -32601,
            message: `Unknown method: ${method}`
          }
        });
    }
  } catch (error) {
    app.log.error({ error }, '❌ MCP request error');
    return respond({
      error: {
        code: -32000,
        message: error.message || 'Internal MCP error'
      }
    });
  }
});

// Start server
const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

app.listen({ port, host }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`🚀 Barbara MCP Server v2.0 running on ${address}`);
  app.log.info(`📡 Bridge URL: ${BRIDGE_URL}`);
  app.log.info(`🔧 MCP endpoint: ${address}/mcp`);
  app.log.info(`📝 Outbound prompt loaded (${OUTBOUND_PROMPT_TEMPLATE.length} chars)`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  app.log.info('🛑 Shutting down gracefully...');
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  app.log.info('🛑 Shutting down gracefully...');
  await app.close();
  process.exit(0);
});
