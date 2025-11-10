#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate LiveKit test URL with Premium (Deepgram + ElevenLabs) template"""

import requests
import sys
import io
import os

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Load .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not required if env vars already set

# Configuration
API_URL = "https://equity-agent-api.fly.dev"
LIVEKIT_PLAYGROUND_URL = "https://agents-playground.livekit.io/"

# Get template from Supabase via REST API
def get_premium_template_id():
    """Get the Premium (Deepgram + ElevenLabs) template ID"""
    # Use environment variables
    supabase_url = os.getenv("SUPABASE_URL", "https://mxnqfwuhvurajrgoefyg.supabase.co")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_key:
        print("❌ SUPABASE_SERVICE_KEY not set")
        sys.exit(1)
    
    # Query via REST API
    response = requests.get(
        f"{supabase_url}/rest/v1/ai_templates",
        headers={
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json"
        },
        params={
            "name": "eq.Premium (Deepgram + ElevenLabs)",
            "select": "id,name,stt_provider,tts_provider,tts_voice"
        }
    )
    
    if response.status_code != 200:
        print(f"❌ Supabase API error: {response.text}")
        sys.exit(1)
    
    results = response.json()
    if not results:
        print("❌ Premium template not found")
        sys.exit(1)
    
    template = results[0]
    print(f"✅ Found template: {template['name']}")
    print(f"   STT: {template['stt_provider']}")
    print(f"   TTS: {template['tts_provider']} ({template['tts_voice']})")
    
    return template["id"]

def generate_test_token(template_id):
    """Call API to generate test token"""
    response = requests.post(
        f"{API_URL}/api/livekit/test-token",
        json={"template_id": template_id}
    )
    
    if response.status_code != 200:
        print(f"❌ API error: {response.text}")
        sys.exit(1)
    
    return response.json()

def main():
    print("\n🎯 Generating LiveKit Test URL\n")
    
    # Get template ID
    template_id = get_premium_template_id()
    print(f"   Template ID: {template_id}\n")
    
    # Generate token
    print("🔑 Generating test token...")
    data = generate_test_token(template_id)
    
    # Build playground URL
    token = data["token"]
    livekit_url = data["livekit_url"]
    room_name = data["room_name"]
    
    playground_url = f"{LIVEKIT_PLAYGROUND_URL}?url={livekit_url}&token={token}"
    
    print(f"✅ Test room created: {room_name}\n")
    print("=" * 80)
    print("🎮 LIVEKIT PLAYGROUND URL:")
    print("=" * 80)
    print(playground_url)
    print("=" * 80)
    print("\n📋 Instructions:")
    print("   1. Click the URL above (or copy/paste into browser)")
    print("   2. Click 'Connect' in the playground")
    print("   3. Allow microphone access")
    print("   4. The AI agent will auto-join and greet you with Tiffany's voice")
    print("\n⚡ Expected:")
    print("   • Voice: Tiffany (ElevenLabs eleven_turbo_v2_5)")
    print("   • STT: Deepgram nova-2 (fast streaming)")
    print("   • Latency: Much faster than EdenAI")
    print("   • Audio: Clear (native WebRTC)")
    print("\n")

if __name__ == "__main__":
    main()

