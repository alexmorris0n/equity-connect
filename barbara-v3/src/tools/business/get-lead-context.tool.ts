/**
 * Get Lead Context Tool
 * Query lead information by phone number to personalize the conversation
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { getSupabaseClient, phoneSearchPatterns } from '../../services/supabase.js';
import { logger } from '../../utils/logger.js';

/**
 * Get lead context by phone number
 * Returns lead details, broker info, and property data for personalization
 */
export const getLeadContextTool = realtimeTool({
  name: 'get_lead_context',
  description: 'Get lead information by phone number to personalize the conversation. Returns lead details, broker info, and property data.',
  parameters: z.object({
    phone: z.string().describe('Phone number of the lead (any format)')
  }),
  execute: async ({ phone }) => {
    const sb = getSupabaseClient();
    
    try {
      logger.info(`🔍 Looking up lead by phone: ${phone}`);
      
      // Get search patterns for phone number (10-digit, formatted, E.164)
      const patterns = phoneSearchPatterns(phone);
      
      // Build OR query to match any format in both primary_phone and primary_phone_e164
      const orConditions = patterns.flatMap(pattern => [
        `primary_phone.ilike.%${pattern}%`,
        `primary_phone_e164.eq.${pattern}`
      ]).join(',');
      
      // Query lead by phone - match various formats
      const { data: leads, error: leadError } = await sb
        .from('leads')
        .select('*, brokers!assigned_broker_id(*)')
        .or(orConditions)
        .limit(1);
      
      if (leadError) {
        logger.error('Lead lookup error:', leadError);
        return JSON.stringify({ error: leadError.message, found: false });
      }
      
      if (!leads || leads.length === 0) {
        logger.info('Lead not found');
        return JSON.stringify({ 
          error: 'Lead not found', 
          found: false,
          message: 'No lead found with that phone number. This appears to be a new caller.'
        });
      }
      
      const lead = leads[0];
      const broker = lead.brokers;
      
      // Get last interaction for context
      const { data: lastInteraction } = await sb
        .from('interactions')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      const lastCallContext = lastInteraction?.metadata || {};
      
      // Determine qualification status
      const isQualified = ['qualified', 'appointment_set', 'showed', 'application', 'funded'].includes(lead.status);
      
      logger.info(`✅ Lead found: ${lead.first_name} ${lead.last_name} (${lead.status})`);
      
      return JSON.stringify({
        found: true,
        lead_id: lead.id,
        broker_id: lead.assigned_broker_id,
        broker: {
          name: broker?.contact_name || 'Not assigned',
          company: broker?.company_name || '',
          phone: broker?.phone || ''
        },
        lead: {
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.primary_email,
          phone: lead.primary_phone,
          property_address: lead.property_address,
          property_city: lead.property_city,
          property_state: lead.property_state,
          property_zip: lead.property_zip,
          property_value: lead.property_value,
          mortgage_balance: lead.mortgage_balance,
          estimated_equity: lead.estimated_equity,
          age: lead.age,
          owner_occupied: lead.owner_occupied,
          status: lead.status,
          qualified: isQualified,
          assigned_persona: lead.assigned_persona,
          persona_heritage: lead.persona_heritage
        },
        last_call: {
          money_purpose: lastCallContext.money_purpose || null,
          specific_need: lastCallContext.specific_need || null,
          amount_needed: lastCallContext.amount_needed || null,
          timeline: lastCallContext.timeline || null,
          objections: lastCallContext.objections || [],
          questions_asked: lastCallContext.questions_asked || [],
          appointment_scheduled: lastCallContext.appointment_scheduled || false,
          last_outcome: lastInteraction?.outcome || null
        }
      });
      
    } catch (error: any) {
      logger.error('Error getting lead context:', error);
      return JSON.stringify({ 
        error: error.message, 
        found: false,
        message: 'Unable to retrieve lead information at this time.'
      });
    }
  }
});

