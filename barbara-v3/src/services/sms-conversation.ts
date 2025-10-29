import { getSupabaseClient } from './supabase.js';
import { logger } from '../utils/logger.js';

export type SmsRole = 'assistant' | 'user';

export interface SmsConversationTurn {
  role: SmsRole;
  content: string;
  createdAt: string;
  metadata?: Record<string, any> | null;
}

export interface LogSmsParams {
  leadId: string;
  brokerId?: string | null;
  body: string;
  direction: 'inbound' | 'outbound';
  type: 'sms_sent' | 'sms_replied';
  metadata?: Record<string, any>;
}

const SMS_INTERACTION_TYPES = ['sms_sent', 'sms_replied'] as const;

export async function fetchSmsConversation(leadId: string, limit = 20): Promise<SmsConversationTurn[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('interactions')
    .select('content, direction, metadata, created_at, type')
    .eq('lead_id', leadId)
    .in('type', Array.from(SMS_INTERACTION_TYPES))
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch SMS history:', error);
    return [];
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    role: row.type === 'sms_sent' || row.direction === 'outbound' ? 'assistant' : 'user',
    content: row.content ?? '',
    createdAt: row.created_at,
    metadata: row.metadata ?? null
  }));
}

export async function logSmsInteraction(params: LogSmsParams): Promise<void> {
  const { leadId, brokerId, body, direction, type, metadata } = params;
  const supabase = getSupabaseClient();

  const insertPayload: Record<string, any> = {
    lead_id: leadId,
    broker_id: brokerId ?? null,
    type,
    direction,
    content: body,
    metadata: {
      channel: 'sms',
      persona: 'sarah',
      ...metadata
    }
  };

  const { error } = await supabase
    .from('interactions')
    .insert(insertPayload);

  if (error) {
    logger.error(`Failed to log SMS ${type}:`, error);
  }
}


