/**
 * Check Consent & DNC Tool
 * Verify if lead has given consent to be contacted and is not on DNC list
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { getSupabaseClient } from '../../services/supabase.js';
import { logger } from '../../utils/logger.js';

/**
 * Check if lead has consent and is not on DNC list
 * IMPORTANT: Call this BEFORE engaging in sales conversation
 */
export const checkConsentDNCTool = realtimeTool({
  name: 'check_consent_dnc',
  description: 'Check if lead has given consent to be contacted and is not on DNC list. Call this BEFORE engaging in conversation.',
  parameters: z.object({
    lead_id: z.string().describe('Lead UUID from get_lead_context')
  }),
  execute: async ({ lead_id }) => {
    const sb = getSupabaseClient();
    
    try {
      logger.info(`🔒 Checking consent/DNC for lead: ${lead_id}`);
      
      const { data: lead, error } = await sb
        .from('leads')
        .select('consent, status, first_name, last_name')
        .eq('id', lead_id)
        .single();
      
      if (error) {
        logger.error('Consent check error:', error);
        return JSON.stringify({ 
          error: error.message, 
          can_call: false,
          message: 'Unable to verify consent status.'
        });
      }
      
      // Check consent and not closed_lost (DNC equivalent)
      const canCall = lead.consent === true && lead.status !== 'closed_lost';
      
      logger.info(`${canCall ? '✅' : '❌'} Consent check: ${canCall ? 'OK' : 'DENIED'} for ${lead.first_name} ${lead.last_name}`);
      
      return JSON.stringify({
        can_call: canCall,
        has_consent: lead.consent,
        is_dnc: lead.status === 'closed_lost',
        message: canCall 
          ? 'Lead has consent and is not on DNC list. You may proceed with the call.'
          : 'Lead does not have consent or is on DNC list. End the call politely and immediately.'
      });
      
    } catch (error: any) {
      logger.error('Error checking consent:', error);
      return JSON.stringify({ 
        error: error.message, 
        can_call: false,
        message: 'Unable to verify consent. Do not proceed with sales conversation.'
      });
    }
  }
});

