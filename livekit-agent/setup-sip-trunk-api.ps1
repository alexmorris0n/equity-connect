# Setup LiveKit SIP Trunk using REST API (no livekit-cli needed)
# PowerShell version for Windows

$ErrorActionPreference = "Stop"

# LiveKit credentials
$LIVEKIT_URL = "wss://barbara-o9fmqv1o.livekit.cloud"
$LIVEKIT_API_KEY = "lk_prod_9f2b74d1c3a84e06b1f5c932a7c4f5dd"
$LIVEKIT_API_SECRET = "b8f3c1a7d2e94f0c8b6a3d5e7c2f9140a3b5c7d9e1f2a4b6c8d0e2f3a5b7c9d1"

Write-Host "🔧 Creating LiveKit SIP Trunk for SignalWire..." -ForegroundColor Cyan

# Function to create JWT token for LiveKit API
function New-LiveKitToken {
    param (
        [string]$apiKey,
        [string]$apiSecret
    )
    
    # For now, we'll use basic auth with API key/secret
    $bytes = [System.Text.Encoding]::UTF8.GetBytes("${apiKey}:${apiSecret}")
    $base64 = [Convert]::ToBase64String($bytes)
    return "Basic $base64"
}

$authHeader = New-LiveKitToken -apiKey $LIVEKIT_API_KEY -apiSecret $LIVEKIT_API_SECRET

# SignalWire SIP Trunk Configuration
$trunkBody = @{
    inbound_addresses = @()
    inbound_numbers_regex = ".*"
    inbound_username = ""
    inbound_password = ""
    outbound_address = ""
    outbound_number = ""
    outbound_username = ""
    outbound_password = ""
    name = "signalwire-trunk"
} | ConvertTo-Json

Write-Host "`nTrunk config:" -ForegroundColor Yellow
Write-Host $trunkBody

# Create SIP Trunk via REST API
Write-Host "`n📞 Creating SIP trunk..." -ForegroundColor Cyan
try {
    $trunkResponse = Invoke-RestMethod -Uri "$LIVEKIT_URL/twirp/livekit.SIPService/CreateSIPTrunk" `
        -Method Post `
        -Headers @{
            "Authorization" = $authHeader
            "Content-Type" = "application/json"
        } `
        -Body $trunkBody
    
    $TRUNK_ID = $trunkResponse.sip_trunk_id
    Write-Host "`n✅ SIP Trunk created!" -ForegroundColor Green
    Write-Host "Trunk ID: $TRUNK_ID" -ForegroundColor White
} catch {
    Write-Host "`n❌ Failed to create trunk:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host "`n⚠️ Note: LiveKit SIP API might require JWT tokens instead of Basic Auth" -ForegroundColor Yellow
    Write-Host "Please use the Bash script on a system with livekit-cli installed" -ForegroundColor Yellow
    exit 1
}

# Dispatch Rule Configuration
$dispatchBody = @{
    rule = @{
        dispatchRuleDirect = @{
            roomName = "inbound-{{ .CallerNumber }}"
            pin = ""
        }
    }
    trunk_ids = @($TRUNK_ID)
    hide_phone_number = $false
    name = "signalwire-inbound-dispatch"
} | ConvertTo-Json -Depth 10

Write-Host "`nDispatch rule config:" -ForegroundColor Yellow
Write-Host $dispatchBody

# Create Dispatch Rule
Write-Host "`n📋 Creating dispatch rule..." -ForegroundColor Cyan
try {
    $dispatchResponse = Invoke-RestMethod -Uri "$LIVEKIT_URL/twirp/livekit.SIPService/CreateSIPDispatchRule" `
        -Method Post `
        -Headers @{
            "Authorization" = $authHeader
            "Content-Type" = "application/json"
        } `
        -Body $dispatchBody
    
    $DISPATCH_RULE_ID = $dispatchResponse.sip_dispatch_rule_id
    Write-Host "`n✅ Dispatch Rule created!" -ForegroundColor Green
    Write-Host "Dispatch Rule ID: $DISPATCH_RULE_ID" -ForegroundColor White
} catch {
    Write-Host "`n❌ Failed to create dispatch rule:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "✅ LiveKit SIP Trunk Setup Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Trunk ID:         $TRUNK_ID" -ForegroundColor White
Write-Host "Dispatch Rule ID: $DISPATCH_RULE_ID" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Configure SignalWire phone numbers to point to:" -ForegroundColor White
Write-Host "   https://barbara-livekit-api.fly.dev/api/swml-inbound?to={to}&from={from}" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. For outbound calls via SWML, use:" -ForegroundColor White
Write-Host "   https://barbara-livekit-api.fly.dev/api/swml-outbound?room={room_name}&lead_id={lead_id}" -ForegroundColor Cyan
Write-Host ""

