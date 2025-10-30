import {
  getLeadContextTool,
  checkConsentDNCTool,
  updateLeadInfoTool,
  findBrokerByTerritoryTool,
  checkBrokerAvailabilityTool,
  bookAppointmentTool,
  cancelAppointmentTool,
  rescheduleAppointmentTool,
  assignTrackingNumberTool,
  searchKnowledgeTool
} from '../tools/business/index.js';
import { logger } from '../utils/logger.js';

type ToolExecutor = (args: any) => Promise<any>;

function wrapToolExecution(tool: any): ToolExecutor {
  return async (args: any) => {
    try {
      const parsedArgs = tool?.parameters ? tool.parameters.parse(args) : args;
      const result = await tool.execute(parsedArgs);
      return safeParseJson(result);
    } catch (error) {
      logger.error(`Tool execution failed for ${tool.name}:`, error);
      return {
        error: true,
        message: `Failed to execute ${tool.name}`
      };
    }
  };
}

function safeParseJson(payload: string) {
  try {
    return JSON.parse(payload);
  } catch (error) {
    return { raw: payload };
  }
}

export const smsToolExecutors: Record<string, ToolExecutor> = {
  get_lead_context: wrapToolExecution(getLeadContextTool),
  check_consent_dnc: wrapToolExecution(checkConsentDNCTool),
  update_lead_info: wrapToolExecution(updateLeadInfoTool),
  find_broker_by_territory: wrapToolExecution(findBrokerByTerritoryTool),
  check_broker_availability: wrapToolExecution(checkBrokerAvailabilityTool),
  book_appointment: wrapToolExecution(bookAppointmentTool),
  cancel_appointment: wrapToolExecution(cancelAppointmentTool),
  reschedule_appointment: wrapToolExecution(rescheduleAppointmentTool),
  assign_tracking_number: wrapToolExecution(assignTrackingNumberTool),
  search_knowledge: wrapToolExecution(searchKnowledgeTool)
};

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export const smsToolDefinitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_lead_context',
      description: 'Get lead information by phone number to personalize the conversation.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Phone number of the lead (any format).' }
        },
        required: ['phone']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_consent_dnc',
      description: 'Check if lead has consented to contact and is not on DNC list.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: { type: 'string', description: 'Lead UUID returned from get_lead_context.' }
        },
        required: ['lead_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_lead_info',
      description: 'Update lead profile fields captured during the conversation.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: { type: 'string' },
          last_name: { type: 'string', nullable: true },
          property_address: { type: 'string', nullable: true },
          age: { type: 'number', nullable: true },
          property_value: { type: 'number', nullable: true },
          mortgage_balance: { type: 'number', nullable: true },
          owner_occupied: { type: 'boolean', nullable: true }
        },
        required: ['lead_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'find_broker_by_territory',
      description: 'Find the appropriate broker for a lead based on their location.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', nullable: true },
          zip_code: { type: 'string', nullable: true }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_broker_availability',
      description: 'Check broker calendar availability for appointment scheduling.',
      parameters: {
        type: 'object',
        properties: {
          broker_id: { type: 'string' },
          preferred_day: {
            type: 'string',
            nullable: true,
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
          },
          preferred_time: {
            type: 'string',
            nullable: true,
            enum: ['morning', 'afternoon', 'evening']
          }
        },
        required: ['broker_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Book an appointment with the broker and send calendar invites.',
      parameters: {
        type: 'object',
        properties: {
          broker_id: { type: 'string' },
          lead_id: { type: 'string' },
          scheduled_for: { type: 'string' },
          notes: { type: 'string', nullable: true }
        },
        required: ['broker_id', 'lead_id', 'scheduled_for']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Cancel an existing appointment. Removes calendar event from broker\'s calendar and notifies all participants.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: { type: 'string', description: 'Lead UUID' }
        },
        required: ['lead_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_appointment',
      description: 'Reschedule an existing appointment to a new time. Updates calendar event and sends updated invites to all participants.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: { type: 'string', description: 'Lead UUID' },
          new_scheduled_for: { type: 'string', description: 'New appointment date/time in ISO 8601 format (e.g., "2025-10-22T14:00:00Z")' }
        },
        required: ['lead_id', 'new_scheduled_for']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'assign_tracking_number',
      description: 'Assign the current SignalWire number to the lead/broker pair for tracking.',
      parameters: {
        type: 'object',
        properties: {
          broker_id: { type: 'string' },
          lead_id: { type: 'string' },
          signalwire_number: { type: 'string' },
          appointment_datetime: { type: 'string' }
        },
        required: ['broker_id', 'lead_id', 'signalwire_number', 'appointment_datetime']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: 'Search the reverse mortgage knowledge base for accurate information.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string' }
        },
        required: ['question']
      }
    }
  }
];


