/**
 * Nylas Calendar Helpers - Copied from Barbara V3
 * Functions for checking availability and finding free slots
 */

/**
 * Find free time slots by analyzing gaps between busy times
 */
function findFreeSlots(startMs, endMs, busyTimes, durationMs, timezone) {
  const slots = [];
  
  // Sort busy times by start time
  busyTimes.sort((a, b) => a.start - b.start);
  
  // Round starting time to next clean 15-minute interval (00, 15, 30, 45)
  const startDate = new Date(startMs);
  const minutes = startDate.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 15) * 15;
  startDate.setMinutes(roundedMinutes, 0, 0);
  
  let currentTime = startDate.getTime();
  
  for (const busy of busyTimes) {
    // If there's a gap before this busy time
    if (currentTime + durationMs <= busy.start) {
      // Find all possible slots in this gap
      let slotStart = currentTime;
      while (slotStart + durationMs <= busy.start) {
        const slotEnd = slotStart + durationMs;
        const slotDate = new Date(slotStart);
        const dayOfWeek = slotDate.getDay();
        const hour = slotDate.getHours();
        
        // Only business hours: Mon-Fri, 10am-5pm
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 10 && hour < 17) {
          slots.push({ start: slotStart, end: slotEnd });
        }
        
        slotStart += 15 * 60 * 1000; // Move forward 15 minutes
      }
    }
    
    // Move past this busy time
    currentTime = Math.max(currentTime, busy.end);
  }
  
  // Check for free time after last busy period
  let slotStart = currentTime;
  while (slotStart + durationMs <= endMs) {
    const slotEnd = slotStart + durationMs;
    const slotDate = new Date(slotStart);
    const dayOfWeek = slotDate.getDay();
    const hour = slotDate.getHours();
    
    // Only business hours: Mon-Fri, 10am-5pm
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 10 && hour < 17) {
      slots.push({ start: slotStart, end: slotEnd });
    }
    
    slotStart += 15 * 60 * 1000; // Move forward 15 minutes
  }
  
  return slots;
}

/**
 * Format available time slots
 */
function formatAvailableSlots(rawSlots, preferred_day, preferred_time, timezone) {
  if (!rawSlots || rawSlots.length === 0) return [];
  
  const formattedSlots = [];
  
  for (const slot of rawSlots) {
    const slotStart = new Date(slot.start);
    const dayOfWeek = slotStart.getDay();
    const dayName = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][dayOfWeek];
    const hour = slotStart.getHours();
    
    // Filter by preferred day
    if (preferred_day && preferred_day !== 'any' && preferred_day !== dayName) continue;
    
    // Filter by preferred time
    if (preferred_time === 'morning' && hour >= 12) continue;
    if (preferred_time === 'afternoon' && hour < 12) continue;
    
    const isToday = slotStart.toDateString() === new Date().toDateString();
    const isTomorrow = slotStart.toDateString() === new Date(Date.now() + 86400000).toDateString();
    
    formattedSlots.push({
      datetime: slotStart.toISOString(),
      display: slotStart.toLocaleString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }),
      is_same_day: isToday,
      is_tomorrow: isTomorrow
    });
  }
  
  return formattedSlots.slice(0, 5);
}

module.exports = { findFreeSlots, formatAvailableSlots };

