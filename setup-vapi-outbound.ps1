# VAPI Outbound Setup Script
# Run this in PowerShell

# STEP 1: Set your VAPI API key
$VAPI_API_KEY = "YOUR_VAPI_API_KEY_HERE"

# STEP 2: Create credential
Write-Host "Creating VAPI outbound credential..." -ForegroundColor Cyan
$credentialBody = @{
    provider = "byo-sip-trunk"
    name = "SignalWire Outbound"
    gateways = @(
        @{ ip = "reversebot-3b7b50ea254d.sip.signalwire.com" }
    )
    outboundLeadingPlusEnabled = $true
    outboundAuthenticationPlan = @{
        authUsername = "+14244851544"
        authPassword = "contempt*venice3mend3MOVING"
    }
} | ConvertTo-Json -Depth 10

$credentialResponse = Invoke-RestMethod -Uri "https://api.vapi.ai/credential" -Method POST -Headers @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $VAPI_API_KEY"
} -Body $credentialBody

$credentialId = $credentialResponse.id
Write-Host "✅ Credential created: $credentialId" -ForegroundColor Green

# STEP 3: Register phone numbers
$phoneNumbers = @(
    @{ number = "+14244851544"; name = "MyReverseOptions1" }
    @{ number = "+14245502888"; name = "MyReverseOptions2" }
    @{ number = "+14245502229"; name = "MyReverseOptions3" }
    @{ number = "+14245502223"; name = "MyReverseOptions4" }
    @{ number = "+14246724222"; name = "MyReverseOptions5" }
)

$phoneIds = @()

foreach ($phone in $phoneNumbers) {
    Write-Host "Registering $($phone.number)..." -ForegroundColor Cyan
    
    $phoneBody = @{
        provider = "byo-phone-number"
        number = $phone.number
        name = $phone.name
        numberE164CheckEnabled = $true
        credentialId = $credentialId
    } | ConvertTo-Json
    
    $phoneResponse = Invoke-RestMethod -Uri "https://api.vapi.ai/phone-number" -Method POST -Headers @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $VAPI_API_KEY"
    } -Body $phoneBody
    
    $phoneIds += @{
        number = $phone.number
        name = $phone.name
        id = $phoneResponse.id
    }
    
    Write-Host "✅ $($phone.number) registered: $($phoneResponse.id)" -ForegroundColor Green
}

Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "PHONE NUMBER IDs (Save these!):" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
foreach ($phone in $phoneIds) {
    Write-Host "$($phone.number) ($($phone.name)): $($phone.id)"
}
Write-Host "`n✅ All done! Now update your database with these new IDs." -ForegroundColor Green

