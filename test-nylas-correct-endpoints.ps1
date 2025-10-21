# Test Nylas with CORRECT endpoints from v3 documentation
# Uses the proper grant-specific free-busy endpoint

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
Write-Host "Testing Nylas with CORRECT v3 endpoints..." -ForegroundColor Cyan
Write-Host "Grant ID: $grant_id"
Write-Host "Email: $email"
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

# Test 1: CORRECT Free/Busy endpoint (grant-specific)
Write-Host "Test 1: CORRECT Free/Busy endpoint..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/calendars/free-busy"
    
    $startTime = [DateTimeOffset]::new((Get-Date)).ToUnixTimeSeconds()
    $endTime = [DateTimeOffset]::new((Get-Date).AddDays(7)).ToUnixTimeSeconds()
    
    $body = @{
        start_time = $startTime
        end_time = $endTime
        emails = @($email)
    } | ConvertTo-Json
    
    Write-Host "URL: $url"
    Write-Host "Body: $body"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Free/Busy endpoint works" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 3)"
    
    if ($response.Count -gt 0) {
        $emailData = $response[0]
        if ($emailData.time_slots) {
            Write-Host "Found $($emailData.time_slots.Count) busy time slots"
        } else {
            Write-Host "No busy time slots found (calendar is free!)"
        }
    }
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""

# Test 2: CORRECT Availability endpoint
Write-Host "Test 2: CORRECT Availability endpoint..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/calendars/availability"
    
    $startTime = [DateTimeOffset]::new((Get-Date).AddDays(1)).ToUnixTimeSeconds()
    $endTime = [DateTimeOffset]::new((Get-Date).AddDays(2)).ToUnixTimeSeconds()
    
    $body = @{
        participants = @(
            @{
                email = $email
                calendar_ids = @("primary")
            }
        )
        start_time = $startTime
        end_time = $endTime
        duration_minutes = 30
    } | ConvertTo-Json -Depth 3
    
    Write-Host "URL: $url"
    Write-Host "Body: $body"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Availability endpoint works" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 3)"
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Correct endpoints test complete!" -ForegroundColor Cyan
