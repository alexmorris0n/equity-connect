# Test Nylas Free/Busy with grant-specific endpoint
# Try different variations of the free/busy endpoint

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
Write-Host "Testing different Free/Busy endpoints..." -ForegroundColor Cyan
Write-Host ""

if (-Not $NYLAS_API_KEY) {
    Write-Host "ERROR: NYLAS_API_KEY not set in .env" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $NYLAS_API_KEY"
    "Content-Type" = "application/json"
}

$startTime = [DateTimeOffset]::new((Get-Date)).ToUnixTimeSeconds()
$endTime = [DateTimeOffset]::new((Get-Date).AddDays(7)).ToUnixTimeSeconds()

# Test 1: General free/busy endpoint
Write-Host "Test 1: General free/busy endpoint..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/calendars/free-busy"
    $body = @{
        start_time = $startTime
        end_time = $endTime
        emails = @($email)
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! General free/busy works" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Grant-specific free/busy endpoint
Write-Host "Test 2: Grant-specific free/busy endpoint..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/calendars/free-busy"
    $body = @{
        start_time = $startTime
        end_time = $endTime
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Grant-specific free/busy works" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Try with different email format
Write-Host "Test 3: Free/busy with participant format..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/calendars/free-busy"
    $body = @{
        start_time = $startTime
        end_time = $endTime
        participants = @(
            @{
                email = $email
            }
        )
    } | ConvertTo-Json -Depth 3
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Participant format works" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Free/Busy endpoint testing complete!" -ForegroundColor Cyan
