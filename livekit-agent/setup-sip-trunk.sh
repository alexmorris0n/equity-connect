#!/bin/bash
# Setup LiveKit SIP Trunk and Dispatch Rules for SignalWire integration

set -e

# Check required environment variables
if [ -z "$LIVEKIT_URL" ] || [ -z "$LIVEKIT_API_KEY" ] || [ -z "$LIVEKIT_API_SECRET" ]; then
  echo "Error: LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set"
  exit 1
fi

echo "🔧 Creating LiveKit SIP Trunk for SignalWire..."

# Create temporary files for trunk and dispatch rule configs
TRUNK_CONFIG=$(mktemp)
DISPATCH_CONFIG=$(mktemp)

# SignalWire SIP Trunk Configuration
# This accepts calls FROM SignalWire and routes them to LiveKit rooms
cat > "$TRUNK_CONFIG" <<EOF
{
  "inbound_addresses": [],
  "inbound_numbers_regex": ".*",
  "inbound_username": "",
  "inbound_password": "",
  "outbound_address": "",
  "outbound_number": "",
  "outbound_username": "",
  "outbound_password": "",
  "name": "signalwire-trunk"
}
EOF

echo "Trunk config:"
cat "$TRUNK_CONFIG"

# Create SIP Trunk using livekit-cli
echo ""
echo "Creating SIP trunk..."
TRUNK_RESPONSE=$(livekit-cli create-sip-trunk \
  --url "$LIVEKIT_URL" \
  --api-key "$LIVEKIT_API_KEY" \
  --api-secret "$LIVEKIT_API_SECRET" \
  --request "$TRUNK_CONFIG")

echo "Trunk created:"
echo "$TRUNK_RESPONSE"

# Extract trunk ID from response
TRUNK_ID=$(echo "$TRUNK_RESPONSE" | jq -r '.sip_trunk_id')
echo ""
echo "✅ SIP Trunk ID: $TRUNK_ID"

# Dispatch Rule Configuration
# This routes inbound calls to dynamic rooms based on phone number
cat > "$DISPATCH_CONFIG" <<EOF
{
  "rule": {
    "dispatchRuleDirect": {
      "roomName": "inbound-{{ .CallerNumber }}",
      "pin": ""
    }
  },
  "trunk_ids": ["$TRUNK_ID"],
  "hide_phone_number": false,
  "name": "signalwire-inbound-dispatch"
}
EOF

echo ""
echo "Dispatch rule config:"
cat "$DISPATCH_CONFIG"

# Create Dispatch Rule
echo ""
echo "Creating dispatch rule..."
DISPATCH_RESPONSE=$(livekit-cli create-sip-dispatch-rule \
  --url "$LIVEKIT_URL" \
  --api-key "$LIVEKIT_API_KEY" \
  --api-secret "$LIVEKIT_API_SECRET" \
  --request "$DISPATCH_CONFIG")

echo "Dispatch rule created:"
echo "$DISPATCH_RESPONSE"

# Extract dispatch rule ID
DISPATCH_RULE_ID=$(echo "$DISPATCH_RESPONSE" | jq -r '.sip_dispatch_rule_id')
echo ""
echo "✅ Dispatch Rule ID: $DISPATCH_RULE_ID"

# Cleanup
rm -f "$TRUNK_CONFIG" "$DISPATCH_CONFIG"

echo ""
echo "========================================="
echo "✅ LiveKit SIP Trunk Setup Complete!"
echo "========================================="
echo ""
echo "Trunk ID:         $TRUNK_ID"
echo "Dispatch Rule ID: $DISPATCH_RULE_ID"
echo ""
echo "Next steps:"
echo "1. Configure SignalWire phone numbers to point to:"
echo "   https://equity-agent-api.fly.dev/api/swml-inbound?to={to}&from={from}"
echo ""
echo "2. For outbound calls via SWML, use:"
echo "   https://equity-agent-api.fly.dev/api/swml-outbound?room={room_name}&lead_id={lead_id}"
echo ""

