/**
 * Find Broker by Territory Tool
 * Assign appropriate broker based on lead's location (city or ZIP code)
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { getSupabaseClient } from '../../services/supabase.js';
import { logger } from '../../utils/logger.js';

/**
 * Find the appropriate broker for a lead based on their territory
 * Falls back to default broker (Walter) if no specific match
 */
export const findBrokerByTerritoryTool = realtimeTool({
  name: 'find_broker_by_territory',
  description: 'Find the appropriate broker for a lead based on their city or ZIP code. Use this for new callers who need broker assignment before booking.',
  parameters: z.object({
    city: z.string().nullish().describe('City name (e.g., "Inglewood", "Tampa")'),
    zip_code: z.string().nullish().describe('ZIP code if known')
  }),
  execute: async ({ city, zip_code }) => {
    const sb = getSupabaseClient();
    
    try {
      logger.info(`🗺️  Finding broker for territory: ${zip_code || city || 'unknown'}`);
      
      // Query broker_territories table
      let query = sb
        .from('broker_territories')
        .select('broker_id, brokers(id, contact_name, company_name, phone)')
        .eq('active', true);
      
      // Search by ZIP code first (most precise)
      if (zip_code) {
        query = query.eq('zip_code', zip_code);
      } 
      // Fallback to city/market name
      else if (city) {
        query = query.or(`market_name.ilike.%${city}%,neighborhood_name.ilike.%${city}%`);
      }
      
      const { data, error } = await query.limit(1).single();
      
      if (error || !data) {
        // Default to Walter if no territory match
        logger.info('No territory match, using default broker');
        const { data: defaultBroker } = await sb
          .from('brokers')
          .select('id, contact_name, company_name')
          .eq('id', '6a3c5ed5-664a-4e13-b019-99fe8db74174')
          .single();
        
        if (!defaultBroker) {
          return JSON.stringify({
            found: false,
            error: 'No broker available',
            message: 'Unable to assign a broker at this time.'
          });
        }
        
        logger.info(`✅ Assigned default broker: ${defaultBroker.contact_name}`);
        
        return JSON.stringify({
          found: true,
          broker_id: defaultBroker.id,
          broker_name: defaultBroker.contact_name.split(' ')[0], // First name only
          company_name: defaultBroker.company_name,
          message: `Assigned to ${defaultBroker.contact_name} (default broker - no specific territory match for ${city || zip_code})`
        });
      }
      
      const broker = data.brokers as any;
      logger.info(`✅ Found broker: ${broker.contact_name} for ${zip_code || city}`);
      
      return JSON.stringify({
        found: true,
        broker_id: broker.id,
        broker_name: broker.contact_name.split(' ')[0], // First name only
        company_name: broker.company_name,
        territory: city || zip_code,
        message: `Found broker ${broker.contact_name} for territory ${city || zip_code}`
      });
      
    } catch (error: any) {
      logger.error('Error finding broker:', error);
      return JSON.stringify({ 
        found: false, 
        error: error.message,
        message: 'Unable to assign broker - will use default'
      });
    }
  }
});

