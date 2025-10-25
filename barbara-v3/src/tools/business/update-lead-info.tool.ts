/**
 * Update Lead Info Tool
 * Update lead information collected during the call
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { getSupabaseClient } from '../../services/supabase.js';
import { logger } from '../../utils/logger.js';

/**
 * Update lead information collected during conversation
 * Auto-calculates equity when property_value or mortgage_balance changes
 */
export const updateLeadInfoTool = realtimeTool({
  name: 'update_lead_info',
  description: 'Update lead information collected during the call (last name, address, age, property value, etc.)',
  parameters: z.object({
    lead_id: z.string().describe('Lead UUID'),
    last_name: z.string().nullish().describe('Lead last name'),
    property_address: z.string().nullish().describe('Full property address'),
    age: z.number().nullish().describe('Lead age'),
    property_value: z.number().nullish().describe('Estimated property value in dollars'),
    mortgage_balance: z.number().nullish().describe('Remaining mortgage balance in dollars (0 if paid off)'),
    owner_occupied: z.boolean().nullish().describe('Whether property is owner-occupied primary residence')
  }),
  execute: async ({ lead_id, ...updates }) => {
    const sb = getSupabaseClient();
    
    try {
      logger.info(`📝 Updating lead info: ${lead_id}`);
      
      // Build update object
      const updateData: any = { ...updates };
      
      // Calculate equity if we have property value
      if (updates.property_value !== undefined && updates.property_value !== null) {
        const mortgage = updates.mortgage_balance || 0;
        updateData.estimated_equity = updates.property_value - mortgage;
        logger.info(`💰 Calculated equity: $${updateData.estimated_equity.toLocaleString()}`);
      }
      
      // Update timestamps
      updateData.updated_at = new Date().toISOString();
      updateData.last_contact = new Date().toISOString();
      
      const { data, error } = await sb
        .from('leads')
        .update(updateData)
        .eq('id', lead_id)
        .select()
        .single();
      
      if (error) {
        logger.error('Lead update error:', error);
        return JSON.stringify({ 
          success: false, 
          error: error.message,
          message: 'Failed to update lead information.'
        });
      }
      
      const updatedFields = Object.keys(updates);
      logger.info(`✅ Updated ${updatedFields.length} field(s): ${updatedFields.join(', ')}`);
      
      return JSON.stringify({
        success: true,
        message: `Lead information updated successfully.`,
        updated_fields: updatedFields,
        estimated_equity: updateData.estimated_equity || data.estimated_equity
      });
      
    } catch (error: any) {
      logger.error('Error updating lead:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message,
        message: 'Unable to update lead information.'
      });
    }
  }
});

