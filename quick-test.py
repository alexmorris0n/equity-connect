#!/usr/bin/env python3
import os
import time
from livekit import api

# LiveKit credentials (ACTUAL working keys)
LIVEKIT_API_KEY = "lk_prod_9f2b74d1c3a84e06b1f5c932a7c4f5dd"
LIVEKIT_API_SECRET = "b8f3c1a7d2e94f0c8b6a3d5e7c2f9140a3b5c7d9e1f2a4b6c8d0e2f3a5b7c9d1"
LIVEKIT_URL = "wss://equity-livekit-core.fly.dev"

# Template ID - Premium (Deepgram + ElevenLabs) - CONFIGURATION
TEMPLATE_ID = "803ce7c4-4762-4b78-bd0b-dc103a27677f"

# Call Type - test-demo - INSTRUCTIONS/PROMPT
CALL_TYPE = "test-demo"

# Create room name
room_name = f"test-{hex(int(time.time()))[2:]}"

# Create token
token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
token.with_identity("test-user")
token.with_name("Test User")
token.with_grants(api.VideoGrants(
    room_join=True,
    room=room_name,
    can_publish=True,
    can_subscribe=True,
    can_publish_data=True
))
# Pass BOTH template (config) AND call_type (prompt)
token.with_metadata(f'{{"template_id":"{TEMPLATE_ID}","call_type":"{CALL_TYPE}","is_test":true}}')

jwt_token = token.to_jwt()

# Create test URL
test_url = f"https://meet.livekit.io/custom?liveKitUrl={LIVEKIT_URL}&token={jwt_token}"

print(f"\nTest URL created!")
print(f"\n{test_url}\n")
print(f"Room: {room_name}")
print(f"Config: Premium (Deepgram + ElevenLabs + GPT-4o)")
print(f"Prompt: test-demo (friendly Barbara conversation)\n")

