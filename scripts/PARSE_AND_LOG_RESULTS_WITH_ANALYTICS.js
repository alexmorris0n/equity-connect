// Parse AI Agent output and log results WITH ANALYTICS TRACKING
// Updated: October 16, 2025
// Purpose: Extract token metrics and prepare analytics data for tracking

const agentOutput = $input.first().json;

// Extract the agent's response/actions
const output = agentOutput.output || agentOutput.text || agentOutput.response || JSON.stringify(agentOutput);

// Calculate total token usage across all steps
let totalPromptTokens = 0;
let totalCompletionTokens = 0;
let totalTokens = 0;
let stepCount = 0;

if (agentOutput.intermediateSteps && Array.isArray(agentOutput.intermediateSteps)) {
  agentOutput.intermediateSteps.forEach(step => {
    if (step.action?.messageLog?.[0]?.kwargs?.response_metadata?.tokenUsage) {
      const usage = step.action.messageLog[0].kwargs.response_metadata.tokenUsage;
      totalPromptTokens += usage.promptTokens || 0;
      totalCompletionTokens += usage.completionTokens || 0;
      totalTokens += usage.totalTokens || 0;
      stepCount++;
    }
  });
}

// Calculate cost (Gemini Flash pricing: $0.075 per 1M input, $0.30 per 1M output)
const inputCost = (totalPromptTokens / 1000000) * 0.075;
const outputCost = (totalCompletionTokens / 1000000) * 0.30;
const totalCost = inputCost + outputCost;

// Classify intent from output
const intent = output.includes('PHONE_PROVIDED') ? 'PHONE_PROVIDED' : 
               output.includes('QUESTION') ? 'QUESTION' :
               output.includes('INTEREST') ? 'INTEREST' :
               output.includes('UNSUBSCRIBE') ? 'UNSUBSCRIBE' : 'UNKNOWN';

// Extract tools called from intermediate steps
const toolsCalled = [];
if (agentOutput.intermediateSteps && Array.isArray(agentOutput.intermediateSteps)) {
  agentOutput.intermediateSteps.forEach(step => {
    if (step.action?.tool) {
      toolsCalled.push({
        tool: step.action.tool,
        input: step.action.toolInput
      });
    }
  });
}

// Check if VAPI call was triggered
const vapiCallTriggered = toolsCalled.some(t => t.tool === 'create_call');
let vapiCallId = null;
if (vapiCallTriggered && agentOutput.intermediateSteps) {
  const vapiStep = agentOutput.intermediateSteps.find(s => 
    s.action?.tool === 'create_call'
  );
  if (vapiStep?.observation) {
    try {
      const obs = JSON.parse(vapiStep.observation.replace(/^\[{.*?text":\s*"/, '').replace(/"}]$/, ''));
      const obsData = JSON.parse(obs);
      vapiCallId = obsData.id;
    } catch (e) {
      // Can't parse, that's ok
    }
  }
}

// Build analytics object for database insertion
const analytics = {
  intent: intent,
  ai_model_used: 'gemini-flash-2.5',
  token_count_input: totalPromptTokens,
  token_count_output: totalCompletionTokens,
  token_count_total: totalTokens,
  ai_steps: stepCount,
  cost_usd: totalCost,
  tools_called: toolsCalled,
  call_triggered: vapiCallTriggered,
  vapi_call_id: vapiCallId
};

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ AI Agent Processing Complete');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Agent Actions Taken:');
console.log(output);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Token Usage:');
console.log(`   Steps: ${stepCount}`);
console.log(`   Input Tokens: ${totalPromptTokens.toLocaleString()}`);
console.log(`   Output Tokens: ${totalCompletionTokens.toLocaleString()}`);
console.log(`   Total Tokens: ${totalTokens.toLocaleString()}`);
console.log(`   💰 Cost: $${totalCost.toFixed(4)}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 Analytics:');
console.log(`   Intent: ${intent}`);
console.log(`   Tools Called: ${toolsCalled.length}`);
console.log(`   VAPI Call: ${vapiCallTriggered ? 'Yes' : 'No'}`);
if (vapiCallId) console.log(`   VAPI Call ID: ${vapiCallId}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Timestamp:', new Date().toISOString());
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Return success with details including token usage AND analytics
return [{
  json: {
    success: true,
    agent_output: output,
    timestamp: new Date().toISOString(),
    processing_complete: true,
    tokens: {
      steps: stepCount,
      input: totalPromptTokens,
      output: totalCompletionTokens,
      total: totalTokens,
      cost: totalCost
    },
    analytics: analytics  // NEW: For database insertion
  }
}];

