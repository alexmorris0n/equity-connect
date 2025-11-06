/**
 * Create Barbara Agent via ElevenLabs API
 * 
 * Run once to create the agent, then save the returned agent_id
 */

require('dotenv').config();
const axios = require('axios');

async function createBarbaraAgent() {
  console.log('🚀 Creating Barbara agent via ElevenLabs API...\n');
  
  const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://barbara-elevenlabs-webhook.fly.dev';
  
  const agentConfig = {
    name: 'Barbara - Equity Connect',
    conversation_config: {
      agent: {
        first_message: "Hi! This is Barbara with Equity Connect. How can I help you today?",
        language: "en",
        prompt: {
          // This is the default prompt - it gets overridden by webhook on each call
          prompt: `You are Barbara, a warm and professional coordinator for Equity Connect.

Your role: Pre-qualify homeowners interested in reverse mortgages, answer their questions, and book appointments with licensed specialists.

Keep responses brief (1-2 sentences). Ask one question at a time.

This default prompt will be replaced with a personalized prompt from Supabase on each call via webhook.`,
          
          llm: "gpt-4o",
          temperature: 0.8,
          max_tokens: 150,
          
          // Define tools (webhook endpoints you created)
          tools: [
            {
              type: "webhook",
              name: "lookup_lead",
              description: "Look up lead information by phone number to personalize the conversation",
              api_schema: {
                url: `${WEBHOOK_BASE_URL}/tools/lookup_lead`,
                method: "POST",
                request_body_schema: {
                  type: "object",
                  properties: {
                    phone_number: {
                      type: "string",
                      description: "Caller's phone number"
                    }
                  },
                  required: ["phone_number"]
                }
              }
            },
            {
              type: "webhook",
              name: "search_knowledge",
              description: "Search the reverse mortgage knowledge base for answers to questions",
              api_schema: {
                url: `${WEBHOOK_BASE_URL}/tools/search_knowledge`,
                method: "POST",
                request_body_schema: {
                  type: "object",
                  properties: {
                    question: {
                      type: "string",
                      description: "User's question about reverse mortgages"
                    }
                  },
                  required: ["question"]
                }
              }
            },
            {
              type: "webhook",
              name: "check_availability",
              description: "Check broker's calendar availability for appointment scheduling",
              api_schema: {
                url: `${WEBHOOK_BASE_URL}/tools/check_availability`,
                method: "POST",
                request_body_schema: {
                  type: "object",
                  properties: {
                    broker_id: {
                      type: "string",
                      description: "Broker's ID"
                    },
                    days_ahead: {
                      type: "integer",
                      description: "How many days to check ahead (default: 7)"
                    }
                  },
                  required: ["broker_id"]
                }
              }
            },
            {
              type: "webhook",
              name: "book_appointment",
              description: "Book an appointment with the broker after checking availability",
              api_schema: {
                url: `${WEBHOOK_BASE_URL}/tools/book_appointment`,
                method: "POST",
                request_body_schema: {
                  type: "object",
                  properties: {
                    broker_id: {
                      type: "string",
                      description: "Broker's ID"
                    },
                    start_time: {
                      type: "string",
                      description: "Appointment start time (ISO 8601 format)"
                    },
                    lead_email: {
                      type: "string",
                      description: "Lead's email for calendar invite"
                    },
                    lead_name: {
                      type: "string",
                      description: "Lead's full name"
                    }
                  },
                  required: ["broker_id", "start_time", "lead_email", "lead_name"]
                }
              }
            },
            {
              type: "webhook",
              name: "update_lead_info",
              description: "Update lead information collected during the call",
              api_schema: {
                url: `${WEBHOOK_BASE_URL}/tools/update_lead`,
                method: "POST",
                request_body_schema: {
                  type: "object",
                  properties: {
                    lead_id: {
                      type: "string",
                      description: "Lead's ID"
                    },
                    updates: {
                      type: "object",
                      description: "Fields to update (last_name, age, property_value, etc.)"
                    }
                  },
                  required: ["lead_id", "updates"]
                }
              }
            }
          ]
        }
      },
      
      // TTS Configuration (ElevenLabs voice settings)
      tts: {
        // Using default conversational voice - you can change later in dashboard
        // To use specific voice: Get voice_id from https://elevenlabs.io/app/voice-library
        model_id: "eleven_flash_v2",  // Use flash v2 for English agents
        stability: 0.5,
        similarity_boost: 0.75,
        optimize_streaming_latency: 3,
        agent_output_audio_format: "pcm_16000"
      },
      
      // ASR Configuration
      asr: {
        quality: "high",
        provider: "elevenlabs",
        user_input_audio_format: "pcm_16000"
      },
      
      // Turn-taking configuration
      turn: {
        turn_timeout: 10,  // seconds
        silence_end_call_timeout: 60,  // seconds
        turn_eagerness: "normal"
      },
      
      // Conversation settings
      conversation: {
        max_duration_seconds: 900  // 15 minutes
      }
    },
    
    // Platform settings
    platform_settings: {
      // Enable webhook personalization
      overrides: {
        enable_conversation_initiation_client_data_from_webhook: true
      },
      
      // Webhook configuration
      workspace_overrides: {
        conversation_initiation_client_data_webhook: {
          url: `${WEBHOOK_BASE_URL}/personalize`,
          request_headers: {
            "Authorization": `Bearer ${process.env.WEBHOOK_SECRET || 'webhook-secret-changeme'}`
          }
        }
      },
      
      // Privacy settings
      privacy: {
        record_voice: true,
        retention_days: 30,
        delete_transcript_and_pii: false,
        delete_audio: false
      }
    }
  };
  
  try {
    console.log('📡 Calling ElevenLabs Create Agent API...');
    console.log(`🌐 Webhook URL: ${WEBHOOK_BASE_URL}/personalize`);
    console.log(`🔧 Tools URL: ${WEBHOOK_BASE_URL}/tools/*\n`);
    
    const response = await axios.post(
      'https://api.elevenlabs.io/v1/convai/agents/create',
      agentConfig,
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const agentId = response.data.agent_id;
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ AGENT CREATED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Agent ID: ${agentId}`);
    console.log(`Agent Name: ${agentConfig.name}`);
    console.log(`\n📋 SAVE THIS AGENT ID!`);
    console.log(`   You'll need it to configure SIP trunk and test calls.\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📌 Next Steps:');
    console.log('1. Save the agent_id above');
    console.log('2. Deploy webhook to Fly.io');
    console.log('3. Update WEBHOOK_BASE_URL to production URL');
    console.log('4. Update agent with production webhook URL (or recreate)');
    console.log('5. Configure SIP trunk in ElevenLabs dashboard');
    console.log('6. Point SignalWire to ElevenLabs SIP');
    console.log('7. Test call!\n');
    
    return agentId;
    
  } catch (err) {
    console.error('\n❌ ERROR Creating Agent:');
    console.error('Status:', err.response?.status);
    console.error('Message:', err.response?.data || err.message);
    console.error('\nFull error:', JSON.stringify(err.response?.data, null, 2));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createBarbaraAgent()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { createBarbaraAgent };

