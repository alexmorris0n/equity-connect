/**
 * Update agent webhook to use HTTPS hostname (DNS now resolves!)
 */

require('dotenv').config();
const axios = require('axios');

const AGENT_ID = 'agent_6601k9dg16nwf66snrmf9yb349h0';  // New agent with IP tools
const WEBHOOK_URL = 'https://barbara-elevenlabs-webhook.fly.dev/personalize';

async function updateToHTTPS() {
  try {
    console.log('🔄 Updating webhook to HTTPS hostname...\n');
    
    await axios.patch(
      `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`,
      {
        platform_settings: {
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
    
    console.log('✅ Webhook updated to:', WEBHOOK_URL);
    console.log('\n📞 Call (310) 596-4216 now!\n');
    
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
  }
}

updateToHTTPS();

