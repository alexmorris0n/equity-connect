#!/usr/bin/env python3
"""Setup LiveKit SIP Trunk and Dispatch Rules using Python"""
import os
import sys
import httpx
import json
from livekit import api

# LiveKit credentials
LIVEKIT_URL = "wss://barbara-o9fmqv1o.livekit.cloud"
LIVEKIT_API_KEY = "lk_prod_9f2b74d1c3a84e06b1f5c932a7c4f5dd"
LIVEKIT_API_SECRET = "b8f3c1a7d2e94f0c8b6a3d5e7c2f9140a3b5c7d9e1f2a4b6c8d0e2f3a5b7c9d1"

async def main():
    print("Creating LiveKit SIP Trunk for SignalWire...")
    print("\nNOTE: The LiveKit Python SDK does not yet support SIP trunk/dispatch rule creation.")
    print("You must use one of these methods instead:")
    print("\n1. Install livekit-cli (requires Go):")
    print("   go install github.com/livekit/livekit-cli@latest")
    print("   Then run: ./setup-sip-trunk.sh")
    print("\n2. Use LiveKit Cloud Dashboard:")
    print("   https://cloud.livekit.io/")
    print("\n3. Manually create via curl:")
    print("")
    
    # For now, just document what needs to be created
    trunk_config = {
        "inbound_addresses": [],
        "inbound_numbers_regex": ".*",
        "name": "signalwire-trunk"
    }
    
    dispatch_config = {
        "rule": {
            "dispatchRuleDirect": {
                "roomName": "inbound-{{ .CallerNumber }}",
                "pin": ""
            }
        },
        "hide_phone_number": False,
        "name": "signalwire-inbound-dispatch"
    }
    
    print("Trunk configuration:")
    print(json.dumps(trunk_config, indent=2))
    print("\nDispatch rule configuration (after trunk is created):")
    print(json.dumps(dispatch_config, indent=2))
    print("\nSave these to files and use with livekit-cli:")
    print("  livekit-cli create-sip-trunk --url wss://barbara-o9fmqv1o.livekit.cloud \\")
    print("    --api-key lk_prod_9f2b74d1c3a84e06b1f5c932a7c4f5dd \\")
    print("    --api-secret b8f3c1a7d2e94f0c8b6a3d5e7c2f9140a3b5c7d9e1f2a4b6c8d0e2f3a5b7c9d1 \\")
    print("    --request trunk.json")
    
    return 0
    
    print("\n" + "="*50)
    print("LiveKit SIP Trunk Setup Complete!")
    print("="*50)
    print(f"\nTrunk ID:         {trunk_id}")
    print(f"Dispatch Rule ID: {dispatch_rule_id}")
    print("\nNext steps:")
    print("1. Configure SignalWire phone numbers to point to:")
    print("   https://barbara-livekit-api.fly.dev/api/swml-inbound?to={to}&from={from}")
    print("\n2. For outbound calls via SWML, use:")
    print("   https://barbara-livekit-api.fly.dev/api/swml-outbound?room={room_name}&lead_id={lead_id}")
    print()
    
    return 0

if __name__ == "__main__":
    import asyncio
    sys.exit(asyncio.run(main()))

