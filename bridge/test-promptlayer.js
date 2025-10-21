/**
 * Test PromptLayer Integration
 * 
 * Run this to verify PromptLayer is configured correctly
 * Usage: node bridge/test-promptlayer.js
 */

require('dotenv').config();
const { initPromptLayer } = require('./promptlayer-integration');

async function testPromptLayer() {
  console.log('\n🧪 Testing PromptLayer Integration\n');
  
  // Check if API key is set
  const apiKey = process.env.PROMPTLAYER_API_KEY;
  
  if (!apiKey) {
    console.error('❌ PROMPTLAYER_API_KEY not set in environment variables');
    console.log('   Set it in your .env file or Northflank environment');
    process.exit(1);
  }
  
  if (apiKey.startsWith('pl_your_api_key')) {
    console.error('❌ PROMPTLAYER_API_KEY is still the placeholder value');
    console.log('   Replace with your actual key from promptlayer.com');
    process.exit(1);
  }
  
  console.log('✅ API key found:', apiKey.substring(0, 10) + '...');
  
  // Initialize PromptLayer
  const promptLayer = initPromptLayer(apiKey);
  
  if (!promptLayer.enabled) {
    console.error('❌ PromptLayer failed to initialize');
    process.exit(1);
  }
  
  console.log('✅ PromptLayer initialized successfully\n');
  
  // Test logging a fake conversation
  console.log('📝 Sending test conversation to PromptLayer...\n');
  
  try {
    const testCallId = await promptLayer.logRealtimeConversation({
      callId: 'test-' + Date.now(),
      leadId: 'test-lead-123',
      brokerId: 'test-broker-456',
      leadName: 'Test Lead',
      brokerName: 'Test Broker',
      conversationTranscript: [
        {
          role: 'assistant',
          text: 'Hi! This is a test call from Barbara.',
          timestamp: new Date().toISOString()
        },
        {
          role: 'user',
          text: 'Yes, I got your letter about my home equity.',
          timestamp: new Date().toISOString()
        },
        {
          role: 'assistant',
          text: 'Great! I wanted to see if you had any questions about accessing your equity.',
          timestamp: new Date().toISOString()
        }
      ],
      metadata: {
        money_purpose: 'test',
        timeline: 'test',
        test_mode: true
      },
      outcome: 'test_successful',
      durationSeconds: 45,
      toolCalls: []
    });
    
    if (testCallId) {
      console.log('✅ SUCCESS! Test conversation logged to PromptLayer');
      console.log('   Request ID:', testCallId);
      console.log('\n📊 Next Steps:');
      console.log('   1. Go to: https://promptlayer.com/dashboard');
      console.log('   2. Click "Requests" in the sidebar');
      console.log('   3. Look for request with outcome "test_successful"');
      console.log('   4. You should see the test conversation above\n');
      
      console.log('✅ PromptLayer integration is working correctly!');
      console.log('   All Barbara calls will now be automatically logged.\n');
    } else {
      console.error('⚠️  No request ID returned (logging may have failed)');
    }
    
  } catch (error) {
    console.error('❌ Failed to log test conversation:', error.message);
    console.log('\nPossible issues:');
    console.log('   - Invalid API key');
    console.log('   - Network connectivity issue');
    console.log('   - PromptLayer API is down');
    process.exit(1);
  }
}

// Run test
testPromptLayer().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

