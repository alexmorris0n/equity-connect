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
const OpenAI = require('openai');

// Initialize OpenAI for call evaluation (optional)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('✅ OpenAI client initialized for AI evaluation');
} else {
  console.log('⚠️ OPENAI_API_KEY not set - AI evaluation disabled');
}

const app = express();
app.use(express.json({ limit: '10mb' }));  // Increase limit for large transcripts

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
 * AI Call Evaluation (async - runs after webhook responds)
 * Uses GPT-5-mini to score call quality on 6 metrics
 */
async function evaluateCallAsync(interactionId, transcript, callType) {
  try {
    // Skip if OpenAI is not configured
    if (!openai) {
      console.log('⚠️  OpenAI not configured - skipping AI evaluation');
      return;
    }
    
    console.log(`📊 Starting AI evaluation for interaction ${interactionId}`);
    
    if (!transcript || transcript.length === 0) {
      console.warn('⚠️  No transcript to evaluate');
      return;
    }
    
    // Format transcript for GPT (Caller/Barbara format)
    const formattedTranscript = transcript
      .map(t => `${t.role === 'user' ? 'Caller' : 'Barbara'}: ${t.message || ''}`)
      .filter(line => line.trim())
      .join('\n\n');
    
    if (!formattedTranscript.trim()) {
      console.warn('⚠️  Transcript is empty after formatting');
      return;
    }
    
    const evaluationPrompt = `You are a call quality analyst specializing in reverse mortgage sales calls. Evaluate the following conversation transcript between Barbara (AI assistant) and a potential client.

Score each metric from 0-10 where:
- 0-3: Poor/Needs significant improvement
- 4-6: Acceptable/Needs minor improvement
- 7-8: Good/Effective
- 9-10: Excellent/Best practice

# Evaluation Metrics:

1. **Opening Effectiveness (0-10)**: Did Barbara establish rapport, confirm the caller's name, and set a positive tone?

2. **Property Discussion Quality (0-10)**: How well did Barbara gather property details (location, value, mortgage status)?

3. **Objection Handling (0-10)**: How effectively did Barbara address concerns and reframe objections?

4. **Booking Attempt Quality (0-10)**: Did Barbara make clear, confident appointment booking attempts? Did she use tie-downs?

5. **Tone Consistency (0-10)**: Was Barbara conversational, empathetic, and professional throughout?

6. **Overall Call Flow (0-10)**: Did the conversation follow a logical progression? Was it too rushed or too slow?

# Analysis Categories:

- **Strengths**: What did Barbara do well? (2-4 specific examples)
- **Weaknesses**: What could be improved? (2-4 specific examples)
- **Objections Handled**: List any objections the caller raised and how Barbara addressed them
- **Booking Opportunities Missed**: Did Barbara miss clear chances to book an appointment?
- **Red Flags**: Any concerning patterns (talking over caller, pushy behavior, incorrect information)
- **Summary**: 2-3 sentence overall assessment

Return your evaluation as a JSON object with this exact structure:
{
  "scores": {
    "opening_effectiveness": 0-10,
    "property_discussion_quality": 0-10,
    "objection_handling": 0-10,
    "booking_attempt_quality": 0-10,
    "tone_consistency": 0-10,
    "overall_call_flow": 0-10
  },
  "analysis": {
    "strengths": ["...", "..."],
    "weaknesses": ["...", "..."],
    "objections_handled": ["...", "..."],
    "booking_opportunities_missed": ["...", "..."],
    "red_flags": ["...", "..."],
    "summary": "..."
  }
}`;
    
    const startTime = Date.now();
    
    // Call GPT-5-mini for evaluation
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: evaluationPrompt },
        { role: 'user', content: `# Conversation Transcript:\n\n${formattedTranscript}` }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 2000
    });
    
    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No evaluation result from OpenAI');
    }
    
    const parsed = JSON.parse(result);
    const evaluationDuration = Date.now() - startTime;
    
    // Validate structure
    if (!parsed.scores || !parsed.analysis) {
      throw new Error('Invalid evaluation result structure');
    }
    
    // Save to call_evaluations table
    const { error: evalError } = await supabase
      .from('call_evaluations')
      .insert({
        interaction_id: interactionId,
        opening_effectiveness: parsed.scores.opening_effectiveness,
        property_discussion_quality: parsed.scores.property_discussion_quality,
        objection_handling: parsed.scores.objection_handling,
        booking_attempt_quality: parsed.scores.booking_attempt_quality,
        tone_consistency: parsed.scores.tone_consistency,
        overall_call_flow: parsed.scores.overall_call_flow,
        analysis: parsed.analysis,
        prompt_registry_id: callType,
        evaluation_model: 'gpt-5-mini',
        evaluation_duration_ms: evaluationDuration,
        evaluated_at: new Date().toISOString()
      });
    
    if (evalError) {
      console.error('❌ Failed to save evaluation:', evalError);
    } else {
      console.log(`✅ AI evaluation saved for ${interactionId} (${evaluationDuration}ms)`);
    }
    
  } catch (err) {
    console.error('❌ AI evaluation error:', err);
    throw err;
  }
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
        tts: {
          speed: 0.85  // Slow down 15% for seniors (more comfortable pace)
        },
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
        tts: {
          speed: 0.85  // Slow down 15% for seniors (more comfortable pace)
        },
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
app.post('/tools/update_lead', (req, res, next) => { req.url = '/tools/update_lead_info'; next(); });

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
    const { lead_id, last_name, property_address, age, property_value, owner_occupied } = req.body;
    console.log('📝 update_lead_info called for lead:', lead_id, { last_name, property_address, age, property_value, owner_occupied });
    
    // Build update object (only include fields that were provided)
    const updateData = {};
    if (last_name !== undefined) updateData.last_name = last_name;
    if (property_address !== undefined) updateData.property_address = property_address;
    if (age !== undefined) updateData.age = age;
    if (property_value !== undefined) updateData.property_value = property_value;
    if (owner_occupied !== undefined) updateData.owner_occupied = owner_occupied;
    
    // Update timestamps
    updateData.updated_at = new Date().toISOString();
    updateData.last_contact = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', lead_id)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Lead update error:', error);
      return res.json({ 
        success: false, 
        error: error.message,
        message: 'Failed to update lead information.'
      });
    }
    
    const updatedFields = Object.keys(updateData).filter(k => k !== 'updated_at' && k !== 'last_contact');
    console.log('✅ Updated fields:', updatedFields.join(', '));
    
    res.json({
      success: true,
      message: 'Lead information updated successfully.',
      updated_fields: updatedFields
    });
    
  } catch (err) {
    console.error('❌ update_lead_info error:', err);
    res.json({ 
      success: false, 
      error: err.message,
      message: 'Unable to update lead information.'
    });
  }
});

// Tool 6: Cancel Appointment
app.post('/tools/cancel_appointment', async (req, res) => {
  try {
    const { lead_id } = req.body;
    console.log('🗑️ cancel_appointment called for lead:', lead_id);
    
    // Find most recent appointment for this lead
    const { data: appointment, error: appointmentError } = await supabase
      .from('interactions')
      .select('*')
      .eq('lead_id', lead_id)
      .eq('type', 'appointment')
      .order('created_at', { desc: true })
      .limit(1)
      .single();
    
    if (appointmentError || !appointment) {
      console.log('❌ No appointment found');
      return res.json({
        success: false,
        error: 'No appointment found',
        message: 'I couldn\'t find an existing appointment to cancel. Would you like to book a new one instead?'
      });
    }
    
    // Check if already cancelled
    if (appointment.outcome === 'cancelled') {
      return res.json({
        success: false,
        error: 'Already cancelled',
        message: 'This appointment has already been cancelled.'
      });
    }
    
    const nylasEventId = appointment.metadata?.nylas_event_id;
    const brokerId = appointment.broker_id;
    
    if (!nylasEventId) {
      console.log('❌ No Nylas event ID found');
      return res.json({
        success: false,
        error: 'Missing event ID',
        message: 'Unable to cancel appointment - missing calendar event reference.'
      });
    }
    
    // Get broker info (including Nylas grant ID)
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('contact_name, nylas_grant_id')
      .eq('id', brokerId)
      .single();
    
    if (brokerError || !broker || !broker.nylas_grant_id) {
      console.log('❌ Broker or grant not found');
      return res.json({
        success: false,
        error: 'Broker calendar not connected',
        message: 'Unable to cancel - broker calendar not connected.'
      });
    }
    
    // Delete calendar event via Nylas v3
    const deleteUrl = `${NYLAS_API_URL}/v3/grants/${broker.nylas_grant_id}/events/${nylasEventId}?calendar_id=primary`;
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${NYLAS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.log('❌ Nylas delete failed:', deleteResponse.status, errorText);
      return res.json({
        success: false,
        error: 'Calendar deletion failed',
        message: 'Unable to remove from calendar at this time.'
      });
    }
    
    console.log('✅ Nylas event deleted');
    
    // Update interaction record
    await supabase
      .from('interactions')
      .update({ outcome: 'cancelled' })
      .eq('id', appointment.id);
    
    console.log('✅ Appointment cancelled successfully');
    
    res.json({
      success: true,
      message: `Your appointment with ${broker.contact_name} has been cancelled.`
    });
    
  } catch (err) {
    console.error('❌ cancel_appointment error:', err);
    res.json({ success: false, error: err.message });
  }
});

// Tool 7: Reschedule Appointment
app.post('/tools/reschedule_appointment', async (req, res) => {
  try {
    const { lead_id, new_scheduled_for } = req.body;
    console.log('📅 reschedule_appointment called for lead:', lead_id, 'to:', new_scheduled_for);
    
    // Find most recent appointment for this lead
    const { data: appointment, error: appointmentError } = await supabase
      .from('interactions')
      .select('*')
      .eq('lead_id', lead_id)
      .eq('type', 'appointment')
      .order('created_at', { desc: true })
      .limit(1)
      .single();
    
    if (appointmentError || !appointment) {
      console.log('❌ No appointment found');
      return res.json({
        success: false,
        error: 'No appointment found',
        message: 'I couldn\'t find an existing appointment to reschedule. Would you like to book a new one instead?'
      });
    }
    
    // Check if already cancelled
    if (appointment.outcome === 'cancelled') {
      return res.json({
        success: false,
        error: 'Appointment cancelled',
        message: 'This appointment has been cancelled. Would you like to book a new appointment instead?'
      });
    }
    
    const nylasEventId = appointment.metadata?.nylas_event_id;
    const brokerId = appointment.broker_id;
    const oldScheduledFor = appointment.scheduled_for;
    
    if (!nylasEventId) {
      console.log('❌ No Nylas event ID found');
      return res.json({
        success: false,
        error: 'Missing event ID',
        message: 'Unable to reschedule appointment - missing calendar event reference.'
      });
    }
    
    // Get broker info (including Nylas grant ID)
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('contact_name, email, nylas_grant_id')
      .eq('id', brokerId)
      .single();
    
    if (brokerError || !broker || !broker.nylas_grant_id) {
      console.log('❌ Broker or grant not found');
      return res.json({
        success: false,
        error: 'Broker calendar not connected',
        message: 'Unable to reschedule - broker calendar not connected.'
      });
    }
    
    // Parse new time
    const newDate = new Date(new_scheduled_for);
    const startUnix = Math.floor(newDate.getTime() / 1000);
    const endUnix = startUnix + 3600; // 1 hour
    
    // Update calendar event via Nylas v3
    const updateUrl = `${NYLAS_API_URL}/v3/grants/${broker.nylas_grant_id}/events/${nylasEventId}?calendar_id=primary`;
    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${NYLAS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        when: {
          start_time: startUnix,
          end_time: endUnix
        }
      })
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.log('❌ Nylas update failed:', updateResponse.status, errorText);
      return res.json({
        success: false,
        error: 'Calendar update failed',
        message: 'Unable to update calendar at this time.'
      });
    }
    
    console.log('✅ Nylas event updated');
    
    // Update interaction record
    await supabase
      .from('interactions')
      .update({ 
        scheduled_for: new_scheduled_for,
        metadata: {
          ...appointment.metadata,
          rescheduled_from: oldScheduledFor,
          rescheduled_at: new Date().toISOString()
        }
      })
      .eq('id', appointment.id);
    
    console.log('✅ Appointment rescheduled successfully');
    
    res.json({
      success: true,
      new_time: new_scheduled_for,
      message: `Your appointment with ${broker.contact_name} has been moved to ${newDate.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`
    });
    
  } catch (err) {
    console.error('❌ reschedule_appointment error:', err);
    res.json({ success: false, error: err.message });
  }
});

// Tool 8: Find Broker by Territory
app.post('/tools/find_broker_by_territory', async (req, res) => {
  try {
    const { city, zip_code } = req.body;
    console.log('🗺️ find_broker_by_territory called:', { city, zip_code });
    
    // Query broker_territories table
    let query = supabase
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
      console.log('ℹ️ No territory match, using default broker');
      const { data: defaultBroker } = await supabase
        .from('brokers')
        .select('id, contact_name, company_name')
        .eq('id', '6a3c5ed5-664a-4e13-b019-99fe8db74174')
        .single();
      
      if (!defaultBroker) {
        return res.json({
          found: false,
          error: 'No broker available',
          message: 'Unable to assign a broker at this time.'
        });
      }
      
      console.log('✅ Assigned default broker:', defaultBroker.contact_name);
      
      return res.json({
        found: true,
        broker_id: defaultBroker.id,
        broker_name: defaultBroker.contact_name.split(' ')[0], // First name only
        company_name: defaultBroker.company_name,
        message: `Assigned to ${defaultBroker.contact_name} (default broker - no specific territory match for ${city || zip_code})`
      });
    }
    
    const broker = data.brokers;
    console.log('✅ Found broker:', broker.contact_name, 'for', city || zip_code);
    
    res.json({
      found: true,
      broker_id: broker.id,
      broker_name: broker.contact_name.split(' ')[0], // First name only
      company_name: broker.company_name,
      broker_phone: broker.phone,
      message: `Found ${broker.contact_name} who serves ${city || zip_code}.`
    });
    
  } catch (err) {
    console.error('❌ find_broker_by_territory error:', err);
    res.json({ found: false, error: err.message });
  }
});

// Tool 9: Check Consent & DNC
app.post('/tools/check_consent_dnc', async (req, res) => {
  try {
    const { lead_id } = req.body;
    console.log('🔒 check_consent_dnc called for lead:', lead_id);
    
    const { data: lead, error } = await supabase
      .from('leads')
      .select('consent, status, first_name, last_name')
      .eq('id', lead_id)
      .single();
    
    if (error) {
      console.error('❌ Consent check error:', error);
      return res.json({ 
        error: error.message, 
        can_call: false,
        message: 'Unable to verify consent status.'
      });
    }
    
    // Check consent and not closed_lost (DNC equivalent)
    const canCall = lead.consent === true && lead.status !== 'closed_lost';
    
    console.log(`${canCall ? '✅' : '❌'} Consent check: ${canCall ? 'OK' : 'DENIED'} for ${lead.first_name} ${lead.last_name}`);
    
    res.json({
      can_call: canCall,
      has_consent: lead.consent,
      is_dnc: lead.status === 'closed_lost',
      message: canCall 
        ? 'Lead has consent and is not on DNC list. You may proceed with the call.'
        : 'Lead does not have consent or is on DNC list. End the call politely and immediately.'
    });
    
  } catch (err) {
    console.error('❌ check_consent_dnc error:', err);
    res.json({ 
      error: err.message, 
      can_call: false,
      message: 'Unable to verify consent. Do not proceed with sales conversation.'
    });
  }
});

/**
 * Post-Call Webhook
 * Called by ElevenLabs after each call with full transcript
 * Matches Barbara V3's save_interaction functionality
 */
app.post('/post-call', async (req, res) => {
  try {
    // ElevenLabs sends { type, event_timestamp, data }
    const { type, data } = req.body;
    
    if (type !== 'post_call_transcription') {
      console.log('⚠️ Ignoring webhook type:', type);
      return res.json({ status: 'ok' });
    }
    
    const { 
      conversation_id,
      agent_id,
      transcript,
      metadata,
      analysis
    } = data;
    
    const call_duration_secs = metadata?.call_duration_secs || 0;
    
    console.log('📞 Post-call webhook:', { conversation_id, duration: call_duration_secs });
    
    // Extract IDs from conversation_initiation_client_data
    const leadId = data.conversation_initiation_client_data?.dynamic_variables?.lead_id;
    const brokerId = data.conversation_initiation_client_data?.dynamic_variables?.broker_id;
    
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
    
    // Determine call direction from dynamic variables
    const callContext = data.conversation_initiation_client_data?.dynamic_variables?.call_context || 'inbound';
    const direction = callContext === 'outbound' ? 'outbound' : 'inbound';
    
    // Extract call_type for AI evaluation
    const callType = data.conversation_initiation_client_data?.dynamic_variables?.call_type || null;
    
    // Build comprehensive metadata (match Barbara V3 structure)
    const interactionMetadata = {
      ai_agent: 'barbara_elevenlabs',
      version: '1.0',
      conversation_id,
      agent_id,
      call_type: callType,
      
      // Transcript - transform to portal format (role + text fields)
      conversation_transcript: (transcript || []).map(t => ({
        role: t.role === 'agent' ? 'assistant' : 'user',  // Map 'agent' to 'assistant' for portal
        text: t.message || '',  // Map 'message' to 'text' for portal
        timestamp: t.time_in_call_secs || 0
      })),
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
    const { data: savedInteraction, error: saveError } = await supabase
      .from('interactions')
      .insert({
        lead_id: leadId,
        broker_id: brokerId || null,
        type: 'ai_call',
        direction: direction,
        content: `Call completed - ${call_duration_secs}s - ${outcome}`,
        duration_seconds: call_duration_secs,
        outcome,
        metadata: interactionMetadata,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (saveError) {
      console.error('❌ Failed to save interaction:', saveError);
      return res.status(500).json({ error: saveError.message });
    }
    
    console.log('✅ Interaction saved:', savedInteraction.id);
    
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
    
    // Run AI evaluation asynchronously (don't block webhook response)
    evaluateCallAsync(savedInteraction.id, transcript, callType).catch(err => {
      console.error('❌ AI evaluation failed:', err);
    });
    
    res.json({ 
      status: 'ok', 
      interaction_id: savedInteraction.id,
      outcome
    });
    
  } catch (err) {
    console.error('❌ Post-call error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Outbound Call Endpoint (called by Barbara MCP from n8n)
 * POST /api/outbound-call
 */
app.post('/api/outbound-call', async (req, res) => {
  const { to_phone, from_phone, lead_id, broker_id, ...variables } = req.body;
  
  console.log('📞 Outbound call request:', { to_phone, from_phone, lead_id, broker_id });
  
  try {
    // Validate required fields
    if (!to_phone || !lead_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to_phone, lead_id'
      });
    }
    
    // Normalize phone numbers to E.164 format
    const normalizedToPhone = to_phone.startsWith('+') ? to_phone : `+1${to_phone.replace(/\D/g, '')}`;
    let normalizedFromPhone = from_phone ? (from_phone.startsWith('+') ? from_phone : `+1${from_phone.replace(/\D/g, '')}`) : null;
    
    // Look up full lead data from Supabase (like personalization webhook does)
    console.log(`🔍 Looking up lead data for ${lead_id}`);
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
      .eq('id', lead_id)
      .limit(1);
    
    const lead = leads?.[0];
    
    if (!lead) {
      console.warn(`⚠️  Lead ${lead_id} not found in database`);
      return res.status(404).json({
        success: false,
        message: 'Lead not found in database'
      });
    }
    
    console.log(`✅ Lead found: ${lead.first_name} ${lead.last_name || ''} (${lead.property_city || 'no city'})`);
    
    // Use database data, fallback to n8n-provided variables
    const enrichedVariables = {
      lead_first_name: lead.first_name || variables.lead_first_name || '',
      lead_last_name: lead.last_name || variables.lead_last_name || '',
      lead_full_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || variables.lead_full_name || '',
      lead_email: lead.primary_email || variables.lead_email || '',
      lead_phone: lead.primary_phone_e164 || lead.primary_phone || variables.lead_phone || normalizedToPhone,
      
      property_address: lead.property_address || variables.property_address || '',
      property_city: lead.property_city || variables.property_city || '',
      property_state: lead.property_state || variables.property_state || '',
      property_zipcode: lead.property_zip || variables.property_zipcode || '',
      property_value: lead.property_value?.toString() || variables.property_value || '',
      property_value_formatted: lead.property_value ? `$${(lead.property_value / 1000000).toFixed(1)}M` : variables.property_value_formatted || '',
      
      estimated_equity: lead.estimated_equity?.toString() || variables.estimated_equity || '',
      estimated_equity_formatted: lead.estimated_equity ? `$${(lead.estimated_equity / 1000000).toFixed(1)}M` : variables.estimated_equity_formatted || '',
      equity_50_percent: lead.estimated_equity ? (lead.estimated_equity * 0.5).toString() : variables.equity_50_percent || '',
      equity_50_formatted: lead.estimated_equity ? `$${(lead.estimated_equity * 0.5 / 1000).toFixed(0)}K` : variables.equity_50_formatted || '',
      equity_60_percent: lead.estimated_equity ? (lead.estimated_equity * 0.6).toString() : variables.equity_60_percent || '',
      equity_60_formatted: lead.estimated_equity ? `$${(lead.estimated_equity * 0.6 / 1000).toFixed(0)}K` : variables.equity_60_formatted || '',
      
      broker_id: lead.brokers?.id || broker_id || '',
      broker_company: lead.brokers?.company_name || variables.broker_company || 'Equity Connect',
      broker_full_name: lead.brokers?.contact_name || variables.broker_full_name || 'your specialist',
      broker_nmls: lead.brokers?.nmls_number || variables.broker_nmls || '',
      broker_phone: lead.brokers?.phone || variables.broker_phone || '',
      broker_display: lead.brokers?.contact_name && lead.brokers?.nmls_number 
        ? `${lead.brokers.contact_name} (NMLS ${lead.brokers.nmls_number})` 
        : variables.broker_display || '',
      
      qualified: lead.qualified === true ? 'true' : (variables.qualified ? 'true' : 'false'),
      
      // Keep n8n campaign/persona data if provided
      campaign_archetype: variables.campaign_archetype || '',
      persona_assignment: variables.persona_assignment || '',
      persona_sender_name: variables.persona_sender_name || ''
    };
    
    // Select phone number from pool
    // If USE_TWILIO_FOR_OUTBOUND is set, only look for Twilio numbers
    if (!normalizedFromPhone) {
      if (process.env.USE_TWILIO_FOR_OUTBOUND === 'true') {
        console.log('🔍 USE_TWILIO_FOR_OUTBOUND=true, selecting Twilio number from pool');
        
        // Get Twilio numbers only (assigned_broker_company = 'Twilio Outbound')
        const { data: twilioNumbers } = await supabase
          .from('signalwire_phone_numbers')
          .select('number, elevenlabs_phone_number_id')
          .eq('assigned_broker_company', 'Twilio Outbound')
          .eq('status', 'active')
          .not('elevenlabs_phone_number_id', 'is', null)
          .limit(1);
        
        if (twilioNumbers && twilioNumbers.length > 0) {
          normalizedFromPhone = twilioNumbers[0].number;
          console.log(`✅ Using Twilio number: ${normalizedFromPhone}`);
        } else {
          normalizedFromPhone = '+13105964216';  // Your Twilio number as fallback
          console.log(`⚠️  No Twilio numbers in pool, using hardcoded: ${normalizedFromPhone}`);
        }
      } else if (broker_id) {
        console.log(`🔍 Looking up broker's assigned number (broker_id: ${broker_id})`);
        
        // Try to get broker's assigned numbers first
        const { data: brokerNumbers, error: brokerError } = await supabase
          .from('signalwire_phone_numbers')
          .select('number, elevenlabs_phone_number_id')
          .eq('assigned_broker_id', broker_id)
          .eq('status', 'active')
          .not('elevenlabs_phone_number_id', 'is', null)
          .limit(1);
        
        if (brokerNumbers && brokerNumbers.length > 0) {
          normalizedFromPhone = brokerNumbers[0].number;
          console.log(`✅ Using broker's number: ${normalizedFromPhone}`);
        } else {
          console.log('⚠️  No broker number found, checking Equity Connect pool...');
          
          // Fallback to Equity Connect pool
          const { data: defaultNumbers } = await supabase
            .from('signalwire_phone_numbers')
            .select('number, elevenlabs_phone_number_id')
            .eq('assigned_broker_company', 'Equity Connect')
            .eq('status', 'active')
            .not('elevenlabs_phone_number_id', 'is', null)
            .limit(1);
          
          if (defaultNumbers && defaultNumbers.length > 0) {
            normalizedFromPhone = defaultNumbers[0].number;
            console.log(`✅ Using Equity Connect number: ${normalizedFromPhone}`);
          } else {
            normalizedFromPhone = process.env.DEFAULT_FROM_NUMBER || '+14244851544';
            console.log(`⚠️  Using fallback number: ${normalizedFromPhone}`);
          }
        }
      } else {
        normalizedFromPhone = process.env.DEFAULT_FROM_NUMBER || '+14244851544';
        console.log(`✅ Using default number: ${normalizedFromPhone}`);
      }
    }
    
    // Look up ElevenLabs phone_number_id for the selected number
    const { data: numberData, error: numberError } = await supabase
      .from('signalwire_phone_numbers')
      .select('elevenlabs_phone_number_id')
      .eq('number', normalizedFromPhone)
      .eq('status', 'active')
      .single();
    
    let elevenlabsPhoneNumberId;
    if (numberError || !numberData || !numberData.elevenlabs_phone_number_id) {
      console.warn(`⚠️  No ElevenLabs phone_number_id found for ${normalizedFromPhone}, cannot make call`);
      return res.status(400).json({
        success: false,
        message: `Phone number ${normalizedFromPhone} is not registered in ElevenLabs. Please add it to the agent's SIP trunk configuration.`
      });
    } else {
      elevenlabsPhoneNumberId = numberData.elevenlabs_phone_number_id;
      console.log(`✅ Using ElevenLabs phone_number_id: ${elevenlabsPhoneNumberId}`);
    }
    
    // Determine call type based on database data
    const isQualified = lead.qualified === true;
    const callType = isQualified ? 'outbound-warm' : 'outbound-cold';
    
    console.log(`📋 Call type: ${callType} (qualified: ${lead.qualified})`);
    
    // Load prompt from Supabase (like personalization webhook does)
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('id, voice, vad_threshold, vad_prefix_padding_ms, vad_silence_duration_ms')
      .eq('call_type', callType)
      .eq('is_active', true)
      .single();
    
    if (promptError || !prompt) {
      console.error('❌ Prompt not found:', promptError);
      return res.status(500).json({
        success: false,
        message: `No prompt found for ${callType}`
      });
    }
    
    // Get the active version's content
    const { data: version, error: versionError } = await supabase
      .from('prompt_versions')
      .select('content')
      .eq('prompt_id', prompt.id)
      .eq('is_active', true)
      .single();
    
    if (versionError || !version) {
      console.error('❌ Active version not found:', versionError);
      return res.status(500).json({
        success: false,
        message: `No active version for ${callType}`
      });
    }
    
    console.log(`✅ Loaded prompt for: ${callType}`);
    
    // Assemble prompt from sections
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
    
    let assembledPrompt = sectionParts.join('\n\n').trim();
    
    // Replace {{variable}} placeholders in prompt (like inbound does)
    const promptVariables = {
      lead_first_name: enrichedVariables.lead_first_name,
      lead_last_name: enrichedVariables.lead_last_name,
      lead_email: enrichedVariables.lead_email,
      property_city: enrichedVariables.property_city,
      property_state: enrichedVariables.property_state,
      property_value_formatted: enrichedVariables.property_value_formatted,
      estimated_equity_formatted: enrichedVariables.estimated_equity_formatted,
      broker_name: enrichedVariables.broker_full_name,
      broker_id: enrichedVariables.broker_id,
      broker_company: enrichedVariables.broker_company,
      broker_nmls: enrichedVariables.broker_nmls,
      // Add any other variables used in your prompts
    };
    
    // Replace ALL {{variable}} placeholders
    Object.entries(promptVariables).forEach(([key, value]) => {
      assembledPrompt = assembledPrompt.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        String(value || '')
      );
    });
    
    // Build minimal dynamic variables (match inbound pattern + call_context for webhook)
    const dynamicVariables = {
      lead_id: lead_id,
      broker_id: enrichedVariables.broker_id,
      broker_name: enrichedVariables.broker_full_name,
      call_type: callType,
      call_context: 'outbound',  // For post-call webhook direction detection
      lead_first_name: enrichedVariables.lead_first_name,
      lead_email: enrichedVariables.lead_email,
      property_city: enrichedVariables.property_city
    };
    
    console.log('📋 Calling ElevenLabs with:', {
      agent_id: process.env.ELEVENLABS_AGENT_ID,
      phone_number_id: elevenlabsPhoneNumberId,
      to_number: normalizedToPhone,
      from_number: normalizedFromPhone,
      call_type: dynamicVariables.call_type
    });
    
    // Determine which API to use: Twilio (simpler) or SIP trunk
    const useTwilio = elevenlabsPhoneNumberId.startsWith('phnum_twilio_') || process.env.USE_TWILIO_FOR_OUTBOUND === 'true';
    const apiEndpoint = useTwilio 
      ? 'https://api.elevenlabs.io/v1/convai/twilio/outbound-call'
      : 'https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call';
    
    console.log(`📡 Using ${useTwilio ? 'Twilio' : 'SIP trunk'} API for outbound call`);
    
    // Call ElevenLabs outbound API (Twilio or SIP trunk)
    const elevenlabsResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: process.env.ELEVENLABS_AGENT_ID,
        agent_phone_number_id: elevenlabsPhoneNumberId,
        to_number: normalizedToPhone,
        conversation_initiation_client_data: {
          conversation_config_override: {
            tts: {
              speed: 0.85  // Slow down 15% for seniors (more comfortable pace)
            },
            agent: {
              prompt: {
                prompt: assembledPrompt  // Load prompt from Supabase portal!
              }
            }
          },
          dynamic_variables: dynamicVariables
        }
      })
    });
    
    const elevenlabsResult = await elevenlabsResponse.json();
    
    if (elevenlabsResult.success) {
      console.log('✅ Outbound call initiated:', elevenlabsResult);
      return res.json({
        success: true,
        message: 'Outbound call initiated successfully',
        conversation_id: elevenlabsResult.conversation_id,
        sip_call_id: elevenlabsResult.sip_call_id,
        from_number: normalizedFromPhone,
        to_number: normalizedToPhone,
        call_type: dynamicVariables.call_type
      });
    } else {
      console.error('❌ ElevenLabs outbound call failed:', JSON.stringify(elevenlabsResult, null, 2));
      return res.status(400).json({
        success: false,
        message: elevenlabsResult.detail?.message || elevenlabsResult.message || 'Call initiation failed',
        elevenlabs_error: elevenlabsResult  // Include full error for debugging
      });
    }
    
  } catch (err) {
    console.error('❌ Outbound call error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error'
    });
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

