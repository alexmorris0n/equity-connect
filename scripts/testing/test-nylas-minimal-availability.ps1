# Test Nylas availability with minimal valid payload
# Try different combinations to find what works

# Load .env
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#].+?)=(.+)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

$NYLAS_API_KEY = $env:NYLAS_API_KEY
$grant_id = "c18c3f0f-2cb2-4b39-bc87-3a72ee4f10aa"
$email = "alex@instaroute.com"

Write-Host ""
Write-Host "Testing minimal availability payloads..." -ForegroundColor Cyan
Write-Host ""

if (-Not $NYLAS_API_KEY) {
    Write-Host "ERROR: NYLAS_API_KEY not set in .env" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $NYLAS_API_KEY"
    "Content-Type" = "application/json"
    "Accept" = "application/json, application/gzip"
}

# Test 1: Minimal payload with Unix timestamps
Write-Host "Test 1: Minimal payload with Unix timestamps..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/calendars/availability"
    
    $startTime = [DateTimeOffset]::new((Get-Date).AddDays(1)).ToUnixTimeSeconds()
    $endTime = [DateTimeOffset]::new((Get-Date).AddDays(2)).ToUnixTimeSeconds()
    
    $body = @{
        participants = @(
            @{
                email = $email
            }
        )
        start_time = $startTime
        end_time = $endTime
        duration_minutes = 30
    } | ConvertTo-Json -Depth 3
    
    Write-Host "Body: $body"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Minimal payload works" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Grant-specific endpoint
Write-Host "Test 2: Grant-specific availability..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/calendars/availability"
    
    $startTime = [DateTimeOffset]::new((Get-Date).AddDays(1)).ToUnixTimeSeconds()
    $endTime = [DateTimeOffset]::new((Get-Date).AddDays(2)).ToUnixTimeSeconds()
    
    $body = @{
        start_time = $startTime
        end_time = $endTime
        duration_minutes = 30
    } | ConvertTo-Json
    
    Write-Host "Body: $body"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Grant-specific works" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Try with emails array instead of participants
Write-Host "Test 3: Emails array format..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/calendars/availability"
    
    $startTime = [DateTimeOffset]::new((Get-Date).AddDays(1)).ToUnixTimeSeconds()
    $endTime = [DateTimeOffset]::new((Get-Date).AddDays(2)).ToUnixTimeSeconds()
    
    $body = @{
        emails = @($email)
        start_time = $startTime
        end_time = $endTime
        duration_minutes = 30
    } | ConvertTo-Json
    
    Write-Host "Body: $body"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Emails array works" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Minimal availability test complete!" -ForegroundColor Cyan
