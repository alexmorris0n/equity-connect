/**
 * Update webhook URL to use IP address instead of hostname
 * Use this if DNS isn't resolving
 */

require('dotenv').config();
const axios = require('axios');

const AGENT_ID = 'agent_4101k9d99r1vfg3vtnbbc8gkdy99';
const WEBHOOK_IP = 'http://66.241.124.17:80/personalize';

async function updateToIP() {
  console.log('🔄 Updating webhook to use IP address...\n');
  
  try {
    await axios.patch(
      `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`,
      {
        platform_settings: {
          workspace_overrides: {
            conversation_initiation_client_data_webhook: {
              url: WEBHOOK_IP,
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
    
    console.log('✅ Webhook URL updated to:', WEBHOOK_IP);
    console.log('\nTry calling (310) 596-4216 again!\n');
    
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
  }
}

updateToIP();

