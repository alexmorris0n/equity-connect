import { buildSarahInstructions } from '../personas/sms-persona.js';
import { SMS_CONFIG } from '../config.js';
import { smsToolDefinitions, smsToolExecutors } from './sms-tools.js';
import { createChatCompletion, type ChatMessage } from './openai-chat.js';
import { fetchSmsConversation, logSmsInteraction } from './sms-conversation.js';
import { logger } from '../utils/logger.js';
import { sendSmsMessage } from './signalwire.js';
import { normalizePhone } from './supabase.js';

interface ToolExecutionRecord {
  name: string;
  arguments: any;
  result: any;
}

export interface ProcessSmsInput {
  from: string;
  to: string;
  body: string;
  messageSid?: string;
}

export interface ProcessSmsResult {
  leadId?: string;
  brokerId?: string;
  responseBody?: string;
  toolExecutions: ToolExecutionRecord[];
  consentGranted?: boolean;
}

const MAX_TOOL_ITERATIONS = 4;

function extractAssistantText(content: any): string {
  if (!content) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part === 'object' && part !== null && 'text' in part) {
          return part.text;
        }
        return '';
      })
      .join(' ')
      .trim();
  }

  return '';
}

export async function processInboundSms({ from, to, body, messageSid }: ProcessSmsInput): Promise<ProcessSmsResult> {
  logger.info(`📩 Incoming SMS from ${from}: ${body}`);
  const normalizedFrom = normalizePhone(from);
  const toolExecutions: ToolExecutionRecord[] = [];

  // 1. Load lead context
  const leadContext = await smsToolExecutors.get_lead_context({ phone: normalizedFrom });

  if (!leadContext?.found) {
    logger.warn('Lead not found for incoming SMS. Sending fallback message.');
    const fallback = 'Thanks for reaching out to Equity Connect! A team member will follow up shortly to help you out.';
    await sendSmsMessage({
      to: from,
      from: SMS_CONFIG.fromNumber || to,
      body: fallback,
      statusCallback: SMS_CONFIG.statusCallbackUrl,
      metadata: { reason: 'lead_not_found', inbound_sid: messageSid }
    });
    return { toolExecutions };
  }

  const leadId = leadContext.lead_id as string;
  const brokerId = leadContext.broker_id as string | undefined;
  toolExecutions.push({ name: 'get_lead_context', arguments: { phone: normalizedFrom }, result: leadContext });

  // 2. Consent check
  const consentCheck = await smsToolExecutors.check_consent_dnc({ lead_id: leadId });
  toolExecutions.push({ name: 'check_consent_dnc', arguments: { lead_id: leadId }, result: consentCheck });

  if (consentCheck?.can_call === false) {
    const apology = 'Thanks for your note. Per your contact preferences we won’t continue via text, but you can reach Walter’s office anytime at (424) 485-1544 if you need assistance.';
    await sendSmsMessage({
      to: from,
      from: SMS_CONFIG.fromNumber || to,
      body: apology,
      statusCallback: SMS_CONFIG.statusCallbackUrl,
      metadata: { reason: 'consent_denied', inbound_sid: messageSid }
    });
    return {
      leadId,
      brokerId,
      toolExecutions,
      consentGranted: false
    };
  }

  // 3. Log inbound message
  await logSmsInteraction({
    leadId,
    brokerId,
    body,
    direction: 'inbound',
    type: 'sms_replied',
    metadata: {
      inbound_sid: messageSid,
      from,
      to
    }
  });

  // 4. Build conversation history
  const history = await fetchSmsConversation(leadId, SMS_CONFIG.maxHistory);

  const personaInstructions = buildSarahInstructions({
    leadFirstName: leadContext?.lead?.first_name,
    leadLastName: leadContext?.lead?.last_name,
    city: leadContext?.lead?.property_city,
    brokerName: leadContext?.broker?.name,
    brokerCompany: leadContext?.broker?.company
  });

  const messages: ChatMessage[] = [
    { role: 'system', content: personaInstructions }
  ];

  const leadSummary = [
    `Lead ID: ${leadId}`,
    leadContext?.lead?.first_name || leadContext?.lead?.last_name
      ? `Lead Name: ${[leadContext?.lead?.first_name, leadContext?.lead?.last_name].filter(Boolean).join(' ')}`
      : null,
    leadContext?.lead?.property_city ? `City: ${leadContext.lead.property_city}, ${leadContext.lead.property_state || ''}`.trim() : null,
    leadContext?.broker?.name ? `Broker: ${leadContext.broker.name} (${leadContext.broker.company || 'Equity Connect'})` : null,
    leadContext?.last_call?.last_outcome ? `Last Outcome: ${leadContext.last_call.last_outcome}` : null
  ].filter(Boolean).join('\n');

  messages.push({
    role: 'system',
    content: `Lead context summary:\n${leadSummary}`
  });

  history.forEach((turn) => {
    messages.push({ role: turn.role === 'assistant' ? 'assistant' : 'user', content: turn.content });
  });

  let assistantReply = '';
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations += 1;
    const completion = await createChatCompletion(messages, smsToolDefinitions);
    const { message, finishReason } = completion;

    if (message.tool_calls && message.tool_calls.length > 0) {
      messages.push({
        role: 'assistant',
        content: message.content ?? '',
        tool_calls: message.tool_calls
      });

      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const executor = smsToolExecutors[toolName];

        if (!executor) {
          logger.warn(`No executor registered for tool ${toolName}`);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Tool ${toolName} not available` })
          });
          continue;
        }

        let args: any = {};
        try {
          args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
        } catch (error) {
          logger.error(`Failed to parse tool arguments for ${toolName}:`, error);
        }

        if (toolName === 'assign_tracking_number' && !args.signalwire_number) {
          args.signalwire_number = SMS_CONFIG.fromNumber || to;
        }

        const result = await executor(args);
        toolExecutions.push({ name: toolName, arguments: args, result });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      continue;
    }

    assistantReply = extractAssistantText(message.content);

    if (!assistantReply && finishReason === 'length') {
      logger.warn('Assistant response empty due to token limit, continuing loop');
      continue;
    }

    break;
  }

  if (!assistantReply) {
    assistantReply = 'Thanks for the update! Let me know if you need anything else.';
  }

  // 5. Send SMS response
  const outboundResponse = await sendSmsMessage({
    to: from,
    from: SMS_CONFIG.fromNumber || to,
    body: assistantReply,
    statusCallback: SMS_CONFIG.statusCallbackUrl,
    metadata: {
      lead_id: leadId,
      broker_id: brokerId,
      tool_iterations: iterations,
      inbound_sid: messageSid
    }
  });

  // 6. Log outbound message
  await logSmsInteraction({
    leadId,
    brokerId,
    body: assistantReply,
    direction: 'outbound',
    type: 'sms_sent',
    metadata: {
      signalwire_response: outboundResponse,
      tool_executions: toolExecutions,
      from: SMS_CONFIG.fromNumber || to,
      to: from
    }
  });

  return {
    leadId,
    brokerId,
    responseBody: assistantReply,
    toolExecutions,
    consentGranted: true
  };
}


