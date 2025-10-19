/**
 * Supabase Tool Handlers
 * 
 * Implements tools that OpenAI Realtime can call during conversations:
 * 1. get_lead_context - Query lead data by phone
 * 2. save_interaction - Log call details
 * 3. book_appointment - Schedule appointment
 * 4. check_consent_dnc - Verify calling permissions
 * 5. update_lead_info - Update lead information
 */

const { createClient } = require('@supabase/supabase-js');
const { formatCallContext } = require('./utils/number-formatter');

// Initialize Supabase client
let supabase = null;

function initSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

/**
 * Tool Definitions for OpenAI Realtime
 * These match OpenAI's function calling schema
 */
const toolDefinitions = [
  {
    type: 'function',
    name: 'get_lead_context',
    description: 'Get lead information by phone number to personalize the conversation. Returns lead details, broker info, and property data.',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number of the lead (E.164 format or any format)'
        }
      },
      required: ['phone'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'search_knowledge',
    description: 'Search the reverse mortgage knowledge base for accurate information about eligibility, fees, objections, compliance, etc. Use this when leads ask complex questions beyond basic qualification.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question or topic to search for (e.g., "what if they still have a mortgage", "costs and fees", "will they lose their home")'
        }
      },
      required: ['question'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'check_consent_dnc',
    description: 'Check if lead has given consent to be contacted and is not on DNC list. Call this BEFORE engaging in conversation.',
    parameters: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Lead UUID from get_lead_context'
        }
      },
      required: ['lead_id'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'update_lead_info',
    description: 'Update lead information collected during the call (last name, address, age, property value, etc.)',
    parameters: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Lead UUID'
        },
        last_name: {
          type: 'string',
          description: 'Lead last name'
        },
        property_address: {
          type: 'string',
          description: 'Full property address'
        },
        age: {
          type: 'number',
          description: 'Lead age'
        },
        property_value: {
          type: 'number',
          description: 'Estimated property value in dollars'
        },
        mortgage_balance: {
          type: 'number',
          description: 'Remaining mortgage balance in dollars (0 if paid off)'
        },
        owner_occupied: {
          type: 'boolean',
          description: 'Whether property is owner-occupied primary residence'
        }
      },
      required: ['lead_id'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'find_broker_by_territory',
    description: 'Find the appropriate broker for a lead based on their city or ZIP code. Use this for new callers who need broker assignment before booking.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City name (e.g., "Inglewood", "Tampa")'
        },
        zip_code: {
          type: 'string',
          description: 'ZIP code if known'
        }
      },
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'check_broker_availability',
    description: 'Check broker calendar availability for appointment scheduling. Returns available time slots for the next 7 days.',
    parameters: {
      type: 'object',
      properties: {
        broker_id: {
          type: 'string',
          description: 'Broker UUID to check availability for'
        },
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
      required: ['broker_id'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'book_appointment',
    description: 'Book an appointment with the broker after checking availability. Creates interaction record and billing event.',
    parameters: {
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
          description: 'Appointment date/time in ISO 8601 format (e.g., "2025-10-20T10:00:00Z")'
        },
        notes: {
          type: 'string',
          description: 'Any notes about the appointment or lead preferences'
        }
      },
      required: ['lead_id', 'broker_id', 'scheduled_for'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'save_interaction',
    description: 'Save call interaction details at the end of the call. Include transcript summary and outcome.',
    parameters: {
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
        duration_seconds: {
          type: 'number',
          description: 'Call duration in seconds'
        },
        outcome: {
          type: 'string',
          enum: ['appointment_booked', 'not_interested', 'no_response', 'positive', 'neutral', 'negative'],
          description: 'Call outcome'
        },
        content: {
          type: 'string',
          description: 'Brief summary of the conversation'
        },
        recording_url: {
          type: 'string',
          description: 'SignalWire recording URL if available'
        }
      },
      required: ['lead_id', 'outcome'],
      additionalProperties: false
    }
  }
];

/**
 * Tool Handler: Get Lead Context
 */
async function getLeadContext({ phone }) {
  const sb = initSupabase();
  
  // Normalize phone number (strip non-digits)
  const normalizedPhone = phone.replace(/\D/g, '');
  const last10 = normalizedPhone.slice(-10);
  
  // Query lead by phone - try multiple formats since database might have dashes
  // Match patterns: 6505300051, 650-530-0051, +16505300051, (650) 530-0051
  const { data: leads, error: leadError } = await sb
    .from('leads')
    .select('*, brokers(*)')
    .or(`primary_phone.ilike.%${last10}%,primary_phone.ilike.%${last10.slice(0,3)}-${last10.slice(3,6)}-${last10.slice(6)}%`)
    .limit(1);
  
  if (leadError) {
    return { error: leadError.message };
  }
  
  if (!leads || leads.length === 0) {
    return { error: 'Lead not found', found: false };
  }
  
  const lead = leads[0];
  const broker = lead.brokers;
  
  // Format context for Barbara's prompt with number-to-words
  const formattedContext = formatCallContext(lead, broker);
  
  return {
    found: true,
    lead_id: lead.id,
    broker_id: lead.assigned_broker_id,
    context: formattedContext,
    raw: {
      first_name: lead.first_name,
      last_name: lead.last_name,
      property_city: lead.property_city,
      property_value: lead.property_value,
      status: lead.status
    }
  };
}

/**
 * Tool Handler: Check Consent & DNC
 */
async function checkConsentDNC({ lead_id }) {
  const sb = initSupabase();
  
  const { data: lead, error } = await sb
    .from('leads')
    .select('consent, status')
    .eq('id', lead_id)
    .single();
  
  if (error) {
    return { error: error.message, can_call: false };
  }
  
  // Check consent and not closed_lost (DNC equivalent)
  const canCall = lead.consent === true && lead.status !== 'closed_lost';
  
  return {
    can_call: canCall,
    has_consent: lead.consent,
    is_dnc: lead.status === 'closed_lost',
    message: canCall 
      ? 'Lead has consent and is not on DNC list' 
      : 'Lead does not have consent or is on DNC list'
  };
}

/**
 * Tool Handler: Update Lead Info
 */
async function updateLeadInfo({ lead_id, ...updates }) {
  const sb = initSupabase();
  
  // Calculate equity if we have both values
  if (updates.property_value !== undefined) {
    const mortgage = updates.mortgage_balance || 0;
    updates.estimated_equity = updates.property_value - mortgage;
  }
  
  // Update timestamp
  updates.updated_at = new Date().toISOString();
  updates.last_contact = new Date().toISOString();
  
  const { data, error } = await sb
    .from('leads')
    .update(updates)
    .eq('id', lead_id)
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { 
    success: true, 
    message: 'Lead information updated',
    updated_fields: Object.keys(updates)
  };
}

/**
 * Tool Handler: Find Broker by Territory
 */
async function findBrokerByTerritory({ city, zip_code }) {
  const sb = initSupabase();
  
  try {
    // Query broker_territories table
    let query = sb
      .from('broker_territories')
      .select('broker_id, brokers(id, contact_name, company_name, phone)')
      .eq('active', true);
    
    // Search by ZIP code first (most precise)
    if (zip_code) {
      query = query.eq('zip_code', zip_code);
    } 
    // Fallback to city/market name
    else if (city) {
      query = query.or(`market_name.ilike.%${city}%,neighborhood_name.ilike.%${city}%`);
    }
    
    const { data, error } = await query.limit(1).single();
    
    if (error || !data) {
      // Default to Walter if no territory match
      const defaultBroker = await sb
        .from('brokers')
        .select('id, contact_name, company_name')
        .eq('id', '6a3c5ed5-664a-4e13-b019-99fe8db74174')
        .single();
      
      return {
        found: true,
        broker_id: defaultBroker.data.id,
        broker_name: defaultBroker.data.contact_name.split(' ')[0], // First name only
        company_name: defaultBroker.data.company_name,
        message: `Assigned to default broker ${defaultBroker.data.contact_name} (no specific territory match for ${city || zip_code})`
      };
    }
    
    const broker = data.brokers;
    return {
      found: true,
      broker_id: broker.id,
      broker_name: broker.contact_name.split(' ')[0], // First name only
      company_name: broker.company_name,
      territory: city || zip_code,
      message: `Found broker ${broker.contact_name} for territory ${city || zip_code}`
    };
    
  } catch (err) {
    return { 
      found: false, 
      error: err.message,
      message: 'Unable to assign broker - will use default'
    };
  }
}

/**
 * Tool Handler: Check Broker Availability
 */
async function checkBrokerAvailability({ broker_id, preferred_day, preferred_time }) {
  const sb = initSupabase();
  
  // Get existing appointments for this broker in next 7 days
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  const { data: appointments, error } = await sb
    .from('interactions')
    .select('scheduled_for')
    .eq('broker_id', broker_id)
    .eq('type', 'appointment')
    .gte('scheduled_for', new Date().toISOString())
    .lte('scheduled_for', sevenDaysFromNow.toISOString())
    .order('scheduled_for', { ascending: true });
  
  if (error) {
    return { error: error.message, available_slots: [] };
  }
  
  // Generate available slots (simple version - can be enhanced)
  const bookedSlots = new Set(appointments.map(a => a.scheduled_for));
  const availableSlots = [];
  
  // Define standard availability (can be customized per broker)
  const standardHours = {
    morning: ['09:00', '10:00', '11:00'],
    afternoon: ['13:00', '14:00', '15:00', '16:00'],
    evening: ['18:00', '19:00']
  };
  
  // Generate next 7 days of availability
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    
    // Skip weekends (can be customized)
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
    
    // Filter by preferred day if specified
    if (preferred_day && dayName !== preferred_day.toLowerCase()) continue;
    
    // Get time slots for this day
    const timePeriods = preferred_time 
      ? [preferred_time.toLowerCase()]
      : ['morning', 'afternoon'];
    
    for (const period of timePeriods) {
      for (const time of standardHours[period]) {
        const [hour, minute] = time.split(':');
        const slotDate = new Date(date);
        slotDate.setHours(parseInt(hour), parseInt(minute), 0, 0);
        
        // Skip past times
        if (slotDate < new Date()) continue;
        
        const slotISO = slotDate.toISOString();
        
        // Check if slot is already booked
        if (!bookedSlots.has(slotISO)) {
          availableSlots.push({
            datetime: slotISO,
            day_name: dayName,
            date: slotDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
            time: slotDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
            period: period
          });
        }
      }
    }
    
    // Limit to reasonable number of options
    if (availableSlots.length >= 8) break;
  }
  
  return {
    found: availableSlots.length > 0,
    available_slots: availableSlots.slice(0, 8),
    next_available: availableSlots[0] || null,
    message: availableSlots.length > 0 
      ? `Found ${availableSlots.length} available time slots`
      : 'No available slots in the next 7 days'
  };
}

/**
 * Tool Handler: Book Appointment
 */
async function bookAppointment({ lead_id, broker_id, scheduled_for, notes }) {
  const sb = initSupabase();
  
  // Create interaction record
  const { data: interaction, error: interactionError } = await sb
    .from('interactions')
    .insert({
      lead_id,
      broker_id,
      type: 'appointment',
      direction: 'outbound',
      subject: 'Reverse Mortgage Consultation',
      scheduled_for,
      metadata: { notes, booked_via: 'ai_call' },
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (interactionError) {
    return { success: false, error: interactionError.message };
  }
  
  // Update lead status
  await sb
    .from('leads')
    .update({ 
      status: 'appointment_set',
      last_engagement: new Date().toISOString()
    })
    .eq('id', lead_id);
  
  // Create billing event
  await sb
    .from('billing_events')
    .insert({
      broker_id,
      lead_id,
      event_type: 'appointment_set',
      amount: 50, // Per pricing model
      status: 'pending',
      created_at: new Date().toISOString()
    });
  
  return {
    success: true,
    appointment_id: interaction.id,
    scheduled_for,
    message: 'Appointment booked successfully'
  };
}

/**
 * Tool Handler: Save Interaction
 */
async function saveInteraction({ lead_id, broker_id, duration_seconds, outcome, content, recording_url }) {
  const sb = initSupabase();
  
  const { data, error } = await sb
    .from('interactions')
    .insert({
      lead_id,
      broker_id,
      type: 'ai_call',
      direction: 'outbound',
      content,
      duration_seconds,
      outcome,
      recording_url,
      metadata: { ai_agent: 'barbara', version: '1.0' },
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Update lead engagement
  await sb
    .from('leads')
    .update({
      last_contact: new Date().toISOString(),
      last_engagement: new Date().toISOString(),
      interaction_count: sb.rpc('increment', { row_id: lead_id, column_name: 'interaction_count' })
    })
    .eq('id', lead_id);
  
  return {
    success: true,
    interaction_id: data.id,
    message: 'Interaction saved'
  };
}

/**
 * Tool Handler: Search Knowledge Base
 */
async function searchKnowledge({ question }) {
  const sb = initSupabase();
  
  try {
    // Get embedding for the question from OpenAI
    const fetch = require('node-fetch');
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: question
      })
    });
    
    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;
    
    // Search vector store using Supabase function
    const { data, error } = await sb.rpc('find_similar_content', {
      query_embedding: queryEmbedding,
      content_type_filter: 'reverse_mortgage_kb',
      match_threshold: 0.7,
      match_count: 3
    });
    
    if (error) {
      return { error: error.message, results: [] };
    }
    
    if (!data || data.length === 0) {
      return { 
        found: false, 
        message: 'No relevant information found in knowledge base',
        results: []
      };
    }
    
    // Format results for Barbara to use conversationally
    const formattedResults = data.map((item, index) => ({
      rank: index + 1,
      content: item.content_text || item.content,
      similarity: Math.round(item.similarity * 100) + '%'
    }));
    
    // Combine top results into a single response
    const combinedKnowledge = formattedResults
      .map(r => r.content)
      .join('\n\n---\n\n');
    
    return {
      found: true,
      question,
      answer: combinedKnowledge,
      sources_count: formattedResults.length,
      message: 'Use this information to answer the lead\'s question conversationally in 2 sentences max.'
    };
    
  } catch (err) {
    return { error: err.message, results: [] };
  }
}

/**
 * Execute tool based on function name
 */
async function executeTool(functionName, args) {
  switch (functionName) {
    case 'get_lead_context':
      return await getLeadContext(args);
    case 'check_consent_dnc':
      return await checkConsentDNC(args);
    case 'update_lead_info':
      return await updateLeadInfo(args);
    case 'find_broker_by_territory':
      return await findBrokerByTerritory(args);
    case 'check_broker_availability':
      return await checkBrokerAvailability(args);
    case 'book_appointment':
      return await bookAppointment(args);
    case 'save_interaction':
      return await saveInteraction(args);
    case 'search_knowledge':
      return await searchKnowledge(args);
    default:
      return { error: `Unknown function: ${functionName}` };
  }
}

module.exports = {
  toolDefinitions,
  executeTool,
  initSupabase
};

