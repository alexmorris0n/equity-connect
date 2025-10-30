import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fastify from 'fastify';
import cors from '@fastify/cors';

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
    name: 'cancel_appointment',
    description: 'Cancel an existing appointment with a broker. Removes the Nylas calendar event and notifies all participants.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Lead UUID'
        }
      },
      required: ['lead_id']
    }
  },
  {
    name: 'reschedule_appointment',
    description: 'Reschedule an existing appointment to a new time. Updates the Nylas calendar event and sends updated invites to all participants.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Lead UUID'
        },
        new_scheduled_for: {
          type: 'string',
          description: 'New appointment date/time in ISO 8601 format (e.g., "2025-10-22T14:00:00Z")'
        }
      },
      required: ['lead_id', 'new_scheduled_for']
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
    
    case 'cancel_appointment': {
      app.log.info({ lead_id: args.lead_id }, '🗑️ Canceling appointment');
      
      try {
        const response = await fetch(`${BRIDGE_URL}/api/tools/cancel_appointment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BRIDGE_API_KEY}`
          },
          body: JSON.stringify(args)
        });
        
        const result = await response.json();
        
        if (result.success) {
          app.log.info('✅ Appointment cancelled');
          return {
            content: [
              {
                type: 'text',
                text: `✅ Appointment Cancelled Successfully!\n\n` +
                      `👤 Lead ID: ${args.lead_id}\n` +
                      `📅 Original Time: ${result.cancelled_appointment?.scheduled_for ? new Date(result.cancelled_appointment.scheduled_for).toLocaleString() : 'N/A'}\n` +
                      `🏢 Broker: ${result.cancelled_appointment?.broker_name || 'N/A'}\n` +
                      `💬 ${result.message}`
              }
            ]
          };
        } else {
          throw new Error(result.error || 'Appointment cancellation failed');
        }
      } catch (error) {
        app.log.error({ error }, '❌ Appointment cancellation error');
        return {
          content: [
            {
              type: 'text',
              text: `❌ Appointment cancellation failed: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
    
    case 'reschedule_appointment': {
      app.log.info({ lead_id: args.lead_id, new_time: args.new_scheduled_for }, '📅 Rescheduling appointment');
      
      try {
        const response = await fetch(`${BRIDGE_URL}/api/tools/reschedule_appointment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BRIDGE_API_KEY}`
          },
          body: JSON.stringify(args)
        });
        
        const result = await response.json();
        
        if (result.success) {
          app.log.info('✅ Appointment rescheduled');
          return {
            content: [
              {
                type: 'text',
                text: `✅ Appointment Rescheduled Successfully!\n\n` +
                      `👤 Lead ID: ${args.lead_id}\n` +
                      `📅 Old Time: ${result.old_scheduled_for ? new Date(result.old_scheduled_for).toLocaleString() : 'N/A'}\n` +
                      `📅 New Time: ${new Date(args.new_scheduled_for).toLocaleString()}\n` +
                      `📧 Calendar invite sent: ${result.calendar_invite_sent ? 'Yes' : 'No (email missing)'}\n` +
                      `💬 ${result.message}`
              }
            ]
          };
        } else {
          throw new Error(result.error || 'Appointment rescheduling failed');
        }
      } catch (error) {
        app.log.error({ error }, '❌ Appointment rescheduling error');
        return {
          content: [
            {
              type: 'text',
              text: `❌ Appointment rescheduling failed: ${error.message}`
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
        // Determine if lead is qualified (has property/equity data)
        const hasPropertyData = !!(variables.property_value || variables.estimated_equity);
        const isQualified = variables.qualified === true || hasPropertyData;
        
        app.log.info({ 
          hasPropertyData, 
          isQualified,
          property_value: variables.property_value,
          estimated_equity: variables.estimated_equity
        }, '🎯 Lead qualification determined');
        
        // Build lead context to pass to bridge
        // The bridge will use its prompt-manager to select the correct PromptLayer template
        const leadContext = {
          qualified: isQualified,
          first_name: variables.lead_first_name || '',
          last_name: variables.lead_last_name || '',
          primary_email: variables.lead_email || '',
          property_city: variables.property_city || '',
          property_state: variables.property_state || '',
          property_value: variables.property_value || null,
          estimated_equity: variables.estimated_equity || null,
          mortgage_balance: variables.mortgage_balance || null
        };
        
        app.log.info({ 
          leadContext,
          willUsePrompt: isQualified ? 'barbara-outbound-warm' : 'barbara-outbound-cold'
        }, '📋 Sending lead context to bridge for PromptLayer selection');
        
        // Call the bridge API - it will handle PromptLayer prompt selection
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
            lead_context: leadContext  // Bridge will use this for prompt selection
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
                      `🎯 Prompt: ${isQualified ? 'barbara-outbound-warm' : 'barbara-outbound-cold'} (selected by bridge)\n` +
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
