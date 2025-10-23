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
      // Build CLEAN prompt messages from transcript (strings only, no timestamps)
      // Filter out any empty messages
      const messages = conversationTranscript
        .filter(t => t && (t.text || t.content)) // Skip empty messages
        .map(t => ({
          role: String(t.role || 'user'),
          content: String(t.text || t.content || '')
        }))
        .filter(m => m.content.trim().length > 0); // Skip messages with empty content

      // Safely extract tool names (handle missing .name gracefully)
      const toolNames = Array.isArray(toolCalls) 
        ? toolCalls.map(t => typeof t === 'string' ? t : (t?.name || 'unknown')).filter(Boolean)
        : [];

      // Last assistant message for response
      const lastAssistantMessage = messages.filter(m => m.role === 'assistant').slice(-1)[0];
      const lastAssistantContent = String(lastAssistantMessage?.content || '');

      // Sanitize all data before sending to PromptLayer
      const cleanMetadata = safeJSON({
        call_id: callId,
        lead_id: leadId,
        broker_id: brokerId,
        outcome: outcome,
        duration_seconds: durationSeconds,
        message_count: messages.length,
        money_purpose: metadata?.money_purpose,
        specific_need: metadata?.specific_need,
        amount_needed: metadata?.amount_needed,
        timeline: metadata?.timeline,
        objections_count: Array.isArray(metadata?.objections) ? metadata.objections.length : 0,
        questions_count: Array.isArray(metadata?.questions_asked) ? metadata.questions_asked.length : 0,
        commitment_points: metadata?.commitment_points_completed || 0,
        appointment_scheduled: metadata?.appointment_scheduled || false,
        tool_calls_count: toolNames.length,
        tool_calls_list: toolNames.join(', ') || 'none',
        interruptions: metadata?.interruptions || 0,
        email_verified: metadata?.email_verified || false,
        phone_verified: metadata?.phone_verified || false
      });
      
      const cleanInputVars = safeJSON({
        lead_id: leadId,
        broker_id: brokerId,
        lead_name: leadName,
        broker_name: brokerName,
        money_purpose: metadata?.money_purpose,
        timeline: metadata?.timeline
      });

      // Use PromptLayer SDK's logRequest method
      // For Realtime API, we simplify the structure since it's not a standard chat completion
      const result = await this.client.logRequest({
        function_name: 'openai.realtime.conversation',
        provider_type: 'openai',
        args: [],
        kwargs: safeJSON({
          model: process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview',
          temperature: 0.75,
          max_tokens: 400
        }),
        tags: [
          'barbara',
          'realtime',
          String(outcome || 'unknown'),
          String(metadata?.money_purpose || 'unknown_purpose'),
          `broker:${String(brokerName)}`,
          `lead:${String(leadName)}`
        ],
        request_response: JSON.stringify({
          request: {
            model: process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview',
            message_count: messages.length,
            tools_used: toolNames
          },
          response: {
            id: String(callId),
            model: process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview',
            last_message: lastAssistantContent.substring(0, 200)
          }
        }),
        request_start_time: this.toUnixSeconds(metadata?.call_start_time, durationSeconds),
        request_end_time: Date.now() / 1000,
        prompt_name: String(metadata?.prompt_version || 'old-big-beautiful-prompt'),
        prompt_input_variables: cleanInputVars,
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
