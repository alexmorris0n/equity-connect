import type { FastifyPluginAsync } from 'fastify';
import { SMS_CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';
import { processInboundSms } from '../services/sms-agent.js';
import { smsToolExecutors } from '../services/sms-tools.js';
import { logSmsInteraction } from '../services/sms-conversation.js';
import { getSupabaseClient, normalizePhone } from '../services/supabase.js';

interface IncomingSmsPayload {
  MessageSid?: string;
  AccountSid?: string;
  From: string;
  To: string;
  Body: string;
  [key: string]: any;
}

const STOP_RESPONSE = 'You’re unsubscribed from Equity Connect texts. Reply START if you want to opt back in.';
const HELP_RESPONSE = 'Thanks for reaching out! This is Walter’s office. Call us at (424) 485-1544 or reply STOP to opt out.';

function matchesKeyword(body: string, keywords: readonly string[]): boolean {
  const cleaned = body.trim().toUpperCase();
  if (!cleaned) return false;
  const firstToken = cleaned.split(/\s+/)[0];
  const normalized = firstToken.replace(/[^A-Z]/g, '');
  return keywords.includes(normalized || cleaned);
}

async function handleComplianceKeyword(
  keywordType: 'stop' | 'help',
  payload: IncomingSmsPayload
) {
  const from = payload.From;
  const to = payload.To;
  const body = payload.Body ?? '';
  const messageSid = payload.MessageSid;

  let responseMessage = keywordType === 'stop' ? STOP_RESPONSE : HELP_RESPONSE;
  let leadId: string | undefined;
  let brokerId: string | undefined;

  try {
    const leadContext = await smsToolExecutors.get_lead_context({ phone: normalizePhone(from) });

    if (leadContext?.found && typeof leadContext.lead_id === 'string') {
      const resolvedLeadId = leadContext.lead_id as string;
      const resolvedBrokerId = typeof leadContext.broker_id === 'string' ? leadContext.broker_id : undefined;

      leadId = resolvedLeadId;
      brokerId = resolvedBrokerId;

      await logSmsInteraction({
        leadId: resolvedLeadId,
        brokerId: resolvedBrokerId,
        body,
        direction: 'inbound',
        type: 'sms_replied',
        metadata: {
          compliance_keyword: keywordType,
          inbound_sid: messageSid,
          from,
          to
        }
      });

      if (keywordType === 'stop') {
        const supabase = getSupabaseClient();
        await supabase
          .from('leads')
          .update({
            consent: false,
            text_reminder_consented: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', resolvedLeadId);
      }
    }
  } catch (error) {
    logger.error('Compliance keyword handling error:', error);
  }

  return {
    responseMessage,
    leadId,
    brokerId
  };
}

export const smsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/sms', async (request, reply) => {
    const payload = request.body as IncomingSmsPayload;
    const from = payload?.From;
    const to = payload?.To;
    const body = (payload?.Body ?? '').toString();

    if (!from || !to) {
      reply.code(400).send('');
      return;
    }

    // Compliance: STOP/HELP before any AI processing
    if (matchesKeyword(body, SMS_CONFIG.complianceKeywords)) {
      const result = await handleComplianceKeyword('stop', payload);

      if (result.leadId) {
        await logSmsInteraction({
          leadId: result.leadId,
          brokerId: result.brokerId,
          body: result.responseMessage,
          direction: 'outbound',
          type: 'sms_sent',
          metadata: { compliance_keyword: 'stop' }
        });
      }

      reply
        .type('application/xml')
        .send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${result.responseMessage}</Message></Response>`);
      return;
    }

    if (matchesKeyword(body, SMS_CONFIG.helpKeywords)) {
      const result = await handleComplianceKeyword('help', payload);

      if (result.leadId) {
        await logSmsInteraction({
          leadId: result.leadId,
          brokerId: result.brokerId,
          body: result.responseMessage,
          direction: 'outbound',
          type: 'sms_sent',
          metadata: { compliance_keyword: 'help' }
        });
      }

      reply
        .type('application/xml')
        .send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${result.responseMessage}</Message></Response>`);
      return;
    }

    try {
      await processInboundSms({
        from,
        to,
        body,
        messageSid: payload.MessageSid
      });
    } catch (error) {
      logger.error('SMS processing failed:', error);
    }

    reply.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  });
};


