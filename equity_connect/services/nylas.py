"""Nylas calendar service for availability checking and appointment booking"""
import os
import httpx
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

NYLAS_API_KEY = os.getenv("NYLAS_API_KEY")
NYLAS_API_URL = os.getenv("NYLAS_API_URL", "https://api.us.nylas.com")

async def get_broker_events(grant_id: str, start_time: int, end_time: int) -> List[Dict[str, int]]:
	"""Get broker's calendar events for availability checking
	
	Args:
	    grant_id: Nylas grant ID for the broker
	    start_time: Start of time range (Unix timestamp in seconds)
	    end_time: End of time range (Unix timestamp in seconds)
	
	Returns:
	    List of calendar events with start/end times in milliseconds
	"""
	if not NYLAS_API_KEY:
		raise ValueError("NYLAS_API_KEY not configured")
	
	url = f"{NYLAS_API_URL}/v3/grants/{grant_id}/events?calendar_id=primary&start={start_time}&end={end_time}"
	
	async with httpx.AsyncClient() as client:
		response = await client.get(
			url,
			headers={
				"Authorization": f"Bearer {NYLAS_API_KEY}",
				"Content-Type": "application/json"
			}
		)
		
		if response.status_code != 200:
			logger.error(f"Nylas events API failed: {response.status_code} {response.text}")
			raise Exception(f"Nylas events API failed: {response.status_code}")
		
		data = response.json()
		events = []
		
		for event in data.get("data", []):
			when = event.get("when", {})
			if "start_time" in when and "end_time" in when:
				events.append({
					"start": when["start_time"] * 1000,  # Convert to ms
					"end": when["end_time"] * 1000
				})
		
		return events

def find_free_slots(
	start_ms: int,
	end_ms: int,
	busy_times: List[Dict[str, int]],
	duration_ms: int = 20 * 60 * 1000  # 20 minutes default
) -> List[Dict[str, int]]:
	"""Find free time slots by analyzing gaps between busy times
	
	Args:
	    start_ms: Start of search range (milliseconds)
	    end_ms: End of search range (milliseconds)
	    busy_times: List of busy calendar events
	    duration_ms: Required slot duration (milliseconds)
	
	Returns:
	    List of available time slots
	"""
	slots = []
	
	# Sort busy times by start time
	busy_times_sorted = sorted(busy_times, key=lambda x: x["start"])
	
	current_time = start_ms
	
	# Find gaps between busy times
	for busy in busy_times_sorted:
		if current_time + duration_ms <= busy["start"]:
			# There's a gap - find all possible slots
			slot_start = current_time
			while slot_start + duration_ms <= busy["start"]:
				slot_date = datetime.fromtimestamp(slot_start / 1000)
				day_of_week = slot_date.weekday()  # 0=Monday, 6=Sunday
				hour = slot_date.hour
				
				# Only business hours: Mon-Fri, 10am-5pm
				if day_of_week < 5 and hour >= 10 and hour < 17:
					slots.append({
						"start": slot_start,
						"end": slot_start + duration_ms
					})
				
				slot_start += 15 * 60 * 1000  # Move forward 15 minutes
		
		current_time = max(current_time, busy["end"])
	
	# Check for free time after last busy period
	slot_start = current_time
	while slot_start + duration_ms <= end_ms:
		slot_date = datetime.fromtimestamp(slot_start / 1000)
		day_of_week = slot_date.weekday()
		hour = slot_date.hour
		
		if day_of_week < 5 and hour >= 10 and hour < 17:
			slots.append({
				"start": slot_start,
				"end": slot_start + duration_ms
			})
		
		slot_start += 15 * 60 * 1000
	
	return slots

def format_available_slots(
	raw_slots: List[Dict[str, int]],
	preferred_day: Optional[str] = None,
	preferred_time: Optional[str] = None
) -> List[Dict[str, Any]]:
	"""Format available slots for voice-friendly presentation
	
	Args:
	    raw_slots: List of free time slots
	    preferred_day: Optional day filter
	    preferred_time: Optional time of day filter
	
	Returns:
	    Formatted slots (top 5)
	"""
	formatted_slots = []
	day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
	
	now = datetime.now()
	today_start = datetime(now.year, now.month, now.day).timestamp() * 1000
	tomorrow_start = today_start + 24 * 60 * 60 * 1000
	
	for slot in raw_slots[:20]:  # Limit to 20 for performance
		slot_date = datetime.fromtimestamp(slot["start"] / 1000)
		day_name = day_names[slot_date.weekday()].lower()
		
		# Apply filters
		if preferred_day and day_name != preferred_day.lower():
			continue
		
		hour = slot_date.hour
		if preferred_time:
			if preferred_time == "morning" and hour >= 12:
				continue
			elif preferred_time == "afternoon" and (hour < 12 or hour >= 17):
				continue
			elif preferred_time == "evening" and hour < 17:
				continue
		
		is_same_day = today_start <= slot["start"] < tomorrow_start
		is_tomorrow = tomorrow_start <= slot["start"] < tomorrow_start + 24 * 60 * 60 * 1000
		
		# Format display strings
		date_str = slot_date.strftime("%A, %B %d")
		time_str = slot_date.strftime("%I:%M %p").lstrip("0")
		
		formatted_slots.append({
			"datetime": slot_date.isoformat(),
			"unix_timestamp": int(slot["start"] / 1000),
			"display": f"{date_str} at {time_str}",
			"day": day_name,
			"time": time_str,
			"priority": 1 if is_same_day else (2 if is_tomorrow else 3),
			"is_same_day": is_same_day,
			"is_tomorrow": is_tomorrow
		})
	
	# Sort by priority (same day first, then tomorrow, then later)
	formatted_slots.sort(key=lambda x: (x["priority"], x["unix_timestamp"]))
	
	return formatted_slots[:5]  # Return top 5

async def create_calendar_event(grant_id: str, event_data: Dict[str, Any]) -> str:
	"""Create a calendar event via Nylas
	
	Args:
	    grant_id: Nylas grant ID
	    event_data: Event data with title, description, startTime, endTime, participants
	
	Returns:
	    Nylas event ID
	"""
	if not NYLAS_API_KEY:
		raise ValueError("NYLAS_API_KEY not configured")
	
	url = f"{NYLAS_API_URL}/v3/grants/{grant_id}/events"
	
	# Format participants
	participants = []
	for p in event_data.get("participants", []):
		participants.append({
			"email": p["email"],
			"name": p.get("name", "")
		})
	
	payload = {
		"title": event_data["title"],
		"description": event_data.get("description", ""),
		"when": {
			"start_time": event_data["startTime"],
			"end_time": event_data["endTime"]
		},
		"participants": participants
	}
	
	async with httpx.AsyncClient() as client:
		response = await client.post(
			url,
			headers={
				"Authorization": f"Bearer {NYLAS_API_KEY}",
				"Content-Type": "application/json"
			},
			json=payload
		)
		
		if response.status_code not in [200, 201]:
			logger.error(f"Nylas create event failed: {response.status_code} {response.text}")
			raise Exception(f"Nylas create event failed: {response.status_code}")
		
		data = response.json()
		return data.get("data", {}).get("id", "")


