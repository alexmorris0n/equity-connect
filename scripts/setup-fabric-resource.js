/**
 * SignalWire Fabric Resource Setup Script
 * 
 * Automates the creation and configuration of Fabric Resources for Barbara.
 * Run this after deploying your bridge to configure SignalWire properly.
 * 
 * Usage:
 *   node scripts/setup-fabric-resource.js
 * 
 * What it does:
 * 1. Creates a Fabric Resource with AI Agent configuration
 * 2. Points the AI to use OpenAI Realtime (external)
 * 3. Configures SWAIG endpoint for tool calls
 * 4. Optionally links phone numbers to the resource
 */

require('dotenv').config();
const fetch = require('node-fetch');

// Configuration
const SW_PROJECT = process.env.SW_PROJECT;
const SW_TOKEN = process.env.SW_TOKEN;
const SW_SPACE = process.env.SW_SPACE;
const BRIDGE_URL = process.env.BRIDGE_URL; // e.g., https://your-bridge.northflank.dev
const SWAIG_PORT = process.env.SWAIG_PORT || 8081;

if (!SW_PROJECT || !SW_TOKEN || !SW_SPACE) {
  console.error('❌ Missing SignalWire credentials (SW_PROJECT, SW_TOKEN, SW_SPACE)');
  process.exit(1);
}

if (!BRIDGE_URL) {
  console.error('❌ Missing BRIDGE_URL environment variable');
  console.error('   Set this to your deployed bridge URL (e.g., https://barbara-bridge.northflank.dev)');
  process.exit(1);
}

const auth = Buffer.from(`${SW_PROJECT}:${SW_TOKEN}`).toString('base64');
const baseUrl = `https://${SW_SPACE}/api/fabric/resources`;

/**
 * Create Fabric Resource
 */
async function createFabricResource() {
  console.log('\n🔧 Creating Fabric Resource...\n');

  const swaigUrl = `${BRIDGE_URL}/swaig`;
  
  const resourceConfig = {
    name: 'Barbara AI Assistant',
    type: 'ai_agent',
    configuration: {
      ai: {
        provider: 'openai_realtime',
        model: process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-12-17',
        voice: process.env.REALTIME_VOICE || 'shimmer',
        temperature: 0.95,
        // Note: Instructions are set dynamically by the bridge based on call context
        // The bridge will inject PromptLayer templates at runtime
        instructions: 'You are Barbara, a warm AI assistant for reverse mortgage consultations.',
        swaig: {
          defaults: {
            web_hook_url: swaigUrl,
            web_hook_auth_user: process.env.SWAIG_AUTH_USER || '',
            web_hook_auth_password: process.env.SWAIG_AUTH_PASSWORD || ''
          }
        }
      },
      // Audio configuration
      audio: {
        input_format: 'pcm16',
        output_format: 'pcm16',
        sample_rate: 24000
      },
      // Recording (optional)
      recording: {
        enabled: true,
        format: 'mp3'
      }
    }
  };

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resourceConfig)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SignalWire API error: ${response.status} - ${errorText}`);
    }

    const resource = await response.json();
    
    console.log('✅ Fabric Resource created successfully!\n');
    console.log('📋 Resource Details:');
    console.log(`   ID: ${resource.id}`);
    console.log(`   Name: ${resource.name}`);
    console.log(`   Type: ${resource.type}`);
    console.log(`   SWAIG URL: ${swaigUrl}\n`);
    console.log('💾 Save this Resource ID to your .env file:');
    console.log(`   FABRIC_RESOURCE_ID=${resource.id}\n`);

    return resource;

  } catch (err) {
    console.error('❌ Failed to create Fabric Resource:', err.message);
    throw err;
  }
}

/**
 * List existing Fabric Resources
 */
async function listFabricResources() {
  console.log('\n📋 Listing existing Fabric Resources...\n');

  try {
    const response = await fetch(baseUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SignalWire API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const resources = data.data || [];

    if (resources.length === 0) {
      console.log('   No Fabric Resources found.\n');
      return [];
    }

    console.log(`   Found ${resources.length} resource(s):\n`);
    resources.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.name} (${r.id})`);
      console.log(`      Type: ${r.type}`);
      console.log(`      Created: ${r.created_at}\n`);
    });

    return resources;

  } catch (err) {
    console.error('❌ Failed to list Fabric Resources:', err.message);
    throw err;
  }
}

/**
 * Link phone number to Fabric Resource
 */
async function linkPhoneNumber(resourceId, phoneNumber) {
  console.log(`\n📞 Linking phone number ${phoneNumber} to resource ${resourceId}...\n`);

  // Note: This is a placeholder - actual API endpoint may vary
  // You may need to update phone number configuration via SignalWire dashboard
  
  console.log('⚠️  Phone number linking must be done via SignalWire dashboard:');
  console.log('   1. Go to https://your-space.signalwire.com/phone_numbers');
  console.log('   2. Edit your phone number');
  console.log(`   3. Set "When a call comes in" to Fabric Resource: ${resourceId}\n`);
}

/**
 * Test SWAIG endpoint
 */
async function testSwaigEndpoint() {
  console.log('\n🧪 Testing SWAIG endpoint...\n');

  // Northflank exposes port 8081 on p02 subdomain
  let swaigUrl = `${BRIDGE_URL}/swaig`;
  
  // If using p01 subdomain, try p02 for port 8081
  if (BRIDGE_URL.includes('p01--')) {
    swaigUrl = BRIDGE_URL.replace('p01--', 'p02--') + '/swaig';
    console.log('📍 Detected Northflank p01 subdomain, using p02 for port 8081');
  }

  try {
    const response = await fetch(swaigUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`SWAIG endpoint returned ${response.status}`);
    }

    const functions = await response.json();
    
    console.log('✅ SWAIG endpoint is accessible!\n');
    console.log(`📋 Available functions: ${functions.length}\n`);
    functions.forEach((f, i) => {
      console.log(`   ${i + 1}. ${f.function} - ${f.purpose.substring(0, 60)}...`);
    });
    console.log();

    return swaigUrl; // Return the working URL

  } catch (err) {
    console.error('❌ Failed to reach SWAIG endpoint:', err.message);
    console.error('   Make sure your bridge is deployed and accessible at:', swaigUrl);
    return false;
  }
}

/**
 * Main setup flow
 */
async function main() {
  console.log('\n🚀 SignalWire Fabric Resource Setup\n');
  console.log('📋 Configuration:');
  console.log(`   SignalWire Space: ${SW_SPACE}`);
  console.log(`   Bridge URL: ${BRIDGE_URL}`);
  console.log(`   SWAIG Port: ${SWAIG_PORT}\n`);

  try {
    // Step 1: Test SWAIG endpoint
    const swaigUrl = await testSwaigEndpoint();
    if (!swaigUrl) {
      console.error('\n❌ Cannot proceed - SWAIG endpoint is not accessible');
      console.error('   Deploy your bridge first, then run this script again.\n');
      process.exit(1);
    }

    // Step 2: List existing resources
    const existingResources = await listFabricResources();
    
    const barbaraExists = existingResources.find(r => r.name && r.name.includes('Barbara'));
    if (barbaraExists) {
      console.log('⚠️  A Barbara resource already exists:', barbaraExists.id);
      console.log('   Do you want to create another one? (Ctrl+C to cancel)\n');
      // Give user 5 seconds to cancel
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Step 3: Create new resource with the working SWAIG URL
    const resource = await createFabricResource(swaigUrl);

    // Step 4: Instructions for phone number linking
    console.log('📞 Next Steps:');
    console.log('   1. Add FABRIC_RESOURCE_ID to your .env file');
    console.log('   2. Link your phone numbers to this resource in SignalWire dashboard');
    console.log('   3. Test a call!\n');
    console.log('✅ Setup complete!\n');

  } catch (err) {
    console.error('\n❌ Setup failed:', err.message);
    process.exit(1);
  }
}

// Run setup
main();

