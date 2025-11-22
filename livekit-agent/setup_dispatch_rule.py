#!/usr/bin/env python3
"""
Setup LiveKit SIP Dispatch Rule

This script creates a dispatch rule that tells LiveKit to start your agent
when SIP calls come in from SignalWire.
"""

import os
from livekit import api
from dotenv import load_dotenv

load_dotenv()

LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

async def create_dispatch_rule():
    """Create SIP dispatch rule for inbound calls"""
    
    print("Creating LiveKit SIP Dispatch Rule...")
    print(f"LiveKit URL: {LIVEKIT_URL}")
    
    # Create LiveKit API client
    lk_api = api.LiveKitAPI(
        url=LIVEKIT_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET
    )
    
    # Create SIP dispatch rule
    # This tells LiveKit: "When a SIP call creates a room, start the agent"
    rule = api.SIPDispatchRule(
        rule=api.SIPDispatchRuleIndividual(
            room_prefix="sip-",  # Matches rooms created by SIP calls
            attributes=[],
        ),
    )
    
    try:
        result = await lk_api.sip.create_sip_dispatch_rule(rule)
        print(f"✅ Dispatch rule created: {result.sip_dispatch_rule_id}")
        print("\nYour agent will now automatically join SIP calls!")
        print("\nNext steps:")
        print("1. Configure SignalWire number to route to LiveKit SIP")
        print("2. Test by calling your SignalWire number")
    except Exception as e:
        print(f"❌ Error creating dispatch rule: {e}")
        print("\nMake sure:")
        print("- LiveKit credentials are correct in .env")
        print("- SIP is enabled in your LiveKit project")

if __name__ == "__main__":
    import asyncio
    asyncio.run(create_dispatch_rule())

