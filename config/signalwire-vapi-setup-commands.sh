#!/bin/bash

# ====================================================================
# SIGNALWIRE + VAPI SETUP COMMANDS
# ====================================================================
# 
# This script contains the cURL commands to configure SignalWire
# with VAPI for Barbara's outbound calling.
#
# DO NOT RUN THIS SCRIPT DIRECTLY - Copy/paste commands individually
# and fill in your actual values.
#
# ====================================================================

# ====================================================================
# STEP 1: COLLECT YOUR CREDENTIALS
# ====================================================================
# Before running any commands, gather these values:
#
# From VAPI Dashboard (https://dashboard.vapi.ai):
# VAPI_API_KEY="your_vapi_private_key_here"
#
# From SignalWire Dashboard (after creating SWML script):
# SIGNALWIRE_SIP_DOMAIN="your-space.dapp.signalwire.com"
# SIGNALWIRE_PHONE_NUMBER="+15035551234"
# SIGNALWIRE_PASSWORD="password_from_support"
#
# ====================================================================

# ====================================================================
# STEP 2: GET SIGNALWIRE SIP PASSWORD
# ====================================================================
# 1. In SignalWire Dashboard, go to your SWML script
# 2. Click "Addresses & Phone Numbers"
# 3. Click "Add" → Select "SIP Address"
# 4. Note your SIP domain (e.g., equity-connect-vapi.dapp.signalwire.com)
# 5. Contact SignalWire Support to generate password:
#    - Click "Help?" button in dashboard, OR
#    - Email: support@signalwire.com
#    - Subject: "Request SIP Password for VAPI Integration"
#    - Provide your SIP domain
# 6. Save password when they provide it
#
# ====================================================================

# ====================================================================
# STEP 3: CREATE VAPI SIP TRUNK CREDENTIAL (ONE TIME)
# ====================================================================
# This creates ONE reusable credential for ALL your SignalWire numbers
#
# Replace:
# - YOUR_VAPI_PRIVATE_KEY
# - YOUR_SIGNALWIRE_SIP_DOMAIN (e.g., equity-connect-vapi.dapp.signalwire.com)
# - YOUR_SIGNALWIRE_PHONE_NUMBER (e.g., +15035551234)
# - YOUR_SIGNALWIRE_PASSWORD (from support)

curl -X POST "https://api.vapi.ai/credential" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VAPI_PRIVATE_KEY" \
  -d '{
    "provider": "byo-sip-trunk",
    "name": "SignalWire Barbara Outbound Trunk",
    "gateways": [{
      "ip": "YOUR_SIGNALWIRE_SIP_DOMAIN"
    }],
    "outboundLeadingPlusEnabled": true,
    "outboundAuthenticationPlan": {
      "authUsername": "YOUR_SIGNALWIRE_PHONE_NUMBER",
      "authPassword": "YOUR_SIGNALWIRE_PASSWORD"
    }
  }'

# SAVE THE CREDENTIAL ID FROM THE RESPONSE!
# Example response:
# {
#   "id": "abc123-def456-ghi789",
#   "provider": "byo-sip-trunk",
#   ...
# }
#
# Copy the "id" value - you'll use it for ALL phone number registrations

# ====================================================================
# STEP 4: REGISTER PHONE NUMBER #1 (TEST NUMBER)
# ====================================================================
# Register your first SignalWire number to VAPI
#
# Replace:
# - YOUR_VAPI_PRIVATE_KEY
# - YOUR_SIGNALWIRE_PHONE_NUMBER (e.g., +15035551234)
# - YOUR_CREDENTIAL_ID (from Step 3 response)

curl -X POST "https://api.vapi.ai/phone-number" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VAPI_PRIVATE_KEY" \
  -d '{
    "provider": "byo-phone-number",
    "name": "SignalWire Barbara #1",
    "number": "YOUR_SIGNALWIRE_PHONE_NUMBER",
    "numberE164CheckEnabled": true,
    "credentialId": "YOUR_CREDENTIAL_ID"
  }'

# SAVE THE PHONE NUMBER ID FROM THE RESPONSE!
# Example response:
# {
#   "id": "phone_xyz789",
#   "number": "+15035551234",
#   ...
# }
#
# Copy the "id" value - you'll use this in n8n workflow

# ====================================================================
# STEP 5: REGISTER ADDITIONAL NUMBERS (WHEN READY)
# ====================================================================
# For each additional SignalWire number you purchase:
#
# 1. In SignalWire, assign the same "vapi-barbara-outbound" SWML script
# 2. Run this command with the new number:

curl -X POST "https://api.vapi.ai/phone-number" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VAPI_PRIVATE_KEY" \
  -d '{
    "provider": "byo-phone-number",
    "name": "SignalWire Barbara #2",
    "number": "YOUR_NEW_PHONE_NUMBER",
    "numberE164CheckEnabled": true,
    "credentialId": "SAME_CREDENTIAL_ID_FROM_STEP_3"
  }'

# Note: You use the SAME credentialId for all numbers!
#
# ====================================================================

# ====================================================================
# VERIFICATION COMMANDS
# ====================================================================

# List all your VAPI credentials:
curl -X GET "https://api.vapi.ai/credential" \
  -H "Authorization: Bearer YOUR_VAPI_PRIVATE_KEY"

# List all your registered phone numbers:
curl -X GET "https://api.vapi.ai/phone-number" \
  -H "Authorization: Bearer YOUR_VAPI_PRIVATE_KEY"

# ====================================================================
# TROUBLESHOOTING
# ====================================================================
#
# Problem: "Invalid gateway IP"
# Solution: Make sure you're using the SIP domain, not an IP address
#
# Problem: "Authentication failed"
# Solution: Verify your SignalWire password with support
#
# Problem: "Number already registered"
# Solution: The number may already be in VAPI - check with GET request
#
# Problem: Calls not connecting
# Solution: 
#   1. Verify SWML script is assigned to number in SignalWire
#   2. Check SIP address is created in SignalWire
#   3. Verify password is correct
#   4. Check SignalWire call logs for errors
#
# ====================================================================

