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
const { initPromptLayer } = require('./promptlayer-integration');
const { GoogleAuth } = require('google-auth-library');

// Initialize Supabase client
let supabase = null;

// Initialize Google Auth for Vertex AI
let vertexAuthClient = null;
async function getVertexAIToken() {
  if (!vertexAuthClient) {
    // Use the JSON from environment variable directly
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credentialsJson) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is not set');
    }
    
    const credentials = JSON.parse(credentialsJson);
    const auth = new GoogleAuth({
      credentials: credentials,
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    vertexAuthClient = await auth.getClient();
  }
  const token = await vertexAuthClient.getAccessToken();
  return token.token;
}

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
    description: 'Book an appointment with the broker after checking availability. Creates calendar event and auto-sends invite to lead email. Creates interaction record and billing event.',
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
    name: 'assign_tracking_number',
    description: 'Assign the current SignalWire number to this lead/broker pair for call tracking. CALL THIS IMMEDIATELY AFTER booking an appointment. This allows us to track all future calls between broker and lead for billing verification.',
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
        signalwire_number: {
          type: 'string',
          description: 'The SignalWire number Barbara is calling from (e.g., "+14244851544")'
        },
        appointment_datetime: {
          type: 'string',
          description: 'Appointment date/time in ISO 8601 format (e.g., "2025-10-22T10:00:00Z")'
        }
      },
      required: ['lead_id', 'broker_id', 'signalwire_number', 'appointment_datetime'],
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
    .select('*, brokers!assigned_broker_id(*)')
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
  
  // Get last interaction with metadata (for context in next call)
  const { data: lastInteraction } = await sb
    .from('interactions')
    .select('*')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  // Extract last call context from metadata
  const lastCallContext = lastInteraction?.metadata || {};
  
  // Format context for Barbara's prompt with number-to-words
  const formattedContext = formatCallContext(lead, broker);
  
  // Determine if lead is qualified based on status (qualified or beyond)
  const isQualified = ['qualified', 'appointment_set', 'showed', 'application', 'funded'].includes(lead.status);
  
  return {
    found: true,
    lead_id: lead.id,
    broker_id: lead.assigned_broker_id,
    broker: broker, // Include full broker object with all fields
    context: formattedContext,
    property_value: lead.property_value || null,
    estimated_equity: lead.estimated_equity || null,
    qualified: isQualified,
    status: lead.status,
    
    // Last call context (for personalization)
    last_call: {
      money_purpose: lastCallContext.money_purpose || null,
      specific_need: lastCallContext.specific_need || null,
      amount_needed: lastCallContext.amount_needed || null,
      timeline: lastCallContext.timeline || null,
      objections: lastCallContext.objections || [],
      questions_asked: lastCallContext.questions_asked || [],
      key_details: lastCallContext.key_details || [],
      appointment_scheduled: lastCallContext.appointment_scheduled || false,
      last_outcome: lastInteraction?.outcome || null
    },
    
    raw: {
      first_name: lead.first_name,
      last_name: lead.last_name,
      primary_email: lead.primary_email,
      property_address: lead.property_address,
      property_city: lead.property_city,
      property_state: lead.property_state,
      property_zip: lead.property_zip,
      property_value: lead.property_value,
      mortgage_balance: lead.mortgage_balance,
      estimated_equity: lead.estimated_equity,
      age: lead.age,
      owner_occupied: lead.owner_occupied,
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
 * Calls Nylas Free/Busy API directly to check real calendar availability
 * Docs: https://developer.nylas.com/docs/v3/calendar/check-free-busy/
 */
async function checkBrokerAvailability({ broker_id, preferred_day, preferred_time }) {
  const NYLAS_API_KEY = process.env.NYLAS_API_KEY;
  const NYLAS_API_URL = process.env.NYLAS_API_URL || 'https://api.us.nylas.com';
  
  const sb = initSupabase();
  const startTime = Date.now();
  
  try {
    console.log('📅 Checking broker availability:', broker_id);
    
    // Get broker's email for Nylas grant ID (v3 uses email as grant identifier)
    const dbStartTime = Date.now();
    const { data: broker, error: brokerError } = await sb
      .from('brokers')
      .select('contact_name, email, timezone')
      .eq('id', broker_id)
      .single();
    
    console.log(`✅ Broker lookup: ${Date.now() - dbStartTime}ms`);
    
    if (brokerError || !broker) {
      console.error('❌ Broker not found:', brokerError);
      return generateFallbackSlots(preferred_day, preferred_time);
    }
    
    if (!broker.email) {
      console.warn('⚠️  Broker has no email - cannot access calendar');
      return generateFallbackSlots(preferred_day, preferred_time);
    }
    
    // Calculate time range (next 14 days)
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = Math.floor((Date.now() + 14 * 24 * 60 * 60 * 1000) / 1000);
    
    // Call Nylas Availability API (better than free/busy for finding open slots)
    // https://developer.nylas.com/docs/v3/calendar/calendar-availability/
    // This endpoint finds available meeting times based on criteria
    const nylasStartTime = Date.now();
    // Use Events API to get broker's calendar events, then find gaps
    // This is more reliable than Availability API which requires working hours config
    const roundedStartTime = Math.floor(startTime / 300) * 300; // Round down to nearest 5 minutes
    const roundedEndTime = Math.floor(endTime / 300) * 300;
    
    const eventsUrl = `${NYLAS_API_URL}/v3/grants/${encodeURIComponent(broker.email)}/events?calendar_id=primary&start=${roundedStartTime}&end=${roundedEndTime}`;
    
    const response = await fetch(eventsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NYLAS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      const nylasTime = Date.now() - nylasStartTime;
      console.error(`❌ Nylas events API failed (${nylasTime}ms):`, response.status, errorText);
      return generateFallbackSlots(preferred_day, preferred_time);
    }
    
    const eventsData = await response.json();
    const nylasTime = Date.now() - nylasStartTime;
    console.log(`✅ Nylas events API: ${nylasTime}ms, found ${eventsData.data?.length || 0} events`);
    
    // Extract busy times from events
    const busyTimes = (eventsData.data || []).map(event => ({
      start: event.when.start_time * 1000,
      end: event.when.end_time * 1000
    }));
    
    // Find free slots (gaps between busy times) during business hours
    const availableSlots = findFreeSlots(
      roundedStartTime * 1000,
      roundedEndTime * 1000,
      busyTimes,
      20 * 60 * 1000,  // 20 minute appointments
      broker.timezone || 'America/Los_Angeles'
    );
    
    console.log('✅ Found free slots from calendar:', {
      broker: broker.contact_name,
      busy_events: busyTimes.length,
      available_count: availableSlots.length
    });
    
    // Filter and format available slots based on preferences
    const calcStartTime = Date.now();
    const formattedSlots = formatAvailableSlots(
      availableSlots,
      preferred_day,
      preferred_time,
      broker.timezone || 'America/Los_Angeles'
    );
    const calcTime = Date.now() - calcStartTime;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Slot calculation: ${calcTime}ms`);
    console.log(`✅ Total availability check: ${totalTime}ms`);
    
    // Generate smart response message
    let message = '';
    if (formattedSlots.length === 0) {
      message = 'No availability in the next 2 weeks within business hours (10 AM - 5 PM)';
    } else {
      const sameDaySlots = formattedSlots.filter(slot => slot.is_same_day);
      const tomorrowSlots = formattedSlots.filter(slot => slot.is_tomorrow);
      
      if (sameDaySlots.length > 0) {
        message = `Great! I have ${sameDaySlots.length} slot(s) available today. The earliest is ${sameDaySlots[0].time}.`;
      } else if (tomorrowSlots.length > 0) {
        message = `I have ${tomorrowSlots.length} slot(s) available tomorrow. The earliest is ${tomorrowSlots[0].time}.`;
      } else {
        message = `I have ${formattedSlots.length} available times over the next 2 weeks.`;
      }
    }

    return {
      success: true,
      available_slots: formattedSlots,
      broker_name: broker.contact_name,
      calendar_provider: 'nylas',
      business_hours: '10:00 AM - 5:00 PM',
      min_notice: '2 hours',
      message: message
    };
    
  } catch (err) {
    console.error('❌ Error checking Nylas availability:', err);
    // Fallback to simple slots
    return generateFallbackSlots(preferred_day, preferred_time);
  }
}

/**
 * Find free time slots by analyzing gaps between busy times
 */
function findFreeSlots(startMs, endMs, busyTimes, durationMs, timezone) {
  const slots = [];
  
  // Sort busy times by start time
  busyTimes.sort((a, b) => a.start - b.start);
  
  let currentTime = startMs;
  
  for (const busy of busyTimes) {
    // If there's a gap before this busy time
    if (currentTime + durationMs <= busy.start) {
      // Find all possible slots in this gap
      let slotStart = currentTime;
      while (slotStart + durationMs <= busy.start) {
        const slotEnd = slotStart + durationMs;
        const slotDate = new Date(slotStart);
        const dayOfWeek = slotDate.getDay();
        const hour = slotDate.getHours();
        
        // Only business hours: Mon-Fri, 10am-5pm
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 10 && hour < 17) {
          slots.push({ start: slotStart, end: slotEnd });
        }
        
        slotStart += 15 * 60 * 1000; // Move forward 15 minutes
      }
    }
    
    // Move past this busy time
    currentTime = Math.max(currentTime, busy.end);
  }
  
  // Check for free time after last busy period
  let slotStart = currentTime;
  while (slotStart + durationMs <= endMs) {
    const slotEnd = slotStart + durationMs;
    const slotDate = new Date(slotStart);
    const dayOfWeek = slotDate.getDay();
    const hour = slotDate.getHours();
    
    // Only business hours: Mon-Fri, 10am-5pm
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 10 && hour < 17) {
      slots.push({ start: slotStart, end: slotEnd });
    }
    
    slotStart += 15 * 60 * 1000; // Move forward 15 minutes
  }
  
  return slots;
}

/**
 * Format available time slots from Nylas Availability API
 * Nylas already calculated the available times, we just need to format and filter them
 */
function formatAvailableSlots(rawSlots, preferred_day, preferred_time, timezone) {
  if (!rawSlots || rawSlots.length === 0) return [];
  
  const now = Date.now();
  const formattedSlots = [];
  
  for (const slot of rawSlots) {
    const slotStart = new Date(slot.start);
    const slotEnd = new Date(slot.end);
    const dayOfWeek = slotStart.getDay();
    const dayName = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][dayOfWeek];
    const hour = slotStart.getHours();
    
    // Filter by preferred day
    if (preferred_day && preferred_day !== 'any' && preferred_day !== dayName) continue;
    
    // Filter by preferred time
    if (preferred_time === 'morning' && hour >= 12) continue;
    if (preferred_time === 'afternoon' && hour < 12) continue;
    if (preferred_time === 'evening' && hour < 17) continue;
    
    const isToday = slotStart.toDateString() === new Date().toDateString();
    const isTomorrow = slotStart.toDateString() === new Date(Date.now() + 86400000).toDateString();
    
    formattedSlots.push({
      datetime: slotStart.toISOString(),
      unix_timestamp: Math.floor(slot.start / 1000),
      display: `${slotStart.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      })} at ${slotStart.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })}`,
      day: dayName,
      time: slotStart.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      }),
      priority: isToday ? 1 : (isTomorrow ? 2 : 3),
      is_same_day: isToday,
      is_tomorrow: isTomorrow
    });
  }
  
  // Sort by priority (today first, then tomorrow, then rest)
  formattedSlots.sort((a, b) => a.priority - b.priority);
  
  return formattedSlots.slice(0, 5);
}

/**
 * Generate fallback slots if calendar check fails
 */
function generateFallbackSlots(preferred_day, preferred_time) {
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
        
        // Add all calculated slots (no booking check needed for fallback)
        availableSlots.push({
          datetime: slotISO,
          day_name: dayName,
          date: slotDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
          time: slotDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          period: period
        });
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
 * Books appointment directly via Nylas Events API and auto-sends calendar invite
 * Docs: https://developer.nylas.com/docs/v3/calendar/using-the-events-api/
 */
async function bookAppointment({ lead_id, broker_id, scheduled_for, notes }) {
  const NYLAS_API_KEY = process.env.NYLAS_API_KEY;
  const NYLAS_API_URL = process.env.NYLAS_API_URL || 'https://api.us.nylas.com';
  
  const sb = initSupabase();
  const startTime = Date.now();
  
  try {
    console.log('📅 Booking appointment:', { lead_id, broker_id, scheduled_for });
    
    // Get broker info (Nylas v3 uses email as grant ID)
    const brokerStartTime = Date.now();
    const { data: broker, error: brokerError } = await sb
      .from('brokers')
      .select('contact_name, email, timezone')
      .eq('id', broker_id)
      .single();
    
    if (brokerError || !broker) {
      return { success: false, error: 'Broker not found' };
    }
    
    if (!broker.email) {
      return { success: false, error: 'Broker has no email - cannot access calendar' };
    }
    
    console.log(`✅ Broker lookup: ${Date.now() - brokerStartTime}ms`);
    
    // Get lead info for calendar event
    const leadStartTime = Date.now();
    const { data: lead } = await sb
      .from('leads')
      .select('first_name, last_name, primary_phone, primary_email')
      .eq('id', lead_id)
      .single();
    
    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }
    
    console.log(`✅ Lead lookup: ${Date.now() - leadStartTime}ms`);
    
    const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Lead';
    const leadEmail = lead.primary_email || null;
    
    // Parse scheduled_for to Unix timestamps
    const appointmentDate = new Date(scheduled_for);
    const startTime = Math.floor(appointmentDate.getTime() / 1000);
    const endTime = startTime + 3600; // 1 hour appointment
    
    // Create calendar event via Nylas Events API
    // NOTE: Events API works well for appointment booking and is already tested
    const createEventUrl = `${NYLAS_API_URL}/v3/grants/${encodeURIComponent(broker.email)}/events?calendar_id=primary`;
    
    const eventBody = {
      title: `Reverse Mortgage Consultation - ${leadName}`,
      description: [
        `Lead: ${leadName}`,
        `Phone: ${lead.primary_phone || 'N/A'}`,
        `Email: ${leadEmail || 'N/A'}`,
        '',
        `Notes: ${notes || 'None'}`,
        '',
        'This appointment was scheduled by Barbara AI Assistant.'
      ].join('\n'),
      when: {
        start_time: startTime,
        end_time: endTime
      },
      participants: [
        {
          name: broker.contact_name,
          email: broker.email
        }
      ],
      busy: true  // Mark as busy time
    };
    
    // Add lead as participant if they have email (for calendar invite)
    if (leadEmail) {
      eventBody.participants.push({
        name: leadName,
        email: leadEmail
      });
    }
    
    const nylasStartTime = Date.now();
    const response = await fetch(createEventUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NYLAS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Nylas create event failed:', response.status, errorText);
      console.error('❌ Request URL:', createEventUrl);
      console.error('❌ Request body:', JSON.stringify(eventBody, null, 2));
      return { success: false, error: `Failed to create calendar event: ${response.status} - ${errorText}` };
    }
    
    const eventData = await response.json();
    const nylasEventId = eventData.data?.id;
    const nylasTime = Date.now() - nylasStartTime;
    
    console.log(`✅ Nylas event created: ${nylasTime}ms`);
    console.log('✅ Appointment booked via Nylas:', {
      event_id: nylasEventId,
      broker: broker.contact_name,
      lead: leadName,
      scheduled_for,
      invite_sent: !!leadEmail
    });
    
    // Log interaction to Supabase
    const interactionStartTime = Date.now();
    await sb.from('interactions').insert({
      lead_id,
      broker_id,
      type: 'appointment',
      direction: 'outbound',
      content: `Appointment scheduled for ${appointmentDate.toLocaleString('en-US')}`,
      outcome: 'appointment_booked',
      metadata: {
        nylas_event_id: nylasEventId,
        scheduled_for,
        notes,
        calendar_invite_sent: !!leadEmail
      },
      created_at: new Date().toISOString()
    });
    console.log(`✅ Interaction logged: ${Date.now() - interactionStartTime}ms`);
    
    // Update lead status
    const updateStartTime = Date.now();
    await sb
      .from('leads')
      .update({ 
        status: 'appointment_set',
        last_engagement: new Date().toISOString()
      })
      .eq('id', lead_id);
    console.log(`✅ Lead status updated: ${Date.now() - updateStartTime}ms`);
    
    // Create billing event
    const billingStartTime = Date.now();
    await sb
      .from('billing_events')
      .insert({
        broker_id,
        lead_id,
        event_type: 'appointment_set',
        amount: 50,
        status: 'pending',
        metadata: { 
          nylas_event_id: nylasEventId,
          scheduled_for 
        },
        created_at: new Date().toISOString()
      });
    console.log(`✅ Billing event created: ${Date.now() - billingStartTime}ms`);
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Total booking time: ${totalTime}ms`);
    
    return {
      success: true,
      event_id: nylasEventId,
      scheduled_for,
      calendar_invite_sent: !!leadEmail,
      message: leadEmail 
        ? `Appointment booked successfully. Calendar invite sent to ${leadEmail}`
        : 'Appointment booked successfully (no email for invite)'
    };
    
  } catch (err) {
    console.error('❌ Error booking appointment via Nylas:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Tool Handler: Assign Tracking Number
 * Assigns the current SignalWire number to lead/broker pair for call tracking and billing verification
 */
async function assignTrackingNumber({ lead_id, broker_id, signalwire_number, appointment_datetime }) {
  const sb = initSupabase();
  
  try {
    // Call the database function
    const { data, error } = await sb.rpc('assign_tracking_number', {
      p_lead_id: lead_id,
      p_broker_id: broker_id,
      p_signalwire_number: signalwire_number,
      p_appointment_datetime: appointment_datetime
    });
    
    if (error) {
      console.error('❌ Failed to assign tracking number:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Failed to assign tracking number'
      };
    }
    
    console.log('✅ Tracking number assigned:', {
      number: signalwire_number,
      lead_id,
      broker_id,
      release_at: data.release_at
    });
    
    return {
      success: true,
      number: signalwire_number,
      lead_id: lead_id,
      broker_id: broker_id,
      release_at: data.release_at,
      message: `Tracking number ${signalwire_number} assigned. All future calls will be logged for billing.`
    };
    
  } catch (err) {
    console.error('❌ Error assigning tracking number:', err);
    return { 
      success: false, 
      error: err.message,
      message: 'Error assigning tracking number'
    };
  }
}

/**
 * Tool Handler: Save Interaction
 */
async function saveInteraction({ lead_id, broker_id, duration_seconds, outcome, content, recording_url, metadata, transcript }) {
  const sb = initSupabase();

  const metadataWithFlags = metadata || {};
  const qualifiesByMetadata = metadataWithFlags.qualified === true
    || metadataWithFlags.met_qualification_requirements === true
    || metadataWithFlags.qualification_status === 'qualified';
  const qualifiesByOutcome = outcome === 'appointment_booked' || outcome === 'positive';

  if (qualifiesByMetadata || qualifiesByOutcome) {
    try {
      await sb
        .from('leads')
        .update({ qualified: true, updated_at: new Date().toISOString() })
        .eq('id', lead_id);
    } catch (updateError) {
      console.warn('⚠️ Failed to update lead qualification status:', updateError.message);
    }
  }

  // Build comprehensive metadata
  const interactionMetadata = {
    ai_agent: 'barbara',
    version: '2.0',
    
    // Merge any provided metadata
    ...(metadata || {}),
    
    // Include full conversation transcript if provided
    conversation_transcript: transcript || metadata?.conversation_transcript || null,
    
    // Ensure these fields exist
    money_purpose: metadata?.money_purpose || null,
    specific_need: metadata?.specific_need || null,
    amount_needed: metadata?.amount_needed || null,
    timeline: metadata?.timeline || null,
    objections: metadata?.objections || [],
    questions_asked: metadata?.questions_asked || [],
    key_details: metadata?.key_details || [],
    
    // Appointment tracking
    appointment_scheduled: metadata?.appointment_scheduled || false,
    appointment_datetime: metadata?.appointment_datetime || null,
    
    // Contact verification tracking
    email_verified: metadata?.email_verified || false,
    phone_verified: metadata?.phone_verified || false,
    email_collected: metadata?.email_collected || false,
    
    // Commitment tracking
    commitment_points_completed: metadata?.commitment_points_completed || 0,
    text_reminder_consented: metadata?.text_reminder_consented || false,
    
    // Call quality metrics
    interruptions: metadata?.interruptions || 0,
    tool_calls_made: metadata?.tool_calls_made || [],
    
    // Save timestamp
    saved_at: new Date().toISOString()
  };
  
  const { data, error } = await sb
    .from('interactions')
    .insert({
      lead_id,
      broker_id,
      type: 'ai_call',
      direction: metadata?.direction || 'outbound',
      content,
      duration_seconds,
      outcome,
      recording_url,
      metadata: interactionMetadata,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error saving interaction:', error);
    return { success: false, error: error.message };
  }
  
  // Update lead engagement (increment interaction_count using raw SQL)
  await sb.rpc('increment_interaction_count', { lead_uuid: lead_id });
  
  await sb
    .from('leads')
    .update({
      last_contact: new Date().toISOString(),
      last_engagement: new Date().toISOString()
    })
    .eq('id', lead_id);
  
  console.log('✅ Interaction saved with rich metadata:', {
    interaction_id: data.id,
    metadata_fields: Object.keys(interactionMetadata).length
  });
  
  // Log to PromptLayer for analytics
  try {
    const promptLayer = initPromptLayer();
    const transcript = metadata?.conversation_transcript || [];
    
    // Get lead and broker names for tags
    const { data: lead } = await sb.from('leads').select('first_name, last_name').eq('id', lead_id).single();
    const { data: broker } = await sb.from('brokers').select('contact_name').eq('id', broker_id).single();
    
    const leadName = lead ? `${lead.first_name} ${lead.last_name}`.trim() : 'Unknown';
    const brokerName = broker?.contact_name || 'Unknown';
    
    await promptLayer.logRealtimeConversation({
      callId: data.id,
      leadId: lead_id,
      brokerId: broker_id,
      leadName: leadName,
      brokerName: brokerName,
      conversationTranscript: transcript,
      metadata: interactionMetadata,
      outcome: outcome,
      durationSeconds: duration_seconds,
      toolCalls: interactionMetadata.tool_calls_made || []
    });
  } catch (plError) {
    console.warn('⚠️ PromptLayer logging failed (non-critical):', plError.message);
  }
  
  return {
    success: true,
    interaction_id: data.id,
    message: 'Interaction saved with rich context',
    metadata_saved: Object.keys(interactionMetadata).length
  };
}

/**
 * Tool Handler: Search Knowledge Base
 * Performance: Typically 8-15 seconds (OpenAI embeddings: 3-8s, Vector search: 2-5s)
 */
async function searchKnowledge({ question }) {
  const sb = initSupabase();
  const startTime = Date.now();
  
  try {
    // Performance tracking
    console.log('🔍 Starting knowledge search:', question);
    
    // Get embedding for the question from Vertex AI
    const fetch = require('node-fetch');
    const embeddingStartTime = Date.now();
    
    // Use Vertex AI text-embedding-005 (768 dimensions, faster, better quality)
    const projectId = process.env.GOOGLE_PROJECT_ID || 'barbara-475319';
    const location = 'us-central1';
    const model = 'text-embedding-005';
    
    const embeddingResponse = await fetch(
      `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getVertexAIToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instances: [{ content: question }]
        })
      }
    );
    
    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error('❌ Vertex AI embeddings failed:', embeddingResponse.status, errorText);
      throw new Error(`Vertex AI embeddings failed: ${embeddingResponse.status}`);
    }
    
    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.predictions[0].embeddings.values;
    const embeddingTime = Date.now() - embeddingStartTime;
    console.log(`✅ Embedding generated in ${embeddingTime}ms`);
    
    // Search vector store using Supabase function
    const vectorSearchStartTime = Date.now();
    const { data, error } = await sb.rpc('find_similar_content', {
      query_embedding: queryEmbedding,
      content_type_filter: 'reverse_mortgage_kb',
      match_threshold: 0.7,
      match_count: 3
    });
    
    const vectorSearchTime = Date.now() - vectorSearchStartTime;
    console.log(`✅ Vector search completed in ${vectorSearchTime}ms`);
    
    if (error) {
      console.error('❌ Vector search error:', error);
      return { 
        error: error.message, 
        found: false,
        message: 'I\'m having trouble accessing that information. Let me connect you with one of our specialists.'
      };
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️ No matching knowledge base content found');
      return { 
        found: false, 
        message: 'That\'s a great question. I\'ll make sure we cover all those specifics during your appointment with the broker - they can walk you through exactly how that works for your situation. For now, let me get you scheduled.',
        fallback: true,
        results: []
      };
    }
    
    // Format results for Barbara to use conversationally
    const formattedResults = data.map((item, index) => ({
      rank: index + 1,
      content: item.content,
      similarity: Math.round(item.similarity * 100) + '%'
    }));
    
    // Combine top results into a single response
    const combinedKnowledge = formattedResults
      .map(r => r.content)
      .join('\n\n---\n\n');
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Knowledge search complete in ${totalTime}ms (embedding: ${embeddingTime}ms, search: ${vectorSearchTime}ms)`);
    
    return {
      found: true,
      question,
      answer: combinedKnowledge,
      sources_count: formattedResults.length,
      message: 'Use this information to answer the lead\'s question conversationally in 2 sentences max.',
      performance: {
        total_ms: totalTime,
        embedding_ms: embeddingTime,
        search_ms: vectorSearchTime
      }
    };
    
  } catch (err) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Knowledge search failed after ${totalTime}ms:`, err.message);
    return { 
      error: err.message,
      found: false,
      message: 'I\'m having trouble accessing that information right now. Let me connect you with one of our specialists.'
    };
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
    case 'assign_tracking_number':
      return await assignTrackingNumber(args);
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

