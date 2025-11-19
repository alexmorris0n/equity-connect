# Setup LiveKit SIP Trunk and Dispatch Rules for SignalWire integration
# PowerShell version for Windows

$ErrorActionPreference = "Stop"

# LiveKit credentials
$LIVEKIT_URL = "wss://barbara-o9fmqv1o.livekit.cloud"
$LIVEKIT_API_KEY = "lk_prod_9f2b74d1c3a84e06b1f5c932a7c4f5dd"
$LIVEKIT_API_SECRET = "b8f3c1a7d2e94f0c8b6a3d5e7c2f9140a3b5c7d9e1f2a4b6c8d0e2f3a5b7c9d1"

Write-Host "🔧 Creating LiveKit SIP Trunk for SignalWire..." -ForegroundColor Cyan

# Check if livekit-cli is installed
try {
    $null = Get-Command livekit-cli -ErrorAction Stop
} catch {
    Write-Host "❌ Error: livekit-cli not found. Please install it first:" -ForegroundColor Red
    Write-Host "   go install github.com/livekit/livekit-cli@latest" -ForegroundColor Yellow
    exit 1
}

# Create temporary files for trunk and dispatch rule configs
$TRUNK_CONFIG = New-TemporaryFile
$DISPATCH_CONFIG = New-TemporaryFile

# SignalWire SIP Trunk Configuration
$trunkJson = @{
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

$trunkJson | Out-File -FilePath $TRUNK_CONFIG -Encoding UTF8

Write-Host "`nTrunk config:" -ForegroundColor Yellow
Get-Content $TRUNK_CONFIG

# Create SIP Trunk using livekit-cli
Write-Host "`n📞 Creating SIP trunk..." -ForegroundColor Cyan
$trunkOutput = livekit-cli create-sip-trunk `
    --url $LIVEKIT_URL `
    --api-key $LIVEKIT_API_KEY `
    --api-secret $LIVEKIT_API_SECRET `
    --request $TRUNK_CONFIG 2>&1 | Out-String

Write-Host "Trunk created:" -ForegroundColor Green
Write-Host $trunkOutput

# Extract trunk ID from response
try {
    $trunkResponse = $trunkOutput | ConvertFrom-Json
    $TRUNK_ID = $trunkResponse.sip_trunk_id
    Write-Host "`n✅ SIP Trunk ID: $TRUNK_ID" -ForegroundColor Green
} catch {
    Write-Host "`n❌ Failed to parse trunk response. Response was:" -ForegroundColor Red
    Write-Host $trunkOutput
    Remove-Item $TRUNK_CONFIG -Force
    Remove-Item $DISPATCH_CONFIG -Force
    exit 1
}

# Dispatch Rule Configuration
$dispatchJson = @{
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

$dispatchJson | Out-File -FilePath $DISPATCH_CONFIG -Encoding UTF8

Write-Host "`nDispatch rule config:" -ForegroundColor Yellow
Get-Content $DISPATCH_CONFIG

# Create Dispatch Rule
Write-Host "`n📋 Creating dispatch rule..." -ForegroundColor Cyan
$dispatchOutput = livekit-cli create-sip-dispatch-rule `
    --url $LIVEKIT_URL `
    --api-key $LIVEKIT_API_KEY `
    --api-secret $LIVEKIT_API_SECRET `
    --request $DISPATCH_CONFIG 2>&1 | Out-String

Write-Host "Dispatch rule created:" -ForegroundColor Green
Write-Host $dispatchOutput

# Extract dispatch rule ID
try {
    $dispatchResponse = $dispatchOutput | ConvertFrom-Json
    $DISPATCH_RULE_ID = $dispatchResponse.sip_dispatch_rule_id
    Write-Host "`n✅ Dispatch Rule ID: $DISPATCH_RULE_ID" -ForegroundColor Green
} catch {
    Write-Host "`n⚠️ Warning: Could not parse dispatch rule ID, but rule may have been created" -ForegroundColor Yellow
    $DISPATCH_RULE_ID = "N/A"
}

# Cleanup
Remove-Item $TRUNK_CONFIG -Force
Remove-Item $DISPATCH_CONFIG -Force

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

