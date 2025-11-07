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
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const ELEVENLABS_PHONE_NUMBER_ID = process.env.ELEVENLABS_PHONE_NUMBER_ID; // Default fallback number
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!BRIDGE_API_KEY) {
  app.log.error('BRIDGE_API_KEY environment variable is required');
  process.exit(1);
}

if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID || !ELEVENLABS_PHONE_NUMBER_ID) {
  app.log.error('ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, and ELEVENLABS_PHONE_NUMBER_ID environment variables are required for outbound calls');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  app.log.error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required for phone number pool lookup');
  process.exit(1);
}

if (!NYLAS_API_KEY) {
  app.log.warn('NYLAS_API_KEY not set - Nylas tools will not be available');
}

// Initialize Supabase client
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
        
        // Optional outbound number selection
        from_phone: {
          type: 'string',
          description: 'Optional SignalWire number to call FROM (e.g., "+14244851544"). If not provided, will use broker\'s assigned number pool or default number.'
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
      const { to_phone, from_phone, lead_id, broker_id, ...variables } = args;
      
      app.log.info({ to_phone, from_phone, lead_id, broker_id, hasVariables: Object.keys(variables).length }, '📞 Creating outbound call via ElevenLabs SIP trunk');
      
      try {
        // Normalize phone numbers to E.164 format
        const normalizedPhone = to_phone.startsWith('+') ? to_phone : `+1${to_phone.replace(/\D/g, '')}`;
        const normalizedFromPhone = from_phone ? (from_phone.startsWith('+') ? from_phone : `+1${from_phone.replace(/\D/g, '')}`) : null;
        
        // Look up ElevenLabs phone_number_id from Supabase
        let elevenlabsPhoneNumberId = ELEVENLABS_PHONE_NUMBER_ID; // Default fallback
        let selectedFromNumber = normalizedFromPhone;
        
        if (normalizedFromPhone) {
          // n8n provided a specific number - look it up in Supabase
          app.log.info({ from_phone: normalizedFromPhone }, '🔍 Looking up ElevenLabs phone_number_id for provided number');
          
          const { data: numberData, error: numberError } = await supabase
            .from('signalwire_phone_numbers')
            .select('elevenlabs_phone_number_id, number')
            .eq('number', normalizedFromPhone)
            .eq('status', 'active')
            .single();
          
          if (numberError || !numberData) {
            app.log.warn({ from_phone: normalizedFromPhone, error: numberError }, '⚠️  Number not found in pool, will try fallback');
          } else if (!numberData.elevenlabs_phone_number_id) {
            app.log.warn({ from_phone: normalizedFromPhone }, '⚠️  Number found but missing elevenlabs_phone_number_id, using default');
          } else {
            elevenlabsPhoneNumberId = numberData.elevenlabs_phone_number_id;
            selectedFromNumber = numberData.number;
            app.log.info({ elevenlabs_phone_number_id: elevenlabsPhoneNumberId, from_number: selectedFromNumber }, '✅ Using number from pool');
          }
        } else if (broker_id) {
          // n8n didn't provide a number - try to select from broker's pool
          app.log.info({ broker_id }, '🔍 Looking up broker\'s assigned numbers');
          
          const { data: brokerNumbers, error: brokerError } = await supabase
            .from('signalwire_phone_numbers')
            .select('elevenlabs_phone_number_id, number')
            .eq('assigned_broker_id', broker_id)
            .eq('status', 'active')
            .not('elevenlabs_phone_number_id', 'is', null)
            .limit(1);
          
          if (brokerError || !brokerNumbers || brokerNumbers.length === 0) {
            app.log.warn({ broker_id, error: brokerError }, '⚠️  No numbers found for broker, using default');
          } else {
            elevenlabsPhoneNumberId = brokerNumbers[0].elevenlabs_phone_number_id;
            selectedFromNumber = brokerNumbers[0].number;
            app.log.info({ broker_id, elevenlabs_phone_number_id: elevenlabsPhoneNumberId, from_number: selectedFromNumber }, '✅ Using broker\'s number');
          }
        }
        
        if (!selectedFromNumber) {
          app.log.info('📱 Using default number (no from_phone provided and no broker pool found)');
        }
        
        // Determine if lead is qualified (has property/equity data)
        const hasPropertyData = !!(variables.property_value || variables.estimated_equity);
        const isQualified = variables.qualified === true || hasPropertyData;
        
        app.log.info({ 
          hasPropertyData, 
          isQualified,
          property_value: variables.property_value,
          estimated_equity: variables.estimated_equity
        }, '🎯 Lead qualification determined');
        
        // Build dynamic variables for ElevenLabs personalization
        // These will be injected into the agent's prompt via {{variable_name}}
        const dynamicVariables = {
          // Lead info
          lead_id: lead_id || '',
          lead_first_name: variables.lead_first_name || '',
          lead_last_name: variables.lead_last_name || '',
          lead_full_name: variables.lead_full_name || '',
          lead_email: variables.lead_email || '',
          lead_phone: variables.lead_phone || normalizedPhone,
          
          // Property info
          property_address: variables.property_address || '',
          property_city: variables.property_city || '',
          property_state: variables.property_state || '',
          property_zipcode: variables.property_zipcode || '',
          property_value: variables.property_value || '',
          property_value_formatted: variables.property_value_formatted || '',
          
          // Equity calculations
          estimated_equity: variables.estimated_equity || '',
          estimated_equity_formatted: variables.estimated_equity_formatted || '',
          equity_50_percent: variables.equity_50_percent || '',
          equity_50_formatted: variables.equity_50_formatted || '',
          equity_60_percent: variables.equity_60_percent || '',
          equity_60_formatted: variables.equity_60_formatted || '',
          
          // Campaign and persona
          campaign_archetype: variables.campaign_archetype || '',
          persona_assignment: variables.persona_assignment || '',
          persona_sender_name: variables.persona_sender_name || '',
          
          // Broker info
          broker_id: broker_id || '',
          broker_company: variables.broker_company || '',
          broker_full_name: variables.broker_full_name || '',
          broker_nmls: variables.broker_nmls || '',
          broker_phone: variables.broker_phone || '',
          broker_display: variables.broker_display || '',
          
          // Qualification status
          qualified: isQualified ? 'true' : 'false',
          
          // Call context
          call_context: 'outbound',
          call_type: isQualified ? 'outbound-qualified' : 'outbound-unqualified'
        };
        
        app.log.info({ 
          dynamicVariables,
          callType: isQualified ? 'outbound-qualified' : 'outbound-unqualified'
        }, '📋 Dynamic variables prepared for ElevenLabs');
        
        // Call ElevenLabs SIP trunk outbound API
        const response = await fetch('https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call', {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            agent_id: ELEVENLABS_AGENT_ID,
            agent_phone_number_id: elevenlabsPhoneNumberId,
            to_number: normalizedPhone,
            conversation_initiation_client_data: {
              dynamic_variables: dynamicVariables
            }
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          app.log.info({ result }, '✅ Outbound call initiated successfully');
          return {
            content: [
              {
                type: 'text',
                text: `✅ Outbound Call Initiated Successfully!\n\n` +
                      `📞 Conversation ID: ${result.conversation_id || 'N/A'}\n` +
                      `📱 SIP Call ID: ${result.sip_call_id || 'N/A'}\n` +
                      `📞 From: ${selectedFromNumber || 'Default number'}\n` +
                      `📱 To: ${normalizedPhone}\n` +
                      `👤 Lead: ${variables.lead_full_name || variables.lead_first_name || 'Unknown'}\n` +
                      `🎯 Call Type: ${isQualified ? 'Outbound Qualified' : 'Outbound Unqualified'}\n` +
                      `💬 ${result.message || 'Call in progress'}`
              }
            ]
          };
        } else {
          app.log.error({ result }, '❌ ElevenLabs outbound call failed');
          return {
            content: [
              {
                type: 'text',
                text: `❌ Outbound call failed: ${result.message || 'Unknown error'}`
              }
            ],
            isError: true
          };
        }
      } catch (error) {
        app.log.error({ error }, '❌ ElevenLabs API error');
        return {
          content: [
            {
              type: 'text',
              text: `❌ ElevenLabs API error: ${error.message}`
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
