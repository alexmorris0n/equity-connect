/**
 * Create Barbara Agent with IP addresses (not hostname)
 * Use this when DNS isn't resolving
 */

require('dotenv').config();
const axios = require('axios');

async function createBarbaraAgentWithIP() {
  console.log('🚀 Creating Barbara agent with IP addresses...\n');
  
  const WEBHOOK_BASE = 'https://barbara-elevenlabs-webhook.fly.dev';
  
  const agentConfig = {
    name: 'Barbara - Equity Connect (Final)',
    conversation_config: {
      agent: {
        first_message: "Hi! This is Barbara with Equity Connect. How can I help you today?",
        language: "en",
        prompt: {
          prompt: `You are Barbara, a warm and professional coordinator for Equity Connect.

Your role: Pre-qualify homeowners interested in reverse mortgages, answer their questions, and book appointments with licensed specialists.

Keep responses brief (1-2 sentences). Ask one question at a time.

You have access to these dynamic variables (set per call via webhook):
- {{broker_id}} - Use this when calling check_availability or book_appointment tools
- {{lead_id}} - Current lead's ID
- {{broker_name}} - Broker's name to mention to the lead

This default prompt will be replaced with a personalized prompt from Supabase on each call via webhook.`,
          
          llm: "gpt-4o",
          temperature: 0.8,
          max_tokens: 150,
          
          // Define tools with IP addresses
          tools: [
            {
              type: "webhook",
              name: "lookup_lead",
              description: "Look up lead information by phone number to personalize the conversation",
              api_schema: {
                url: `${WEBHOOK_BASE}/tools/lookup_lead`,
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
                url: `${WEBHOOK_BASE}/tools/search_knowledge`,
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
              description: "Check broker's calendar availability. Use the {{broker_id}} dynamic variable for the broker_id parameter.",
              api_schema: {
                url: `${WEBHOOK_BASE}/tools/check_availability`,
                method: "POST",
                request_body_schema: {
                  type: "object",
                  properties: {
                    broker_id: {
                      type: "string",
                      dynamic_variable: "broker_id"
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
              description: "Book an appointment after checking availability. Use {{broker_id}} and {{lead_id}} dynamic variables.",
              api_schema: {
                url: `${WEBHOOK_BASE}/tools/book_appointment`,
                method: "POST",
                request_body_schema: {
                  type: "object",
                  properties: {
                    broker_id: {
                      type: "string",
                      dynamic_variable: "broker_id"
                    },
                    lead_id: {
                      type: "string",
                      dynamic_variable: "lead_id"
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
              description: "Update lead information. Use {{lead_id}} dynamic variable.",
              api_schema: {
                url: `${WEBHOOK_BASE}/tools/update_lead`,
                method: "POST",
                request_body_schema: {
                  type: "object",
                  properties: {
                    lead_id: {
                      type: "string",
                      dynamic_variable: "lead_id"
                    },
                    updates: {
                      type: "object",
                      description: "Fields to update (e.g. {\"last_name\": \"Smith\", \"age\": 65})"
                    }
                  },
                  required: ["lead_id", "updates"]
                }
              }
            }
          ]
        }
      },
      
      // TTS Configuration
      tts: {
        model_id: "eleven_flash_v2",
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
      
      // Turn-taking
      turn: {
        turn_timeout: 10,
        silence_end_call_timeout: 60,
        turn_eagerness: "normal"
      },
      
      // Conversation settings
      conversation: {
        max_duration_seconds: 900
      }
    },
    
    // Platform settings
    platform_settings: {
      overrides: {
        enable_conversation_initiation_client_data_from_webhook: true
      },
      workspace_overrides: {
        conversation_initiation_client_data_webhook: {
          url: `${WEBHOOK_BASE}/personalize`,
          request_headers: {
            "Content-Type": "application/json"
          }
        }
      },
      privacy: {
        record_voice: true,
        retention_days: 30
      }
    }
  };
  
  try {
    console.log('📡 Creating agent with IP-based URLs...');
    console.log(`🌐 Webhook: ${WEBHOOK_BASE}/personalize`);
    console.log(`🔧 Tools: ${WEBHOOK_BASE}/tools/*\n`);
    
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
    console.log('✅ NEW AGENT CREATED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Agent ID: ${agentId}`);
    console.log(`Agent Name: Barbara - Equity Connect (IP)`);
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Go to ElevenLabs dashboard');
    console.log('2. Unassign old agent from (310) 596-4216');
    console.log('3. Assign THIS agent to (310) 596-4216');
    console.log('4. Call (310) 596-4216 to test!');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return agentId;
    
  } catch (err) {
    console.error('\n❌ ERROR:');
    console.error('Status:', err.response?.status);
    console.error('Message:', err.response?.data || err.message);
    process.exit(1);
  }
}

createBarbaraAgentWithIP()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

