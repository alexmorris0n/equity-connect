/**
 * SWAIG HTTP Server
 * 
 * Wraps existing tool functions from tools.js in SWAIG-compatible HTTP endpoints.
 * SignalWire Fabric calls these endpoints during phone conversations.
 * 
 * MCP servers (barbara-mcp, propertyradar-mcp) remain unchanged for n8n integration.
 */

require('dotenv').config();
const express = require('express');
const { executeTool } = require('./tools');

const app = express();
const PORT = process.env.SWAIG_PORT || 8081;

// Parse JSON bodies
app.use(express.json());

// Health check
app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SWAIG Server',
    timestamp: new Date().toISOString()
  });
});

/**
 * SWAIG Signature Endpoint
 * SignalWire Fabric calls this to discover available functions
 */
app.post('/swaig', async (req, res) => {
  console.log('📋 SWAIG signature request');
  
  res.json([
    {
      function: 'get_lead_context',
      purpose: 'Get lead information by phone number to personalize the conversation',
      argument: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Phone number of the lead (E.164 format or any format)'
          }
        },
        required: ['phone']
      }
    },
    {
      function: 'search_knowledge',
      purpose: 'Search the reverse mortgage knowledge base for accurate information about eligibility, fees, objections, compliance',
      argument: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question or topic to search for'
          }
        },
        required: ['question']
      }
    },
    {
      function: 'check_consent_dnc',
      purpose: 'Check if lead has given consent to be contacted and is not on DNC list',
      argument: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'Lead UUID from get_lead_context'
          }
        },
        required: ['lead_id']
      }
    },
    {
      function: 'update_lead_info',
      purpose: 'Update lead information collected during the call (last name, address, age, property value, etc.)',
      argument: {
        type: 'object',
        properties: {
          lead_id: { type: 'string', description: 'Lead UUID' },
          last_name: { type: 'string', description: 'Lead last name' },
          property_address: { type: 'string', description: 'Full property address' },
          age: { type: 'number', description: 'Lead age' },
          property_value: { type: 'number', description: 'Estimated property value in dollars' },
          mortgage_balance: { type: 'number', description: 'Remaining mortgage balance in dollars' },
          owner_occupied: { type: 'boolean', description: 'Whether property is owner-occupied' }
        },
        required: ['lead_id']
      }
    },
    {
      function: 'find_broker_by_territory',
      purpose: 'Find the appropriate broker for a lead based on their city or ZIP code',
      argument: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City name (e.g., "Inglewood", "Tampa")' },
          zip_code: { type: 'string', description: 'ZIP code if known' }
        }
      }
    },
    {
      function: 'check_broker_availability',
      purpose: 'Check broker calendar availability for appointment scheduling. Returns available time slots for the next 7 days.',
      argument: {
        type: 'object',
        properties: {
          broker_id: { type: 'string', description: 'Broker UUID to check availability for' },
          preferred_day: { 
            type: 'string', 
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            description: 'Preferred day of week if lead expressed preference'
          },
          preferred_time: {
            type: 'string',
            enum: ['morning', 'afternoon', 'evening'],
            description: 'Preferred time of day if lead expressed preference'
          }
        },
        required: ['broker_id']
      }
    },
    {
      function: 'book_appointment',
      purpose: 'Book an appointment with the broker after checking availability. Creates calendar event and auto-sends invite.',
      argument: {
        type: 'object',
        properties: {
          lead_id: { type: 'string', description: 'Lead UUID' },
          broker_id: { type: 'string', description: 'Broker UUID' },
          scheduled_for: { type: 'string', description: 'Appointment date/time in ISO 8601 format' },
          notes: { type: 'string', description: 'Any notes about the appointment' }
        },
        required: ['lead_id', 'broker_id', 'scheduled_for']
      }
    },
    {
      function: 'assign_tracking_number',
      purpose: 'Assign the current SignalWire number to this lead/broker pair for call tracking. CALL THIS IMMEDIATELY AFTER booking.',
      argument: {
        type: 'object',
        properties: {
          lead_id: { type: 'string', description: 'Lead UUID' },
          broker_id: { type: 'string', description: 'Broker UUID' },
          signalwire_number: { type: 'string', description: 'The SignalWire number Barbara is calling from' },
          appointment_datetime: { type: 'string', description: 'Appointment date/time in ISO 8601 format' }
        },
        required: ['lead_id', 'broker_id', 'signalwire_number', 'appointment_datetime']
      }
    },
    {
      function: 'save_interaction',
      purpose: 'Save call interaction details at the end of the call. Include transcript summary and outcome.',
      argument: {
        type: 'object',
        properties: {
          lead_id: { type: 'string', description: 'Lead UUID' },
          broker_id: { type: 'string', description: 'Broker UUID' },
          duration_seconds: { type: 'number', description: 'Call duration in seconds' },
          outcome: { 
            type: 'string', 
            enum: ['appointment_booked', 'not_interested', 'no_response', 'positive', 'neutral', 'negative'],
            description: 'Call outcome'
          },
          content: { type: 'string', description: 'Brief summary of the conversation' },
          recording_url: { type: 'string', description: 'SignalWire recording URL if available' }
        },
        required: ['lead_id', 'outcome']
      }
    }
  ]);
});

/**
 * SWAIG Tool Endpoints
 * Each endpoint wraps the corresponding function from tools.js
 */

app.post('/swaig/get_lead_context', async (req, res) => {
  try {
    console.log('🔧 SWAIG: get_lead_context');
    const args = req.body.argument?.parsed?.[0] || req.body.argument || {};
    const result = await executeTool('get_lead_context', args);
    
    res.json({
      response: JSON.stringify(result),
      action: []
    });
  } catch (err) {
    console.error('❌ get_lead_context error:', err.message);
    res.status(500).json({
      response: JSON.stringify({ error: err.message }),
      action: []
    });
  }
});

app.post('/swaig/search_knowledge', async (req, res) => {
  try {
    console.log('🔧 SWAIG: search_knowledge');
    const args = req.body.argument?.parsed?.[0] || req.body.argument || {};
    const result = await executeTool('search_knowledge', args);
    
    res.json({
      response: JSON.stringify(result),
      action: []
    });
  } catch (err) {
    console.error('❌ search_knowledge error:', err.message);
    res.status(500).json({
      response: JSON.stringify({ error: err.message }),
      action: []
    });
  }
});

app.post('/swaig/check_consent_dnc', async (req, res) => {
  try {
    console.log('🔧 SWAIG: check_consent_dnc');
    const args = req.body.argument?.parsed?.[0] || req.body.argument || {};
    const result = await executeTool('check_consent_dnc', args);
    
    res.json({
      response: JSON.stringify(result),
      action: []
    });
  } catch (err) {
    console.error('❌ check_consent_dnc error:', err.message);
    res.status(500).json({
      response: JSON.stringify({ error: err.message }),
      action: []
    });
  }
});

app.post('/swaig/update_lead_info', async (req, res) => {
  try {
    console.log('🔧 SWAIG: update_lead_info');
    const args = req.body.argument?.parsed?.[0] || req.body.argument || {};
    const result = await executeTool('update_lead_info', args);
    
    res.json({
      response: JSON.stringify(result),
      action: []
    });
  } catch (err) {
    console.error('❌ update_lead_info error:', err.message);
    res.status(500).json({
      response: JSON.stringify({ error: err.message }),
      action: []
    });
  }
});

app.post('/swaig/find_broker_by_territory', async (req, res) => {
  try {
    console.log('🔧 SWAIG: find_broker_by_territory');
    const args = req.body.argument?.parsed?.[0] || req.body.argument || {};
    const result = await executeTool('find_broker_by_territory', args);
    
    res.json({
      response: JSON.stringify(result),
      action: []
    });
  } catch (err) {
    console.error('❌ find_broker_by_territory error:', err.message);
    res.status(500).json({
      response: JSON.stringify({ error: err.message }),
      action: []
    });
  }
});

app.post('/swaig/check_broker_availability', async (req, res) => {
  try {
    console.log('🔧 SWAIG: check_broker_availability');
    const args = req.body.argument?.parsed?.[0] || req.body.argument || {};
    const result = await executeTool('check_broker_availability', args);
    
    res.json({
      response: JSON.stringify(result),
      action: []
    });
  } catch (err) {
    console.error('❌ check_broker_availability error:', err.message);
    res.status(500).json({
      response: JSON.stringify({ error: err.message }),
      action: []
    });
  }
});

app.post('/swaig/book_appointment', async (req, res) => {
  try {
    console.log('🔧 SWAIG: book_appointment');
    const args = req.body.argument?.parsed?.[0] || req.body.argument || {};
    const result = await executeTool('book_appointment', args);
    
    res.json({
      response: JSON.stringify(result),
      action: []
    });
  } catch (err) {
    console.error('❌ book_appointment error:', err.message);
    res.status(500).json({
      response: JSON.stringify({ error: err.message }),
      action: []
    });
  }
});

app.post('/swaig/assign_tracking_number', async (req, res) => {
  try {
    console.log('🔧 SWAIG: assign_tracking_number');
    const args = req.body.argument?.parsed?.[0] || req.body.argument || {};
    const result = await executeTool('assign_tracking_number', args);
    
    res.json({
      response: JSON.stringify(result),
      action: []
    });
  } catch (err) {
    console.error('❌ assign_tracking_number error:', err.message);
    res.status(500).json({
      response: JSON.stringify({ error: err.message }),
      action: []
    });
  }
});

app.post('/swaig/save_interaction', async (req, res) => {
  try {
    console.log('🔧 SWAIG: save_interaction');
    const args = req.body.argument?.parsed?.[0] || req.body.argument || {};
    const result = await executeTool('save_interaction', args);
    
    res.json({
      response: JSON.stringify(result),
      action: []
    });
  } catch (err) {
    console.error('❌ save_interaction error:', err.message);
    res.status(500).json({
      response: JSON.stringify({ error: err.message }),
      action: []
    });
  }
});

// Start server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 SWAIG HTTP Server Running\n');
    console.log(`   Port: ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/healthz`);
    console.log(`   Signature: POST http://localhost:${PORT}/swaig`);
    console.log(`   Functions: 9 tools available\n`);
    console.log('✅ Ready for SignalWire Fabric calls\n');
  });
}

module.exports = { app };

