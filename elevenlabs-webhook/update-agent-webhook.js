/**
 * Update Barbara agent to enable webhook personalization
 */

require('dotenv').config();
const axios = require('axios');

const AGENT_ID = 'agent_4101k9d99r1vfg3vtnbbc8gkdy99';
const WEBHOOK_URL = 'https://barbara-elevenlabs-webhook.fly.dev/personalize';

async function updateAgent() {
  console.log('🔄 Updating agent to enable webhook personalization...\n');
  
  try {
    const response = await axios.patch(
      `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`,
      {
        platform_settings: {
          overrides: {
            enable_conversation_initiation_client_data_from_webhook: true
          },
          workspace_overrides: {
            conversation_initiation_client_data_webhook: {
              url: WEBHOOK_URL,
              request_headers: {
                "Content-Type": "application/json"
              }
            }
          }
        }
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Agent updated successfully!');
    console.log('Webhook URL:', WEBHOOK_URL);
    console.log('\nTry calling again: +1 415 322 5030');
    console.log('This time the webhook should be called!\n');
    
  } catch (err) {
    console.error('❌ Update error:', err.response?.data || err.message);
  }
}

updateAgent();

