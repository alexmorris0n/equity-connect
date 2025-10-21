/**
 * PromptLayer Integration for OpenAI Realtime API
 * 
 * Since Realtime API uses WebSockets (not standard chat completions),
 * we log to PromptLayer using their SDK's logRequest method
 */

const { PromptLayer } = require('promptlayer');

class PromptLayerRealtime {
  constructor(apiKey) {
    this.apiKey = apiKey;  // Store API key
    this.enabled = !!apiKey;
    if (this.enabled) {
      this.client = new PromptLayer({ 
        apiKey,
        throwOnError: false  // Don't crash calls if logging fails
      });
      console.log('✅ PromptLayer enabled');
    } else {
      console.log('⚠️ PromptLayer disabled (no API key)');
    }
  }

  /**
   * Log a complete Realtime API conversation
   */
  async logRealtimeConversation({
    callId,
    leadId,
    brokerId,
    leadName,
    brokerName,
    conversationTranscript,
    metadata,
    outcome,
    durationSeconds,
    toolCalls = []
  }) {
    if (!this.enabled) return null;

    try {
      // Build prompt messages from transcript
      const messages = conversationTranscript.map(t => ({
        role: t.role,
        content: t.text,
        timestamp: t.timestamp
      }));

      // Use PromptLayer SDK's logRequest method (correct way!)
      const result = await this.client.logRequest({
        function_name: 'openai.realtime.conversation',
        provider_type: 'openai',
        args: [],
        kwargs: {
          model: 'gpt-4o-realtime-preview-2024-10-01',
          messages: messages,
          temperature: 0.75,
          max_tokens: 400
        },
        tags: [
          'barbara',
          'realtime',
          outcome || 'unknown',
          metadata?.money_purpose || 'unknown_purpose',
          `broker:${brokerName}`,
          `lead:${leadName}`
        ],
        request_response: {
          request: {
            model: 'gpt-4o-realtime-preview-2024-10-01',
            messages: messages.slice(0, 5), // First 5 exchanges
            tools: toolCalls.map(t => t.name)
          },
          response: {
            id: callId,
            model: 'gpt-4o-realtime-preview-2024-10-01',
            choices: [{
              message: {
                role: 'assistant',
                content: messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || ''
              }
            }]
          }
        },
        request_start_time: new Date(metadata?.call_start_time || Date.now() - (durationSeconds * 1000)).toISOString(),
        request_end_time: new Date().toISOString(),
        prompt_name: metadata?.prompt_version || 'old-big-beautiful-prompt',
        prompt_input_variables: {
          lead_id: leadId,
          broker_id: brokerId,
          lead_name: leadName,
          broker_name: brokerName,
          money_purpose: metadata?.money_purpose,
          timeline: metadata?.timeline
        },
        metadata: {
          // Call metadata
          call_id: callId,
          lead_id: leadId,
          broker_id: brokerId,
          outcome: outcome,
          duration_seconds: durationSeconds,
          
          // Barbara-specific metadata
          money_purpose: metadata?.money_purpose,
          specific_need: metadata?.specific_need,
          amount_needed: metadata?.amount_needed,
          timeline: metadata?.timeline,
          objections: metadata?.objections || [],
          questions_asked: metadata?.questions_asked || [],
          commitment_points: metadata?.commitment_points_completed || 0,
          appointment_scheduled: metadata?.appointment_scheduled || false,
          
          // Quality metrics
          tool_calls_count: toolCalls.length,
          tool_calls: toolCalls.map(t => t.name),
          interruptions: metadata?.interruptions || 0,
          
          // Contact verification
          email_verified: metadata?.email_verified || false,
          phone_verified: metadata?.phone_verified || false
        }
      });

      console.log('✅ Logged to PromptLayer:', result?.request_id);
      return result?.request_id;

    } catch (error) {
      console.error('❌ PromptLayer logging failed:', error.message);
      // Don't fail the call if logging fails
      return null;
    }
  }

  /**
   * Log a tool call to PromptLayer
   */
  async logToolCall({
    callId,
    toolName,
    toolArgs,
    toolResult,
    success,
    errorMessage
  }) {
    if (!this.enabled) return null;

    try {
      // Use SDK's track.metadata method (correct way!)
      await this.client.track.metadata({
        request_id: callId,
        metadata: {
          tool_call: {
            name: toolName,
            arguments: JSON.stringify(toolArgs),
            result: JSON.stringify(toolResult),
            success: success.toString(),
            error: errorMessage || '',
            timestamp: new Date().toISOString()
          }
        }
      });

      console.log(`✅ Tool call logged to PromptLayer: ${toolName}`);
    } catch (error) {
      console.error('❌ PromptLayer tool logging failed:', error.message);
    }
  }

  /**
   * Log a call outcome/score to PromptLayer
   */
  async logScore({
    callId,
    score,
    outcome,
    metadata
  }) {
    if (!this.enabled) return null;

    try {
      // Use SDK's track.score method (correct way!)
      await this.client.track.score({
        request_id: callId,
        score: score, // 0-100
        metadata: {
          outcome: outcome,
          ...metadata
        }
      });

      console.log(`✅ Score logged to PromptLayer: ${score}`);
    } catch (error) {
      console.error('❌ PromptLayer score logging failed:', error.message);
    }
  }
}

// Singleton instance
let promptLayerInstance = null;

function initPromptLayer(apiKey = process.env.PROMPTLAYER_API_KEY) {
  if (!promptLayerInstance) {
    promptLayerInstance = new PromptLayerRealtime(apiKey);
  }
  return promptLayerInstance;
}

module.exports = {
  initPromptLayer,
  PromptLayerRealtime
};
