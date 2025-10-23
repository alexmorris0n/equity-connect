/**
 * PromptLayer Integration for OpenAI Realtime API
 * 
 * Since Realtime API uses WebSockets (not standard chat completions),
 * we log to PromptLayer using their SDK's logRequest method
 */

const { PromptLayer } = require('promptlayer');

/**
 * Sanitize data for PromptLayer - ensures JSON-safe primitives only
 * Converts objects to strings, handles circular references, removes non-serializable data
 */
function safeJSON(obj) {
  try {
    // First pass: JSON.stringify with default handler for non-serializable
    const jsonString = JSON.stringify(obj, (key, value) => {
      // Handle undefined
      if (value === undefined) return null;
      
      // Handle functions
      if (typeof value === 'function') return value.toString();
      
      // Handle dates
      if (value instanceof Date) return value.toISOString();
      
      // Handle buffers
      if (Buffer.isBuffer(value)) return '[Buffer]';
      
      // Handle circular references or complex objects
      if (typeof value === 'object' && value !== null) {
        // If it has a custom toString that's not [object Object], use it
        const str = value.toString();
        if (str !== '[object Object]') return str;
      }
      
      return value;
    });
    
    // Second pass: Parse back to ensure it's valid JSON
    return JSON.parse(jsonString);
  } catch (err) {
    // Last resort: convert to string
    console.warn('⚠️ Failed to sanitize object for PromptLayer:', err.message);
    return String(obj);
  }
}

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
   * Convert timestamp to Unix seconds (float) as required by PromptLayer
   * Per docs: request_start_time and request_end_time use Unix timestamps in seconds
   */
  toUnixSeconds(timestamp, durationSeconds = 0) {
    try {
      // If timestamp is already a number (assume it's unix ms)
      if (typeof timestamp === 'number') {
        // If it's already in seconds (< year 3000), return as-is
        if (timestamp < 32503680000) {
          return timestamp;
        }
        // Otherwise convert from milliseconds to seconds
        return timestamp / 1000;
      }
      
      // If timestamp is an ISO string
      if (typeof timestamp === 'string' && timestamp.includes('T')) {
        return new Date(timestamp).getTime() / 1000;
      }
      
      // Fallback: calculate from current time minus duration
      const startTimeMs = Date.now() - (durationSeconds * 1000);
      return startTimeMs / 1000;
    } catch (err) {
      // Last resort fallback
      console.warn('⚠️ Failed to parse timestamp, using current time:', err.message);
      return Date.now() / 1000;
    }
  }

  /**
   * Log a complete Realtime API conversation using PromptLayer Blueprint format
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
      // Convert conversation to PromptLayer Blueprint format
      // Per docs: https://docs.promptlayer.com/features/prompt-history/custom-logging
      const blueprintMessages = [];
      
      if (Array.isArray(conversationTranscript)) {
        for (const msg of conversationTranscript) {
          if (!msg || !msg.text) continue;
          
          blueprintMessages.push({
            role: String(msg.role || 'user'),
            content: [
              {
                type: 'text',
                text: String(msg.text)
              }
            ]
          });
        }
      }
      
      // Input Blueprint: The full conversation history
      const inputBlueprint = {
        type: 'chat',
        messages: blueprintMessages
      };
      
      // Output Blueprint: The final assistant response
      const lastAssistantMsg = blueprintMessages.filter(m => m.role === 'assistant').pop();
      const outputBlueprint = lastAssistantMsg ? {
        type: 'chat',
        messages: [lastAssistantMsg]
      } : {
        type: 'chat',
        messages: [{
          role: 'assistant',
          content: [{ type: 'text', text: '' }]
        }]
      };

      // Safely extract tool names
      const toolNames = Array.isArray(toolCalls) 
        ? toolCalls.map(t => typeof t === 'string' ? t : (t?.name || 'unknown')).filter(Boolean)
        : [];

      // Clean metadata (primitives only)
      const cleanMetadata = {
        call_id: String(callId || ''),
        lead_id: String(leadId || ''),
        broker_id: String(brokerId || ''),
        lead_name: String(leadName || ''),
        broker_name: String(brokerName || ''),
        outcome: String(outcome || ''),
        duration_seconds: Number(durationSeconds || 0),
        message_count: Number(blueprintMessages.length),
        money_purpose: String(metadata?.money_purpose || ''),
        specific_need: String(metadata?.specific_need || ''),
        amount_needed: String(metadata?.amount_needed || ''),
        timeline: String(metadata?.timeline || ''),
        objections_count: Number(metadata?.objections_count || 0),
        questions_count: Number(metadata?.questions_count || 0),
        commitment_points: Number(metadata?.commitment_points_completed || 0),
        appointment_scheduled: Boolean(metadata?.appointment_scheduled),
        tool_calls: String(toolNames.join(', ') || 'none'),
        interruptions: Number(metadata?.interruptions || 0),
        email_verified: Boolean(metadata?.email_verified),
        phone_verified: Boolean(metadata?.phone_verified)
      };
      
      const cleanInputVars = {
        lead_id: String(leadId || ''),
        broker_id: String(brokerId || ''),
        lead_name: String(leadName || ''),
        broker_name: String(brokerName || ''),
        money_purpose: String(metadata?.money_purpose || ''),
        timeline: String(metadata?.timeline || '')
      };

      // Use PromptLayer's CORRECT API format (Blueprint)
      const result = await this.client.logRequest({
        provider: 'openai',
        model: String(process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview'),
        input: inputBlueprint,
        output: outputBlueprint,
        request_start_time: this.toUnixSeconds(metadata?.call_start_time, durationSeconds),
        request_end_time: Date.now() / 1000,
        tags: [
          'barbara',
          'realtime',
          String(outcome || 'unknown')
        ],
        metadata: cleanMetadata
      });

      console.log('✅ Logged to PromptLayer:', result?.request_id);
      
      // Track which prompt template was used (critical for A/B testing & analytics)
      if (result?.request_id && metadata?.prompt_version) {
        try {
          await this.client.track.prompt({
            request_id: result.request_id,
            prompt_name: String(metadata.prompt_version),
            prompt_input_variables: safeJSON({
              lead_name: leadName,
              broker_name: brokerName,
              money_purpose: metadata?.money_purpose,
              timeline: metadata?.timeline,
              lead_id: leadId,
              broker_id: brokerId
            })
          });
          console.log(`✅ Linked prompt template: ${metadata.prompt_version}`);
        } catch (trackError) {
          console.warn('⚠️ Failed to track prompt (non-critical):', trackError.message);
        }
      }
      
      return result?.request_id;

    } catch (error) {
      console.error('❌ PromptLayer logging failed:', error.message);
      if (error.stack) {
        console.error('   Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
      }
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
      // Use SDK's track.metadata method with sanitized data
      await this.client.track.metadata({
        request_id: callId,
        metadata: safeJSON({
          tool_call: {
            name: toolName,
            arguments: JSON.stringify(toolArgs),
            result: JSON.stringify(toolResult),
            success: success.toString(),
            error: errorMessage || '',
            timestamp: new Date().toISOString()
          }
        })
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
      // Use SDK's track.score method with sanitized metadata
      await this.client.track.score({
        request_id: callId,
        score: score, // 0-100
        metadata: safeJSON({
          outcome: outcome,
          ...metadata
        })
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
