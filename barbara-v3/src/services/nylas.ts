/**
 * Nylas Calendar Service
 * Handles calendar availability checking and appointment booking
 */

import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

const NYLAS_API_KEY = process.env.NYLAS_API_KEY;
const NYLAS_API_URL = process.env.NYLAS_API_URL || 'https://api.us.nylas.com';

export interface CalendarEvent {
  start: number;  // Unix timestamp (ms)
  end: number;    // Unix timestamp (ms)
}

export interface AvailableSlot {
  datetime: string;  // ISO 8601
  unix_timestamp: number;
  display: string;
  day: string;
  time: string;
  priority: number;
  is_same_day: boolean;
  is_tomorrow: boolean;
}

/**
 * Get broker's calendar events for availability checking
 * 
 * @param grantId - Nylas grant ID for the broker
 * @param startTime - Start of time range (Unix timestamp in seconds)
 * @param endTime - End of time range (Unix timestamp in seconds)
 * @returns Array of calendar events (busy times)
 */
export async function getBrokerEvents(
  grantId: string,
  startTime: number,
  endTime: number
): Promise<CalendarEvent[]> {
  if (!NYLAS_API_KEY) {
    throw new Error('NYLAS_API_KEY not configured');
  }

  const url = `${NYLAS_API_URL}/v3/grants/${grantId}/events?calendar_id=primary&start=${startTime}&end=${endTime}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${NYLAS_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`Nylas events API failed: ${response.status} ${errorText}`);
    throw new Error(`Nylas events API failed: ${response.status}`);
  }

  const data: any = await response.json();
  
  return (data.data || []).map((event: any) => ({
    start: event.when.start_time * 1000,
    end: event.when.end_time * 1000
  }));
}

/**
 * Find free time slots by analyzing gaps between busy times
 * 
 * @param startMs - Start of search range (milliseconds)
 * @param endMs - End of search range (milliseconds)
 * @param busyTimes - Array of busy calendar events
 * @param durationMs - Required slot duration (milliseconds)
 * @returns Array of available time slots
 */
export function findFreeSlots(
  startMs: number,
  endMs: number,
  busyTimes: CalendarEvent[],
  durationMs: number = 20 * 60 * 1000  // 20 minutes default
): CalendarEvent[] {
  const slots: CalendarEvent[] = [];
  
  // Sort busy times by start time
  busyTimes.sort((a, b) => a.start - b.start);
  
  let currentTime = startMs;
  
  // Find gaps between busy times
  for (const busy of busyTimes) {
    if (currentTime + durationMs <= busy.start) {
      // There's a gap - find all possible slots
      let slotStart = currentTime;
      while (slotStart + durationMs <= busy.start) {
        const slotDate = new Date(slotStart);
        const dayOfWeek = slotDate.getDay();
        const hour = slotDate.getHours();
        
        // Only business hours: Mon-Fri, 10am-5pm
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 10 && hour < 17) {
          slots.push({
            start: slotStart,
            end: slotStart + durationMs
          });
        }
        
        slotStart += 15 * 60 * 1000; // Move forward 15 minutes
      }
    }
    
    currentTime = Math.max(currentTime, busy.end);
  }
  
  // Check for free time after last busy period
  let slotStart = currentTime;
  while (slotStart + durationMs <= endMs) {
    const slotDate = new Date(slotStart);
    const dayOfWeek = slotDate.getDay();
    const hour = slotDate.getHours();
    
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 10 && hour < 17) {
      slots.push({
        start: slotStart,
        end: slotStart + durationMs
      });
    }
    
    slotStart += 15 * 60 * 1000;
  }
  
  return slots;
}

/**
 * Format available slots for voice-friendly presentation
 * 
 * @param rawSlots - Array of free time slots
 * @param preferredDay - Optional day filter
 * @param preferredTime - Optional time of day filter
 * @returns Formatted slots (top 5)
 */
export function formatAvailableSlots(
  rawSlots: CalendarEvent[],
  preferredDay?: string,
  preferredTime?: string
): AvailableSlot[] {
  const formattedSlots: AvailableSlot[] = [];
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  for (const slot of rawSlots) {
    const slotStart = new Date(slot.start);
    const dayOfWeek = slotStart.getDay();
    const dayName = dayNames[dayOfWeek];
    const hour = slotStart.getHours();
    
    // Filter by preferred day
    if (preferredDay && preferredDay !== 'any' && preferredDay !== dayName) {
      continue;
    }
    
    // Filter by preferred time
    if (preferredTime === 'morning' && hour >= 12) continue;
    if (preferredTime === 'afternoon' && hour < 12) continue;
    if (preferredTime === 'evening' && hour < 17) continue;
    
    const isToday = slotStart.toDateString() === new Date().toDateString();
    const isTomorrow = slotStart.toDateString() === new Date(Date.now() + 86400000).toDateString();
    
    formattedSlots.push({
      datetime: slotStart.toISOString(),
      unix_timestamp: Math.floor(slot.start / 1000),
      display: `${slotStart.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      })} at ${slotStart.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`,
      day: dayName,
      time: slotStart.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
      priority: isToday ? 1 : (isTomorrow ? 2 : 3),
      is_same_day: isToday,
      is_tomorrow: isTomorrow
    });
  }
  
  // Sort by priority (today first, then tomorrow, then rest)
  formattedSlots.sort((a, b) => a.priority - b.priority);
  
  return formattedSlots.slice(0, 5);
}

/**
 * Create a calendar event via Nylas
 * 
 * @param grantId - Nylas grant ID for the broker
 * @param eventData - Event details
 * @returns Nylas event ID
 */
export async function createCalendarEvent(
  grantId: string,
  eventData: {
    title: string;
    description: string;
    startTime: number;  // Unix timestamp (seconds)
    endTime: number;    // Unix timestamp (seconds)
    participants: Array<{ name: string; email: string }>;
  }
): Promise<string> {
  if (!NYLAS_API_KEY) {
    throw new Error('NYLAS_API_KEY not configured');
  }

  const url = `${NYLAS_API_URL}/v3/grants/${grantId}/events?calendar_id=primary`;

  const body = {
    title: eventData.title,
    description: eventData.description,
    when: {
      start_time: eventData.startTime,
      end_time: eventData.endTime
    },
    participants: eventData.participants,
    busy: true
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NYLAS_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`Nylas create event failed: ${response.status} ${errorText}`);
    throw new Error(`Failed to create calendar event: ${response.status}`);
  }

  const data: any = await response.json();
  return data.data?.id;
}

