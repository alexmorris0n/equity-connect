/**
 * Test Script for Smart Prompt Manager
 * 
 * Tests:
 * 1. Prompt selection logic
 * 2. PromptLayer fetching
 * 3. Fallback to local file
 * 4. Variable injection
 * 5. Caching
 */

require('dotenv').config();
const { getPromptForCall, injectVariables, determinePromptName, clearCache } = require('./prompt-manager');

async function testPromptSelection() {
  console.log('\n🧪 Test 1: Prompt Selection Logic\n');
  
  const scenarios = [
    {
      name: 'Inbound Qualified',
      context: { context: 'inbound', lead_id: 'abc123', has_property_data: true },
      expected: 'barbara-inbound-qualified'
    },
    {
      name: 'Inbound Unqualified',
      context: { context: 'inbound', lead_id: null, has_property_data: false },
      expected: 'barbara-inbound-unqualified'
    },
    {
      name: 'Outbound Warm',
      context: { context: 'outbound', lead_id: 'xyz789', has_property_data: true },
      expected: 'barbara-outbound-warm'
    },
    {
      name: 'Outbound Cold',
      context: { context: 'outbound', lead_id: 'xyz789', has_property_data: false },
      expected: 'barbara-outbound-cold'
    }
  ];
  
  for (const scenario of scenarios) {
    const selected = determinePromptName(scenario.context);
    const passed = selected === scenario.expected;
    console.log(`${passed ? '✅' : '❌'} ${scenario.name}: ${selected} ${passed ? '' : `(expected: ${scenario.expected})`}`);
  }
}

async function testPromptFetching() {
  console.log('\n🧪 Test 2: Fetching Prompts\n');
  
  const testCases = [
    { context: 'inbound', lead_id: 'test-lead', has_property_data: true },
    { context: 'inbound', lead_id: null, has_property_data: false },
    { context: 'outbound', lead_id: 'test-lead', has_property_data: true }
  ];
  
  for (const testCase of testCases) {
    try {
      const prompt = await getPromptForCall(testCase);
      const promptName = determinePromptName(testCase);
      console.log(`✅ ${promptName}:`);
      console.log(`   Length: ${prompt.length} chars`);
      console.log(`   Preview: ${prompt.substring(0, 80)}...`);
    } catch (error) {
      console.log(`❌ Failed to fetch prompt: ${error.message}`);
    }
  }
}

async function testVariableInjection() {
  console.log('\n🧪 Test 3: Variable Injection\n');
  
  const template = `Hi {{leadFirstName}}! You're calling about your home in {{propertyCity}}, {{propertyState}}.

{{#if leadEmail}}
We'll send confirmation to {{leadEmail}}.
{{/if}}

{{#if estimatedEquity}}
Your estimated equity is {{estimatedEquity}}.
{{else}}
Let's discuss your equity options.
{{/if}}

{{brokerFirstName}} is looking forward to helping you!`;

  const variables = {
    leadFirstName: 'John',
    propertyCity: 'Austin',
    propertyState: 'TX',
    leadEmail: 'john@example.com',
    estimatedEquity: '$200,000',
    brokerFirstName: 'Walter'
  };
  
  const result = injectVariables(template, variables);
  
  console.log('Template Variables:', Object.keys(variables).join(', '));
  console.log('\nInjected Result:');
  console.log('---');
  console.log(result);
  console.log('---');
  
  // Verify substitutions
  const checks = [
    { search: 'John', description: 'Lead first name' },
    { search: 'Austin', description: 'Property city' },
    { search: 'john@example.com', description: 'Email' },
    { search: '$200,000', description: 'Estimated equity' },
    { search: 'Walter', description: 'Broker first name' }
  ];
  
  console.log('\nVerification:');
  for (const check of checks) {
    const found = result.includes(check.search);
    console.log(`${found ? '✅' : '❌'} ${check.description}: ${check.search}`);
  }
}

async function testCustomInstructions() {
  console.log('\n🧪 Test 4: Custom Instructions Override\n');
  
  const customInstructions = "This is a custom prompt from n8n!";
  
  const prompt = await getPromptForCall(
    { context: 'inbound', lead_id: 'test', has_property_data: true },
    customInstructions
  );
  
  const passed = prompt === customInstructions;
  console.log(`${passed ? '✅' : '❌'} Custom instructions override: ${passed ? 'PASS' : 'FAIL'}`);
  console.log(`   Expected: "${customInstructions}"`);
  console.log(`   Got: "${prompt.substring(0, 50)}..."`);
}

async function testCaching() {
  console.log('\n🧪 Test 5: Caching\n');
  
  // Clear cache first
  clearCache();
  console.log('✅ Cache cleared');
  
  const testContext = { context: 'inbound', lead_id: 'test', has_property_data: true };
  
  // First fetch (should hit PromptLayer or fallback)
  console.log('\n📥 First fetch (should fetch from PromptLayer or file)...');
  const start1 = Date.now();
  await getPromptForCall(testContext);
  const time1 = Date.now() - start1;
  console.log(`   ⏱️  Time: ${time1}ms`);
  
  // Second fetch (should hit cache)
  console.log('\n📥 Second fetch (should hit cache)...');
  const start2 = Date.now();
  await getPromptForCall(testContext);
  const time2 = Date.now() - start2;
  console.log(`   ⏱️  Time: ${time2}ms`);
  
  const speedup = Math.round((time1 / time2) * 10) / 10;
  console.log(`\n${time2 < time1 ? '✅' : '⚠️'} Cache speedup: ${speedup}x faster`);
}

async function testFallback() {
  console.log('\n🧪 Test 6: Fallback to Local File\n');
  
  // This will trigger fallback if PromptLayer prompts aren't set up yet
  const prompt = await getPromptForCall({
    context: 'inbound',
    lead_id: null,
    has_property_data: false
  });
  
  if (prompt.length > 0) {
    console.log('✅ Fallback working - got prompt from somewhere');
    console.log(`   Length: ${prompt.length} chars`);
    console.log(`   Source: ${prompt.includes('PromptLayer') ? 'PromptLayer' : 'Local file'}`);
  } else {
    console.log('❌ Fallback failed - no prompt received');
  }
}

async function runAllTests() {
  console.log('🚀 Smart Prompt Manager - Test Suite\n');
  console.log('='.repeat(50));
  
  try {
    await testPromptSelection();
    await testVariableInjection();
    await testCustomInstructions();
    await testFallback();
    await testPromptFetching();
    await testCaching();
    
    console.log('\n' + '='.repeat(50));
    console.log('\n✅ All tests completed!\n');
    console.log('📊 Next Steps:');
    console.log('   1. Create prompts in PromptLayer dashboard');
    console.log('   2. Use names: barbara-inbound-qualified, barbara-inbound-unqualified, etc.');
    console.log('   3. Make a test call and watch the logs');
    console.log('   4. Verify the right prompt is selected based on call context\n');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

