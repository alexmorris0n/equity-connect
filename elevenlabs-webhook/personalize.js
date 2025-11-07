/**
 * ElevenLabs Personalization Webhook
 * 
 * Called by ElevenLabs on every call to load dynamic prompts from Supabase.
 * This keeps your PromptManagement.vue portal as the source of truth!
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { GoogleAuth } = require('google-auth-library');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Vertex AI auth client (cached)
let vertexAuthClient = null;

async function getVertexAIToken() {
  if (!vertexAuthClient) {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credentialsJson) {
      throw new Error('Google credentials not available');
    }
    const credentials = JSON.parse(credentialsJson);
    const auth = new GoogleAuth({
      credentials,
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    vertexAuthClient = await auth.getClient();
  }
  const token = await vertexAuthClient.getAccessToken();
  return token.token;
}

async function generateEmbedding(question) {
  const projectId = process.env.GOOGLE_PROJECT_ID || 'barbara-475319';
  const location = 'us-central1';
  const model = 'text-embedding-005';
  
  const response = await fetch(
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
  
  if (!response.ok) {
    throw new Error(`Vertex AI failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.predictions[0].embeddings.values;
}

/**
 * Personalization endpoint
 * ElevenLabs calls this on each call with: caller_id, agent_id, called_number, call_sid
 */
app.post('/personalize', async (req, res) => {
  try {
    const { caller_id, agent_id, called_number, call_sid } = req.body;
    
    console.log('📞 Call starting:', {
      call_sid,
      from: caller_id,
      to: called_number
    });
    
    // 1. Lookup lead by phone number with broker info
    const { data: leads, error: leadError } = await supabase
      .from('leads')
      .select(`
        id, first_name, last_name, primary_email, primary_phone, primary_phone_e164,
        property_address, property_city, property_state, property_zip,
        property_value, estimated_equity, age, status, qualified, owner_occupied,
        assigned_broker_id,
        brokers:assigned_broker_id (
          id, contact_name, company_name, phone, nmls_number, nylas_grant_id
        )
      `)
      .or(`primary_phone.eq.${caller_id},primary_phone_e164.eq.${caller_id}`)
      .limit(1);
    
    if (leadError) {
      console.error('❌ Lead lookup error:', leadError);
    }
    
    const lead = leads?.[0];
    
    // 2. Determine call type (check qualified boolean, not status string)
    const callType = lead 
      ? (lead.qualified === true ? 'inbound-qualified' : 'inbound-unqualified')
      : 'inbound-unknown';
    
    console.log('📋 Call type:', callType, lead ? `(${lead.first_name} ${lead.last_name})` : '(unknown caller)');
    
    // 3. Load prompt from Supabase (YOUR PORTAL DATA!)
    // First get the prompt, then get its active version
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('id, voice, vad_threshold, vad_prefix_padding_ms, vad_silence_duration_ms')
      .eq('call_type', callType)
      .eq('is_active', true)
      .single();
    
    if (promptError || !prompt) {
      console.error('❌ Prompt not found:', promptError);
      throw new Error(`No prompt found for ${callType}`);
    }
    
    // Get the active version's content (9 sections in JSONB)
    const { data: version, error: versionError } = await supabase
      .from('prompt_versions')
      .select('content')
      .eq('prompt_id', prompt.id)
      .eq('is_active', true)
      .single();
    
    if (versionError || !version) {
      console.error('❌ Active version not found:', versionError);
      throw new Error(`No active version for ${callType}`);
    }
    
    console.log('✅ Loaded prompt for:', callType, 'version');
    
    // 4. Assemble prompt from 8 sections (match Barbara V3 format with section headers)
    const sections = version.content;
    const sectionParts = [];
    
    if (sections.role) sectionParts.push(`ROLE:\n${sections.role}`);
    if (sections.personality) sectionParts.push(`\nPERSONALITY & STYLE:\n${sections.personality}`);
    if (sections.context) sectionParts.push(`\nCONTEXT:\n${sections.context}`);
    if (sections.instructions) sectionParts.push(`\nCRITICAL INSTRUCTIONS:\n${sections.instructions}`);
    if (sections.conversation_flow) sectionParts.push(`\nCONVERSATION FLOW:\n${sections.conversation_flow}`);
    if (sections.tools) sectionParts.push(`\nTOOL USAGE:\n${sections.tools}`);
    if (sections.safety) sectionParts.push(`\nSAFETY & ESCALATION:\n${sections.safety}`);
    if (sections.output_format) sectionParts.push(`\nOUTPUT FORMAT:\n${sections.output_format}`);
    if (sections.pronunciation) sectionParts.push(`\nPRONUNCIATION GUIDE:\n${sections.pronunciation}`);
    
    const assembledPrompt = sectionParts.join('\n\n').trim();
    
    // 5. Inject variables (28 variables like Barbara V3 with defaults)
    let personalizedPrompt = assembledPrompt;
    
    // Build variables with defaults (so missing values don't break)
    const variables = {
      // Default values first (Barbara V3 pattern)
      brokerFirstName: 'your specialist',
      brokerFullName: 'your specialist',
      brokerCompany: 'Equity Connect',
      leadFirstName: '',
      leadLastName: '',
      propertyCity: '',
      estimatedEquity: '',
      callContext: 'inbound'
    };
    
    // Override with actual lead data if available
    if (lead && lead.brokers) {
      Object.assign(variables, {
        // Lead info
        leadFirstName: lead.first_name || '',
        leadLastName: lead.last_name || '',
        leadFullName: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
        leadEmail: lead.primary_email || '',
        leadPhone: lead.primary_phone || '',
        leadAge: lead.age || '',
        
        // Property info
        propertyAddress: lead.property_address || '',
        propertyCity: lead.property_city || '',
        propertyState: lead.property_state || '',
        propertyZip: lead.property_zip || '',  // Fixed: property_zip not property_zipcode
        propertyValue: lead.property_value ? `$${lead.property_value.toLocaleString()}` : '',
        propertyValueWords: lead.property_value ? numberToWords(lead.property_value) : '',
        estimatedEquity: lead.estimated_equity ? `$${lead.estimated_equity.toLocaleString()}` : '',
        estimatedEquityWords: lead.estimated_equity ? numberToWords(lead.estimated_equity) : '',
        equity50Percent: lead.estimated_equity ? `$${(lead.estimated_equity * 0.5).toLocaleString()}` : '',
        equity60Percent: lead.estimated_equity ? `$${(lead.estimated_equity * 0.6).toLocaleString()}` : '',
        ownerOccupied: lead.owner_occupied ? 'yes' : 'no',
        
        // Broker info
        brokerFirstName: lead.brokers?.contact_name?.split(' ')[0] || 'your specialist',
        brokerLastName: lead.brokers?.contact_name?.split(' ')[1] || '',
        brokerFullName: lead.brokers?.contact_name || 'your specialist',
        brokerCompany: lead.brokers?.company_name || 'Equity Connect',
        brokerPhone: lead.brokers?.phone || '',
        brokerNMLS: lead.brokers?.nmls_number || '',
        
        // Call metadata
        callType: callType,
        callerPhone: caller_id,
        calledNumber: called_number
      });
    } else if (lead) {
      // Lead without broker - override defaults with partial data
      Object.assign(variables, {
        leadFirstName: lead.first_name || '',
        leadLastName: lead.last_name || '',
        propertyCity: lead.property_city || '',
        propertyZip: lead.property_zip || '',
        estimatedEquity: lead.estimated_equity ? `$${lead.estimated_equity.toLocaleString()}` : '',
        callType: callType
      });
    }
    
    // Replace ALL {{variable}} placeholders (even defaults)
    Object.entries(variables).forEach(([key, value]) => {
      personalizedPrompt = personalizedPrompt.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        String(value)
      );
    });
    
    // 6. Build first message
    const firstMessage = lead 
      ? `Hi ${lead.first_name}! This is Barbara with Equity Connect. How are you today?`
      : "Hi! This is Barbara with Equity Connect. What brought you to call today?";
    
    // 7. Return to ElevenLabs (per their docs structure)
    const response = {
      type: "conversation_initiation_client_data",
      conversation_config_override: {
        agent: {
          prompt: {
            prompt: personalizedPrompt  // FROM YOUR SUPABASE PORTAL!
          },
          first_message: firstMessage
        }
      },
      dynamic_variables: {
        lead_id: lead?.id || 'unknown',
        broker_id: lead?.assigned_broker_id || 'unknown',
        broker_name: lead?.brokers?.contact_name || 'your specialist',
        call_type: callType,
        lead_first_name: lead?.first_name || '',
        lead_email: lead?.primary_email || '',  // Add email to dynamic variables
        property_city: lead?.property_city || ''
      }
    };
    
    console.log('✅ Personalization complete:', {
      call_type: callType,
      has_lead: !!lead,
      prompt_length: personalizedPrompt.length,
      first_message_preview: firstMessage.substring(0, 50)
    });
    
    res.json(response);
    
  } catch (err) {
    console.error('❌ Personalization error:', err);
    
    // Fallback to default prompt on error
    res.json({
      type: "conversation_initiation_client_data",
      conversation_config_override: {
        agent: {
          prompt: {
            prompt: `You are Barbara, a warm and professional coordinator for Equity Connect.

Your role: Pre-qualify homeowners interested in reverse mortgages, answer questions, and book appointments with licensed specialists.

Keep responses brief (1-2 sentences). Ask one question at a time.`
          },
          first_message: "Hi! This is Barbara with Equity Connect. How can I help you today?"
        }
      },
      dynamic_variables: {
        call_type: 'inbound-unknown',
        error: 'fallback_prompt_used'
      }
    });
  }
});

/**
 * Tool Routes (on same port as personalize)
 */

// Tool 1: Get Lead Context (supports both names) - FULL Barbara V3 structure
app.post('/tools/get_lead_context', async (req, res) => {
  try {
    const { phone_number } = req.body;
    console.log('🔍 get_lead_context called:', phone_number);
    
    // Get lead with broker info (match Barbara V3 structure)
    const { data: leads } = await supabase
      .from('leads')
      .select(`
        *, 
        brokers:assigned_broker_id (*)
      `)
      .or(`primary_phone.eq.${phone_number},primary_phone_e164.eq.${phone_number}`)
      .single();
    
    if (!leads) {
      return res.json({ found: false });
    }
    
    const lead = leads;
    const broker = lead.brokers;
    
    // Get last interaction for context
    const { data: lastInteraction } = await supabase
      .from('interactions')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const lastCallContext = lastInteraction?.metadata || {};
    const isQualified = lead.qualified === true;
    
    console.log('✅ Lead found:', lead.first_name, lead.last_name);
    
    // Return FULL structure like Barbara V3
    res.json({
      found: true,
      lead_id: lead.id,
      broker_id: lead.assigned_broker_id,
      broker: {
        name: broker?.contact_name || 'Not assigned',
        company: broker?.company_name || '',
        phone: broker?.phone || ''
      },
      lead: {
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.primary_email,
        phone: lead.primary_phone,
        property_address: lead.property_address,
        property_city: lead.property_city,
        property_state: lead.property_state,
        property_zip: lead.property_zip,
        property_value: lead.property_value,
        estimated_equity: lead.estimated_equity,
        age: lead.age,
        owner_occupied: lead.owner_occupied,
        status: lead.status,
        qualified: isQualified
      },
      last_call: {
        money_purpose: lastCallContext.money_purpose || null,
        specific_need: lastCallContext.specific_need || null,
        amount_needed: lastCallContext.amount_needed || null,
        timeline: lastCallContext.timeline || null,
        objections: lastCallContext.objections || [],
        questions_asked: lastCallContext.questions_asked || [],
        appointment_scheduled: lastCallContext.appointment_scheduled || false,
        last_outcome: lastInteraction?.content || null
      }
    });
  } catch (err) {
    console.error('❌ get_lead_context error:', err);
    res.json({ found: false, error: err.message });
  }
});

// Add aliases for old tool names
app.post('/tools/lookup_lead', (req, res, next) => { req.url = '/tools/get_lead_context'; next(); });
app.post('/tools/check_availability', (req, res, next) => { req.url = '/tools/check_broker_availability'; next(); });

// Tool 2: Check Broker Availability (REAL Nylas integration)
app.post('/tools/check_broker_availability', async (req, res) => {
  try {
    const { broker_id, days_ahead = 7 } = req.body;
    console.log('📅 check_broker_availability called:', broker_id);
    
    // Get broker's Nylas grant_id
    const { data: broker } = await supabase
      .from('brokers')
      .select('nylas_grant_id, contact_name')
      .eq('id', broker_id)
      .single();
    
    if (!broker || !broker.nylas_grant_id) {
      console.error('❌ No Nylas connection for broker');
      return res.json({
        available: false,
        slots: [],
        message: "I'm having trouble checking the calendar. Let me have your specialist call you back."
      });
    }
    
    // Call Nylas v3 Events API (Barbara V3 method)
    const axios = require('axios');
    const NYLAS_API_URL = 'https://api.us.nylas.com';
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = Math.floor((Date.now() + 14 * 24 * 60 * 60 * 1000) / 1000);
    
    const eventsUrl = `${NYLAS_API_URL}/v3/grants/${broker.nylas_grant_id}/events?calendar_id=primary&start=${startTime}&end=${endTime}`;
    
    const response = await axios.get(eventsUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.NYLAS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const events = response.data.data || [];
    console.log(`✅ Got ${events.length} events from Nylas`);
    
    // Extract busy times
    const busyTimes = events.map(event => ({
      start: event.when.start_time * 1000,
      end: event.when.end_time * 1000
    }));
    
    // Find free slots (Barbara V3 method)
    const { findFreeSlots, formatAvailableSlots } = require('./nylas-helpers');
    const freeSlots = findFreeSlots(
      startTime * 1000,
      endTime * 1000,
      busyTimes,
      30 * 60 * 1000,  // 30 min duration
      'America/Los_Angeles'
    );
    
    const formattedSlots = formatAvailableSlots(freeSlots, null, null, 'America/Los_Angeles');
    
    console.log(`✅ Found ${formattedSlots.length} available slots`);
    
    res.json({
      available: formattedSlots.length > 0,
      broker_name: broker.contact_name,
      slots: formattedSlots,
      message: formattedSlots.length > 0
        ? `${broker.contact_name} has ${formattedSlots.length} times available.`
        : `No availability in the next 14 days.`
    });
  } catch (err) {
    console.error('❌ check_broker_availability error:', err);
    res.json({ 
      available: false, 
      slots: [],
      message: "Calendar check failed. Let me have your specialist call back."
    });
  }
});

// Tool 3: Search Knowledge
app.post('/tools/search_knowledge', async (req, res) => {
  try {
    const { question } = req.body;
    console.log('📚 search_knowledge called:', question);
    
    // Check if Google credentials available
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      console.warn('⚠️ Google credentials not available - using fallback');
      return res.json({
        answer: "I'd be happy to connect you with your specialist who can answer that in detail. They have all the latest information."
      });
    }
    
    // Generate embedding for the question
    const queryEmbedding = await generateEmbedding(question);
    console.log('✅ Embedding generated');
    
    // Vector search in Supabase
    const { data, error } = await supabase.rpc('find_similar_content', {
      query_embedding: queryEmbedding,
      content_type_filter: 'reverse_mortgage_kb',
      match_threshold: 0.7,
      match_count: 3
    });
    
    if (error || !data || data.length === 0) {
      console.warn('⚠️ No KB results found');
      return res.json({
        answer: "That's a great question. Your specialist can give you the most accurate answer for your specific situation. Would you like me to have them call you back?"
      });
    }
    
    // Return top result
    const topResult = data[0];
    const answer = topResult.content;
    
    console.log(`✅ KB search complete - ${data.length} results, score: ${topResult.similarity}`);
    
    res.json({
      answer,
      sources: data.length,
      confidence: topResult.similarity
    });
    
  } catch (err) {
    console.error('❌ search_knowledge error:', err);
    res.json({ 
      answer: "I'm having trouble accessing the knowledge base. Your specialist can answer that question. Would you like them to call you back?"
    });
  }
});

// Tool 4: Book Appointment (REAL Nylas integration)
app.post('/tools/book_appointment', async (req, res) => {
  try {
    const { broker_id, start_time, lead_email, lead_name, lead_id } = req.body;
    console.log('📅 book_appointment called:', { broker_id, start_time, lead_email });
    
    // Get broker's Nylas grant_id
    const { data: broker } = await supabase
      .from('brokers')
      .select('nylas_grant_id, contact_name')
      .eq('id', broker_id)
      .single();
    
    if (!broker || !broker.nylas_grant_id) {
      console.error('❌ Broker has no Nylas connection');
      return res.json({
        success: false,
        message: "I'm having trouble accessing the calendar. Let me have your specialist call you back."
      });
    }
    
    // Create Nylas event (v3 API - match Barbara V3)
    const axios = require('axios');
    const NYLAS_API_URL = 'https://api.us.nylas.com';
    const createEventUrl = `${NYLAS_API_URL}/v3/grants/${broker.nylas_grant_id}/events?calendar_id=primary`;
    
    const eventResponse = await axios.post(
      createEventUrl,
      {
        title: 'Reverse Mortgage Consultation',
        description: `Consultation with ${lead_name} booked via Barbara AI (ElevenLabs)`,
        when: {
          start_time: Math.floor(new Date(start_time).getTime() / 1000),
          end_time: Math.floor((new Date(start_time).getTime() + (30 * 60 * 1000)) / 1000)
        },
        participants: [
          {
            email: lead_email,
            name: lead_name,
            status: 'yes'
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.NYLAS_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const nylasEventId = eventResponse.data.id;
    console.log('✅ Nylas event created:', nylasEventId);
    
    // Log to interactions
    if (lead_id && lead_id !== 'unknown') {
      await supabase.from('interactions').insert({
        lead_id,
        type: 'appointment_booked',
        direction: 'inbound',
        content: `Appointment booked with ${broker.contact_name}`,
        metadata: {
          broker_id,
          nylas_event_id: nylasEventId,
          start_time,
          booked_via: 'elevenlabs_agent',
          conversation_id: req.headers['x-conversation-id'] || null
        }
      });
    }
    
    res.json({
      success: true,
      event_id: nylasEventId,
      message: `Perfect! I've scheduled your consultation with ${broker.contact_name} for ${new Date(start_time).toLocaleString()}. You'll receive a calendar invite at ${lead_email}.`
    });
    
  } catch (err) {
    console.error('❌ book_appointment error:', err);
    res.json({ 
      success: false,
      message: "I'm having trouble booking that time. Let me have your specialist call you back."
    });
  }
});

// Tool 5: Update Lead Info
app.post('/tools/update_lead_info', async (req, res) => {
  try {
    const { lead_id, updates } = req.body;
    console.log('📝 update_lead_info called');
    
    await supabase.from('leads').update(updates).eq('id', lead_id);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

/**
 * Post-Call Webhook
 * Called by ElevenLabs after each call with full transcript
 * Matches Barbara V3's save_interaction functionality
 */
app.post('/post-call', async (req, res) => {
  try {
    const { 
      conversation_id,
      agent_id,
      call_duration_secs,
      transcript,
      metadata,
      analysis
    } = req.body;
    
    console.log('📞 Post-call webhook:', { conversation_id, duration: call_duration_secs });
    
    // Extract IDs from metadata (set by our personalization webhook)
    const leadId = metadata?.conversation_initiation_client_data?.dynamic_variables?.lead_id;
    const brokerId = metadata?.conversation_initiation_client_data?.dynamic_variables?.broker_id;
    
    if (!leadId || leadId === 'unknown') {
      console.log('⚠️ No lead_id, skipping');
      return res.json({ status: 'ok', message: 'No lead to log' });
    }
    
    // Build transcript text
    const transcriptText = transcript?.map(t => `${t.role}: ${t.message}`).join('\n') || '';
    
    // Extract tool calls made
    const toolCallsMade = transcript
      ?.filter(t => t.tool_calls && t.tool_calls.length > 0)
      .flatMap(t => t.tool_calls.map(tc => tc.tool_name)) || [];
    
    // Determine outcome from conversation
    const hasAppointment = transcript?.some(t => 
      t.role === 'agent' && t.message?.toLowerCase().includes('appointment is booked')
    );
    
    const outcome = hasAppointment ? 'appointment_booked' : 
                    call_duration_secs > 60 ? 'positive' : 'neutral';
    
    // Build comprehensive metadata (match Barbara V3 structure)
    const interactionMetadata = {
      ai_agent: 'barbara_elevenlabs',
      version: '1.0',
      conversation_id,
      agent_id,
      
      // Transcript
      conversation_transcript: transcript || [],
      transcript_text: transcriptText,
      message_count: transcript?.length || 0,
      
      // Tool tracking
      tool_calls_made: toolCallsMade,
      tool_count: toolCallsMade.length,
      
      // Appointment tracking
      appointment_scheduled: hasAppointment,
      
      // Call metrics
      call_duration_seconds: call_duration_secs,
      
      // ElevenLabs analysis
      call_summary: analysis?.call_summary_title || null,
      transcript_summary: analysis?.transcript_summary || null,
      
      // Platform
      platform: 'elevenlabs',
      saved_at: new Date().toISOString()
    };
    
    // Save to interactions table
    const { data, error } = await supabase
      .from('interactions')
      .insert({
        lead_id: leadId,
        broker_id: brokerId || null,
        type: 'voice_call',
        direction: 'inbound',
        content: `Call completed - ${call_duration_secs}s - ${outcome}`,
        duration_seconds: call_duration_secs,
        outcome,
        metadata: interactionMetadata,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Failed to save interaction:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('✅ Interaction saved:', data.id);
    
    // Update lead engagement stats (match Barbara V3)
    if (hasAppointment) {
      await supabase
        .from('leads')
        .update({ qualified: true })
        .eq('id', leadId);
    }
    
    await supabase
      .from('leads')
      .update({
        last_contact: new Date().toISOString(),
        last_engagement: new Date().toISOString()
      })
      .eq('id', leadId);
    
    res.json({ 
      status: 'ok', 
      interaction_id: data.id,
      outcome
    });
    
  } catch (err) {
    console.error('❌ Post-call error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'elevenlabs-personalization-webhook' });
});

// Helper: Convert numbers to words (simple version)
function numberToWords(num) {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)} million`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(0)} thousand`;
  }
  return num.toString();
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🎯 ElevenLabs Personalization Webhook listening on port ${PORT}`);
  console.log(`📍 Endpoint: POST /personalize`);
  console.log(`❤️ Health check: GET /health`);
});

