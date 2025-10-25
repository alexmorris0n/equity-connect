/**
 * Save Interaction Tool
 * Log call details at the end of conversation
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { getSupabaseClient } from '../../services/supabase.js';
import { logger } from '../../utils/logger.js';

/**
 * Save call interaction details
 * Logs comprehensive metadata for analytics and follow-up
 * NOTE: PromptLayer integration removed per user request
 */
export const saveInteractionTool = realtimeTool({
  name: 'save_interaction',
  description: 'Save call interaction details at the end of the call. Include transcript summary and outcome.',
  parameters: z.object({
    lead_id: z.string().describe('Lead UUID'),
    broker_id: z.string().nullish().describe('Broker UUID'),
    duration_seconds: z.number().nullish().describe('Call duration in seconds'),
    outcome: z.enum(['appointment_booked', 'not_interested', 'no_response', 'positive', 'neutral', 'negative']).describe('Call outcome'),
    content: z.string().describe('Brief summary of the conversation'),
    recording_url: z.string().nullish().describe('SignalWire recording URL if available'),
    metadata: z.any().nullish().describe('Additional call metadata (transcript, tool calls, etc.)')
  }),
  execute: async ({ lead_id, broker_id, duration_seconds, outcome, content, recording_url, metadata }) => {
    const sb = getSupabaseClient();
    
    try {
      logger.info(`💾 Saving interaction for lead: ${lead_id}`);
      
      // Check if lead should be marked as qualified
      const qualifiesByMetadata = metadata?.qualified === true
        || metadata?.met_qualification_requirements === true
        || metadata?.qualification_status === 'qualified';
      const qualifiesByOutcome = outcome === 'appointment_booked' || outcome === 'positive';
      
      if (qualifiesByMetadata || qualifiesByOutcome) {
        try {
          await sb
            .from('leads')
            .update({ qualified: true, updated_at: new Date().toISOString() })
            .eq('id', lead_id);
          logger.info('✅ Lead marked as qualified');
        } catch (updateError) {
          logger.warn('Failed to update lead qualification:', updateError);
        }
      }
      
      // Build comprehensive metadata
      const interactionMetadata = {
        ai_agent: 'barbara',
        version: '3.0',
        
        // Include conversation transcript if provided
        conversation_transcript: metadata?.conversation_transcript || null,
        
        // Lead qualification data
        money_purpose: metadata?.money_purpose || null,
        specific_need: metadata?.specific_need || null,
        amount_needed: metadata?.amount_needed || null,
        timeline: metadata?.timeline || null,
        
        // Conversation metrics
        objections: metadata?.objections || [],
        objections_count: Array.isArray(metadata?.objections) ? metadata.objections.length : 0,
        questions_asked: metadata?.questions_asked || [],
        questions_count: Array.isArray(metadata?.questions_asked) ? metadata.questions_asked.length : 0,
        key_details: metadata?.key_details || [],
        key_details_count: Array.isArray(metadata?.key_details) ? metadata.key_details.length : 0,
        
        // Appointment tracking
        appointment_scheduled: metadata?.appointment_scheduled || false,
        appointment_datetime: metadata?.appointment_datetime || null,
        
        // Contact verification
        email_verified: metadata?.email_verified || false,
        phone_verified: metadata?.phone_verified || false,
        email_collected: metadata?.email_collected || false,
        
        // Commitment tracking
        commitment_points_completed: metadata?.commitment_points_completed || 0,
        text_reminder_consented: metadata?.text_reminder_consented || false,
        
        // Call quality metrics
        interruptions: metadata?.interruptions || 0,
        tool_calls_made: metadata?.tool_calls_made || [],
        
        // Save timestamp
        saved_at: new Date().toISOString()
      };
      
      // Save interaction to Supabase
      const { data, error } = await sb
        .from('interactions')
        .insert({
          lead_id,
          broker_id,
          type: 'ai_call',
          direction: metadata?.direction || 'outbound',
          content,
          duration_seconds,
          outcome,
          recording_url,
          metadata: interactionMetadata,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        logger.error('Error saving interaction:', error);
        return JSON.stringify({ 
          success: false, 
          error: error.message,
          message: 'Failed to save interaction.'
        });
      }
      
      // Update lead engagement (increment interaction_count)
      try {
        await sb.rpc('increment_interaction_count', { lead_uuid: lead_id });
      } catch (rpcError) {
        logger.warn('Failed to increment interaction count:', rpcError);
      }
      
      // Update lead timestamps
      await sb
        .from('leads')
        .update({
          last_contact: new Date().toISOString(),
          last_engagement: new Date().toISOString()
        })
        .eq('id', lead_id);
      
      logger.info(`✅ Interaction saved: ${data.id} (${Object.keys(interactionMetadata).length} metadata fields)`);
      
      return JSON.stringify({
        success: true,
        interaction_id: data.id,
        message: 'Call interaction saved successfully with full context.',
        metadata_saved: Object.keys(interactionMetadata).length
      });
      
    } catch (error: any) {
      logger.error('Error saving interaction:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message,
        message: 'Unable to save interaction details.'
      });
    }
  }
});

