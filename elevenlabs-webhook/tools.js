/**
 * ElevenLabs Tool Endpoints
 * 
 * Wraps your existing business logic as HTTP endpoints that ElevenLabs can call.
 * Reuses logic from Barbara V3's tools.js and bridge code.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const app = express();
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Tool 1: Lookup Lead
 * Reuses Barbara V3 get_lead_context logic
 */
app.post('/tools/lookup_lead', async (req, res) => {
  try {
    const { phone_number } = req.body;
    
    console.log('🔍 Looking up lead:', phone_number);
    
    const { data: leads, error } = await supabase
      .from('leads')
      .select(`
        id, first_name, last_name, primary_email, primary_phone,
        property_city, property_state, property_value,
        estimated_equity, mortgage_balance, age, status,
        brokers (
          id, first_name, last_name, company_name, phone, nmls_number
        )
      `)
      .or(`primary_phone.eq.${phone_number},primary_phone_e164.eq.${phone_number}`)
      .limit(1);
    
    if (error) throw error;
    
    const lead = leads?.[0];
    
    if (lead) {
      console.log('✅ Lead found:', lead.first_name, lead.last_name);
      res.json({
        found: true,
        lead_id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.primary_email,
        property_city: lead.property_city,
        estimated_equity: lead.estimated_equity,
        broker_name: lead.brokers ? `${lead.brokers.first_name} ${lead.brokers.last_name}` : 'your specialist',
        broker_company: lead.brokers?.company_name || 'Equity Connect'
      });
    } else {
      console.log('❌ No lead found for:', phone_number);
      res.json({ found: false });
    }
  } catch (err) {
    console.error('❌ Lookup error:', err);
    res.status(500).json({ error: err.message, found: false });
  }
});

/**
 * Tool 2: Search Knowledge Base
 * TODO: Integrate with your existing Vertex AI search
 * For now, returns placeholder
 */
app.post('/tools/search_knowledge', async (req, res) => {
  try {
    const { question } = req.body;
    
    console.log('📚 KB search:', question);
    
    // TODO: Call your existing Vertex AI knowledge base search
    // const { searchKnowledgeBase } = require('../bridge/vertex-search');
    // const results = await searchKnowledgeBase(question);
    
    // Placeholder response
    const answer = "I can help with that! However, for the most accurate information about reverse mortgages, I'd recommend having your specialist call you back. Would you like me to schedule that?";
    
    console.log('✅ KB search complete');
    res.json({ answer });
    
  } catch (err) {
    console.error('❌ KB search error:', err);
    res.status(500).json({ 
      error: err.message,
      answer: "I don't have that specific information. Would you like me to have your specialist call you back?"
    });
  }
});

/**
 * Tool 3: Check Broker Availability
 * Calls Nylas API to get available time slots
 */
app.post('/tools/check_availability', async (req, res) => {
  try {
    const { broker_id, days_ahead = 7 } = req.body;
    
    console.log('📅 Checking availability for broker:', broker_id);
    
    // Get broker's Nylas grant_id from database
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('nylas_grant_id, contact_name, email')
      .eq('id', broker_id)
      .single();
    
    if (brokerError || !broker || !broker.nylas_grant_id) {
      console.error('❌ Broker not found or no Nylas connection:', brokerError);
      return res.json({
        available: false,
        slots: [],
        message: "I'm having trouble checking the calendar. Let me have your specialist call you back to find a time."
      });
    }
    
    const response = await axios.get(
      `https://api.nylas.com/grants/${broker.nylas_grant_id}/availability`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.NYLAS_API_KEY}`,
          'Content-Type': 'application/json'
        },
        params: {
          duration: 30,  // 30-minute slots
          interval: 30,  // Check every 30 minutes
          start_time: Math.floor(Date.now() / 1000),
          end_time: Math.floor((Date.now() + (days_ahead * 24 * 60 * 60 * 1000)) / 1000)
        }
      }
    );
    
    const slots = response.data.slice(0, 5); // Top 5 slots
    
    console.log(`✅ Found ${slots.length} available slots for ${broker.contact_name}`);
    
    res.json({
      available: slots.length > 0,
      broker_name: broker.contact_name,
      slots: slots.map(slot => ({
        start_time: slot.start_time,
        end_time: slot.end_time,
        formatted_time: new Date(slot.start_time * 1000).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short'
        })
      })),
      message: slots.length > 0 
        ? `${broker.contact_name} has ${slots.length} available times in the next ${days_ahead} days.`
        : `I don't see any availability for ${broker.contact_name} in the next ${days_ahead} days.`
    });
    
  } catch (err) {
    console.error('❌ Availability check error:', err);
    res.status(500).json({ 
      error: err.message,
      available: false,
      slots: [],
      message: "I'm having trouble checking the calendar right now. Let me have your specialist call you back."
    });
  }
});

/**
 * Tool 4: Book Appointment
 * Creates event in Nylas calendar
 */
app.post('/tools/book_appointment', async (req, res) => {
  try {
    const { broker_id, start_time, lead_email, lead_name, lead_id } = req.body;
    
    console.log('📅 Booking appointment:', {
      broker_id,
      start_time,
      lead_email
    });
    
    // Get broker's Nylas grant_id from database
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('nylas_grant_id, contact_name, email, timezone')
      .eq('id', broker_id)
      .single();
    
    if (brokerError || !broker || !broker.nylas_grant_id) {
      console.error('❌ Broker not found or no Nylas connection:', brokerError);
      return res.json({
        success: false,
        message: "I'm having trouble accessing the calendar. Let me have your specialist call you back to schedule."
      });
    }
    
    // Create Nylas event
    const response = await axios.post(
      `https://api.nylas.com/grants/${broker.nylas_grant_id}/events`,
      {
        title: 'Reverse Mortgage Consultation',
        description: `Initial consultation with ${broker.contact_name} booked via Barbara AI`,
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
        ],
        conferencing: {
          provider: 'Custom',
          details: {
            meeting_code: '',
            url: '',
            phone: []
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.NYLAS_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const event = response.data;
    
    console.log('✅ Appointment booked! Event ID:', event.id);
    
    // Log to interactions table
    if (lead_id) {
      await supabase.from('interactions').insert({
        lead_id,
        type: 'appointment_booked',
        direction: 'inbound',
        content: `Appointment booked with ${broker.contact_name}`,
        metadata: {
          broker_id,
          nylas_event_id: event.id,
          start_time,
          booked_via: 'elevenlabs_agent'
        }
      });
    }
    
    res.json({
      success: true,
      event_id: event.id,
      broker_name: broker.contact_name,
      start_time: start_time,
      message: `Perfect! I've scheduled your consultation with ${broker.contact_name} for ${new Date(start_time).toLocaleString()}. You'll receive a calendar invite at ${lead_email}.`
    });
    
  } catch (err) {
    console.error('❌ Booking error:', err);
    res.status(500).json({ 
      error: err.message,
      success: false,
      message: "I'm having trouble booking that time. Let me have your specialist call you back to find a time that works."
    });
  }
});

/**
 * Tool 5: Update Lead Info
 * Updates lead information in database
 */
app.post('/tools/update_lead', async (req, res) => {
  try {
    const { lead_id, updates } = req.body;
    
    console.log('📝 Updating lead:', lead_id, updates);
    
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', lead_id)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('✅ Lead updated');
    res.json({ success: true, updated: data });
    
  } catch (err) {
    console.error('❌ Update error:', err);
    res.status(500).json({ error: err.message, success: false });
  }
});

/**
 * Post-Call Webhook
 * Called by ElevenLabs after each call ends
 * Logs conversation to interactions table
 */
app.post('/post-call', async (req, res) => {
  try {
    // Verify HMAC signature
    const signature = req.headers['elevenlabs-signature'];
    const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    
    if (secret && signature) {
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(JSON.stringify(req.body));
      const expectedSignature = hmac.digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('❌ Invalid signature on post-call webhook');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      console.log('✅ Signature verified');
    }
    
    const { 
      conversation_id,
      agent_id,
      call_duration_secs,
      transcript,
      metadata 
    } = req.body;
    
    console.log('📞 Post-call webhook received:', {
      conversation_id,
      duration: call_duration_secs,
      has_transcript: !!transcript
    });
    
    // Extract lead_id and broker_id from metadata if available
    const leadId = metadata?.lead_id || metadata?.dynamic_variables?.lead_id;
    const brokerId = metadata?.broker_id || metadata?.dynamic_variables?.broker_id;
    
    if (!leadId || leadId === 'unknown') {
      console.log('⚠️ No lead_id in post-call, skipping interaction save');
      return res.json({ status: 'ok', message: 'No lead to log' });
    }
    
    // Build transcript text from conversation
    let transcriptText = '';
    if (transcript && Array.isArray(transcript)) {
      transcriptText = transcript
        .map(t => `${t.role}: ${t.message}`)
        .join('\n');
    }
    
    // Save to interactions table
    const { data, error } = await supabase
      .from('interactions')
      .insert({
        lead_id: leadId,
        type: 'voice_call',
        direction: 'inbound',
        content: `Call completed - ${call_duration_secs}s`,
        metadata: {
          conversation_id,
          agent_id,
          duration_secs: call_duration_secs,
          transcript: transcriptText,
          broker_id: brokerId,
          platform: 'elevenlabs',
          call_outcome: 'completed'
        }
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Failed to save interaction:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('✅ Interaction saved:', data.id);
    res.json({ status: 'ok', interaction_id: data.id });
    
  } catch (err) {
    console.error('❌ Post-call error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'elevenlabs-tools' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔧 ElevenLabs Tool Endpoints listening on port ${PORT}`);
  console.log(`📍 Endpoints:`);
  console.log(`   POST /tools/lookup_lead`);
  console.log(`   POST /tools/search_knowledge`);
  console.log(`   POST /tools/check_availability`);
  console.log(`   POST /tools/book_appointment`);
  console.log(`   POST /tools/update_lead`);
  console.log(`   GET /health`);
});

