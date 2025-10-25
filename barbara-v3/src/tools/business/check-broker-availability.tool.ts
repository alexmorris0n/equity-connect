/**
 * Check Broker Availability Tool
 * Query Nylas calendar for available appointment slots
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { getSupabaseClient } from '../../services/supabase.js';
import { getBrokerEvents, findFreeSlots, formatAvailableSlots } from '../../services/nylas.js';
import { logger } from '../../utils/logger.js';

/**
 * Check broker calendar availability
 * Returns available time slots for the next 14 days
 * Performance: Typically 8-15 seconds (Nylas API calls)
 */
export const checkBrokerAvailabilityTool = realtimeTool({
  name: 'check_broker_availability',
  description: 'Check broker calendar availability for appointment scheduling. Returns available time slots for the next 14 days.',
  parameters: z.object({
    broker_id: z.string().describe('Broker UUID to check availability for'),
    preferred_day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).nullish().describe('Preferred day of week if lead expressed preference'),
    preferred_time: z.enum(['morning', 'afternoon', 'evening']).nullish().describe('Preferred time of day if lead expressed preference')
  }),
  execute: async ({ broker_id, preferred_day, preferred_time }) => {
    const sb = getSupabaseClient();
    const startTime = Date.now();
    
    try {
      logger.info(`📅 Checking availability for broker: ${broker_id}`);
      
      // Get broker's Nylas grant ID
      const { data: broker, error: brokerError } = await sb
        .from('brokers')
        .select('contact_name, email, timezone, nylas_grant_id')
        .eq('id', broker_id)
        .single();
      
      if (brokerError || !broker) {
        logger.error('Broker not found:', brokerError);
        return JSON.stringify({
          success: false,
          error: 'Broker not found',
          message: 'Unable to check availability - broker not found.'
        });
      }
      
      if (!broker.nylas_grant_id) {
        logger.warn('⚠️  Broker has no Nylas grant - calendar not connected');
        return JSON.stringify({
          success: false,
          error: 'Calendar not connected',
          message: `${broker.contact_name}'s calendar is not connected. Please schedule manually.`
        });
      }
      
      // Calculate time range (next 14 days)
      const now = Math.floor(Date.now() / 1000);
      const endTime = Math.floor((Date.now() + 14 * 24 * 60 * 60 * 1000) / 1000);
      
      // Get broker's calendar events
      const busyTimes = await getBrokerEvents(broker.nylas_grant_id, now, endTime);
      
      logger.info(`✅ Found ${busyTimes.length} busy events on calendar`);
      
      // Find free slots (gaps between busy times)
      const freeSlots = findFreeSlots(
        now * 1000,
        endTime * 1000,
        busyTimes,
        20 * 60 * 1000  // 20 minute appointments
      );
      
      // Format and filter slots based on preferences
      const availableSlots = formatAvailableSlots(
        freeSlots,
        preferred_day || undefined,
        preferred_time || undefined
      );
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Availability check complete in ${duration}ms - found ${availableSlots.length} slots`);
      
      // Generate smart response message
      let message = '';
      if (availableSlots.length === 0) {
        message = `${broker.contact_name} has no availability in the next 2 weeks within business hours (10 AM - 5 PM Mon-Fri).`;
      } else {
        const sameDaySlots = availableSlots.filter(slot => slot.is_same_day);
        const tomorrowSlots = availableSlots.filter(slot => slot.is_tomorrow);
        
        if (sameDaySlots.length > 0) {
          message = `Great news! ${broker.contact_name} has ${sameDaySlots.length} slot(s) available today. The earliest is ${sameDaySlots[0].time}.`;
        } else if (tomorrowSlots.length > 0) {
          message = `${broker.contact_name} has ${tomorrowSlots.length} slot(s) available tomorrow. The earliest is ${tomorrowSlots[0].time}.`;
        } else {
          message = `${broker.contact_name} has ${availableSlots.length} available times over the next 2 weeks.`;
        }
      }
      
      return JSON.stringify({
        success: true,
        available_slots: availableSlots,
        broker_name: broker.contact_name,
        calendar_provider: 'nylas',
        business_hours: '10:00 AM - 5:00 PM Mon-Fri',
        message: message
      });
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Availability check failed after ${duration}ms:`, error);
      return JSON.stringify({
        success: false,
        error: error.message,
        message: 'Unable to check calendar availability. Please try scheduling manually.'
      });
    }
  }
});

