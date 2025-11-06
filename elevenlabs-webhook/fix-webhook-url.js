/**
 * Update agent webhook URL to use IP address
 * Since DNS isn't resolving, use direct IP
 */

require('dotenv').config();
const axios = require('axios');

const AGENT_ID = 'agent_4101k9d99r1vfg3vtnbbc8gkdy99';

async function fixWebhookURL() {
  try {
    console.log('🔄 Updating webhook URL to use IP address...\n');
    
    // Use HTTP (not HTTPS) with IP since we don't have SSL cert for IP
    const webhookURL = 'http://66.241.124.17/personalize';
    
    const response = await axios.patch(
      `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`,
      {
        platform_settings: {
          workspace_overrides: {
            conversation_initiation_client_data_webhook: {
              url: webhookURL,
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
    
    console.log('✅ Webhook URL updated to:', webhookURL);
    console.log('\n📞 Now call (310) 596-4216 again!');
    console.log('This time the webhook should be reachable.\n');
    
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
  }
}

fixWebhookURL();

