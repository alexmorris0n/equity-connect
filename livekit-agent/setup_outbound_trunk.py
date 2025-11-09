#!/usr/bin/env python3
"""Setup LiveKit Outbound SIP Trunk for SignalWire"""
import sys
import asyncio
from livekit import api

# LiveKit credentials
LIVEKIT_URL = "wss://equity-livekit-core.fly.dev"
LIVEKIT_API_KEY = "lk_prod_9f2b74d1c3a84e06b1f5c932a7c4f5dd"
LIVEKIT_API_SECRET = "b8f3c1a7d2e94f0c8b6a3d5e7c2f9140a3b5c7d9e1f2a4b6c8d0e2f3a5b7c9d1"

# SignalWire SIP address for outbound
SIGNALWIRE_SIP_ADDRESS = "reversebot-livekit.dapp.signalwire.com"
SIGNALWIRE_PHONE_NUMBER = "+1XXXXXXXXXX"  # Replace with your SignalWire number

async def main():
    print("Creating LiveKit Outbound SIP Trunk for SignalWire...")
    
    # Initialize LiveKit API client
    lkapi = api.LiveKitAPI(
        url=LIVEKIT_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET
    )
    
    # Create Outbound SIP Trunk
    print("\nCreating outbound SIP trunk...")
    
    trunk_request = api.CreateSIPOutboundTrunkRequest(
        trunk=api.SIPOutboundTrunkInfo(
            name="SignalWire Outbound Trunk",
            address=SIGNALWIRE_SIP_ADDRESS,
            numbers=[SIGNALWIRE_PHONE_NUMBER],
            # auth_username and auth_password from SignalWire Support (if required)
            # auth_username="<username>",
            # auth_password="<password>",
            transport=api.SIPTransport.SIP_TRANSPORT_TCP
        )
    )
    
    try:
        trunk_response = await lkapi.sip.create_sip_outbound_trunk(trunk_request)
        trunk_id = trunk_response.sip_trunk_id
        print("SUCCESS: Outbound SIP Trunk created!")
        print(f"Trunk ID: {trunk_id}")
        print(f"Address: {SIGNALWIRE_SIP_ADDRESS}")
        print(f"Number: {SIGNALWIRE_PHONE_NUMBER}")
    except Exception as e:
        print(f"ERROR: Failed to create outbound trunk: {e}")
        print("\nIf you get auth errors, contact SignalWire Support for SIP credentials")
        return 1
    
    print("\n" + "="*50)
    print("LiveKit Outbound Trunk Setup Complete!")
    print("="*50)
    print(f"\nTrunk ID: {trunk_id}")
    print("\nNow when your agent needs to make outbound calls:")
    print("1. n8n calls /api/outbound-call")
    print("2. API creates SIP participant via LiveKit")
    print("3. LiveKit routes through this trunk to SignalWire")
    print("4. SignalWire SWML connects back to LiveKit SIP bridge")
    print()
    
    return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

