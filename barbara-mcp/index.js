import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import bridge's prompt manager for PromptLayer integration
const require = createRequire(import.meta.url);
const { getPromptForCall, injectVariables } = require('../bridge/prompt-manager.js');

// Load hybrid prompt template as fallback only
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
const NYLAS_API_KEY = process.env.NYLAS_API_KEY;
const NYLAS_API_URL = process.env.NYLAS_API_URL || 'https://api.us.nylas.com';

if (!BRIDGE_API_KEY) {
  app.log.error('BRIDGE_API_KEY environment variable is required');
  process.exit(1);
}

if (!NYLAS_API_KEY) {
  app.log.warn('NYLAS_API_KEY not set - Nylas tools will not be available');
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
    name: 'check_broker_availability',
    description: 'Check broker calendar availability using Nylas Free/Busy API. Returns available time slots for the next 14 days with smart prioritization (today > tomorrow > next week). Business hours: 10 AM - 5 PM with 2-hour minimum notice.',
    inputSchema: {
      type: 'object',
      properties: {
        broker_id: {
          type: 'string',
          description: 'Broker UUID to check availability for'
        },
        preferred_day: {
          type: 'string',
          enum: ['any', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          description: 'Preferred day of week (optional, default: any)'
        },
        preferred_time: {
          type: 'string',
          enum: ['any', 'morning', 'afternoon'],
          description: 'Preferred time of day (optional, default: any). Morning = 10 AM-12 PM, Afternoon = 12 PM-5 PM'
        }
      },
      required: ['broker_id']
    }
  },
  {
    name: 'book_appointment',
    description: 'Book an appointment with a broker using Nylas Events API. Creates calendar event on broker\'s calendar and sends calendar invite to lead (if email provided).',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Lead UUID'
        },
        broker_id: {
          type: 'string',
          description: 'Broker UUID'
        },
        scheduled_for: {
          type: 'string',
          description: 'Appointment date/time in ISO 8601 format (e.g., "2025-10-22T10:00:00Z")'
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the appointment (e.g., "Interested in accessing equity for medical expenses")'
        }
      },
      required: ['lead_id', 'broker_id', 'scheduled_for']
    }
  },
  {
    name: 'update_lead_info',
    description: 'Update lead contact information in the database. Used to collect or correct phone, email, name, address, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Lead UUID'
        },
        primary_phone: {
          type: 'string',
          description: 'Primary phone number (E.164 format recommended)'
        },
        primary_email: {
          type: 'string',
          description: 'Primary email address'
        },
        first_name: {
          type: 'string',
          description: 'First name'
        },
        last_name: {
          type: 'string',
          description: 'Last name'
        },
        city: {
          type: 'string',
          description: 'City'
        },
        state: {
          type: 'string',
          description: 'State'
        },
        zipcode: {
          type: 'string',
          description: 'ZIP code'
        },
        age: {
          type: 'number',
          description: 'Age'
        },
        property_value: {
          type: 'number',
          description: 'Estimated property value'
        },
        mortgage_balance: {
          type: 'number',
          description: 'Current mortgage balance'
        }
      },
      required: ['lead_id']
    }
  },
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
        
        // Qualification status
        qualified: { type: 'boolean', description: 'Whether lead is qualified (has property/equity data or marked qualified in DB)' },
        
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
    case 'check_broker_availability': {
      app.log.info({ broker_id: args.broker_id }, '📅 Checking broker availability');
      
      try {
        const response = await fetch(`${BRIDGE_URL}/api/tools/check_broker_availability`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BRIDGE_API_KEY}`
          },
          body: JSON.stringify(args)
        });
        
        const result = await response.json();
        
        if (result.success) {
          app.log.info({ slots: result.available_slots?.length }, '✅ Availability checked');
          return {
            content: [
              {
                type: 'text',
                text: `✅ Availability Check Complete\n\n` +
                      `📅 Broker: ${result.broker_name}\n` +
                      `⏰ Available Slots: ${result.available_slots?.length || 0}\n` +
                      `💬 ${result.message}\n\n` +
                      `📋 Slots:\n` +
                      (result.available_slots || []).slice(0, 5).map(slot => 
                        `  • ${slot.display}${slot.is_same_day ? ' (TODAY)' : slot.is_tomorrow ? ' (TOMORROW)' : ''}`
                      ).join('\n')
              }
            ]
          };
        } else {
          throw new Error(result.error || 'Availability check failed');
        }
      } catch (error) {
        app.log.error({ error }, '❌ Availability check error');
        return {
          content: [
            {
              type: 'text',
              text: `❌ Availability check failed: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
    
    case 'book_appointment': {
      app.log.info({ lead_id: args.lead_id, broker_id: args.broker_id }, '📅 Booking appointment');
      
      try {
        const response = await fetch(`${BRIDGE_URL}/api/tools/book_appointment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BRIDGE_API_KEY}`
          },
          body: JSON.stringify(args)
        });
        
        const result = await response.json();
        
        if (result.success) {
          app.log.info({ appointment_id: result.appointment_id }, '✅ Appointment booked');
          return {
            content: [
              {
                type: 'text',
                text: `✅ Appointment Booked Successfully!\n\n` +
                      `📅 Time: ${new Date(args.scheduled_for).toLocaleString()}\n` +
                      `👤 Lead ID: ${args.lead_id}\n` +
                      `🏢 Broker ID: ${args.broker_id}\n` +
                      `📧 Calendar invite sent: ${result.calendar_invite_sent ? 'Yes' : 'No (email missing)'}\n` +
                      `📝 Notes: ${args.notes || 'None'}`
              }
            ]
          };
        } else {
          throw new Error(result.error || 'Appointment booking failed');
        }
      } catch (error) {
        app.log.error({ error }, '❌ Appointment booking error');
        return {
          content: [
            {
              type: 'text',
              text: `❌ Appointment booking failed: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
    
    case 'update_lead_info': {
      app.log.info({ lead_id: args.lead_id, updates: Object.keys(args).filter(k => k !== 'lead_id') }, '📝 Updating lead info');
      
      try {
        const response = await fetch(`${BRIDGE_URL}/api/tools/update_lead_info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BRIDGE_API_KEY}`
          },
          body: JSON.stringify(args)
        });
        
        const result = await response.json();
        
        if (result.success) {
          app.log.info('✅ Lead info updated');
          const updates = Object.keys(args).filter(k => k !== 'lead_id');
          return {
            content: [
              {
                type: 'text',
                text: `✅ Lead Info Updated Successfully!\n\n` +
                      `👤 Lead ID: ${args.lead_id}\n` +
                      `📝 Updated fields: ${updates.join(', ')}`
              }
            ]
          };
        } else {
          throw new Error(result.error || 'Lead info update failed');
        }
      } catch (error) {
        app.log.error({ error }, '❌ Lead info update error');
        return {
          content: [
            {
              type: 'text',
              text: `❌ Lead info update failed: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
    
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
        
        // Determine if lead is qualified (has property/equity data)
        const hasPropertyData = !!(variables.property_value || variables.estimated_equity);
        const isQualified = variables.qualified === true || hasPropertyData;
        
        app.log.info({ 
          hasPropertyData, 
          isQualified,
          property_value: variables.property_value,
          estimated_equity: variables.estimated_equity
        }, '🎯 Lead qualification determined');
        
        // Build call context for PromptLayer
        const callContext = {
          context: 'outbound',
          lead_id: lead_id,
          has_property_data: hasPropertyData,
          is_qualified: isQualified
        };
        
        // Fetch the correct prompt from PromptLayer
        // This will return either 'barbara-outbound-warm' or 'barbara-outbound-cold'
        app.log.info({ callContext }, '🔍 Fetching prompt from PromptLayer');
        const promptTemplate = await getPromptForCall(callContext, null);
        
        if (!promptTemplate) {
          throw new Error('Failed to fetch prompt from PromptLayer');
        }
        
        app.log.info({ 
          promptLength: promptTemplate.length,
          isQualified 
        }, `📋 Using ${isQualified ? 'barbara-outbound-warm' : 'barbara-outbound-cold'}`);
        
        // Build complete variables object for prompt injection
        const promptVariables = {
          // Call context
          callContext: 'outbound',
          signalwireNumber: '',  // Will be populated by bridge from selected number
          
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
          
          // Qualification flag
          qualified: isQualified
        };
        
        // Inject variables into PromptLayer template
        const customizedPrompt = injectVariables(promptTemplate, promptVariables);
        
        app.log.info({ 
          finalPromptLength: customizedPrompt.length,
          hasCity: !!promptVariables.propertyCity,
          hasPersona: !!promptVariables.personaFirstName 
        }, '📝 Injected variables into PromptLayer template');
        
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
            instructions: customizedPrompt  // Pass PromptLayer-sourced prompt to bridge
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
                      `🎯 Prompt: ${isQualified ? 'barbara-outbound-warm' : 'barbara-outbound-cold'}\n` +
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
